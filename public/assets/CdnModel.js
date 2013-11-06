var CDN = Backbone.Model.extend({
    idAttribute: '_id'
});

var SupportedCDNs = Backbone.Collection.extend({
    model: CDN,
    url: '/cdns/cdns',
    comparator: 'defaultOrder'
});
