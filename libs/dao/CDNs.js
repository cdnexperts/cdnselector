/*jslint node: true */
"use strict";
var VelocixCDN = require('../cdn/VelocixCDN'),
    GenericOttCDN = require('../cdn/GenericOttCDN'),
    AmazonCloudfront = require('../cdn/AmazonCloudfront'),
    errorlog = require('winston'),
    BaseDao = require('./BaseDao.js'),
    util = require('util');

var dbDocs = dbDocs = {
    "_design/cdns": {
        "views": {
            "all": {
                "map": function(doc) {
                    if (doc.type === 'cdns:cdn') {
                        emit(doc._id, doc);
                    }
                }
            }
        },
        "filters": {
            "all": function(doc, req) {
                return (doc.type == 'cdns:cdn' || doc._deleted);
            }
        }
    },
    "cdns:cdn:velocix": {
        "name": "Velocix",
        "driver": "cdns:cdn:velocix",
        "active": true,
        "allowOffNetClients": false,
        "type": "cdns:cdn",
        "defaultOrder": 0,
        "lookupService": {
            "proto": "sscsv2",
            "host": "routing.zzz83s2.pub",
            "port": 8003,
            "path": "/sscsv2"
        }
    },
    "cdns:cdn:amazon": {
        "name": "Amazon Cloudfront",
        "driver": "cdns:cdn:amazon",
        "allowOffNetClients": true,
        "type": "cdns:cdn",
        "defaultOrder": 1,
        "active": true
    },
    "cdns:cdn:generic": {
        "name": "Generic",
        "driver": "cdns:cdn:generic",
        "allowOffNetClients": true,
        "type": "cdns:cdn",
        "defaultOrder": 2,
        "active": true
    }
};

function CDNs(db, distribs) {
    CDNs.super_.call(this, db);

    var self = this,
        cdnDrivers = {
            "cdns:cdn:velocix": VelocixCDN,
            "cdns:cdn:generic": GenericOttCDN,
            "cdns:cdn:amazon": AmazonCloudfront
        };

    this.cdns = {};

    function addCdn (id, doc) {
        var cdn;
        for (var driverKey in cdnDrivers) {
            if (id === driverKey) {
                cdn = new cdnDrivers[driverKey](id, doc, distribs);
                break;
            }
        }
        // No driver found, so assume its a generic HTTP CDN.
        if (!cdn) {
            cdn = new GenericOttCDN(id, doc, distribs);
        }

        self.cdns[id] = cdn;
    }

    this.loadAllCDNs = function (callback) {
        var self = this;

        // Load all from the database
        db.view('cdns', 'all', function (err, body) {
            if (!err) {
                body.rows.forEach(function (row) {
                    addCdn(row.key, row.value);
                });
                callback();
            } else {
                callback(new Error('Error from Database while fetching cdns : ' + err));
            }
        });

        // Monitor for changes
        var feed = db.follow({since: 'now', filter: 'cdns/all'})
        feed.on('change', function (change) {
            errorlog.info('CDN config was updated: ' + JSON.stringify(change));
            if (change.deleted) {
                delete self.cdns[change.id];
            } else {
                db.get(change.id, {}, function (err, body) {
                    if (err) {
                        errorlog.warn('Unable to load changes to CDN ' + change.id + ' : ' + err);
                    } else {
                        addCdn(body._id, body);
                    }
                });
            }
        });
        feed.on('error', function(err) {
            errorlog.error('Lost connectivity with the DB changes feed for CDNs', err);
        })
        feed.follow();
    };
}

util.inherits(CDNs, BaseDao);
var proto = CDNs.prototype;


proto.load = function (callback) {
    var self = this;
    self.createDatabaseDocs(dbDocs, function (err) {
        if (err) {
            errorlog.error("Error whilst creating DB documents for CDNs.", err);
            callback(err);
        } else {
            self.loadAllCDNs(callback);
        }
    });
};


proto.getById = function (id) {
    return this.cdns[id];
};

module.exports = function (database) {
    return new CDNs(database);
};