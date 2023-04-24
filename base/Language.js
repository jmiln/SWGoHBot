class Language {
    constructor(bot) {
        this.Bot = bot;
    }

    get(str, ...args) {
        if (!this.language[str]) {
            const defLang = this.Bot.languages[this.Bot.config.defaultSettings.language];
            let res = "";
            try {
                if (!args.length) {
                    res = defLang.get(str);
                } else {
                    res = defLang.get(str, ...args);
                }
            } catch (e) {
                res = "MISSING STRING: " + str;
            }
            return res;
        } else {
            let res = null;
            if (args.length > 0 && typeof this.language[str] === "function") {
                res = this.language[str](...args);
            } else {
                res = this.language[str];
            }
            if (!res?.length) {
                // Something went wonky, and it needs something to be fixed
                //  - Likely old one where it used to have a prefix / argument, but has been updated to not in the ENG
                res = "ERROR: Broken string for: " + str;
            }
            return res;
        }
    }
}

module.exports = Language;
