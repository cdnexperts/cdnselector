/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    util = require('util'),
    BaseDao = require('./BaseDao.js');

var dbDocs = {
    "_design/config": {
       "language": "javascript",
       "filters": {
            "all": function (doc, req) {
                return (doc._id === 'cdns:config');
            }
       }
    },
    "cdns:config": {
       "alto": {
           "altoServiceUrl": "http://demo.cdnexperts.net/demo/cdns/alto/directory.altod",
           "refreshInterval": 60,
           "ignorePids": [
               "ignore",
               "offnet",
               "PID3"
           ],
           "networkMapId": "default-network-map"
       }
    }
};

function Config(db) {
    Config.super_.call(this, db);
    var self = this;
    this.config = {};

    var loadConfig = function() {
        db.get('cdns:config', {}, function (err, body) {
            if (!err) {
                self.config = body;
                self.emit("configLoaded", self.config);
            } else {
                self.emit("error", new Error('Error from Database while fetching configuration : ' + err));
            }
        });
    };

    var monitorConfig = function() {
        // Monitor the database for changes to config
        var feed = db.follow({since: 'now', filter: 'config/all'});
        feed.on('change', function (change) {
            errorlog.info('Config was updated: ' + JSON.stringify(change));
            loadConfig();
        });

        feed.on('error', function(err) {
            self.emit('error', new Error('Lost connectivity with the DB changes feed for config : ' + err));
        })
        feed.follow();
    };

    // Create the DB docs if necessary, then load the config
    // and monitor for changes
    this.createDatabaseDocs(dbDocs, function (err) {
        if (err) {
            self.emit('error', new Error('Error whilst creating DB document for Config : ' + err));
        } else {
            loadConfig();
            monitorConfig();
        }
    });
}

util.inherits(Config, BaseDao);

Config.prototype.getVal = function (key) {
    return this.config[key];
}

module.exports = function (database) {
    return new Config(database);
};
