var CdnFormView = Backbone.View.extend({

    template:_.template($('#tplCdnForm').html()),

    events: {
        "click #btnSaveCdn": "save",
        "change select#driver": "setRoutingServiceVisibility"
    },

    initialize: function() {
        $('#content').html(this.$el);
        if (!this.model) {
            this.model = new CDN();
        }
        this.render();
        this.model.on('invalid', this.renderError, this);
    },

    close: function() {
        this.model.off('invalid', this.renderError, this);
        this.remove();
    },

    render: function() {
        var params = this.model.toJSON();

        // Bend the model slighly to simplify the form structure
        params.isNew = this.model.isNew();
        params.sscsUrl = '';
        if (params.routingService) {
            params.sscsUrl = 'http://'
                            + params.routingService.host
                            + ':'
                            + params.routingService.port
                            + params.routingService.path;
        }

        params.enableAlto = params.altoService ? true : false;
        params.altoService = params.altoService || { altoServiceUrl: null,
                                                    refreshInterval: 3600,
                                                    ignorePids: [],
                                                    networkMapId: null};
        params.clientIpWhitelist = params.clientIpWhitelist || { manual: [] };


        this.$el.html(this.template(params));
        this.setRoutingServiceVisibility();
        $('#ipWhitelistTabs', this.$el).tabs();
        return this;
    },

    renderError: function(model, err, options) {
        $('#successBox').hide();
        $('#errorBox p').text(err.toString());
        $('#errorBox').removeClass('hide');
        $('#errorBox').show();
        Utils.scrollToTop();
    },

    setRoutingServiceVisibility: function(e) {
        if ($("select#driver").val() === 'cdns:cdn:driver:velocix') {
            $("#sscsGroup").show(500);
        } else {
            $("#sscsGroup").hide(500);
        }
    },

    save: function(e) {
        e.preventDefault();
        var self = this;

        // Populate the model from the form
        var driver = $('#driver').val();
        this.model.set({
            name: $('#name').val(),
            driver: driver,
            active: $('#active:checked').length === 1
        });

        // Only pass the routing service if its a supported CDN (ie, just Velocix at the moment)
        if (driver === 'cdns:cdn:driver:velocix' && $('#sscsUrl').val()) {
            var url = Utils.parseUrl($('#sscsUrl').val());
            this.model.set('routingService', {
                host: url.host,
                port: url.port || 80,
                path: url.path
            });
        } else {
            this.model.unset('routingService');
        }

        // Pass in the manual whitelist entries
        var clientIpWhitelist = this.model.get('clientIpWhitelist') || {};
        clientIpWhitelist.manual = [];
        if ($('#ipWhitelist').val()) {
            $('#ipWhitelist').val().trim().split(/[\n,]/).forEach(function(network) {
                var rangeTokens = network.split('/');
                if (rangeTokens[0]) {
                    clientIpWhitelist.manual.push({
                        network: rangeTokens[0],
                        prefix: parseInt(rangeTokens[1])
                    });
                }
            });
        }
        this.model.set('clientIpWhitelist', clientIpWhitelist);


        // Pass in the ALTO service config
        if ($('#enableAlto:checked').length === 1) {
            this.model.set('altoService', {
                altoServiceUrl: $('#altoServiceUrl').val(),
                refreshInterval: $('#refreshInterval').val() || 3600,
                ignorePids: $('#ignorePids').val().split(','),
                networkMapId: $('#networkMapId').val()
            });;
        } else {
            this.model.unset('altoService');
        }

        this.model.save({}, {
            wait: true,
            success: function(model, response, options) {
                var label = model.get('name') || model.get('_id');
                self.collection.add(model);
                $('#errorBox').hide();
                $('#successBox p').text('CDN ' + label + ' was saved');
                $('#successBox').removeClass('hide');
                $('#successBox').show();
                Utils.scrollToTop();
                self.options.router.navigate('cdns', {trigger: true});
            },
            error: function(model, xhr, options) {
                var msg;
                if (xhr.status === 409) {
                    msg = 'Cannot save because someone else recently edited this CDN.'
                        + 'Please reload and try again.';
                } else {
                    msg = 'An error occured while saving the CDN (' + xhr.status + ')';
                }
                self.renderError(model, msg, options);
                Utils.scrollToTop();
            }
        });
    },


});