/*jslint node: true */
"use strict";

function CDNSelector(distribs, cdns, operatorNetworks) {
    this.distribs = distribs;
    this.cdns = cdns;
    this.operatorNetworks = operatorNetworks;
}

var proto = CDNSelector.prototype;

proto.selectNetworks = function (clientIp, hostname) {
    var self = this,
        clientIsOnNet = false,
        candidates = [];


    // Determine whether the client is On-net
    var clientIsOnNet = this.operatorNetworks.addressIsOnNet(clientIp);;

    // Lookup the configuration for this hostname
    var distrib = self.distribs.getByHostname(hostname);
    if (!distrib || !distrib.providers) {
        return [];
    }

    // Loop through the possible CDNs (aka, providers) for this hostname
    distrib.providers.forEach(function (provider) {

        // Is this provider active?
        if (provider.active) {
            // Lookup the CDN
            var cdn = self.cdns.getById(provider.id);

            // Does our network location allow us to use this provider?
            if (cdn && cdn.isActive()) {
                if (clientIsOnNet || cdn.allowsOffNetClients()) {
                    candidates.push(cdn);
                }
            }
        }
    });

    return candidates;
};


module.exports = CDNSelector;