/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    async = require('async'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

function BaseDao(db) {
    this.db = db;
}

util.inherits(BaseDao, EventEmitter);
var proto = BaseDao.prototype;

proto.createDocument = function(doc, docId, callback) {
    var status_code_conflict = 409; // Means that the doc already exists

    this.db.insert(doc, docId, function (err) {
        if (err && err.status_code !== status_code_conflict) {
            errorlog.error('Error whilst creating document ' + docId);
            callback(err);
        } else {
            callback();
        }
    });
};

proto.createDatabaseDocs = function (dbDocs, callback) {
    var self = this;
    async.each(Object.keys(dbDocs), function (docId, cb) {
        self.createDocument(dbDocs[docId], docId, cb);
    }, callback);
};

proto.createOrReplaceDocument = function (doc, docId, callback) {
    var self = this;
    self.db.get(docId, {}, function (err, body) {
        // We must load the document to check its latest rev
        if (err && err.status_code != 404) {
            errorlog.error('Error getting latest doc revision for ' + docId + " : " + err);
            callback(err);
        } else {
            if (body && body._rev) {
                doc._rev = body._rev;
            }
            self.createDocument(doc, docId, callback);
        }
    });
};

proto.deleteDocument = function (docId, callback) {
    var self = this;
    self.db.get(docId, {}, function (err, body) {
        // We must load the document to check its latest rev
        if (err && err.status_code != 404) {
            errorlog.error('Error getting document ' + docId + " for delete : " + err);
            callback(err);
        } else {
            if (body) {
                self.db.destroy(body._id, body._rev, callback);
            } else {
                callback();
            }
        }
    });
};

module.exports = BaseDao;