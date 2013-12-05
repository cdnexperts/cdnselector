/*jslint node: true */
"use strict";

var fs = require('fs'),
    errorlog = require('winston'),
    moment = require('moment'),
    os = require('os'),
    path = require('path');

function RequestLogger(rotationInterval, directory) {


    // Private members
    var self = this,
        rotationIntervalSeconds = 3600,  // Default 1 hour
        getFilename = function () {
            return path.normalize(directory + '/' +
                moment().utc().format('YYYYMMDD-HHmmSS') +
                '.p' + process.pid +
                '.cdns.access.log');
        },
        rotateLogs = function () {
            self.closeFile();
            self.createFile();
        };
    // End private functions

    // Protected
    self.isOpen = false;
    self.currentFile = getFilename();
    self.requestCount = 0;
    self.hostname = os.hostname();

    self.createFile = function () {
        var filename = getFilename(),
            header =
                '#Version: 1.0\n' +
                '#Fields: date time c-ip s-dns x-proto s-parser cs-resource ' +
                    's-resource sc-response-code sc-response x-preferred-cdn x-cdn ' +
                    'x-location cs-user-agent s-ip c-port\n' +
                '#Software: ' + global.appVersionString + '\n' +
                '#Start-Date: ' + moment().utc().format('YYYY-MM-DD HH:mm:ss') + '\n';


        fs.appendFile(filename, header, function (err) {
            if (err) {
                if (err.code === 'ENOENT') {
                    fs.mkdir(directory, function (err) {
                        if (!err) {
                            createFile();
                        } else {
                            errorlog.error("Cannot create log directory : " + err);
                        }
                    });
                } else {
                    errorlog.error("Cannot create request log : " + err);
                }
            } else {
                self.requestCount = 0;
                self.currentFile = filename;
                errorlog.info('Created new request log: ' + filename);
            }
        });
    };

    self.scheduleRotation = function () {
        setInterval(rotateLogs, rotationIntervalSeconds * 1000);
    };

    self.closeFile = function (sync) {
        var footer =
                '#End-Date: ' + moment().utc().format('YYYY-MM-DD HH:mm:ss') + '\n' +
                '#X-Records: ' + self.requestCount + '\n',
            oldFile = self.currentFile,
            msg = 'Finalized access log ' + oldFile + ' containing ' + self.requestCount + ' requests.';

        self.currentFile = undefined;


        if (sync) {
            fs.appendFileSync(oldFile, footer);
            errorlog.info(msg);
        } else {
            fs.appendFile(oldFile, footer, function (err) {
                if (err) {
                    errorlog.error('Error writing footer to log file ' + oldFile, err);
                } else {
                    errorlog.info(msg);
                }
            });
        }

    };
    // End Protected



}
var proto = RequestLogger.prototype;

proto.open = function() {
    // Create the first log and start regular rotation
    this.createFile();
    this.scheduleRotation();
    this.isOpen = true;
};

proto.log = function (xProto, cIp, csResource, sResource, scResponseCode, scResponse, preferredCdn, location, csUserAgent, sIp, cPort) {
    var self = this,
        sep = '\t',
        fillBlank = function (value) {
            return value || '-';
        };
    if (!self.isOpen) {
        self.open();
    }

    if (self.currentFile !== undefined) {

        var logLine = [
            moment().utc().format('YYYY-MM-DD\tHH:mm:ss.S'),  // date & time
            cIp, //c-ip
            self.hostname, // s-dns
            xProto, // x-proto
            global.appName, // s-parser
            csResource, // cs-resource
            sResource, // s-resource
            scResponseCode, // sc-status-code
            scResponse, // sc-resource
            fillBlank(preferredCdn), // x-preferred-cdn
            fillBlank(sResource), // x-cdn
            fillBlank(location), // x-location
            '"' + fillBlank(csUserAgent) + '"', //cs-user-agent
            sIp, // s-ip
            cPort + '\n'].join(sep); // c-port


        fs.appendFile(self.currentFile, logLine, function (err) {
            if (err) {
                errorlog.error('Cannot write to access log : ' + err);
            } else {
                self.requestCount += 1;
            }
        });
    }
};

proto.close = function () {
    if (this.isOpen) {
        this.closeFile(true);
    }
};

module.exports = RequestLogger;