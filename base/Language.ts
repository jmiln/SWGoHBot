import type { BotLanguage, BotType } from "../types/types.ts";

export default class Language {
    Bot: BotType;
    language: BotLanguage;
    constructor(bot: BotType) {
        this.Bot = bot;
    }

    get(str: string, ...args: null | (string | number)[]) {
        if (!this.language[str]) {
            const defLang = this.Bot.languages[this.Bot.config.defaultSettings.language];
            let res = "";
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

    getDay(day: string, type: string) {
        return this.getDay(day, type);
    }
    getTime(time: string, type: string) {
        return this.getTime(time, type);
    }
}
