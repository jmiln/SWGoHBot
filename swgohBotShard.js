// At max, each shard should have ~2500 servers 
// This is used for when you get your bot on a ton of servers. 

const Discord = require('discord.js');
const Manager = new Discord.ShardingManager('./swgohBot.js');
Manager.spawn(3); 

