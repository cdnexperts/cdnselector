/*jslint node: true */
"use strict";

/**
 * Module dependencies.
 */

var express = require('express'),
    http = require('http'),
    path = require('path'),
    localConfig = require('./localConfig'),
    dbHelper = require('./database')(localConfig.dbUrl, localConfig.dbName),
    app = express();

function startup(startupCompleteCallback) {
    // all environments
    app.set('port', localConfig.consolePort);
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.methodOverride());
    app.use(express.basicAuth(localConfig.consoleUser, localConfig.consolePass));
    app.use(app.router);
    app.use(express.static(path.join(__dirname, '../public')));

    // development only
    if ('development' == app.get('env')) {
        app.use(express.errorHandler());
    }

    dbHelper.connect(function (err, database) {
        require('./routes/index')(app);
        require('./routes/distributions')(app, database);
        require('./routes/cdns')(app, database);
        http.createServer(app).listen(app.get('port'), function(){
          console.log('Console server listening on port ' + app.get('port'));
          startupCompleteCallback();
        });
    });
}

if (!process.env.CDNS_MANUAL_START) {
    startup(function() {});
}

// For Unit tests
module.exports = {
    startup: startup
}