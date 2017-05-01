module.exports = member => {
  let guild = member.guild;
  guild.defaultChannel.sendMessage(`Please say goodbye to ${member.user.username} we will miss you!`);
};
