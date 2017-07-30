# Star Wars Galaxy of Heroes Bot

## About
This is a bot I made to make looking up recommended setups for the game more convenient, since so many people use Discord to communicate.

## Commands (So far)
```asciidoc
= Command List =

[Use ;help <commandname> for details]

== Admin ==
;stats      :: Shows the bot's stats
;showconf   :: Shows the current configs for your server.
;setconf    :: Used to set the bot's config settings.
;nickname   :: Changes the bot's nickname on the server

== Misc ==
;info       :: Shows useful links and recent changes.
;help       :: Displays info about available commands.

== Star Wars ==
;mods       :: Shows some suggested mods for the specified character.
;modsets    :: Shows how many of each kind of mod you need for a set.
;raidteams  :: Shows some teams that work well for each raid.
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
`git clone git@github.com:JeffreyMilner/SWGoHBot.git`

Once finished: 
- In the folder from where you ran the git command, run `cd SWGoHBot` and then run `npm install`
- Rename `config.example.json` to `config.json`
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
        "useEmbeds": true
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
