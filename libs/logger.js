/*jslint node: true */
"use strict";

// Initialise logging
// There are 2 loggers - an error log using Winston, and a more
// specialised request logger to generate the W3C-based log format
var localConfig = require('./localConfig'),
    winston = require('winston'),
    RequestLogger = require('./RequestLogger');


// Error log
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    level: localConfig.logLevel,
    timestamp: true
});
winston.info(localConfig);
if (localConfig.logLevel === 'debug') {
    global.DEBUG = 'true';
}

// Access Log
var requestLogger = new RequestLogger(localConfig.logRotationInterval, localConfig.logDir);

// Complete the log file on close of the application
process.on('exit', function () {
    requestLogger.close();
    winston.info('Exiting');

});
process.on('SIGINT', function () {
    // TODO possibly want to remove this
    winston.info('Caught SIGINT');
    process.exit();
});

process.on('uncaughtException', function (err) {
    if (err.code && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
        // This is needed to trap the errors when connectivity with the DB is lost
        winston.warn("Connectivity issue", err);
    } else {
        winston.error('Uncaught Exception', err);
        winston.error(err.stack);
        // Since we're in an unknown state the safest thing to do is exit and
        // be respawned by the master process.
        process.exit(1);
    }
});


module.exports = {
    accesslog: requestLogger,
    errorlog: winston
};
