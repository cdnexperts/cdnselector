/*jslint node: true */
"use strict";

// Dependencies
var HttpServer = require('./libs/servers/HttpServer'),
    CDNSelector = require('./libs/CDNSelector'),
    Distributions = require('./libs/dao/Distributions'),
    CDNs = require('./libs/dao/CDNs'),
    OperatorNetworks = require('./libs/dao/OperatorNetworks'),

    localConfig = require('./libs/localConfig'),
    database = require('./libs/database'),
    loggers = require('./logger')

    cluster = require('cluster'),
    net = require('net'),
    async = require('async'),
    os = require('os');

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


var distribs,
    cdns,
    cdnSelector,
    operatorNetworks,
    db,
    httpServer;


// Startup checks and pre-loading data
if (cluster.isMaster) {
    loggers.errorlog.info('Starting cluster of ' + numCPUs + ' child processes.');

    // Master process
    async.series([
        function (callback) {
            // Check that we can bind to the port
            checkPort(localConfig.port, function (err, isAvailable) {
                if (isAvailable) {
                    loggers.errorlog.info('Listening on port ' + localConfig.port);
                    callback();
                } else {
                    callback(new Error('Cannot bind to port ' + localConfig.port + '. Is it already in use?', err));
                }
            });
        },
        function (callback) {
            // Check that we can connect to the database, and
            // create the database if necessary
            database.getDatabase(localConfig.dbUrl, callback);
        }

    ], function (err, results) {
        if (err) {
            errorExit(err);
        } else {
            // Launch worker processes
            var i;
            for (i = 0; i < os.cpus().length; i += 1) {
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
            database.getDatabase(localConfig.dbUrl, function (err, database) {
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
        function loadOperatorNetworks (callback) {
            // Pre-load all Operator network config
            operatorNetworks = new OperatorNetworks(db);
            operatorNetworks.load(callback);
        }
    ], function (err, results) {
        if (!err) {
            cdnSelector = new CDNSelector(distribs, cdns, operatorNetworks);

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



