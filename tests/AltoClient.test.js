
/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    http = require('http'),
    testUtil = require('./TestUtil').withLogLevel('warn'),
    AltoClient = require('../libs/AltoClient'),
    altoDirectory,
    altoNetworkMap,
    // Mock web server to act as ALTO
    mockAltoServer = function (request, response) {
        if (request.url === '/directory') {
            response.writeHead(200, {
                'Content-type': 'application/alto-directory+json'
            });
            response.end(JSON.stringify(altoDirectory));
        } else if (request.url === '/networkmap') {
            response.writeHead(200, {
                'Content-type': 'application/alto-networkmap+json'
            });
            response.end(JSON.stringify(altoNetworkMap));
        } else {
            response.writeHead(404, {
                'Content-type': 'text/plain'
            });
            response.end('Not Found');
        }
    };


describe('AltoClient', function () {
    beforeEach(function () {
        // Reset the test data for the mock ALTO server
        altoDirectory = {
            "meta": {
                "cost-types": {
                    "num-routing": {
                        "cost-mode": "numerical",
                        "cost-metric": "routingcost",
                        "description": "My default"
                    },
                    "num-hop": {
                        "cost-mode": "numerical",
                        "cost-metric": "hopcount"
                    },
                    "ord-routing": {
                        "cost-mode": "ordinal",
                        "cost-metric": "routingcost"
                    },
                    "ord-hop": {
                        "cost-mode": "ordinal",
                        "cost-metric": "hopcount"
                    }
                }
            },
            "resources": [{
                "id": "default-network-map",
                "uri": "/networkmap",
                "media-type": "application/alto-networkmap+json"
            }, {
                "id": "numerical-routing-cost-map",
                "uri": "http://www.ecreationmedia.tv/demo/cdns/alto/costmap/num/routingcost",
                "media-type": "application/alto-costmap+json",
                "capabilities": {
                    "cost-type-names": ["num-routing"]
                },
                "uses": ["default-network-map"]
            }, {
                "id": "numerical-hopcount-cost-map",
                "uri": "http://www.ecreationmedia.tv/demo/cdns/alto/costmap/num/hopcount",
                "media-type": "application/alto-costmap+json",
                "capabilities": {
                    "cost-type-names": ["num-hop"]
                },
                "uses": ["default-network-map"]
            }, {
                "id": "custom-maps-resources",
                "uri": "http://www.ecreationmedia.tv/demo/cdns/alto/maps",
                "media-type": "application/alto-directory+json",
            }, {
                "id": "endpoint-property",
                "uri": "http://www.ecreationmedia.tv/demo/cdns/alto/endpointprop/lookup",
                "media-type": "application/alto-endpointprop+json",
                "accepts": "application/alto-endpointpropparams+json",
                "capabilities": {
                    "prop-types": ["pid"]
                },
                "uses": ["default-network-map"]
            }, {
                "id": "endpoint-cost",
                "uri": "http:///endpointcost/lookup",
                "media-type": "application/alto-endpointcost+json",
                "accepts": "application/alto-endpointcostparams+json",
                "capabilities": {
                    "cost-constraints": true,
                    "cost-type-names": ["num-routing", "num-hop", "ord-routing", "ord-hop"]
                }
            }]
        },
        altoNetworkMap = {
            "meta": {},
            "data": {
                "map-vtag": {
                    "resource-id": "default-network-map",
                    "tag": "1266506139"
                },
                "map": {
                    "PID1": {
                        "ipv4": ["192.0.2.0/24", "198.51.100.0/25"]
                    },
                    "PID2": {
                        "ipv4": ["198.51.100.128/25"],
                        "ipv6": ["2001:db8:beef:2::/64"]
                    },
                    "PID3": {
                        "ipv4": ["0.0.0.0/0"],
                        "ipv6": ["::/0"]
                    }
                }
            }
        }
    });

    it('should provide a list of network addresses from the network map, excluding certain PIDs (using setConfig)', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoClient = new AltoClient(),
                altoConfig = {
                    altoServiceUrl: 'http://localhost:' + port + '/directory',
                    refreshInterval: 60,
                    ignorePids: ['PID3'],
                    networkMapId: 'default-network-map'
                };

            altoClient.setConfig(altoConfig);

            altoClient.on('networkMapChanged', function (ipList) {
                ipList.should.includeEql({ network: '192.0.2.0', prefix: 24});
                ipList.should.includeEql({ network: '2001:db8:beef:2::', prefix: 64 });
                ipList.should.includeEql({ network: '198.51.100.0', prefix: 25 });
                ipList.should.includeEql({ network: '198.51.100.128', prefix: 25 });
                ipList.should.not.includeEql({ network: '0.0.0.0', prefix: 0 });
                ipList.should.not.includeEql({ network: '::', prefix: 0 });
                server.close();
                done();
            });

            altoClient.on('error', function (err) {
                should.not.exist(err);
                server.close();
                done();
            });
        });
    });

    it('should provide a list of network addresses from the network map, excluding certain PIDs (using constructor)', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoClient = new AltoClient({
                    altoServiceUrl: 'http://localhost:' + port + '/directory',
                    refreshInterval: 60,
                    ignorePids: ['PID3'],
                    networkMapId: 'default-network-map'
                });

            altoClient.on('networkMapChanged', function (ipList) {
                ipList.should.includeEql({ network: '192.0.2.0', prefix: 24});
                ipList.should.includeEql({ network: '2001:db8:beef:2::', prefix: 64 });
                ipList.should.includeEql({ network: '198.51.100.0', prefix: 25 });
                ipList.should.includeEql({ network: '198.51.100.128', prefix: 25 });
                ipList.should.not.includeEql({ network: '0.0.0.0', prefix: 0 });
                ipList.should.not.includeEql({ network: '::', prefix: 0 });
                server.close();
                done();
            });

            altoClient.on('error', function (err) {
                should.not.exist(err);
                server.close();
                done();
            });

        });
    });

    it('should handle refreshes of the network map', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var networkMapChangedCounter = 0,
                altoClient = new AltoClient({
                    altoServiceUrl: 'http://localhost:' + port + '/directory',
                    refreshInterval: 60,
                    ignorePids: ['PID3'],
                    networkMapId: 'default-network-map'
                });

            altoClient.on('networkMapChanged', function (ipList) {
                networkMapChangedCounter += 1;

                // We only expect this event to be called twice
                networkMapChangedCounter.should.be.within(1,2);

                if (networkMapChangedCounter === 1) {
                    // The network map should be the default one
                    ipList.should.includeEql({ network: '192.0.2.0', prefix: 24});
                    ipList.should.includeEql({ network: '2001:db8:beef:2::', prefix: 64 });
                    ipList.should.includeEql({ network: '198.51.100.0', prefix: 25 });
                    ipList.should.includeEql({ network: '198.51.100.128', prefix: 25 });
                    ipList.should.not.includeEql({ network: '0.0.0.0', prefix: 0 });
                    ipList.should.not.includeEql({ network: '::', prefix: 0 });

                    // Now change the network map and trigger a refresh.
                    // We should end up back in this event handler with a different ipList.
                    // added 192.168.0.0/16, removed 198.51.100.128/25 and updated the tag
                    altoNetworkMap = {
                        "meta": {},
                        "data": {
                            "map-vtag": {
                                "resource-id": "default-network-map",
                                "tag": "1266506140"
                            },
                            "map": {
                                "PID1": {
                                    "ipv4": ["192.0.2.0/24", "198.51.100.0/25"]
                                },
                                "PID2": {
                                    "ipv6": ["2001:db8:beef:2::/64"]
                                },
                                "PID3": {
                                    "ipv4": ["0.0.0.0/0"],
                                    "ipv6": ["::/0"]
                                },
                                "PID4": {
                                    "ipv4": ["192.168.0.0/16"]
                                }
                            }
                        }
                    };
                    altoClient.refresh();

                } else if (networkMapChangedCounter === 2) {
                    // The network map should have changed.
                    ipList.should.not.includeEql({ network: '198.51.100.128', prefix: 25 });
                    ipList.should.includeEql({ network: '192.168.0.0', prefix: 16});

                    ipList.should.includeEql({ network: '192.0.2.0', prefix: 24});
                    ipList.should.includeEql({ network: '2001:db8:beef:2::', prefix: 64 });
                    ipList.should.includeEql({ network: '198.51.100.0', prefix: 25 });
                    ipList.should.not.includeEql({ network: '0.0.0.0', prefix: 0 });
                    ipList.should.not.includeEql({ network: '::', prefix: 0 });

                    server.close();
                    done();
                }
            });

            altoClient.on('error', function (err) {
                should.not.exist(err);
                server.close();
                done();
            });

        });
    });


    it('should work if the ALTO url is pointing directly to a network-map', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoClient = new AltoClient(),
                altoConfig = {
                    altoServiceUrl: 'http://localhost:' + port + '/networkmap',
                    refreshInterval: 60,
                    ignorePids: ['PID3'],
                    networkMapId: 'default-network-map'
                };

            altoClient.setConfig(altoConfig);

            altoClient.on('networkMapChanged', function (ipList) {
                ipList.should.includeEql({ network: '192.0.2.0', prefix: 24});
                ipList.should.includeEql({ network: '2001:db8:beef:2::', prefix: 64 });
                ipList.should.includeEql({ network: '198.51.100.0', prefix: 25 });
                ipList.should.includeEql({ network: '198.51.100.128', prefix: 25 });
                ipList.should.not.includeEql({ network: '0.0.0.0', prefix: 0 });
                ipList.should.not.includeEql({ network: '::', prefix: 0 });
                server.close();
                done();
            });

            altoClient.on('error', function (err) {
                should.not.exist(err);
                server.close();
                done();
            });
        });
    });

    it('should handle errors returned by the ALTO server', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoClient = new AltoClient(),
                altoConfig = {
                    altoServiceUrl: 'http://localhost:' + port + '/notfound',
                    refreshInterval: 60,
                    ignorePids: ['PID3'],
                    networkMapId: 'default-network-map'
                };

            altoClient.setConfig(altoConfig);

            altoClient.on('networkMapChanged', function (ipList) {
                should.fail('networkMapChanged event should not be called');
                server.close();
                done();
            });

            altoClient.on('error', function (err) {
                should.exist(err);
                server.close();
                done();
            });
        });

    });

    it('should handle lack of connectivity with the ALTO server', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {
            server.close(function () {
                var altoClient = new AltoClient(),
                    altoConfig = {
                        altoServiceUrl: 'http://localhost:' + port + '/directory',
                        refreshInterval: 60,
                        ignorePids: ['PID3'],
                        networkMapId: 'default-network-map'
                    };

                altoClient.setConfig(altoConfig);

                altoClient.on('networkMapChanged', function (ipList) {
                    should.fail('networkMapChanged event should not be called');
                    done();
                });

                altoClient.on('error', function (err) {
                    should.exist(err);
                    done();
                });
            });
        });
    });

});