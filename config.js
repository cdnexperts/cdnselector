/*jslint node: true */
"use strict";
var conf = require('nconf'),
    confFileDir = process.env.VXCDNS_CONFIG_DIR || './config';

// Load configuration
conf.overrides({});
conf.env('_').argv();
conf.file(confFileDir + '/config.json');
conf.defaults({
    "vxcdns": {
        "serverPort": 8888,
        "dbHost": "localhost:5984",
        "altoServiceUrl": "http://alto/directory",
        "altoRefreshIntervalSeconds": 60,
        "altoIgnorePids": ["ignore", "offnet"],
        "altoNetworkMapId": "default-network-map",
        "logger": {
            "level": "info",
            "accessLogRotationIntervalSeconds": 3600
        }
    }
});

module.exports = conf;