/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    BaseCDN = require('../../libs/cdn/BaseCDN');

describe('BaseCDN', function () {
    describe('#getProvider', function () {
        var config = {};
        var distribDao = {
            getByHostname: function(hostname) {
                return {
                    "www.testhost.com": {
                        providers: [
                            { id: 'bogusCDN' },
                            { id: 'testCDN' },
                            { id: 'anotherCDN' }
                        ]
                    },
                    "anotherhost.com" : {}
                }[hostname];
            }
        };

        it('should return the correct provider for a given request object', function () {
            var request = {
                headers: {
                    host: 'www.testhost.com'
                }
            };
            var cdn = new BaseCDN('testCDN', config, distribDao);
            var provider = cdn.getProvider(request);
            provider.should.eql({ id: "testCDN" })
        });

        it('should return the correct provider for a given hostname', function () {
            var cdn = new BaseCDN('testCDN', config, distribDao);
            var provider = cdn.getProvider("www.testhost.com");
            provider.should.eql({ id: "testCDN" })
        });

        it('should return null for a hostname that is not configured', function () {
            var cdn = new BaseCDN('testCDN', config, distribDao);
            var provider = cdn.getProvider("www.missinghost.com");
            (provider === null).should.be.true
        });
    });

});
