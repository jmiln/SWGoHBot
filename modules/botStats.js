const { post } = require("snekfetch");

module.exports = (client) => {
    setInterval(updateStats, 30 * 60 * 1000); // Run this every 30 min

    async function updateStats() {
        try {
            const guilds = await client.guildCount();
            await post(`https://botsfordiscord.com/api/v1/bots/${client.user.id}`)
                .set("Authorization", client.config.b4dToken)
                .send({ server_count: guilds });
            console.log('Sending guild count to b4d: ' + guilds);
        } catch (error) {
            console.log(error);
        }
    }
};
