/*jslint node: true */
"use strict";

module.exports = exports = function (app) {
    app.get('/', function (req, res) {
        res.sendfile('index.html', {root: './public'});
    });
};