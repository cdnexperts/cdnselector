$(function() {
    var app = window.app = window.app || {};

    app.DistributionsView = Backbone.View.extend({
        el: $('body').get(),

        events: {
            "click #btnCreateDistribution": "displayEmptyForm"
        },

        initialize: function() {
            this.collection = new app.Distributions();
            this.collection.fetch();

            this.cdnCollection = new app.SupportedCDNs();
            this.cdnCollection.fetch();


            this.tableView = new app.DistributionsTableView({
                collection: this.collection,
                el: $('#distributionsTab').get(),
                cdnCollection: this.cdnCollection
            });


        },

        displayEmptyForm: function(e) {
            e.preventDefault();
            this.formView = new app.DistributionFormView({
                collection: this.collection,
                cdnCollection: this.cdnCollection
            });
            $('#distributionFormBlock').html(this.formView.render().el);
            $('html, body').animate({
                scrollTop: $('#distributionFormBlock').offset().top - 65
            }, 500);
        },

    });

});