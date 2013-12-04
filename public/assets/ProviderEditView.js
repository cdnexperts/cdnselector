var ProviderEditView = Backbone.View.extend({
    id: 'modalDialog',
    className: 'modal large fade hide',

    template:_.template($('#tplProviderEditView').html()),

    initialize: function() {
        this.render();
    },

    events: {
        "click #btnOk": "confirmEdits",
        "hidden": "close"
    },

    close: function() {
        this.$el.modal('hide');
        this.$el.data('modal', null);
        $("body").removeClass("modal-open");
        this.model.trigger('change:providers');
        this.remove();
    },

    render: function() {
        var provider = _.findWhere(this.model.get('providers'), { id: this.options.providerId });
        if (!provider) {
            this.close();
        }
        this.$el.html(this.template({
            provider: provider,
            cdn: this.options.cdn,
            selectionMode: this.model.get('selectionMode') || 'failover'
        }));
        this.$el.modal({ show:false });
    },


    show: function() {
        this.$el.modal('show');
        $("body").addClass("modal-open");
    },

    confirmEdits: function() {
        var providers = this.model.get('providers');
        var provider = _.findWhere(providers, { id: this.options.providerId });
        if (provider) {
            provider.hostname = $('#providerHostname').val();

            // Set the CDN-specific token stuff
            if (this.options.cdn && this.options.cdn.driver === 'cdns:cdn:driver:amazon') {
                provider.signedUrl = {
                    awsCfKeyPairId: $('#awsCfKeyPairId').val(),
                    awsCfPrivateKey: $('#awsCfPrivateKey').val()
                };
            }

            if (this.model.get('selectionMode') === 'loadbalance') {
                if (!provider.loadBalancer) {
                    provider.loadBalancer = {};
                }
                provider.loadBalancer.alwaysUseForWhitelistedClients = $('#alwaysUseForWhitelistedClients:checked').length === 1;
            }

            this.model.set('providers', providers);

        }
        if (this.model.isValid()) {
            this.close();
        } else {
            $('#errorBox p', this.el).text(this.model.validationError.toString());
            $('#errorBox', this.el).removeClass('hide');
            $('#errorBox', this.el).show();
        }
    }
});