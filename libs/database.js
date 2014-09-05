/*jslint node: true */
"use strict";
var url = require('url'),
    logger = require('winston');


function createDatabase (nano, dbName, callback) {
    var db,
        status_code_already_exists = 412; // Means the DB already exists

    // Create the database
    nano.db.create(dbName, function (err) {
        if (!err || err.status_code === status_code_already_exists) {
            db = nano.use(dbName);
            if (!err) {
                logger.info('Created database ' + dbName);
            }
            callback();
        } else {
            callback(err);
        }
    });
}

module.exports = function (dbUrl, dbName) {
    var connection;

    return {
        connect: function (callback) {
            // Since couchdb runs a stateless server, we do not really need to connect in advance.
            // However, this is where we ensure that the database exists, and if not, create it.
            if (connection) {
                // We already have a 'connection'
                process.nextTick(function () {
                    callback(null, connection);
                });
            } else {
                var nano = require('nano')(dbUrl);
                createDatabase(nano, dbName, function (err) {
                    if (err) {
                        logger.warn(err);
                        callback(err);
                    } else {
                        connection = nano.use(dbName);
                        callback(null, connection);
                    }
                });
            }
        },
        destroy: function (callback) {
            var nano = require('nano')(dbUrl);
            nano.db.destroy(dbName, callback);
        }
    }
}
