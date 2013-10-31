var app = window.app = window.app || {};
app.baseUrl = '/vxcdns';

$(function(){
    app.distributionsView = new app.DistributionsView();
});
