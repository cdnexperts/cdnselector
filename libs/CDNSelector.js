/*jslint node: true */
"use strict";

var VelocixCDN = require('./cdn/VelocixCDN'),
    GenericOttCDN = require('./cdn/GenericOttCDN'),
    AmazonCloudfront = require('./cdn/AmazonCloudfront'),
    logger = require('winston');

function CDNSelector(distribDao, cdnDao) {
    this.distribDao = distribDao;
    this.cdnDao = cdnDao;
    this.cdnInstances = {};

    var self = this,
        cdnClasses = {
            "cdns:cdn:driver:velocix": VelocixCDN,
            "cdns:cdn:driver:generic": GenericOttCDN,
            "cdns:cdn:driver:amazon": AmazonCloudfront
        };

    function loadCdnDriver (id, cdnConfig) {
        var cdn;
        for (var driverKey in cdnClasses) {
            if (cdnConfig.driver === driverKey) {
                cdn = new cdnClasses[driverKey](id, cdnConfig, distribDao);
                break;
            }
        }
        // No driver found, so assume its a generic HTTP CDN.
        if (!cdn) {
            cdn = new GenericOttCDN(id, cdnConfig, distribDao);
        }
        return cdn;
    }

    // Load a driver for each CDN at startup
    var cdnConfigs = cdnDao.getAll();
    for (var cdnId in cdnConfigs) {
        self.cdnInstances[cdnId] = loadCdnDriver(cdnId, cdnConfigs[cdnId]);
    }

    // Reload drivers whenever a CDN config changes
    cdnDao.on('updated', function (cdnId, cdnConfig) {
        self.cdnInstances[cdnId] = loadCdnDriver(cdnId, cdnConfig);
    });

    // Remove drivers whenever a CDN is deleted
    cdnDao.on('deleted', function (cdnId) {
        console.log('Removing ' + cdnId);
        delete self.cdnInstances[cdnId];
    });

    cdnDao.on('error', function (err) {
        logger.error('Error while loading CDN configs from database.', err);
    });
}

var proto = CDNSelector.prototype;

proto.selectNetworks = function (clientIp, hostname) {
    var self = this,
        candidates = [];


    // Lookup the configuration for this hostname
    var distrib = self.distribDao.getByHostname(hostname);
    if (!distrib || !distrib.providers) {
        return [];
    }

    // Loop through the possible CDNs (aka, providers) for this hostname
    distrib.providers.forEach(function (provider) {
        logger.debug('CDN Selector considering ' + provider.id);

        // Is this provider active?
        if (provider.active) {
            logger.debug('  Provider is active');

            // Lookup the CDN
            var cdn = self.cdnInstances[provider.id];

            if (global.DEBUG && cdn) {
                logger.debug('  CDN is active? ' + cdn.isActive());
                logger.debug('  Client IP ' + clientIp + ' is allowed? ' + cdn.isClientIpAllowed(clientIp));
            }

            // Does our network location allow us to use this provider?
            if (cdn && cdn.isActive() && cdn.isClientIpAllowed(clientIp)) {
                if (global.DEBUG) {
                    logger.debug('  Adding ' + cdn + ' to candidate list');
                }
                candidates.push(cdn);
            } else if (global.DEBUG) {
                logger.debug('  Rejecting ' + cdn);
            }
        } else {
            logger.debug('  Provider is inactive - rejecting');
        }
    });

    return candidates;
};


module.exports = CDNSelector;