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
 * Returns the configuration for how this hostname interacts with
 * this CDN (the provider config).
 * @param {object or string} clientRequest - the request object from node, or a string containing the hostname
 * @returns {object} the provider object, or null if not found
 */
proto.getProvider = function(clientRequest) {

    var self = this,
        reqHost = clientRequest,
        distrib,
        provider = null;


    if (typeof clientRequest != 'string') {
        reqHost = clientRequest.headers.host.split(":")[0]
    }
    distrib = this.distribs.getByHostname(reqHost);

    if (distrib && distrib.providers) {
        for (var i = 0; i < distrib.providers.length; i+=1) {
            if (distrib.providers[i].id == this.id) {
                provider = distrib.providers[i];
                break;
            }
        }
    }
    return provider;
};

/**
 * Selects the most appropriate target URL for this CDN.
 * @param {object} clientRequest - The request object from node.
 * @param {function} callback - A callback, with paramaters error, requestUrl, targetUrl, location, authOk
 */
 //TODO rename this to something more appropriate
proto.selectSurrogate = function(clientRequest, inboundToken, callback) {
    var self = this,
        reqHost = clientRequest.headers.host.split(":")[0],
        reqUrl = 'http://' + reqHost + clientRequest.url,
        provider = this.getProvider(reqUrl),
        queryString;


    if (!provider) {
        logger.info('Hostname ' + reqHost + ' does not have a distribution configured for this CDN');
        callback(null, reqUrl, null, null, true);
    } else {
        // Strip off the inbound token from the URL if present
        var targetUrl = url.parse(reqUrl, true);


        // If there is a inbound token on the querystring remove it
        var tokenIsFromSameCdn = false;
        if (inboundToken) {
            tokenIsFromSameCdn = inboundToken.cdn.id === this.id;
            var tokenIsInUrl = inboundToken.authParam && targetUrl.query && targetUrl.query[inboundToken.authParam];

            // If the inbound token is for this CDN, then its find to let it pass through rather than re-write it
            // Otherwise it should be removed
            if (!tokenIsFromSameCdn && tokenIsInUrl) {
                // Remove the inbound token from the target URL
                delete targetUrl.query[inboundToken.authParam];
                delete targetUrl.search;
            }
        }

        // Re-write the URL for this CDN
        logger.debug('BaseCDN targetUrl before rewrite:', targetUrl);
        try {
            this.rewriteUrl(targetUrl, inboundToken, provider);
        } catch (e) {
            logger.warn('URL rewrite failed for this provider: ' + e);
            callback(null, reqUrl, null, null, true);
            return;
        }
        logger.debug('BaseCDN targetUrl after rewrite:', targetUrl);


        if (tokenIsFromSameCdn) {
            // The inbound token has already been validated, but is from a different
            // CDN. We need to inject an equivalent token for the target CDN.
            logger.debug("Inbound request contained a valid token for a different CDN");
            targetUrl = self.generateTokenizedUrl(targetUrl,
                            inboundToken,
                            provider,
                            clientRequest);
        } else {
            logger.debug("Inbound request did not contain a token");
        }
        callback(null, reqUrl, url.format(targetUrl), null, true);
    }
};


proto.rewriteUrl = function (targetUrl, inboundTokenParams, provider) {
    // May be overriden by specific implementation for path rewrites, etc.
    // By default just inject the target CDN's hostname
    if (!provider.hostname) {
        throw new Error('No hostname is set on this provider');
    }
    targetUrl.host = provider.hostname;
    return targetUrl;
};

proto.generateTokenizedUrl = function (targetUrl, inboundToken, provider, clientRequest) {
    // To be overriden by specific implementation.
    logger.warn("generateTokenizedUrl not implemented for CDN " + this.id);
    return targetUrl;
};

proto.isActive = function () {
    return this.config.active ? true : false;
};

proto.hasWhitelist = function () {
    return this.clientIpWhitelist ? true : false;
};

proto.isClientIpAllowed = function (ipAddress) {
    if (!this.clientIpWhitelist) {
        // There is no restriction in the config, so allow by default
        return true;
    }
    return this.clientIpWhitelist.find(ipAddress) ? true : false;
};

proto.extractInboundToken = function(request) {
    // To be overridden by a specific implementation
    logger.warn("extractInboundToken not implemented for CDN " + this.id);
    return null;
};

proto.toString = function () {
    return this.id || 'Unknown CDN';
};

module.exports = BaseCDN;