/*jslint node: true */
"use strict";

// Dependencies
var localConfig = require('./localConfig.js'),
    AltoClient = require('./AltoClient.js'),
    dbHelper = require('./database')(localConfig.dbUrl),
    logger = require('winston');



logger.info("Starting ALTO Fetcher");

// Don't do anything until we know that we can connect to the DB.
dbHelper.connect(function (err, database) {

    if (err) {
        logger.error("ALTO fetcher cannot connect to the database.", err);
        return;
    }

    var cdnDao = require('./dao/CDNs')(database),
        operatorNetworks = require('./dao/OperatorNetworks')(database),
        altoClients = {};

    function onNetworkMapChanged (networkList, cdnId) {
        logger.info('ALTO Client for ' + cdnId + ' detected change in the network map');

        cdnDao.fetch(cdnId, function (err, cdnConfig) {
            if (!err) {
                if (!cdnConfig.clientIpWhitelist) {
                    cdnConfig.clientIpWhitelist = {};
                }
                cdnConfig.clientIpWhitelist['alto'] = networkList;
                if (cdnConfig.altoService) {
                    cdnConfig.altoService.lastChanged = new Date().toISOString();
                }
                cdnDao.save(cdnConfig, function (err) {
                    if (err) {
                        logger.error("Could not save Operator Ranges to database.", err);
                    } else {
                        logger.info("Saved clientIpWhitelist to database for " + cdnId);
                    }
                });
            } else {
                logger.error('Cannot fetch CDN config for update', err);
            }
        });
    }

    function onAltoError (err) {
        logger.info('Error from ALTO client : ' + err);
    }

    function createAltoClient(config, cdnId) {
        // Create a client to handle this CDN
        var altoClient = new AltoClient(config, cdnId);
        altoClient.on('networkMapChanged', onNetworkMapChanged);
        altoClients[cdnId] = altoClient;
        logger.info('Created ALTO client for ' + cdnId);
    }

    // When the CDN config is available create a client for
    // Each CDN that has an ALTO service configured
    cdnDao.on('ready', function () {
        var cdnsConfig = cdnDao.getAll();
        for (var cdnId in cdnsConfig) {
            var cdnConfig = cdnsConfig[cdnId];
            if (cdnConfig.altoService) {
                createAltoClient(cdnConfig.altoService, cdnId);
            }
        }
    });

    // If a CDN config changes then we should tell the ALTO client
    cdnDao.on('updated', function (cdnId, cdnConfig) {
        // Do we have an ALTO client for this CDN?
        var altoClient = altoClients[cdnId];

        if (altoClient && !cdnConfig.altoService) {
            // The alto service config was removed, so we should stop
            // the ALTO client for this CDN
            altoClient.stop();
            delete altoClients[cdnId];
            logger.info('Stopped ALTO monitoring for ' + cdnId);
            return;
        }

        if (altoClient && cdnConfig.altoService) {
            // The alto client exists, and the config still contains
            // an Alto service config. Pass in the new config in case it changed.
            altoClient.setConfig(cdnConfig.altoService);
            return;
        }

        if (!altoClient && cdnConfig.altoService) {
            // There is no ALTO client, but an ALTO service is configured
            // We should start a new client.
            createAltoClient(cdnConfig.altoService, cdnId);
            return;
        }
    });
});

module.exports = {};