const chalk = require('chalk');
module.exports = client => {
    console.log(chalk.bgGreen.black(client.user.username + ' is Online'));
};
