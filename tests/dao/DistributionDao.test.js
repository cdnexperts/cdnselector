/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('../TestUtil'),
    Distributions = require('../../libs/dao/DistributionDao');



describe('Distributions', function () {

    it('should provide access to distributions by hostname', function (done) {
        var mockDb = {
            view: function (design, view, callback) {
                design.should.equal('distributions');
                view.should.equal('byHostname');

                callback(null, {
                        "total_rows":4,
                        "offset":0,
                        "rows":[
                            {"id":"a","key":"cdn.testhost.com","value":{ "id": "a"}},
                            {"id":"b","key":"cdn.testhost2.com","value":{ "id": "b"}},
                            {"id":"a","key":"www.testhost.com","value":{ "id": "a"}},
                            {"id":"b","key":"www.testhost2.com","value":{ "id": "b"}}
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

        var distribs = new Distributions(mockDb);
        distribs.on('ready', function (err) {
            distribs.getByHostname('www.testhost.com').id.should.equal('a');
            distribs.getByHostname('cdn.testhost2.com').id.should.equal('b');
            should.not.exist(distribs.getByHostname('missing.testhost2.com'));
            done();
        });
        distribs.on('error', function (err) {
            should.fail('error unexpected');
        });
    });

    it('should handle errors', function (done) {
        var mockDb = {
            view: function (desigm, view, callback) {
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

        var distribs = new Distributions(mockDb);
        distribs.on('ready', function () {
            should.fail('ready event unexpected');
        });

        distribs.on('error', function (err) {
            should.exist(err);
            done();
        });
    });

});