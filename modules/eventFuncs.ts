import type { Client } from "discord.js";
import Language from "../base/Language.ts";
import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import { getGuildSettings } from "../modules/guildConfig/settings.ts";
import type { GuildConfigEvent, GuildConfigSettings } from "../types/guildConfig_types.ts";
import { announceMsg, formatDuration } from "./functions.ts";
import { deleteGuildEvent, getGuildEvents, setEvents } from "./guildConfig/events.ts";
import logger from "./Logger.ts";

class EventFuncs {
    private client!: Client<true>;

    // Time constants
    private readonly dayMS = 86400000;
    private readonly hourMS = 3600000;
    private readonly minMS = 60000;
    private readonly lateEventThresholdMS = 2 * this.minMS;

    /**
     * Initialize the EventFuncs module with Discord client dependency
     */
    init(client: Client<true>): void {
        this.client = client;
    }

    // Handle any events that have been found via the checker
    async manageEvents(eventList: GuildConfigEvent[]): Promise<void> {
        for (const event of eventList) {
            if (event.isCD) {
                // It's a countdown alert, so do that
                this.countdownAnnounce(event);
            } else {
                // It's a full event, so announce that
                this.eventAnnounce(event);
            }
        }
    }

    // BroadcastEval a message send
    private async sendMsg(
        event: GuildConfigEvent,
        guildConf: GuildConfigSettings,
        guildId: string,
        messageToAnnounce: string,
    ): Promise<void> {
        if (guildConf.announceChan !== "" || event.channel !== "") {
            let chan = "";
            if (event?.channel?.length) {
                // If they've set a channel, use it
                chan = event.channel;
            } else {
                chan = guildConf.announceChan;
            }
            try {
                await this.client.shard.broadcastEval(
                    async (client, { guildId, announceMessage, chan, guildConf }) => {
                        const targetGuild = client.guilds.cache.get(guildId);
                        if (targetGuild) {
                            announceMsg({ client: client as Client<true>, guild: targetGuild, announceMessage, channel: chan, guildConf });
                        }
                    },
                    {
                        context: {
                            guildId,
                            announceMessage: messageToAnnounce,
                            chan,
                            guildConf,
                        },
                    },
                );
            } catch (e) {
                logger.error(`Broke trying to announce event with name/channel: ${event.name} (${event.channel}) \n${e.stack}`);
            }
        }
    }

    // Re-calculate a viable eventDT, and return the updated event
    private async reCalc(ev: GuildConfigEvent): Promise<GuildConfigEvent | null> {
        const nowTime = Date.now();
        if (ev.repeatDays && ev.repeatDays.length > 0) {
            // repeatDays is an array of days to skip
            // If it's got repeatDays set up, splice the next time, and if it runs out of times, return null
            while (nowTime > ev.eventDT && ev.repeatDays.length > 0) {
                const days = ev.repeatDays.splice(0, 1)[0];
                ev.eventDT = ev.eventDT + this.dayMS * days;
            }
            if (nowTime > ev.eventDT) {
                // It ran out of days
                return null;
            }
        } else if (ev.repeat && (ev.repeat.repeatDay || ev.repeat.repeatHour || ev.repeat.repeatMin)) {
            // 0d0h0m
            // Else it's using basic repeat
            while (nowTime >= ev.eventDT) {
                ev.eventDT =
                    ev.eventDT + ev.repeat.repeatDay * this.dayMS + ev.repeat.repeatHour * this.hourMS + ev.repeat.repeatMin * this.minMS;
            }
        }
        return ev;
    }

    // Send out an alert based on the guild's countdown settings
    async countdownAnnounce(event: GuildConfigEvent): Promise<void> {
        const guildConf = await getGuildSettings({ guildId: event.guildId });
        const diffNum = Math.abs(Date.now() - event.eventDT);
        const language = Language.getLanguage(guildConf.language) || Language.getLanguage(defaultSettings.language);
        const timeToGo = formatDuration(diffNum, language);

        const announceMessage = language.get("BASE_EVENT_STARTING_IN_MSG", event.name, timeToGo);

        await this.sendMsg(event, guildConf, event.guildId, announceMessage);
    }

    async eventAnnounce(event: GuildConfigEvent): Promise<void> {
        // Parse out the eventName and guildName from the ID
        const guildConf = await getGuildSettings({ guildId: event.guildId });
        const language = Language.getLanguage(guildConf.language) || Language.getLanguage(defaultSettings.language);

        let outMsg = event?.message || "";

        // If it's running late, tack a notice onto the end of the message
        const diffTime = Math.abs(event.eventDT - Date.now());
        if (diffTime > this.lateEventThresholdMS) {
            const minPast = Math.floor(diffTime / this.minMS);
            outMsg += `\n> This event is ${minPast} minutes past time.`;
        }

        // Announce the event
        const announceMessage = `**${event.name}**\n${outMsg}`;
        await this.sendMsg(event, guildConf, event.guildId, announceMessage);

        let doRepeat = false;
        if ((event.repeat && (event.repeat.repeatDay || event.repeat.repeatHour || event.repeat.repeatMin)) || event.repeatDays?.length) {
            if (event.repeatDays?.length === 1) {
                event.message += language.get("BASE_LAST_EVENT_NOTIFICATION");
            }

            const tmpEv = await this.reCalc(event);
            if (tmpEv) {
                // Got a viable next time, so set it and move on
                event.eventDT = tmpEv.eventDT;
                event.repeatDays = tmpEv.repeatDays;
                event.repeat = tmpEv.repeat;
            }
            doRepeat = true;
        }

        if (doRepeat) {
            // If it's set to repeat, just delete the old one, and save a new version of the event
            const guildEvents = await getGuildEvents({ guildId: event.guildId });
            const evArrOut = guildEvents.filter((ev) => ev.name !== event.name);
            evArrOut.push(event);
            await setEvents({ guildId: event.guildId, evArrOut })
                .then(() => {
                    // console.log(`Updating repeating event ${event.name} (${event.channel}).`);
                })
                .catch((error) => {
                    logger.error(`Broke trying to replace event: ${error}`);
                });
        } else {
            // If it's not going to be repeating, just destroy it
            await deleteGuildEvent({ guildId: event.guildId, evName: event.name })
                .then(() => {
                    logger.debug(`Deleting non-repeating event ${event.name}`);
                })
                .catch((error) => {
                    logger.error(`Broke trying to delete old event ${error}`);
                });
        }
    }
}

// Create and export singleton instance
const eventFuncs = new EventFuncs();

export default eventFuncs;
export { EventFuncs };
