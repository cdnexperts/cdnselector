/*jslint node: true */
"use strict";

var logger = require('winston');


// Error log
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    timestamp: true
});

require('./libs/altoFetcher.js');
require('./libs/console.js');