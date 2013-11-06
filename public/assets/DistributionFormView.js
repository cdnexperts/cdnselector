var DistributionFormView = Backbone.View.extend({

    template:_.template($('#tplDistributionsForm').html()),

    events: {
        "click #btnSaveDistribution": "saveDistribution"
    },

    initialize: function() {
        $('#content').html(this.$el);
        if (!this.model) {
            this.model = new Distribution();
        }
        this.render();
        this.model.on('invalid', this.renderError, this);
    },

    close: function() {
        this.model.off('invalid', this.renderError, this);
        this.remove();
    },

    render: function() {
        var templateParams = this.model.toJSON();

        // make sure that the model has a provider for every CDN, even if its empty
        this.options.cdnCollection.forEach(function(cdn) {
            var foundProvider = false;
            templateParams.providers.forEach(function(provider) {
                if (provider.id === cdn.id) {
                    foundProvider = true;
                }
            });
            if (!foundProvider) {
                templateParams.providers.push({
                    id: cdn.id,
                    active: templateParams.providers.length === 0
                })

            }
        });
        this.$el.html(this.template(templateParams));

        this.renderTabs();
        return this;
    },

    renderError: function(model, err, options) {
        $('#successBox').hide();
        $('#errorBox p').text(err.toString());
        $('#errorBox').removeClass('hide');
        $('#errorBox').show();
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

    saveDistribution: function(e) {
        console.log('Save Button Click Event');
        e.preventDefault();

        var self = this,
            distribution = {
               name: $('#name').val(),
               hostnames: [],
               authSecrets: [],
               providers: []
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
            console.log(distribution.hostnames);
        }
        $('#tabs ul.tabHeads li a').each(function(i, a) {
            var provider = {};
            var providerElId = a.hash.replace('#', '');
            provider.id = 'cdns:cdn:' + providerElId;

            var tab = $('#tabs #' + providerElId);

            // Active flag
            provider.active = $('input[type=checkbox]:checked', tab).length === 1;

            // Hostname
            if ($('input#hostname', tab).length > 0) {
                provider.hostname = $('input#hostname', tab).val();
            }

            // Amazon SignedURL stuff
            if (provider.id === 'cdns:cdn:amazon') {
                provider.signedUrl = {
                    awsCfKeyPairId: $('input#awsCfKeyPairId', tab).val(),
                    awsCfPrivateKey:  $('#awsCfPrivateKey', tab).val()
                };
            }

            distribution.providers.push(provider);
        });
        this.model.save(distribution, {
            wait: true,
            success: function(model, response, options) {
                var label = model.get('name') || model.get('_id');
                self.collection.add(model);
                $('#errorBox').hide();
                $('#successBox p').text('Distribution ' + label + ' was saved');
                $('#successBox').removeClass('hide');
                $('#successBox').show();
                self.options.router.navigate('distributions', {trigger: true});
            },
            error: function(model, xhr, options) {
                self.renderError(model, 'Error whilst saving distribution', options);
            }
        });
    },
});