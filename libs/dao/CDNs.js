/*jslint node: true */
"use strict";
var VelocixCDN = require('../cdn/VelocixCDN'),
    GenericOttCDN = require('../cdn/GenericOttCDN'),
    AmazonCloudfront = require('../cdn/AmazonCloudfront'),
    errorlog = require('winston');

function CDNs(db, distribs) {

    var self = this,
        cdnDrivers = {
            velocix: VelocixCDN,
            generic: GenericOttCDN,
            amazon: AmazonCloudfront
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
var proto = CDNs.prototype;

proto.load = function (callback) {
    this.loadAllCDNs(callback);
};


proto.getById = function (id) {
    return this.cdns[id];
};

module.exports = CDNs;