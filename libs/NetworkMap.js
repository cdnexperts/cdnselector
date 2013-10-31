/*jslint node: true */
"use strict";
var iptrie = require('iptrie'),
    http = require('http'),
    url = require('url'),
    errorlog = require('winston');


function NetworkMap(altoServiceUrl, refreshInterval, ignorePids, networkMapId) {
    var self = this,
        defaultRefreshInterval = 3600,
        lastNetworkMapVersion = '';

    this.altoServiceUrl = altoServiceUrl;

    function readJsonResponseBody (response, callback) {
        var data = '',
            obj;

        response.on('data', function (chunk) {
            data += chunk;
        });

        response.on('end', function () {
            try {
                obj = JSON.parse(data);
            } catch (e) {
                callback('Error parsing JSON response : ' + e + ' in response ' + data);
                return;
            }
            callback(null, obj);
        });

    }

    function parseAltoDirectory(directory, baseUrl, callback) {
        var networkMaps = [],
            exactMatch,
            resource,
            i,
            resolvedUrl;

        errorlog.debug('Parsing directory from ' + baseUrl);

        // If a network map id was specified we look for that. Otherwise just select the
        // first network map that we find.
        if (directory && directory.resources) {
            for (i = 0; i < directory.resources.length; i++) {
                resource = directory.resources[i];
                if (resource['media-type'] === 'application/alto-networkmap+json') {

                    if (networkMapId && resource.id === networkMapId) {
                        // Exact match for the network map id
                        resolvedUrl = url.resolve(baseUrl, resource.uri);
                        errorlog.debug('Found network map ' + networkMapId
                            + ' in directory at ' + resolvedUrl);

                        self.fetchNetworkMap(resolvedUrl, callback);
                        return;
                    }

                    if (!networkMapId) {
                        // No network map was specified, so pick the first one in the directory.
                        // (or should we grab all of them? to be checked)
                        resolvedUrl = url.resolve(baseUrl, resource.uri);
                        errorlog.debug('Selecting first network map in directory, which is '
                            + resource.id + ' at ' + resolvedUrl);

                        self.fetchNetworkMap(resolvedUrl, callback);
                        return;
                    }
                }

            }
            callback(new Error('No network maps found in the ALTO resource directory'));
        } else {
            callback(new Error('Invalid ALTO directory received (no resources section): '
                                + JSON.stringify(directory)));
        }
    }

    function parseAltoNetworkMap(networkMap, callback) {
        var pid,
            pids,
            newIpLookup;

        // Check if this has changed since last time we looked
        try {
            if (networkMapHasChanged(networkMap)) {

                if (networkMap.data && networkMap.data.map) {
                    errorlog.debug('Updating network map lookup');
                    newIpLookup = new iptrie.IPTrie();
                    pids = networkMap.data.map;
                    for (pid in pids) {
                        if (pids.hasOwnProperty(pid)) {
                            if (Array.isArray(ignorePids) && ignorePids.indexOf(pid) === -1) {
                                storeNetworkRanges(newIpLookup, pids[pid].ipv4, pid);
                                storeNetworkRanges(newIpLookup, pids[pid].ipv6, pid);
                            }
                        }
                    }
                    self.ipLookup = newIpLookup;
                } else {
                    throw new Error('Network map does not appear to be valid (expected a data.map section)');
                }
            }
        } catch (e) {
            callback(e);
        }
        callback();
    }

    function networkMapHasChanged(networkMap) {
        var versionTag,
            versionString = '';

        if (networkMap.data && networkMap.data['map-vtag']) {
            versionTag = networkMap.data['map-vtag'];
            versionString = versionTag['resource-id'] + versionTag['tag'];

            if (lastNetworkMapVersion !== versionString) {
                errorlog.info('Network map has changed. New version is ' + versionString);
                lastNetworkMapVersion = versionString;
                return true;
            } else {
                errorlog.debug('Network map has not changed. Version is still ' + versionString);
            }

        } else {
            throw new Error('Network map does not appear to be valid (expected a data.map-vtag section)');
        }
    }

    function storeNetworkRanges(ipLookup, ranges, pid) {
        var i,
            rangeTokens;

        if (ranges) {
            for (i = 0; i < ranges.length; i += 1) {
                errorlog.debug(ranges[i] + ' is on-net in pid ' + pid);
                rangeTokens = ranges[i].split('/');
                ipLookup.add(rangeTokens[0], parseInt(rangeTokens[1]), pid);
            }
        }
    }

    this.fetchNetworkMap = function (url, callback) {
        errorlog.info('Refreshing network map from ALTO service at : ' + url);

        http.get(url, function(response) {
            var contentType;

            response.setEncoding('utf8');

            // Check the request was successful
            if (response.statusCode < 200 || response.statusCode > 299) {
                callback(new Error('Non-2xx response code from ALTO server: '
                    + response.statusCode + ' from ' + url));
                return;
            }

            // The response could either be an Alto directory or a network map.
            contentType = response.headers['content-type'];
            if (contentType === 'application/alto-directory+json') {
                readJsonResponseBody(response, function (err, directory) {
                    if (err) {
                        callback(err);
                    } else {
                        parseAltoDirectory(directory, url, callback);
                    }
                });
            } else if (contentType === 'application/alto-networkmap+json') {
                readJsonResponseBody(response, function (err, netMap) {
                    if (err) {
                        callback(err);
                    } else {
                        parseAltoNetworkMap(netMap, callback);
                    }
                });
            } else {
                callback(new Error('Unknown content type returned from ALTO : ' + contentType));
            }

        }).on('error', callback);
    };

    this.loadAndMonitorNetworkMap = function (callback) {
        //TODO cache the network map in the database to allow startup even if ALTO is unreachable.
        this.fetchNetworkMap(altoServiceUrl, function (err) {
            if (err) {
                errorlog.error('Error while refreshing ALTO network map : ' + err);
                callback(err);
            } else {
                // We fetched ok first time, so set a timer to launch subsequent goes
                callback();
                setInterval(function () {
                    self.fetchNetworkMap(altoServiceUrl, function (err) {
                        if (err) {
                            errorlog.error('Error while refreshing ALTO network map : ' + err);
                        }
                    });
                }, (refreshInterval || defaultRefreshInterval) * 1000);
            }
        });
    };
}

var proto = NetworkMap.prototype;

proto.startMonitoring = function (callback) {
    this.loadAndMonitorNetworkMap(callback);
};


proto.refresh = function (callback) {
    // This is mostly useful for unit testing so we don't have
    // to wait for the scheduled refresh.
    this.fetchNetworkMap(this.altoServiceUrl, callback);
};

proto.addressIsOnNet = function (ipAddress) {
    if (!this.ipLookup) {
        errorlog.warn('Network address lookup made before the network map has loaded');
        return false;
    }
    return  this.ipLookup.find(ipAddress) ? true : false;
};

module.exports = NetworkMap;