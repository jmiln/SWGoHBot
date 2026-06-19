import { defaultSettings } from "../data/constants/defaultGuildConf.ts";

export default class Language {
    // Static registry for all language instances
    private static _languages: Record<string, Language> = {};

    // Values can be plain strings, lookup objects (e.g. BASE_MOD_TYPES), or template
    // functions; params are intentionally untyped (any) so each language file's inline
    // arrow functions stay unannotated. get() narrows results back to string.
    // biome-ignore lint/suspicious/noExplicitAny: contextual typing for 7k+ lines of lang strings
    language: Record<string, string | object | ((...args: any[]) => unknown)>;
    DAYSOFWEEK: Record<string, Record<string, string>>;
    TIMES: Record<string, Record<string, string>>;

    /**
     * Get all registered languages
     */
    static getLanguages(): Record<string, Language> {
        return Language._languages;
    }

    /**
     * Register a language instance
     */
    static registerLanguage(code: string, instance: Language): void {
        Language._languages[code] = instance;
    }

    /**
     * Get a specific language instance
     */
    static getLanguage(code: string): Language | undefined {
        return Language._languages[code];
    }

    /**
     * Clear all registered languages (used during reload)
     */
    static clearLanguages(): void {
        Language._languages = {};
    }

    get(str: string, ...args: (string | number | boolean | object)[]): string {
        if (!this.language[str]) {
            const defLang = Language._languages[defaultSettings.language];
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
                res = this.language[str] as string;
            } else {
                res = (this.language[str] as (...args: (string | number | boolean | object)[]) => string)(...args);
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
