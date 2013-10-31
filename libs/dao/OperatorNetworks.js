/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    iptrie = require('iptrie');

function OperatorNetworks(db) {
    var self = this;
    this.ipRangeList = new iptrie.IPTrie();

    function loadOperatorNetworks(callback) {
        db.view('operatorNetwork', 'ipRangeList', function (err, body) {
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
        var feed = db.follow({since: 'now', filter: 'operatorNetwork/all'});
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
}
var proto = OperatorNetworks.prototype;

proto.load = function (callback) {
    this.loadAndMonitorOperatorNetworks(callback);
};


proto.addressIsOnNet = function (ipAddress) {
    if (!this.ipRangeList) {
        errorlog.warn('Network address lookup made before the network map has loaded');
        return false;
    }
    return  this.ipRangeList.find(ipAddress) ? true : false;
};


module.exports = OperatorNetworks;