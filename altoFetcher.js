/*jslint node: true */
"use strict";

// Dependencies
var localConfig = require('./libs/localConfig.js'),
    AltoClient = require('./libs/AltoClient.js'),
    database = require('./libs/database')(localConfig.dbUrl),
    logger = require('winston');


// Error log
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    timestamp: true
});
logger.info("Starting ALTO Fetcher");

// Don't do anything until we know that we can connect to the DB.
database.connect(function (err, database) {

    if (err) {
        logger.error("ALTO fetcher cannot connect to the database.", err);
        return;
    }

    var config = require('./libs/dao/Config')(database),
        operatorNetworks = require('./libs/dao/OperatorNetworks')(database),
        altoClient = new AltoClient();

    // Whenever the config loads, notify the ALTO client.
    // This will trigger it to poll immediately.
    config.on('configLoaded', function (confParams) {
        altoClient.setConfig(confParams.alto);
    });

    // Listen for errors from the config loader
    config.on('error', function (err) {
        logger.error("Could not load config for Alto client", err);
    });

    // Listen out for changes to the ALTO network map
    // and stuff them into the DB.
    altoClient.on('networkMapChanged', function (ipLookup) {
        logger.info('ALTO Client detected change in the network map');

        // Store ipLookup in the database
        operatorNetworks.save(ipLookup, localConfig.altoSourceId, function (err) {
            if (err) {
                logger.error("Could not save Operator Ranges to database.", err);
            } else {
                logger.info("Saved IP ranges to database. source=" + localConfig.altoSourceId);
            }
        });
    });

    // Listen out for errors from the ALTO client
    altoClient.on('error', function (err) {
        logger.info('Error from ALTO client : ' + err);
    });
});

