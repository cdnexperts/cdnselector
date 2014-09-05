/*jslint node: true*/
"use strict";
var http = require('http'),
    winston = require('winston'),
    crypto = require('crypto'),
    querystring = require('querystring');

module.exports = {
    runTestAgainstLocalServer: function (onRequest, readyCallback) {
        // Start a server to act as the Velocix end
        var server = http.createServer(function (request, response) {
            onRequest(request, response);
        });
        server.listen(0, '127.0.0.1');

        // When the server is listening its time to start the client and run the test.
        server.on('listening', function () {
            readyCallback(server.address().port, server);
        });
    },
    withLogLevel: function (level) {
        winston.remove(winston.transports.Console);
        winston.add(winston.transports.Console, {
            level: level,
            timestamp: false
        });
        if (level === 'debug') {
            global.DEBUG = true;
        }
        return this;
    },
    validateAndExtractVelocixToken: function(token, secret) {
        var decodedToken = new Buffer(token, 'base64').toString('utf8'),
            tokenParts = decodedToken.split(','),
            params = querystring.parse(tokenParts[0]),
            signature = tokenParts[1],
            hashFn = params.fn || 'sha256',
            hmac;

        try {
            hmac = crypto.createHmac(hashFn, new Buffer(secret, 'utf8'));
        } catch (e) {
            errorlog.warn('Received token with unknown hash function "' + hashFn + '"" : ' + token);
            return null;
        }
        hmac.update(tokenParts[0], 'utf8');
        if (signature === hmac.digest('hex')) {
            return params;
        }
        return null;
    },
    extractAkamaiTokenParameters: function(token) {
        var tokenParams = {};
        var tokenKvPairs = token.split('~');
        for (var i=0; i < tokenKvPairs.length; i+=1) {
            var kvPair = tokenKvPairs[i].split('=');
            tokenParams[kvPair[0]] = kvPair[1];
        }
        return tokenParams;
    },
    readResponse: function(response, callback) {
        var data = '';
        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function () {
            callback(data);
        });
    },
    clone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}