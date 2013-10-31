/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('../TestUtil'),
    VelocixCDN = require('../../libs/cdn/VelocixCDN'),

    conf = {
        lookupService: {
            host: 'localhost',
            port: 28888,
            path: '/sscsv2'
        }
    },
    mockRequest = {
        headers: {
            host: 'testhost.com'
        },
        socket: {
            remoteAddress: '1.2.3.4'
        },
        url: '/path/to/some/content.m3u8'
    },
    mockVelocixResponse = {
        "dns" : [
            {
                "dns.a" : [ "192.168.210.133" ]
            },
            {
                "dns.a" : [ "192.168.210.134" ]
            }
        ],
        "http" : [
            {
                "http.host" : [ "http://da-c0a8d284.id.zzz83s2.pub/wp/www.example.com" ],
                "http.ip" : [ "http://192.168.210.132/wp/www.example.com" ]
            }
        ],
        "scope" : [ "192.0.2.1" ],
        "selectioncriteria" : {
            "c-ip" : "192.0.2.1",
            "cs-resource" : "http://routing.zzz83s2.pub:8003/sscsv2?cs-uri=http%3A%2F%2Fwww.example.com&c-ip=192.0.2.1&numcaches=2",
            "s-vx-rate" : "0",
            "x-location" : [
                "n.fvx.na.ca.zzz83d1",
                "g.ca"
            ]
        }
    },
    distribs = {
        getByHostname: function (hostname) {

            return {
                'testhost.com': {
                    authParam: 'myVerySecretWord',
                    providers: [
                        {
                            id: 'velocix',
                            active: true
                        },
                        {
                            id: 'akamai',
                            active: true,
                            hostname: '66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com'
                        },
                        {
                            id: 'amazon',
                            active: true,
                            hostname: 'id12345.cloudfront.net'
                        }
                    ]
                },
                'www.test2.com': {
                    providers: [
                        {
                            id: 'velocix',
                            active: true
                        },
                        {
                            id: 'amazon',
                            active: false,
                            hostname: 'id9999.cloudfront.net'
                        }
                    ]
                }
            }[hostname];
        }
    };;



describe('VelocixCDN', function () {


    describe('#selectSurrogate()', function () {
        it('should report error event when connection is refused', function (done) {
            var velocix = new VelocixCDN('velocix', conf, distribs);

            velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                error.code.should.equal('ECONNREFUSED');
                requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8');
                should.not.exist(targetUrl);
                should.not.exist(location);
                done();
            });
        });



        it('should send a redirection event containing the URL returned from Velocix', function (done) {

            var velocixBehaviour = function (request, response) {
                // Check that the client sent the expected request
                request.url.should.equal('/sscsv2?cs-uri=http%3A%2F%2Ftesthost.com%2Fpath%2Fto%2Fsome%2Fcontent.m3u8&c-ip=1.2.3.4&numcaches=1');

                // Send a dummy response
                response.end(JSON.stringify(mockVelocixResponse));
            };

            testUtil.runTestAgainstLocalServer(velocixBehaviour, function (port, server) {

                conf.lookupService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);


                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8');
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0]);
                    location.should.equal('n.fvx.na.ca.zzz83d1,g.ca');
                    server.close();
                    done();
                });
            });

        });

        it('should report error when Velocix return a non-200 HTTP response', function (done) {
            var velocixBehaviour = function (request, response) {

                // Send an error response
                response.writeHead(500);
                response.end('Not Found');
            };

            testUtil.runTestAgainstLocalServer(velocixBehaviour, function (port, server) {

                conf.lookupService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);


                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    error.toString().should.equal('Error: 500 HTTP status code in response from Velocix');
                    requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8');
                    should.not.exist(targetUrl);
                    should.not.exist(location);
                    server.close();
                    done();

                });
            });

        });

        it('should copy cookie based tokens to the querystring (querystring empty)', function (done) {

            var velocixBehaviour = function (request, response) {
                // Send a dummy response
                response.end(JSON.stringify(mockVelocixResponse));
            };

            testUtil.runTestAgainstLocalServer(velocixBehaviour, function (port, server) {

                conf.lookupService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0] + '?myVerySecretWord=1234567890ABCDEF%3D');
                    server.close();
                    done();
                });
            });

        });

        it('should copy cookie based tokens to the querystring (querystring already present)', function (done) {
            var velocixBehaviour = function (request, response) {
                // Send a dummy response
                mockVelocixResponse.http[0]['http.ip'][0] = 'http://192.168.210.132/wp/www.example.com/path/to/some/content.m3u8?param1=val1&param2=val2';
                response.end(JSON.stringify(mockVelocixResponse));
            };

            testUtil.runTestAgainstLocalServer(velocixBehaviour, function (port, server) {

                conf.lookupService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                mockRequest.url = '/path/to/some/content.m3u8?param1=val1&param2=val2';
                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

                console.log(mockRequest);
                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8?param1=val1&param2=val2');
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0] + '&myVerySecretWord=1234567890ABCDEF%3D');
                    server.close();
                    done();
                });
            });
        });

        it('should not attempt to pass through tokens if the authParam is not configured', function (done) {
            var velocixBehaviour = function (request, response) {
                // Send a dummy response
                mockVelocixResponse.http[0]['http.ip'][0] = 'http://192.168.210.132/wp/www.example.com/path/to/some/content.m3u8?param1=val1&param2=val2';
                response.end(JSON.stringify(mockVelocixResponse));
            };

            testUtil.runTestAgainstLocalServer(velocixBehaviour, function (port, server) {

                conf.lookupService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                // This hostname is configured without a authParam
                mockRequest.headers.host = 'www.test2.com';
                mockRequest.url = '/path/to/some/content.m3u8?param1=val1&param2=val2';
                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

                console.log(mockRequest);
                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    requestUrl.should.equal('http://www.test2.com/path/to/some/content.m3u8?param1=val1&param2=val2');
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0]);
                    server.close();
                    done();
                });
            });
        });
    });
});


