/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    url = require('url'),
    AmazonCloudfront = require('../../libs/cdn/AmazonCloudfront'),
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
                            hostname: 'd2tihyvz36rus8.cloudfront.net',
                            signedUrl: {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----"
                            }
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
    },
    cf = new AmazonCloudfront('amazon', {}, distribs),

    provider = {
        id: 'amazon',
        active: true,
        hostname: 'd2tihyvz36rus8.cloudfront.net',
        signedUrl: {
           "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
           "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----"
        }
    };



describe('AmazonCloudfront', function () {
    describe('#generateTokenizedUrl', function () {
        it('should generate a signed URL', function () {

            var targetUrl = url.parse('http://d2tihyvz36rus8.cloudfront.net/demo/dtcp-sprint5/vxlive/index.m3u8?blah=999', true),
                inboundTokenParams = {
                    "pathURI": "#http://testhost.com/demo/dtcp-sprint5/vxlive/*",
                    "fn": "sha512",
                    "expiry": "1412121600",
                    "x:counter": "99123",
                    "c-ip": "115.164.93.0/24"
                },
                signedUrl = cf.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            signedUrl.query['x:counter'].should.equal('99123');
            signedUrl.query['Policy'].should.equal('eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2QydGloeXZ6MzZydXM4LmNsb3VkZnJvbnQubmV0L2RlbW8vZHRjcC1zcHJpbnQ1L3Z4bGl2ZS8qP2JsYWg9OTk5JnglM0Fjb3VudGVyPTk5MTIzIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNDEyMTIxNjAwfSwiSXBBZGRyZXNzIjp7IkFXUzpTb3VyY2VJcCI6IjExNS4xNjQuOTMuMC8yNCJ9fX1dfQ__');
            signedUrl.query['Signature'].should.equal('QLy8wmrtSzfAzkvwetqEZB-1EVvUBpR5WA248T0ZbMUx6tv3gvK0u~pHlJR7EYYIleYSdtj029j4GpR4YMPZ5P5CteUC3CzERq7wRy3z7gcjyKLz8NRWth8NEYOgsDGimbumOa1ZrUtxBZYccYmVpPmy3AVBxFP-AMUdlJ0ZXg2FV8fqECPsrpkCv6iReQfalND~uQsriwPSO22m7qVYRtQUJEBjXxwtj29jxdaxbGS0QHmQMLfUdhvf0SW6LPvo1WigjgsqLjdXjKEM6Iwl66y4bqEsYS-khcAR6P9vMliANKEY1M1sN74K1k9AOmTxlTi5lpCCnxRbkvvBrLfWyw__');
            signedUrl.query['Key-Pair-Id'].should.equal('APKAIRTLI3CT3QO4UAJA');

        });

        it('should generate a signed URL with a path (rather than a full URL) in the pathURI', function () {
            var targetUrl = url.parse('http://d2tihyvz36rus8.cloudfront.net/demo/dtcp-sprint5/vxlive/index.m3u8?blah=999', true),
                inboundTokenParams = {
                    "pathURI": "/demo/dtcp-sprint5/vxlive/*",
                    "fn": "sha512",
                    "expiry": "1412121600",
                    "x:counter": "99123",
                    "c-ip": "115.164.93.0/24"
                },
                signedUrl = cf.generateTokenizedUrl(targetUrl, inboundTokenParams, provider);

            signedUrl.query['x:counter'].should.equal('99123');
            signedUrl.query['Policy'].should.equal('eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2QydGloeXZ6MzZydXM4LmNsb3VkZnJvbnQubmV0L2RlbW8vZHRjcC1zcHJpbnQ1L3Z4bGl2ZS8qP2JsYWg9OTk5JnglM0Fjb3VudGVyPTk5MTIzIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNDEyMTIxNjAwfSwiSXBBZGRyZXNzIjp7IkFXUzpTb3VyY2VJcCI6IjExNS4xNjQuOTMuMC8yNCJ9fX1dfQ__');
            signedUrl.query['Signature'].should.equal('QLy8wmrtSzfAzkvwetqEZB-1EVvUBpR5WA248T0ZbMUx6tv3gvK0u~pHlJR7EYYIleYSdtj029j4GpR4YMPZ5P5CteUC3CzERq7wRy3z7gcjyKLz8NRWth8NEYOgsDGimbumOa1ZrUtxBZYccYmVpPmy3AVBxFP-AMUdlJ0ZXg2FV8fqECPsrpkCv6iReQfalND~uQsriwPSO22m7qVYRtQUJEBjXxwtj29jxdaxbGS0QHmQMLfUdhvf0SW6LPvo1WigjgsqLjdXjKEM6Iwl66y4bqEsYS-khcAR6P9vMliANKEY1M1sN74K1k9AOmTxlTi5lpCCnxRbkvvBrLfWyw__');
            signedUrl.query['Key-Pair-Id'].should.equal('APKAIRTLI3CT3QO4UAJA');

        });
    });

    describe('#extractInboundToken', function () {
        it('should be able to detect a valid token and extract its parameters', function () {
            should.fail();
        });

        it('should be able to detect an invalid token', function () {
            should.fail();
        });

        it('should be able to detect a request without a token', function () {
            should.fail();
        });
    });
});