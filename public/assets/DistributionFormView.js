var DistributionFormView = Backbone.View.extend({

    template:_.template($('#tplDistributionsForm').html()),

    events: {
        "click #btnSaveDistribution": "saveDistribution",
        "click #btnSaveDistribution": "saveDistribution",
        "click .editProvider": "onConfigureProviderClick"
    },

    initialize: function() {
        $('#content').html(this.$el);
        if (!this.model) {
            this.model = new Distribution();
        }
        this.render();
        this.model.on('invalid', this.renderError, this);
        this.model.on('change:providers', this.render, this);
    },

    close: function() {
        if (this.dialog) {
            this.dialog.close();
        }
        this.model.off('invalid', this.renderError, this);
        this.model.off('change:providers', this.render, this);
        this.remove();
    },

    render: function() {
        var templateParams = _.clone(this.model.attributes);
        if (this.model.isValid()) {
            $('#errorBox').hide();
        }

        // make sure that the model has a provider for every CDN, even if its empty
        this.options.cdnCollection.forEach(function(cdn) {
            var foundProvider = false;
            templateParams.providers.forEach(function(provider) {
                if (provider.id === cdn.id) {
                    provider.cdn = cdn.toJSON();
                    foundProvider = true;
                }
            });
            if (!foundProvider) {
                templateParams.providers.push({
                    id: cdn.id,
                    active: templateParams.providers.length === 0,
                    cdn: cdn.toJSON()
                })

            }
        });

        // Filter out any providers that do not have CDNs. These are probably
        // orphaned providers who have had their CDNs deleted.
        var filteredProviders = [];
        for (var i = 0; i < templateParams.providers.length; i++) {
            var provider = templateParams.providers[i];
            if (provider.cdn) {
                filteredProviders.push(provider);
            }
        };
        templateParams.providers = filteredProviders;

        // Render the template
        this.$el.html(this.template(templateParams));

        // Apply the jQuery tabs
        $('#categoryTabs').tabs()
        $('#providerList').sortable({
            cursor: "move",
            axis: "y",
            revert: true,
            cancel: ".ui-state-disabled"
        });


        this.renderTabs();
        return this;
    },

    renderError: function(model, err, options) {
        $('#successBox').hide();
        $('#errorBox p').text(err.toString());
        $('#errorBox').removeClass('hide');
        $('#errorBox').show();
        Utils.scrollToTop();
    },

    renderTabs: function() {
        var tabs = $("#tabs", this.el),
            self = this;

        // helper function to get the position of providers in the array by id
        function getProviderOrder(id) {
            var position = -1;
            self.model.get('providers').forEach(function(provider, index) {
                if (provider.id === id) {
                    position = index;
                }
            });
            return position;
        }

        function relabelTabs(tabs) {
            // Change the text on the tab heads to reflect the order
            tabs.find("ul.tabHeads li a").each(function(index, a) {
                var pos = index + 1;
                var tabText = $(a).text().replace(/.*: /, '');
                $(a).text('Priority ' + pos + ': ' + tabText);
            });
        }

        // Re-arrange the tab heads according to the provider order
        tabs.find('ul.tabHeads').html(tabs.find("ul.tabHeads li").sort(function(a, b) {
            var aPos = getProviderOrder($('a', a).attr('id').replace('TabHead', '')),
                bPos = getProviderOrder($('a', b).attr('id').replace('TabHead', ''));

            return aPos - bPos;
        }));
        relabelTabs(tabs);

        // Activate the tab plugin
        tabs.tabs();
        tabs.find( ".ui-tabs-nav" ).sortable({
            axis: "x",
            stop: function() {
                relabelTabs(tabs);
                tabs.tabs("refresh");
            }
        });

    },

    onConfigureProviderClick: function(e) {
        this.updateModelFromForm();
        this.dialog = new ProviderEditView({
            model: this.model,
            providerId: e.target.id,
            cdn: this.options.cdnCollection.findWhere({ _id: e.target.id}).toJSON()
        });
        this.dialog.show();
    },

    updateModelFromForm: function() {
        var self = this,
            distribution = {
               name: $('#name').val(),
               hostnames: [],
               authSecrets: []
            };

        if ($('#authParam').val()) {
            distribution['authParam'] = $('#authParam').val();
        }
        if ($('#authSecret1').val() || $('#authSecret2').val()) {
            distribution.authSecrets = [];
            if ($('#authSecret1').val()) {
                distribution.authSecrets.push($('#authSecret1').val());
            }
            if ($('#authSecret2').val()) {
                distribution.authSecrets.push($('#authSecret2').val());
            }
        }
        if ($('#hostnames').val()) {
            $('#hostnames').val().trim().split(/[\n,]/).forEach(function(hostname) {
                distribution.hostnames.push(hostname);
            });
        }
        this.model.set(distribution);

        var oldProviders = this.model.get('providers');
        var newProviders = [];
        var isActive = true;
        $('#providerList > div').each(function (i, el) {
            if ($(el).hasClass('inactiveHeading')) {
                isActive = false;
                return;
            }

            var provider = _.findWhere(oldProviders, { id: el.id });
            if (provider) {
                provider.active = isActive;
                var cdn = self.options.cdnCollection.get(provider.id);
                provider.driver = cdn.get('driver');
                provider.name = cdn.get('name');
                delete provider.cdn;
                newProviders.push(provider);
            }
        });

        this.model.set('providers', newProviders);
    },

    saveDistribution: function(e) {
        e.preventDefault();
        var self = this;
        this.updateModelFromForm();
        this.model.save({}, {
            wait: true,
            success: function(model, response, options) {
                var label = model.get('name') || model.get('_id');
                self.collection.add(model);
                $('#errorBox').hide();
                $('#successBox p').text('Distribution ' + label + ' was saved');
                $('#successBox').removeClass('hide');
                $('#successBox').show();
                self.options.router.navigate('distributions', {trigger: true});
                Utils.scrollToTop();
            },
            error: function(model, xhr, options) {
                var msg;
                if (xhr.status === 409) {
                    msg = 'Cannot save because someone else recently edited this distribution.'
                        + 'Please reload and try again.';
                } else {
                    msg = 'An error occured while saving the distribution (' + xhr.status + ')';
                }
                self.renderError(model, msg, options);
                Utils.scrollToTop();
            }
        });
    },
});