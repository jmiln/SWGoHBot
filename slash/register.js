import { ApplicationCommandOptionType, codeBlock } from "discord.js";
import Command from "../base/slashCommand.js";

export default class Register extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "register",
            guildOnly: false,
            options: [
                {
                    name: "allycode",
                    description: "The ally code for the user you want to look up",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
                {
                    name: "user",
                    description: "The user you want to link to an ally code. (You must have mod/ admin perms for this)",
                    type: ApplicationCommandOptionType.User,
                },
            ],
        });
    }

    async run(Bot, interaction, options) {
        // eslint-disable-line no-unused-vars
        const cooldown = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        let allycode = interaction.options.getString("allycode");
        let user = interaction.options.getUser("user");

        if (!Bot.isAllyCode(allycode)) {
            return super.error(
                interaction,
                `**${allycode}** is __NOT__ a valid ally code, please try again. Ally codes must have 9 numbers.`,
            );
            // return super.error(interaction, interaction.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
        }
        // Wipe out any non-number characters just in case
        allycode = allycode.replace(/[^\d]*/g, "");

        // If they don't supply a user, themselves or otherwise, set it to use themself
        if (!user) {
            user = interaction.user;
        }

        // First off, make sure they're not trying to do something they shouldn't do...
        if (user.id !== interaction.user.id && options.level < Bot.constants.GUILD_ADMIN) {
            // If they are trying to change someone else and they don't have the right permissions
            return super.error(interaction, interaction.language.get("COMMAND_SHARDTIMES_MISSING_ROLE"));
        }
        if (interaction.guild && !interaction.guild.members.cache.has(user.id)) {
            // If they are trying to change something for someone in a different server
            return super.error(interaction, interaction.language.get("COMMAND_REGISTER_ADD_NO_SERVER"));
        }

        // Then, if not, move along
        // See if they have an entry in the DB already
        let userReg = await Bot.userReg.getUser(user.id);
        if (userReg?.accounts?.length && userReg?.id !== user.id) {
            // If someone else is trying to change the code already registered, error out
            return super.error(interaction, "This account already has an ally code linked to it.");
        }

        if (!userReg) {
            // If they don't exist in the DB yet, stick em with a default config
            userReg = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
            userReg.id = user.id;
        } else if (userReg.accounts.find((a) => a.allyCode === allycode && a.primary)) {
            // This ally code is already registered & primary
            return super.error(interaction, interaction.language.get("COMMAND_REGISTER_ALREADY_REGISTERED"));
        } else if (userReg.accounts.find((a) => a.allyCode === allycode && !a.primary)) {
            // This ally code is already registered but not primary, so just swap it over
            userReg.accounts = userReg.accounts.map((a) => {
                if (a.primary) a.primary = false;
                if (a.allyCode === allycode) a.primary = true;
                return a;
            });
            userReg = await Bot.userReg.updateUser(user.id, userReg);
            const u = userReg.accounts.find((a) => a.primary);
            return super.success(
                interaction,
                codeBlock(
                    "asciiDoc",
                    interaction.language.get("COMMAND_REGISTER_SUCCESS_DESC", u, u.allyCode?.toString().match(/\d{3}/g).join("-")),
                ),
                {
                    title: interaction.language.get("COMMAND_REGISTER_SUCCESS_HEADER", u.name),
                },
            );
        } else {
            // They're registered with a different ally code, so turn off all the other primaries
            userReg.accounts = userReg.accounts.map((a) => {
                a.primary = false;
                return a;
            });
        }

        // Tell em to wait because it could take a be to find their info
        await interaction.reply({ content: interaction.language.get("COMMAND_REGISTER_PLEASE_WAIT") });

        try {
            let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
            if (!player) {
                return super.error(interaction, interaction.language.get("COMMAND_REGISTER_FAILURE") + allycode);
            }
            userReg.accounts.push({
                allyCode: allycode,
                name: player.name,
                primary: true,
            });
            await Bot.userReg
                .updateUser(user.id, userReg)
                .then(async () => {
                    return super.success(
                        interaction,
                        codeBlock(
                            "asciiDoc",
                            interaction.language.get(
                                "COMMAND_REGISTER_SUCCESS_DESC",
                                player,
                                player.allyCode?.toString().match(/\d{3}/g).join("-"),
                                player.stats.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value.toLocaleString(),
                            ),
                        ),
                        {
                            title: interaction.language.get("COMMAND_REGISTER_SUCCESS_HEADER", player.name),
                        },
                    );
                })
                .catch((e) => {
                    Bot.logger.error(`[REGISTER] Broke while trying to link new user: ${e}`);
                    return super.error(interaction, codeBlock(e.message), {
                        title: interaction.language.get("BASE_SOMETHING_BROKE"),
                        footer: "Please try again in a bit.",
                        edit: true,
                    });
                });
        } catch (e) {
            Bot.logger.error(`[REGISTER] Incorrect Ally Code: ${e}`);
            return super.error(interaction, `Something broke. Make sure you've got the correct ally code${codeBlock(e.message)}`);
        }
    }
}
