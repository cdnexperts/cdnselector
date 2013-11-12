/*jslint node: true */
"use strict";

var url = require('url'),
    logger = require('winston'),
    tokenValidator = require('../tokenValidator'),
    iptrie = require('iptrie');

function BaseCDN(id, config, distribs) {

    this.distribs = distribs;
    this.id = id;
    this.config = config;
    this.clientIpWhitelist = null;


    // Load the whitelists into an IPtrie
    var whitelistEntryCount = 0;
    if (config && config.clientIpWhitelist) {
        this.clientIpWhitelist = new iptrie.IPTrie();

        for (var source in config.clientIpWhitelist) {
            var whitelist = config.clientIpWhitelist[source];
            for (var i = 0; i < whitelist.length; i++) {
                try {
                    var network = whitelist[i];
                    this.clientIpWhitelist.add(network.network, network.prefix, source);
                    whitelistEntryCount += 1;
                } catch (e) {
                    logger.error('Error in the ' + source + ' clientIpWhitelist for ' + id + ' : ' + e);
                }
            };
        };
    }

    // Only set the clientIpWhitelist property if there are entries in the whitelist
    if (whitelistEntryCount === 0) {
        this.clientIpWhitelist = null;
    }
}
var proto = BaseCDN.prototype;

/**
 * Selects the most appropriate target URL for this CDN.
 * @param {object} clientRequest - The request object from node.
 * @param {function} callback - A callback, with paramaters error, requestUrl, targetUrl, location, authOk
 */
 //TODO rename this to something more appropriate
proto.selectSurrogate = function (clientRequest, callback) {
    var self = this,
        reqHost = clientRequest.headers.host.split(":")[0],
        reqUrl = 'http://' + reqHost + clientRequest.url,
        distrib = this.distribs.getByHostname(reqHost),
        provider,
        queryString,
        inboundToken,
        inboundTokenParams;

    if (distrib && distrib.providers) {
        distrib.providers.forEach(function (prov) {
            if (prov.id === self.id) {
                provider = prov;
            }
        });
    }

    if (!provider) {
        logger.info('Hostname ' + reqHost + ' does not have a distribution configured for this provider');
        callback(null, reqUrl, null, null, true);
    } else {
        // Strip off the inbound token from the URL if present
        var targetUrl = url.parse(reqUrl, true);

        // Check if there was a token on the inbound request
        inboundToken = tokenValidator.extractInboundToken(clientRequest, distrib.authParam);

        // If there is a inbound token on the querystring remove it
        if (distrib.authParam && targetUrl.query && targetUrl.query[distrib.authParam]) {
            // Remove the inbound token from the target URL
            delete targetUrl.query[distrib.authParam];
            delete targetUrl.search;
        }

        // Re-write the URL for this CDN
        this.rewriteUrl(targetUrl, inboundToken, provider);

        if (inboundToken) {
            // Validate the token
            if (tokenValidator.tokenIsValid(inboundToken, distrib.authSecrets)) {
                // Validation OK, generate a token for our target CDN
                inboundTokenParams = tokenValidator.getTokenParameters(inboundToken);
                targetUrl = self.generateTokenizedUrl(targetUrl,
                                inboundTokenParams,
                                provider);
            } else {
                // Validation Failed
                callback(null, reqUrl, null, null, false);
                return;
            }
        }

        callback(null, reqUrl, url.format(targetUrl), null, true);
    }
};


proto.rewriteUrl = function (targetUrl, inboundTokenParams, provider) {
    // May be overriden by specific implementation for path rewrites, etc.
    // By default just inject the target CDN's hostname
    targetUrl.host = provider.hostname;
    return targetUrl;
};

proto.generateTokenizedUrl = function (targetUrl, inboundTokenParams, provider) {
    // To be overriden by specific implementation.
    return targetUrl;
};

proto.isActive = function () {
    return this.config.active ? true : false;
};

proto.isClientIpAllowed = function (ipAddress) {
    if (!this.clientIpWhitelist) {
        // There is no restriction in the config, so allow by default
        return true;
    }
    return this.clientIpWhitelist.find(ipAddress) ? true : false;
};

proto.toString = function () {
    return this.id || 'Unknown CDN';
};

module.exports = BaseCDN;