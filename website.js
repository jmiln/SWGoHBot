const express = require('express');
const path = require('path');

const app = express();

var exports = module.exports = {};

/**
 * Required for starting the web server and to load the express app.
 * @param client - Discord.js Client Object
 * @public
 */
exports.initSite = function(client) {
    const dashConf = client.config.dashboard;

    // Set the directory for the views and stuff
    app.set("views", path.join(__dirname, `..${path.sep}dashboard`));

    // Set the view engine to ejs
    app.set('view engine', 'ejs');

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
    app.get('/changelog',function(req, res) {
        res.render('pages/changelog', {
            page_name: 'changelog'
        });
    });

    // FAQs page
    app.get('/faqs',function(req, res) {
        res.render('pages/faqs', {
            page_name: 'faqs'
        });
    });

    // Commands page 
    app.get('/commands',function(req, res) {
        res.render('pages/commands', {
            page_name: 'commands',
            command_list: loadCommands(client.commands)
        });
    });

    // The link to invite the bot
    app.get('/invite', function(req, res) {
        res.redirect('https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834');
    });

    // The link to join the support server
    app.get('/server', function(req, res) {
        res.redirect('https://discord.gg/FfwGvhr');
    });

    app.use(function(err, req, res) {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });

    //The 404 Route (ALWAYS Keep this as the last route)
    app.use('*',function(req, res) {
        res.send('Error 404: Not Found!', 404);
    });

    // Turn the site on
    app.listen(dashConf.port, function() {
        client.log('Site', `App listening on port ${dashConf.port}!`);
    });
};

// A quick function to put em into nice categories for later
function loadCommands(commands) {
    const coms = {};
    const commandList = commands.filter(c => c.conf.permLevel <= 4); // Keep out the dev ones
    
    commandList.forEach(command => {
        if (!coms[command.help.category]) {
            coms[command.help.category] = [command]; 
        } else {
            coms[command.help.category].push(command);
        }
    });

    return coms;
}