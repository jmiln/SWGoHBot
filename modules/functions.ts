import { readdir } from "node:fs/promises";
import { inspect, promisify } from "node:util";
import {
    type Client,
    type Embed,
    type Guild,
    type GuildChannel,
    GuildMember,
    GuildMemberRoleManager,
    PermissionsBitField,
    TextChannel,
    time,
    type User,
    WebhookClient,
} from "discord.js";
import type Language from "../base/Language.ts";
import config from "../config.js";
import constants from "../data/constants/constants.ts";
import { characters, factions, ships } from "../data/constants/units.ts";
import type { BotCache } from "../types/cache_types.ts";
import type { GuildConfigSettings } from "../types/guildConfig_types.ts";
import type { SWAPIPlayer, SWAPIUnit } from "../types/swapi_types.ts";
import type { BotClient, BotInteraction, BotType, BotUnit, UserConfig } from "../types/types.ts";

// These are just the ones that need access to Bot or the client
export default (Bot: BotType, client: BotClient) => {
    // Check if the bot's account is the main (real) bot
    Bot.isMain = () => client.user.id === "315739499932024834";

    /* ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild: Guild, announceMsg: string, channel = "", guildConf: Partial<GuildConfigSettings> = {}) => {
        if (!guild?.id) return;

        // Use the guildConf announcement channel
        const announceChan = channel || guildConf?.announceChan || "";

        // Try and get the channel by ID first
        let chan = guild.channels.cache.get(announceChan.toString().replace(/[^0-9]/g, ""));

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.cache.find((c) => c.name === announceChan);
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (
            !(chan instanceof TextChannel) ||
            !chan?.send ||
            !chan?.permissionsFor(client.user)?.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
        )
            return;
        // TODO Should probably log this / tell users about the issue somehow?
        // return console.error(`[AnnounceMsg] I was not able to send a msg in guild ${guild.name} (${guild.id}) \nMsg: ${announceMsg}\nConf: ${inspect(guildConf)}`);

        // If everything is ok, go ahead and try sending the message
        await chan.send(announceMsg).catch((err) => {
            // if (err.stack.toString().includes("user aborted a request")) return;
            console.error(
                `Broke sending announceMsg: ${err.stack} \nGuildID: ${guild.id} \nChannel: ${announceChan}\nMsg: ${announceMsg}\n`,
            );
        });
    };

    // Reload all the language files
    client.reloadLanguages = async () => {
        try {
            for (const lang of Object.keys(Bot.languages)) {
                delete Bot.languages[lang];
            }
            const langFiles = await readdir(`${process.cwd()}/languages/`);
            for (const file of langFiles) {
                const langName = file.split(".")[0];
                const { default: lang } = await import(`${process.cwd()}/languages/${file}`);
                Bot.languages[langName] = new lang(Bot);
            }
        } catch (err) {
            return err;
        }
        return null;
    };

    // `await wait(1000);` to "pause" for 1 second.
    Bot.wait = promisify(setTimeout);

    // Get the ally code of someone that's registered
    Bot.getAllyCode = async (interaction: BotInteraction, user: string | string[], useInteractionId = true) => {
        const otherCodeRegex = /^-\d{1,2}$/;
        const userStr: string = Array.isArray(user) ? user?.join(" ")?.toString().trim() || "" : user;

        let userAcct: UserConfig | null = null;
        if (userStr === "me" || userStr?.match(otherCodeRegex) || (!userStr && useInteractionId)) {
            // Grab the sender's primary code
            userAcct = await Bot.userReg.getUser(interaction.user.id);
        } else if (isUserID(userStr)) {
            // Try to grab the primary code for the mentioned user
            userAcct = await Bot.userReg.getUser(userStr.replace(/[^\d]*/g, ""));
        } else if (isAllyCode(userStr)) {
            // Otherwise, just scrap everything but numbers, and send it back
            return userStr.replace(/[^\d]*/g, "");
        }

        if (userAcct?.accounts?.length) {
            let account = null;
            if (userStr?.match(otherCodeRegex)) {
                // If it's a -1/ -2 code, try to grab the specified code
                const index = Number.parseInt(userStr.replace("-", ""), 10) - 1;
                account = userAcct.accounts[index];
            } else {
                // If it's a missing allycode, a "me", or for a specified discord ID, just grab the primary if available
                account = userAcct.accounts.find((a) => a.primary);
            }
            return account ? account.allyCode : null;
        }
        return null;
    };
};

/*
 * isAllyCode
 * Check if a string of numbers is a valid ally code.
 * Needs to be a string of 9 numbers
 */
export function isAllyCode(aCode: string | number): boolean {
    if (!aCode || !aCode.toString().length) return false;
    const match = aCode
        .toString()
        .replace(/[^\d]*/g, "") // Remove non-numbers
        .match(/^\d{9}$/); // Make sure it's a string of 9 numbers
    return !!match;
}

/*
 * MESSAGE SPLITTER
 * Input an array of strings, and it will put them together so that it
 * doesn't exceed the given max length.
 */
export function msgArray(arr: string | string[], join = "\n", maxLen = 1900): string[] {
    const messages: string[] = [];
    const outArr = Array.isArray(arr) ? arr : arr.toString().split("\n");
    let currentMsg = "";
    for (const elem of outArr) {
        if (typeof elem !== "string") {
            console.error(`[functions/msgArray] ${elem} is not a string!`);
            return [];
        }
        const expandedElem = expandSpaces(elem);
        // Check if something big somehow got in
        if (expandedElem.length > maxLen) {
            throw new Error(`[functions/msgArray] Element too big! ${expandedElem}`);
        }

        if (currentMsg.length + expandedElem.length + join.length > maxLen) {
            messages.push(currentMsg);
            currentMsg = expandedElem;
        } else {
            currentMsg += (currentMsg.length > 0 ? join : "") + expandedElem;
        }
    }
    if (currentMsg?.length) messages.push(currentMsg);
    return messages;
}

// Expand multiple spaces to have zero width spaces between them so
// Discord doesn't collapse em
export function expandSpaces(str: string): string {
    let outStr = "";
    for (const e of str.split(/([\s]{2,})/)) {
        if (e.match(/[\s]{2,}/)) {
            outStr += e.split("").join(constants.zws);
        } else {
            outStr += e;
        }
    }
    return outStr;
}

export function isUserMention(mention: string): boolean {
    return /^<@!?\d{17,19}>/.test(mention);
}
export function isChannelId(mention: string): boolean {
    return /^\d{17,19}/.test(mention);
}
export function isChannelMention(mention: string): boolean {
    return /^<#\d{17,19}>/.test(mention);
}
export function isRoleMention(mention: string): boolean {
    return /^<@&\d{17,19}>/.test(mention);
}

export function getSideColor(side: string): number | null {
    if (!side) {
        console.error("[functions/getSideColor] No side provided");
        return null;
    }
    if (!["light", "dark"].includes(side.toLowerCase())) {
        console.error(`[functions/getSideColor] Invalid side: ${side}`);
        return null;
    }
    return side === "light" ? constants.colors.lightblue : constants.colors.brightred;
}

/*  PERMISSION LEVEL FUNCTION
 *  This is a very basic permission system for commands which uses "levels"
 *  "spaces" are intentionally left blank so you can add them if you want.
 *  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
 *  command including the VERY DANGEROUS `eval` and `exec` commands!
 */
export async function permLevel(interaction: BotInteraction) {
    // Depending on message or interaction, grab the ID of the user
    const permMap = constants.permMap;
    const authId = interaction.user.id;

    // If bot owner, return max perm level
    if (authId === config.ownerid) {
        return permMap.BOT_OWNER;
    }

    // If DMs or webhook, return 0 perm level.
    if (!interaction.guild || !interaction.member || !interaction.inGuild() || !(interaction.member instanceof GuildMember)) {
        return permMap.BASE_USER;
    }

    // Guild Owner gets an extra level, wooh!
    const gOwner = await interaction.guild.fetchOwner();
    if (gOwner?.id && interaction.user?.id === gOwner.id) {
        return permMap.GUILD_OWNER;
    }

    // Also giving them the permissions if they have the manage server role,
    // since they can change anything else in the server, so no reason not to
    if (
        interaction.member.permissions.has([PermissionsBitField.Flags.Administrator]) ||
        interaction.member.permissions.has([PermissionsBitField.Flags.ManageGuild])
    ) {
        return permMap.GUILD_ADMIN;
    }

    // The rest of the perms rely on roles. If those roles are not found
    // in the settings, or the user does not have it, their level will be 0
    const guildConf = interaction.guildSettings;
    const hasAdminRole = guildConf?.adminRole?.some((roleId) => {
        const adminRole = interaction.guild.roles.cache.find((r) => r.id === roleId || r.name.toLowerCase() === roleId.toLowerCase());
        return adminRole && hasRole(interaction, adminRole.id);
    });
    return hasAdminRole ? permMap.GUILD_ADMIN : permMap.BASE_USER;
}
function hasRole(interaction: BotInteraction, roleId: string): boolean {
    return (
        interaction.inGuild() &&
        interaction.member &&
        interaction.member.roles instanceof GuildMemberRoleManager &&
        interaction.member.roles.cache.has(roleId)
    );
}

// Default formatting for current US/Pacific time
// TODO: Make this work for other timezones / put the timezone into the config
export function myTime(): string {
    return Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZone: "America/Los_Angeles",
    }).format(new Date());
}

// This finds any character that matches the search, and returns them in an array
export function findChar(searchName: string, charList: BotUnit[], isShip = false): BotUnit[] {
    if (!searchName?.length || typeof searchName !== "string") {
        return [];
    }
    let cleanSearchName = searchName.toLowerCase();

    // Try for a defId/ uniqueName match first
    let foundChar = charList.filter((char) => char.uniqueName === cleanSearchName.toUpperCase());
    if (foundChar.length) return foundChar;

    // Try for an actual exact match
    foundChar = charList.filter((char) => char.name.toLowerCase() === cleanSearchName);
    if (foundChar.length) return foundChar;

    // Clean out extra spaces and improper apostrophes
    cleanSearchName = cleanSearchName.replace(/’/g, "'").trim();

    // Try finding an exact match for the name or aliases
    foundChar = charList.filter((char) => char.name.toLowerCase() === cleanSearchName);
    if (!foundChar.length) {
        foundChar = charList.filter((char) => char.aliases.some((alias) => alias.toLowerCase() === cleanSearchName));
    }
    if (isShip && !foundChar.length) {
        foundChar = charList.filter((ship) => ship.crew?.some((crew) => crew.toLowerCase() === cleanSearchName));
    }
    if (foundChar.length) return foundChar;

    // Then see if the searchName is a part of one of the names or aliases
    foundChar = charList.filter((char) => char.name.toLowerCase().split(" ").includes(cleanSearchName));
    if (!foundChar.length) {
        foundChar = charList.filter((char) => char.aliases.some((alias) => alias.toLowerCase().split(" ").includes(cleanSearchName)));
    }
    if (isShip && !foundChar.length) {
        foundChar = charList.filter((ship) => ship.crew?.some((crew) => crew.toLowerCase().split(" ").includes(cleanSearchName)));
    }
    if (foundChar.length) return foundChar;

    // Then try to split up the search by spaces, and see if any part of that finds any matches
    const splitName = cleanSearchName.split(" ");
    foundChar = charList.filter((char) => splitName.some((name) => char.name.toLowerCase().includes(name)));
    if (foundChar.length) return foundChar;

    // If by here, it hasn't found any matching character or ship, return an empty array
    return [];
}

// Parse the webhook url, and get the id & token from the end
export function parseWebhook(url: string): { id: string; token: string } {
    const [id, token] = url.split("/").slice(-2);
    return { id, token };
}

// Send a message to a webhook url, takes the url & the embed to send
export function sendWebhook(hookUrl: string, embed: Embed): void {
    const { id, token } = parseWebhook(hookUrl);
    const hook = new WebhookClient({ id, token });
    hook.send({ embeds: [embed] }).catch(console.error);
}

// Return a duration string
export function duration(time: number, interaction: BotInteraction | null = null): string {
    if (!interaction?.language) throw new Error("[functions/duration] Missing language setting");
    const lang = interaction.language;

    if (!time) console.error(`[functions/duration] Missing time value.\n${inspect(interaction?.options)}`);
    const timeDiff = Math.abs(Date.now() - time);
    return formatDuration(timeDiff, lang);
}

// Given a duration number, format the string like it would have been done from moment-duration-format before
export function formatDuration(duration: number, lang: Language): string {
    const durationMS = convertMS(duration);
    const outArr: string[] = [];

    if (durationMS.hour) {
        outArr.push(
            `${durationMS.hour || "0"} ${durationMS.hour > 1 ? lang.getTime("HOUR", "SHORT_PLURAL") : lang.getTime("HOUR", "SHORT_SING")}`,
        );
    }
    outArr.push(`${durationMS.minute || "0"} ${lang.getTime("MINUTE", "SHORT_SING")}`);

    return outArr.join(", ");
}

export function formatCurrentTime(zone: string): string {
    // Format it with whatever zone the server is
    const tz = !zone || !isValidZone(zone) ? "UTC" : zone;

    return Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZone: tz,
    }).format(new Date());
}

// Check against the list of timezones to make sure the given one is valid
export function isValidZone(zone: string): boolean {
    // Check if the entered string is a valid timezone (According to Wikipedia's list), so go ahead and process
    if (!zone) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: zone });
        return true;
    } catch (_) {
        return false;
    }
}

// Return the full name of whatever day of the week it is
export function getCurrentWeekday(zone?: string): string {
    const tz = isValidZone(zone) ? zone : "UTC";
    return Intl.DateTimeFormat("en", { weekday: "long", timeZone: tz }).format(new Date());
}

// Get the offset for a given timezone, based on:
// https://stackoverflow.com/a/64263359
export function getTimezoneOffset(zone: string): number | null {
    if (!isValidZone(zone)) {
        console.error("[functions/getTimezoneOffset] Missing or invalid timezone");
        return null;
    }
    const timeZoneName =
        Intl.DateTimeFormat("ia", { timeZoneName: "short", timeZone: zone })
            .formatToParts()
            .find((i) => i.type === "timeZoneName")?.value || "";
    const offset = timeZoneName.slice(3);
    if (!offset) return 0;

    const matchData = offset.match(/([+-])(\d+)(?::(\d+))?/);
    if (!matchData) throw new Error(`[functions/getTimezoneOffset] Cannot parse timezone name: ${timeZoneName}`);

    const [, sign, hour, minute] = matchData;
    let result = Number.parseInt(hour, 10) * 60;
    if (sign === "-") result *= -1;
    if (minute) result += Number.parseInt(minute, 10);

    return result;
}

export function getSetTimeForTimezone(mmddyyyy_HHmm: string, zone: string): number {
    const offset = getTimezoneOffset(zone);
    const [month, day, year, hour, min] = mmddyyyy_HHmm.split(/[/\s:]/).map((i) => Number.parseInt(i, 10));
    if (year.toString().length !== 4) throw Error("[getSetTimeForTimezone] Year MUST be 4 numbers long");
    const utcAtTarget = Date.UTC(year, month - 1, day, hour, min);
    return utcAtTarget - (offset ?? 0) * constants.minMS;
}

export function getUTCFromOffset(offset: number): number {
    const date = new Date();
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - offset * constants.minMS;
}

export function getStartOfDay(zone: string): Date {
    const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
    const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

    day.setHours(day.getHours() - Number.parseInt(localeHour, 10), 0, 0, 0);
    return day;
}

export function getEndOfDay(zone: string): Date {
    const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
    const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

    day.setHours(day.getHours() - Number.parseInt(localeHour, 10) + 23, 59, 59, 999);
    return day;
}

/*
 * LAST UPDATED FOOTER
 * Simple one to make the "Last updated ____ " footer strings and display them with Discord's timestamp format
 */
export function updatedFooterStr(updated: number, interaction: BotInteraction | null = null): string {
    if (!updated) {
        console.error("[functions/updatedFooterStr] Missing updated timestamp");
        return "";
    }

    if (!interaction?.language) throw new Error("[functions/updatedFooterStr] Missing language setting");

    return interaction.language.get("BASE_SWGOH_LAST_UPDATED", time(Math.floor(updated / 1000)));
}

// Get the current user count
export async function userCount(client: Client): Promise<number> {
    if (client.shard?.count) {
        return (
            (await client.shard
                .fetchClientValues("users.cache.size")
                .then((results: number[]) => results.reduce((prev, val) => prev + val, 0))
                .catch(console.error)) || 0
        );
    }
    return client.users.cache.size || 0;
}

// Get the current guild count
export async function guildCount(client: Client): Promise<number> {
    if (client.shard?.count) {
        return (
            (await client.shard
                .fetchClientValues("guilds.cache.size")
                .then((results: number[]) => results.reduce((prev, val) => prev + val, 0))
                .catch(console.error)) || 0
        );
    }
    return client.guilds.cache.size || 0;
}

/* isUserID
 * Check if a string of numbers is a valid user.
 */
export function isUserID(numStr: string): boolean {
    if (!numStr || !numStr.length) return false;
    const match = /(?:<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
    return !!match;
}

/* getUserID
 * Get a valid Discord id string from a given string.
 */
export function getUserID(userMention: string): string | null {
    if (!userMention || !userMention.length) return null;
    const match = /(?:<@!?)?([0-9]{17,20})>?/gi.exec(userMention);
    if (match) {
        return userMention.replace(/[^0-9]/g, "");
    }
    return null;
}

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
export function makeTable(
    headers: {
        [key: string]: {
            value: string;
            startWith?: string;
            endWith?: string;
            align?: string;
        };
    },
    rows: { [key: string]: string | number }[],
    options = {
        boldHeader: true,
        useHeader: true,
    },
) {
    if (!headers || !rows?.length) throw new Error("Need both headers and rows");
    const max = {};
    for (const h in headers) {
        // Get the max length needed, then add a bit for padding
        if (options.useHeader) {
            // console.log(h, rows);
            max[h] = Math.max(...[headers[h].value.length].concat(rows.map((v) => v[h]?.toString().length || 0))) + 2;
        } else {
            max[h] =
                Math.max(
                    ...rows.map((v) => {
                        if (!v[h]) return 0;
                        return v[h].toString().length;
                    }),
                ) + 2;
        }
    }

    let header = "";
    const out = [];

    if (options.useHeader) {
        for (const h in headers) {
            const headerMax = max[h];
            const head = headers[h];
            if (head?.value.length) {
                const pad = headerMax - head.value.length;
                const padBefore = Math.floor(pad / 2);
                const padAfter = pad - padBefore;
                header += head.startWith ? head.startWith : "";
                if (padBefore) header += " ".repeat(padBefore);
                header += head.value;
                if (padAfter) header += " ".repeat(padAfter);
                header += head.endWith ? head.endWith : "";
            } else {
                header += head.startWith ? head.startWith : "";
                header += " ".repeat(headerMax);
                header += head.endWith ? head.endWith : "";
            }
        }
        if (options.boldHeader) {
            out.push(expandSpaces(`**${header}**`));
        } else {
            out.push(expandSpaces(header));
        }
    }
    for (const r of rows) {
        let row = "";
        Object.keys(headers).forEach((header, ix) => {
            const rowMax = max[header];
            const head = headers[header];
            let value = r[header];
            if (!value) value = 0;
            const pad = rowMax - value.toString().length;
            row += head.startWith ? head.startWith : "";
            if (!head.align || (head.align && head.align === "center")) {
                const padBefore = Math.floor(pad / 2);
                const padAfter = pad - padBefore;
                if (padBefore) row += " ".repeat(padBefore);
                row += value;
                if (padAfter) row += " ".repeat(padAfter);
            } else if (head.align === "left" && ix === 0 && !head.startWith) {
                row += value + " ".repeat(pad - 1);
            } else if (head.align === "left") {
                row += ` ${value}${" ".repeat(pad - 1)}`;
            } else if (head.align === "right") {
                row += `${" ".repeat(pad - 1) + value} `;
            } else {
                throw new Error("Invalid alignment");
            }
            row += head.endWith ? head.endWith : "";
        });
        out.push(expandSpaces(row.replace(/\s*$/, "")));
    }

    return out;
}

// Small function to search the factions
export function findFaction(fact: string): string | string[] | null {
    const formattedFact = fact.toLowerCase().replace(/\s+/g, "");
    let found = factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === formattedFact);
    if (found) {
        return found.toLowerCase();
    }
    found = factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === formattedFact.substring(0, formattedFact.length - 1));
    if (formattedFact.endsWith("s") && found) {
        return found.toLowerCase();
    }
    found = factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === `${formattedFact}s`);
    if (!formattedFact.endsWith("s") && found) {
        return found.toLowerCase();
    }
    const close = factions.filter((f) => f.toLowerCase().replace(/\s+/g, "").includes(formattedFact.toLowerCase()));
    if (close.length) {
        return close.map((f) => f.toLowerCase());
    }

    return null;
}

// Convert from milliseconds
export function convertMS(milliseconds: number): { hour: number; minute: number; totalMin: number; seconds: number } {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const totalMin = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hour = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    return {
        hour: hour,
        minute: minute,
        totalMin: totalMin,
        seconds: seconds,
    };
}

// Return a divider of equals signs
export function getDivider(count: number, divChar = "="): string {
    if (count <= 0) throw new Error("Invalid count value");
    if (typeof divChar !== "string") throw new Error("divChar must be a string!");
    return divChar.repeat(count);
}

export function chunkArray<T>(inArray: Array<T>, chunkSize: number): Array<Array<T>> {
    if (!Array.isArray(inArray)) throw new Error("[chunkArray] inArray must be an array!");
    const res = [];
    for (let ix = 0, len = inArray.length; ix < len; ix += chunkSize) {
        res.push(inArray.slice(ix, ix + chunkSize));
    }
    return res;
}

// Returns a gear string (9+4 or 13r5), etc
export function getGearStr(charIn: SWAPIUnit, preStr = ""): string {
    // If the character is not unlocked
    if (!charIn?.gear) return "N/A";

    let charGearOut = preStr + charIn.gear.toString();
    if (charIn.equipped?.length) {
        charGearOut += `+${charIn.equipped.length}`;
    } else if (charIn?.relic?.currentTier > 2) {
        charGearOut += `r${charIn.relic.currentTier - 2}`;
    }
    return charGearOut;
}

// Get the overall levels for a guild as a whole (Gear, rarity, relic, etc)
export function summarizeCharLevels(guildMembers: SWAPIPlayer[], type: string): [{ [key: number]: number }, string] {
    const max = { gear: 13, relic: 9, rarity: 7 };
    if (!max?.[type]) throw new Error(`[summarizeLevels] Invalid type (${type})`);
    if (!Array.isArray(guildMembers)) throw new Error("[summarizeCharLevels] guildMembers must be an array!");

    const levels = {};
    for (let ix = max[type]; ix >= 1; ix--) {
        let lvlCount = 0;
        for (const member of guildMembers) {
            if (type === "relic") {
                lvlCount += member.roster.filter((c) => c?.combatType === 1 && c.relic?.currentTier - 2 === ix).length;
            } else {
                lvlCount += member.roster.filter((c) => c?.combatType === 1 && c[type] === ix).length;
            }
        }
        if (lvlCount > 0) {
            levels[ix] = lvlCount;
        }
    }
    const tieredLvl = Object.keys(levels).reduce((acc, curr) => acc + levels[curr] * Number.parseInt(curr, 10), 0);
    const totalLvl = Object.keys(levels).reduce((acc, curr) => acc + levels[curr], 0);
    const avgLvls = (tieredLvl / totalLvl).toFixed(2);

    return [levels, avgLvls];
}

const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;
export function toProperCase(strIn: string): string {
    if (!strIn) return strIn;
    return strIn.replace(/([^\W_]+[^\s-]*) */g, (txt) => {
        if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}

// Trim down large numbers to be more easily readable
export function shortenNum(number: number, trimTo = 2): string {
    const million = 1_000_000;
    const thousand = 1_000;

    if (number >= million) {
        return `${trimFloat(number / million, trimTo)}M`;
    }
    if (number >= thousand) {
        return `${trimFloat(number / thousand, trimTo)}K`;
    }
    return number.toString();
}

// Helper for shortenNum,
// Trims a fload down to either 0 or 1 (by default) decimal points
export function trimFloat(num: number, dec = 1): string {
    if (num % 1 === 0) {
        return num.toString();
    }
    return num.toFixed(dec);
}

// Check the abilities table in the swapi db, and sort out what each omicron is good for
export async function sortOmicrons(cache: BotCache): Promise<{
    tw: number[];
    ga3: number[];
    ga: number[];
    tb: number[];
    raid: number[];
    conquest: number[];
    other: number[];
}> {
    // Get all omicron abilities
    const abilityList = (await cache.get(
        config.mongodb.swapidb,
        "abilities",
        {
            isOmicron: true,
            language: "eng_us",
        },
        {
            skillId: 1,
            _id: 0,
            descKey: 1,
        },
    )) as { skillId: number; descKey: string }[];

    const omicronTypes = {
        tw: [],
        ga3: [],
        ga: [],
        tb: [],
        raid: [],
        conquest: [],
        other: [],
    };

    for (const ab of abilityList) {
        const key = ab.descKey.toLowerCase();
        if (key.includes("3v3 grand arenas")) {
            omicronTypes.ga3.push(ab.skillId);
        } else if (key.includes("grand arenas")) {
            omicronTypes.ga.push(ab.skillId);
        } else if (key.includes("territory war")) {
            omicronTypes.tw.push(ab.skillId);
        } else if (key.includes("territory battle")) {
            omicronTypes.tb.push(ab.skillId);
        } else if (key.includes("conquest")) {
            omicronTypes.conquest.push(ab.skillId);
        } else if (key.includes("raid")) {
            omicronTypes.raid.push(ab.skillId);
        } else {
            omicronTypes.other.push(ab.skillId);
        }
    }
    return omicronTypes;
}

// Function to see if we have permission to see/ send messages in a given channel
export async function hasViewAndSend(channel: GuildChannel, user: User | GuildMember): Promise<boolean> {
    return (
        (channel?.guild &&
            channel.permissionsFor(user)?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) ||
        false
    );
}

// Cache the units list to avoid recreating it on every call
const allUnitsList: BotUnit[] = [...characters, ...ships];

export async function getBlankUnitImage(defId: string): Promise<Buffer | null> {
    return await getUnitImage(defId, {
        gear: -1,
        level: -1,
        rarity: -1,
        skills: null,
        relic: null,
    });
}

export async function getUnitImage(defId: string, { rarity, level, gear, skills, relic }: Partial<SWAPIUnit>): Promise<Buffer | null> {
    let thisChar: BotUnit | undefined;

    try {
        thisChar = allUnitsList.find((ch) => ch.uniqueName === defId);
    } catch (err) {
        console.error("[functions/getUnitImage] Issue getting character image:");
        console.error(err);
        return null;
    }

    if (!thisChar) {
        console.error(`[functions/getUnitImage] Cannot find matching defId: ${defId}`);
        return null;
    }
    const fetchBody = {
        defId,
        charUrl: thisChar?.avatarURL,
        avatarName: thisChar?.avatarName,
        rarity,
        level,
        gear,
        zetas: skills?.filter((s) => s.isZeta && (s.tier >= s?.zetaTier || (s.isOmicron && s.tier >= s.tiers - 1))).length || 0,
        relic: relic?.currentTier || 0,
        omicron: skills?.filter((s) => s.isOmicron && s.tier === s.tiers).length || 0,
        side: thisChar.side,
    };

    try {
        const res = await fetch(`${config.imageServIP_Port}/char/`, {
            method: "post",
            body: JSON.stringify(fetchBody),
            headers: { "Content-Type": "application/json" },
        });
        const resBuf = await res.arrayBuffer();
        return resBuf ? Buffer.from(resBuf) : null;
    } catch (e) {
        console.error(`[functions/getUnitImage] Error requesting image from server.\n${e}`);
        return null;
    }
}
