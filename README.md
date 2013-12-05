# CDN Selector

CDN Selector allows you to optimize the online delivery of video and other content using multiple CDNs.

Policies can be defined for each service to allow:

* CDN selection based on the client's network location (e.g, direct on-net clients to your in-house CDN, and all others to a global CDN provider such as Akamai)
* Integration with CDN routing engines to provide the client with direct access to the most suitable CDN cache. This increases performance for the client by avoiding a DNS lookup or HTTP redirection via the routing engine.
* Failover to a backup CDN in the event that the primary CDN is unavailable or too busy to serve. This can allow the capacity of your in-house CDN to be augmented by that of a global CDN in times of peak demand.
* Real-time control over CDN selection - at the flick of a switch traffic can be directed to an alternative CDN. This can be used to ensure service continuity in the event of a CDN failure, or as a tool to aid migration to a new CDN provider.
* Secured access to content using Token Authentication. Inbound requests can be authenticated to ensure that the content is being requested by an authorized user. CDN Selector automatically generates the appropriate token format for the target CDN.
* Load Balancing traffic  across multiple CDNs (e.g, 50% traffic to CDN A, 30% to CDN B, and 20% to CDN C). This can also be used to keep content 'fresh' in your backup CDN by sending a small number of requests in the event of failover.


Features that may appear in future releases include:

* CDN selection based on the client's geographical location (e.g, direct USA based customers to one CDN, and European customers to another). This feature can also deny access to clients based on their location (i.e, GeoBlocking).
* CDN selection based on the availability and response times of content on each target CDN.
* Time of day based CDN selection. For example, during hours of low demand video content can be served directly from in-house CDN, or even direct from the origin servers. At peak hours, requests can be directed to a CDN.
* Demand based CDN selection. For example, if the number of requests per second exceeds a pre-set threshold, use CDN A, otherwise use CDN B.
* Content based CDN selection, where the URL path can be used to determine which CDN to use.
* Device based CDN selection, where the type of client device can be used to determine which CDN to use.
* Improved network location based routing policies using public databases to identify ISPs.

See the [feature backlog](https://github.com/tonyshearer/cdnselector/issues?labels=feature&page=1&state=open) for more details.

## Installation
Installation instructions are on the wiki at https://github.com/tonyshearer/cdnselector/wiki/Installation-Instructions

# More documentation
See the project wiki at : https://github.com/tonyshearer/cdnselector/wiki

# Changelog

## Release 0.4.0
* Load balancing requests across multiple CDNs
* Improved admin GUI so it scales to more CDN providers (the previous design was limited by the width of the screen).
* Password protection of the Admin GUI (defaults to admin/admin)

## Release 0.3.0
* Made the project generic for open source release.
* Split the application into 2: a front-end and a back-end process. ALTO fetching and the Admin GUI moved into the backend process.
* The list of Operator's IP ranges is now expressed as an 'IP Whitelist', which is associated with each CDN.
* Model updated to allow use case where there are multiple on-net CDNs, each with their own ALTO service and Server-Side request router.
* The IP whitelist can be populated from the Admin GUI, ALTO or both
* Retired the config.js file. All configuration has moved into the admin GUI, or using environment variables.


