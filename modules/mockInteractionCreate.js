// Based on https://github.com/b-u-n/discord.js-mock-interactions/blob/main/example.mjs
import { CommandInteraction, CommandInteractionOptionResolver } from "discord.js";

const optionTypes = {
    SUB_COMMAND: 1,
    SUB_COMMAND_GROUP: 2,
    STRING: 3,
    INTEGER: 4,
    BOOLEAN: 5,
    USER: 6,
    CHANNEL: 7,
    ROLE: 8,
    MENTIONABLE: 9,
    NUMBER: 10,
    ATTACHMENT: 11,
};
export async function InteractionBuilder({ client, applicationId, guildId, channelId, userId, cmdData }) {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    const user = member.user;

    const { type, name, subcommand, options, commandId } = cmdData;
    const optionsOut = [];

    const cmdOptionsData = client.slashcmds.get(name)?.commandData.options;

    for (let { type: optType, name: optName, value } of options) {
        // If it's missing the option's name or value, error. Otherwise, set it
        if (!optName) throw Error("[MockInteraction] Missing name");
        if (!value) throw Error(`[MockInteraction] Missing value for ${optName}`);

        const opt = { name: optName, value: value };

        // If the user copied their side of a command into a field with choices where what they see is different than what's sent to the bot, make sure it's converted to what the bot needs
        const thisOptionData = cmdOptionsData?.find((o) => o.name === optName);
        if (thisOptionData?.choices?.length && !thisOptionData.choices.find((c) => c.value === value)) {
            value = thisOptionData.choices.find((c) => c.name === value)?.value;
        }

        // If it didn't have a option value, or find a valid one, break
        if (!value) throw new Error(`[MockInteraction] Invalid value for option: ${optName}`);

        // Special case for channel types, grab the actual channel data instead of just the ID
        // - Would need it for user, role, and mentionable if we ever used those in commands that were automatable
        if (optType === "CHANNEL") opt.channel = await guild.channels.fetch(value);

        // Make sure the option is of a valid type.
        // If it's not, just continue and ignore it
        if (typeof optType === "number" && Object.values(optionTypes).includes(optType)) opt.type = optType;
        else if (Object.keys(optionTypes).includes(optType)) opt.type = optionTypes[optType];
        else continue;

        optionsOut.push(opt);
    }

    // @ts-ignore
    const interaction = new CommandInteraction(client, { data: { type, guild, user }, user });
    // @ts-ignore
    interaction.options = new CommandInteractionOptionResolver(client, optionsOut);

    interaction.version = 1; // Read-only property, always 1
    interaction.id = userId; // ID of the interaction (Shouldn't matter for this?)
    interaction.type = 2; // APPLICATION_COMMAND
    interaction.commandType = 1; // Set the type to ChatInput (Not Message or User)
    interaction.guildId = guild.id;
    interaction.commandGuildId = guild.id;
    interaction.commandName = name;
    interaction.channelId = channelId;
    interaction.applicationId = applicationId;
    interaction.commandId = commandId || "";
    interaction.member = member;
    interaction.options._subcommand = subcommand;
    interaction.isCommand = () => true;
    interaction.reply = async (content) => {
        try {
            interaction.msg = await interaction.channel.send(content);
        } catch (_) {
            console.error(`[mockInteraction reply] Broke trying to send a reply message for /${interaction.commandName}`);
        }
    };
    interaction.deferReply = () => {}; // Don't need this since there's no reason to automate arenawatch (The one command using it)
    interaction.editReply = async (content) => {
        try {
            await interaction.msg.edit(content);
        } catch (_) {
            console.error(`[mockInteraction edit] Broke trying to edit a message for /${interaction.commandName}`);
        }
    };
    interaction.followUp = async (content) => {
        try {
            await interaction.msg.channel.send(content);
        } catch (_) {
            console.error(`[mockInteraction reply] Broke trying to send a followUp message for /${interaction.commandName}`);
        }
    };
    interaction.deleteReply = () => {};
    return interaction;
};

