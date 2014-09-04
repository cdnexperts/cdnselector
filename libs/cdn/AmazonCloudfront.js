/*jslint node: true */
"use strict";

var util = require('util'),
    BaseCDN = require('./BaseCDN'),
    crypto = require('crypto'),
    url = require('url'),
    querystring = require('querystring'),
    errorlog = require('winston');

function AmazonCloudfront(id, config, distribs) {
    AmazonCloudfront.super_.call(this, id, config, distribs);

    function getPolicyIfValid(policy, signature, keyPairId, signedUrlConf) {
        if (policy && signature && keyPairId
            && signedUrlConf && signedUrlConf.awsCfPrivateKey
            && signedUrlConf.awsCfKeyPairId) {


            var policyStatement = this.unescapeInvalidChars(new Buffer(policy, 'base64').toString('utf8'));
            var actualSignature = this.signPolicy(policyStatement, signedUrlConf.awsCfPrivateKey);

            if (actualSignature == signature && signedUrlConf.awsCfKeyPairId == keyPairId) {
                return JSON.parse(policyStatement);
            } else {
                errorlog.warn("Failed to validate SignedURL",
                                {
                                    policy: policy,
                                    signature: signature,
                                    keyPairId: keyPairId,
                                    signedUrlConf: signedUrlConf
                                }
                             );
                return null;
            }
        }
    };


    this.sanitizePathUri = function (pathUri) {
        // Remove any leading # signs
        // Remove the hostname and scheme if present - we should be
        // left only with a path
        if (!pathUri) {
            return '/*';
        }
        var urlObj = url.parse(pathUri.replace(/^#/, ''));
        return urlObj.path;
    };


    this.generatePolicy = function (targetUrl, inboundTokenParams) {

        // Build the policy statement
        var sanitizedPathUri = this.sanitizePathUri(inboundTokenParams.pathURI),

            resourceUrl = targetUrl.protocol
                            + '//' + targetUrl.host
                            + sanitizedPathUri
                            + '?' + querystring.stringify(targetUrl.query),

            expiry = parseInt(inboundTokenParams.expiry) || Math.round(Date.now()/1000) + 86400, // Defualt to 1 day
            ipAddress = inboundTokenParams['c-ip'],

            policyStatement = {
                Statement: [
                    {
                        Resource: resourceUrl,
                        Condition: {
                            DateLessThan: {
                                "AWS:EpochTime": expiry
                            }
                        }
                    }
                ]
            };

        // IP address is optional, so only add the clause if it is present in the inbound token
        if (ipAddress) {
            policyStatement.Statement[0].Condition.IpAddress = {
                "AWS:SourceIp": ipAddress
            }
        }

        return JSON.stringify(policyStatement);
    };


    this.escapeInvalidChars = function (str) {
        return str.replace(/\+/g, '-').replace(/=/g,'_').replace(/\//g, '~');
    };

    this.unescapeInvalidChars = function (str) {
        return str.replace(/\-/g, '+').replace(/_/g,'=').replace(/~/g, '/');
    };

    this.signPolicy = function (policyStr, key) {
        var sign = crypto.createSign('RSA-SHA1');
        sign.update(policyStr);
        return sign.sign(key, 'base64');
    };

    this.copyCustomTokenParamsToQuerystring = function (inboundTokenParams, targetUrl) {
        var param;
        for (param in inboundTokenParams) {
            if (param !== 'pathURI' &&
                param !== 'protohash' &&
                param !== 'expiry' &&
                param !== 'fn' &&
                param !== 'reuse' &&
                param !== 'c-ip') {

                targetUrl.query[param] = inboundTokenParams[param];
            }
        };
        return targetUrl;
    };

    this.parseAndValidateToken = function(policy, signature, keyPairId, signedUrlConf) {
        var policy = getPolicyIfValid(policy, signature, keyPairId, signedUrlConf);

        if (!policy) {
            return {
                isPresent: true,
                isValid: false
            };
        }

        // Convert the Policy into a standard format that can
        // be understood by other CDN implementations
        var inboundToken = {
            isPresent: true,
            isValid: true
        };

        // Copy values from the policy into our internal token format
        if (policyStatement && policyStatement.Statement && policyStatement.Statement[0]) {
            var statement = policyStatement.Statement[0];
            if (statement.Condition) {
                if (statement.Condition.IpAddress) {
                    inboundToken.ipAddress = statement.Condition.IpAddress;
                }
                if (statement.Condition.DateLessThan && statement.Condition.DateLessThan['AWS:EpochTime']) {
                    inboundToken.endTime = Condition.DateLessThan['AWS:EpochTime'];
                }
            }
            if (statement.Resource) {
                inboundToken.acl = url.parse(statement.Resource).path;
            }
        }

        return inboundToken;
    };
}

util.inherits(AmazonCloudfront, BaseCDN);
var proto = AmazonCloudfront.prototype;

proto.generateTokenizedUrl = function (targetUrl, inboundTokenParams, provider, clientRequest) {
    var signedUrlConf = provider.signedUrl;

    if (signedUrlConf) {
        // Copy any custom params from the token onto the query string before signing
        this.copyCustomTokenParamsToQuerystring(inboundTokenParams, targetUrl);

        var policy = this.generatePolicy(targetUrl, inboundTokenParams),
            signature = this.signPolicy(policy, signedUrlConf.awsCfPrivateKey);

        errorlog.debug('Minted Cloudfront signed URL with policy : ' + policy);
        targetUrl.query['Key-Pair-Id'] = signedUrlConf.awsCfKeyPairId;
        targetUrl.query['Policy'] = this.escapeInvalidChars(new Buffer(policy, 'utf8').toString('base64'));
        targetUrl.query['Signature'] = this.escapeInvalidChars(signature);
        delete targetUrl.search;

    }
    // Make sure that it is a URL object returned here rather than a string
    return targetUrl;
};

proto.extractInboundToken = function(request) {
    // Amazon tokens should be in a querystring parameter
    var policy,
        signature,
        keyPairId,
        urlObj = url.parse(request.url, true),
        provider = this.getProvider(request),
        signedUrlConf;

    if (provider) {
        signedUrlConf = provider.signedUrl;
    }

    if (!signedUrlConf) {
        errorlog.debug("Skipped token detection for Amazon : its not configured");
        return {
            isPresent: false
        };
    }

    // Is the token on the querystring?
    if (urlObj.query) {
        signature = urlObj.query['Signature'];
        policy = urlObj.query['Policy'];
        keyPairId = urlObj.query['Key-Pair-Id'];
    }

    // If we found a token then parse it
    if (signature && policy && keyPairId) {
        var inboundToken = this.parseAndValidateToken(policy, signature, keyPairId, signedUrlConf);
        inboundToken.authParam = tokenConf.authParam;
        return inboundToken;
    }

    // Nothing found
    return {
        isPresent: false
    };
};

module.exports = AmazonCloudfront;