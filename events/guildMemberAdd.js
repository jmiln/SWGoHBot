module.exports = member => {
  let guild = member.guild;
  guild.defaultChannel.send(`Please welcome ${member.user.username} to the server!`);
};
