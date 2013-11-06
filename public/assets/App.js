$(function() {

    var Router = Backbone.Router.extend({
        routes : {
            "": "distributions",
            "distributions" : "distributions",
            "distribution/create" : "distributionForm",
            "distribution/:id" : "distributionForm",
            "cdns" : "cdnsConfig"
        },

        distributions : function() {
            this.loadView(new DistributionsView({
                collection: distributions,
                cdnCollection: cdns
            }));
        },
        distributionForm: function(id) {
            this.loadView(new DistributionFormView({
                collection: distributions,
                model: distributions.get(id),
                cdnCollection: cdns,
                router: this
            }));
        },
        cdnsConfig: function() {
            this.loadView(new CdnConfigView({
                collection: cdns
            }));
        },
        loadView : function(view) {
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
