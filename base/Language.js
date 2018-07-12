

class Language {
    constructor(c) {
        this.client = c;
    }

    get(str, ...args) {
        if (!this.language[str]) {
            const defLang = this.client.languages[this.client.config.defaultSettings.language];
            let res = '';
            try {
                if (!args.length) {
                    res = defLang.get(str);
                } else {
                    res = defLang.get(str, ...args);
                }
            } catch (e) {
                res = 'MISSING STRING: ' + str;
            }
            return res;
        } else {
            return (args.length > 0 && typeof this.language[str] === 'function') ? this.language[str](...args) : this.language[str];
        }
    }
}

module.exports = Language;
