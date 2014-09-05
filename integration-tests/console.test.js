/*jslint node: true*/
/*global describe, it */
"use strict";

process.env.CDNS_LOG_LEVEL = 'debug';
process.env.CDNS_DB_NAME = 'cdns-integration-test';
process.env.CDNS_MANUAL_START = true;
process.env.CDNS_CONSOLE_PORT = 4000;

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

