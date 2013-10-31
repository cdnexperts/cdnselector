/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    http = require('http'),
    testUtil = require('./TestUtil').withLogLevel('warn'),
    NetworkMap = require('../libs/NetworkMap'),
    // ALTO Test data
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
    },
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


describe('NetworkMap', function () {
    it('should know whether addresses are on-net or off-net', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/directory',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.not.exist(err);

                networkMap.addressIsOnNet('192.168.0.1').should.equal(false);
                networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                server.close();
                done();
            });
        });
    });

    it('should handle refreshes against a non-changing network map', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/directory',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.not.exist(err);

                networkMap.addressIsOnNet('192.168.0.1').should.equal(false);
                networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                networkMap.refresh(function (err) {
                    should.not.exist(err);
                    networkMap.addressIsOnNet('192.168.0.1').should.equal(false);
                    networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                    networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                    networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                    server.close();
                    done();
                });
            });
        });
    });

    it('should handle refreshes against a changing network map', function (done) {

        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/directory',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.not.exist(err);

                networkMap.addressIsOnNet('192.168.0.1').should.equal(false);
                networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                // Now change the network map - lets add 192.168.0.0/16 and update the tag
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
                                "ipv4": ["198.51.100.128/25"],
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
                }

                // Refresh
                networkMap.refresh(function (err) {
                    should.not.exist(err);
                    networkMap.addressIsOnNet('192.168.0.1').should.equal(true);
                    networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                    networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                    networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                    server.close();
                    done();
                });
            });
        });
    });

    it('should work if the ALTO url is pointing directly to a network-map', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/networkmap',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.not.exist(err);

                networkMap.addressIsOnNet('10.0.1.2').should.equal(false);
                networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);
                done();
            });
        });
    });

    it('should handle errors returned by the ALTO server', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/notfound',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.exist(err);
                done();
            });
        });
    });

    it('should handle lack of connectivity with the ALTO server', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {
            server.close(function () {
                var altoServiceUrl = 'http://localhost:' + port + '/directory',
                    networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

                networkMap.startMonitoring(function (err) {
                    should.exist(err);
                    done();
                });
            });
        });
    });

    it('should continue to operate with existing data in the event of ALTO server error', function (done) {
        testUtil.runTestAgainstLocalServer(mockAltoServer, function (port, server) {

            var altoServiceUrl = 'http://localhost:' + port + '/directory',
                networkMap = new NetworkMap(altoServiceUrl, 60, ['PID3']);

            networkMap.startMonitoring(function (err) {
                should.not.exist(err);

                networkMap.addressIsOnNet('10.0.0.2').should.equal(false);
                networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);

                server.close(function () {
                    networkMap.refresh(function (err) {
                        should.exist(err);

                        networkMap.addressIsOnNet('10.0.0.2').should.equal(false);
                        networkMap.addressIsOnNet('198.51.100.129').should.equal(true);
                        networkMap.addressIsOnNet('2001:db8:beef:2::1').should.equal(true);
                        networkMap.addressIsOnNet('2001:db8:beef:3::1').should.equal(false);
                        done();
                    });
                });
            });
        });
    });
});