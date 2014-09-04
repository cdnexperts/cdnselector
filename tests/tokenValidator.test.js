/*jslint node: true*/
/*global describe, it */
"use strict";

var should = require('should'),
    tokenValidator = require('../libs/tokenValidator');


describe('tokenValidator', function () {
    describe('#extractInboundToken()', function () {


        it('should return the token from the first CDN that can parse one', function () {
            var cdnList = [
                {
                    id: 'cdn1',
                    extractInboundToken: function(request) {
                        return { isPresent: false };
                    }
                },
                {
                    id: 'cdn2',
                    extractInboundToken: function(request) {
                        return { id: 'token2', isPresent: true };
                    }
                },
                {
                    id: 'cdn3',
                    extractInboundToken: function(request) {
                        return null;
                    }
                }
            ];
            var request = {};
            var token = tokenValidator.extractInboundToken(cdnList, request);

            token.isPresent.should.be.true;
            token.id.should.equal('token2');
            token.cdn.id.should.equal('cdn2');
        });

        it('should handle no CDNs being able to find a token', function () {
            var cdnList = [
                {
                    id: 'cdn1',
                    extractInboundToken: function(request) {
                        return { isPresent: false };
                    }
                },
                {
                    id: 'cdn2',
                    extractInboundToken: function(request) {
                        return { isPresent: false };
                    }
                },
                {
                    id: 'cdn3',
                    extractInboundToken: function(request) {
                        return null;
                    }
                }
            ];
            var request = {};
            var token = tokenValidator.extractInboundToken(cdnList, request);

            token.isPresent.should.be.false;
            (token.id == null).should.be.true;
            (token.cdn == null).should.be.true;
        });
    });
});
