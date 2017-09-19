# Star Wars Galaxy of Heroes Bot

## About
This is a bot I made to make looking up recommended setups for the game more convenient, since so many people use Discord to communicate.
It has since become so much more than I'd initially planned, and should become much more in time.

If you want to invite the bot that I host, here's the link for that: [swgohbot.com/invite](swgohbot.com/invite).

Or, if you have questions about anything, feel free to join the support server on Discord at [swgohbot.com/server](swgohbot.com/server).

## Commands (So far)
```asciidoc
= Command List =

[Use ;help <commandname> for details]

== Admin ==
;nickname   :: Changes the bot's nickname on the server
;stats      :: Shows the bot's stats
;showconf   :: Shows the current configs for your server.
;setconf    :: Used to set the bot's config settings.

== Misc ==
;event      :: Used to make or check an event
;help       :: Displays info about available commands.
;info       :: Shows useful links and recent changes.
;time       :: Used to check the time with the guild's configured timezone

== Star Wars ==
;raidteams  :: Shows some teams that work well for each raid.
;modsets    :: Shows how many of each kind of mod you need for a set.
;mods       :: Shows some suggested mods for the specified character.
;faction    :: Shows the list of characters in the specified faction.
;activities :: Shows the daily guild activites.
```

## Requirements
- `git` command line ([Windows](https://git-scm.com/download/win)|[Linux](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)|[MacOS](https://git-scm.com/download/mac)) installed
- `Node` [Version 8.0.0 or higher](https://nodejs.org)
- `A machine` to host it on. Want it to be online 24/7? Get a VPS.
- `Some knowledge of node` if you want to modify it.

## Setup

Firstly, you'll need to set up the bot account, so you can get the token and such. 
https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token

In a command prompt in your projects folder (wherever that may be) run the following:
`git clone https://github.com/jmiln/SWGoHBot.git`

Once finished: 
- In the folder from where you ran the git command, run `cd SWGoHBot` and then run `npm install`
- Rename `config_example.json` to `config.json`
- Edit `config.json` and enter your bot's token and other details as indicated. 
```js
{
    "ownerid": "YourUserID",
    "prefix": "YourPrefixGoesHere",
    "token": "YourTokenGoesHere",
    "defaultSettings": {
        "adminRole": "Administrator",
        "enableWelcome": false,
        "welcomeMessage": "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
        "useEmbeds": true,
        "timezone": "America/Los_Angeles",
        "announceChan": ""
    }
}
```

## Starting the bot
To start the bot, in the command prompt, run the following command:
`node swgohbot.js`
> If at any point it says "cannot find module X" just run `npm install X` and try again.


Special thanks to York for the started bot to base this on (https://github.com/AnIdiotsGuide/Tutorial-Bot/),
to CrouchingRancor.com for all their mod suggestions,
and to Morningstar-013 & Pete Butler, for their work in collecting a bunch of teams for the raids.
