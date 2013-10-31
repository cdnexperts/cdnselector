/*jslint node: true */
"use strict";

// Version Control
global.appName = 'vxcdns';
global.appVersionString = 'vx-cdns-0.2.0';
global.appVersionNum = 2;

// Dependencies
var HttpServer = require('./libs/servers/HttpServer'),
    CDNSelector = require('./libs/CDNSelector'),
    NetworkMap = require('./libs/NetworkMap'),
    conf = require('./config'),
    database = require('./libs/database'),
    Distributions = require('./libs/dao/Distributions'),
    CDNs = require('./libs/dao/CDNs'),
    cluster = require('cluster'),
    net = require('net'),
    async = require('async'),
    numCPUs = require('os').cpus().length,
    loggers = require('./logger');



function checkPort(port, callback) {
    var server = net.createServer(),
        portAvailable = false;

    server.listen(port);
    server.on('listening', function () {
        portAvailable = true;
        server.close();
    });
    server.on('error', function (err) {
        callback(err, false);
    });
    server.on('close', function () {
        callback(null, true);
    });
}

function errorExit(err) {
    loggers.errorlog.error(err, err.stack);
    loggers.errorlog.error('Cannot start application. Please resolve all errors and try again');
    process.exit(1);
}



(function main() {
    var port = conf.get('vxcdns:serverPort'),
        configDir = process.env.VXCDNS_CONFIG_DIR || './config',
        distribs,
        cdns,
        cdnSelector,
        networkMap,
        db,
        httpServer,
        networkMap = new NetworkMap(
                    conf.get('vxcdns:altoServiceUrl'),
                    conf.get('vxcdns:altoRefreshIntervalSeconds'),
                    conf.get('vxcdns:altoIgnorePids'),
                    conf.get('vxcdns:altoNetworkMapId'));


    // Startup checks and pre-loading data
    if (cluster.isMaster) {
        loggers.errorlog.info('Current config: ' + JSON.stringify(conf.get()));
        loggers.errorlog.info('Starting cluster of ' + numCPUs + ' child processes.');

        // Master process
        async.series([
            function (callback) {
                // Check that we can bind to the port
                checkPort(port, function (err, isAvailable) {
                    if (isAvailable) {
                        loggers.errorlog.info('Listening on port ' + port);
                        callback();
                    } else {
                        callback(new Error('Cannot bind to port ' + port + '. Is it already in use?', err));
                    }
                });
            },
            function (callback) {
                // Check that we can connect to the database, and
                // create the database if necessary
                database.getDatabase(conf.get('vxcdns:dbHost'), callback);
            },
            function (callback) {
                // Calling this here just to see if we can connect.
                networkMap.refresh(callback);
            }

        ], function (err, results) {
            if (err) {
                errorExit(err);
            } else {
                // Launch worker processes
                var i;
                for (i = 0; i < numCPUs; i += 1) {
                    cluster.fork();
                }

                // When a worker dies, respawn
                cluster.on('exit', function (worker, code, signal) {
                    loggers.errorlog.error('Worker ' + worker.process.pid + ' died');

                    cluster.fork();
                });
            }
        });

    } else {

        // Worker process
        async.series([
            function connectToDatabase (callback) {
                database.getDatabase(conf.get('vxcdns:dbHost'), function (err, database) {
                    db = database;
                    callback(err);
                });
            },
            function loadDistributionConfig (callback) {
                // Pre-load all distribution config
                distribs = new Distributions(db);
                distribs.load(callback);
            },
            function loadCDNs (callback) {
                // Pre-load all CDN config
                cdns = new CDNs(db, distribs);
                cdns.load(callback);
            },
            function getNetworkMap (callback) {
                networkMap.startMonitoring(callback);
            }
        ], function (err, results) {
            if (!err) {
                cdnSelector = new CDNSelector(distribs, cdns, networkMap);

                httpServer = new HttpServer(port, cdnSelector, loggers.accesslog);
                httpServer.on('ready', function () {
                    loggers.errorlog.info('Worker process ' + process.pid + ' started');
                });
                httpServer.start();

            } else {
                errorExit(err);
            }
        });
    }

})();

