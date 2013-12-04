var DistributionFormView = Backbone.View.extend({

    template:_.template($('#tplDistributionsForm').html()),

    events: {
        "click #btnSaveDistribution": "saveDistribution",
        "click #btnSaveDistribution": "saveDistribution",
        "click .editProvider": "onConfigureProviderClick",
        "change #selectionMode": "renderProviderEditor"
    },

    defaultColors: ['blue', 'fuchsia', 'green',
             'lime', 'maroon', 'navy', 'olive', 'orange', 'purple',
             'red', 'silver', 'teal', 'yellow', 'aqua', 'black', 'gray'],

    initialize: function() {
        var self = this;
        $('#content').html(this.$el);
        if (!this.model) {
            this.model = new Distribution();
        }
        this.render();
        this.model.on('invalid', this.renderError, this);
        this.model.on('change:providers', this.render, this);

        // When the window resizes we must redraw the load balancer
        $(window).bind("resize.app", _.bind(this.render, this));
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
        console.log('render');
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

        $('#selectionMode').val(this.model.get('selectionMode') || 'failover');
        this.renderProviderEditor();

        return this;
    },


    renderProviderEditor: function() {
        var self = this;

        // Let the user drag and drop the providers into order
        $('#providerList').sortable({
            cursor: "move",
            axis: "y",
            revert: true,
            cancel: ".ui-state-disabled",
            update: function(event, ui) {
                var oldProviders = self.model.get('providers');
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
                        if (self.model.get('selectionMode') === 'loadbalance' && provider.loadBalancer && !isActive) {
                            // Reset the load balancer target to 0 when a provider moves to inactive
                            provider.loadBalancer.targetLoadPercent = 0;
                        }
                        var cdn = self.options.cdnCollection.get(provider.id);
                        provider.driver = cdn.get('driver');
                        provider.name = cdn.get('name');
                        delete provider.cdn;
                        newProviders.push(provider);
                    }
                });

                self.model.set('providers', newProviders);
                self.model.trigger('change:providers');
            }
        });
        this.renderLoadBalancer();
    },

    assignColor: function(color) {
        if (!this.colors || this.colors.length === 0) {
            this.colors = this.defaultColors.slice(0);
        }

        if (color) {
            // A specific color was requested.
            var pos = _.indexOf(this.colors, color);
            if (pos > -1) {
                // Remove the color so no one else gets it
                this.colors.splice(pos, 1);
            }
            return color;
        }

        // Auto-assign a color.
        return this.colors.splice(0,1)[0];
    },

    renderLoadBalancer: function() {
        var self = this,
            providerIds = [],
            percentages = [],
            colors = [],
            sumOfLoads = 0,
            providerCount = 0,
            providers = this.model.get('providers'),
            selectionMode = $('#selectionMode option:selected').val(),
            i;


        this.model.set('selectionMode', selectionMode);

        if (selectionMode !== 'loadbalance') {

            // Remove the load balancer UI bits
            $('#providerList div.actionIcon')
                .addClass('fa fa-3x fa-sort')
                .removeClass('actionIconColor')
                .css('background-color', '');

            $('#providerList .percentText').text('');
            $('#partition').html('');
            $('#loadBalancer').addClass('hide');

            return;
        }

        // Remove the positioning arrows and add colour coding
        $('#providerList div.actionIcon').removeClass('fa fa-3x fa-sort').addClass('actionIconColor');
        $('#loadBalancer').removeClass('hide');

        // Calculate the total of the load percentages
        //(just in case they are not a percentage for some reason)
        for (i = 0; i < providers.length; i += 1) {
            var provider = providers[i];
            if (provider.active) {
                providerCount += 1;

                if (provider.loadBalancer && isFinite(provider.loadBalancer.targetLoadPercent)) {
                    sumOfLoads += provider.loadBalancer.targetLoadPercent;
                }
            }
        }

        for (i = 0; i < providers.length; i += 1) {
            var provider = providers[i];
            if (provider.active) {
                providerIds.push(provider.id);
                colors.push(this.assignColor(provider.color));

                if (sumOfLoads === 0) {
                    // If the load balancer isn't configured then present the user with the load
                    // evenly spread across all active providers
                    percentages.push(Math.round(100 / providerCount));
                } else if (provider.loadBalancer && isFinite(provider.loadBalancer.targetLoadPercent)) {
                    // If any providers have a load balancer configured then configure the view to show
                    // relative percentages
                    percentages.push(Math.round((provider.loadBalancer.targetLoadPercent / sumOfLoads) * 100));
                } else {
                    // This provider doesn't have a load balance target, but they should be present in the list
                    // at 0%
                    percentages.push(0);
                }
            }
        }

        // Setup the partition editor
        $('#partition').html('');
        $('#partition').PartitionSlider({
            values: percentages,
            colors: colors,
            create: function(values, colors){
                for (var i = 0; i < values.length; i++) {
                    var providerId = providerIds[i].replace(/:/g, '\\:');
                    var $providerRow = $('#' + providerId);
                    $providerRow.find('.percentText').text(' : ' + values[i] + '%');
                    $providerRow.find('.actionIcon').html('').css('background-color', colors[i]);

                    var provider = _.findWhere(self.model.get('providers'), { id: providerIds[i] });
                    provider.color = colors[i];
                }
            },

            onCursorDrag: function(cursor, values){
                for (var i = 0; i < values.length; i++) {
                    var providerId = providerIds[i].replace(/:/g, '\\:');
                    var $providerRow = $('#' + providerId);
                    $providerRow.find('.percentText').text(' : ' + values[i] + '%');
                    if (i === cursor || i === cursor + 1) {
                        $providerRow.find('.percentText').parent()
                            .css('color', 'red')
                            .css('font-weight', 600);
                    }
                }
            },

            onCursorDragComplete: function(values) {
                // Update the model
                for (var i = 0; i < values.length; i++) {
                    var provider = _.findWhere(self.model.get('providers'), { id: providerIds[i] });

                    if (!provider.loadBalancer) {
                        provider.loadBalancer = {};
                    }
                    provider.loadBalancer.targetLoadPercent = values[i];
                }
                self.model.trigger('change:providers');
            }
        });
    },

    renderError: function(model, err, options) {
        $('#successBox').hide();
        $('#errorBox p').text(err.toString());
        $('#errorBox').removeClass('hide');
        $('#errorBox').show();
        Utils.scrollToTop();
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
               authSecrets: [],
               selectionMode: $('#selectionMode option:selected').val()
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
    },

    saveDistribution: function(e) {
        e.preventDefault();
        var self = this;
        this.updateModelFromForm();
        var providers = this.model.get('providers');

        // Remove CDN references
        for (var i = 0; i < providers.length; i++) {
            delete providers[i].cdn;
        }

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