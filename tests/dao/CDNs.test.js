/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('../TestUtil');

describe('CDNs', function () {
    it('should provide access to all CDNs', function (done) {
        var mockDb = {
            view: function (design, view, callback) {
                design.should.equal('cdns');
                view.should.equal('all');

                callback(null, {
                        "total_rows":2,
                        "offset":0,
                        "rows":[
                            {"id":"a","key":"velocix","value": "velocixVal"},
                            {"id":"b","key":"akamai","value": "akamaiVal"}
                        ]
                });
            },
            follow: function () {
                return {
                    on: function () {},
                    follow: function () {}
                }
            },
            insert: function (doc, docId, callback) {
                process.nextTick(callback);
            }
        };

        var cdns = require('../../libs/dao/CDNs')(mockDb);
        cdns.on('updated', function () {
            cdns.getById('velocix').toString().should.equal('velocix');
            cdns.getById('akamai').toString().should.equal('akamai');
            should.not.exist(cdns.getById('bogus'));
            done();
        });
        cdns.on('error', function (err) {
            should.not.exist(err);
            should.fail('Error callback unexpected');
        });

    });

    it('should handle errors', function (done) {
        var mockDb = {
            view: function (design, view, callback) {
                callback('someError');
            },
            follow: function () {
                return {
                    on: function () {},
                    follow: function () {}
                }
            },
            insert: function (doc, docId, callback) {
                process.nextTick(callback);
            }
        };

        var cdns = require('../../libs/dao/CDNs')(mockDb);
        cdns.on('updated', function (err) {
            should.fail('updated event should not be called');
        });
        cdns.on('error', function (err) {
            should.exist(err);
            done();
        });
    });

});