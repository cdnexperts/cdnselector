var app = window.app = window.app || {};
app.baseUrl = '/cdns';

$(function(){
    app.distributionsView = new app.DistributionsView();
});
