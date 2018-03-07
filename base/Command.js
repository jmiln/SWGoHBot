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
        permLevel = 0
    }) {
        this.client = client;
        this.conf = {
            enabled,
            hidden,
            guildOnly,
            aliases,
            permLevel
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
}

module.exports = Command;
