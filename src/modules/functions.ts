import Discord, { GuildMember, Role, TextChannel } from "discord.js";
import moment from "moment-timezone";
import { promisify, inspect } from "util";     // eslint-disable-line no-unused-vars
import fs from "fs";
import { APIUnitObj, BotInteraction, BotType, GuildConf, Header, PlayerCooldown, PlayerStatsAccount, UnitObj, UserReg, UserRegAccount } from "./types";
const readdir = promisify(require("fs").readdir);

import { REST } from '@discordjs/rest';

import { Routes } from 'discord-api-types/v10';
import { SlashCommandBuilder } from "@discordjs/builders";
import { BotClient } from "../modules/types";
import slashCommand from "../base/slashCommand";
import config from "../config";


module.exports = (Bot: BotType, client: BotClient) => {
// export const functions = (Bot: BotType, client: BotClient) => {
    Bot.constants = {
        // The main invite for the support server
        invite: "https://discord.com/invite/FfwGvhr",

        // Zero width space
        zws: "\u200B",
        longSpace: "\u3000",

        // Some normal color codes
        colors: {
            black:  "#000000",
            blue:   "#0000FF",
            green:  "#00FF00",
            red:    "#FF0000",
            white:  "#FFFFFF",
            yellow: "#FFFF00",
        },
        optionType: {
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
            ATTACHMENT: 11
        },

        // Permissions mapping
        permMap: {
            // Can do anything, access to the dev commands, etc
            BOT_OWNER: 10,

            // Can help out with the bot as needed, some extra stuff possibly
            HELPER: 8,

            // Owner of the server a command is being run in
            GUILD_OWNER: 7,

            // Has ADMIN or MANAGE_GUILD, or has one of the
            // configured roles from the guild's settings
            GUILD_ADMIN: 6,

            // Base users, anyone that's not included above
            BASE_USER: 0
        }
    };

    /*  PERMISSION LEVEL FUNCTION
     *  This is a very basic permission system for commands which uses "levels"
     *  "spaces" are intentionally left black so you can add them if you want.
     *  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
     *  command including the VERY DANGEROUS `eval` and `exec` commands!
     */
    Bot.permLevel = async (interaction: BotInteraction): Promise<number> => {
        let permlvl = 0;
        const member = interaction.member as GuildMember;

        // Depending on message or interaction, grab the ID of the user
        const authId = interaction.user.id;

        // If bot owner, return max perm level
        if (authId === config.ownerid) {
            return Bot.constants.permMap.BOT_OWNER;
        }

        // If DMs or webhook, return 0 perm level.
        if (!interaction.guild || !member) {
            return Bot.constants.permMap.BASE_USER;
        }
        const guildConf: GuildConf = interaction.guildSettings;

        // Guild Owner gets an extra level, wooh!
        const gOwner = await interaction.guild.fetchOwner();
        if (interaction.channel.type === "GUILD_TEXT" && interaction.guild && gOwner) {
            if (interaction.user?.id === gOwner.id) {
                return Bot.constants.permMap.GUILD_OWNER;
            }
        }

        // Also giving them the permissions if they have the manage server role,
        // since they can change anything else in the server, so no reason not to
        if (member.permissions.has(["ADMINISTRATOR"]) || member.permissions.has(["MANAGE_GUILD"])) {
            return Bot.constants.permMap.GUILD_ADMIN;
        }

        // The rest of the perms rely on roles. If those roles are not found
        // in the settings, or the user does not have it, their level will be 0
        try {
            const adminRoles = guildConf.adminRole;

            for (var ix = 0, len = adminRoles.length; ix < len; ix++) {
                const adminRole = interaction.guild.roles.cache.find(r => ( r.name.toLowerCase() === adminRoles[ix].toLowerCase() || r.id === adminRoles[ix] ) && r.members.has(interaction.user.id));
                if (adminRole) {
                    return permlvl = Bot.constants.permMap.GUILD_ADMIN;
                }
            }
        } catch (e) {() => {};}
        return permlvl;
    };

    // Check if the bot's account is the main (real) bot
    Bot.isMain = () => {
        if (client.user.id === "315739499932024834") return true;
        return false;
    };

    // Default formatting for current US/Pacific time
    Bot.myTime = () => {
        return moment.tz("US/Pacific").format("M/D/YYYY h:mma");
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName: string, charList: UnitObj[], ship=false): UnitObj[] => {
        if (!searchName?.length || typeof searchName !== "string") {
            return [];
        }

        searchName = searchName
            .replace(/’/g, "'")
            .trim()
            .toLowerCase();

        // Try finding an exact match for the name or aliases
        let foundChar = charList.filter((char: UnitObj) => char.name.toLowerCase() === searchName);
        if (!foundChar.length) {
            foundChar = charList.filter((char: UnitObj) => char.aliases.some(alias => alias.toLowerCase() === searchName));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter((ship: UnitObj) => ship.crew?.some((crew: string) => crew.toLowerCase() === searchName));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then see if the searchName is a part of one of the names or aliases
        foundChar = charList.filter((char: UnitObj) => char.name.toLowerCase().split(" ").includes(searchName));
        if (!foundChar.length) {
            foundChar = charList.filter((char: UnitObj) => char.aliases.some(alias => alias.toLowerCase().split(" ").includes(searchName)));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter((ship: UnitObj) => ship.crew?.some((crew: string) => crew.toLowerCase().split(" ").includes(searchName)));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then try to split up the search by spaces, and see if any part of that finds any matches
        const splitName = searchName.split(" ");
        foundChar = charList.filter((char: UnitObj) => splitName.some(name => char.name.toLowerCase().includes(name)));
        if (foundChar?.length) {
            return foundChar;
        }

        // If by here, it hasn't found any matching character or ship, return an empty array
        return [];
    };

    // Parse the webhook url, and get the id & token from the end
    function parseWebhook(url: string) {
        const webhookCredentials = url.split("/").slice(-2);
        return {
            id: webhookCredentials[0],
            token: webhookCredentials[1]
        };
    }

    // Send a message to a webhook url, takes the url & the embed to send
    Bot.sendWebhook = (hookUrl: string, embed: Discord.MessageEmbed): void => {
        const h = parseWebhook(hookUrl);
        const hook = new Discord.WebhookClient({id: h.id, token: h.token});
        hook.send({embeds: [
            embed
        ]}).catch(() => {});
    };

    /* ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild: Discord.Guild, announceMsg: string, channel: string="", guildConf: GuildConf) => {
        if (!guild?.id) return;

        let announceChan = guildConf.announceChan || "";
        if (channel && channel !== "") {
            announceChan = channel;
        }
        // Try and get it by ID first
        let chan = guild.channels.cache.get(announceChan.toString().replace(/[^0-9]/g, "")) as TextChannel;

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.cache.find(c => c.name === announceChan) as TextChannel;
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (!chan || !chan.send || !chan.permissionsFor(guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
            return;
        } else {
            // If everything is ok, go ahead and try sending the message
            await chan.send(announceMsg).catch((err: Error) => {
                // if (err.stack.toString().includes("user aborted a request")) return;
                const outStr = `Broke sending announceMsg: ${err.stack} \n${guild.id} - ${channel}\n${announceMsg}\n`;
                console.error(outStr);
                return outStr;
            });
            return null;
        }
    };

    // client.unloadSlash = (commandName: string) => {
    //     try {
    //         if (client.slashcmds.has(commandName)) {
    //             const command = client.slashcmds.get(commandName);
    //             client.slashcmds.delete(command.commandData.name);
    //             delete require.cache[require.resolve(`../slash/${command.commandData.name}.js`)];
    //         }
    //         return null;
    //     } catch (err) {
    //         return `Unable to load command ${commandName}: ${err}`;
    //     }
    // };
    // client.loadSlash = (commandName: string) => {
    //     try {
    //         const cmd = new (require(`../slash/${commandName}`))(Bot);
    //         if (!cmd.enabled) {
    //             return commandName + " is not enabled";
    //         }
    //         client.slashcmds.set(cmd.commandData.name, cmd);
    //         return null;
    //     } catch (e) {
    //         return `Unable to load command ${commandName}: ${e}`;
    //     }
    // };
    // client.reloadSlash = async (commandName: string) => {
    //     let response = Bot.unloadSlash(commandName);
    //     if (response) {
    //         return new Error(`Error Unloading: ${response}`);
    //     } else {
    //         response = Bot.loadSlash(commandName);
    //         if (response) {
    //             return new Error(`Error Loading: ${response}`);
    //         }
    //     }
    //     return commandName;
    // };

    // Reloads all slash commads (even if they were not loaded before)
    // Will not remove a command if it's been loaded,
    // but will load a new command if it's been added
    // client.reloadAllSlashCommands = async () => {
    //     [...client.slashcmds.keys()].forEach(c => {
    //         Bot.unloadSlash(c);
    //     });
    //     const cmdFiles = await readdir("./slash/");
    //     const coms: string[] = [], errArr: string[] = [];
    //     cmdFiles.forEach(async (fileName: string) => {
    //         try {
    //             const cmd = fileName.split(".")[0];
    //             if (fileName.split(".").slice(-1)[0] !== "js") {
    //                 errArr.push(fileName);
    //             } else {
    //                 const res = Bot.loadSlash(cmd);
    //                 if (!res) {
    //                     coms.push(cmd);
    //                 } else {
    //                     errArr.push(fileName);
    //                 }
    //             }
    //         } catch (e) {
    //             Bot.logger.error("Error: " + e);
    //             errArr.push(fileName);
    //         }
    //     });
    //     return {
    //         succArr: coms,
    //         errArr: errArr
    //     };
    // };
    //
    // // Reload the events files (message, guildCreate, etc)
    // client.reloadAllEvents = async () => {
    //     const ev: string[] = [], errEv: string[] = [];
    //
    //     const evtFiles = await readdir("./events/");
    //     evtFiles.forEach((fileName: string) => {
    //         try {
    //             const eventName = fileName.split(".")[0];
    //             client.removeAllListeners(eventName);
    //             const event = require(`../events/${fileName}`);
    //             if (["error", "ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"].includes(eventName)) {
    //                 client.on(eventName, event.bind(null, Bot, client));
    //             } else {
    //                 client.on(eventName, event.bind(null, Bot));
    //             }
    //             delete require.cache[require.resolve(`../events/${fileName}`)];
    //             ev.push(eventName);
    //         } catch (e) {
    //             Bot.logger.error("In Event reload: " + e);
    //             errEv.push(fileName);
    //         }
    //     });
    //     return {
    //         succArr: ev,
    //         errArr: errEv
    //     };
    // };
    //
    // // Reload the functions (this) file
    // client.reloadFunctions = async () => {
    //     try {
    //         delete require.cache[require.resolve("../modules/functions.js")];
    //         require("../modules/functions.js")(Bot, client);
    //         delete require.cache[require.resolve("../modules/patreonFuncs.js")];
    //         require("../modules/patreonFuncs.js")(Bot, client);
    //         delete require.cache[require.resolve("../modules/eventFuncs.js")];
    //         require("../modules/eventFuncs.js")(Bot, client);
    //         delete require.cache[require.resolve("../modules/Logger.js")];
    //         delete Bot.logger;
    //         const Logger = require("../modules/Logger.js");
    //         Bot.logger = new Logger(Bot, client);
    //     } catch (err) {
    //         return {err: err.stack};
    //     }
    // };
    //
    // // Reload the swapi file
    // client.reloadSwapi = async () => {
    //     let err = null;
    //     try {
    //         delete require.cache[require.resolve("../modules/swapi.js")];
    //         Bot.swgohAPI = require("../modules/swapi.js")(Bot);
    //     } catch (e) {
    //         err = e;
    //     }
    //     return err;
    // };
    //
    // // Reload the users file
    // client.reloadUserReg = async () => {
    //     let err = null;
    //     try {
    //         delete require.cache[require.resolve("../modules/users.js")];
    //         Bot.userReg = require("../modules/users.js")(Bot);
    //     } catch (e) {
    //         err = e;
    //     }
    //     return err;
    // };

    // Reload the data files (ships, teams, characters)
    // client.reloadDataFiles = async () => {
    //     try {
    //         Bot.abilityCosts = await JSON.parse(fs.readFileSync("data/abilityCosts.json").toString());
    //         Bot.acronyms     = await JSON.parse(fs.readFileSync("data/acronyms.json").toString());
    //         Bot.arenaJumps   = await JSON.parse(fs.readFileSync("data/arenaJumps.json").toString());
    //         Bot.characters   = await JSON.parse(fs.readFileSync("data/characters.json").toString());
    //         Bot.charLocs     = await JSON.parse(fs.readFileSync("data/charLocations.json").toString());
    //         Bot.missions     = await JSON.parse(fs.readFileSync("data/missions.json").toString());
    //         Bot.resources    = await JSON.parse(fs.readFileSync("data/resources.json").toString());
    //         Bot.ships        = await JSON.parse(fs.readFileSync("data/ships.json").toString());
    //         Bot.shipLocs     = await JSON.parse(fs.readFileSync("data/shipLocations.json").toString());
    //         Bot.squads       = await JSON.parse(fs.readFileSync("data/squads.json").toString());
    //         const gameData   = await JSON.parse(fs.readFileSync("data/gameData.json").toString());
    //         Bot.statCalculator.setGameData(gameData);
    //     } catch (err) {
    //         return {err: err.stack};
    //     }
    // };

    // Reload all the language files
    // const languageDir = __dirname + "/../languages/"
    // Bot.reloadLanguages = async () => {
    //     try {
    //         Object.keys(Bot.languages).forEach(lang => {
    //             if (Bot.languages[lang]) delete Bot.languages[lang];
    //         });
    //         const langFiles = await readdir(languageDir);
    //         langFiles.forEach((fileName: string) => {
    //             const langName = fileName.split(".")[0];
    //             Bot.languages[langName] = require(languageDir + fileName)?.language;
    //             delete require.cache[require.resolve(languageDir + fileName)];
    //         });
    //     } catch (err) {
    //         return err;
    //     }
    // };

    // String Truncate function
    // Bot.truncate = (string, len, terminator="...") => {
    //     const termLength = terminator.length;
    //
    //     if (string.length > len) {
    //         return string.substring(0, len - termLength) + terminator;
    //     } else {
    //         return string;
    //     }
    // };

    /* MESSAGE CLEAN FUNCTION
     * "Clean" removes @everyone pings, as well as tokens, and makes code blocks
     * escaped so they're shown more easily. As a bonus it resolves promises
     * and stringifies objects!
     * This is mostly only used by the Eval and Exec commands.
     */
    // Bot.clean = async (client, text) => {
    //     if (text && text.constructor.name == "Promise")
    //         text = await text;
    //     if (typeof evaled !== "string")
    //         text = inspect(text, {
    //             depth: 0
    //         });
    //
    //     text = text
    //         .replace(/`/g, "`" + String.fromCharCode(8203))
    //         .replace(/@/g, "@" + String.fromCharCode(8203))
    //         .replace(client.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");
    //
    //     return text;
    // };

    /* MISCELANEOUS NON-CRITICAL FUNCTIONS */

    // `await wait(1000);` to "pause" for 1 second.
    Bot.wait = promisify(setTimeout);
    // Bot.wait = (time: number) => new Promise((resolve, reject) => setTimeout(resolve, time))


    /*  MESSAGE SPLITTER
     *  Input an array of strings, and it will put them together so that it
     *  doesn't exceed the given max length.
     */
    Bot.msgArray = (arr: string | string[], join="\n", maxLen=1900) => {
        const messages = [];
        if (!Array.isArray(arr)) arr = arr.toString().split("\n");
        arr.forEach((elem) => {
            elem = Bot.expandSpaces(elem);
            if (typeof elem !== "string") Bot.logger.error("In msgArray, " + elem + " Is not a string!");
            // Check if something big somehow got in
            if (elem.length > maxLen) {
                throw new Error("[MsgArray] Element too big! " + elem);
            }
            if  (messages.length === 0) {
                messages.push(elem);
            } else {
                const lastMsgLen = messages[messages.length - 1].length;
                if ((lastMsgLen + elem.length) > maxLen) {
                    messages.push(elem);
                } else {
                    messages[messages.length - 1] = messages[messages.length - 1] + join + elem;
                }
            }
        });
        return messages;
    };

    /* CODE BLOCK MAKER
     * Makes a codeblock with the specified lang for highlighting.
     */
    Bot.codeBlock = (str: string, lang="") => {
        return `\`\`\`${lang}\n${str}\`\`\``;
    };

    /**
     * Duration
     * Convert a millisecond count into a formatted duration string
     */
    Bot.duration = ({time, interaction, type}: {time: number, interaction?: BotInteraction, type: "timestamp" | "diff"}) => {
        // moment.duration(
        //     Math.abs(
        //         moment(time).diff(moment())
        //     )
        // ).format(`d [${lang.getTime("DAY", "PLURAL")}], h [${lang.getTime("HOUR", "SHORT_PLURAL")}], m [${lang.getTime("MINUTE", "SHORT_SING")}]`);


        if (!interaction) return "N/A";
        console.log("TimeIn: " + time);
        const lang = interaction ? interaction.language : Bot.languages[config.defaultSettings.language];

        const dayNum  = 86400000;
        const hourNum = 3600000;
        const minNum  = 60000;
        let timeAgo = time;
        if (type === "timestamp") {
            timeAgo = moment(time).diff(moment());
        }

        // let timeAgo = type === "timestamp" ? Math.abs(moment(time).diff(moment())) : time;
        // let timeAgo = Math.abs(Math.floor(new Date().getTime() / 1000) - time);
        console.log(`TimeAgo: ${timeAgo}`);
        const days = Math.floor(timeAgo/dayNum);
        console.log(`TimeAgo: ${timeAgo}, Days: ${days}`);
        timeAgo -= days * dayNum;
        const hours = Math.floor(timeAgo/hourNum);
        console.log(`TimeAgo: ${timeAgo}, Days: ${days}, Hours: ${hours}`);
        timeAgo -= hours * hourNum;
        const minutes = Math.floor(timeAgo/minNum);
        console.log(`TimeAgo: ${timeAgo}, Days: ${days}, Hours: ${hours}, Minutes: ${minutes}`);

        let outStr = "";
        if (days != 0) outStr    += `${days} ${days > 1 ? lang.getTime("DAY", "PLURAL") : lang.getTime("DAY", "SING")}, `;
        if (hours != 0) outStr   += `${hours} ${hours > 1 ? lang.getTime("HOUR", "SHORT_PLURAL") : lang.getTime("HOUR", "SHORT_SING")}, `;
        if (minutes != 0) outStr += `${minutes} ${minutes > 1 ? lang.getTime("MINUTE", "SHORT_PLURAL") : lang.getTime("MINUTE", "SHORT_SING")}`;

        console.log("OutStr: " + outStr);

        return outStr;
    };

    /* LAST UPDATED FOOTER
     * Simple one to make the "Last updated ____ " footers
     */
    Bot.updatedFooter = (updated: string, interaction: BotInteraction, type="player", userCooldown: PlayerCooldown) => {
        const baseCooldown = { player: 2, guild: 6 };
        const minCooldown = { player: 1, guild: 3 };

        if (!userCooldown) userCooldown = baseCooldown;
        const timeDiff = new Date().getTime() - new Date(updated).getTime();
        let betweenMS = Bot.convertMS(timeDiff);

        let betweenStr = "";
        if (betweenMS.hour >= minCooldown[type] && betweenMS.hour < userCooldown[type]) {
            // If the data is between the shorter time they'd get from patreon, and the
            // time they'd get without, stick the patreon link in the footer
            betweenStr = " | patreon.com/swgohbot";
        }
        return {
            text: interaction.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration({time: updated, interaction: interaction, type: "timestamp"})) + betweenStr
        };
    };

    // Get the current user count
    Bot.userCount = async () => {
        let users = 0;
        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues("users.cache.size")
                .then((results: number[]) => {
                    users = results.reduce((prev: number, val: number) => prev + val, 0);
                })
                .catch(console.error);
            return users;
        } else {
            return client.users.cache.size;
        }
    };

    // Get the current guild count
    Bot.guildCount = async () => {
        let guilds = 0;
        if (client.shard) {
            await client.shard.fetchClientValues("guilds.cache.size")
                .then((results: number[]) => {
                    guilds =  results.reduce((prev: number, val: number) => prev + val, 0);
                })
                .catch(console.error);
            return guilds;
        } else {
            return client.guilds.cache.size;
        }
    };

    /* isUserID
     * Check if a string of numbers is a valid user.
     */
    Bot.isUserID = (numStr: string) => {
        if (!numStr || !numStr.length) return false;
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        return match ? true : false;
    };

    /* getUserID
     * Get a valid Discord id string from a given string.
     */
    Bot.getUserID = (numStr: string) => {
        if (!numStr || !numStr.length) return null;
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        if (match) {
            return numStr.replace(/[^0-9]/g, "");
        }
        return null;
    };

    /* isAllyCode
     * Check if a string of numbers is a valid ally code.
     * Needs to be a string of 9 numbers
     */
    Bot.isAllyCode = (aCode: number) => {
        if (!aCode?.toString().length) return false;
        const match = aCode.toString().replace(/[^\d]*/g, "").match(/^\d{9}$/);
        return match ? true : false;
    };

    /* makeTable
     * Makes a table-like format given an array of objects
     *
     * headers: object of columnName: columnHeader
     *  (columnHeader is empty string if you want it not in a codeBlock)
     *  {
     *      columnKey: {
     *          value: "",
     *          startWith: "",
     *          endWith: "",
     *          align: "center"     (Also supports left & right)
     *      }
     *  }
     * rows: The data to fill in
     */
    Bot.makeTable = (headers: Header, rows: [], options={
        boldHeader: true,
        useHeader:  true
    }) => {
        if (!headers || !rows?.length) throw new Error("You need both headers and rows");
        const max = {};
        Object.keys(headers).forEach(h => {
            // Get the max length needed, then add a bit for padding
            if (options.useHeader) {
                // console.log(h, rows);
                max[h] = Math.max(...[headers[h].value.length].concat(rows.map((v: {}) => v[h].toString().length))) + 2;
            } else {
                max[h] = Math.max(...rows.map((v: {}) => {
                    if (!v[h]) return 0;
                    return v[h].toString().length;
                })) + 2;
            }
        });

        let header = "";
        const out = [];

        if (options.useHeader) {
            Object.keys(headers).forEach(h => {
                const headerMax = max[h];
                const head = headers[h];
                if (head && head.value.length) {
                    const pad = headerMax - head.value.length;
                    const padBefore = Math.floor(pad/2);
                    const padAfter = pad-padBefore;
                    header += head.startWith ? head.startWith : "";
                    if (padBefore) header += " ".repeat(padBefore);
                    header += head.value;
                    if (padAfter) header  += " ".repeat(padAfter);
                    header += head.endWith ? head.endWith : "";
                } else {
                    header += head.startWith ? head.startWith : "";
                    header += " ".repeat(headerMax);
                    header += head.endWith ? head.endWith : "";
                }
            });
            if (options.boldHeader) {
                out.push(Bot.expandSpaces("**" + header + "**"));
            } else {
                out.push(Bot.expandSpaces(header));
            }
        }
        rows.forEach(r => {
            let row = "";
            Object.keys(headers).forEach((header: string, ix: number) => {
                const rowMax = max[header];
                const head = headers[header];
                let value: string | number = r[header];
                if (!value) value = 0;
                const pad = rowMax - value.toString().length;
                row += head.startWith ? head.startWith : "";
                if (!head.align || (head.align && head.align === "center")) {
                    const padBefore = Math.floor(pad/2);
                    const padAfter = pad-padBefore;
                    if (padBefore) row += " ".repeat(padBefore);
                    row += value;
                    if (padAfter) row  += " ".repeat(padAfter);
                } else if (head.align === "left" && ix === 0 && !head.startWith) {
                    row += value + " ".repeat(pad-1);
                } else if (head.align === "left") {
                    row += " " + value + " ".repeat(pad-1);
                } else if (head.align === "right") {
                    row += " ".repeat(pad-1) + value + " ";
                } else {
                    throw new Error("Invalid alignment");
                }
                row += head.endWith ? head.endWith : "";
            });
            out.push(Bot.expandSpaces(row.replace(/\s*$/, "")));
        });

        return out;
    };

    // Small function to search the factions
    Bot.findFaction = (faction: string): string[] | string => {
        faction = faction.toLowerCase().replace(/\s+/g, "");
        let found = Bot.factions.find((fact: string) => fact.toLowerCase().replace(/\s+/g, "") === faction);
        if (found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find((fact: string) => fact.toLowerCase().replace(/\s+/g, "") === faction.substring(0, faction.length-1));
        if (faction.endsWith("s") && found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find((fact: string) => fact.toLowerCase().replace(/\s+/g, "") === faction + "s");
        if (!faction.endsWith("s") && found) {
            return found.toLowerCase();
        }
        const close = Bot.factions.filter((fact: string) => fact.toLowerCase().replace(/\s+/g, "").includes(faction.toLowerCase()));
        if (close.length) {
            return close.map((fact: string) => fact.toLowerCase());
        }

        return null;
    };

    // Expand multiple spaces to have zero width spaces between them so
    // Discord doesn't collapse em
    Bot.expandSpaces = (str: string) => {
        let outStr = "";
        str.split(/([\s]{2,})/).forEach((e: string) => {
            if (e.match(/[\s]{2,}/)) {
                outStr += e.split("").join("\u200B");
            } else {
                outStr += e;
            }
        });
        return outStr;
    };

    // Get the ally code of someone that's registered
    Bot.getAllyCode = async (interaction: BotInteraction, user: string | number, useMessageId=true): Promise<number> => {
        const otherCodeRegex = /^-\d{1,2}$/;
        if (Array.isArray(user)) user = user.join(" ");
        if (user) {
            user = user.toString().trim();
        } else {
            user = "";
        }

        let userAcct: UserReg = null;
        if (user === "me" || user.match(otherCodeRegex) || (!user && useMessageId)) {
            // Grab the sender's primary code
            userAcct = await Bot.userReg.getUser(interaction.user.id);
        } else if (Bot.isUserID(user)) {
            // Try to grab the primary code for the mentioned user
            userAcct = await Bot.userReg.getUser(user.replace(/[^\d]*/g, ""));
        }  else if (Bot.isAllyCode(user)) {
            // Otherwise, just scrap everything but numbers, and send it back
            return parseInt(user.replace(/[^\d]*/g, ""), 10);
        }

        if (userAcct?.accounts?.length) {
            if (user?.match(otherCodeRegex)) {
                // If it's a -1/ -2 code, try to grab the specified code
                const index = parseInt(user.replace("-", ""), 10) - 1;
                const account = userAcct.accounts[index];
                return account?.allyCode ? parseInt(account.allyCode, 10) : null;
            } else {
                // If it's a missing allycode, a "me", or for a specified discord ID, just grab the primary if available
                const account = userAcct.accounts.find((a: UserRegAccount) => a.primary);
                return account?.allyCode ? parseInt(account.allyCode, 10) : null;
            }
        } else {
            return null;
        }
    };

    // Convert from milliseconds
    Bot.convertMS = (milliseconds: number) => {
        let hour: number, totalMin: number, minute: number, seconds: number;
        seconds = Math.floor(milliseconds / 1000);
        totalMin = Math.floor(seconds / 60);
        seconds = seconds % 60;
        hour = Math.floor(totalMin / 60);
        minute = totalMin % 60;
        return {
            hour: hour,
            minute: minute,
            totalMin: totalMin,
            seconds: seconds
        };
    };

    // Return a divider of equals signs
    Bot.getDivider = (count: number, divChar="=") => {
        if (count <= 0) throw new Error("Invalid count value");
        if (typeof divChar !== "string") throw new Error("divChar must be a string!");
        return divChar.repeat(count);
    };

    // Clean mentions out of messages and replace them with the text version
    Bot.cleanMentions = (guild: Discord.Guild, input: string) => {
        return input
            .replace(/@(here|everyone)/g, `@${Bot.constants.zws}$1`)
            .replace(/<(@[!&]?|#)(\d{17,19})>/g, (match, type, id) => {
                switch (type) {
                    case "@":
                    case "@!": {
                        const  user = guild.members.cache.get(id);
                        return user ? `@${user.displayName}` : `<${type}${Bot.constants.zws}${id}>`;
                    }
                    case "@&": {
                        const  role = guild.roles.cache.get(id);
                        return role ? `@${role.name}` : match;
                    }
                    case "#": {
                        const  channel  = guild.channels.cache.get(id);
                        return channel ? `#${channel.name}` : `<${type}${Bot.constants.zws}${id}>`;
                    }
                    default: return `<${type}${Bot.constants.zws}${id}>`;
                }
            });
    };

    Bot.isChannelMention = (mention: string) => {
        const channelRegex = /^<#\d{17,19}>/;
        return mention.match(channelRegex) ? true : false;
    };
    Bot.isRoleMention = (mention: string) => {
        const roleRegex = /^<@&\d{17,19}>/;
        return mention.match(roleRegex) ? true : false;
    };
    Bot.isUserMention = (mention: string) => {
        const userRegex = /^<@!?\d{17,19}>/;
        return mention.match(userRegex) ? true : false;
    };
    Bot.chunkArray = (inArray: string[], chunkSize: number) => {
        var res = [];
        if (!Array.isArray(inArray)) inArray = [inArray];
        for (let ix = 0, len = inArray.length; ix < len; ix += chunkSize) {
            res.push(inArray.slice(ix, ix + chunkSize));
        }
        return res;
    };
    Bot.getGuildConf = async (guildID: string): Promise<GuildConf> => {
        if (!guildID) return config.defaultSettings;
        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}});
        return guildSettings && guildSettings.dataValues ? guildSettings.dataValues : config.defaultSettings;
    };
    Bot.hasGuildConf = async (guildID: string) => {
        if (!guildID) return false;
        const exists = await Bot.database.models.settings.findOne({where: {guildID: guildID}})
            .then((token: any) => token !== null)
            .then((isUnique: any) => isUnique);
        return exists ? true : false;
    };

    // Returns a gear string (9+4 or 13r5), etc
    Bot.getGearStr = (charIn: APIUnitObj, preStr="") => {
        // If the character is not unlocked
        if (!charIn?.gear) return "N/A";

        let charGearOut = preStr + charIn.gear.toString();
        if (charIn.equipped?.length) {
            charGearOut += `+${charIn.equipped.length}`;
        } else if (charIn?.relic?.currentTier > 2) {
            charGearOut += `r${charIn.relic.currentTier-2}`;
        }
        return charGearOut;
    };

    // Get the overall levels for a guild as a whole (Gear, rarity, relic, etc)
    Bot.summarizeCharLevels = (guildMembers: PlayerStatsAccount | PlayerStatsAccount[], type: string) => {
        const max = {
            gear: 13,
            relic: 9,
            rarity: 7
        };
        if (!Object.keys(max).includes(type)) return [null, `[summarizeLevels] Invalid type (${type})`];
        if (!Array.isArray(guildMembers)) guildMembers = [guildMembers];

        const levels: {[key: string]: number} = {};
        for (let ix = max[type]; ix >= 1; ix--) {
            let lvlCount = 0;
            for (const member of guildMembers) {
                if (type === "relic") {
                    lvlCount += member.roster.filter((char: APIUnitObj) => char?.combatType === 1 && char.relic?.currentTier-2 === ix).length;
                } else {
                    lvlCount += member.roster.filter((char: APIUnitObj) => char?.combatType === 1 && char[type] === ix).length;
                }
            }
            if (lvlCount > 0) {
                levels[ix] = lvlCount;
            }
        }
        const tieredLvl = Object.keys(levels).reduce((acc, curr) => acc + (levels[curr] * parseInt(curr, 10)), 0);
        const totalLvl  = Object.keys(levels).reduce((acc, curr) => acc + levels[curr], 0);
        const avgLvls   = (tieredLvl / totalLvl).toFixed(2);

        return [levels, avgLvls];
    };

    Bot.toProperCase = function(strIn: string) {
        return strIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
        });
    };

    const rest = new REST({ version: "10" }).setToken(config.token);
    Bot.deploy = async function() {
        // const guildCmds  = client.slashcmds.filter((com: {}) => com.guildOnly).map((com: {}) => JSON.stringify(com.commandData));
        // const globalCmds = client.slashcmds.filter((com: {}) => !com.guildOnly).map((com: {}) => JSON.stringify(com.commandData));
        const allCmds  = client.slashcmds.map((com: slashCommand) => com.commandData);

        // If there's a server configured for development/ that only the owner can use, put the guild commands there
        if (config?.dev_server) {
            // console.log(allCmds);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, config.dev_server),
                { body: allCmds },
            )
            // .then(res => console.log(res));
        } else {
            // try {
            //     await rest.put(
            //         Routes.applicationGuildCommands(client.user.id, config.dev_server),
            //         { body: guildCmds },
            //     );
            //     await rest.put(
            //         Routes.applicationCommands(client.user.id),
            //         { body: globalCmds },
            //     );
            // } catch (err) {
            //     console.log("[ERROR] Broke while trying to deploy commands:");
            //     console.log(err);
            // }
        }
    }

    // Trim down large numbers to be more easily readable
    Bot.shortenNum = function(number: number, trimTo=2) {
        const million = 1000000, thousand = 1000;

        if (number >= million) {
            number = (number / million);
            return trimFloat(number, trimTo) + "M";
        } else if (number >= thousand) {
            number = (number / thousand);
            return trimFloat(number, trimTo) + "K";
        }
    };

    // Helper for shortenNum,
    // Trims a fload down to either 0 or 1 (by default) decimal points
    function trimFloat(num: number, dec=1): string {
        if (num % 1 === 0) {
            return num.toString();
        } else {
            return num.toFixed(dec);
        }
    }

    client.reloadSlash = async (commandName: string) => {
        let response = await client.unloadSlash(commandName);
        if (response) {
            return new Error(`Error Unloading: ${response}`);
        } else {
            response = await client.loadSlash(commandName);
            if (response) {
                return new Error(`Error Loading: ${response}`);
            }
        }
        return commandName;
    };
    client.unloadSlash = async (commandName: string) => {
        try {
            if (client.slashcmds.has(commandName)) {
                const command = client.slashcmds.get(commandName);
                client.slashcmds.delete(command.commandData.name);
                delete require.cache[require.resolve(`../slash/${command.commandData.name}.js`)];
            }
            return null;
        } catch (err) {
            return `Unable to load command ${commandName}: ${err}`;
        }
    };
    client.loadSlash = async (commandName: string) => {
        try {
            const cmd = new (require(`../slash/${commandName}`))(Bot);
            if (!cmd.enabled) {
                return commandName + " is not enabled";
            } else if (!cmd) {
                return commandName + " is not working?";
            }
            client.slashcmds.set(cmd.commandData.name, cmd);
            return null;
        } catch (e) {
            return `Unable to load command ${commandName}: ${e}`;
        }
    };

    client.reloadAllSlashCommands = async () => {
        const slashNames = [...client.slashcmds.keys()];
        slashNames.forEach(async cmdName => {
            await client.unloadSlash(cmdName);
        });
        const coms: string[] = [], errArr: string[] = [];
        for (const cmdName of slashNames) {
            try {
                const res = await client.loadSlash(cmdName)
                if (!res) {
                    coms.push(cmdName);
                } else {
                    errArr.push(cmdName);
                }
            } catch (e) {
                Bot.logger.error("Error: " + e);
                errArr.push(cmdName);
            }
        }

        return {
            succArr: coms,
            errArr: errArr
        };
    };

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async () => {
        const ev: string[] = [], errEv: string[] = [];

        const evtFiles = await readdir(__dirname + "/../events/");
        evtFiles.forEach((fileName: string) => {
            try {
                const eventName = fileName.split(".")[0];
                client.removeAllListeners(eventName);
                const event = require(`../events/${fileName}`);
                if (["error", "ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"].includes(eventName)) {
                    client.on(eventName, event.bind(null, Bot, client));
                } else {
                    client.on(eventName, event.bind(null, Bot));
                }
                delete require.cache[require.resolve(`../events/${fileName}`)];
                ev.push(eventName);
            } catch (e) {
                Bot.logger.error("In Event reload: " + e);
                errEv.push(fileName);
            }
        });
        return {
            succArr: ev,
            errArr: errEv
        };
    };

    // Reload the functions (this) file
    client.reloadFunctions = async () => {
        try {
            delete require.cache[require.resolve(__dirname + "/../modules/functions.js")];
            require(__dirname + "/../modules/functions.js")(Bot, client);
            delete require.cache[require.resolve(__dirname + "/../modules/patreonFuncs.js")];
            require(__dirname + "/../modules/patreonFuncs.js")(Bot, client);
            delete require.cache[require.resolve(__dirname + "/../modules/eventFuncs.js")];
            require(__dirname + "/../modules/eventFuncs.js")(Bot, client);
            delete require.cache[require.resolve(__dirname + "/../modules/Logger.js")];
            delete Bot.logger;
            const Logger = require(__dirname + "/../modules/Logger.js");
            Bot.logger = new Logger(Bot, client);
        } catch (err) {
            return {err: err.stack};
        }
    };

    // Reload the swapi file
    client.reloadSwapi = async () => {
        try {
            delete require.cache[require.resolve(__dirname + "/../modules/swapi.js")];
            Bot.swgohAPI = require("../modules/swapi.js")(Bot);
        } catch (err) {
            return err;
        }
    };

    // Reload the users file
    client.reloadUserReg = async () => {
        try {
            delete require.cache[require.resolve("../modules/users.js")];
            Bot.userReg = require("../modules/users.js")(Bot);
        } catch (err) {
            return {err: err};
        }
    };

    // Reload the data files (ships, teams, characters)
    client.reloadDataFiles = async () => {
        try {
            Bot.abilityCosts = await JSON.parse(fs.readFileSync("data/abilityCosts.json").toString());
            Bot.acronyms     = await JSON.parse(fs.readFileSync("data/acronyms.json").toString());
            Bot.arenaJumps   = await JSON.parse(fs.readFileSync("data/arenaJumps.json").toString());
            Bot.characters   = await JSON.parse(fs.readFileSync("data/characters.json").toString());
            Bot.charLocs     = await JSON.parse(fs.readFileSync("data/charLocations.json").toString());
            Bot.missions     = await JSON.parse(fs.readFileSync("data/missions.json").toString());
            Bot.resources    = await JSON.parse(fs.readFileSync("data/resources.json").toString());
            Bot.ships        = await JSON.parse(fs.readFileSync("data/ships.json").toString());
            Bot.shipLocs     = await JSON.parse(fs.readFileSync("data/shipLocations.json").toString());
            Bot.squads       = await JSON.parse(fs.readFileSync("data/squads.json").toString());
            const gameData   = await JSON.parse(fs.readFileSync("data/gameData.json").toString());
            Bot.statCalculator.setGameData(gameData);
        } catch (err) {
            return {err: err.stack};
        }
    };

    client.reloadLanguages = async () => {
        const languageDir = __dirname + "/../languages/"
        try {
            Object.keys(Bot.languages).forEach(lang => {
                if (Bot.languages[lang]) delete Bot.languages[lang];
            });
            const langFiles = await readdir(languageDir);
            langFiles.forEach((fileName: string) => {
                const langName = fileName.split(".")[0];
                Bot.languages[langName] = require(languageDir + fileName)?.language;
                delete require.cache[require.resolve(languageDir + fileName)];
            });
        } catch (err) {
            console.log("Errored in reloadLang: " + err);
            return {err: err};
        }
    };
};


