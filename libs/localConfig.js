/*jslint node: true */
"use strict";

// Version Control
global.appName = 'cdns';
global.appVersionString = 'cdns-0.5.0';
global.appVersionNum = 5;

module.exports = {
    dbUrl: process.env.CDNS_DB_URL || 'http://admin:cdnsadmin@localhost:5984',
    dbName: process.env.CDNS_DB_NAME || 'cdns',
    port: process.env.CDNS_PORT || 8888,
    consolePort: process.env.CDNS_CONSOLE_PORT || 3000,
    consoleUser: process.env.CDNS_CONSOLE_USER || 'admin',
    consolePass: process.env.CDNS_CONSOLE_PASS || 'admin',
    logLevel: process.env.CDNS_LOG_LEVEL || 'info',
    logDir: process.env.CDNS_LOG_DIR || 'log',
    logRotationInterval: process.env.CDNS_LOG_ROTATION_INTERVAL || 3600,
    loadBalancePeriod: process.env.CDNS_LOAD_BALANCE_PERIOD || 60000,
    workers: process.env.CDNS_WORKER_PROCESSES || null,
    stickySessionTimeoutSeconds: process.env.CDNS_STICKY_SESSION_TIMEOUT || 30
};
