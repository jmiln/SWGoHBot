

class Language {
    constructor(c) {
        this.client = c;
    }

    get(str, ...args) {
        if (!this.language[str]) {
            const defLang = this.client.languages[this.client.config.defaultSettings.language];
            // If it isn't in the configured language's file, use the main one (probably en_US)
            if (!defLang[str]) {
                return 'MISSING STRING: ' + str;
            }
            if (!args.length) {
                return defLang.get(str);
            } else {
                return defLang.get(str, ...args);
            }
        } else {
            // console.log(args)
            return (args.length > 0 && typeof this.language[str] === 'function') ? this.language[str](...args) : this.language[str];
        }
    }
}

module.exports = Language;
