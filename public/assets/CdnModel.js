$(function() {
    var app = window.app = window.app || {};

    app.CDN = Backbone.Model.extend({
        idAttribute: '_id'
    });

    app.SupportedCDNs = Backbone.Collection.extend({
        model: app.CDN,
        url: app.baseUrl + '/cdns',
        comparator: 'defaultOrder'
    });
});