# CDN Selector

CDN Selector allows you to seemlessly switch between multiple CDNs. It is primarily aimed at HTTP-based streaming video services, but should work for any type of service that uses a CDN.

It supports:

* Load balancing - split your traffic between 2,3 or more CDNs. You decide how much traffic goes to each CDN.
* Backup CDN warming - send a small amount of traffic to your backup CDN in order to keep your content cached at the edge.
* Instant failover - switch traffic between CDNs instantly, in many cases without interuption to playback.
* Authentication Token conversion - CDN selector will automatically validate and convert authentication tokens/Signed URLs. Support multiple CDNs without any changes to your client.
* Routing based on the client's network - if you are an ISP you can use different CDNs for on-net and off-net customers. Whats more, CDN Selector can auto discover your network using an ALTO service.
* Direct-to-Edge routing. CDN Selector can send clients directly to their best-choice CDN edge server. This is currently only supported on Velocix CDNs.


## Which CDNs does it support?
The software has been tested against Akamai, Amazon Cloudfront, Rackspace CloudFiles and Velocix CDNs. It should also work with other CDNs, but some features such as authentication tokens will not be available.

## Which video services does it work with?
CDN Selector was designed for modern video streaming services such as Apple HLS, Adobe HDS and Microsoft Smooth Streaming. It should also work for progressive download, or in fact any service that uses HTTP to deliver content (video or otherwise).

It does not work with Flash RTMP streams, or any other non-HTTP delivery protocols.

## Future features
Features that may appear in future releases include:

* CDN selection based on the client's geographical location (e.g, direct USA based customers to one CDN, and European customers to another). This feature can also deny access to clients based on their location (i.e, GeoBlocking).
* CDN selection based on the availability and response times of content on each target CDN.
* Time of day based CDN selection. For example, during hours of low demand video content can be served directly from in-house CDN, or even direct from the origin servers. At peak hours, requests can be directed to a CDN.
* Demand based CDN selection. For example, if the number of requests per second exceeds a pre-set threshold, use CDN A, otherwise use CDN B.
* Content based CDN selection, where the URL path can be used to determine which CDN to use.
* Device based CDN selection, where the type of client device can be used to determine which CDN to use.
* Improved network location based routing policies using public databases to identify ISPs.

See the [feature backlog](https://github.com/cdnexperts/cdnselector/issues?labels=feature&page=1&state=open) for more details.

## Installation
Installation instructions are on the wiki at https://github.com/cdnexperts/cdnselector/wiki/Installation-Instructions

# More documentation
See the project wiki at : https://github.com/cdnexperts/cdnselector/wiki

# Changelog

## Release 0.5.0
* CDNS now allows the initial request to be signed with a token from any of the supported CDNs (Akamai, Velocix, Amazon Cloudfront). The token will be automatically converted to the format needed for the target CDN.
* Added support for Akamai tokens
* Added 'stickyness' to the load balancer. This is to support Flash player, which sends requests for relative links in the playlist via CDNS.
* Added integration test suite.

## Release 0.4.0
* Load balancing requests across multiple CDNs
* Improved admin GUI so it scales to more CDN providers (the previous design was limited by the width of the screen).
* Password protection of the Admin GUI (defaults to admin/admin)

## Release 0.3.0
* Initial open source release.
* Split the application into 2: a front-end and a back-end process. ALTO fetching and the Admin GUI moved into the backend process.
* The list of Operator's IP ranges is now expressed as an 'IP Whitelist', which is associated with each CDN.
* Model updated to allow use case where there are multiple on-net CDNs, each with their own ALTO service and Server-Side request router.
* The IP whitelist can be populated from the Admin GUI, ALTO or both
* Retired the config.js file. All configuration has moved into the admin GUI, or using environment variables.


