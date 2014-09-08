/*jslint node: true */
"use strict";

var http = require('http'),
	url = require('url'),
	util = require('util'),
    EventEmitter = require('events').EventEmitter,
    errorlog = require('winston'),
    Cookies = require('cookies'),
    localConfig = require('../localConfig');

function HttpServer(port, cdnSelector, requestLogger, tokenValidator) {
	var self = this;
	this.port = port;


	function sendRedirectionResponse(response, code, targetUrl, cdn) {

		// Set a Cookie on the response so in the next request we know
		// Which CDN was previouly used (stikyness). This is needed
		// because Flash player always sends requests back to the CDN selector.
		var urlPath = url.parse(targetUrl).path;
		var cookiePath = urlPath.substring(0, urlPath.lastIndexOf('/'));

		var expiryString = '';
		if (localConfig.stickySessionTimeoutSeconds) {
			var expires = new Date();
			expires.setTime(expires.getTime() + (localConfig.stickySessionTimeoutSeconds * 1000));
			expiryString = '; Expires=' + expires.toUTCString()
		}

		var headers = {
			'Content-Type': 'text/plain',
			'Location': targetUrl,
			'Set-Cookie': 'CDN=' + cdn.id + '; Path=' + cookiePath + expiryString
		};

		response.writeHead(code, headers);
		response.end();
	}

	function sendErrorResponse(response, code, descr) {
		var headers = {
			'Content-Type': 'text/plain',
		};
		response.writeHead(code, headers);
		response.end(descr);
	}

	function sendCrossDomainResponse(response) {
		response.writeHead(200, { 'Content-Type': 'text/xml' });
		response.end('<?xml version="1.0"?><!DOCTYPE cross-domain-policy SYSTEM '
			+ '"http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd"><cross-domain-policy>'
			+ '<allow-access-from domain="*"/><allow-http-request-headers-from domain="*" headers="*"/>'
			+ '</cross-domain-policy>');
		return;
	}


	function selectSurrogateFromAvailableCdns(cdnList, request, response, preferredCdn, distrib, inboundToken) {

		var cdn = cdnList.shift(),
			remoteAddress = request.connection.remoteAddress,
			localAddress = request.connection.localAddress,
			remotePort = request.connection.remotePort,
			code;

		cdn.selectSurrogate(request, inboundToken, function (err, requestUrl, targetUrl, location) {

			if (err || !targetUrl) {
				// There was an error whilst determining the CDN surrogate to use
				// , or the CDN is currently not able to serve this request
				// Are there any others in the list that can be used instead?
				if (cdnList.length > 0) {
					selectSurrogateFromAvailableCdns(cdnList, request, response, preferredCdn, distrib, inboundToken);
				} else {
					// No CDNs available
					code = 503;
					sendErrorResponse(response, code, 'Service Unavailable');

					// Log this error in the access log
					requestLogger.log(
						'http',
						remoteAddress,
						requestUrl,
						'-',
						code,
						'-',
						preferredCdn.toString(),
						'-',
						request.headers['user-agent'],
						localAddress,
						remotePort
					);
					// error log
					errorlog.error('No CDNs available to route this request : ' + requestUrl);
				}
			} else {
				// The CDN provided a surrogate for us to redirect the client to
				code = 302;
				sendRedirectionResponse(response, code, targetUrl, cdn);
				self.emit('redirection', cdn, distrib);

				requestLogger.log(
					'http',
					remoteAddress,
					requestUrl,
					cdn.toString(),
					code,
					targetUrl,
					preferredCdn.toString(),
					location,
					request.headers['user-agent'],
					localAddress,
					remotePort
				);
			}
		});
	}

	this.server = http.createServer(function (request, response) {

		// To keep flash player happy we will directly answer requests for the crossdomain.xml file
		// (it doesn't allow redirects on this)
		if (request.url == '/crossdomain.xml') {
			sendCrossDomainResponse(response);
			return;
		}

		if (!request.connection.remoteAddress) {
			errorlog.error("Undefined remote address on request");
			response.writeHead(500);
			response.end();
			return;
		}

		var clientIp = request.connection.remoteAddress,
			hostname = request.headers.host.split(":")[0],
			stickyCdnHint,
			cdnSelection;

		// The client might send a Cookie requesting to stick to a particular CDN
		if (request.headers.cookie) {
			stickyCdnHint = new Cookies(request, null).get('CDN');
			errorlog.debug("Client requested to stick to " + stickyCdnHint);
		}

		// Ask the CDN Selector for a list of candidate CDNs
		cdnSelection = cdnSelector.selectNetworks(clientIp, hostname, stickyCdnHint);

		if (cdnSelection.cdns && cdnSelection.cdns.length > 0) {
			// Search for a token in the inbound request
			// All candidate CDNs will be asked
			var inboundToken = tokenValidator.extractInboundToken(cdnSelector.getAllCDNs(), request);
			if (inboundToken && inboundToken.isPresent && !inboundToken.isValid) {
				code = 401;
				sendErrorResponse(response, code, 'Unauthorized');

				// Log this error in the access log
				requestLogger.log(
					'http',
					clientIp,
					'http://' + hostname + request.url,
					'-',
					code,
					'-',
					cdnSelection.cdns[0].toString(),
					'-',
					request.headers['user-agent'],
					request.connection.localAddress,
					request.connection.remotePort
				);
				// error log
				errorlog.info('Invalid authentication for request : http://' + hostname + request.url);
			} else {
				selectSurrogateFromAvailableCdns(cdnSelection.cdns, request, response, cdnSelection.cdns[0], cdnSelection.distribution, inboundToken);
			}
		} else {
			var code = 503;
			sendErrorResponse(response, code, 'Service Unavailable');

			// Log this error in the access log
			requestLogger.log(
				'http',
				clientIp,
				'http://' + hostname + request.url,
				'-',
				code,
				'-',
				'-',
				'-',
				request.headers['user-agent'],
				request.connection.localAddress,
				request.connection.remotePort
			);
			// error log
			errorlog.error('No active providers are configured for this hostname : ' + hostname);
		}

	});
}

util.inherits(HttpServer, EventEmitter);

HttpServer.prototype.start = function () {
	var self = this;
	self.server.listen(self.port, function () {
		self.port = self.server.address().port;
		self.emit('ready', self.port);
	});
};

module.exports = HttpServer;