/*jslint node: true */
"use strict";

var url = require('url'),
    errorlog = require('winston'),
    tokenValidator = require('../tokenValidator'),
    util = require('util'),
    BaseCDN = require('./BaseCDN');

function GenericOttCDN(id, config, distribs) {
    GenericOttCDN.super_.call(this, id, config, distribs);
}

util.inherits(GenericOttCDN, BaseCDN);

module.exports = GenericOttCDN;