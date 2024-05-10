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
                res = `MISSING STRING: ${str}`;
            }
            return res;
        }

        // return (args.length > 0 && typeof this.language[str] === "function") ? this.language[str](...args) : this.language[str];
        let res = "";
        try {
            if (!args?.length) {
                res = this.language[str];
            } else {
                res = this.language[str](...args);
            }
        } catch (err) {
            res = `ERROR: Broken string for: ${str}`;
        }
        return res;
    }
}

module.exports = Language;
