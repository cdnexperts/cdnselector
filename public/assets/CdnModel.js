$(function() {
    var app = window.app = window.app || {};

    app.CDN = Backbone.Model.extend({
        idAttribute: '_id',
        url: app.baseUrl,

        parse: function(response, options) {
            console.log('CDN parse');
            if (response.id && ! response._id) {
                response._id = response.id;
            }
            if (response.rev && ! response._rev) {
                response._rev = response.rev;
            }
            console.log(response);
            return response;
        },

        sync: function (method, model, options) {
            console.log('Model sync ' + method + ' : ' + JSON.stringify(model));

            if (method === 'update') {
                var url = this.url;
                $.ajax({
                    url: this.url + '/' + model.get('_id'),
                    method: 'PUT',
                    data: JSON.stringify(model),
                    dataType: "json",
                    headers: {
                        'Content-type': 'application/json'
                    },
                    success: function (resp) {
                        options.success(resp);
                    }
                });
            }
        }
    });

    app.SupportedCDNs = Backbone.Collection.extend({
        model: app.CDN,
        url: app.baseUrl + '/_design/cdns/_view/all',
        comparator: 'defaultOrder',

        sync: function (method, model, options) {
            console.log('CDN Collection sync ' + method);
            if (method === 'read') {
                $.ajax({
                    url: this.url,
                    method: 'GET',
                    dataType: 'json',
                    success: function(couchDbList) {
                        var resp = [];
                        for (var i = 0; i < couchDbList.rows.length; i++) {
                            resp.push(couchDbList.rows[i].value);
                        }
                        options.success(resp);
                    },
                    error: options.error
                });
            }
        }
    });
});