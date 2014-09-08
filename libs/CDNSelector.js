/*jslint node: true */
"use strict";

var VelocixCDN = require('./cdn/VelocixCDN'),
    GenericOttCDN = require('./cdn/GenericOttCDN'),
    AmazonCloudfront = require('./cdn/AmazonCloudfront'),
    AkamaiCDN = require('./cdn/AkamaiCDN'),
    logger = require('winston');

function CDNSelector(distribDao, cdnDao, loadBalancer) {
    this.distribDao = distribDao;
    this.cdnDao = cdnDao;
    this.cdnInstances = {};
    this.loadBalancer = loadBalancer;

    var self = this,
        cdnClasses = {
            "cdns:cdn:driver:velocix": VelocixCDN,
            "cdns:cdn:driver:generic": GenericOttCDN,
            "cdns:cdn:driver:amazon": AmazonCloudfront,
            "cdns:cdn:driver:akamai": AkamaiCDN
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
        delete self.cdnInstances[cdnId];
    });

    cdnDao.on('error', function (err) {
        logger.error('Error while loading CDN configs from database.', err);
    });
}

var proto = CDNSelector.prototype;

proto.getAllCDNs =  function() {
    var cdnList = [];
    for (var cdn in this.cdnInstances) {
        cdnList.push(this.cdnInstances[cdn]);
    }
    return cdnList;
};

proto.selectNetworks = function (clientIp, hostname, stickyCdnHint) {
    var self = this,
        candidates = [],
        options = {
            stickyCdnHint: stickyCdnHint
        },
        homeCdn = null;


    // Lookup the configuration for this hostname
    var distrib = self.distribDao.getByHostname(hostname);
    if (!distrib || !distrib.providers) {
        return {
            distribution: null,
            cdns: []
        };
    }

    // Loop through the possible CDNs (aka, providers) for this hostname
    distrib.providers.forEach(function (provider) {
        logger.debug('CDN Selector considering ' + provider.id);

        //TODO make this into a pipeline of loosely-coupled modules, each responsible for their check.
        // e.g, activeCheck, whitelist check, loadBalance.
        // These should have a common interface which will facilitate plugins and
        // simpler development of future features.

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

                // Set an option to allow downstream checks to know that this has been whitelist cleared
                if (cdn.hasWhitelist()) {
                    if (!options.whitelistAllowed) {
                        options.whitelistAllowed = {};
                    }
                    options.whitelistAllowed[cdn.id] = true;

                }
            } else if (global.DEBUG) {
                logger.debug('  Rejecting ' + cdn);
            }
        } else {
            logger.debug('  Provider is inactive - rejecting');
        }
    });

    candidates = this.loadBalancer.balance(candidates, distrib, options);


    return {
        distribution: distrib,
        cdns: candidates
    };
};


module.exports = CDNSelector;