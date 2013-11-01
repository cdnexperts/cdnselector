/*jslint node: true */
"use strict";

// Dependencies
var localConfig = require('./libs/localConfig.js'),
    AltoClient = require('./libs/AltoClient.js'),
    database = require('./libs/database'),
    Config = require('./libs/dao/Config'),
    logger = require('winston'),
    async = require('async');


// Error log
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    timestamp: true
});;
logger.info("Starting ALTO Fetcher");


// Create an ALTO client to monitor the network map
var altoClient = new AltoClient();

altoClient.on('networkMapChanged', function (ipLookup) {
    logger.info('ALTO Client detected change in the network map');
    console.log(ipLookup);
    //TODO store ipLookup in the database
});

altoClient.on('error', function (err) {
    logger.info('Error from ALTO client', err);
});


// Load the config from the DB and pass it to the ALTO client.
// Any future changes should also be passed in.
database.getDatabase(localConfig.dbUrl, function (err, database) {
    var configLoader = new Config(database);

    configLoader.on('configChanged', function (config) {
        altoClient.setConfig(config.alto);
    });

    configLoader.on('error', function (err) {
        logger.error("Could not load config for Alto client", err);
    });
});

