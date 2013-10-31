/*jslint node: true */
"use strict";
var url = require('url'),
    async = require('async'),
    errorlog = require('winston');

function createDocument(db, docId, doc, callback) {
    var status_code_conflict = 409; // Means that the doc already exists

    db.insert(doc, docId, function (err) {
        if (err && err.status_code !== status_code_conflict) {
            errorlog.error('Error whilst creating document ' + docId);
            callback(err);
        } else {
            callback();
        }
    });
}


function createDatabase(nano, dbName, callback) {
    var db,
        status_code_already_exists = 412; // Means the DB already exists

    // Create the database, design docs and seed data. If any items already exist
    // silently move on. Any items that need updating in a future release should be
    // created as new items, which will also help maintain backwards between the DB
    // and older releases of the app.
    async.series([
        function createDatabase(cb) {
            nano.db.create(dbName, function (err) {
                if (!err || err.status_code === status_code_already_exists) {
                    db = nano.use(dbName);
                    if (!err) {
                        errorlog.info('Created database ' + dbName);
                    }
                    cb();
                } else {
                    cb(err);
                }
            });

        },
        function createCDNsDesignDoc(cb) {
            var designDoc = {
                "views": {
                    "all": {
                        "map": function(doc) {
                            if (doc.type === 'cdn') {
                                emit(doc._id, doc);
                            }
                        }
                    }
                },
                "filters": {
                    "all": function(doc, req) {
                        return (doc.type == 'cdn' || doc._deleted);
                    }
                }
            };
            createDocument(db, '_design/cdns', designDoc, cb);
        },
        function createDistributionsDesignDoc(cb) {
            var designDoc = {
                "views": {
                    "all": {
                        "map": function(doc) {
                            if (doc.type === 'distribution') {
                                emit(doc._id, doc);
                            }
                        }
                    },
                    "byHostname": {
                        "map": function(doc) {
                            if (doc.type === 'distribution') {
                                for (var i = 0; i < doc.hostnames.length; i+=1) {
                                    emit(doc.hostnames[i], doc);
                                }
                            }
                        }
                    }
                },
                "filters": {
                    "all": function(doc, req) {
                        return (doc.type == 'distribution' || doc._deleted);
                    }
                }
            };
            createDocument(db, '_design/distributions', designDoc, cb);
        },
        function createVelocixCDN(cb) {
            var doc = {
                "name": "Velocix",
                "driver": "velocix",
                "active": true,
                "allowOffNetClients": false,
                "type": "cdn",
                "defaultOrder": 0,
                "lookupService": {
                    "proto": "sscsv2",
                    "host": "routing.zzz83s2.pub",
                    "port": 8003,
                    "path": "/sscsv2"
                }
            };
            createDocument(db, 'velocix', doc, cb);
        },
        function createAmazonCdn(cb) {
            var doc = {
                "name": "Amazon Cloudfront",
                "driver": "amazon",
                "allowOffNetClients": true,
                "type": "cdn",
                "defaultOrder": 1,
                "active": true
            };
            createDocument(db, 'amazon', doc, cb);
        },
        function createGenericCdn(cb) {
            var doc = {
                "name": "Generic",
                "driver": "generic",
                "allowOffNetClients": true,
                "type": "cdn",
                "defaultOrder": 2,
                "active": true
            };
            createDocument(db, 'generic', doc, cb);
        },
        function createSampleDistribution(cb) {
            var doc = {
               "_id": "b2841c2c4a72676931a015d76c01a713",
               "_rev": "1-21d6e70ad1ffe27eb3f07d686b33e28d",
               "type": "distribution",
               "hostnames": [
                   "demo.cdnexperts.net",
                   "localhost"
               ],
               "providers": [
                   {
                       "id": "velocix",
                       "active": true
                   },
                   {
                       "id": "amazon",
                       "active": true,
                       "hostname": "d1ow0xdh6qh3nq.cloudfront.net",
                       "signedUrl": {
                           "awsCfKeyPairId": "APKAIRTLI3CT3QO4UAJA",
                           "awsCfPrivateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAjejN1DZG/dwXte5bcKGE9VsOPgr9k9A1vdQUJPQXdgSA0jcp\ni/kVS3pBrjOIni1j22A9epklQVoMlXZi/sM+beBm8RUxfjBws7PchEx8khd36WON\nLlZRDAUA6a7YQ2OwadpBegGdIsdtEshBbZWmuq0gCEdhfp5s9K2Ui9dnQTMIBp8/\nleGn9pU5y7m9LWvwhHGAAE5iFZjWCVF9iTOsRZQr9zJ7ioGC4vN7SHQqNIewC9Y1\nRGXPUUtgypKifpobi/nIga7GdhDg3Lza9jtfVAxpknmja4LVD8OzFh7cW+G9mu4c\nNU0iTqbllH3O/akTVdI7TlRFGulP7ZdeNmreywIDAQABAoIBABCnUHhmAkDKcnHk\nThDSs7LDg9FeItIU7imf2NlZV+N+tct1s8d8bLZV251g6Nh/RSe6jJx1mnyn37Au\nm4GAUjQ80HfcX9mKP7+nDOrtuvS+ElFuYGQetxYtBCVoYnLOISba+TIjPFiXhMJe\ng+cjV9Syen7eOZ/NYcX5FOSwW6q38KxG6Y0aWFifxIvCre69xbX80fBXUsstadyD\neiK4G9cXEae3WwpDJOtwx8jero5obSFXIaWE21GCDHvU+58clsJUYNjPk0czh9fV\ns0qSRBo9UVyqcQjXch5JS+QiocNQ6KjND2qH80luVddCqZ5kw5Y0ZqIW67Y5/VDi\nbByLOckCgYEAwampsSuHDH+JIFIqoqhKgKT78W5vRVHavNaH4NuOHhEc6IaCZQ19\n9wt3K+Qh4VJAASetei1rJCZIVplptC7/TdPO/9yJX6gZln9lzsBGvBORH24IHcEn\nYLLq+UwHueDcU3j4X5b7z+Pbre7J+fIlMvYhlvt7rWMNibC61BTqfN8CgYEAu5aG\nHyQXY3rFfrZUw5jg+x1i2lKWNlg5FnAnsGB7f0DI2uWnPfHOnbJZST7kj5zpzLkU\nKSTPK3BVbA5LVUsrs0sV399INyWdDTTpxEV7QXmefF73VyftlHV/WQwDCJYG2MAk\nh3mO34khL2foU+UOtisqZ/5hxPtWpZ86tHAk75UCgYEAt9umgdBsPz5ZZjj7xz70\ntFtt4ZFRzELg4sTdbWmj7AGdK1iANQXxH/hfpGjKjYszvqT3unWiMUizBpxRUUIJ\nGc9Lx3eNaCZEXLAIbJf4z5fYADnLNMxq4RAbqqA2+Y50Pj8rtjy2RnDx35hDYqs0\nC8TGsPuCOGNAuAbz6GMPF4sCgYApVbS+HezNbdsg3bp10zUYAFSs+O/Cj9QcfqAw\nPEJaOwNHQL2GZ8b4drk365TflFrsUof/vO2ti7Y29jthUwwRGOV8DC5UgIRHybYN\nGqZbOhpTG3XzDYhLY0ypaX0toilmD4i9FWsHFKdsU8Ac5GdGeuKAQcx3ZE6mdhyw\nb9mjtQKBgQCcNhzO0mUVNsv68meF4MgHDwX2/kMJVb6I93lmy0tvIOHHwccESDis\nBanYxjm+n5DgugsSEnVa519LoDmECR0wkBCyF8KpEUzStv+e/cVt03B7DWmgwJFN\nOPrGsbuTnTgP8rlbr31HY4x8PbrSFy/1Fpt/j4Ar51SE5xbaOHynpQ==\n-----END RSA PRIVATE KEY-----\n"
                       }
                   },
                   {
                       "id": "generic",
                       "active": true,
                       "hostname": "66c31a5db47d96799134-07d0dcfc87cc7f17a619f7b9e538157a.r2.cf3.rackcdn.com"
                   }
               ],
               "authParam": "authtoken",
               "authSecrets": [
                   "secret1",
                   "secret2"
               ],
               "name": "Example"
            };
            createDocument(db, 'sample-distribution', doc, cb);
        }
    ],
    function (err, results) {
        callback(err);
    });

}


module.exports = {
    getDatabase: function (dbHost, callback) {
        var dbName = 'cdns',
            nano = require('nano')('http://' + dbHost);

        createDatabase(nano, dbName, function (err) {
            if (err) {
                errorlog.warn(err);
            }
            callback(null, nano.use(dbName));
        });
    }
}