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


    this.removeInvalidChars = function (str) {
        return str.replace(/\+/g, '-').replace(/=/g,'_').replace(/\//g, '~');
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
}

util.inherits(AmazonCloudfront, BaseCDN);
var proto = AmazonCloudfront.prototype;

proto.generateTokenizedUrl = function (targetUrl, inboundTokenParams, provider) {
    var signedUrlConf = provider.signedUrl;

    if (signedUrlConf) {
        // Copy any custom params from the token onto the query string before signing
        this.copyCustomTokenParamsToQuerystring(inboundTokenParams, targetUrl);

        var policy = this.generatePolicy(targetUrl, inboundTokenParams),
            signature = this.signPolicy(policy, signedUrlConf.awsCfPrivateKey);

        errorlog.debug('Minted Cloudfront signed URL with policy : ' + policy);
        targetUrl.query['Key-Pair-Id'] = signedUrlConf.awsCfKeyPairId;
        targetUrl.query['Policy'] = this.removeInvalidChars(new Buffer(policy, 'utf8').toString('base64'));
        targetUrl.query['Signature'] = this.removeInvalidChars(signature);
        delete targetUrl.search;

    }
    // Make sure that it is a URL object returned here rather than a string
    return targetUrl;
};

module.exports = AmazonCloudfront;