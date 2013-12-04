/*jslint node: true */
"use strict";

var logger = require('winston');

function LoadBalancer(period) {
    var self = this;

    function reset() {
        if (global.DEBUG && self.requestsByDistrib) {
            logger.debug('Load balancer stats: ' + JSON.stringify(self.requestsByDistrib));
        }
        self.requestsByDistrib = {};
    }

    reset();

    // Reset the state every minute. why?
    // The load balancer will attempt to re-balance requests across CDNs
    // for up to 1 minute. However, in the event of a long outage we must
    // reach the point where we stop attempting to rebalance because it would
    // result in all requests going to the newly-restored CDN for an extended period.
    setInterval(reset, period || 60000);
}

var proto = LoadBalancer.prototype;


proto.notifyCdnUsage = function (cdn, distrib) {
    // Increment the total count for this distribution
    if (this.requestsByDistrib[distrib._id]) {
        this.requestsByDistrib[distrib._id].total += 1;
    } else {
        this.requestsByDistrib[distrib._id] = {
            total: 1,
            requestByProvider: {}
        };
    }

    // Increment the count for this provider
    if (distrib.providers) {
        for (var i = 0; i < distrib.providers.length; i += 1) {
            var provider = distrib.providers[i];
            if (provider.id === cdn.id) {
                if (global.DEBUG) {
                    logger.debug('Loadbalancer notified usage of ' + cdn.id);
                }

                // Increment the counter, or set it to 1 if its not initialised yet
                this.requestsByDistrib[distrib._id].requestByProvider[provider.id] =
                    ++this.requestsByDistrib[distrib._id].requestByProvider[provider.id]
                    || 1;
                return;
            }
        }
    }
};

proto.balance = function (cdns, distrib, options) {
    var totalCount = this.requestsByDistrib[distrib._id] ? this.requestsByDistrib[distrib._id].total : 0,
        sortOrder = {},
        loadBalancedCdns,
        sortFunction = function (a, b) {
            if (!sortOrder[a.id] && !sortOrder[b.id]) {
                return 0;
            }
            if (!sortOrder[a.id]) {
                return 1;
            }
            if (!sortOrder[b.id]) {
                return -1;
            }
            if (sortOrder[a.id] === sortOrder[b.id]) {
                return 0;
            }
            return sortOrder[a.id] < sortOrder[b.id] ? 1 : -1;
        };


    // Examine each provider and compare the percentage of requests that were actually directed to
    // this provider (percentActual) with the configured percentTarget.
    // Priority is given to the providers that are furthest behind target
    if (distrib && distrib.providers && distrib.selectionMode === 'loadbalance') {
        distrib.providers.forEach(function (provider) {
            if (provider.loadBalancer) {
                var providerCount = this.requestsByDistrib[distrib._id] ? this.requestsByDistrib[distrib._id].requestByProvider[provider.id] : 0;
                var percentActual = (providerCount / totalCount) * 100 || 0;
                var percentTarget = provider.loadBalancer.targetLoadPercent;
                sortOrder[provider.id] = percentTarget - percentActual;

                if (options
                    && options.whitelistAllowed
                    && options.whitelistAllowed[provider.id]
                    && provider.loadBalancer.alwaysUseForWhitelistedClients) {

                    sortOrder[provider.id] += 200;
                }

                if (global.DEBUG) {
                    logger.debug('Load Balancer: ' + provider.id
                        + ' target: ' + percentTarget
                        + '%, actual: ' + percentActual
                        + '%, score: ' + sortOrder[provider.id]);
                }
            }
        }, this);

        if (global.DEBUG) {
            logger.debug('---');
        }

        // Re-order the list according to the calculated sortOrders
        loadBalancedCdns = cdns.sort(sortFunction);
    }
    return loadBalancedCdns || cdns;
};

module.exports = LoadBalancer;