const express = require('express');
// const session = require('express-session');
//
// const bodyParser = require('body-parser');

const app = express();

var exports = module.exports = {};

/**
 * Required for starting the web server and to load the express app.
 *
 * @param client - Discord.js Client Object
 * @public
 */

exports.initSite = function (client) {
    // Set the view engine to ejs
    app.set('view engine', 'ejs');

    // app.use(session({secret: 'ssshhhhh'}));
    //
    // app.use(bodyParser.json());
    // app.use(bodyParser.urlencoded({
    //     extended: true
    // }));

    // Index page
    app.get('/', function(req, res) {
        res.render('pages/index', {
            clientServers: client.guilds.size,
            page_name: 'index'
        });
    });

    // About page
    app.get('/about', function(req, res) {
        res.render('pages/about', {
            page_name: 'about'
        });
    });

    // Changelog page
    app.get('/changelog',function(req, res){
        res.render('pages/changelog', {
            page_name: 'changelog'
        });
    });

    // FAQs page
    app.get('/faqs',function(req, res){
        res.render('pages/faqs', {
            page_name: 'faqs'
        });
    });

    // Commands page
    app.get('/commands',function(req, res){
        res.render('pages/commands', {
            page_name: 'commands'
        });
    });

    app.get('/invite', function(req, res) {
        res.redirect('https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834');
    });

    app.get('/server', function(req, res) {
        res.redirect('https://discord.gg/FfwGvhr');
    });

    // app.use('*',function(req, res){
    //     res.send('Error 404: Not Found!');
    // });

    app.listen(8080, function () {
        client.log('Site', 'App listening on port 8080!');
    });
}
