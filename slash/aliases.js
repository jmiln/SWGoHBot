const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

const { getGuildAliases, setGuildAliases } = require("../modules/guildConfig/aliases");

class Aliases extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "aliases",
            description: "Set custom aliases for your guild to use",
            guildOnly: false,
            permLevel: 3,
            options: [
                {
                    name: "add",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Add a unit alias",
                    options: [
                        {
                            name: "unit",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            description: "The unit that you want to add an alias for",
                            required: true,
                        },
                        {
                            name: "alias",
                            type: ApplicationCommandOptionType.String,
                            description: "The alias for the selected unit",
                            required: true,
                        },
                    ],
                },
                {
                    name: "remove",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Remove an alias",
                    options: [
                        {
                            name: "alias",
                            type: ApplicationCommandOptionType.String,
                            description: "The alias to remove",
                            required: true,
                        },
                    ],
                },
                {
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "View your current aliases",
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const action = interaction.options.getSubcommand();
        const searchUnit = interaction.options.getString("unit");
        const alias = interaction.options.getString("alias");

        // Load up all the guild's settings and such
        const guildAliases = await getGuildAliases({ cache: Bot.cache, guildId: interaction.guild.id });

        // Make sure this is running in a server, since it doesn't do any good in DMs
        if (!interaction?.guild?.id) return super.error(interaction, "Sorry, but this command is only usable in servers");

        if (action === "add") {
            // Make sure both fields were filled. They're both marked required so it shouldn't hit this, but just in case.
            if (!searchUnit || !alias) return super.error(interaction, "Both fields MUST be filled in. Please try again.");

            // Grab the unit if available, then complain if not found
            const unit =
                Bot.characters.find((char) => char.uniqueName === searchUnit) || Bot.ships.find((ship) => ship.uniqueName === searchUnit);
            if (!unit) return super.error(interaction, `I couldn't find a matching unit for '${searchUnit}'`);

            // If the selected alias is already in use, alert em and back out
            if (guildAliases.filter((al) => al.alias === alias)?.length)
                return super.error(interaction, `This alias is already in use for ***${unit.name}***`);

            // If it makes it here, everything *should* be fine, so go ahead and save it
            guildAliases.push({ alias: alias, defId: unit.uniqueName, name: unit.name });
            const res = await setGuildAliases({ cache: Bot.cache, guildId: interaction.guild.id, aliasesOut: guildAliases });

            // Then report on it either saving properly or breaking
            if (res?.error) return super.error(interaction, `There was an issue when submitting that: \n${res.error}`);
            super.success(interaction, `Your alias (${alias}) for ***${unit.name}*** has been successfully submitted`);
        } else if (action === "remove") {
            // We're removing an alias
            if (!guildAliases.filter((al) => al.alias === alias)?.length) return super.error(interaction, "That isn't a current alias.");

            // Set the aliases back, with the specified one removed
            const res = await setGuildAliases({
                cache: Bot.cache,
                guildId: interaction.guild.id,
                aliasesOut: guildAliases.filter((al) => al.alias !== alias),
            });

            // Then report on it either saving properly or breaking
            if (res?.error) return super.error(interaction, `There was an issue when submitting that: \n${res.error}`);
            super.success(interaction, `Your alias (${alias}) has been successfully removed.`);
        } else {
            return interaction.reply({ content: `>>> ${`- ${guildAliases.map((al) => `${al.alias} - ${al.name}`).join("\n- ")}`}` });
        }
    }
}

module.exports = Aliases;
