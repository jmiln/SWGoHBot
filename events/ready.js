const chalk = require('chalk');
const settings = require("../settings.json");
module.exports = client => {
    console.log(chalk.bgGreen.black(client.user.username + ' is Online'));
    client.user.setGame("Say " + settings.prefix + "help");
};
