/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('./TestUtil').withLogLevel('info'),
    LoadBalancer = require('../libs/LoadBalancer'),
    loadBalancer,
    cdns,
    distrib;

describe('LoadBalancer', function () {
    beforeEach(function () {
        // Default test data.
        // Some tests might modify this, but it will be reset before the next test.
        loadBalancer = new LoadBalancer();

        cdns = [
            { id: 'cdn1' },
            { id: 'cdn2' },
            { id: 'cdn3' },
            { id: 'cdn4' }
        ];

        distrib = {
            _id: 'one',
            selectionMode: 'loadbalance',
            providers: [
                {
                    id: 'cdn1',
                    active: true,
                    loadBalancer: {
                        targetLoadPercent: 75,
                        alwaysUseForWhitelistedClients: false
                    }
                },
                {
                    id: 'cdn2',
                    active: true,
                    loadBalancer: {
                        targetLoadPercent: 10,
                        alwaysUseForWhitelistedClients: false
                    }
                },
                {
                    id: 'cdn3',
                    active: true,
                    loadBalancer: {
                        targetLoadPercent: 15,
                        alwaysUseForWhitelistedClients: false
                    }
                }
            ]
        };

    });

    it('should return a list of CDNs in order of target load percentages if there is no previous usage logged', function() {
        var cdnChoices = loadBalancer.balance(cdns, distrib);
        cdnChoices.should.eql([
            { id: 'cdn1' },
            { id: 'cdn3' },
            { id: 'cdn2' },
            { id: 'cdn4' }
        ]);
    });


    it('should load balance according to the target load percentages when the 1st choice is used', function() {
        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {};

        // Send 1000 requests
        for (var i = 0; i < 1000; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id] = ++requestsForCdn[chosenCdn.id] || 1;

            // Notify the load balancer that the 1st choice was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        // Check that the distribution of 1st choice CDNs aligns with the target percentages
        requestsForCdn.should.eql({
            cdn1: 750,
            cdn2: 100,
            cdn3: 150
        });
    });

    it('should load balance according to the target load percentages when one of the CDNs is out of service', function() {
        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {};

        // Send 1000 requests
        for (var i = 0; i < 1000; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var cdnCandidates = loadBalancer.balance(cdns, distrib);

            // Record the choice so we can check the counter later.
            requestsForCdn[cdnCandidates[0].id] = ++requestsForCdn[cdnCandidates[0].id] || 1;

            // Simulate that cdn1 is out of service - any requests will be handed to the next choice CDN
            if (cdnCandidates[0].id === 'cdn2') {
                // Use the second choice - simulating that the first choice was not selected for some other reason
                loadBalancer.notifyCdnUsage(cdnCandidates[1], distrib);
            } else {
                // Use the first choice
                loadBalancer.notifyCdnUsage(cdnCandidates[0], distrib);
            }
        }

        // The load balancer should skew requests towards the sick CDN in order to rebalance the load.
        // Remember the load balancer doesn't know/care that the CDN is down - thats the responsibility
        // of a downstream component.
        requestsForCdn['cdn2'].should.be.within(950, 1000);
    });

    it('should obay the alwaysUseForWhitelistedClients flag (single request)', function() {

        // this should push cdn3 up to to priority for whitelisted clients
        distrib.providers[2].loadBalancer.alwaysUseForWhitelistedClients = true;
        var options = {
            whitelistAllowed: {
                'cdn3': true
            }
        };

        // First try with a whitelisted client
        var cdnChoices = loadBalancer.balance(cdns, distrib, options);
        cdnChoices.should.eql([
            { id: 'cdn3' },
            { id: 'cdn1' },
            { id: 'cdn2' },
            { id: 'cdn4' }
        ]);

        // Next try with non-whitelisted client
        options.whitelistAllowed['cdn3'] = false;
        var cdnChoices = loadBalancer.balance(cdns, distrib, options);
        cdnChoices.should.eql([
            { id: 'cdn1' },
            { id: 'cdn3' },
            { id: 'cdn2' },
            { id: 'cdn4' }
        ]);
    });

    it('should obay the alwaysUseForWhitelistedClients flag (multi requests)', function() {

        distrib.providers.push({
            id: 'cdn4',
            active: true,
            loadBalancer: {
                targetLoadPercent: 0,
                alwaysUseForWhitelistedClients: true
            }
        });

        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {};

        // Send 1000 requests
        for (var i = 0; i < 1000; i ++) {
            // Make it so that 50% of our requests are marked as whitelisted
            var options = {
                whitelistAllowed: {
                    'cdn4': i % 2 > 0 ? true : false
                }
            };

            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib, options)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id] = ++requestsForCdn[chosenCdn.id] || 1;

            // Notify the load balancer that cdn3 was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        // Check that the distribution of 1st choice CDNs aligns with the target percentages
        requestsForCdn['cdn4'].should.equal(500);
    });

    it('should cope with percentages that do not total 100', function() {
        // This is important so we can cope with cases when a CDN is removed
        distrib.providers[0].loadBalancer.targetLoadPercent = 10;
        distrib.providers[1].loadBalancer.targetLoadPercent = 10;
        distrib.providers[2].loadBalancer.targetLoadPercent = 10;

        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {};

        // Send 1000 requests
        for (var i = 0; i < 300; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id] = ++requestsForCdn[chosenCdn.id] || 1;

            // Notify the load balancer that the 1st choice was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        // Check that the distribution of 1st choice CDNs aligns with the target percentages
        requestsForCdn.should.eql({
            cdn1: 100,
            cdn2: 100,
            cdn3: 100
        });
    });

    it('should cope with percentages that exceed 100%', function() {
        // We shouldn't support this, but lets make sure it doesn't break at least
        distrib.providers[0].loadBalancer.targetLoadPercent = 100;
        distrib.providers[1].loadBalancer.targetLoadPercent = 200;
        distrib.providers[2].loadBalancer.targetLoadPercent = 20;

        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {};

        // Send 1000 requests
        for (var i = 0; i < 10000; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id] = ++requestsForCdn[chosenCdn.id] || 1;

            // Notify the load balancer that the 1st choice was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        // Check that the distribution of 1st choice CDNs aligns with the target percentages
        requestsForCdn.should.eql({
            cdn2: 10000
        });
    });


    it('should rebalance the percentages if a cdn is removed', function() {
        // Keep counts of how many times each CDN is selected as top choice
        var requestsForCdn = {
            'cdn1': 0,
            'cdn2': 0,
            'cdn3': 0
        };
        var totalRequests = 0;

        //
        // Send an initial 100 requests: all CDNs operating normally
        //
        for (var i = 0; i < 100; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id]++;
            totalRequests++;

            // Notify the load balancer that the 1st choice was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        //Check that the distribution of 1st choice CDNs aligns with the target percentages
        Math.round((requestsForCdn['cdn1'] / totalRequests) * 100).should.equal(75);
        Math.round((requestsForCdn['cdn2'] / totalRequests) * 100).should.equal(10);
        Math.round((requestsForCdn['cdn3'] / totalRequests) * 100).should.equal(15);


        //
        // Now send a further 100 requests, but report that none were sent to cdn1
        //
        for (var i = 0; i < 100; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var cdnCandidates = loadBalancer.balance(cdns, distrib);

            // Record the choice so we can check the counter later
            requestsForCdn[cdnCandidates[0].id]++;
            totalRequests++;

            // Notify the load balancer that the 1st choice was used
            if (cdnCandidates[0].id === 'cdn1') {
                loadBalancer.notifyCdnUsage(cdnCandidates[1], distrib);
            } else {
                loadBalancer.notifyCdnUsage(cdnCandidates[0], distrib);
            }
        }

        // Traffic should skew in favour of cdn1 because it hasn't been receiving traffic
        Math.round((requestsForCdn['cdn1'] / totalRequests) * 100).should.be.within(80, 90);
        Math.round((requestsForCdn['cdn2'] / totalRequests) * 100).should.be.within(5, 10);
        Math.round((requestsForCdn['cdn3'] / totalRequests) * 100).should.be.within(5, 10);


        //
        // Now send a further 10000 requests with cdn1 back in service
        //
        for (var i = 0; i < 10000; i ++) {
            // Ask the load balancer for a list of choices (in priority order) and store the top choice
            var chosenCdn = loadBalancer.balance(cdns, distrib)[0];

            // Record the choice so we can check the counter later.
            requestsForCdn[chosenCdn.id]++;
            totalRequests++;

            // Notify the load balancer that the 1st choice was used
            loadBalancer.notifyCdnUsage(chosenCdn, distrib);
        }

        // Traffic should re-balance to our target load percentages
        //(approximatley - no need to make this too stringent)
        Math.round((requestsForCdn['cdn1'] / totalRequests) * 100).should.be.within(74, 76);
        Math.round((requestsForCdn['cdn2'] / totalRequests) * 100).should.be.within(9, 11);
        Math.round((requestsForCdn['cdn3'] / totalRequests) * 100).should.be.within(14, 16);

    });
});