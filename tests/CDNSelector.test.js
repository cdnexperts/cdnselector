/*jslint node: true*/
/*global describe, it */
"use strict";
require('should');

var CDNSelector = require('../libs/CDNSelector');

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
                    getById: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                allowsOffNetClients: function () {
                                    return false;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            akamai: {
                                id: 'akamai',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            amazon: {
                                id: 'amazon',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            }
                        }[id];
                    }
                },
                networkMap = {
                    addressIsOnNet: function() {
                        return true;
                    }
                },
                cdnSelector = new CDNSelector(distribs, cdns, networkMap);

                var cdns = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                cdns.length.should.equal(3);
                cdns[0].id.should.equal('velocix');
                cdns[1].id.should.equal('akamai');
                cdns[2].id.should.equal('amazon');
        });

        it('should filter CDNs that do not allow off-net clients if the client is off-net', function() {
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
                    getById: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                allowsOffNetClients: function () {
                                    return false;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            akamai: {
                                id: 'akamai',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            amazon: {
                                id: 'amazon',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            }
                        }[id];
                    }
                },
                networkMap = {
                    addressIsOnNet: function() {
                        return false;
                    }
                },
                cdnSelector = new CDNSelector(distribs, cdns, networkMap);

                var cdns = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                cdns.length.should.equal(2);
                cdns[0].id.should.equal('akamai');
                cdns[1].id.should.equal('amazon');
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
                    getById: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                allowsOffNetClients: function () {
                                    return false;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            akamai: {
                                id: 'akamai',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            amazon: {
                                id: 'amazon',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            }
                        }[id];
                    }
                },
                networkMap = {
                    addressIsOnNet: function() {
                        return true;
                    }
                },
                cdnSelector = new CDNSelector(distribs, cdns, networkMap);

                var cdns = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                cdns.length.should.equal(2);
                cdns[0].id.should.equal('velocix');
                cdns[1].id.should.equal('amazon');
        });

        it('should return an empty list if the hostname is not configured', function() {
            var distribs = {
                    getByHostname: function () {
                        return null;
                    }
                },
                cdns = {
                    getById: function(id) {
                        return {
                            velocix: {
                                id: 'velocix',
                                allowsOffNetClients: function () {
                                    return false;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            akamai: {
                                id: 'akamai',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            },
                            amazon: {
                                id: 'amazon',
                                allowsOffNetClients: function () {
                                    return true;
                                },
                                isActive: function () {
                                    return true;
                                }
                            }
                        }[id];
                    }
                },
                networkMap = {
                    addressIsOnNet: function() {
                        return true;
                    }
                },
                cdnSelector = new CDNSelector(distribs, cdns, networkMap);

                var cdns = cdnSelector.selectNetworks("1.2.3.4", "www.example.com");
                cdns.length.should.equal(0);
        });
    });
});