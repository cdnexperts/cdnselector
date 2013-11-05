/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    iptrie = require('iptrie'),
    BaseDao = require('./BaseDao.js'),
    util = require('util');

var dbDocs = {
    "_design/operatorNetwork": {
        "language": "javascript",
        "views": {
           "ipRangeList": {
               "map": function(doc) {
                    if (doc.type === 'cdns:operatorNetwork') {
                        for (var i=0; i < doc.ipRanges.length; i++) {
                            emit(null, doc.ipRanges[i]);
                        }
                    }
                }
           }
        },
        "filters": {
           "all": function (doc, req) {
                return (doc.type == 'cdns:operatorNetwork' || doc._deleted);
            }
        }
    }
};

function OperatorNetworks(db) {
    OperatorNetworks.super_.call(this, db, 'operatorNetwork', 'cdns:operatorNetwork');
    var self = this;

    this.ipRangeList = new iptrie.IPTrie();
    this.typeString = "cdns:operatorNetwork";

    function loadOperatorNetworks(callback) {
        db.view(self.designDoc, 'ipRangeList', function (err, body) {
            if (!err) {
                var newIpRangeList = new iptrie.IPTrie();
                body.rows.forEach(function (doc) {
                    errorlog.debug('Added operator network range : ' + doc.value.network + '/' + doc.value.prefix);
                    newIpRangeList.add(doc.value.network, doc.value.prefix, true);
                });
                self.ipRangeList = newIpRangeList;
                callback();
            } else {
                callback(new Error('Error from Database while fetching distribution list : ' + err));
            }
        });
    };

    function monitorOperatorNetworks() {
        // Monitor the database for changes to operator networks
        var feed = db.follow({since: 'now', filter: self.designDoc + '/all'});
        feed.on('change', function (change) {
            errorlog.info('Operator Network config was updated: ' + JSON.stringify(change));
            loadOperatorNetworks(function (err) {
                if (err) {
                    errorlog.error('Could not load changes to operator networks', err);
                }
            });
        });

        feed.on('error', function(err) {
            errorlog.error('Lost connectivity with the DB changes feed for distributions', err);
        })
        feed.follow();
    }

    this.loadAndMonitorOperatorNetworks = function (callback) {
        loadOperatorNetworks(callback);
        monitorOperatorNetworks();
    };

    self.createDatabaseDocs(dbDocs, function (err) {
        if (err) {
            errorlog.error("Error whilst creating DB documents for OperatorNetworks.", err);
            self.emit('error', err);
        } else {
            self.loadAndMonitorOperatorNetworks(function (err) {
                if (err) {
                    self.emit('error', err);
                } else {
                    self.emit('updated');
                }
            });
        }
    });
}
util.inherits(OperatorNetworks, BaseDao);
var proto = OperatorNetworks.prototype;

proto.save = function (ipRanges, source, callback) {
    var self = this,
        docId = this.typeString + ':' + source,
        doc = {
            type: this.typeString,
            ipRanges: ipRanges,
            source: source
        };
    self.createOrReplaceDocument(doc, docId, callback);
};

proto.addressIsOnNet = function (ipAddress) {
    if (!this.ipRangeList) {
        errorlog.warn('Network address lookup made before the network map has loaded');
        return false;
    }
    return  this.ipRangeList.find(ipAddress) ? true : false;
};

module.exports = function (database) {
    return new OperatorNetworks(database);
};