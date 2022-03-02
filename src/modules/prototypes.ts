/*
 * String Prototypes
 */

/*
 * Number Prototypes
 */

// Trim down large numbers to be more easily readable
Number.prototype.shortenNum = function(trimTo=2) {
    const million = 1000000, thousand = 1000;
    let number = this;

    if (number >= million) {
        number = (number / million);
        number = trimFloat(number, trimTo) + "M";
    } else if (number >= thousand) {
        number = (number / thousand);
        number = parseInt(number, 10) + "K";
    }
    return number;
};

// Helper for shortenNum,
// Trims a fload down to either 0 or 1 (by default) decimal points
function trimFloat(num, dec=1) {
    if (num % 1 === 0) {
        num = parseInt(num, 10);
    } else {
        num = num.toFixed(dec);
    }
    return num;
}
