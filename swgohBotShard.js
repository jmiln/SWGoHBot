// At max, each shard should have ~2500 servers 
// This is used for when you get your bot on a ton of servers. 

const Discord = require('discord.js');
const Manager = new Discord.ShardingManager('./swgohBot.js');   // Tell it what the main file we'd otherwise run the bot with is
Manager.spawn(3);   // Tell it that we want 3 shards (Approx. 900 servers per shard)

