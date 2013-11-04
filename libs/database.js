/*jslint node: true */
"use strict";
var url = require('url'),
    errorlog = require('winston');


function createDatabase(nano, dbName, callback) {
    var db,
        status_code_already_exists = 412; // Means the DB already exists

    // Create the database
    nano.db.create(dbName, function (err) {
        if (!err || err.status_code === status_code_already_exists) {
            db = nano.use(dbName);
            if (!err) {
                errorlog.info('Created database ' + dbName);
            }
            callback();
        } else {
            callback(err);
        }
    });
}

module.exports = function (dbUrl) {
    var connection;

    return {
        connect: function (callback) {
            var dbName = 'cdns3';

            if (connection) {
                process.nextTick(function () {
                    callback(null, connection);
                });
            } else {
                var nano = require('nano')(dbUrl);
                createDatabase(nano, dbName, function (err) {
                    if (err) {
                        errorlog.warn(err);
                        callback(err);
                    } else {
                        connection = nano.use(dbName);
                        callback(null, connection);
                    }
                });
            }
        }
    }
}
