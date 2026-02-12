import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { isAllyCode } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext, UserConfig } from "../types/types.ts";

export default class Register extends Command {
    static readonly metadata = {
        name: "register",
        description: "Link an ally code to your account",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
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
    };
    constructor() {
        super(Register.metadata);
    }

    async run({ interaction, language, permLevel }: CommandContext) {
        // eslint-disable-line no-unused-vars
        const cooldown = await patreonFuncs.getPlayerCooldown(interaction.user.id, interaction?.guild?.id);

        let allycode = interaction.options.getString("allycode");
        let user = interaction.options.getUser("user");

        if (!isAllyCode(allycode)) {
            return super.error(
                interaction,
                `**${allycode}** is __NOT__ a valid ally code, please try again. Ally codes must have 9 numbers.`,
            );
            // return super.error(interaction, language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
        }
        // Wipe out any non-number characters just in case
        allycode = allycode.replace(/[^\d]*/g, "");

        // If they don't supply a user, themselves or otherwise, set it to use themself
        if (!user) {
            user = interaction.user;
        }

        // First off, make sure they're not trying to do something they shouldn't do...
        if (user.id !== interaction.user.id && permLevel < constants.permMap.GUILD_ADMIN) {
            // If they are trying to change someone else and they don't have the right permissions
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_MISSING_ROLE"));
        }
        if (interaction.guild && !interaction.guild.members.cache.has(user.id)) {
            // If they are trying to change something for someone in a different server
            return super.error(interaction, language.get("COMMAND_REGISTER_ADD_NO_SERVER"));
        }

        // Then, if not, move along
        // See if they have an entry in the DB already
        let userConfig: UserConfig = await userReg.getUser(user.id);
        if (userConfig?.accounts?.length && userConfig?.id !== user.id) {
            // If someone else is trying to change the code already registered, error out
            return super.error(interaction, "This account already has an ally code linked to it.");
        }

        if (!userConfig) {
            // If they don't exist in the DB yet, stick em with a default config
            userConfig = JSON.parse(JSON.stringify(constants.defaultUserConf)) as Partial<UserConfig> as UserConfig;
            userConfig.id = user.id;
        } else if (userConfig.accounts.find((a) => a.allyCode === allycode && a.primary)) {
            // This ally code is already registered & primary
            return super.error(interaction, language.get("COMMAND_REGISTER_ALREADY_REGISTERED"));
        } else if (userConfig.accounts.find((a) => a.allyCode === allycode && !a.primary)) {
            // This ally code is already registered but not primary, so just swap it over
            userConfig.accounts = userConfig.accounts.map((a) => {
                if (a.primary) a.primary = false;
                if (a.allyCode === allycode) a.primary = true;
                return a;
            });
            userConfig = await userReg.updateUser(user.id, userConfig);
            const u = userConfig.accounts.find((a) => a.primary);
            return super.success(
                interaction,
                codeBlock("asciiDoc", language.get("COMMAND_REGISTER_SUCCESS_DESC", u, u.allyCode?.toString().match(/\d{3}/g).join("-"))),
                {
                    title: language.get("COMMAND_REGISTER_SUCCESS_HEADER", u.name),
                },
            );
        } else {
            // They're registered with a different ally code, so turn off all the other primaries
            userConfig.accounts = userConfig.accounts.map((a) => {
                a.primary = false;
                return a;
            });
        }

        // Tell em to wait because it could take a be to find their info
        await interaction.reply({ content: language.get("COMMAND_REGISTER_PLEASE_WAIT") });

        try {
            const playerRes: SWAPIPlayer[] = await swgohAPI.unitStats(Number.parseInt(allycode, 10), cooldown);
            const player = playerRes?.[0] || null;
            if (!player) {
                return super.error(interaction, language.get("COMMAND_REGISTER_FAILURE") + allycode);
            }
            userConfig.accounts.push({
                allyCode: allycode,
                name: player.name,
                primary: true,
            });
            await userReg
                .updateUser(user.id, userConfig)
                .then(async () => {
                    return super.success(
                        interaction,
                        codeBlock(
                            "asciiDoc",
                            language.get(
                                "COMMAND_REGISTER_SUCCESS_DESC",
                                player,
                                player.allyCode?.toString().match(/\d{3}/g).join("-"),
                                player.stats.find((s) => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value.toLocaleString(),
                            ),
                        ),
                        {
                            title: language.get("COMMAND_REGISTER_SUCCESS_HEADER", player.name),
                        },
                    );
                })
                .catch((e: Error) => {
                    logger.error(`[REGISTER] Broke while trying to link new user: ${e}`);
                    return super.error(interaction, codeBlock(e.message), {
                        title: language.get("BASE_SOMETHING_BROKE"),
                        footer: "Please try again in a bit.",
                    });
                });
        } catch (e) {
            logger.error(`[REGISTER] Incorrect Ally Code: ${e}`);
            return super.error(interaction, `Something broke. Make sure you've got the correct ally code${codeBlock(e.message)}`);
        }
    }
}
