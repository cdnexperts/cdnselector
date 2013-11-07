/*jslint node: true */
"use strict";
var logger = require('winston');

module.exports = function (app, database) {
    var distribDao = require('../../libs/dao/DistributionDao')(database);

    app.get('/cdns/distributions', function (req, res){
        var distribs = distribDao.getAll(function (err, rows) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(rows));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error retrieving distributions');
                logger.error('Error while retrieving distributions', err);
            }
        });
    });

    app.put('/cdns/distributions/:id', function (req, res) {
        //TODO validation here!
        var distrib = req.body;

        distribDao.save(req.body, function (err, distribution) {
            if (!err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(distribution));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error saving distribution');
                logger.error('Error while saving distribution', err);
            }
        });
    });

    app.post('/cdns/distributions', function (req, res) {
        var distrib = req.body;

        distribDao.save(req.body, function (err, distribution) {
            if (!err) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(distribution));
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error saving distribution');
                logger.error('Error while saving distribution', err);
            }
        });
    });

    app.del('/cdns/distributions/:id', function (req, res) {
        distribDao.del(req.params.id, function (err) {
            if (!err) {
                res.writeHead(204);
                res.end();
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain'});
                res.end('Error deleting distribution');
                logger.error('Error while deleting distribution', err);
            }
        });
    });

};