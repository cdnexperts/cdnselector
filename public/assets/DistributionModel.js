var Distribution = Backbone.Model.extend({
    idAttribute: '_id',
    urlRoot: '/cdns/distributions',

    defaults: function() {
        return {
            type: 'cdns:distribution',
            hostnames: [],
            providers: [],
            authParam: '',
            authSecrets: []
        }
    },

    validate: function(attrs, options) {

        // There must be a name
        if (_.isEmpty(attrs.name)) {
            return "You must specify a name";
        }

        // There must be at least one hostname
        if (!attrs.hostnames || !attrs.hostnames.length > 0 || _.isEmpty(attrs.hostnames[0])) {
            return "You must specify at least one hostname";
        }

        // Examine each provider
        var activeProviderFound = false;
        var err;
        attrs.providers.forEach(function(provider) {
            if (provider.active) {
                activeProviderFound = true;

                // If cloudfront is enabled, a Hostname must be specified
                if (provider.driver === 'cdns:cdn:driver:amazon' && _.isEmpty(provider.hostname)) {
                    err = 'You must specify a hostname for ' + provider.name + ' (or otherwise disable it)';
                }

                // If generic is enabled, a hostname must be specified
                if (provider.driver === 'cdns:cdn:driver:generic' && _.isEmpty(provider.hostname)) {
                    err = 'You must specify a hostname for the ' + provider.name + ' (or otherwise disable it)';
                }
            }
        });
        if (err) {
            return err;
        }

        // At least one provider must be active
        if (!activeProviderFound) {
            return "You must enable at least one CDN provider";
        }

    }
});

var Distributions = Backbone.Collection.extend({
    model: Distribution,
    url: '/cdns/distributions'
});