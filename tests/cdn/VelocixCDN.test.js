/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    url = require('url'),
    testUtil = require('../TestUtil'),
    VelocixCDN = require('../../libs/cdn/VelocixCDN'),

    conf = {
        routingService: {
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
                    providers: [
                        {
                            id: 'velocix',
                            active: true,
                            tokens: {
                                authParam: "authToken",
                                authSecrets: [
                                    "secret1",
                                    "secret2"
                                ]
                            }
                        },
                        {
                            id: 'akamai',
                            active: true,
                            hostname: 'some-vh.akamaihd.net'
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
    };


// Test tokens generated using openssl. eg,
// echo -n "path=/*&fn=sha512&expiry=1293280496&x:counter=99123" | openssl dgst -sha512 -hmac "secret1"
// then base64 encoded using http://www.base64encode.org/
describe('VelocixCDN', function () {
    describe('#generateTokenizedUrl', function () {
        it('should generate a URL with a token that expires at a specific time', function () {
            var targetUrl = url.parse('http://somehost.com/content/video.m3u8');
            var inboundToken = {
                isPresent: true,
                endTime: 1478799175,
                acl: '/content/*',
                payload: {
                    someKey: 'someValue'
                }
            };
            var clientRequest = {
                socket: {
                    remoteAddress: '1.2.3.4'
                }
            };
            var provider = distribs.getByHostname("testhost.com").providers[0];
            var velocix = new VelocixCDN('velocix', conf, distribs);

            var tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, inboundToken, provider, clientRequest);

            (tokenizedUrl == null).should.be.false;
            (tokenizedUrl.query == null).should.be.false;
            (tokenizedUrl.query.authToken == null).should.be.false;

            var vxTokenParams = testUtil.validateAndExtractVelocixToken(tokenizedUrl.query.authToken, "secret1");
            (vxTokenParams == null).should.be.false;
            (vxTokenParams['c-ip'] == null).should.be.true;
            vxTokenParams.expiry.should.equal('1478799175');
            vxTokenParams.pathURI.should.equal('/content/*');
            vxTokenParams['x:clientIP'].should.equal('1.2.3.4');

        });

        it('should generate a token that is bound to a specific IP', function () {
            var targetUrl = url.parse('http://somehost.com/content/video.m3u8');
            var inboundToken = {
                isPresent: true,
                endTime: 1478799175,
                acl: '/content/*',
                payload: {
                    someKey: 'someValue'
                },
                ipAddress: "1.2.3.0/24"
            };
            var clientRequest = {
                socket: {
                    remoteAddress: '1.2.3.4'
                }
            };
            var provider = distribs.getByHostname("testhost.com").providers[0];
            var velocix = new VelocixCDN('velocix', conf, distribs);

            var tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, inboundToken, provider, clientRequest);

            (tokenizedUrl == null).should.be.false;
            (tokenizedUrl.query == null).should.be.false;
            (tokenizedUrl.query.authToken == null).should.be.false;

            var vxTokenParams = testUtil.validateAndExtractVelocixToken(tokenizedUrl.query.authToken, "secret1");
            (vxTokenParams == null).should.be.false;
            vxTokenParams.expiry.should.equal('1478799175');
            vxTokenParams.pathURI.should.equal('/content/*');
            vxTokenParams['c-ip'].should.equal('1.2.3.0/24');
            vxTokenParams['x:clientIP'].should.equal('1.2.3.4');

        });

        it('should set a default ACL and expiry if none is provided', function () {
            var targetUrl = url.parse('http://somehost.com/content/blah/video.m3u8');
            var inboundToken = {
                isPresent: true
            };
            var clientRequest = {
                socket: {
                    remoteAddress: '1.2.3.4'
                }
            };
            var provider = distribs.getByHostname("testhost.com").providers[0];
            var velocix = new VelocixCDN('velocix', conf, distribs);

            var tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, inboundToken, provider, clientRequest);

            (tokenizedUrl == null).should.be.false;
            (tokenizedUrl.query == null).should.be.false;
            (tokenizedUrl.query.authToken == null).should.be.false;

            var vxTokenParams = testUtil.validateAndExtractVelocixToken(tokenizedUrl.query.authToken, "secret1");
            (vxTokenParams == null).should.be.false;
            vxTokenParams.pathURI.should.equal('/content/blah/*');

            var now = Math.round(Date.now()/1000) + 86400;
            vxTokenParams.expiry.should.be.within(now - 1, now + 1);
        });

        it('should not tokenize the URL if there was no input token', function () {
            var targetUrl = url.parse('http://somehost.com/content/blah/video.m3u8');
            var clientRequest = {
                socket: {
                    remoteAddress: '1.2.3.4'
                }
            };
            var provider = distribs.getByHostname("testhost.com").providers[0];
            var velocix = new VelocixCDN('velocix', conf, distribs);

            // Empty inboundToken
            var tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, {}, provider, clientRequest);
            (tokenizedUrl == null).should.be.false;
            tokenizedUrl.should.equal(targetUrl);

            // Not Present inboundToken
            tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, { isPresent: false }, provider, clientRequest);
            (tokenizedUrl == null).should.be.false;
            tokenizedUrl.should.equal(targetUrl);

            // null inboundToken
            tokenizedUrl = velocix.generateTokenizedUrl(targetUrl, null, provider, clientRequest);
            (tokenizedUrl == null).should.be.false;
            tokenizedUrl.should.equal(targetUrl);
        });

    });


    describe('#extractInboundToken', function () {

        it('should be able to detect a valid token from the URL and extract its parameters', function () {
            // pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var token = 'cGF0aFVSST0vZGVtby8qJmZuPXNoYTUxMiZleHBpcnk9MTQ3ODc5OTE3NSZ4OmNvdW50ZXI9OTk'
                      + 'xMjMsOTAxNGZiMmZlZWFmOTA0YzQ2MzBlNGZmODE3M2I4ZGQ1ODcxMmY3YTBhNjVkYTc4N2IxMj'
                      + 'U5Yzc0Nzc5NzgzNDFkYjJmMGRiNmFjMjlkNmRkZjIyMjZhNTliOWUwMjBhOWMyNzQyODdmYWI1N'
                      + 'TY0OGFmNmJhOGMzNTRmYWE0Yzk=';

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + token + '&somekey=somevalue',
                headers: {
                    host: 'testhost.com:8090'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            (token.ipAddress === undefined).should.be.true;
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1478799175);
            token.acl.should.equal("/demo/*")
            token.payload.should.eql({ "x:counter": "99123" });
            token.authParam.should.eql("authToken");
        });

        it('should handle tokens restricted to a certain IP address', function () {
            // c-ip=1.2.3.4&pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var token = 'Yy1pcD0xLjIuMy40JnBhdGhVUkk9L2RlbW8vKiZmbj1zaGE1MTImZXhwaXJ5PTE0Nzg3OTkxNzUmeD'
                      + 'pjb3VudGVyPTk5MTIzLGQzMDFjNzNhZDBkMjgxNzAyZWM5OWFlYmY2M2EzMGFkNjMxYTU3NzE3NDBm'
                      + 'ZmE3MDk3OTM0YzNjMmZhNGZjNGM5NDAyYTU2OTBlN2JjMWZhYjNhMDg4N2VjNDc2YmZmZmQ5NmVjZW'
                      + 'FhM2I5ZjM3ZjU2NzRlZDc1NTk3NjdiNjE4';

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + token,
                headers: {
                    host: 'testhost.com:8090'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.ipAddress.should.equal("1.2.3.4");
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1478799175);
            token.acl.should.equal("/demo/*")
            token.payload.should.eql({ "x:counter": "99123" });
            token.authParam.should.eql("authToken");
        });

        it('should convert full URLs in the PathURI field to be relative path ACLs', function () {
            // pathURI=#http://somehost.com/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var token = 'cGF0aFVSST0jaHR0cDovL3NvbWVob3N0LmNvbS9kZW1vLyomZm49c2hhNTEyJmV4cGlyeT0xNDc4Nz'
                      + 'k5MTc1Jng6Y291bnRlcj05OTEyMywwMDljOWJiZGM1ODZlNGM5MTFkZjQzOWNmN2ZjOGJiYWM4NjFl'
                      + 'NGQwNDRmNDUzNzFlNjY3YWQzYjUzOGYyYTljZDkwM2U3YTY4ODIyNjE3MmQ4ZjVmZjQ2ZDIyNGE1OD'
                      + 'VhOGQ1YWU0ZWIxMWNkMzExMTY2MmFjYWQwMGI1ZTdkMg==';

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + token,
                headers: {
                    host: 'testhost.com'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.acl.should.equal("/demo/*")
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1478799175);
            token.payload.should.eql({ "x:counter": "99123" });
            token.authParam.should.eql("authToken");
        });

        it('should be able to detect a valid token from a Cookie and extract its parameters', function () {
            // pathURI=#http://somehost.com/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var token = 'cGF0aFVSST0jaHR0cDovL3NvbWVob3N0LmNvbS9kZW1vLyomZm49c2hhNTEyJmV4cGlyeT0xNDc4Nz'
                      + 'k5MTc1Jng6Y291bnRlcj05OTEyMywwMDljOWJiZGM1ODZlNGM5MTFkZjQzOWNmN2ZjOGJiYWM4NjFl'
                      + 'NGQwNDRmNDUzNzFlNjY3YWQzYjUzOGYyYTljZDkwM2U3YTY4ODIyNjE3MmQ4ZjVmZjQ2ZDIyNGE1OD'
                      + 'VhOGQ1YWU0ZWIxMWNkMzExMTY2MmFjYWQwMGI1ZTdkMg==';

            var request = {
                url: '/path/to/some/content.m3u8',
                headers: {
                    host: 'testhost.com',
                    cookie: 'vxtoken=' + token + '; someOther=baaaa'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.acl.should.equal("/demo/*")
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1478799175);
            token.payload.should.eql({ "x:counter": "99123" });
            token.authParam.should.eql("authToken");
        });

        it('should choose the URL token over a Cookie based token', function () {
            // pathURI=#http://somehost.com/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var urlToken = 'cGF0aFVSST0jaHR0cDovL3NvbWVob3N0LmNvbS9kZW1vLyomZm49c2hhNTEyJmV4cGlyeT0xNDc4Nz'
                         + 'k5MTc1Jng6Y291bnRlcj05OTEyMywwMDljOWJiZGM1ODZlNGM5MTFkZjQzOWNmN2ZjOGJiYWM4NjFl'
                         + 'NGQwNDRmNDUzNzFlNjY3YWQzYjUzOGYyYTljZDkwM2U3YTY4ODIyNjE3MmQ4ZjVmZjQ2ZDIyNGE1OD'
                         + 'VhOGQ1YWU0ZWIxMWNkMzExMTY2MmFjYWQwMGI1ZTdkMg==';

            // c-ip=1.2.3.4&pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret1
            var cookieToken = 'Yy1pcD0xLjIuMy40JnBhdGhVUkk9L2RlbW8vKiZmbj1zaGE1MTImZXhwaXJ5PTE0Nzg3OTkxNzUmeD'
                            + 'pjb3VudGVyPTk5MTIzLGQzMDFjNzNhZDBkMjgxNzAyZWM5OWFlYmY2M2EzMGFkNjMxYTU3NzE3NDBm'
                            + 'ZmE3MDk3OTM0YzNjMmZhNGZjNGM5NDAyYTU2OTBlN2JjMWZhYjNhMDg4N2VjNDc2YmZmZmQ5NmVjZW'
                            + 'FhM2I5ZjM3ZjU2NzRlZDc1NTk3NjdiNjE4';

            // So the cookieToken is IP restricted, but the URL token is not.

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + urlToken,
                headers: {
                    host: 'testhost.com',
                    cookie: 'vxtoken=' + cookieToken + '; someOther=baaaa'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            (token.ipAddress == null).should.be.true;
            token.acl.should.equal("/demo/*")
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1478799175);
            token.payload.should.eql({ "x:counter": "99123" });
            token.authParam.should.eql("authToken");
        });

        it('should be able to detect tokens with invalid signatures', function () {
            // pathURI=#http://somehost.com/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
            // key=secret999
            var token = 'cGF0aFVSST0jaHR0cDovL3NvbWVob3N0LmNvbS9kZW1vLyomZm49c2hhNTEyJmV4cGlyeT0'
                      + 'xNDc4Nzk5MTc1Jng6Y291bnRlcj05OTEyMywwMmJlN2Q4OTYxYzIxYmU5MWVkM2Y4YWNkMG'
                      + 'IzZDUyNWEyYzdiYmEyOGI0ZmVkNzMzMzlhYzBiMzE4NzIwMmQ2YTZhMDc2MjQ0Nzk3MWRjM'
                      + 'Tg2NjU4ZDhmYzYxZTM3ZjBiZmZhOTRhYTM4MDZhODU1YzRlMDgwMzljY2EzYWZhOQ==';

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + token,
                headers: {
                    host: 'testhost.com'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.isPresent.should.be.true;
            token.isValid.should.be.false;

            token.authParam.should.eql("authToken");
            (token.endTime == null).should.be.true;
            (token.payload == null).should.be.true;
            (token.acl == null).should.be.true;
        });

        it('should be able handle garbled tokens', function () {
            var token = 'weeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeesswdqw';

            var request = {
                url: '/path/to/some/content.m3u8?authToken=' + token,
                headers: {
                    host: 'testhost.com'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.isPresent.should.be.true;
            token.isValid.should.be.false;

            token.authParam.should.eql("authToken");
            (token.endTime == null).should.be.true;
            (token.payload == null).should.be.true;
            (token.acl == null).should.be.true;
        });

        it('should be able to detect a request without a token', function () {

            var request = {
                url: '/path/to/some/content.m3u8',
                headers: {
                    host: 'testhost.com'
                }
            };

            var velocix = new VelocixCDN('velocix', conf, distribs);
            var token = velocix.extractInboundToken(request);

            (token === null).should.be.false;
            token.isPresent.should.be.false;
        });
    });

    describe('#isClientIpAllowed()', function () {
        it('should allow any ip if the whitelist is absent', function () {
            var velocix = new VelocixCDN('velocix', conf, distribs);
            velocix.isClientIpAllowed('1.2.3.4').should.be.true;
        });

        it('should allow any ip if the whitelist is empty', function () {
            var confWithEmptyWhitelist = {
                routingService: conf.routingService,
                clientIpWhitelist: {
                    alto: [],
                    manual: []
                }
            }
            var velocix = new VelocixCDN('velocix', confWithEmptyWhitelist, distribs);
            velocix.isClientIpAllowed('1.2.3.4').should.be.true;
        });

        it('should only allow ips that are within the whitelist', function () {
            var confWithWhitelist = {
                routingService: conf.routingService,
                clientIpWhitelist: {
                    alto: [],
                    manual: [
                        { network: '1.0.0.0', prefix: 8 },
                        { network: '2001:db8:beef:2::', prefix: 64 }
                    ]
                }
            }
            var velocix = new VelocixCDN('velocix', confWithWhitelist, distribs);
            velocix.isClientIpAllowed('1.2.3.4').should.be.true;
            velocix.isClientIpAllowed('2.2.3.4').should.be.false;
            velocix.isClientIpAllowed('2001:db8:beef:2::1').should.be.true;
            velocix.isClientIpAllowed('2001:db8:beef:3::1').should.be.false;
        });
    }),


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

                conf.routingService.port = port;
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

                conf.routingService.port = port;
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

                conf.routingService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0] + '?authToken=1234567890ABCDEF%3D');
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

                conf.routingService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                mockRequest.url = '/path/to/some/content.m3u8?param1=val1&param2=val2';
                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

                velocix.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                    should.not.exist(error);
                    requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8?param1=val1&param2=val2');
                    targetUrl.should.equal(mockVelocixResponse.http[0]['http.ip'][0] + '&authToken=1234567890ABCDEF%3D');
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

                conf.routingService.port = port;
                var velocix = new VelocixCDN('velocix', conf, distribs);

                // This hostname is configured without a authParam
                mockRequest.headers.host = 'www.test2.com';
                mockRequest.url = '/path/to/some/content.m3u8?param1=val1&param2=val2';
                mockRequest.headers['cookie'] = 'vxtoken=1234567890ABCDEF%3D; someOtherCookie=barf';

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