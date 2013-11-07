/*jslint node: true */
"use strict";
var logger = require('winston');

module.exports = function (app, database) {
    var cdnDao = require('../../libs/dao/CDNDao')(database);

    app.get('/cdns/cdns', function (req, res){
        var cdns = cdnDao.getAll(function (err, rows) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify(rows));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error retrieving cdns');
                logger.error('Error while retrieving cdns', err);
            }
        });
    });

    app.put('/cdns/cdns/:id', function (req, res) {
        //TODO validation here!
        var cdns = req.body;

        cdnDao.save(cdns, function (err, cdn) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cdn));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error saving cdn');
                logger.error('Error while saving cdn', err);
            }
        });
    });
};