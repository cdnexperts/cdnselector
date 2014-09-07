var CDN = Backbone.Model.extend({
    idAttribute: '_id',
    urlRoot: '/cdns/cdns',

    defaults: function() {
        return {
            name: '',
            type: 'cdns:cdn',
            driver: 'cdns:cdn:driver:generic',
            active: true
        }
    },
    validate: function(cdn, options) {
        try {
            check(cdn.name,
                'The CDN name must be letters and numbers only, '
              + 'and between 2 and 50 characters long').is(/^[\w\d\- ]+$/).len(2,50);

            check(cdn.driver, 'You must specify a CDN type').notEmpty();


            if (cdn.clientIpWhitelist) {
                console.log(cdn);
                if (cdn.clientIpWhitelist.manual) {
                    for (var i=0; i < cdn.clientIpWhitelist.manual.length; i++) {
                        var network = cdn.clientIpWhitelist.manual[i];
                        var message = network.network + '/' + network.prefix + ' is not a valid network address';

                        check(network.network, message).is(/^[0-9a-fA-F\.:]+$/);
                        check(network.prefix, message).isInt().min(0).max(64);
                    };
                }
            }

            if (cdn.altoService) {
                check(cdn.altoService.altoServiceUrl,
                    "You must provide a value for 'ALTO Service URL'"
                  + " in order to enable ALTO-managed whitelists").isUrl();

                check(cdn.altoService.refreshInterval,
                    "You must provide a value for 'Refresh Interval' between 10 and 100800 seconds"
                    + " in order to enable ALTO-managed whitelists").isInt().min(10).max(100800);

            }
        } catch (e) {
            return e;
        }
    }
});

var SupportedCDNs = Backbone.Collection.extend({
    model: CDN,
    url: '/cdns/cdns',
    comparator: 'defaultOrder'
});
