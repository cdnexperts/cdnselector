/*jslint node: true */
"use strict";

// Version Control
global.appName = 'vxcdns';
global.appVersionString = 'vx-cdns-0.3.0';
global.appVersionNum = 3;

module.exports = {
    dbUrl: process.env.CDNS_DB_URL || 'http://localhost:5984',
    port: process.env.CDNS_PORT || 8888,
    consolePort: process.env.CDNS_CONSOLE_PORT || 3000,
    logLevel: process.env.CDNS_LOG_LEVEL || 'info',
    logDir: process.env.CDNS_LOG_DIR || 'log',
    logRotationInterval: process.env.CDNS_LOG_ROTATION_INTERVAL || 60,
    altoSourceId: process.env.CDNS_ALTO_SOURCE_ID || 'alto-fetcher-1'
};