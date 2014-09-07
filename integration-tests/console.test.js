/*jslint node: true*/
/*global describe, it */
"use strict";

require('./integration-test-env');

var should = require('should'),
    console = require('../libs/console');


describe('console', function () {
    this.timeout(5000);
    describe('#startup', function () {
        it('should startup ok', function (done) {
            console.startup(function(err) {
                should.not.exist(err);
                done();
            })
        });
    });
});

