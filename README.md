# CDN selector

CDN Selector allows you to optimize the online delivery of video and other content using multiple CDNs.

CDN selection policies can be defined for each service to allow:

* CDN selection based on the client's network location (e.g, direct on-net clients to your in-house CDN, and all others to a global CDN provider such as Akamai)
* Integration with CDN routing engines to provide the client with direct access to the most suitable CDN cache. This increases performance for the client by avoiding a DNS lookup or HTTP redirection via the routing engine.
* Failover to a backup CDN in the event that the primary CDN is unavailable or too busy to serve. This can allow the capacity of your in-house CDN to be augmented by that of a global CDN in times of peak demand.
* Real-time control over CDN selection - at the flick of a switch traffic can be directed to an alternative CDN. This can be used to ensure service continuity in the event of a CDN failure, or as a tool to aid migration to a new CDN provider.
* Secured access to content using Token Authentication. Inbound requests can be authenticated to ensure that the content is being requested by an authorized user. CDN Selector automatically generates the appropriate token format for the target CDN.


Features that may appear in future releases include:

* CDN selection based on the client's geographical location (e.g, direct USA based customers to one CDN, and European customers to another). This feature can also deny access to clients based on their location (i.e, GeoBlocking).
* CDN selection based on the availability and response times of content on each target CDN.
* Time of day based CDN selection. For example, during hours of low demand video content can be served directly from in-house CDN, or even direct from the origin servers. At peak hours, requests can be directed to a CDN.
* Traffic sharing across multiple CDNs (e.g, 50% traffic to CDN A, 30% to CDN B, and 20% to CDN C). This can also be used to keep content 'fresh' in your backup CDN by sending a small number of requests in the event of failover.
* Demand based CDN selection. For example, if the number of requests per second exceeds a pre-set threshold, use CDN A, otherwise use CDN B.
* Content based CDN selection, where the URL path can be used to determine which CDN to use.
* Device based CDN selection, where the type of client device can be used to determine which CDN to use.
* Improved network location based routing policies using public databases to identify ISPs.

See the [feature backlog](https://github.com/tonyshearer/cdnselector/issues?labels=feature&page=1&state=open) for more details.

## Quick start
This will get you up and running in an environment suitable for development and testing. 

The instructions here are for Ubuntu 12.4, but can quite easily be adapted for other OSes.

You will need:
* Any operating system capable of running Node.js and CouchDB (Windows, Linux, OS X, etc).
* Node.js (0.10.15 or later) - http://nodejs.org/download/
* CouchDB (1.3.0 or later) - http://couchdb.apache.org/
* Git

####1) Install Node.js 
Or alternatively, get it from here: http://nodejs.org/download/.

```
sudo apt-get install build-essential
curl http://nodejs.org/dist/node-latest.tar.gz | tar zxvf -
cd node-*
./configure
make
sudo make install
node -v
cd ..
```

####2) Install and start CouchDB:
For Mac OS X and Windows you can download binaries from http://couchdb.apache.org/. For Linux your best option is usually to download and build from source:

```
sudo apt-get install -y g++ erlang-dev erlang-manpages erlang-base-hipe erlang-eunit erlang-nox erlang-xmerl erlang-inets libmozjs185-dev libicu-dev libcurl4-gnutls-dev libtool
curl http://www.mirrorservice.org/sites/ftp.apache.org/couchdb/source/1.5.0/apache-couchdb-1.5.0.tar.gz | tar zxvf -
cd apache-couchdb-*
./configure
make
sudo make install
cd ..
sudo ln -s /usr/local/etc/logrotate.d/couchdb /etc/logrotate.d/couchdb
sudo ln -s /usr/local/etc/init.d/couchdb  /etc/init.d
sudo update-rc.d couchdb defaults
sudo useradd -d /usr/local/var/lib/couchdb couchdb
sudo chown -R couchdb: /usr/local/var/lib/couchdb /usr/local/var/run/couchdb /usr/local/var/log/couchdb
sudo sed -i '/^\[admins\]$/a admin = cdnsadmin'  /usr/local/etc/couchdb/local.ini
```
You can change the admin password for the database if necessary, but you will need to make sure that you make the corresponding change in the CDNS config (we'll get to that shortly).

If you want to get access to the CouchDB server from anywhere other than localhost (such as for troubleshooting or a distributed deployment), you should also run the command:

```
sudo sed -i '/^\[httpd\]$/a bind_address = 0.0.0.0'  /usr/local/etc/couchdb/local.ini
```

Finally, start couchdb using the command:

```
sudo service couchdb start
```

If you want a quick and easy way to get running with CouchDB, you could also try the free hosted service at http://www.iriscouch.com/.


####3) Clone the repo and download dependencies
```
git clone https://github.com/cdnexperts/cdnselector.git
cd cdnselector
npm install
```

####4) Start the CDNS processes
Note that there are 2 processes - the `cdns-backend.js` which takes care of the Admin console and other backend services. Then there's the `cdns-frontend.js` which handles requests from end-users. These are seperate because a typical deployment would consist of many cdn-frontend instances, with only 1 or 2 cdns-backends to manage the service.

```
node cdns-backend.js &
node cdns-frontend.js &
```

The admin console can then be accessed in your browser at http://localhost:3000/ (replacing localhost with your server's hostname or IP if necessary).

End-users can access the service on port 8888, but see below for instructions on how to use port 80 instead.

If you would like to alter any of the default settings, such as the database connection details (did you change the DB admin password in step 2?) then you can do this by setting environment variables. For example, to set the database URL & login:

```
CDNS_DB_URL=http://admin:newpassword@localhost:5984/cdns node cdns-frontend.js
```
If you have a few settings you can include these in a shell script. The full set of environment variables are listed below. 

# Configuration
Most of the configuration of CDNS takes place centrally in the admin console. However, there are a few deployment settings that are configured on a server-by-server basis using environment variables.

It is optional whether you set these environment variables. If unset, then the default values will be used.

| Environment Variable       | Description | Default Value |
|----------------------------|-------------|---------------|  
| CDNS_DB_URL                | The URL used to connect to the database, including username and password. | http://admin:cdnsadmin@localhost:5984 |
| CDNS_PORT                  | The port used by cdns-frontend to receive requests from end users. Note that on most Linux platforms if you set this to less than 1024 you will need to start the app as root using sudo (it will setuid back to the original user after binding to the port). | 8888 |
| CDNS_CONSOLE_PORT          | The port used by cdns-backend to serve the admin console | 3000 |
| CDNS_LOG_LEVEL             | The level of operations log verbosity. Possible values are `error`, `warn`, `info`, `debug`. | info |
| CDNS_LOG_DIR               | The directory to write request logs to. This is only for request logs - operational logging is always direct to STDOUT | log |
| CDNS_LOG_ROTATION_INTERVAL | How frequently (in seconds) to open a new request log file. | 3600 |



#Operations

## Starting and stopping services
In a production environment it is recommended that you use a script such as forever to start, monitor and stop the cdns-*.js services. To install forever:

```
npm install -G forever
```

To start CDNS (assuming you want both the front-end and back-end running on this server):
```
forever start cdns-frontend.js
forever start cdns-backend.js
```

To monitor, use `forever list`:
```
info:    Forever processes running
data:        uid  command             script           forever pid   logfile                       uptime
data:    [0] lTyh /usr/local/bin/node cdns-frontend.js 73295   73296 /Users/tony/.forever/lTyh.log 0:0:0:38.36
data:    [1] P1ev /usr/local/bin/node cdns-backend.js  73303   73304 /Users/tony/.forever/P1ev.log 0:0:0:3.522
```

To stop, use `forever stopall`:
```
info:    Forever stopped processes:
data:        uid  command             script           forever pid   logfile                       uptime
data:    [0] lTyh /usr/local/bin/node cdns-frontend.js 73295   73296 /Users/tony/.forever/lTyh.log 0:0:4:5.725
data:    [1] P1ev /usr/local/bin/node cdns-backend.js  73303   73304 /Users/tony/.forever/P1ev.log 0:0:3:31.212
```

## Port usage & firewall Rules

The application listens for connections on the following ports by default, so you will need to ensure that any firewalls are configured accordingly:

Inbound connections:

|Port|Description|
|---|---|
|8888/tcp |	HTTP connections from end-user clients. You might want to redirect these via port 80 (see below) |
|3000/tcp | HTTP connections to the admin console |
|5984/tcp	| Private HTTP to the database server (CouchDB). If you are running everything on the same server you can leave this port closed and use the loopback interface. Otherwise you should probably restrict access only to the servers running cdns-frontend and cdns-backend |

### Binding to port 80
By convention most HTTP servers listen on port 80. However, it is not possible to bind to this port whilst running as a non-root user, so the application is configured to run on port 8888 by default. 

One solution is to configure iptables to forward all traffic on port 80 to port 8888. This can be achieved using a firewall rule like this:

```
iptables -A INPUT -i eth1 -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -i eth1 -p tcp --dport 8888 -j ACCEPT
iptables -A INPUT -i eth1 -p tcp --dport 3000 -j ACCEPT
iptables -A PREROUTING -t nat -i eth1 -p tcp --dport 80 -j REDIRECT --to-port 8888
```

Be sure to set the correct interface (eth0 or eth1?) for your environment.

You might also need to enable forwarding:

sysctl net.ipv4.conf.eth0.forwarding=1

#### Alternative solution
You can now start the application as root using sudo and have it setuid to an unprivliged user:

```
sudo CDNS_PORT=80 node cdns-frontend.js
```
All worker processes will run as the unprivliged user. However, the master process which is responsible for respawning workers will continue to operate as root.


# Changelog

## Release 0.3.0
* Made the project generic for open source release.
* Split the application into 2: a front-end and a back-end process. ALTO fetching and the Admin GUI moved into the backend process.
* The list of Operator's IP ranges is now expressed as an 'IP Whitelist', which is associated with each CDN.
* The IP whitelist can be populated from the Admin GUI, ALTO or both
* Retired the config.js file. All configuration has moved into the admin GUI, or using environment variables.


