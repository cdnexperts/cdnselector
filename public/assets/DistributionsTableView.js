$(function() {
    var app = window.app = window.app || {};
    app.DistributionsTableView = Backbone.View.extend({

        events: {
            "click .edit": "editDistribution",
            "click .delete": "deleteDistribution"
        },

        initialize: function() {
            this.renderTable();

            this.collection.on("add", this.afterCreation, this);
            this.collection.on("change", this.afterChange, this);
            this.collection.on("remove", this.afterDeletion, this);
            this.collection.on("reset", this.renderTable, this);
            this.collection.on("error", this.renderError, this);
        },

        afterCreation: function (model, collection, options) {
            this.$el.dataTable().fnAddData(model.toJSON(), true);

        },

        afterChange: function (model, options) {
            this.$el.dataTable().fnUpdate(model.toJSON(), options.rowEl);

        },

        afterDeletion: function (model, collection, options) {
            this.$el.dataTable().fnDeleteRow(options.rowEl);
            var label = model.get('name') || model.get('_id');
            this.showSuccessMessage('Distribution ' + label + ' was deleted');
        },

        showSuccessMessage: function(msg) {
            $('#successBox p').text(msg);
            $('#successBox').show();
            $('#successBox').removeClass('hide');
            $('html, body').animate({
                scrollTop: 0
            }, 500);
        },

        renderError: function() {
            $('#errorBox p').text('Error whilst communicating with the database.');
            $('#errorBox').removeClass('hide');
            $('#errorBox').show();
            $('html, body').animate({
                scrollTop: 0
            }, 500);
        },

        renderTable: function() {
            this.$el.dataTable({
                "aaData": this.collection.toJSON(),

                bServerSide: false,

                "aoColumns": [
                    { "sTitle": "Name",   "mDataProp": "name" },
                    { "sTitle": "Hostnames",   "mDataProp": "hostnames" },
                    { "sTitle": "Served by CDNs",   "mDataProp": "providers" },
                    { "sTitle": "Actions",   "mDataProp": "name" }
                ],
                "fnRowCallback": function( nRow, aData, iDisplayIndex ) {
                    $('td:eq(0)', nRow).html(aData.name || aData._id);
                    $('td:eq(1)', nRow).html(aData.hostnames.join('<br/>'));

                    var cdnList = '<ol>';
                    for (var i = 0; i < aData.providers.length; i++) {
                        if (aData.providers[i].active) {
                            cdnList += '<li>' + aData.providers[i].id + '</li>';
                        }
                    }
                    cdnList += '</ol>'
                    $('td:eq(2)', nRow).html(cdnList);

                    if(aData._id) {
                        $('td:eq(3)', nRow).html(
                            '<button value="' + aData._id + '" class="btn btn-primary edit">Edit</button> &nbsp;' +
                            '<button value="' + aData._id + '" class="btn btn-danger delete">Delete</button>'
                        );
                    } else {
                        $('td:eq(3)', nRow).html('Saving...');
                    }
                }
            });
        },

        editDistribution: function(e) {
            e.preventDefault();
            console.log(e);
            var id = e.target.value;
            this.formView = new app.DistributionFormView({
                collection: this.collection,
                model: this.collection.get(id),
                cdnCollection: this.options.cdnCollection,
                rowEl: e.target.parentElement.parentElement
            });
            $('#distributionFormBlock').html(this.formView.render().el);
            $('html, body').animate({
                scrollTop: $('#distributionFormBlock').offset().top - 65
            }, 500);

        },

        deleteDistribution: function(e) {
            e.preventDefault();
            var id = e.target.value;
            console.log("Deleting " + id);
            console.log(e.target.parentElement.parentElement);
            if (confirm('Are you sure you want to delete this distribution?')) {
                // Passing in the <tr> elem
                var rowEl = e.target.parentElement.parentElement;
                console.log(rowEl);
                this.collection.get(id).destroy({rowEl: rowEl});
            }
        }
    });
});
