/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    GenericOttCDN = require('../../libs/cdn/GenericOttCDN'),
    conf = {},
    distribs = {
        getByHostname: function (hostname) {

            return {
                'testhost.com': {
                    authParam: 'mySecretToken',
                    authSecrets: ['secret1', 'secret2'],
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
    };


describe('GenericOttCDN', function () {
    describe('#selectSurrogate()', function () {
        it('should route a request to a pre-configured mapping', function (done) {
            var mockRequest = {
                    headers: {
                        host: 'testhost.com'
                    },
                    socket: {
                        remoteAddress: '1.2.3.4'
                    },
                    url: '/path/to/some/content.m3u8'
                },
                genericCDN = new GenericOttCDN('akamai', conf, distribs);

            genericCDN.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                should.not.exist(error);
                should.exist(targetUrl);
                requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8');
                targetUrl.should.equal('http://66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com/path/to/some/content.m3u8');
                should.not.exist(location);
                done();
            });
        });

        it('should provide an empty target URL if there is no mapping for this hostname', function (done) {
            var genericCDN = new GenericOttCDN('akamai', conf, distribs),
                failingRequest = {
                    headers: {
                        host: 'nonexistant.com'
                    },
                    socket: {
                        remoteAddress: '1.2.3.4'
                    },
                    url: '/path/to/some/content.m3u8'
                };

            genericCDN.selectSurrogate(failingRequest, function (error, requestUrl, targetUrl, location) {
                should.not.exist(error);
                requestUrl.should.equal('http://nonexistant.com/path/to/some/content.m3u8');
                should.not.exist(targetUrl);
                should.not.exist(location);
                done();
            });
        });

        it('should remove the velocix token if present in the querystring', function (done) {
            var mockRequest = {
                    headers: {
                        host: 'testhost.com'
                    },
                    socket: {
                        remoteAddress: '1.2.3.4'
                    },
                    url: '/path/to/some/content.m3u8?mySecretToken='
                        + 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49bWQ'
                        + '1JmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMyxjN2FjZTA5YTVmOTU4NTM4NjFiYWM2Zm'
                        + 'M4MDFkZjI2MQ%3D%3D&someOtherGuff=uuuuu'
                },
                genericCDN = new GenericOttCDN('akamai', conf, distribs);

            genericCDN.selectSurrogate(mockRequest, function (error, requestUrl, targetUrl, location) {
                should.not.exist(error);
                should.exist(targetUrl);
                requestUrl.should.equal('http://testhost.com/path/to/some/content.m3u8?mySecretToken='
                    + 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49bWQ'
                    + '1JmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMyxjN2FjZTA5YTVmOTU4NTM4NjFiYWM2Zm'
                    + 'M4MDFkZjI2MQ%3D%3D&someOtherGuff=uuuuu');
                targetUrl.should.equal('http://66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com/path/to/some/content.m3u8?someOtherGuff=uuuuu');
                should.not.exist(location);
                done();
            });
        });
    });
});