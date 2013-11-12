/*jslint node: true */
"use strict";
var logger = require('winston');

module.exports = function (app, database) {
    var cdnDao = require('../../libs/dao/CDNDao')(database);

    app.get('/cdns/cdns', function (req, res){
        var cdns = cdnDao.fetchAll(function (err, rows) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json'});
                res.end(JSON.stringify(rows));
            } else {
                res.writeHead(err.status_code || 500, { 'Content-Type': 'text/plain'});
                res.end('Error retrieving cdns');
                logger.error('Error while retrieving cdns', err);
            }
        });
    });

    app.put('/cdns/cdns/:id', function (req, res) {
        //TODO validation here!
        var cdn = req.body;

        cdnDao.save(cdn, function (err, cdn) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cdn));
            } else {
                res.writeHead(err.status_code || 500, { 'Content-Type': 'text/plain'});
                res.end('Error saving cdn');
                logger.error('Error while saving cdn', err);
            }
        });
    });

    app.post('/cdns/cdns', function (req, res) {
        var cdn = req.body;

        cdnDao.save(cdn, function (err, cdn) {
            if (!err) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(cdn));
            } else {
                res.writeHead(err.status_code || 500, { 'Content-Type': 'text/plain'});
                res.end('Error saving cdn');
                logger.error('Error while saving cdn', err);
            }
        });
    });

    app.del('/cdns/cdns/:id', function (req, res) {
        cdnDao.del(req.params.id, function (err) {
            if (!err) {
                res.writeHead(204);
                res.end();
            } else {
                res.writeHead(err.status_code || 500, { 'Content-Type': 'text/plain'});
                res.end('Error deleting cdn');
                logger.error('Error while deleting cdn', err);
            }
        });
    });
};