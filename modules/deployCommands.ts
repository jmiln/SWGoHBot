import { readdirSync } from "node:fs";
import { join } from "node:path";
import { REST, Routes } from "discord.js";
import type { CommandMetadata } from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import logger from "./Logger.ts";

const slashDir = join(import.meta.dirname, "..", "slash");

/**
 * Loads all command metadata from slash directory
 */
async function loadCommandMetadata(): Promise<{ commands: CommandMetadata[]; failed: string[] }> {
    const commandFiles = readdirSync(slashDir).filter((file) => file.endsWith(".ts"));
    const commands: CommandMetadata[] = [];
    const failed: string[] = [];

    for (const file of commandFiles) {
        const commandName = file.split(".")[0];
        try {
            const path = `${slashDir}/${file}`;
            const { default: CommandClass } = await import(path);

            if (!CommandClass.metadata) {
                logger.error(`${commandName}: No static metadata found`);
                failed.push(`${commandName} (no metadata)`);
                continue;
            }

            if (CommandClass.metadata.enabled === false) {
                logger.log(`${commandName}: Skipped (disabled)`);
                continue;
            }

            if (!CommandClass.metadata.description) {
                logger.error(`${commandName}: No description found in metadata`);
                failed.push(`${commandName} (no description)`);
                continue;
            }

            commands.push(CommandClass.metadata);
            // logger.log(`[${CommandClass.metadata.guildOnly ? "Guild" : "Global"}] ${commandName}: Loaded`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`${commandName}: Failed to load - ${errorMsg}`);
            failed.push(`${commandName} (${errorMsg})`);
        }
    }

    return { commands, failed };
}

/**
 * Deploys commands to Discord API
 */
async function deployCommands(commands: CommandMetadata[]) {
    const rest = new REST().setToken(env.DISCORD_TOKEN);

    const globalCommands = commands
        .filter((cmd) => !cmd.guildOnly)
        .map((cmd) => {
            const { guildOnly, permLevel, enabled, ...other } = cmd;
            return other;
        });
    const guildCommands = commands
        .filter((cmd) => cmd.guildOnly)
        .map((cmd) => {
            const { guildOnly, permLevel, enabled, ...other } = cmd;
            return other;
        });

    logger.log("Deploying commands...\n");

    try {
        // Deploy global commands if enabled
        if (constants.enableGlobalCmds && globalCommands.length) {
            logger.log(`Deploying ${globalCommands.length} global commands...`);
            // logger.log(inspect(globalCommands, { depth: 5 }));
            await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
                body: globalCommands,
            });
            logger.log(`Deployed ${globalCommands.length} global commands`);
        } else if (!constants.enableGlobalCmds) {
            logger.log(" Global commands disabled in config");
        }

        // Deploy guild commands if dev_server is set
        if (env.DISCORD_DEV_SERVER && guildCommands.length) {
            logger.log(`Deploying ${guildCommands.length} guild commands to ${env.DISCORD_DEV_SERVER}...`);
            await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_DEV_SERVER), {
                body: guildCommands,
            });
            logger.log(`Deployed ${guildCommands.length} guild commands`);
        } else if (!env.DISCORD_DEV_SERVER && guildCommands.length) {
            logger.log(`${guildCommands.length} guild commands found but no dev_server configured`);
        }

        logger.log("Deployment complete!\n");
    } catch (error) {
        logger.error("Deployment failed:", error);
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main() {
    logger.log("SWGoHBot Command Deployment\n");
    logger.log("Loading commands from slash/...\n");

    const { commands, failed } = await loadCommandMetadata();

    logger.log(`Summary: ${commands.length} commands loaded`);
    logger.log(`   Global: ${commands.filter((c) => !c.guildOnly).length}`);
    logger.log(`   Guild: ${commands.filter((c) => c.guildOnly).length}`);

    if (failed.length > 0) {
        logger.error(`\nWARNING: ${failed.length} command(s) failed to load:`);
        for (const failedCmd of failed) {
            logger.error(`  - ${failedCmd}`);
        }
        logger.error("");
    }

    if (commands.length === 0) {
        logger.error("No commands to deploy!");
        process.exit(1);
    }

    await deployCommands(commands);
}

main().catch((err) => {
    logger.init(-1);
    logger.error("Fatal error:", err);
    process.exit(1);
});
