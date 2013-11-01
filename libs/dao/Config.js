/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

function Config(db) {
    var self = this;
    this.config = {};

    var loadConfig = function() {
        db.get('cdns:config', {}, function (err, body) {
            if (!err) {
                self.config = body;
                self.emit("configChanged", self.config);
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

    loadConfig();
    monitorConfig();
}

util.inherits(Config, EventEmitter);

Config.prototype.getVal = function (key) {
    return this.config[key];
}

module.exports = Config;
