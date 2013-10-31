/*jslint node: true */
"use strict";
var errorlog = require('winston');

function Distributions(db) {
    var self = this;
    this.distributions = {};

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
            errorlog.info('Distribution config was updated: ' + JSON.stringify(change));
            if (change.deleted) {
                for (distrib in this.distributions) {
                    if (this.distributions[distrib]._id === change.id) {
                        delete this.distributions[distrib];
                    }
                }
            } else {
                db.get(change.id, {}, function (err, body) {
                    if (err) {
                        errorlog.warn('Unable to load changes to distribution ' + change.id + ' : ' + err);
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
            errorlog.error('Lost connectivity with the DB changes feed for distributions', err);
        })
        feed.follow();

    };
}
var proto = Distributions.prototype;

proto.load = function (callback) {
    this.loadAllDistributions(callback);
};


proto.getByHostname = function (hostname) {
    return this.distributions[hostname];
};



module.exports = Distributions;