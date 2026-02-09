import { type Client, type Embed, type Message, PermissionsBitField, TextChannel } from "discord.js";
import Language from "../base/Language.ts";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import patreonModule from "../data/patreon.ts";
import type { RawGuild, SWAPIGuild } from "../types/swapi_types.ts";
import type { ActivePatron, ArenaWatchAcct, PatronUser, PlayerArenaRes, PlayerUpdates, UserAcct, UserConfig } from "../types/types.ts";
import cache from "./cache.ts";
import { chunkArray, expandSpaces, formatDuration, getUTCFromOffset, msgArray, toProperCase, wait } from "./functions.ts";
import { getGuildSupporterTier } from "./guildConfig/patreonSettings.ts";
import logger from "./Logger.ts";
import swgohAPI from "./swapi.ts";
import userReg from "./users.ts";

const tiers = patreonModule.tiers;

// Arena payout offsets (hours difference from daily reset)
const ARENA_OFFSETS = {
    char: 6,
    fleet: 5,
} as const;

// Patron tier thresholds (in cents)
const TIER_1_CENTS = 100; // $1
const TIER_5_CENTS = 500; // $5
const TIER_10_CENTS = 1000; // $10

class PatreonFuncs {
    private client!: Client<true>;

    /**
     * Initialize the PatreonFuncs module with Discord client dependency
     */
    init(client: Client<true>): void {
        this.client = client;
    }

    // Check if a given user is a patron, and if so, return their info
    async getPatronUser(userId: string): Promise<PatronUser | null> {
        if (!userId) throw new Error("Missing user ID");

        // Try and get em from the db
        const patron = (await cache.getOne("swgohbot", "patrons", { discordID: userId })) as PatronUser;

        // If they aren't in the db, see if we have em in there manually
        if (!patron && config.patrons?.[userId]) {
            const currentAmountCents = config.patrons[userId];
            const currentTierNum = this.getPatreonTier({ amount_cents: currentAmountCents });
            const currentTier = tiers[currentTierNum];
            return {
                userId: userId,
                playerTime: currentTier.playerTime,
                guildTime: currentTier.guildTime,
                awAccounts: currentTier.awAccounts,
                discordID: userId,
                amount_cents: currentAmountCents,
            };
        }

        // If they're not in either spot, return null
        if (!patron) return null;

        const currentTierNum = this.getPatreonTier(patron);
        if (!currentTierNum) return null;
        const currentTier = tiers[currentTierNum];

        if (patron && !patron.declined_since) {
            return {
                ...patron,
                playerTime: currentTier.playerTime,
                guildTime: currentTier.guildTime,
                awAccounts: currentTier.awAccounts,
            };
        }

        return null;
    }

    // Get the cooldown for the given player
    //  - If the user is a Patreon subscriber or someone in their server selected it as their bonus
    //      * Give them the best lowered times available to them
    //  - If the user isn't a subscriber, and no one in their server selected it
    //      * Give them the defaults set in the data/patreon.js file
    async getPlayerCooldown(userId: string, guildId?: string): Promise<{ player: number; guild: number }> {
        const patron = await this.getPatronUser(userId);

        // This will give the highest/ combined tier that anyone has set for the server, or 0 if none
        const supporterTier = await getGuildSupporterTier({ guildId });

        // Grab the best times available based on the supporterTier
        const supporterTimes: { playerTime: number; guildTime: number } = !tiers?.[supporterTier]?.sharePlayer
            ? tiers[0]
            : {
                  playerTime: tiers[supporterTier].sharePlayer,
                  guildTime: tiers[supporterTier].shareGuild,
              };

        // Grab the best times for the user themselves, patreon sub or not
        const playerTier = this.getPatreonTier(patron);
        const playerTimes: { playerTime: number; guildTime: number } = tiers?.[playerTier] || tiers[0];

        // Return the best times available between the supporter and the user
        return {
            player: playerTimes?.playerTime < supporterTimes?.playerTime ? playerTimes.playerTime : supporterTimes.playerTime,
            guild: playerTimes?.guildTime < supporterTimes?.guildTime ? playerTimes.guildTime : supporterTimes.guildTime,
        };
    }

    // Check for updated ranks
    async getRanks(): Promise<void> {
        const patrons = await this.getActivePatrons();
        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user: UserConfig = await userReg.getUser(patron.discordID);
            // If they're not registered with anything or don't have any ally codes
            if (!user?.accounts?.length) continue;

            // Check for missing values
            if (!user.arenaAlert.payoutWarning) user.arenaAlert.payoutWarning = 0;
            if (!user.arenaAlert.arena) {
                user.arenaAlert.arena = "none";
            }

            // If they don't want any alerts
            if (!user.arenaAlert || user.arenaAlert.enableRankDMs === "off" || user.arenaAlert.arena === "none") continue;

            const accountsToCheck = structuredClone(user.accounts);

            for (const [ix, acc] of accountsToCheck.entries()) {
                // If the user only has em enabled for the primary ac, ignore the rest
                if (
                    ((user.accounts.length > 1 && patron.amount_cents < TIER_5_CENTS) || user.arenaAlert.enableRankDMs === "primary") &&
                    !acc.primary
                ) {
                    continue;
                }

                let player: PlayerArenaRes;
                try {
                    const playerRes = await swgohAPI.getPlayersArena(Number.parseInt(acc.allyCode, 10));
                    player = playerRes?.[0] || null;
                } catch (e) {
                    // Wait since it won't happen later when something breaks
                    await wait(750);
                    logger.error(`Broke in getRanks: ${e}`);
                    continue;
                }
                if (!acc.lastCharRank) {
                    acc.lastCharRank = 0;
                    acc.lastCharClimb = 0;
                }
                if (!acc.lastShipRank) {
                    acc.lastShipRank = 0;
                    acc.lastShipClimb = 0;
                }

                // Log if the bot cannot get data for a player
                if (!player) {
                    logger.log(`[patreonFuncs/getRanks] Missing player object for ${acc.allyCode}`);
                    continue;
                }
                if (!player?.arena) {
                    logger.log(`[patreonFuncs/getRanks] No player arena: ${JSON.stringify(player)}`);
                    continue;
                }
                const pCharRank = player?.arena?.char?.rank;
                const pShipRank = player?.arena?.ship?.rank;
                if (!pCharRank && pCharRank !== 0 && !pShipRank && pShipRank !== 0) {
                    logger.error(`[patreonFuncs/getRanks] No arena ranks: ${JSON.stringify(player)}`);
                    continue;
                }

                // Handle character arena alerts
                await this.handleArenaAlerts("char", player, acc, user, patron);

                // Handle ship arena alerts
                await this.handleArenaAlerts("ship", player, acc, user, patron);

                // Save this back to the user
                user.accounts[ix] = acc;

                // Wait here in case of extra accounts
                await wait(750);
            }
            await userReg.updateUser(patron.discordID, user);
        }
    }

    // Send/ update a shard payout times message (Automated shardtimes)
    async shardTimes(): Promise<void> {
        const patrons = await this.getActivePatrons();
        for (const patron of patrons) {
            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user = await userReg.getUser(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.arenaWatch || !user.arenaWatch.payout) continue;
            const aw = user.arenaWatch;

            // Make sure at least one of the alerts is enabled, no point otherwise
            if (!aw?.payout) continue;
            if ((!aw.payout?.char.enabled || !aw.payout.char.channel) && (!aw.payout?.fleet.enabled || !aw.payout.fleet.channel)) continue;

            // Make a copy just in case, so nothing goes wonky
            let acctCount = 0;
            if (patron.amount_cents < TIER_5_CENTS) acctCount = config.arenaWatchConfig.tier1;
            else if (patron.amount_cents < TIER_10_CENTS) acctCount = config.arenaWatchConfig.tier2;
            else acctCount = config.arenaWatchConfig.tier3;

            const players = structuredClone(aw.allycodes.slice(0, acctCount));
            if (!players || !players.length) continue;

            // If char is enabled, send it there
            if (aw?.payout?.char?.enabled && aw.payout.char.channel) {
                const playerTimes = this.getPayoutTimes(players, "char");
                const formattedEmbed = this.formatPayouts(playerTimes, "char");
                const sentMessage = (await this.sendBroadcastMsg(aw.payout.char.msgID, aw.payout.char.channel, formattedEmbed)) as Message;
                if (sentMessage) {
                    user.arenaWatch.payout.char.msgID = sentMessage.id;
                }
            }
            // Then if fleet is enabled, send it there as well/ instead
            if (aw.payout?.fleet?.enabled && aw.payout.fleet.channel) {
                const playerTimes = this.getPayoutTimes(players, "fleet");
                const formattedEmbed = this.formatPayouts(playerTimes, "fleet");
                const sentMessage = (await this.sendBroadcastMsg(
                    aw.payout.fleet.msgID,
                    aw.payout.fleet.channel,
                    formattedEmbed,
                )) as Message;
                if (sentMessage) {
                    user.arenaWatch.payout.fleet.msgID = sentMessage.id;
                }
            }
            // Update the user in case something changed (Likely message ID)
            await userReg.updateUser(patron.discordID, user);
        }
    }

    // Check for updated ranks across up to 50 players
    async shardRanks(): Promise<void> {
        const patrons = await this.getActivePatrons();
        for (const patron of patrons) {
            const compChar = []; // Array to keep track of allycode, toRank, and fromRank
            const compShip = []; // Array to keep track of allycode, toRank, and fromRank
            // For each person that qualifies, go through their list
            //   - Check their patreon level and go through their top x ally codes based on the lvl
            //   - check the arena rank
            //   - save that change somewhere
            //   - for each next one, see if someone else had the opposite move

            // user = {
            //     ...
            //     arenaWatch: {
            //         enabled: true/ false,
            //         arena: {
            //             fleet: {
            //                 channel: chID,
            //                 enabled: true/ false
            //             },
            //             char: {
            //                 channel: chID,
            //                 enabled: true/ false
            //             }
            //         }
            //         allycodes: [
            //             {
            //                 "allyCode": 123123123                // The player's ally code
            //                 "name" :    "NameHere"               // The player's name (From the game)
            //                 "mention":  "discordUserID"          // If they want to be mentioned when they drop, their ID goes here
            //                 "lastChar": 53                       // Their last char arena rank
            //                 "lastShip": 35                       // Their last ship arena rank
            //                 "poOffset": -480                     // The utc offset for their payout
            //                 "mark" :    "Emote/Mark"             // An emote or other mark to tag a player in the monitor
            //                 "warn":     {min: 30, arena: ""}     // # of min before a payout to mention someone
            //                 "result":   "none|char|fleet|both"   // This will send a message with their payout result, and mention em if available
            //              }
            //         ]
            //     }
            // };
            // payout = {
            //     // Temp ones that don't get saved
            //     "charDuration"
            //     "charTimeTil"
            //     "fleetDuration"
            //     "fleetTimeTil"
            // }

            if (patron.amount_cents < TIER_1_CENTS) continue;
            const user = await userReg.getUser(patron.discordID);

            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.accounts || !user.accounts.length || !user.arenaWatch) continue;
            const aw = user.arenaWatch;

            // Check if they have either alerts or payouts enabled
            const hasAlerts =
                aw?.enabled &&
                (aw.arena?.fleet?.channel || aw.arena?.char?.channel) &&
                (aw.arena?.fleet?.enabled || aw.arena?.char?.enabled);
            const hasPayouts =
                aw?.payout &&
                ((aw.payout?.char?.enabled && aw.payout?.char?.channel) || (aw.payout?.fleet?.enabled && aw.payout?.fleet?.channel));

            // If they don't want any alerts or payouts, skip
            if (!hasAlerts && !hasPayouts) {
                continue;
            }

            let acctCount = 0;
            if (patron.amount_cents < TIER_5_CENTS) acctCount = config.arenaWatchConfig.tier1;
            else if (patron.amount_cents < TIER_10_CENTS) acctCount = config.arenaWatchConfig.tier2;
            else acctCount = config.arenaWatchConfig.tier3;

            const accountsToCheck: ArenaWatchAcct[] = structuredClone(aw.allycodes.slice(0, acctCount));
            const allyCodes: number[] = accountsToCheck.map((a) => a.allyCode || null);
            if (!allyCodes || !allyCodes.length) continue;

            const newPlayers = await swgohAPI.getPlayersArena(allyCodes);

            // Go through all the listed players, and see if any of them have shifted arena rank or payouts incoming
            let charOut = [];
            let shipOut = [];
            for (const [ix, player] of accountsToCheck.entries()) {
                const newPlayer = newPlayers.find((p) => p.allyCode === player.allyCode);
                if (!newPlayer?.arena?.char?.rank && !newPlayer?.arena?.ship?.rank) {
                    // Both, since low level players can have just char arena I believe
                    continue;
                }
                if (!player.name) {
                    player.name = newPlayer.name;
                }
                if (!player.poOffset || player.poOffset !== newPlayer.poUTCOffsetMinutes) {
                    player.poOffset = newPlayer.poUTCOffsetMinutes;
                }
                if (!player.lastChar || newPlayer.arena.char.rank !== player.lastChar) {
                    const charOverview = {
                        name: player.mention ? `<@${player.mention}>` : newPlayer.name,
                        allyCode: player.allyCode,
                        oldRank: player.lastChar ?? 0,
                        newRank: newPlayer.arena.char.rank,
                        mark: player.mark,
                    };
                    compChar.push(charOverview);
                    player.lastChar = newPlayer.arena.char.rank;
                    player.lastCharChange = charOverview.oldRank - charOverview.newRank;
                }
                if (!player.lastShip || newPlayer.arena.ship.rank !== player.lastShip) {
                    const shipOverview = {
                        name: player.mention ? `<@${player.mention}>` : newPlayer.name,
                        allyCode: player.allyCode,
                        oldRank: player.lastShip ?? 0,
                        newRank: newPlayer.arena.ship.rank,
                        mark: player.mark,
                    };
                    compShip.push(shipOverview);
                    player.lastShip = newPlayer.arena.ship.rank;
                    player.lastShipChange = shipOverview.oldRank - shipOverview.newRank;
                }

                if (player.result || (player.warn && player.warn.min > 0 && player.warn.arena)) {
                    const payouts = this.getAllPayoutTimes(player);
                    let pName = player.mention ? `<@${player.mention}>` : player.name;
                    if (aw.useMarksInLog && player.mark) {
                        pName = `${player.mark} ${pName}`;
                    }
                    const charMinLeft = Math.floor(payouts.charDuration);
                    const fleetMinLeft = Math.floor(payouts.fleetDuration);
                    if (charMinLeft === 0 && ["char", "both"].includes(player.result)) {
                        // If they have char payouts turned on, do that here
                        charOut.push(`${pName} finished at ${player.lastChar} in character arena`);
                    }
                    if (player.warn?.min && ["char", "both"].includes(player.warn.arena) && charMinLeft === player.warn.min) {
                        // Warn them of their upcoming payout if this is enabled
                        charOut.push(`${pName}'s **character** arena payout is in ${`${player.warn.min} minutes`}`);
                    }
                    if (fleetMinLeft === 0 && ["fleet", "both"].includes(player.result)) {
                        // If they have fleet payouts turned on, do that here
                        shipOut.push(`${pName} finished at ${player.lastShip} in fleet arena`);
                    }
                    if (player.warn?.min && ["fleet", "both"].includes(player.warn.arena) && fleetMinLeft === player.warn.min) {
                        // Warn them of their upcoming payout if this is enabled
                        shipOut.push(`${pName}'s **fleet** arena payout is in ${`${player.warn.min} minutes`}`);
                    }
                }
                accountsToCheck[ix] = player;
            }

            if (compChar.length && aw.arena?.char.enabled) {
                charOut = charOut.concat(this.checkRanks(compChar, aw));
            }
            if (compShip.length && aw.arena?.fleet.enabled) {
                shipOut = shipOut.concat(this.checkRanks(compShip, aw));
            }

            const charFields = [];
            const shipFields = [];
            if (charOut.length) {
                charFields.push("**Character Arena:**");
                charFields.push(charOut.map((c) => `- ${c}`).join("\n"));
            }
            if (shipOut.length) {
                shipFields.push("**Fleet Arena:**");
                shipFields.push(shipOut.map((c) => `- ${c}`).join("\n"));
            }

            // Update the player so shardTimes always has the latest info
            user.arenaWatch.allycodes = accountsToCheck;
            await userReg.updateUser(patron.discordID, user);

            // Only send the alerts if there have been rank changes, and the user has alerts enabled
            if ((charFields.length || shipFields.length) && hasAlerts) {
                if (aw.arena.char.channel === aw.arena.fleet.channel) {
                    // If they're both set to the same channel, send it all
                    const fields = charFields.concat(shipFields);
                    await this.client.shard.broadcastEval(
                        async (client, { aw, fields }) => {
                            const chan = client.channels.cache.get(aw.arena.char.channel);
                            if (
                                chan instanceof TextChannel &&
                                chan
                                    ?.permissionsFor(client.user)
                                    .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                            ) {
                                await chan.send(`>>> ${fields.join("\n")}`);
                            }
                        },
                        { context: { aw: aw, fields: fields } },
                    );
                } else {
                    // Else they each have their own channels, so send em there
                    if (aw.arena.char.channel && aw.arena.char.enabled && charFields.length) {
                        await this.client.shard.broadcastEval(
                            async (client, { aw, charFields }) => {
                                const chan = client.channels.cache.get(aw.arena.char.channel);
                                if (
                                    chan instanceof TextChannel &&
                                    chan
                                        ?.permissionsFor(client.user)
                                        .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                                ) {
                                    await chan.send(`>>> ${charFields.join("\n")}`);
                                }
                            },
                            { context: { aw: aw, charFields: charFields } },
                        );
                    }
                    if (aw.arena.fleet.channel && aw.arena.fleet.enabled && shipFields.length) {
                        await this.client.shard.broadcastEval(
                            async (client, { aw, shipFields }) => {
                                const chan = client.channels.cache.get(aw.arena.fleet.channel);
                                if (
                                    chan instanceof TextChannel &&
                                    chan
                                        ?.permissionsFor(client.user)
                                        .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                                ) {
                                    await chan.send(`>>> ${shipFields.join("\n")}`);
                                }
                            },
                            { context: { aw: aw, shipFields: shipFields } },
                        );
                    }
                }
            }
        }
    }

    async guildsUpdate(): Promise<void> {
        const patrons = await this.getActivePatrons();
        for (const patron of patrons) {
            // Make sure to pass if there's no DiscordId or not at least in the $1 tier
            if (!patron.discordID || patron.amount_cents < TIER_1_CENTS) continue;
            const user = await userReg.getUser(patron.discordID);

            // If the guild update isn't enabled, then move along
            if (!user?.guildUpdate?.enabled) continue;
            const gu = user.guildUpdate;
            if (!gu?.allycode) continue;
            if (!gu?.channel) continue;

            // This is what will be in the user.guildUpdate, possibly add something
            // in to make it so it only shows above x gear lvl and such later?

            // gu = {
            //     enabled: false,          // If it's enabled or not
            //     allycode: 123123123,     // Ally code to watch the guild of
            //     channel: channelID,      // The channel to log all this into
            // }

            // Check if the bot is able to send messages into the set channel
            const chanAvail = await this.isChannelAvailable(gu.channel);

            // If the channel is not available, move on
            if (!chanAvail) continue;

            // Get any updates for the guild
            let guild: SWAPIGuild = null;
            try {
                guild = await swgohAPI.guild(gu.allycode);
            } catch (err) {
                if (err.toString().includes("not in a guild")) continue;
                logger.error(`[patreonFuncs/guildsUpdate] Issue getting the guild from ${gu.allycode}: ${err}`);
                continue;
            }
            if (!guild?.roster) {
                logger.error(
                    `[patreonFuncs/guildsUpdate] Could not get the guild/ roster for ${gu.allycode}, guild output: ${JSON.stringify(guild)}`,
                );
                return;
            }

            let guildLog: PlayerUpdates;
            try {
                if (!guild?.roster?.length) {
                    logger.error(`[patreonFuncs/guildsUpdate] Cannot get the roster for ${gu.allycode}`);
                    return;
                }
                guildLog = await swgohAPI.getPlayerUpdates(guild.roster.map((m) => m.allyCode));
            } catch (err) {
                logger.error(`[patreonFuncs/guildsUpdate] rosterLen: ${guild?.roster?.length}\n${err}`);
                return;
            }

            // If there were not changes found, move along, not the changes we were looking for
            if (!Object.keys(guildLog).length) continue;

            // Processs the guild changes
            const fields = [];
            for (const memberName of Object.keys(guildLog).sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))) {
                const member = guildLog[memberName];
                const fieldVal = [];
                for (const cat of Object.keys(member)) {
                    if (!member[cat].length) continue;
                    fieldVal.push(...member[cat]);
                }

                // Run it through the splitter in case it needs it
                const outVals = msgArray(fieldVal, "\n", 900);
                for (const [ix, val] of outVals.entries()) {
                    fields.push({
                        name: ix === 0 ? memberName : `${memberName} (cont)`,
                        value: val,
                    });
                }
            }

            // If something went wonky and there were no fields put in, move along
            if (!fields.length) continue;

            const MAX_FIELDS = 6;
            const fieldsOut = chunkArray(fields, MAX_FIELDS);

            for (const fieldChunk of fieldsOut) {
                await this.client.shard.broadcastEval(
                    async (client, { guChan, fieldChunk }) => {
                        const channel = client.channels.cache.get(guChan);
                        if (
                            channel instanceof TextChannel &&
                            channel?.guild &&
                            channel
                                .permissionsFor(client.user)
                                .has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                        ) {
                            return channel.send({
                                embeds: [
                                    {
                                        fields: fieldChunk,
                                    },
                                ],
                            });
                        }
                        return false;
                    },
                    {
                        context: {
                            guChan: gu.channel,
                            fieldChunk: fieldChunk,
                        },
                    },
                );
            }
        }
    }

    // Check guild tickets for each applicable member, and send the list of anyone who has not gotten 600 (Or their set value) yet
    async guildTickets(): Promise<void> {
        const patrons = await this.getActivePatrons();
        const nowTime = Date.now();
        for (const patron of patrons) {
            // Make sure to pass if there's no DiscordId or not at least in the $1 tier
            if (!patron.discordID || patron.amount_cents < TIER_1_CENTS) continue;

            // This is what will be in the user.guildTickets
            // gt = {
            //     enabled:  false,                 // If it's enabled or not
            //     allycode: 123123123,             // Ally code to watch the guild of
            //     channel:  channelID,             // The channel to log all this into
            //     sortBy:   "name" / "tickets",    // What to sort the list by (Defaults to name)
            //     tickets: 600,                    // The ticket count to consider players to be finished at (Defaults to the game's max of 600)
            //     updateType: "msg" / "update",    // Whether to send one message before the ticket reset, or update a message every 5min
            //
            //     // NOTE The following are automatically set (Not user-changeable)
            //     msgId: messageID,                    // The ID for the saved message, if we're updating it each time
            //     // NOTE This can help it not be checked constantly, for the msg type, so less game pulls
            //     nextChallengesRefresh: refreshTime,  // The last rawGuild.nextChallengesRefresh that was checked
            // }

            // Get the user's saved data
            const user = await userReg.getUser(patron.discordID);

            // If the guild update isn't enabled, or is missing some needed info, move along
            const gt = user?.guildTickets;
            if (!gt?.enabled) continue;
            if (!gt?.allycode) continue;
            if (!gt?.channel) continue;

            const MAX_TICKETS = gt?.tickets || 600;
            const isMsgType = gt?.updateType === "msg";

            // If it's a user that only wants the message right before reset, don't bother getting all the info together at other times.
            const refresh = Number.parseInt(gt.nextChallengesRefresh, 10);
            if (isMsgType && refresh && !this.isWithinTime(refresh, nowTime, 1, 5) && refresh > nowTime) {
                continue;
            }

            // Check if the bot is able to send messages into the set channel
            const chanAvail = await this.isChannelAvailable(gt.channel);

            // If the channel is not available, move on
            if (!chanAvail) continue;

            // Get any updates for the guild
            let rawGuild: RawGuild = null;
            try {
                rawGuild = await swgohAPI.getRawGuild(gt.allycode, null, { forceUpdate: true });
            } catch (err) {
                if (err.toString().includes("not in a guild")) continue;
                logger.error(`[patreonFuncs/guildsTickets] Issue getting the guild from ${gt.allycode}: ${err}`);
                continue;
            }

            // Set the nextChallengesRefresh to avoid extra api calls in the future
            if (gt?.nextChallengesRefresh !== rawGuild?.nextChallengesRefresh && rawGuild?.nextChallengesRefresh) {
                gt.nextChallengesRefresh = rawGuild.nextChallengesRefresh;
            }

            if (!rawGuild?.roster?.length) {
                logger.error(
                    `[patreonFuncs/guildsTickets] Could not get the guild/ roster for ${gt.allycode}, guild output: ${JSON.stringify(rawGuild)}`,
                );
                return;
            }

            let roster = null;
            if (gt.sortBy === "tickets") {
                roster = rawGuild.roster.sort((a, b) =>
                    Number.parseInt(a.memberContribution[2]?.currentValue, 10) > Number.parseInt(b.memberContribution[2]?.currentValue, 10)
                        ? 1
                        : -1,
                );
            } else {
                roster = rawGuild.roster.sort((a, b) => (a.playerName.toLowerCase() > b.playerName.toLowerCase() ? 1 : -1));
            }

            let timeUntilReset = null;
            const refreshTime = Number.parseInt(rawGuild.nextChallengesRefresh, 10) * 1000;

            if (refreshTime > nowTime) {
                // It's in the future
                timeUntilReset = formatDuration(refreshTime - nowTime, Language.getLanguages()[defaultSettings.language]);
            } else {
                // It's in the past, so calculate the next time
                timeUntilReset = formatDuration(refreshTime + constants.dayMS - nowTime, Language.getLanguages()[defaultSettings.language]);
            }

            // If the user only wants the message, and we didn't have a saved refreshTime for them, check here
            if (isMsgType && !this.isWithinTime(refreshTime, nowTime, 1, 5)) {
                continue;
            }

            let maxed = 0;
            const outArr = [];
            for (const member of roster) {
                const tickets = member.memberContribution["2"].currentValue;
                if (tickets < MAX_TICKETS) {
                    outArr.push(expandSpaces(`\`${tickets.toString().padStart(3)}\` - ${`**${member.playerName}**`}`));
                } else if (isMsgType || gt?.showMax) {
                    // Bold/ italicise the maxed players' counts
                    outArr.push(expandSpaces(`***\`${tickets.toString().padStart(3)}\`*** - ${`**${member.playerName}**`}`));
                } else {
                    maxed += 1;
                }
            }
            const timeTilString = `***Time until reset: ${timeUntilReset}***\n\n`;
            const maxedString = maxed > 0 ? `**${maxed}** members with ${MAX_TICKETS} tickets\n\n` : "";
            const outEmbed = {
                author: {
                    name: `${rawGuild.profile.name}'s Ticket Counts`,
                },
                description: `${timeTilString}${maxedString}${outArr.join("\n")}`,
                timestamp: new Date().toISOString(),
            };

            // If the user wants the messages just before each reset, send a new message instead of updating an old one
            //  - Just don't send the msg ID
            const sentMsg: Message = (await this.sendBroadcastMsg(
                gt?.updateType === "msg" ? null : gt.msgId,
                gt.channel,
                outEmbed,
            )) as Message;
            if (sentMsg && (!gt?.msgId || gt.msgId !== sentMsg.id)) {
                gt.msgId = sentMsg.id;
                user.guildTickets = gt;
                await userReg.updateUser(patron.discordID, user);
            }
        }
    }

    // Private helper methods

    private getPatreonTier(user: { amount_cents: number } | null): number {
        const patreonTiers = Object.keys(tiers).map((t) => Number.parseInt(t, 10));
        const amount_dollars = (user?.amount_cents || 0) / 100;
        const minTier = Math.min(...patreonTiers);

        // If no amount or less than minimum tier, return tier 0
        if (!amount_dollars || amount_dollars < minTier) return 0;

        let tierNum = minTier;
        for (const tier of patreonTiers) {
            if (amount_dollars >= tier) {
                tierNum = tier;
            } else {
                return tierNum;
            }
        }
        return tierNum;
    }

    // Get an array of all active patrons
    private async getActivePatrons(): Promise<ActivePatron[]> {
        let patrons = (await cache.get("swgohbot", "patrons", {})) as ActivePatron[];
        patrons = patrons.filter((p) => !p.declined_since);
        const others: string[] = Object.keys(config.patrons).length
            ? Object.keys(config.patrons).concat([config.ownerid])
            : [config.ownerid];
        for (const patUser of others) {
            const user = patrons.find((p) => p.discordID === patUser);
            if (!user) {
                patrons.push({
                    discordID: patUser,
                    amount_cents: config.patrons[patUser],
                });
            }
        }
        return patrons;
    }

    // Helper function to check if a channel is available and has proper permissions
    private async isChannelAvailable(channelId: string): Promise<boolean> {
        const channels = await this.client.shard.broadcastEval(
            async (client, { chanId }) => {
                const channel = client.channels.cache.get(chanId);
                if (
                    channel instanceof TextChannel &&
                    channel?.guild &&
                    channel.permissionsFor(client.user).has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                ) {
                    return true;
                }
                return false;
            },
            { context: { chanId: channelId } },
        );
        return channels.some((ch) => !!ch);
    }

    // Format the output for the payouts embed
    private formatPayouts(players: ArenaWatchAcct[], arena: "char" | "fleet") {
        const times = new Map<string, { players: ArenaWatchAcct[] }>();
        const arenaString = `last${toProperCase(arena === "fleet" ? "ship" : arena)}`;

        for (const player of players) {
            const rankString = player[arenaString].toString().padStart(3);
            player.outString = expandSpaces(
                `**\`${constants.zws} ${rankString} ${constants.zws}\`** - ${player.mark ? `${player.mark} ` : ""}${player.name}`,
            );
            const existingTime = times.get(player.timeTil);
            if (existingTime) {
                existingTime.players.push(player);
            } else {
                times.set(player.timeTil, {
                    players: [player],
                });
            }
        }
        const fieldOut = [];
        for (const [key, time] of times.entries()) {
            fieldOut.push({
                name: `PO in ${key}`,
                value: time.players
                    .sort((a: ArenaWatchAcct, b: ArenaWatchAcct) => a[arenaString] - b[arenaString])
                    .map((p: ArenaWatchAcct) => p.outString)
                    .join("\n"),
            });
        }
        return {
            title: "Payout Schedule",
            description: "=".repeat(25),
            fields: fieldOut,
            timestamp: new Date().toISOString(),
        };
    }

    // Go through the given list and return how long til payouts
    private getPayoutTimes(players: ArenaWatchAcct[], arena: "char" | "fleet") {
        for (const player of players) {
            if (!player.poOffset && player.poOffset !== 0) continue;

            const timeLeft = this.getTimeLeft(player.poOffset, ARENA_OFFSETS[arena]);
            player.duration = Math.floor(timeLeft / constants.minMS);
            player.timeTil = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;
        }
        return players.sort((a, b) => (a.duration > b.duration ? 1 : -1));
    }

    // Go through a given list and get the payout times for both arenas
    private getAllPayoutTimes(player: ArenaWatchAcct) {
        const payout = {
            poOffset: player.poOffset,
            charDuration: null,
            charTimeTil: null,
            fleetDuration: null,
            fleetTimeTil: null,
        };
        for (const arena of ["fleet", "char"] as const) {
            if (!payout.poOffset && payout.poOffset !== 0) continue;
            const timeLeft = this.getTimeLeft(player.poOffset, ARENA_OFFSETS[arena]);
            payout[`${arena}Duration`] = Math.floor(timeLeft / constants.minMS);
            payout[`${arena}TimeTil`] = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;
        }
        return payout;
    }

    // Compare ranks to see if we have both sides of the fight or not
    private checkRanks(
        inArr: { allyCode: string; name: string; oldRank: number; newRank: number; mark: string }[],
        aw: UserConfig["arenaWatch"],
    ) {
        const checked = [];
        const outArr = [];
        if (aw.showvs) {
            // If the setting is on, show when the ranks match up
            for (let ix = 0; ix < inArr.length; ix++) {
                for (let jx = 0; jx < inArr.length; jx++) {
                    const isChecked = checked.includes(inArr[ix].allyCode) || checked.includes(inArr[jx].allyCode);
                    if (!isChecked && inArr[ix].oldRank === inArr[jx].newRank && inArr[ix].newRank === inArr[jx].oldRank) {
                        // Then they likely swapped spots
                        const ixName = inArr[ix].mark && aw.useMarksInLog ? `${inArr[ix].mark} ${inArr[ix].name}` : inArr[ix].name;
                        const jxName = inArr[jx].mark && aw.useMarksInLog ? `${inArr[jx].mark} ${inArr[jx].name}` : inArr[jx].name;
                        if (inArr[ix].oldRank > inArr[ix].newRank) {
                            outArr.push(`${ixName} has hit ${jxName} down from ${inArr[jx].oldRank} to ${inArr[jx].newRank}`);
                        } else {
                            outArr.push(`${jxName} has hit ${ixName} down from ${inArr[ix].oldRank} to ${inArr[ix].newRank}`);
                        }

                        // Put the players into the checked array so we can make sure not to log it twice
                        checked.push(inArr[ix].allyCode);
                        checked.push(inArr[jx].allyCode);
                    }
                }
            }
        }
        // Then check for anyone that wasn't matched up with a partner
        for (const player of inArr) {
            if (!checked.includes(player.allyCode)) {
                const pName = aw.useMarksInLog && player.mark ? `${player.mark} ${player.name}` : player.name;
                if (player.oldRank < player.newRank && aw.report !== "climb") {
                    outArr.push(`${pName} has dropped from ${player.oldRank} to ${player.newRank}`);
                } else if (aw.report !== "drop") {
                    outArr.push(`${pName} has climbed from ${player.oldRank} to ${player.newRank}`);
                }
            }
        }
        return outArr;
    }

    // Send updated messages to the given channel, and edit an old message if able & one is supplied
    private async sendBroadcastMsg(msgId: string, channelId: string, outEmbed: Partial<Embed>) {
        // Use broadcastEval to check all shards for the channel, and if there's a valid message
        // there, edit it. If not, send a fresh copy of it.
        if (!channelId) return;
        const messages = await this.client.shard.broadcastEval(
            async (client, { msgIdIn, chanIn, outEmbed }) => {
                const channel = client.channels.cache.find((chan: TextChannel) => chan.id === chanIn || chan.name === chanIn);

                let msg: Message;
                let targetMsg: Message;
                if (
                    channel instanceof TextChannel &&
                    channel?.guild &&
                    channel.permissionsFor(client.user).has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
                ) {
                    if (!msgIdIn) {
                        targetMsg = await channel.send({ embeds: [outEmbed] });
                    } else {
                        try {
                            msg = await channel.messages.fetch(msgIdIn);
                        } catch (_) {
                            msg = null;
                        }
                        if (msg) {
                            // @ts-expect-error  (Won't shut up about partial messages or void, etc)
                            targetMsg = await msg
                                .edit({ embeds: [outEmbed] })
                                .catch((err) => logger.error("[PF sendBroadcastMsg edit]", err?.toString()));
                        } else {
                            // @ts-expect-error  (Won't shut up about partial messages or void, etc)
                            targetMsg = await channel
                                .send({ embeds: [outEmbed] })
                                .catch((err) => logger.error("[PF sendBroadcastMsg send]", err));
                        }
                    }
                }
                return targetMsg;
            },
            {
                context: {
                    msgIdIn: msgId,
                    chanIn: channelId,
                    outEmbed: outEmbed,
                },
            },
        );
        const msg = messages.filter((a) => !!a);
        return msg.length ? msg[0] : null;
    }

    private isWithinTime(targetTime: number, nowTime: number, min: number, max: number) {
        if (min >= max) throw new Error("[patreonFuncs / isWithinTime] Min MUST be less than max.");
        if (
            targetTime - min * 60_000 < nowTime || // min minutes before targetTime is past
            targetTime - max * 60_000 > nowTime
        ) {
            // max minutes before targetTime is in the future
            return false;
        }
        return true;
    }

    private getTimeLeft(offset: number, hrDiff: number) {
        const now = Date.now();
        let then = constants.dayMS - 1 + getUTCFromOffset(offset) - hrDiff * constants.hrMS;
        if (then < now) {
            then = then + constants.dayMS;
        }
        return then - now;
    }

    // Helper function to handle arena alerts for both character and ship arenas
    private async handleArenaAlerts(
        arenaType: "char" | "ship",
        player: PlayerArenaRes,
        acc: UserAcct,
        user: UserConfig,
        patron: { discordID: string },
    ) {
        const arenaConfig = {
            char: {
                alertType: "both" as const,
                altType: "char" as const,
                hrDiff: ARENA_OFFSETS.char,
                rankKey: "lastCharRank" as const,
                climbKey: "lastCharClimb" as const,
                displayName: "character",
                capitalName: "Character",
            },
            ship: {
                alertType: "both" as const,
                altType: "fleet" as const,
                hrDiff: ARENA_OFFSETS.fleet,
                rankKey: "lastShipRank" as const,
                climbKey: "lastShipClimb" as const,
                displayName: "ship",
                capitalName: "Fleet",
            },
        };

        const config = arenaConfig[arenaType];
        const arenaData = arenaType === "char" ? player.arena?.char : player.arena?.ship;

        if (!arenaData?.rank) return;

        if ([config.alertType, config.altType].includes(user.arenaAlert.arena as "char" | "fleet" | "both")) {
            const timeLeft = this.getTimeLeft(player.poUTCOffsetMinutes, config.hrDiff);
            const minTil = Math.floor(timeLeft / constants.minMS);
            const payoutTime = `${formatDuration(timeLeft, Language.getLanguages()[defaultSettings.language])} until payout.`;

            const pUser = await this.client.users.fetch(patron.discordID);
            if (pUser) {
                try {
                    // Payout warning
                    if (user.arenaAlert.payoutWarning > 0 && user.arenaAlert.payoutWarning === minTil) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: "Arena Payout Alert" },
                                        description: `${player.name}'s ${config.displayName} arena payout is in **${minTil}** minutes!${`\nYour current rank is ${arenaData.rank}`}`,
                                        color: constants.colors.green,
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[getRanks] Failed to send payout warning: ${err}`));
                    }

                    // Payout result
                    if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: `${config.capitalName} arena` },
                                        description: `${player.name}'s payout ended at **${arenaData.rank}**!`,
                                        color: constants.colors.green,
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[getRanks] Failed to send payout result: ${err}`));
                    }

                    // Rank drop alert
                    const lastRank = acc[config.rankKey];
                    const lastClimb = acc[config.climbKey];
                    if (arenaData.rank > lastRank && lastRank > 0) {
                        await pUser
                            .send({
                                embeds: [
                                    {
                                        author: { name: `${config.capitalName} Arena` },
                                        description: `**${player.name}'s** rank just dropped from ${lastRank} to **${arenaData.rank}**\nDown by **${
                                            arenaData.rank - lastClimb
                                        }** since last climb`,
                                        color: constants.colors.red,
                                        footer: { text: payoutTime },
                                    },
                                ],
                            })
                            .catch((err) => logger.error(`[getRanks] Failed to send rank drop alert: ${err}`));
                    }
                } catch (e) {
                    logger.error(`[getRanks] Error processing ${config.displayName} arena alerts: ${e}`);
                }
            }
        }

        // Update climb and rank tracking
        const currentClimb = acc[config.climbKey];
        const currentRank = acc[config.rankKey];
        acc[config.climbKey] = currentClimb ? (arenaData.rank < currentRank ? arenaData.rank : currentClimb) : arenaData.rank;
        acc[config.rankKey] = arenaData.rank;
    }
}

// Create and export a singleton instance
const patreonFuncs = new PatreonFuncs();

export default patreonFuncs;
export { PatreonFuncs };
