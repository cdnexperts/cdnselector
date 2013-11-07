/*jslint node: true */
"use strict";
var errorlog = require('winston'),
    async = require('async'),
    util = require('util'),
    uuid = require('node-uuid'),
    EventEmitter = require('events').EventEmitter;

function BaseDao(db, designDoc, typeString) {
    this.db = db;
    this.designDoc = designDoc;
    this.typeString = typeString;
}

util.inherits(BaseDao, EventEmitter);
var proto = BaseDao.prototype;

proto.createDocument = function(doc, docId, callback) {
    var status_code_conflict = 409; // Means that the doc already exists
    doc.type = this.typeString;

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

proto.del = function (docId, callback) {
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

proto.fetch = function (docId, callback) {
    this.db.get(docId, {}, callback);
};

proto.save = function (doc, callback) {
    var self = this;
    // Force the type
    doc.type = this.typeString;

    if (!doc._id) {
        doc._id = self.typeString + ':' + uuid.v4();
    }
    this.db.insert(doc, doc._id, function (err) {
        if (err) {
            callback(err);
        } else {
            self.db.get(doc._id, {}, callback);
        }
    });
};

proto.getAll = function (callback) {
    this.db.view(this.designDoc, 'all', function (err, body) {
        if (err) {
            callback(err);
            return;
        }
        var rows = [];
        if (body.rows) {
            body.rows.forEach(function (row) {
                rows.push(row.value);
            });
        }
        callback(null, rows);
    });
};

module.exports = BaseDao;