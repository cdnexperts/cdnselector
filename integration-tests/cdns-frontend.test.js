/*jslint node: true*/
/*global describe, it */
"use strict";

process.env.CDNS_MANUAL_START = true;
process.env.CDNS_WORKER_PROCESSES = 1;
process.env.CDNS_LOG_LEVEL = 'error';
process.env.CDNS_DB_NAME = 'cdns-integration-test';
process.env.CDNS_PORT = 7777;

var should = require('should'),
    async = require('async'),
    http = require('http'),
    tokenValidator = require('../libs/tokenValidator'),
    testUtils = require('../tests/TestUtil.js'),
    cdnsFrontend = require('../cdns-frontend'),
    localConfig = require('../libs/localConfig'),
    database = require('../libs/database')(localConfig.dbUrl, localConfig.dbName);

// Template distribution
var sampleDistribution = {
       "type": "cdns:distribution",
       "selectionMode": "loadbalance",
       "hostnames": [
           "localhost"
       ],
       "providers": [
           {
               "id": "cdns:cdn:velocix",
               "driver": "cdns:cdn:driver:velocix",
               "active": true,
               "loadBalancer": {
                   "targetLoadPercent": 0,
                   "alwaysUseForWhitelistedClients": true
               },
               "tokens": {
                   "authParam": "authToken",
                   "authSecrets": [
                     "secret1",
                     "secret2"
                   ]
               }
           },
           {
              "id": "cdns:cdn:akamai",
              "driver": "cdns:cdn:driver:akamai",
              "active": true,
              "hostname": "emt-vh.akamaihd.net",
              "tokens": {
                 "authParam": "hdnts",
                 "authSecrets": [
                     "238CA6248EC66F3068A88FB0AD09CC99"
                 ],
                 "authSalt": "aabbcc",
                 "hashFn": "sha256"
              },
              "loadBalancer": {
                   "targetLoadPercent": 5,
                   "alwaysUseForWhitelistedClients": false
              }
           },
           {
               "id": "cdns:cdn:amazon",
               "driver": "cdns:cdn:driver:amazon",
               "active": true,
               "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
               "signedUrl": {
                   "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                   "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
               },
               "loadBalancer": {
                   "targetLoadPercent": 75,
                   "alwaysUseForWhitelistedClients": false
               }
           },
           {
               "id": "cdns:cdn:generic",
               "driver": "cdns:cdn:driver:generic",
               "active": true,
               "hostname": "66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com",
               "loadBalancer": {
                   "targetLoadPercent": 20,
                   "alwaysUseForWhitelistedClients": false
               }
           }
       ],
       "name": "Example"
    };

// Template CDN
var sampleCDN = {
        "name": "Velocix",
        "driver": "cdns:cdn:driver:velocix",
        "active": true,
        "type": "cdns:cdn",
        "defaultOrder": 0,
        "routingService": {
            "proto": "sscsv2",
            "host": "demo.cdnexperts.net",
            "port": 80,
            "path": "/demo/sscsv2"
        },
        "altoService": {
           "altoServiceUrl": "http://demo.cdnexperts.net/demo/cdns/alto/directory.altod",
           "refreshInterval": 60,
           "ignorePids": [
               "ignore",
               "offnet",
               "PID3"
           ],
           "networkMapId": "default-network-map",
           "lastChanged": null
        },
        "clientIpWhitelist": {
            "manual": [
                { "network": "127.0.0.0", "prefix": 8 }
            ],
            "alto": []
        }
    };


// Utility functions for updating DB state
function updateDistribution(name, distribution, callback) {
    var distribDao, db;
    async.series([
        function (next) {
            // Create and connect to the DB
            database.connect(function (err, database) {
                db = database;
                next(err);
            });
        },
        function (next) {
            // Load the distribution config
            distribDao = require('../libs/dao/DistributionDao')(db);
            distribDao.once('ready', next);
            distribDao.once('error', next);
        },
        function (next) {
            // Publish the document
            distribDao.createOrReplaceDocument(distribution, name, next);
        },
        function (next) {
            // Need to introduce a delay for the change notification reach the worker process.
            setTimeout(next, 1000);
        }
    ], callback);
}

function updateCDN(name, cdn, callback) {
    var cdnDao, db;
    async.series([
        function (next) {
            // Create and connect to the DB
            database.connect(function (err, database) {
                db = database;
                next(err);
            });
        },
        function (next) {
            // Load the distribution config
            cdnDao = require('../libs/dao/CDNDao')(db);
            cdnDao.once('ready', next);
            cdnDao.once('error', next);
        },
        function (next) {
            // Publish the document
            cdnDao.createOrReplaceDocument(cdn, name, next);
        },
        function (next) {
            // Need to introduce a delay for the change notification reach the worker process.
            setTimeout(next, 1000);
        }
    ], callback);
}


describe('cdns-frontend', function () {
    // Some of these remote calls can take a while to fail
    this.timeout(5000);

    // Start with a clean database
    before(function (done) {
        database.destroy(function(err) {
            // A 404 error is ok - it just means that the db already doesn't exist
            (err == null || err.status_code === 404).should.be.true;
            done();
        });
    });


    // Start the master process (just to check it works)
    before(function (done) {
        cdnsFrontend.startMaster(function(err) {
            should.not.exist(err);
            done();
        });
    });

    // Start a worker process (we'll use this in the tests)
    before(function (done) {
        cdnsFrontend.startWorker(function(err, server) {
            should.not.exist(err);
            should.exist(server);
            done();
        })
    });


    // The worker should still be running, so we can now fling requests at it
    describe('[A: IP Whitelist]', function () {

        it('A1: Untokenized request from on-net client should be sent to velocix via SSCS', function (done) {
            this.timeout(10000);
            async.series([
                function (next) {
                    updateDistribution('integration-test-distribution', sampleDistribution, next);
                },
                function (next) {
                    updateCDN('cdns:cdn:velocix', sampleCDN, next);
                },
                function (next) {
                    http.get('http://localhost:' + localConfig.port + '/demo/cdns/bigfish.mp4', function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);
                        response.headers.location.should.equal('http://192.168.210.134/wp/cdnselectordemo.ecreationmedia.tv/demo/cdns/bigfish.mp4');
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('A2: Untokenized request from off-net client should be sent to Amazon', function (done) {
            async.series([
                function (next) {
                    // Update the CDN's whitelist so that its allowed netblock is 128.... instead of 127
                    var cdn = testUtils.clone(sampleCDN);
                    cdn.clientIpWhitelist.manual[0] = { "network": "128.0.0.0", "prefix": 8 };
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    http.get('http://localhost:' + localConfig.port + '/demo/cdns/bigfish.mp4', function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);
                        response.headers.location.should.equal('http://d1ow0xdh6qh3nq.cloudfront.net/demo/cdns/bigfish.mp4');
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        })
    });

    // Token Tests
    describe('[B: Inbound Velocix Tokens]', function () {
        it('B1: should allow an inbound Velocix token in the querystring to pass-thru unchanged to the Velocix CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": true
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ]
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {

                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    // pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
                    // key=secret1
                    var token = 'cGF0aFVSST0vZGVtby8qJmZuPXNoYTUxMiZleHBpcnk9MTQ3ODc5OTE3NSZ4OmNvdW50ZXI9OTk'
                              + 'xMjMsOTAxNGZiMmZlZWFmOTA0YzQ2MzBlNGZmODE3M2I4ZGQ1ODcxMmY3YTBhNjVkYTc4N2IxMj'
                              + 'U5Yzc0Nzc5NzgzNDFkYjJmMGRiNmFjMjlkNmRkZjIyMjZhNTliOWUwMjBhOWMyNzQyODdmYWI1N'
                              + 'TY0OGFmNmJhOGMzNTRmYWE0Yzk=';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // The token should pass through unchanged
                        response.headers.location.should.equal(
                            'http://wp-1999999.id.velocix.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken='
                                + token
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('B2: should transfer an inbound Velocix token in a Cookie to the querystring (otherwise unchanged) to the Velocix CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": true
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ]
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {

                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    // pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
                    // key=secret1
                    var token = 'cGF0aFVSST0vZGVtby8qJmZuPXNoYTUxMiZleHBpcnk9MTQ3ODc5OTE3NSZ4OmNvdW50ZXI9OTk'
                              + 'xMjMsOTAxNGZiMmZlZWFmOTA0YzQ2MzBlNGZmODE3M2I4ZGQ1ODcxMmY3YTBhNjVkYTc4N2IxMj'
                              + 'U5Yzc0Nzc5NzgzNDFkYjJmMGRiNmFjMjlkNmRkZjIyMjZhNTliOWUwMjBhOWMyNzQyODdmYWI1N'
                              + 'TY0OGFmNmJhOGMzNTRmYWE0Yzk=';

                    var requestOptions = {
                        hostname: 'localhost',
                        port: localConfig.port,
                        path: '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?something=else',
                        method: 'GET',
                        headers: {
                            'Cookie': 'vxtoken=' + token + ';'
                        }
                    };

                    http.get(requestOptions, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // The token should pass through unchanged
                        response.headers.location.should.equal(
                            'http://wp-1999999.id.velocix.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?something=else&authToken='
                                + token
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('B3: should reject an invalid Velocix token', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Akamai.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": true
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secretWRONG" // This should make the token verification fail
                               ]
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {

                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    // pathURI=/demo/*&fn=sha512&expiry=1478799175&x:counter=99123
                    // key=secret1
                    var token = 'cGF0aFVSST0vZGVtby8qJmZuPXNoYTUxMiZleHBpcnk9MTQ3ODc5OTE3NSZ4OmNvdW50ZXI9OTk'
                              + 'xMjMsOTAxNGZiMmZlZWFmOTA0YzQ2MzBlNGZmODE3M2I4ZGQ1ODcxMmY3YTBhNjVkYTc4N2IxMj'
                              + 'U5Yzc0Nzc5NzgzNDFkYjJmMGRiNmFjMjlkNmRkZjIyMjZhNTliOWUwMjBhOWMyNzQyODdmYWI1N'
                              + 'TY0OGFmNmJhOGMzNTRmYWE0Yzk=';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(401);

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.equal("Unauthorized");
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('B4: should convert a Velocix token into an Akamai token (original token removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Akamai.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": false,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ],
                               "hashFn": "sha512"
                           }
                       },
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": true,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    // expiry=1370627409&fn=sha512&pathURI=/i/test-content/BigBuckBunny_640x360.m4v/*&x:clientIP=127.0.0.1
                    // ,8e298756ee10d39f566c2540b03eac0633cc78f0277d8418b324f5d35a7dfad89c9f5e30588fad7e9ec739e2e38c449a0cfb253fbb4c5481f7a377fa2ff6fa64
                    var token = 'ZXhwaXJ5PTEzNzA2Mjc0MDkmZm49c2hhNTEyJnBhdGhVUkk9L2kvdGVzd'
                                             + 'C1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qJng6Y2xpZW'
                                             + '50SVA9MTI3LjAuMC4xLDhlMjk4NzU2ZWUxMGQzOWY1NjZjMjU0MGIwM2V'
                                             + 'hYzA2MzNjYzc4ZjAyNzdkODQxOGIzMjRmNWQzNWE3ZGZhZDg5YzlmNWUz'
                                             + 'MDU4OGZhZDdlOWVjNzM5ZTJlMzhjNDQ5YTBjZmIyNTNmYmI0YzU0ODFmN'
                                             + '2EzNzdmYTJmZjZmYTY0';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/*
                        var expectedAkamaiToken = 'exp=1370627409'
                                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                                + '~hmac=529970e5219427457bdc738c9aa5613d29575f1f61c7949abc776276d041175f';
                        response.headers.location.should.equal(
                            'http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts='
                                + encodeURIComponent(expectedAkamaiToken)
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('B5: should convert a Velocix token into an Amazon signed URL (original token removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Amazon.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": true,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                        {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": false,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ],
                               "hashFn": "sha512"
                           }
                       },
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    // expiry=1370627409&fn=sha512&pathURI=/i/test-content/BigBuckBunny_640x360.m4v/*&x:clientIP=127.0.0.1
                    // ,8e298756ee10d39f566c2540b03eac0633cc78f0277d8418b324f5d35a7dfad89c9f5e30588fad7e9ec739e2e38c449a0cfb253fbb4c5481f7a377fa2ff6fa64
                    var token = 'ZXhwaXJ5PTEzNzA2Mjc0MDkmZm49c2hhNTEyJnBhdGhVUkk9L2kvdGVzd'
                                             + 'C1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qJng6Y2xpZW'
                                             + '50SVA9MTI3LjAuMC4xLDhlMjk4NzU2ZWUxMGQzOWY1NjZjMjU0MGIwM2V'
                                             + 'hYzA2MzNjYzc4ZjAyNzdkODQxOGIzMjRmNWQzNWE3ZGZhZDg5YzlmNWUz'
                                             + 'MDU4OGZhZDdlOWVjNzM5ZTJlMzhjNDQ5YTBjZmIyNTNmYmI0YzU0ODFmN'
                                             + '2EzNzdmYTJmZjZmYTY0';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        response.headers.location.should.equal(
                            'http://d1ow0xdh6qh3nq.cloudfront.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?'
                            + 'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('B6: should remove the Velocix token if routing to the Generic CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:generic",
                           "driver": "cdns:cdn:driver:generic",
                           "active": true,
                           "hostname": "66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                       {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": false,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": true
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ]
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var token = 'ZXhwaXJ5PTEzNzA2Mjc0MDkmZm49c2hhNTEyJnBhdGhVUkk9L2kvdGVzd'
                         + 'C1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qJng6Y2xpZW'
                         + '50SVA9MTI3LjAuMC4xLDhlMjk4NzU2ZWUxMGQzOWY1NjZjMjU0MGIwM2V'
                         + 'hYzA2MzNjYzc4ZjAyNzdkODQxOGIzMjRmNWQzNWE3ZGZhZDg5YzlmNWUz'
                         + 'MDU4OGZhZDdlOWVjNzM5ZTJlMzhjNDQ5YTBjZmIyNTNmYmI0YzU0ODFmN'
                         + '2EzNzdmYTJmZjZmYTY0';
                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // The token should be removed
                        response.headers.location.should.equal(
                            'http://66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8'
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });
    });
    describe('[C: Inbound Akamai Tokens]', function () {
        it('C1: should allow an inbound Akamai token to pass-thru unchanged to the Akamai CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Akamai.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": true,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
                    var token = 'exp=1370627409'
                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                + '~data=someOpaqueData'
                                + '~hmac=f7e461b374765d5ba5eec0662791fd118c4372bf3ae934bf4c8e82cdb01a8b00';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // The token should pass through unchanged
                        response.headers.location.should.equal(
                            'http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts='
                                + token
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('C2: should reject an invalid Akamai token', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ],
                               "hashFn": "sha512"
                           }
                       },
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": false,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],// Removed the Salt so the token calc will fail
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {

                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
                    var token = 'exp=1370627409'
                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                + '~data=someOpaqueData'
                                + '~hmac=f7e461b374765d5ba5eec0662791fd118c4372bf3ae934bf4c8e82cdb01a8b00';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(401);

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.equal('Unauthorized');
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('C3: should convert an Akamai token into a Amazon signed URL (original token removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Amazon.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": true,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": false,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
                    var token = 'exp=1370627409'
                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                + '~data=someOpaqueData'
                                + '~hmac=f7e461b374765d5ba5eec0662791fd118c4372bf3ae934bf4c8e82cdb01a8b00';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        response.headers.location.should.equal(
                            'http://d1ow0xdh6qh3nq.cloudfront.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?'
                            + 'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });

        });

        it('C4: should convert an Akamai token into an Velocix token (original token removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ],
                               "hashFn": "sha512"
                           }
                       },
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": false,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {

                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
                    var token = 'exp=1370627409'
                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                + '~data=someOpaqueData'
                                + '~hmac=f7e461b374765d5ba5eec0662791fd118c4372bf3ae934bf4c8e82cdb01a8b00';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);
                        // expiry=1370627409&fn=sha512&pathURI=/i/test-content/BigBuckBunny_640x360.m4v/*&x:clientIP=127.0.0.1
                        // ,8e298756ee10d39f566c2540b03eac0633cc78f0277d8418b324f5d35a7dfad89c9f5e30588fad7e9ec739e2e38c449a0cfb253fbb4c5481f7a377fa2ff6fa64
                        var expectedVelocixToken = 'ZXhwaXJ5PTEzNzA2Mjc0MDkmZm49c2hhNTEyJnBhdGhVUkk9L2kvdGVzd'
                                                 + 'C1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qJng6Y2xpZW'
                                                 + '50SVA9MTI3LjAuMC4xLDhlMjk4NzU2ZWUxMGQzOWY1NjZjMjU0MGIwM2V'
                                                 + 'hYzA2MzNjYzc4ZjAyNzdkODQxOGIzMjRmNWQzNWE3ZGZhZDg5YzlmNWUz'
                                                 + 'MDU4OGZhZDdlOWVjNzM5ZTJlMzhjNDQ5YTBjZmIyNTNmYmI0YzU0ODFmN'
                                                 + '2EzNzdmYTJmZjZmYTY0';

                        response.headers.location.should.equal(
                            'http://wp-1999999.id.velocix.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken='
                                + expectedVelocixToken
                        );
                        // Check the signature is valid (sanity check - it is hard coded after all)
                        var outboundVxToken = testUtils.validateAndExtractVelocixToken(expectedVelocixToken, 'secret1');
                        should.exist(outboundVxToken);
                        outboundVxToken.expiry.should.equal('1370627409');

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('C5: should remove the Akamai token if routing to the Generic CDN', function (done) {
            // Its probably not a good idea to take a token-secured request and direct it to one that
            // doesn't support tokens. However, some operators might want to do this as an emergency backup.
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:generic",
                           "driver": "cdns:cdn:driver:generic",
                           "active": true,
                           "hostname": "66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                       {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": false,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                          }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/* --payload="someOpaqueData"
                    var token = 'exp=1370627409'
                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                + '~data=someOpaqueData'
                                + '~hmac=f7e461b374765d5ba5eec0662791fd118c4372bf3ae934bf4c8e82cdb01a8b00';

                    http.get('http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?something=blah&hdnts=' + token, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        response.headers.location.should.equal(
                            'http://66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?something=blah'
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });
    });
    describe('[D: Inbound Amazon Signed URL]', function () {
        it('D1: should allow an inbound Amazon SignedURL to pass-thru unchanged to the Amazon CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Akamai.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": true,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var url = 'http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?';
                    var signingParams =
                              'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'


                    http.get(url + signingParams, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        // The token should pass through unchanged
                        response.headers.location.should.equal(
                            'http://d1ow0xdh6qh3nq.cloudfront.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?'
                                + signingParams
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('D2: should reject an invalid Signed URL', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Akamai.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": true,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var url = 'http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?';
                    var signingParams =
                              'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=eeeeNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'
                            // Signature is bad

                    http.get(url + signingParams, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(401);

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.equal('Unauthorized');
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('D3: should convert an Amazon Signed URL into a Velocix token (original signature removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:velocix",
                           "driver": "cdns:cdn:driver:velocix",
                           "active": true,
                           "hostname": "wp-1999999.id.velocix.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           },
                           "tokens": {
                               "authParam": "authToken",
                               "authSecrets": [
                                 "secret1",
                                 "secret2"
                               ],
                               "hashFn": "sha512"
                           }
                       },
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": false,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var cdn = testUtils.clone(sampleCDN);
                    delete cdn.routingService; // disable SSCS
                    cdn.clientIpWhitelist.manual = []; // No whitelist == open to all
                    updateCDN('cdns:cdn:velocix', cdn, next);
                },
                function (next) {
                    var url = 'http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?';
                    var signingParams =
                              'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'


                    http.get(url + signingParams, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);
                        // expiry=1370627409&fn=sha512&pathURI=/i/test-content/BigBuckBunny_640x360.m4v/*&x:clientIP=127.0.0.1
                        // ,8e298756ee10d39f566c2540b03eac0633cc78f0277d8418b324f5d35a7dfad89c9f5e30588fad7e9ec739e2e38c449a0cfb253fbb4c5481f7a377fa2ff6fa64
                        var expectedVelocixToken = 'ZXhwaXJ5PTEzNzA2Mjc0MDkmZm49c2hhNTEyJnBhdGhVUkk9L2kvdGVzd'
                                                 + 'C1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qJng6Y2xpZW'
                                                 + '50SVA9MTI3LjAuMC4xLDhlMjk4NzU2ZWUxMGQzOWY1NjZjMjU0MGIwM2V'
                                                 + 'hYzA2MzNjYzc4ZjAyNzdkODQxOGIzMjRmNWQzNWE3ZGZhZDg5YzlmNWUz'
                                                 + 'MDU4OGZhZDdlOWVjNzM5ZTJlMzhjNDQ5YTBjZmIyNTNmYmI0YzU0ODFmN'
                                                 + '2EzNzdmYTJmZjZmYTY0';

                        response.headers.location.should.equal(
                            'http://wp-1999999.id.velocix.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?authToken='
                                + expectedVelocixToken
                        );
                        // Check the signature is valid (sanity check - it is hard coded after all)
                        var outboundVxToken = testUtils.validateAndExtractVelocixToken(expectedVelocixToken, 'secret1');
                        should.exist(outboundVxToken);
                        outboundVxToken.expiry.should.equal('1370627409');

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('D4: should convert an Amazon Signed URL into an Akamai token (original token removed)', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                          "id": "cdns:cdn:akamai",
                          "driver": "cdns:cdn:driver:akamai",
                          "active": true,
                          "hostname": "emt-vh.akamaihd.net",
                          "tokens": {
                             "authParam": "hdnts",
                             "authSecrets": [
                                 "aa11bb22"
                             ],
                             "hashSalt": "aabbcc",
                             "hashFn": "sha256"
                          },
                          "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                          }
                       },
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": false,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var url = 'http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?';
                    var signingParams =
                              'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'


                    http.get(url + signingParams, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);
                        // python akamai_token_v2.py --end_time=1370627409 --key=aa11bb22 --salt=aabbcc --acl=/i/test-content/BigBuckBunny_640x360.m4v/*
                        var expectedAkamaiToken = 'exp=1370627409'
                                                + '~acl=/i/test-content/BigBuckBunny_640x360.m4v/*'
                                                + '~hmac=529970e5219427457bdc738c9aa5613d29575f1f61c7949abc776276d041175f';

                        response.headers.location.should.equal(
                            'http://emt-vh.akamaihd.net/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?hdnts='
                                + encodeURIComponent(expectedAkamaiToken)
                        );

                        // We must consume the entire body to keep node happy
                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });

        it('D5: should remove the Amazon signature if routing to the Generic CDN', function (done) {
            async.series([
                function (next) {
                    // Configure our distribution so that all traffic goes to Velocix.
                    var distrib = testUtils.clone(sampleDistribution);
                    distrib.providers = [
                        {
                           "id": "cdns:cdn:generic",
                           "driver": "cdns:cdn:driver:generic",
                           "active": true,
                           "hostname": "66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com",
                           "loadBalancer": {
                               "targetLoadPercent": 100,
                               "alwaysUseForWhitelistedClients": false
                           }
                       },
                       {
                           "id": "cdns:cdn:amazon",
                           "driver": "cdns:cdn:driver:amazon",
                           "active": false,
                           "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                           "signedUrl": {
                               "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                               "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                           },
                           "loadBalancer": {
                               "targetLoadPercent": 0,
                               "alwaysUseForWhitelistedClients": false
                           }
                       }
                    ];
                    updateDistribution('integration-test-distribution', distrib, next);
                },
                function (next) {
                    var url = 'http://localhost:' + localConfig.port + '/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8?';
                    var signingParams =
                              'Key-Pair-Id=APKAIRTLI3CT3QO4UAJA'
                            + '&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cDovL2Qxb3cweGRoNnFoM25xLmNsb3VkZnJvbnQubmV0L2kvdGVzdC1jb250ZW50L0JpZ0J1Y2tCdW5ueV82NDB4MzYwLm00di8qPyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTM3MDYyNzQwOX19fV19'
                            + '&Signature=e-VvNCHlOas-mGGcSOlvsvlQOIT5qC68u0UOSbHzKrzj5-XpXR4ycjRv2E2N0z-45SBoxdnX1P7i783UQjqFGuBUEHwzTxiivSvrtmo3Nsp2VPL1SFI3teF41kW2Pq7gBqHzJgiXEeInlwLzdKLJrMohTSqEOtaMmoJqzy-QTzE-FqW8l7COxy~zCd0O2L8KL5mmayOPNSyWEtSQ0zPqq9nu1DZvmBj2WUJJe~UYzxxfSpQjAcZzHpJVWSzhFmuFgu4BMu5FudHKkVHRbKUZsVZKnhJfTiJT0ZRx4f2~0TwBPfckSJ3DF1-yo2PFSs~TRo1oXd8BfVtJ6vowBzVBDg__'


                    http.get(url + signingParams, function (response) {
                        should.exist(response);
                        response.statusCode.should.equal(302);

                        response.headers.location.should.equal(
                            'http://66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com/i/test-content/BigBuckBunny_640x360.m4v/master.m3u8'
                        );

                        testUtils.readResponse(response, function (data) {
                            data.should.be.empty;
                            next();
                        });
                    });
                }
            ], function (err) {
                should.not.exist(err);
                done();
            });
        });
    });
});