import { defaultSettings } from "../data/constants/defaultGuildConf.ts";
import type { BotLanguage, BotType } from "../types/types.ts";

export default class Language {
    Bot: BotType;
    language: BotLanguage;
    DAYSOFWEEK: Record<string, Record<string, string>>;
    TIMES: Record<string, Record<string, string>>;

    constructor(bot: BotType) {
        this.Bot = bot;
    }

    get(str: string, ...args: null | (string | number | boolean | object)[]): string {
        if (!this.language[str]) {
            const defLang = this.Bot.languages[defaultSettings.language];
            let res = null;
            try {
                if (!args.length) {
                    res = defLang.get(str);
                } else {
                    res = defLang.get(str, ...args);
                }
            } catch (_) {
                res = `MISSING STRING: ${str}`;
            }
            return res;
        }

        let res = "";
        try {
            if (!args?.length) {
                res = this.language[str];
            } else {
                res = this.language[str](...args);
            }
        } catch (_) {
            res = `ERROR: Broken string for: ${str}`;
        }
        return res;
    }

    getDay(day: string, type: string): string {
        return this.DAYSOFWEEK[day][type];
    }
    getTime(time: string, type: string): string {
        return this.TIMES[time][type];
    }
}
