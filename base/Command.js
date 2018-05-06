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
}

module.exports = Command;
