var app = window.app = window.app || {};
app.baseUrl = '/vxcdns';

$(function(){


    var velocixConfigView = new app.CdnConfigView({
        template: $('#tplVelocixForm').html()
    });
    $('#velocixFormBlock').html(velocixConfigView.render().el);
});
