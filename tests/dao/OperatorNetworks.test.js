/*jslint node: true*/
/*global describe, it */
"use strict";
var should = require('should'),
    testUtil = require('../TestUtil'),
    OperatorNetworks = require('../../libs/dao/OperatorNetworks'),
    mockDb = {
        view: function (design, view, callback) {
            design.should.equal('operatorNetwork');
            view.should.equal('ipRangeList');

            callback(null, {
                    "total_rows":4,
                    "offset":0,
                    "rows":[
                        {"id": "a", "key": null, "value": { "network": "0.0.0.0", "prefix": 32}},
                        {"id": "a", "key": null, "value": { "network": "192.168.0.0", "prefix": 27}},
                        {"id": "a", "key": null, "value": { "network": "2.0.0.0", "prefix": 7}}
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



describe('OperatorNetworks', function () {

    it('should return true for on-net addresses', function (done) {

        var opNets = new OperatorNetworks(mockDb);
        opNets.load(function (err) {
            opNets.addressIsOnNet('192.168.0.1').should.equal(true);
            opNets.addressIsOnNet('0.0.0.0').should.equal(true);
            opNets.addressIsOnNet('3.3.4.5').should.equal(true);
            done();
        });
    });
    it('should return false for off-net addresses', function (done) {
        var opNets = new OperatorNetworks(mockDb);
        opNets.load(function (err) {
            opNets.addressIsOnNet('192.168.0.199').should.equal(false);
            opNets.addressIsOnNet('0.0.0.1').should.equal(false);
            done();
        });
    });
});