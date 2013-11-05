$(function() {
    // For now this is just for Velocix CDn, but later it could be made more generic.
    var app = window.app = window.app || {};
    app.CdnConfigView = Backbone.View.extend({

        events: {
            "click #btnSaveCdn": "saveCdn"
        },

        initialize: function() {
            this.template = _.template(this.options.template);

            this.collection = new app.SupportedCDNs();
            this.collection.fetch();

            this.collection.on('sync', function() {
                this.model = this.collection.get('cdns:cdn:velocix');
                this.model.on('invalid', this.renderError, this);
                this.render();
            }, this);
        },

        render: function() {
            var sscsUrl = '';
            if (this.model) {
                var lookupService = this.model.get('lookupService');
                sscsUrl = 'http://' + lookupService.host + ':' + lookupService.port + lookupService.path;
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
                    $('html, body').animate({
                        scrollTop: 0
                    }, 500);
                },
                error: function(model, xhr, options) {
                    self.renderError(model, 'Error whilst saving CDN config', options);
                }
            });
        },

    });
});