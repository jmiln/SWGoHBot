# Contributing to the repository

First, you will need to create a **[GitHub Account](https://github.com/join)**

## Translating
If you're interested in helping translate this bot into a language other than English, either download this repository or the file from `/languages/en-US`.

**Firstly, please do NOT use a translator like Google Translate, native speakers will notice. (They're not perfect)**

I know it may be hard to know what to translate, so here's an example.
How you'd find the translations for the `help` command in the file, in English:
```js
    // Help Command
    COMMAND_HELP_HEADER: (prefix) => `= Command List =\n\n[Use ${prefix}help <commandname> for details]\n`,
    COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${prefix}${command.help.usage}`,
    COMMAND_HELP_HELP: {
        description: "Displays info about available commands.",
        actions: [
            {
                action: "",
                actionDesc: '',
                usage: ';help [command]',
                args: {
                    "command": "The command you want to look up info on."
                }
            }
        ]
    },
```
And here's how it looks after it's been translated to German:
```js
    // Help Command
    COMMAND_HELP_HEADER: (prefix) => `= Kommandoliste =\n\n[Benutze ${prefix}Help <Kommandoname> fuer Details]\n`,
    COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\n Befehl:: ${prefix}${command.help.usage}`,
    COMMAND_HELP_HELP: {
        description: "Zeigt die verfuegbaren Kommandos an.",
        actions: [
            {
                action: "",
                actionDesc: '',
                usage: ';help [Kommando]',
                args: {
                    "Kommando": "Das Kommando, zu dem Du die Hilfe aufrufen willst."
                }
            }
        ]
    },
```
#### What to change and what not to
- Anything fully capitalized like `COMMAND_HELP_HEADER` is the key/name I use to get the translated text to use elsewhere, and needs to stay as-is.
- The `(prefix) => ` needs to be left alone, as that's how I pass vairables through to the strings.
- In the strings, anything inside `${stuff}` is a variable and needs to be left alone as well. From the example above, in COMMAND_HELP_HEADER, the `prefix` is being passed into the header so it knows wht to put there, so since the default prefix is `;`, **Use ${prefix}help** would show as **Use ;help**
- Other than that, anything inside the various quotes, be it `` ` ` ``, `''`, or `""`, should be safe to change.
- In the `COMMAND_HELP_HELP`, anything before the `:` needs to stay the same, so the description, actions, etc.

## Making a new command or updates to anything
- If you are wanting to make a new command, there is a template at `/templates/command.js` for you to start off of.
- If you're wanting to make changes to something, go for it, then upload them as described below. If you need help understanding something, feel free to stop by the support server and I'll do what I can to help

## Uploading the changes

You can make a Pull Request, check [here](https://help.github.com/articles/about-pull-requests/) for more information on that as needed.

If you don't want to mess with that, or don't understand how to, feel free to stop by the support server for help or upload your translation in [hastebin](https://hastebin.com/) or [Gist GitHub](https://gist.github.com/) and send it to me on the support server.

# Bug Reporting
If you find something that's breaking or needs to be fixed (Bad translation, command output not working correctly, or something else), come by the [Support Server](http://www.swgohbot.com/server) and let me know


# Self-Hosting
While I'd recommend just using the one that I host, you can run a copy yourself, though it will not have all the features (Namely the Patreon unlockable ones

## Requirements
- `git` command line ([Windows](https://git-scm.com/download/win)|[Linux](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)|[MacOS](https://git-scm.com/download/mac)) installed
- `Node` [Version 12.x or higher](https://nodejs.org)
- `MongoDB` [I use version 4.4.0 currently](https://www.mongodb.com/download-center/community)
- `A machine` to host it on. Want it to be online 24/7? Get a VPS.
  - My copy of the bot is hosted on a machine from [Hyperexpert](p.hyper.expert/aff.php?aff=127). (Affiliate link)
- `Some knowledge of Node/ JavaScript` if you want to modify it.

## Setup

Firstly, you'll need to set up the bot account, so you can get the token and such.
https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token

In a command prompt in your projects folder (wherever that may be) run the following:
`git clone https://github.com/jmiln/SWGoHBot.git`

Once finished:
- In the folder from where you ran the git command, run `cd SWGoHBot` and then run `npm install`
- Rename `config_example.json` to `config.json`
- Edit `config.json` and enter your bot's token and other details as indicated.


## Starting the bot
To start the bot, in the command prompt, run the following command:
`node swgohbotShard.js`
> If at any point it says "cannot find module X" just run `npm install X` and try again.

If you are using PM2 to keep the bot running, you can start it with colored logs with
`FORCE_COLOR=1 pm2 start swgohBotShard.js`
