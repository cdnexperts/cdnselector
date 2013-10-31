/*jslint node: true */
"use strict";

// Script to create the database.
// If you forget to run this, the app will automatically do it anyway.
var conf = require('./config'),
    database = require('./lib/database');

(function main() {
    var configDir = process.env.VXCDNS_CONFIG_DIR || './config';
    database.getDatabase(conf.get('vxcdns:dbHost'), function (err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        console.log("Database created");
        process.exit(0);
    });
})();

