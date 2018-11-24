class Command {
    constructor(client, {
        name = null,
        description = "No description provided.",
        category = "General",
        usage = "No usage provided.",
        example = "No example provided",
        extended = "No information provided.",
        hidden = false,
        enabled = true, 
        guildOnly = false,
        aliases = [],
        permissions = [],
        permLevel = 0,
        flags = {},
        subArgs = {}
    }) {
        this.client = client;
        this.conf = {
            enabled,
            hidden,
            guildOnly,
            aliases,
            permissions,
            permLevel,
            flags,
            subArgs
        };
        this.help = {
            name,
            description,
            category,
            usage,
            example,
            extended
        };
    }

    async getUserAndChar(message, [userID, ...searchChar], charNeeded=true) {
        const out = {
            allyCode: null,
            searchChar: null,
            err: null
        };
        if (!userID) {
            // No user or char, just return null for both
            // with an error
            if (charNeeded) {
                out.err = message.language.get("BASE_SWGOH_MISSING_CHAR");
            } else {
                userID = message.author.id;
            }
        } else if (userID !== "me" && !this.client.isAllyCode(userID) && !this.client.isUserID(userID)) {
            // No valid user, so return it all as a character, and 
            // use the message's author as the user
            out.searchChar = (userID + " " + searchChar.join(" ")).trim();
            userID = message.author.id;
        } else {
            // There was a valid user first, so use that and the rest
            // as the character
            if (searchChar.length) {
                out.searchChar = searchChar.join(" ").trim();
            } else if (charNeeded) {
                // There was a userID, but no character
                out.err = message.language.get("BASE_SWGOH_MISSING_CHAR");
            }
        }

        // If it got this far, it's got a valid userID (ally code or Discord ID)
        // so regardless of which, grab an ally code 
        if (userID && (out.searchChar || !charNeeded)) {
            const allyCodes = await this.client.getAllyCode(message, userID);
            if (!allyCodes.length) {
                out.err = message.language.get("BASE_SWGOH_NO_ALLY", message.guildSettings.prefix);
            } else if (allyCodes.length > 1) {
                out.err =  message.channel.send("Found " + allyCodes.length + " matches. Please try being more specific");
            } else {
                out.allyCode = allyCodes[0];
            }
        }

        return out;
    }

















}

module.exports = Command;
