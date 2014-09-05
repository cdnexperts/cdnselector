/*jslint node: true */
"use strict";

var logger = require('winston'),
    util = require('util'),
    BaseCDN = require('./BaseCDN'),
    crypto = require('crypto'),
    url = require('url'),
    querystring = require('querystring'),
    errorlog = require('winston'),
    tokenDelimiter = '~';

function AkamaiCDN(id, config, distribs) {
    AkamaiCDN.super_.call(this, id, config, distribs);

    function extractCustomTokenParams(akamaiToken) {
        var customParams = {},
            param;

        for (param in akamaiToken) {
            if (param !== 'acl' &&
                param !== 'algo' &&
                param !== 'exp' &&
                param !== 'ip' &&
                param !== 'hmac') {

                customParams[param] = akamaiToken[param];
            }
        };
        return customParams;
    };

    function signToken(token, tokenConf) {
        var hashFn = tokenConf.hashFn || 'sha256',
            key = new Buffer(tokenConf.authSecrets[0], 'hex'),
            hmac = crypto.createHmac(hashFn, key),
            hmacSource = '';

        hmacSource += token;

        if (tokenConf.hashSalt) {
            hmacSource += 'salt=' + tokenConf.hashSalt;
        } else {
            // Remove the last delimiter
            hmacSource = hmacSource.substring(0,hmacSource.length - 1);
        }
        hmac.update(hmacSource, 'utf8');
        return token + 'hmac=' + hmac.digest('hex');
    };

    function getTokenParametersIfValid(token, tokenConf) {
        if (token && tokenConf && tokenConf.authSecrets.length > 0) {
            var tokenFields = token.split(tokenDelimiter),
                params = {},
                hmacSource = '',
                hashFn,
                hmac,
                i,
                hexDigest;

            for (var i = 0; i < tokenFields.length; i++) {
                var paramKVPair = tokenFields[i].split('='),
                    paramKey = paramKVPair[0],
                    paramValue = paramKVPair[1];

                if (paramKey != 'hmac') {
                    hmacSource += tokenFields[i] + tokenDelimiter;
                }
                params[paramKey] = paramValue;
            }

            // Remove the last delimiter
            if (tokenConf.hashSalt) {
                hmacSource += "salt=" + tokenConf.hashSalt;
            } else {
                hmacSource = hmacSource.substring(0,hmacSource.length - 1);
            }

            // Detect the hash function, or use the default
            hashFn = tokenConf.hashFn || 'sha256';

            // Try each configured secret until a working one is found
            for (var i = 0; i < tokenConf.authSecrets.length; i+=1) {
                try {
                    hmac = crypto.createHmac(hashFn, new Buffer(tokenConf.authSecrets[i], 'hex'));
                } catch (e) {
                    errorlog.warn('Cannot check HMAC signature for token: ' + e);
                    return null;
                }
                hmac.update(hmacSource, 'utf8');
                if (params['hmac'] === hmac.digest('hex')) {
                    return params;
                } else {
                    logger.warn("Signature incorrect for inbound Akamai token",
                            { tokenConf: tokenConf, hmacSource: hmacSource, token: token});
                }
            }
        }
        return null;
    };

    this.generateToken = function (targetUrl, inboundToken, tokenConf) {

        var token = "",
            acl = inboundToken.acl;

        if (!acl) {
            // If no ACL was set on the inbound, mint a token
            // that is restricted to the same path level as the
            // target URL
            acl = targetUrl.path;
            acl = acl.replace(/\/[^\/]+$/, '/*');
        }

        if (inboundToken.ipAddress) {
            token += "ip=" + inboundToken.ipAddress + tokenDelimiter;
        }
        token += "exp=" + (inboundToken.endTime || Math.round(Date.now()/1000) + 86400) + tokenDelimiter; // Defualt to 1 day
        token += "acl=" + acl + tokenDelimiter;

        return signToken(token, tokenConf);
    };


    this.parseAndValidateToken = function(inboundToken, tokenConf) {
        var akamaiToken = getTokenParametersIfValid(inboundToken, tokenConf);

        if (!akamaiToken) {
            return {
                isPresent: true,
                isValid: false
            };
        }

        // Convert the Akamai token into a standard format that can
        // be understood by other CDN implementations
        return {
            isPresent: true,
            isValid: true,
            ipAddress: akamaiToken['ip'],
            endTime: parseInt(akamaiToken['exp']),
            acl: akamaiToken['acl'],
            payload: extractCustomTokenParams(akamaiToken)
        };
    };
}

util.inherits(AkamaiCDN, BaseCDN);
var proto = AkamaiCDN.prototype;

proto.generateTokenizedUrl = function (targetUrl, inboundToken, provider, clientRequest) {
    var tokenConf = provider.tokens;

    if (tokenConf && inboundToken && inboundToken.isPresent) {
        var token = this.generateToken(targetUrl, inboundToken, tokenConf);

        errorlog.debug('Minted Akamai token : ' + token);
        targetUrl.query[tokenConf.authParam] = token;
        delete targetUrl.search;
    }
    // Make sure that it is a URL object returned here rather than a string
    return targetUrl;
};

proto.extractInboundToken = function(request) {
    // Akamai tokens should be in a querystring parameter
    var inboundTokenStr,
        urlObj = url.parse(request.url, true),
        provider = this.getProvider(request),
        tokenConf;

    if (provider) {
        tokenConf = provider.tokens;
    }

    if (!tokenConf) {
        logger.debug("Skipped token detection for Akamai : its not configured");
        return {
            isPresent: false
        };
    }

    // Is the token on the querystring?
    if (tokenConf.authParam && urlObj.query) {
        inboundTokenStr = urlObj.query[tokenConf.authParam];
    }

    // If we found a token then parse it
    if (inboundTokenStr) {
        var inboundToken = this.parseAndValidateToken(inboundTokenStr, tokenConf);
        inboundToken.authParams = [tokenConf.authParam];
        return inboundToken;
    }

    // Nothing found
    return {
        isPresent: false
    };
};


module.exports = AkamaiCDN;