/*jslint node: true*/
"use strict";
var http = require('http'),
    winston = require('winston');

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
    }
}