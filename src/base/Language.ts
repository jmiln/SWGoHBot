class LanguageHandler {
    constructor(bot: {}) {
        this.Bot = bot;
    }

    get(str: string, ...args: string[]) {
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
            return (args.length > 0 && typeof this.language[str] === "function") ? this.language[str](...args) : this.language[str];
        }
    }
}

export default LanguageHandler;
