var CdnConfigView = Backbone.View.extend({

    template: _.template($('#tplVelocixForm').html()),

    events: {
        "click #btnSaveCdn": "saveCdn"
    },

    initialize: function() {
        $('#content').html(this.$el);
        this.collection.fetch();
        this.model = this.collection.get('cdns:cdn:velocix');
        this.collection.on('sync', this.onCollectionSync, this);
    },

    close: function() {
        $('#errorBox,#successBox').hide();
        this.collection.off('sync', this.onCollectionSync, this);
        this.remove();
    },

    onCollectionSync: function() {
        this.model = this.collection.get('cdns:cdn:velocix');
        this.model.on('invalid', this.renderError, this);
        this.render();
    },

    render: function() {
        var sscsUrl = '';
        if (this.model) {
            var routingService = this.model.get('routingService');
            sscsUrl = 'http://' + routingService.host + ':' + routingService.port + routingService.path;
        }
        this.$el.html(this.template({ sscsUrl: sscsUrl }));
        return this;
    },

    renderError: function(model, err, options) {
        $('#successBox').hide();
        $('#errorBox p').text(err.toString());
        $('#errorBox').removeClass('hide');
        $('#errorBox').show();
        $('html, body').animate({
            scrollTop: 0
        }, 500);
    },

    saveCdn: function(e) {
        e.preventDefault();
        var self = this;
        var a = $('<a>', { href: $('#sscsUrl').val()})[0];
        var lookupService = {
            host: a.hostname,
            port: a.port,
            path: a.pathname
        };

        this.model.save({ lookupService: lookupService}, {
            wait: true,
            rowEl: this.options.rowEl,
            success: function(model, response, options) {
                var label = model.get('name') || model.get('_id');
                self.collection.add(model);
                $('#errorBox').hide();
                $('#successBox p').text('Distribution ' + label + ' was saved');
                $('#successBox').removeClass('hide');
                $('#successBox').show();
            },
            error: function(model, xhr, options) {
                self.renderError(model, 'Error whilst saving CDN config', options);
            }
        });
    },

});