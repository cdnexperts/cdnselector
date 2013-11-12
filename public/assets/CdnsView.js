var CdnsView = Backbone.View.extend({
    tagName: "div",
    id: "cdns-view",
    template:_.template($('#tplDatatable').html()),
    cdnTypeLabels: {
        'cdns:cdn:driver:velocix': 'Velocix',
        'cdns:cdn:driver:amazon': 'Amazon Cloudfront',
        'cdns:cdn:driver:akamai': 'Akamai',
        'cdns:cdn:driver:generic': 'Generic'
    },

    initialize: function() {
        $('#content').html(this.el);

        this.render();

        this.collection.on('add', this.afterCreation, this);
        this.collection.on('remove', this.afterDeletion, this);
        this.collection.on('reset', this.renderTable, this);
        this.collection.on('error', this.renderError, this);
    },

    render: function() {
        this.$el.html(this.template({
            title: 'CDNs',
            createButtonLabel: 'Add CDN',
            createButtonHref: '#cdns/create'
        }));
        this.$tableEl = this.$el.find('#datatable');
        this.renderTable();
    },

    events: {
        "click .delete": "delete"
    },

    afterCreation: function (model, collection, options) {
        this.$tableEl.dataTable().fnAddData(model.toJSON(), true);
    },

    afterDeletion: function (model, collection, options) {
        this.$tableEl.dataTable().fnDeleteRow(options.rowEl);
        var label = model.get('name') || model.get('_id');
        this.showSuccessMessage('CDN ' + label + ' was deleted');
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

    renderTable: function($tableEl) {
        var self = this;

        this.$tableEl.dataTable({
            "aaData": this.collection.toJSON(),

            bServerSide: false,

            "aoColumns": [
                { "sTitle": "Name",   "mDataProp": "name" },
                { "sTitle": "Type",   "mDataProp": "driver" },
                { "sTitle": "Status",   "mDataProp": "active" },
                { "sTitle": "Restricted Access",   "mData": null },
                { "sTitle": "Actions",   "mData": null }
            ],
            "fnRowCallback": function( nRow, aData, iDisplayIndex ) {
                $('td:eq(0)', nRow).html(aData.name || aData._id);
                $('td:eq(1)', nRow).html(self.cdnTypeLabels[aData.driver] || aData.driver);
                $('td:eq(2)', nRow).html(aData.active ? 'Active' : 'Disabled');

                $('td:eq(3)', nRow).html(aData['clientIpWhitelist']
                                            && (
                                                (aData.clientIpWhitelist.manual
                                                    && aData.clientIpWhitelist.manual.length > 0)
                                                ||  (aData.clientIpWhitelist.alto
                                                    && aData.clientIpWhitelist.alto.length > 0))
                                                ? 'Yes' : 'No');

                if(aData._id) {
                    $('td:eq(4)', nRow).html(
                        '<a href="#cdns/' + aData._id + '" class="btn btn-primary edit">Edit</a> &nbsp;' +
                        '<button value="' + aData._id + '" class="btn btn-danger delete">Delete</button>'
                    );
                } else {
                    $('td:eq(4)', nRow).html('Saving...');
                }
            }
        });
    },

    delete: function(e) {
        e.preventDefault();
        var id = e.target.value;
        if (confirm('Are you sure you want to delete this CDN?')) {
            // Passing in the <tr> elem
            var rowEl = e.target.parentElement.parentElement;
            this.collection.get(id).destroy({rowEl: rowEl});
        }
    },

    close: function() {
        $('#errorBox,#successBox').hide();
        this.collection.off("add", this.afterCreation, this);
        this.collection.off("change", this.afterChange, this);
        this.collection.off("remove", this.afterDeletion, this);
        this.collection.off("reset", this.renderTable, this);
        this.collection.off("error", this.renderError, this);
        this.remove();
    }

});