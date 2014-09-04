/*jslint node: true */
"use strict";

var url = require('url'),
    http = require('http'),
    errorlog = require('winston'),
    Cookies = require('cookies'),
    querystring = require('querystring'),
    crypto = require('crypto'),
    util = require('util'),
    BaseCDN = require('./BaseCDN'),
    tokenCookieField = 'vxtoken';


function VelocixCDN(id, config, distribs) {
    VelocixCDN.super_.call(this, id, config, distribs);
    this.sscsEndpoint = config.routingService;
    this.id = id;
    this.config = config;
    this.distribs = distribs;

    this.copyCookieTokenToQueryString = function(url, request, authParam) {
        var token;
        if (!authParam) {
            authParam = 'vxttoken';
        }

        if (request.headers.cookie) {
            token = new Cookies(request, null).get('vxtoken');
            if (token) {
                if (url.indexOf('?') === -1) {
                    url += '?' + authParam + '=' + token;
                } else {
                    url += '&' + authParam + '=' + token;
                }
            }
        }
        return url;
    };


    function getTokenParametersIfValid(token, tokenConf) {
        var secrets = tokenConf.authSecrets;
        if (token && secrets && secrets.length > 0) {
            var decodedToken = new Buffer(token, 'base64').toString('utf8'),
                tokenParts = decodedToken.split(','),
                params = querystring.parse(tokenParts[0]),
                signature = tokenParts[1],
                hashFn = params.fn || 'sha256',
                hmac,
                i,
                hexDigest;

            for (i = 0; i < secrets.length; i+=1) {
                try {
                    hmac = crypto.createHmac(hashFn, new Buffer(secrets[i], 'utf8'));
                } catch (e) {
                    errorlog.warn('Received token with unknown hash function "' + hashFn + '"" : ' + token);
                    return false;
                }
                hmac.update(tokenParts[0], 'utf8');
                if (signature === hmac.digest('hex')) {
                    return params;
                } else {
                    errorlog.warn("Signature incorrect for inbound Velocix token : " + token + " tokenConf:" + tokenConf);
                }
            }
        }
        return null;
    };

    function convertTokenPathURItoACL(pathUri) {
        // Remove any leading # signs
        // Remove the hostname and scheme if present - we should be
        // left only with a path
        if (!pathUri) {
            return '/*';
        }
        var urlObj = url.parse(pathUri.replace(/^#/, ''));
        return urlObj.path;
    };

    function extractCustomTokenParams(vxToken) {
        var customParams = {},
            param;
        for (param in vxToken) {
            if (param !== 'pathURI' &&
                param !== 'protohash' &&
                param !== 'expiry' &&
                param !== 'fn' &&
                param !== 'reuse' &&
                param !== 'c-ip') {

                customParams[param] = vxToken[param];
            }
        };
        return customParams;
    };

    this.parseAndValidateToken = function(inboundToken, tokenConf) {
        var vxToken = getTokenParametersIfValid(inboundToken, tokenConf);

        if (!vxToken) {
            return {
                isPresent: true,
                isValid: false
            };
        }

        // Convert the Velocix token into a standard format that can
        // be understood by other CDN implementations
        var token =  {
            isPresent: true,
            isValid: true,
            endTime: parseInt(vxToken['expiry']),
            acl: convertTokenPathURItoACL(vxToken['pathURI']),
            payload: extractCustomTokenParams(vxToken)
        };

        if (vxToken['c-ip']) {
            token.ipAddress = vxToken['c-ip'];
        }


        return token;
    };
}
util.inherits(VelocixCDN, BaseCDN);
var proto = VelocixCDN.prototype;

proto.selectSurrogate = function (clientRequest, callback) {
    var self = this,
        reqHost = clientRequest.headers.host.split(":")[0],
        reqUrlRaw = 'http://' + reqHost + clientRequest.url,
        reqUrl = encodeURIComponent(reqUrlRaw),
        clientIp = clientRequest.socket.remoteAddress,
        distribution = self.distribs.getByHostname(reqHost),
        provider = self.getProvider(reqHost),
        velocixRequest;

    if (!this.sscsEndpoint) {
        // Server-side cache selection is not configured.
        // Use the BaseCDN implementation to ensure that this is treated like any other CDN.
        errorlog.debug('SSCS is disabled, so using  BaseCDN to handle request');
        VelocixCDN.super_.prototype.selectSurrogate.call(this, clientRequest, function(err, requestUrl, targetUrl, location) {
            if (targetUrl !== null) {
                // Was there a Cookie-based token on the inbound request?
                // If so, it should be moved to the querystring
                if (provider && provider.tokens) {
                    targetUrl = self.copyCookieTokenToQueryString(targetUrl, clientRequest, provider.tokens.authParam);
                }
                callback(null, requestUrl, targetUrl, location);
            }
        });
        return;
    }

    var requestOptions = {
        host: this.sscsEndpoint.host,
        port: this.sscsEndpoint.port,
        path: this.sscsEndpoint.path + '?cs-uri=' + reqUrl + '&c-ip=' + clientIp + '&numcaches=1'
    };
    errorlog.debug('Using SSCS to resolve redirection target', requestOptions);


    // Query the Velocix SSCSv2 API to see where it would like us to send this request.
    http.get(requestOptions, function (velocixResponse) {
        var data = '';
        velocixResponse.setEncoding('utf8');


        if (velocixResponse.statusCode !== 200) {
            errorlog.error(
                'Non-OK response code returned from Velocix Cache Selection API (SSCSv2) : ' + velocixResponse.statusCode,
                requestOptions
            );
            callback(new Error(velocixResponse.statusCode + ' HTTP status code in response from Velocix'), reqUrlRaw, null, null, true);
            return;
        }

        velocixResponse.on('data', function (chunk) {
            data += chunk;
        });

        // Handle responses from the Velocix request Router
        velocixResponse.on('end', function () {
            // Attempt to parse the JSON response from Velocix
            var routingResponse = null,
                targetUrl = null,
                location = null;
            try {
                routingResponse = JSON.parse(data);
            } catch (e) {
                callback(new Error('Could not parse JSON response from Velocix'), reqUrlRaw, null, null);
                errorlog.warn('This response from Velocix SSCSv2 does not appear to be JSON: ' + data, e);
                return;
            }

            // JSON was parsed ok, but can we access the fields we need?
            if (routingResponse !== null) {

                if (routingResponse.http !== undefined &&
                        routingResponse.http.length > 0 &&
                        routingResponse.http[0] !== undefined &&
                        routingResponse.http[0]['http.ip'] !== undefined &&
                        routingResponse.http[0]['http.ip'].length > 0) {

                    targetUrl = routingResponse.http[0]['http.ip'][0];

                }

                if (routingResponse.selectioncriteria !== undefined &&
                        routingResponse.selectioncriteria['x-location'] !== undefined &&
                        routingResponse.selectioncriteria['x-location'].length > 0) {

                    location = routingResponse.selectioncriteria['x-location'].join(',');
                }


                //TODO we could cache responses from Velocix here
            }
            if (targetUrl !== null) {
                // Was there a Cookie-based token on the inbound request?
                // If so, it should be moved to the querystring
                if (provider && provider.tokens) {
                    targetUrl = self.copyCookieTokenToQueryString(targetUrl, clientRequest, provider.tokens.authParam);
                }
                callback(null, reqUrlRaw, targetUrl, location);
            } else {
                // Couldn't find a http.ip field in the response. Assume its unavailable
                callback(null, reqUrlRaw, null, null);
                errorlog.info("Velocix did not provide a http surrogate for this request.", routingResponse);
            }
        });
    }).on('error', function (error) {
        callback(error, reqUrlRaw, null, null, true);
        errorlog.warn('Error connecting to Velocix SSCSv2 service', requestOptions, error);
    });

    return this;
};


proto.extractInboundToken = function(request) {
    // Check for an inbound token on the request. It could be in the querystring
    // or in a cookie named 'vxtoken'
    var inboundTokenStr,
        urlObj = url.parse(request.url, true),
        provider = this.getProvider(request),
        tokenConf = provider.tokens;

    if (!provider.tokens) {
        errorlog.debug("Skipped token detection for Velocix : its not configured");
        return {
            isPresent: false
        };
    }

    // Is the token on the querystring?
    if (tokenConf.authParam && urlObj.query) {
        inboundTokenStr = urlObj.query[tokenConf.authParam];
    }

    // If its not in the Querystring, try the cookie
    if (!inboundTokenStr && request.headers && request.headers.cookie) {
        var cookies = new Cookies(request, null);
        if (cookies) {
            inboundTokenStr = cookies.get(tokenCookieField);
        }
    }

    // If we found a token then parse it
    if (inboundTokenStr) {
        var inboundToken = this.parseAndValidateToken(inboundTokenStr, tokenConf);
        inboundToken.authParam = tokenConf.authParam;
        return inboundToken;
    }

    // Nothing found
    return {
        isPresent: false
    };
};


proto.generateTokenizedUrl = function (targetUrl, inboundToken, provider, clientRequest) {
    var hashFn,
        acl,
        vxTokenParams,
        hmac,
        signedToken,
        authParam;

    if (!provider.tokens || !inboundToken || !inboundToken.isPresent) {
        // Tokens not configured for this provider
        return targetUrl;
    }

    hashFn = provider.tokens.hashFn || 'sha512';

    acl = inboundToken.acl;
    if (!acl) {
        // If no ACL was set on the inbound, mint a token
        // that is restricted to the same path level as the
        // target URL
        acl = targetUrl.path;
        acl = acl.replace(/\/[^\/]+$/, '/*');
    }

    // Build the parameters to be embedded in the token
    vxTokenParams = 'expiry=' + (inboundToken.endTime || Math.round(Date.now()/1000) + 86400);
    vxTokenParams += '&fn=' + hashFn;
    vxTokenParams += '&pathURI=' + acl;

    // Add some uniqueness to the token.
    // Note that this is not binding the token to a clientIP - we're just
    // using the IP address to make sure that this token is unique (see the Velocix token docs for why)
    vxTokenParams += '&x:clientIP=' +  clientRequest.socket.remoteAddress;


    // Bind to an IP address if thats what the original token did
    if (inboundToken.ipAddress) {
        vxTokenParams += '&c-ip=' + inboundToken.ipAddress;
    }

    // Generate the signature
    try {
        hmac = crypto.createHmac(hashFn, provider.tokens.authSecrets[0]);
    } catch (e) {
        errorlog.error("Unable to create velocix HMAC : " + e);
    }
    hmac.update(vxTokenParams, 'utf8');

    // Append the signature to the token
    signedToken = vxTokenParams + ',' + hmac.digest('hex');

    // Attach the base64'd token to the URL querystring
    authParam = provider.tokens.authParam || 'vxttoken';
    if (!targetUrl.query) {
        targetUrl.query = {};
    }
    targetUrl.query[authParam] = new Buffer(signedToken, 'utf8').toString('base64');

    return targetUrl;
};


module.exports = VelocixCDN;