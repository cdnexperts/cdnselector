var app = window.app = window.app || {};
app.baseUrl = '/cdns';

$(function(){


    var velocixConfigView = new app.CdnConfigView({
        template: $('#tplVelocixForm').html()
    });
    $('#velocixFormBlock').html(velocixConfigView.render().el);
});
