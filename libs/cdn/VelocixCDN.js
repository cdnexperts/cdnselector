/*jslint node: true */
"use strict";

var url = require('url'),
    http = require('http'),
    errorlog = require('winston'),
    Cookies = require('cookies'),
    util = require('util'),
    BaseCDN = require('./BaseCDN');


function VelocixCDN(id, config, distribs) {
    VelocixCDN.super_.call(this, id, config, distribs);
    this.sscsEndpoint = config.routingService;
    this.id = id;
    this.config = config;
    this.distribs = distribs;

    this.copyCookieTokenToQueryString = function(url, request, distribution) {
        var token;

        if (request.headers.cookie) {
            if (distribution.authParam) {
                token = new Cookies(request, null).get('vxtoken');
                if (token) {
                    if (url.indexOf('?') === -1) {
                        url += '?' + distribution.authParam + '=' + token;
                    } else {
                        url += '&' + distribution.authParam + '=' + token;
                    }
                }
            }
        }
        return url;
    };
}
util.inherits(VelocixCDN, BaseCDN);
var proto = VelocixCDN.prototype;

proto.selectSurrogate = function (clientRequest, callback) {
    var self = this,
        reqHost = clientRequest.headers.host.split(":")[0],
        reqUrlRaw = 'http://' + reqHost + clientRequest.url,
        reqUrl = encodeURIComponent(reqUrlRaw),
        clientIp = clientRequest.socket.remoteAddress,
        velocixRequest;

    if (!this.sscsEndpoint) {
        // Server-side cache selection is not configured.
        // Use the BaseCDN implementation to ensure that this is treated like any other CDN.
        errorlog.debug('SSCS is disabled, so using  BaseCDN to handle request');
        VelocixCDN.super_.prototype.selectSurrogate.call(this, clientRequest, callback);
        return;
    }


    var requestOptions = {
        host: this.sscsEndpoint.host,
        port: this.sscsEndpoint.port,
        path: this.sscsEndpoint.path + '?cs-uri=' + reqUrl + '&c-ip=' + clientIp + '&numcaches=1'
    };
    errorlog.debug('Using SSCS to resolve redirection target', requestOptions);


    // Query the Velocix SSCSv2 API to see where it would like us to send this request.
    http.get(requestOptions, function (velocixResponse) {
        var data = '';
        velocixResponse.setEncoding('utf8');


        if (velocixResponse.statusCode !== 200) {
            errorlog.error(
                'Non-OK response code returned from Velocix Cache Selection API (SSCSv2) : ' + velocixResponse.statusCode,
                requestOptions
            );
            callback(new Error(velocixResponse.statusCode + ' HTTP status code in response from Velocix'), reqUrlRaw, null, null, true);
            return;
        }

        velocixResponse.on('data', function (chunk) {
            data += chunk;
        });

        // Handle responses from the Velocix request Router
        velocixResponse.on('end', function () {
            // Attempt to parse the JSON response from Velocix
            var routingResponse = null,
                targetUrl = null,
                location = null;
            try {
                routingResponse = JSON.parse(data);
            } catch (e) {
                callback(new Error('Could not parse JSON response from Velocix'), reqUrlRaw, null, null, true);
                errorlog.warn('This response from Velocix SSCSv2 does not appear to be JSON: ' + data, e);
                return;
            }

            // JSON was parsed ok, but can we access the fields we need?
            if (routingResponse !== null) {

                if (routingResponse.http !== undefined &&
                        routingResponse.http.length > 0 &&
                        routingResponse.http[0] !== undefined &&
                        routingResponse.http[0]['http.ip'] !== undefined &&
                        routingResponse.http[0]['http.ip'].length > 0) {

                    targetUrl = routingResponse.http[0]['http.ip'][0];

                }

                if (routingResponse.selectioncriteria !== undefined &&
                        routingResponse.selectioncriteria['x-location'] !== undefined &&
                        routingResponse.selectioncriteria['x-location'].length > 0) {

                    location = routingResponse.selectioncriteria['x-location'].join(',');
                }


                //TODO we could cache responses from Velocix here
            }
            if (targetUrl !== null) {
                // Was there a Cookie-based token on the inbound request?
                // If so, it should be moved to the querystring
                var distribution = self.distribs.getByHostname(reqHost);
                if (distribution) {
                    targetUrl = self.copyCookieTokenToQueryString(targetUrl, clientRequest, distribution);
                }

                callback(null, reqUrlRaw, targetUrl, location, true);
            } else {
                // Couldn't find a http.ip field in the response. Assume its unavailable
                callback(null, reqUrlRaw, null, null, true);
                errorlog.info("Velocix did not provide a http surrogate for this request.", routingResponse);
            }
        });
    }).on('error', function (error) {
        callback(error, reqUrlRaw, null, null, true);
        errorlog.warn('Error connecting to Velocix SSCSv2 service', requestOptions, error);
    });

    return this;
};

module.exports = VelocixCDN;