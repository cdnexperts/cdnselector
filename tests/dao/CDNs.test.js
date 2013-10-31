/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('../TestUtil'),
    CDNs = require('../../libs/dao/CDNs');



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
            }
        };

        var cdns = new CDNs(mockDb);
        cdns.load(function (err) {
            should.not.exist(err);
            cdns.getById('velocix').toString().should.equal('velocix');
            cdns.getById('akamai').toString().should.equal('akamai');
            should.not.exist(cdns.getById('bogus'));
            done();
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
            }
        };

        var cdns = new CDNs(mockDb);
        cdns.load(function (err) {
            should.exist(err);
            done();
        });
    });

});