/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    url = require('url'),
    Akamai = require('../../libs/cdn/AkamaiCDN'),
    testUtil = require('../TestUtil'),
    distribs = {
        getByHostname: function (hostname) {

            return {
                'testhost.com': {
                    providers: [
                        {
                            id: 'velocix',
                            active: true
                        },
                        {
                            id: 'akamai',
                            active: true,
                            hostname: 'emt-vh.akamaihd.net',
                            tokens: {
                               "authParam": "hdnts",
                               "authSecrets": [
                                   "aa11bb22",
                                   "bbbbbbbb"
                               ],
                               "hashFn": "sha256"
                            }
                        }
                    ]
                },
                'testhostWithSalt.com': {
                    providers: [
                        {
                            id: 'velocix',
                            active: true
                        },
                        {
                            id: 'akamai',
                            active: true,
                            hostname: 'emt-vh.akamaihd.net',
                            tokens: {
                               "authParam": "hdnts",
                               "authSecrets": [
                                   "aa11bb22",
                                   "bbbbbbbb"
                               ],
                               "hashSalt": "aabbcc",
                               "hashFn": "sha1"
                            }
                        }
                    ]
                }
            }[hostname];
        }
    },
    akamai = new Akamai('akamai', {}, distribs),

    provider = {
        id: 'akamai',
        active: true,
        hostname: 'emt-vh.akamaihd.net',
        tokens: {
           "authParam": "hdnts",
           "authSecrets": [
               "aa11bb22",
               "bbbbbbbb"
           ],
           "hashSalt": "aabbcc",
           "hashFn": "sha256"
        }
    };


describe('AkamaiCDN', function () {
    describe('#generateTokenizedUrl', function () {

        it('should generate a URL with a token that expires at a specific time', function () {

            var targetUrl = url.parse('http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?blah=999', true),
                inboundTokenParams = {
                    isPresent: true,
                    acl: '/*',
                    endTime: 1370627409,
                    'x:counter': 99123
                },
                tokenizedUrl = akamai.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            tokenizedUrl.query['blah'].should.equal('999');
            tokenizedUrl.query['hdnts'].should.equal('exp=1370627409~acl=/*~hmac=a3bb2ade8c41bbc6eae545d85b570a07fbfe8298f0a303899bfdaa0d9005f248');

        });

        it('should generate a URL with a token that is bound to a specific IP address', function () {
            var targetUrl = url.parse('http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?blah=999', true),
                inboundTokenParams = {
                    isPresent: true,
                    acl: '/*',
                    endTime: 1370627409,
                    'x:counter': 99123,
                    ipAddress: "1.2.3.4"
                },
                tokenizedUrl = akamai.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            tokenizedUrl.query['blah'].should.equal('999');
            tokenizedUrl.query['hdnts'].should.equal('ip=1.2.3.4~exp=1370627409~acl=/*~hmac=3d13f299070ea517d58f9e8e25812ae6a3f13efade334504c725a2c1ab502abb');

        });

        it('should generate a token that allows access to a specific set of urls with wildcards', function () {
            var targetUrl = url.parse('http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?blah=999', true),
                inboundTokenParams = {
                    isPresent: true,
                    acl: "/i/test-content/BigBuckBunny_640x360.m4v/*",
                    endTime: "1370627409",
                    "x:counter": "99123",
                    ipAddress: "115.164.93.0/24"
                },
                tokenizedUrl = akamai.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            tokenizedUrl.query['blah'].should.equal('999');
            tokenizedUrl.query['hdnts'].should.equal('ip=115.164.93.0/24~exp=1370627409~acl=/i/test-content/BigBuckBunny_640x360.m4v/*~hmac=835fc5936e182d7d1d0bc9b3799c3b2bca6a3b83d899fb83bd093ffa538d25f4');
        });

        it('should set a default ACL and expiry if none is provided', function () {
            var targetUrl = url.parse('http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8', true),
                inboundTokenParams = {
                    isPresent: true
                },
                tokenizedUrl = akamai.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            (tokenizedUrl == null).should.be.false;
            (tokenizedUrl.query['hdnts'] == null).should.be.false;

            var tokenParams = testUtil.extractAkamaiTokenParameters(tokenizedUrl.query['hdnts']);
            var now = Math.round(Date.now()/1000) + 86400;
            parseInt(tokenParams.exp).should.be.within(now - 1, now + 1);
            tokenParams.acl.should.equal('/i/test-content/BigBuckBunny_640x360.m4v/*');

        });

        it('should not tokenize the URL if there was no input token', function () {
            var targetUrl = url.parse('http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8', true),
                inboundTokenParams = {},
                tokenizedUrl;

            akamai.generateTokenizedUrl(targetUrl, {}, provider).should.equal(targetUrl);
            akamai.generateTokenizedUrl(targetUrl, { isPresent: false }, provider).should.equal(targetUrl);
            akamai.generateTokenizedUrl(targetUrl, null, provider).should.equal(targetUrl);
        });
    });

    describe('#extractInboundToken', function () {
        it('should be able to detect a valid token and extract its parameters', function () {
            // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --ip=115.164.93.0/24
            // --acl=/i/test-content/BigBuckBunny_640x360.m4v/*
            var token = 'ip=115.164.93.0/24'
                      + '~exp=1370627409'
                      + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                      + '~hmac=3712f9a3e027f09e714b26fedb002972b494c17e63f219e44b2f900b754c318d';

            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token + '&somekey=somevalue',
                headers: {
                    host: 'testhost.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            token.ipAddress.should.equal('115.164.93.0/24');
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1370627409);
            token.acl.should.equal('/i/test-content/BigBuckBunny_640x360.m4v/*')
            token.payload.should.eql({});
            token.authParams.should.eql(['hdnts']);
        });

        it('should handle salted tokens (and configurable hash algo)', function () {
            // python akamai_token_v2.py --algo=sha1 --end_time=1370627409 --key=aa11bb22
            // --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --salt=aabbcc
            var token = 'exp=1370627409'
                      + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                      + '~hmac=913143602e5c14955e1bd33f5d90baf5236f6f7f';

            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token + '&somekey=somevalue',
                headers: {
                    host: 'testhostWithSalt.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            (token.ipAddress == null).should.be.true;
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1370627409);
            token.acl.should.equal('/i/test-content/BigBuckBunny_640x360.m4v/*')
            token.payload.should.eql({});
            token.authParams.should.eql(['hdnts']);
        });


        it('should be able to detect tokens with invalid signaturess', function () {
            // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22
            // --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
            var token = 'exp=1370627409'
                      + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                      + '~data=someOpaqueData'
                      + '~hmac=3712f9a3e027f09e714b26fedb002972b494c17e63f219e44b2f900b754c318d';
            // hmac signature is wrong

            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token + '&somekey=somevalue',
                headers: {
                    host: 'testhost.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            token.isPresent.should.be.true;
            token.isValid.should.be.false;
            token.authParams.should.eql(['hdnts']);
        });

        it('should handle tokens with a payload', function () {
            var token = 'exp=1370627409'
                      + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                      + '~data=someOpaqueData'
                      + '~hmac=315a78f22b4dbd50126dba5941e131e9ba2f32951b7e0f8d215618ca565afd2f';

            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token + '&somekey=somevalue',
                headers: {
                    host: 'testhost.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            (token.ipAddress == null).should.be.true;
            token.isPresent.should.be.true;
            token.isValid.should.be.true;
            token.endTime.should.equal(1370627409);
            token.acl.should.equal('/i/test-content/BigBuckBunny_640x360.m4v/*')
            token.payload.should.eql({
                data: 'someOpaqueData'
            });
            token.authParams.should.eql(['hdnts']);
        });

        it('should be able handle garbled tokens', function () {
            var token = 'exp===jjja'
                      + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                      + '~data=someOpaqueData'
                      + '~hmac=3712f9a3e027fXXX14b26fedb002972b494c17e63f219e44b2f900b754c318d';

            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token,
                headers: {
                    host: 'testhost.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            token.isPresent.should.be.true;
            token.isValid.should.be.false;
            token.authParams.should.eql(['hdnts']);
        });

        it('should be able to detect a request without a token', function () {
            var request = {
                url: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8',
                headers: {
                    host: 'testhost.com'
                }
            };
            var token = akamai.extractInboundToken(request);
            (token === null).should.be.false;
            token.isPresent.should.be.false;
        });
    });
});