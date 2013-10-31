/*jslint node: true */
"use strict";

var http = require('http'),
	url = require('url'),
	util = require('util'),
    EventEmitter = require('events').EventEmitter,
    errorlog = require('winston');

function HttpServer(port, cdnSelector, requestLogger) {
	this.port = port;


	function sendRedirectionResponse(response, code, targetUrl) {
		var headers = {
			'Content-Type': 'text/plain',
			'Location': targetUrl
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


	function selectSurrogateFromAvailableCdns(cdnList, request, response, preferredCdn) {

		var cdn = cdnList.shift(),
			remoteAddress = request.connection.remoteAddress,
			localAddress = request.connection.localAddress,
			remotePort = request.connection.remotePort,
			code;


		cdn.selectSurrogate(request, function (err, requestUrl, targetUrl, location, authOk) {

			if (!authOk) {
				code = 401;
				sendErrorResponse(response, code, 'Unauthorized');

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
				errorlog.info('Invalid authentication for request : ' + requestUrl);

			} else if (err || !targetUrl) {
				// There was an error whilst determining the CDN surrogate to use
				// , or the CDN is currently not able to serve this request
				// Are there any others in the list that can be used instead?
				if (cdnList.length > 0) {
					selectSurrogateFromAvailableCdns(cdnList, request, response, preferredCdn);
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
				sendRedirectionResponse(response, code, targetUrl);

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

		if (!request.connection.remoteAddress) {
			errorlog.error("Undefined remote address on request");
			response.writeHead(500);
			response.end();
			return;
		}
		var clientIp = request.connection.remoteAddress,
			hostname = request.headers.host.split(":")[0],
			cdnList = cdnSelector.selectNetworks(clientIp, hostname);

		if (cdnList && cdnList.length > 0) {
			selectSurrogateFromAvailableCdns(cdnList, request, response, cdnList[0]);
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