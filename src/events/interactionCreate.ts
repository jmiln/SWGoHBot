import { inspect } from "util";
import { Client, Interaction } from "discord.js";

module.exports = async (Bot: {}, client: Client, interaction: Interaction) => {
    // If it's not a command, don't bother trying to do anything
    if (!interaction.isCommand()) return;

    // If it's a bot trying to use it, don't bother
    if (interaction.user.bot) return;

    // Grab the command data from the client.slashcmds Collection
    const cmd = client.slashcmds.get(interaction.commandName);

    // If that command doesn't exist, silently exit and do nothing
    if (!cmd) return;

    // Grab the settings for this server, and if there's no guild, just give it the defaults
    // Attach the guildsettings to the interaction to make it easier to grab later
    interaction.guildSettings = await Bot.getGuildConf(interaction?.guild?.id);

    // Get the user or member's permission level from the elevation
    const level = Bot.permLevel(interaction);

    // Make sure the user has the correct perms to run the command
    if (level < cmd.commandData.permLevel) {
        return interaction.reply({content: "Sorry, but you don't have permission to run that command.", ephemeral: true});
    }

    // // Load the language file for whatever language they have set
    const user = await Bot.userReg.getUser(interaction.user.id);
    if (user && user.lang) {
        if (user.lang.language) {
            interaction.guildSettings.language = user.lang.language || Bot.config.defaultSettings.language;
        }
        if (user.lang.swgohLanguage) {
            interaction.guildSettings.swgohLanguage = user.lang.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;
        }
    }
    interaction.language = Bot.languages[interaction.guildSettings.language] || Bot.languages[Bot.config.defaultSettings.language];
    interaction.swgohLanguage = interaction.guildSettings.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;

    // Run the command
    try {
        await cmd.run(Bot, interaction, { level: level });
    } catch (err) {
        if (cmd.commandData.name === "test") {
            return console.log(`ERROR(inter) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
        }

        const ignoreArr = [
            "DiscordAPIError: Unknown interaction",
            "DiscordAPIError: Missing Access",
            "HTTPError [AbortError]: The user aborted a request."
        ];
        if (ignoreArr.some(str => err.toString().includes(str))) {
            // Don't bother spitting out the whole mess.
            // Log which command broke, and the first line of the error
            Bot.logger.error(`ERROR(inter) I broke with ${cmd.commandData.name}: \n${err.toString().split("\n")[0]}`);
        } else {
            Bot.logger.error(`ERROR(inter) I broke with ${cmd.commandData.name}: \nOptions: ${inspect(interaction.options, {depth: 5})} \n${inspect(err, {depth: 5})}`, true);
        }
        const replyObj = {content: `It looks like something broke when trying to run that command. If this error continues, please report it here: ${Bot.constants.invite}`, ephemeral: true};
        if (interaction.replied) {
            return interaction.followUp(replyObj)
                .catch(e => console.error(`[cmd:${cmd.commandData.name}] Error trying to send error message: \n${e}`));
        } else if (interaction.deferred) {
            return interaction.editReply(replyObj)
                .catch(e => console.error(`[cmd:${cmd.commandData.name}] Error trying to send error message: \n${e}`));
        } else {
            return interaction.reply(replyObj)
                .catch(e => console.error(`[cmd:${cmd.commandData.name}] Error trying to send error message: \n${e}`));
        }
    }
};
