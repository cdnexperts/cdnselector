$(function() {

    var Router = Backbone.Router.extend({
        routes : {
            "": "distributions",
            "distributions" : "distributions",
            "distributions/create" : "distributionForm",
            "distributions/:id" : "distributionForm",
            "cdns" : "cdns",
            "cdns/create" : "cdnForm",
            "cdns/:id" : "cdnForm",
        },

        distributions : function() {
            this.loadView(new DistributionsView({
                collection: distributions,
                cdnCollection: cdns
            }));
        },
        distributionForm: function(id) {

            var self = this,
                distributionsSynced = false,
                cdnsSynced = false;

            function showForm() {
                if (distributionsSynced && cdnsSynced) {

                    self.loadView(new DistributionFormView({
                        collection: distributions,
                        model: distributions.get(id),
                        cdnCollection: cdns,
                        router: self
                    }));
                }
            }

            // Re-fetch the record to reduce conflicts
            distributions.once('sync', function () {
                distributionsSynced = true;
                showForm();
            }, this);

            cdns.once('sync', function () {
                cdnsSynced = true;
                showForm();
            }, this);
            distributions.fetch();
            cdns.fetch();

        },
        cdns: function() {
            this.loadView(new CdnsView({
                collection: cdns
            }));
        },
        cdnForm: function(id) {
            if (id) {
                // Re-fetch the record to reduce conflicts
                cdns.fetch();
                cdns.once('sync', function() {
                    this.loadView(new CdnFormView({
                        collection: cdns,
                        model: cdns.get(id),
                        router: this
                    }));
                }, this);
            } else {
                this.loadView(new CdnFormView({
                    collection: cdns,
                    model: new CDN(),
                    router: this
                }));
            }
        },
        loadView : function(view) {
            // Make sure the previous view is cleaned up
            this.view && (this.view.close ? this.view.close() : this.view.remove());
            this.view = view;
        }
    });


    // Load our data from the server
    var distributions = new Distributions();
    distributions.fetch();

    var cdns = new SupportedCDNs();
    cdns.fetch();

    // Initialize the app
    var router = new Router();
    Backbone.history.start();
});
