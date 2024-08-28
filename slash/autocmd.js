const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
const { InteractionBuilder } = require("../modules/mockInteractionCreate");
const { getGuildSupporterTier } = require("../modules/guildConfig/patreonSettings");

const validCmds = ["mods", "mymods", "guildsearch"];

class AutoCmd extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "autocmd",
            description: "All the setup for the auto-command feature",
            guildOnly: false,
            permLevel: 3,
            options: [
                {
                    name: "add",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Add an auto-command",
                    options: [
                        {
                            name: "cmd_name",
                            type: ApplicationCommandOptionType.String,
                            description: "Just the name of the command you want to schedule",
                            required: true,
                            choices: validCmds.map((cmd) => {
                                return { name: cmd, value: cmd };
                            }),
                        },
                        {
                            name: "cmd",
                            type: ApplicationCommandOptionType.String,
                            description: "Enter a command that has successfully run. Valid commands are listed under cmd_name",
                            required: true,
                        },
                        {
                            name: "channel",
                            type: ApplicationCommandOptionType.Channel,
                            description: "Specify the channel to send the auto-command in (Defaults to current channel)",
                            required: false,
                        },
                        // TODO Figure out how to schedule it
                    ],
                },
                {
                    name: "remove",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Remove an auto-command",
                    options: [
                        // TODO Figure out how to autocomplete this so it will show just what's available
                        {
                            name: "cmd_id",
                            type: ApplicationCommandOptionType.String,
                            description: "The auto-command to remove",
                            required: true,
                        },
                    ],
                },
                {
                    // Spit out a list of the commands
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "View your current auto-commands",
                    options: [
                        // TODO Figure out how to autocomplete this so it will show just what's available
                        {
                            name: "cmd_id",
                            type: ApplicationCommandOptionType.String,
                            description: "The auto-command to view",
                        },
                    ],
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const action = interaction.options.getSubcommand();

        // Make sure the server has at least once patreon supporter set
        const patreonTier = await getGuildSupporterTier({ cache: Bot.cache, guildId: interaction.guild.id });
        if (!patreonTier || patreonTier < 1) {
            return super.error(
                interaction,
                "This command requires at least one patreon supporter to be set in this server using `/patreon set_server`.",
            );
        }

        if (action === "add") {
            const cmdName = interaction.options.getString("cmd_name");
            const cmdStr = interaction.options.getString("cmd");
            const chanIn = interaction.options.getChannel("channel") || interaction.channel;
            const parsedCmd = await parseCmd(interaction, cmdStr);

            // If the entered command doesn't match the cmd_name, spit out an error
            if (cmdName !== parsedCmd.name)
                return super.error(interaction, "Invalid command. Must match the name you entered in the 'cmd_name' field.");

            // TODO When the scheduling is set up, we need to save:
            // - userId of who set it
            // - cmdData of what's being set
            // - channelId of the channel we want to send to (Need to check that we have perms to do that)
            //   * Maybe check for perms each time before running them, so we don't run big commands then can't send em anyway
            // - Whatever scheduling data we end up needing

            // const outObj = {
            //     userId: interaction.user.id,
            //     channelId: chanIn?.id || interaction.channel.id,
            //     scheduleData: {
            //         nextRun: null,  // Date object/ epoch time
            //         repeat: null,   // interval or array of day counts for a schedule if like events command
            //     },
            //     cmdId: null,    // An ID so we can view/ delete it properly, to be set when we save it
            //     cmdData: parsedCmd,
            // };

            // The rest of this (The mock/ emit) need to be in whatever handler, not here
            const mockCmd = await InteractionBuilder({
                client: interaction.client,
                applicationId: interaction.client.user.id,
                guildId: interaction.guild.id,
                channelId: chanIn.id,
                userId: interaction.user.id,
                cmdData: parsedCmd,
            });

            return await interaction.client.emit("interactionCreate", mockCmd);
        }
        if (action === "remove") {
            // Grab the guild's auto-cmds, and if it has the specified ID, remove it
            const cmdId = interaction.options.getString("cmd_id");
            console.log(`Running auto-cmd (${cmdId}) remove.`);
        } else if (action === "view") {
            // Grab the guild's auto-cmds, and display them
            // Show:
            //  - Id of each
            //  - The next run (date/ time)
            //  - Command name
            //  - Channel if available
            //
            // If viewing a specic one, show:
            //  - The full command that'd be run,
            //  - The time/ day,
            //  - The time till
            //  - Whatever repeat schedule
            //  - Channel if available
            const cmdId = interaction.options.getString("cmd_id");
            console.log(`Running auto-cmd view. Id: ${cmdId || "N/A"}`);
        }
    }
}

async function parseCmd(interaction, strIn) {
    const command = {
        name: null,
        subcommand: null,
        options: [
            // {type, name, value}
        ],
    };

    let wipStr = strIn;

    if (wipStr.startsWith("/")) {
        const splitStr = wipStr.split(" ");
        command.name = splitStr.shift().replace("/", "").toLowerCase();
        wipStr = splitStr.join(" ").trim();
    }

    // If this mess of regex isn't null, then the next chunk should be a subcommand
    if (wipStr.match(/^(\s*[^:]+)(\s+\w|$)/)) {
        const splitStr = wipStr.split(" ");
        command.subcommand = splitStr.shift().trim();
        wipStr = splitStr.join(" ").trim();
    }

    // Grab the options data for the specified command
    const cmdOptionsData = interaction.client.slashcmds.get(command.name)?.commandData.options;

    // Grab just the subcommand's options if we're using a subcommand
    const thisOptions = command.subcommand?.length ? cmdOptionsData.find((o) => o.name === command.subcommand)?.options : cmdOptionsData;

    // Grab whatever mess of options:args we can from the rest of it
    while (wipStr.trim()?.length) {
        const match = wipStr.match(/(\s*\w+\s*:.+?(?=\w+:|$))/);
        if (!match) break;

        // Grab the name and value for this option
        wipStr = wipStr.replace(match[1], "");
        const [matchName, matchVal] = match[1].split(":").map((m) => m.trim());

        // Get the type if available.
        // If it's not, then it's an invalid option
        const cmdType = thisOptions.find((o) => o.name === matchName)?.type;
        if (!cmdType) break;

        command.options.push({
            name: matchName,
            value: matchVal,
            type: cmdType,
        });
    }
    return command;
}

module.exports = AutoCmd;
