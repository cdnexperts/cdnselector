/*jslint node: true */
"use strict";

var url = require('url'),
    errorlog = require('winston'),
    Cookies = require('cookies'),
    tokenCookieField = 'vxtoken',
    querystring = require('querystring'),
    crypto = require('crypto');

module.exports = {
    extractInboundToken: function (cdnList, request) {
        for (var i = 0; i < cdnList.length; i += 1) {
            // Ask each candidate CDN whether they recognise an inbound token in the request
            var inboundToken = cdnList[i].extractInboundToken(request);

            if (inboundToken && inboundToken.isPresent) {
                // We found a token, so stop searching
                inboundToken.cdn = { id: cdnList[i].id };
                errorlog.debug('Found an inbound token', inboundToken);
                return inboundToken;
            }
        }

        // Nothing found - assume there is no token on the request
        return {
            isPresent: false
        };
    }
}