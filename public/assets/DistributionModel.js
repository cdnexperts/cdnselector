$(function() {
    var app = window.app = window.app || {};

    app.Distribution = Backbone.Model.extend({
        idAttribute: '_id',
        url: app.baseUrl,

        defaults: function() {
            return {
                type: 'distribution',
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
                    if (provider.id === 'amazon' && _.isEmpty(provider.hostname)) {
                        err = 'You must specify a hostname for Amazon Cloudfront (or otherwise disable it)';
                    }

                    // If generic is enabled, a hostname must be specified
                    if (provider.id === 'generic' && _.isEmpty(provider.hostname)) {
                        err = 'You must specify a hostname for the Generic CDN (or otherwise disable it)';
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

        },

        sync: function (method, model, options) {

            if (method === 'create' || method === 'update') {
                var url = this.url;
                if (method === 'update') {
                    url += '/' + model.get('_id');
                }
                $.ajax({
                    url: url,
                    method: method === 'create' ? 'POST' : 'PUT',
                    data: JSON.stringify(model),
                    dataType: "json",
                    headers: {
                        'Content-type': 'application/json'
                    },
                    success: function (resp) {
                        options.success(resp);
                    }
                });
            } else if (method === 'delete') {
                $.ajax({
                    url: this.url + '/' + model.get('_id') + '?rev=' + model.get('_rev'),
                    method: 'DELETE',
                    success: function (resp) {
                        options.success(resp);
                    }
                });
            }
        },

        parse: function(response, options) {
            if (response.id && ! response._id) {
                response._id = response.id;
            }
            if (response.rev && ! response._rev) {
                response._rev = response.rev;
            }
            return response;
        }
    });

    app.Distributions = Backbone.Collection.extend({
        model: app.Distribution,
        url: app.baseUrl + '/_design/distributions/_view/all',

        sync: function (method, model, options) {
            if (method === 'read') {
                $.ajax({
                    url: this.url,
                    method: 'GET',
                    dataType: 'json',
                    success: function(dataObj) {
                        var resp = [];
                        for (var i = 0; i < dataObj.rows.length; i++) {
                            resp.push(dataObj.rows[i].value);
                        }
                        options.success(resp);
                    },
                    error: options.error
                });
            }
        }
    });
});