const { post } = require("snekfetch");

module.exports = (Bot, client) => {
    setInterval(updateStats, 30 * 60 * 1000); // Run this every 30 min

    async function updateStats() {
        try {
            const guilds = await Bot.guildCount();
            await post(`https://botsfordiscord.com/api/bot/${client.user.id}`)
                .set("Authorization", Bot.config.b4dToken)
                .send({ server_count: guilds })
                .catch(err => console.log("Broke trying to update botStats: " + err));
            console.log("Sending guild count to b4d: " + guilds);
        } catch (error) {
            console.log(error);
        }
    }
};
