// Roman numerals stay upper-cased ("Jedi Knight II", not "Jedi Knight Ii").
const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;

export function toProperCase(strIn: string): string {
    if (!strIn) return strIn;
    return strIn.replace(/([^\W_]+[^\s-]*) */g, (txt) => {
        if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
}
