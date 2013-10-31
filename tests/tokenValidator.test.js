/*jslint node: true*/
/*global describe, it */
"use strict";

var should = require('should'),
    tokenValidator = require('../libs/tokenValidator');

// Test tokens generated using openssl. eg,
// echo -n "protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=md5&expiry=1293280496&x:counter=99123" | openssl dgst -md5 -hmac "secret1"
// then base64 encoded using http://www.base64encode.org/
describe('tokenValidator', function () {
    describe('#extractInboundToken()', function () {
        it('should extract a URL based token', function () {
            var request = {
                    url: '/path/to/some/content.m3u8?authToken=123456&somekey=somevalue'
                };
            tokenValidator.extractInboundToken(request, 'authToken').should.equal('123456');
        });

        it('should extract a Cookie based token', function () {
            var request = {
                    headers: {
                        cookie: 'vxtoken=987654; someOther=baa'
                    },
                    url: '/path/to/some/content.m3u8'
                };
            tokenValidator.extractInboundToken(request, 'authToken').should.equal('987654');
        });

        it('should extract a URL token over a Cookie based token', function () {
            var request = {
                    headers: {
                        cookie: 'vxtoken=987654; someOther=baa'
                    },
                    url: '/path/to/some/content.m3u8?authToken=123456&somekey=somevalue'
                };
            tokenValidator.extractInboundToken(request, 'authToken').should.equal('123456');
        });
    });

    describe('#getTokenParameters()', function () {
        it('should extract parameters from a token', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha512&expiry=1293280496&x:counter=99123
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhNTEyJmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMywyZWRkNDkzZTJjMDc0YTA1YmE1OTJkNGJjOGYwZDY5YTRlNjVmN2UwMTE4ZTgxMDEzNzNjNGU3NDNlM2ZhYmMyOTExZGNiMjMzN2ZiODU4MGUyNTYwMjFjNDA5MjZmZWY2NWY0ODlkNjNlZTc3OTZkMTAzNTBkNTY2ZWJlYTFiNw==';
            tokenValidator.getTokenParameters(token).should.eql({
                "protohash": "BT:7f45a5861d1a30f5211831bca94938aaa9e5082e",
                "fn": "sha512",
                "expiry": "1293280496",
                "x:counter": "99123"
            });
        })
    });

    describe('#tokenIsValid()', function () {
        it('should authenticate a valid token from the URL querystring (using secret 1)', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha512&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhNTEyJmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMywyZWRkNDkzZTJjMDc0YTA1YmE1OTJkNGJjOGYwZDY5YTRlNjVmN2UwMTE4ZTgxMDEzNzNjNGU3NDNlM2ZhYmMyOTExZGNiMjMzN2ZiODU4MGUyNTYwMjFjNDA5MjZmZWY2NWY0ODlkNjNlZTc3OTZkMTAzNTBkNTY2ZWJlYTFiNw==';
            tokenValidator.tokenIsValid(token, ['secret1', 'secret2']).should.equal(true);
        });

        it('should authenticate a valid token using secret 2', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha512&expiry=1293280496&x:counter=99123
            // key=secret2
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhNTEyJmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMywxY2ExZDYwMTNhYmNhNTRiMTdlNzE4NjdiNDlmYWQ5NDNlM2ZiZGJiOGQ3MTc3ZDQyY2I2ZjRjMDQ0YmJlZTljZTdkZjliMDNmYWIzNjVjM2IwZWZlZTRlNTA1MTg1OTU5MDk1MTc1NDBkNGFkYzYzNGIxYWRjNTg3MGFlZTEwNQ';
            tokenValidator.tokenIsValid(token, ['secret1', 'secret2']).should.equal(true);
        });

        it('should detect invalid signitures', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha512&expiry=1293280496&x:counter=99123
            // key=secret3
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhNTEyJmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMyxjZDRhZmQyNzE0ODlkODk1YjJkMWJiMzFkMDVmZTljOTViZDBiZjYwZmRlYTE5MDVhNjNlMGViMDAxNmIwY2MyNjQ4YTNmMWU0MzVkMDc3MjI4MTMzYzYzNjAwNGIwN2Y1MWMxY2IyYTZhYTU0ODg5YjBlZDBhYmE5YjNkZDY5OQ==';
            tokenValidator.tokenIsValid(token, ['secret1', 'secret2']).should.equal(false);
        });

        it('should deal with unknown hash functions', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=bogus&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49Ym9ndXMmZXhwaXJ5PTEyOTMyODA0OTYmeDpjb3VudGVyPTk5MTIzLGVhNWIyYmU0YWMxYWQ5OTFjMTU1NzEzZTNhM2IyZTFhYWYwNjFlM2E5ZTQyNDM1YzkxOTYzM2FmMTU4MDE4NzkwMDU0NjA3ZWYzNjYzZDc1OWRkMTJkYzRjMGU3NWMwNGU5NGZlYmYyM2RkNTM4MDkzNjZhZWYwODYzYzg5OWE1';
            tokenValidator.tokenIsValid(token, ['secret1', 'secret2']).should.equal(false);
        });

        it('should deal with no specified hash function by defaulting to sha256', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZXhwaXJ5PTEyOTMyODA0OTYmeDpjb3VudGVyPTk5MTIzLDM3YzY3ZTc5NzE0NGVhMWUzZDhkNjczNTEzNzU4MDgzOGU4NWI3ZjM1YTZiNThmZjQyMjJjNWVmZDQzNzkyMDg=';
            tokenValidator.tokenIsValid(token, ['secret1', 'secret2']).should.equal(true);
        });

        it('should work with sha1 signed tokens', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha1&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhMSZleHBpcnk9MTI5MzI4MDQ5NiZ4OmNvdW50ZXI9OTkxMjMsN2NiMzEyMzhhZjEzZGQ2YTY2ZmNjNjA2Y2Q1ZTI1NmZlYTMzNWEyMg==';
            tokenValidator.tokenIsValid(token, ['secret2', 'secret1']).should.equal(true);
        });

        it('should work with sha256 signed tokens', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha256&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhMjU2JmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMyxkOWJiNTU0MGIwOTMxMmZkMjQ4OTI4MTI4MDk2NGI0MDUwMWY3MjYxYmI1NWYyZjNmODJiZTUyMzMxMzIzOGVj';
            tokenValidator.tokenIsValid(token, ['secret2', 'secret1']).should.equal(true);
        });

        it('should work with sha512 signed tokens', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=sha512&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49c2hhNTEyJmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMywyZWRkNDkzZTJjMDc0YTA1YmE1OTJkNGJjOGYwZDY5YTRlNjVmN2UwMTE4ZTgxMDEzNzNjNGU3NDNlM2ZhYmMyOTExZGNiMjMzN2ZiODU4MGUyNTYwMjFjNDA5MjZmZWY2NWY0ODlkNjNlZTc3OTZkMTAzNTBkNTY2ZWJlYTFiNw==';
            tokenValidator.tokenIsValid(token, ['secret1']).should.equal(true);
        });

        it('should work with md5 signed tokens', function () {
            // protohash=BT:7f45a5861d1a30f5211831bca94938aaa9e5082e&fn=md5&expiry=1293280496&x:counter=99123
            // key=secret1
            var token = 'cHJvdG9oYXNoPUJUOjdmNDVhNTg2MWQxYTMwZjUyMTE4MzFiY2E5NDkzOGFhYTllNTA4MmUmZm49bWQ1JmV4cGlyeT0xMjkzMjgwNDk2Jng6Y291bnRlcj05OTEyMyxjN2FjZTA5YTVmOTU4NTM4NjFiYWM2ZmM4MDFkZjI2MQ==';
            tokenValidator.tokenIsValid(token, ['secret1']).should.equal(true);
        });

    });
});
