/*
 * String Prototypes
 */

// Like camel-case but with spaces
String.prototype.toProperCase = function() {
    return this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

/*
 * Number Prototypes
 */

// Trim down large numbers to be more easily readable
Number.prototype.shortenNum = function() {
    const million = 1000000, thousand = 1000;
    let number = this;

    if (number >= million) {
        number = (number / million);
        number = trimFloat(number) + "M";
    } else if (number >= thousand) {
        number = (number / thousand);
        number = parseInt(number) + "K";
    }
    return number;
};

// Helper for shortenNum,
// Trims a fload down to either 0 or 1 decimal points
function trimFloat(num) {
    if (num % 1 === 0) {
        num = parseInt(num);
    } else {
        num = num.toFixed(1);
    }
    return num;
}
