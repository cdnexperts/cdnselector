/*jslint node: true */
"use strict";

var url = require('url'),
    errorlog = require('winston'),
    Cookies = require('cookies'),
    tokenCookieField = 'vxtoken',
    querystring = require('querystring'),
    crypto = require('crypto');

module.exports = {
    extractInboundToken: function (request, authParam) {
        // Check for an inbound token on the request. It could be in the querystring
        // or in a cookie named 'vxtoken'
        var inboundToken,
            urlObj = url.parse(request.url, true);

        if (authParam && urlObj.query) {
            inboundToken = urlObj.query[authParam];
        }
        if (!inboundToken && request.headers && request.headers.cookie) {
            var cookies = new Cookies(request, null);
            if (cookies) {
                inboundToken = cookies.get(tokenCookieField);
            }
        }

        return inboundToken;
    },
    getTokenParameters: function (token) {
        var decodedToken = new Buffer(token, 'base64').toString('utf8'),
            tokenParts = decodedToken.split(',');

        return querystring.parse(tokenParts[0]);

    },
    tokenIsValid: function (token, secrets) {

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
                    return true;
                }
            }
        }
        return false;
    }
}