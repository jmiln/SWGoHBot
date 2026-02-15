# Contributing to this repository

First, you will need to create a **[GitHub Account](https://github.com/join)**

## Translating
If you're interested in helping translate this bot into a language other than English, download this repository or get the file from `/languages/en_US.js`.

**Important: Please do NOT use automated translators like Google Translate. Native speakers will notice the quality issues.**

Available languages to contribute to:
- `en_US.js` - English (base language)
- `de_DE.js` - German
- `es_SP.js` - Spanish
- `ko_KR.js` - Korean
- `pt_BR.js` - Portuguese (Brazilian)

If you're fluent in another language and would like to add it, feel free to create a new language file based on `en_US.js` and submit it via pull request.

### Translation Guidelines

Language files contain translation keys used throughout the bot for slash command responses, error messages, and other user-facing text. Here's how to translate them:

#### What to change and what not to
- **Keys (ALL_CAPS)**: Like `BASE_SWGOH_LAST_UPDATED` must stay exactly as-is - these are identifiers
- **Arrow functions**: Keep syntax like `(prefix) =>` or `(num, val) =>` unchanged - these pass variables
- **Template variables**: Anything inside `${variable}` must not be translated - these are placeholders
- **Object properties**: Before the `:` stays the same (e.g., `description:`, `usage:`)
- **Quoted strings**: Text inside `` ` ` ``, `''`, or `""` should be translated

Example (English):
```js
BASE_SWGOH_LAST_UPDATED: (date) => `Game data last updated: ${date}`,
```

Example (German):
```js
BASE_SWGOH_LAST_UPDATED: (date) => `Spieldaten zuletzt aktualisiert: ${date}`,
```

## Making a new slash command or updates to anything

### Creating a New Slash Command
All commands are TypeScript files in the `/slash/` directory that extend the base `Command` class from `/base/slashCommand.ts`.

Basic command structure:
```typescript
import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.ts";
import type { CommandContext } from "../types/types.ts";

export default class MyCommand extends Command {
    static readonly metadata = {
        name: "mycommand",
        guildOnly: false,
        description: "Description of what this command does",
        options: [
            {
                name: "argument",
                description: "Example argument",
                type: ApplicationCommandOptionType.String,
                required: false,
            },
        ],
        permLevel: 0, // 0 = everyone, 1 = server admin, 10 = bot owner
    };

    constructor() {
        super(MyCommand.metadata);
    }

    async run({ interaction, language, swgohLanguage, guildSettings }: CommandContext) {
        // Your command logic here
        // CommandContext provides:
        // - interaction: Discord ChatInputCommandInteraction
        // - language: Language instance for localized strings
        // - swgohLanguage: Game language setting
        // - guildSettings: Guild configuration
        // - permLevel: User's permission level

        await interaction.reply("Command output");
    }
}
```

**Importing Data and Modules:**
Commands use ES module imports to access bot functionality:
```typescript
// Import game data
import { characters, ships } from "../data/constants/units.ts";

// Import modules
import swgohAPI from "../modules/swapi.ts";
import { findChar, msgArray } from "../modules/functions.ts";
import config from "../config.js";
```

Look at existing commands in `/slash/` for more examples and patterns.

### Making Changes
If you're wanting to make changes to existing code, go ahead and make your edits, then submit them as described below. If you need help understanding something, feel free to stop by the support server for assistance.

## Uploading the changes

You can make a Pull Request, check [here](https://help.github.com/articles/about-pull-requests/) for more information on that as needed.

If you don't want to mess with that, or don't understand how to, feel free to stop by the support server for help or upload your translation in [hastebin](https://hastebin.com/) or [Gist GitHub](https://gist.github.com/) and send it to me on the support server.

# Bug Reporting
If you find something that's breaking or needs to be fixed (Bad translation, command output not working correctly, or something else), come by the [Support Server](http://www.swgohbot.com/server) and let me know


# Self-Hosting
While I'd recommend just using the one that I host, you can run a copy yourself, though it will not have all the features (namely the Patreon unlockable ones).

## Requirements
- `git` command line ([Windows](https://git-scm.com/download/win)|[Linux](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)|[MacOS](https://git-scm.com/download/mac)) installed
- `Node.js` [Version 25.2 or higher](https://nodejs.org) (requires native TypeScript support)
- `MongoDB` [Version 7.0 or higher](https://www.mongodb.com/download-center/community)
- `A machine` to host it on. Want it to be online 24/7? Get a VPS.
- `Some knowledge of Node.js/TypeScript` if you want to modify it.

## Setup

Firstly, you'll need to set up the bot account to get the token and client ID.
https://discord.com/developers/applications

In a command prompt in your projects folder (wherever that may be) run the following:
```bash
git clone https://github.com/jmiln/SWGoHBot.git
cd SWGoHBot
npm install
```

Once finished:
- Copy `example_config.js` to `config.js`
- Edit `config.js` and enter your bot's token, client ID, owner ID, and MongoDB connection URL as indicated.

In order to get game data, you'll need to set up and use Comlink and SWGoH-Stats.
These can be run as docker instances, with the setup described in each repo
- https://github.com/swgoh-utils/swgoh-comlink
  * Get data from the game itself
- https://github.com/swgoh-utils/swgoh-stats
  * Calculate the stats of units when fed into this

If you want character images, you'll want to check out my image server to run alongside it, as well as swgoh-ae2
- https://github.com/jmiln/swgohImageServe
  * This is to create the images for the panic and mycharacter commands
- https://github.com/swgoh-utils/swgoh-ae2
  * This is a container that gets the various unit images from the game

## Starting the bot

Deploy slash commands to Discord first (only needed once, or when commands change):
```bash
npm run deploy
```

To start the bot, run:
```bash
npm start
```

This runs `node swgohBotShard.ts` which spawns the shard manager and starts the bot instances.

> If at any point it says "cannot find module X" just run `npm install` to ensure all dependencies are installed.

### Using PM2
If you are using PM2 to keep the bot running:
```bash
pm2 start swgohBotShard.ts --name swgohbot
```


# Contributing to the website (swgohbot.com)
Head on over to the site's repo [HERE](https://github.com/jmiln/SWGoHBotSite)
