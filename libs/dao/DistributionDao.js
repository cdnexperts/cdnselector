/*jslint node: true */
"use strict";
var logger = require('winston'),
    BaseDao = require('./BaseDao.js'),
    util = require('util');

var dbDocs = {
    "_design/distributions": {
        "views": {
            "all": {
                "map": function(doc) {
                    if (doc.type === 'cdns:distribution') {
                        emit(doc._id, doc);
                    }
                }
            },
            "byHostname": {
                "map": function(doc) {
                    if (doc.type === 'cdns:distribution') {
                        for (var i = 0; i < doc.hostnames.length; i+=1) {
                            emit(doc.hostnames[i], doc);
                        }
                    }
                }
            }
        },
        "filters": {
            "all": function(doc, req) {
                return (doc.type == 'cdns:distribution' || doc._deleted);
            }
        }
    },
    "cdns:distribution:sample-distribution": {
       "type": "cdns:distribution",
       "selectionMode": "loadbalance",
       "hostnames": [
           "example.cdnexperts.net",
           "alternative.example.com"
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
                     "238CA6248EC66F3068A88FB0AD09CC99"
                 ],
                 "hashSalt": "aabbcc",
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
    }
};

function DistributionDao(db) {
    DistributionDao.super_.call(this, db, 'distributions', 'cdns:distribution');
    var self = this;
    this.distributions = {};
    this.db = db;
    this.designDoc = 'distributions';
    this.typeId = 'cdns:distribution';

    this.loadAllDistributions = function (callback) {
        var feed, i, distrib;

        db.view('distributions', 'byHostname', function (err, body) {
            if (!err) {
                body.rows.forEach(function (doc) {
                    self.distributions[doc.key] = doc.value;
                });
                callback();
            } else {
                callback(new Error('Error from Database while fetching distribution list : ' + err));
            }
        });

        // Monitor the database for changes to  distributions
        var feed = db.follow({since: 'now', filter: 'distributions/all'});
        feed.on('change', function (change) {
            logger.info('Distribution config was updated: ' + JSON.stringify(change));
            if (change.deleted) {
                for (distrib in this.distributions) {
                    if (this.distributions[distrib]._id === change.id) {
                        delete this.distributions[distrib];
                    }
                }
            } else {
                db.get(change.id, {}, function (err, body) {
                    if (err) {
                        logger.warn('Unable to load changes to distribution ' + change.id + ' : ' + err);
                    } else {
                        for (var hostname in self.distributions) {
                            if (self.distributions[hostname]._id === change.id) {
                                delete self.distributions[hostname];
                            }
                        }
                        // Create one entry per hostname
                        for (i = 0; i < body.hostnames.length; i+=1) {
                            self.distributions[body.hostnames[i]] = body;
                        }
                    }
                });
            }
        });

        feed.on('error', function(err) {
            logger.error('Lost connectivity with the DB changes feed for distributions', err);
        })
        feed.follow();

    };

    self.createDatabaseDocs(dbDocs, function (err) {
        if (err) {
            logger.error("Error whilst creating DB documents for Distributions.", err);
            self.emit('error', err);
        } else {
            self.loadAllDistributions(function (err) {
                if (err) {
                    self.emit('error', err);
                } else {
                    self.emit('ready');
                }
            });

        }
    });

}
util.inherits(DistributionDao, BaseDao);
var proto = DistributionDao.prototype;

proto.getByHostname = function (hostname) {
    return this.distributions[hostname];
};

module.exports = function (database) {
    return new DistributionDao(database);
};