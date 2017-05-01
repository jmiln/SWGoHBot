module.exports = member => {
  let guild = member.guild;
  guild.defaultChannel.sendMessage(`Please welcome ${member.user.username} to the server!`);
};
