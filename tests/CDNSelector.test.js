/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    CDNSelector = require('../libs/CDNSelector'),
    loadBalancer = {
        balance: function (cdns, distrib, options) {
            return cdns;
        }
    };

describe('CDNSelector', function () {
    describe('#selectNetworks', function () {
        it('should provide a list of CDNs in the configured priority order', function() {
            var distribs = {
                    getByHostname: function () {
                        return {
                            providers: [
                                {
                                    id: 'velocix',
                                    active: true
                                },
                                {
                                    id: 'akamai',
                                    active: true,
                                    hostname: 'id1234.akamai.com'
                                },
                                {
                                    id: 'amazon',
                                    active: true,
                                    hostname: 'id12345.cloudfront.net'
                                }
                            ]
                        }
                    }
                },
                cdns = {
                    getAll: function (id) {
                        return {
                            velocix: {
                                driver: 'cdns:cdn:driver:velocix',
                                active: true
                            },
                            akamai: {
                                driver: 'cdns:cdn:driver:generic',
                                active: true
                            },
                            amazon: {
                                driver: 'cdns:cdn:driver:amazon',
                                active: true
                            }
                        };
                    },
                    on: function () {}
                },
                cdnSelector = new CDNSelector(distribs, cdns, loadBalancer);

            var selection = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
            selection.cdns.length.should.equal(3);
            selection.cdns[0].id.should.equal('velocix');
            selection.cdns[1].id.should.equal('akamai');
            selection.cdns[2].id.should.equal('amazon');

        });

        it('should filter CDNs by their IP whitelist', function() {
            var eventHandlers = {},
                distribs = {
                    getByHostname: function () {
                        return {
                            providers: [
                                {
                                    id: 'velocix',
                                    active: true
                                },
                                {
                                    id: 'akamai',
                                    active: true,
                                    hostname: 'id1234.akamai.com'
                                },
                                {
                                    id: 'amazon',
                                    active: true,
                                    hostname: 'id12345.cloudfront.net'
                                },
                                {
                                    id: 'rackspace',
                                    active: true,
                                    hostname: 'id12345.racks.net'
                                }
                            ]
                        }
                    }
                },
                cdns = {
                    getAll: function (id) {
                        return {
                            velocix: {
                                driver: 'cdns:cdn:driver:velocix',
                                active: true,
                                clientIpWhitelist: {
                                    manual: [
                                        { network: '2.1.1.0', prefix: 24 }
                                    ]
                                }
                            },
                            akamai: {
                                driver: 'cdns:cdn:driver:generic',
                                active: true,
                                clientIpWhitelist: {
                                    manual: []  // An empty whitelist should mean no restrictions
                                }
                            },
                            amazon: { // An absent whitelist should mean no restrictions
                                driver: 'cdns:cdn:driver:amazon',
                                active: true
                            },
                            rackspace: {
                                driver: 'cdns:cdn:driver:generic',
                                active: true,
                                clientIpWhitelist: {
                                    alto: [ // Client IP is within this whitelist
                                        { network: '1.2.0.0', prefix: 16 },
                                        { network: '1.7.0.0', prefix: 24 }
                                    ],
                                    manual: [
                                    ]
                                }
                            }
                        };
                    },
                    on: function (event, handler) {
                        eventHandlers[event] = handler;
                    }
                },
                cdnSelector = new CDNSelector(distribs, cdns, loadBalancer);
                should.exist(eventHandlers.error);
                should.exist(eventHandlers.updated);

                var selection = cdnSelector.selectNetworks("1.2.0.1", "www.example.com");
                selection.cdns.length.should.equal(3);
                selection.cdns[0].id.should.equal('akamai');
                selection.cdns[1].id.should.equal('amazon');
                selection.cdns[2].id.should.equal('rackspace');


                // Now throw in an update and retest
                eventHandlers.updated('rackspace', {
                    driver: 'cdns:cdn:driver:generic',
                    active: true,
                    clientIpWhitelist: {
                        alto: [ // Client IP is within this whitelist
                            { network: '1.3.0.0', prefix: 16 },
                            { network: '1.7.0.0', prefix: 24 }
                        ],
                        manual: [
                        ]
                    }
                });

                selection = cdnSelector.selectNetworks("1.2.0.1", "www.example.com");
                selection.cdns.length.should.equal(2);
                selection.cdns[0].id.should.equal('akamai');
                selection.cdns[1].id.should.equal('amazon');

        });

        it('should filter CDNs that are configured as inactive', function() {
            var distribs = {
                    getByHostname: function () {
                        return {
                            providers: [
                                {
                                    id: 'velocix',
                                    active: true
                                },
                                {
                                    id: 'akamai',
                                    active: false,
                                    hostname: 'id1234.akamai.com'
                                },
                                {
                                    id: 'amazon',
                                    active: true,
                                    hostname: 'id12345.cloudfront.net'
                                }
                            ]
                        }
                    }
                },
                cdns = {
                    getAll: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                driver: 'cdns:cdn:driver:velocix',
                                active: true
                            },
                            akamai: {
                                id: 'akamai',
                                driver: 'cdns:cdn:driver:generic',
                                active: false
                            },
                            amazon: {
                                id: 'amazon',
                                driver: 'cdns:cdn:driver:amazon',
                                active: true
                            }
                        };
                    },
                    on: function () {}
                },
                cdnSelector = new CDNSelector(distribs, cdns, loadBalancer);

                var selection = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                selection.cdns.length.should.equal(2);
                selection.cdns[0].id.should.equal('velocix');
                selection.cdns[1].id.should.equal('amazon');
        });

        it('should return an empty list if the hostname is not configured', function() {
            var distribs = {
                    getByHostname: function () {
                        return null;
                    }
                },
                cdns = {
                    getAll: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                driver: 'cdns:cdn:driver:velocix'
                            },
                            akamai: {
                                id: 'akamai',
                                driver: 'cdns:cdn:driver:generic'
                            },
                            amazon: {
                                id: 'amazon',
                                driver: 'cdns:cdn:driver:amazon'
                            }
                        };
                    },
                    on: function () {}
                },
                cdnSelector = new CDNSelector(distribs, cdns, loadBalancer);

                var selection = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                selection.cdns.length.should.equal(0);
        });
    });
});