/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    http = require('http'),
    HttpServer = require('../../libs/servers/HttpServer'),
    EventEmitter = require('events').EventEmitter;



describe('HttpServer', function () {
    describe('#start()', function () {

        it('should route the request to 1st choice CDN', function (done) {

            var mockCdn1 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        request.connection.remoteAddress.should.equal('127.0.0.1');
                        request.url.should.equal('/some/path');
                        inboundToken.id.should.equal('token1');
                        should.exist(callback);
                        callback(null, 'requestUrl', 'http://cdn1/some/path', 'location');
                    }
                },
                mockCdn2 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        should.fail('The second choice CDN should not have been used');
                    }
                },
                mockCdnSelector = {
                    selectNetworks: function (ip, hostname) {
                        ip.should.equal('127.0.0.1');
                        hostname.should.equal('localhost');
                        return {
                                cdns: [mockCdn1, mockCdn2]
                        };
                    },
                    getAllCDNs: function() {
                        return [mockCdn1, mockCdn2];
                    }
                },
                mockRequestLogger = {
                    log: function () {
                        arguments.length.should.equal(11);
                    }
                },
                mockTokenValidator = {
                    extractInboundToken: function (cdnList, request) {
                        cdnList.length.should.equal(2);
                        (request == null).should.be.false;
                        return { id: 'token1', isPresent: true, isValid: true };
                    }
                },
                httpServer = new HttpServer(0, mockCdnSelector, mockRequestLogger, mockTokenValidator);


            httpServer.on('ready', function (port) {
                http.get('http://localhost:' + port + '/some/path', function (response) {
                    response.statusCode.should.equal(302);
                    response.headers.location.should.equal('http://cdn1/some/path');

                    var data = '';
                    response.on('data', function (chunk) {
                        data += chunk;
                    });

                    response.on('end', function () {
                        data.should.be.empty;
                        done();
                    });
                });
            });

            httpServer.start();
        });

        it('should fallback to 2nd choice CDN if the first didn\'t route the request', function (done) {

            var mockCdn1 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        request.socket.remoteAddress.should.equal('127.0.0.1');
                        request.url.should.equal('/some/path');
                        inboundToken.id.should.equal('token1');
                        callback(null, 'requestUrl', null, null);
                    }
                },
                mockCdn2 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        request.socket.remoteAddress.should.equal('127.0.0.1');
                        request.url.should.equal('/some/path');
                        inboundToken.id.should.equal('token1');
                        callback(null, 'requestUrl', 'http://cdn2/some/path', 'location');
                    }
                },
                mockCdnSelector = {
                    selectNetworks: function (ip, hostname) {
                        ip.should.equal('127.0.0.1');
                        hostname.should.equal('localhost');
                        return {
                            cdns: [mockCdn1, mockCdn2]
                        };
                    },
                    getAllCDNs: function() {
                        return [mockCdn1, mockCdn2];
                    }
                },
                mockRequestLogger = {
                    log: function () {
                        arguments.length.should.equal(11);
                    }
                },
                mockTokenValidator = {
                    extractInboundToken: function (cdnList, request) {
                        cdnList.length.should.equal(2);
                        (request == null).should.be.false;
                        return { id: 'token1', isPresent: true, isValid: true };
                    }
                },
                httpServer = new HttpServer(0, mockCdnSelector, mockRequestLogger, mockTokenValidator);


            httpServer.on('ready', function (port) {
                http.get('http://localhost:' + port + '/some/path', function (response) {
                    response.statusCode.should.equal(302);
                    response.headers.location.should.equal('http://cdn2/some/path');

                    var data = '';
                    response.on('data', function (chunk) {
                        data += chunk;
                    });

                    response.on('end', function () {
                        data.should.be.empty;
                        done();
                    });

                });
            });

            httpServer.start();
        });

        it('should fail gracefully if neither CDNs routed the request', function (done) {
            var
                mockCdn1 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        callback(null, 'requestUrl', null, null);
                    }
                },
                mockCdn2 = {
                    selectSurrogate: function (request, inboundToken, callback) {
                        callback(null, 'requestUrl', null, null);
                    }
                },
                mockCdnSelector = {
                    selectNetworks: function (ip, hostname) {
                        ip.should.equal('127.0.0.1');
                        hostname.should.equal('localhost');
                        return {
                            cdns: [mockCdn1, mockCdn2]
                        };
                    },
                    getAllCDNs: function() {
                        return [mockCdn1, mockCdn2];
                    }
                },
                mockRequestLogger = {
                    log: function () {
                        arguments.length.should.equal(11);
                    }
                },
                mockTokenValidator = {
                    extractInboundToken: function (cdnList, request) {
                        cdnList.length.should.equal(2);
                        (request == null).should.be.false;
                        return { id: 'token1', isPresent: true, isValid: true };
                    }
                },
                httpServer = new HttpServer(0, mockCdnSelector, mockRequestLogger, mockTokenValidator);


            httpServer.on('ready', function (port) {
                http.get('http://localhost:' + port + '/some/path', function (response) {
                    response.statusCode.should.equal(503);
                    response.headers.should.not.have.keys('location');

                    var data = '';
                    response.on('data', function (chunk) {
                        data += chunk;
                    });

                    response.on('end', function () {
                        data.should.equal("Service Unavailable");
                        done();
                    });

                });
            });

            httpServer.start();
        });

        it('should should correctly signal authentication failures', function (done) {
            var
                mockCdn1 = {
                    selectSurrogate: function (request, callback) {
                        callback(null, 'requestUrl', null, null);
                    }
                },
                mockCdn2 = {
                    selectSurrogate: function (request, callback) {
                        callback(null, 'requestUrl', null, null);
                    }
                },
                mockCdnSelector = {
                    selectNetworks: function (ip, hostname) {
                        ip.should.equal('127.0.0.1');
                        hostname.should.equal('localhost');
                        return {
                            cdns: [mockCdn1, mockCdn2]
                        }
                    },
                    getAllCDNs: function() {
                        return [mockCdn1, mockCdn2];
                    }
                },
                mockRequestLogger = {
                    log: function () {
                        arguments.length.should.equal(11);
                    }
                },
                mockTokenValidator = {
                    extractInboundToken: function (cdnList, request) {
                        cdnList.length.should.equal(2);
                        (request == null).should.be.false;
                        return { id: 'token1', isPresent: true, isValid: false };
                    }
                },
                httpServer = new HttpServer(0, mockCdnSelector, mockRequestLogger, mockTokenValidator);


            httpServer.on('ready', function (port) {
                http.get('http://localhost:' + port + '/some/path', function (response) {
                    response.statusCode.should.equal(401);
                    response.headers.should.not.have.keys('location');

                    var data = '';
                    response.on('data', function (chunk) {
                        data += chunk;
                    });

                    response.on('end', function () {
                        data.should.equal("Unauthorized");
                        done();
                    });

                });
            });

            httpServer.start();
        });

        it('should handle no CDNs being returned from the CDN selector', function (done) {
            var mockCdnSelector = {
                    selectNetworks: function (ip, hostname) {
                        ip.should.equal('127.0.0.1');
                        hostname.should.equal('localhost');
                        return {
                            cdns: []
                        };
                    }
                },
                mockRequestLogger = {
                    log: function () {
                        arguments.length.should.equal(11);
                    }
                },
                httpServer = new HttpServer(0, mockCdnSelector, mockRequestLogger);


            httpServer.on('ready', function (port) {
                http.get('http://localhost:' + port + '/some/path', function (response) {
                    response.statusCode.should.equal(503);
                    response.headers.should.not.have.keys('location');

                    var data = '';
                    response.on('data', function (chunk) {
                        data += chunk;
                    });

                    response.on('end', function () {
                        data.should.equal("Service Unavailable");
                        done();
                    });

                });
            });

            httpServer.start();
        });
    });
});