# SWGoHBot

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a237e06cc77e473180b810d307763402)](https://app.codacy.com/gh/jmiln/SWGoHBot/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## About
A Discord bot for Star Wars Galaxy of Heroes that provides slash commands for character info, guild data, arena tracking, and event management. Built with Discord.js v14, featuring sharding support, MongoDB persistence, and native TypeScript.

## Features

- **Character & Ship Info**: Detailed information about units, abilities, and recommended builds
- **Guild Management**: Track guild member data, tickets, and Territory War/Battle info
- **Arena Tracking**: Monitor arena ranks and receive payout alerts
- **Event Calendar**: Schedule and track in-game events with customizable countdowns
- **Player Profiles**: Link Discord accounts to ally codes for quick data access
- **Localization**: Multi-language support for bot and game data
- **Patreon Integration**: Premium features for supporters

## Prerequisites

- **Node.js** >= 25.2 (uses native TypeScript support)
- **MongoDB** instance (local or remote)
- **Discord Bot Token** from [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jmiln/SWGoHBot.git
cd SWGoHBot
```

2. Install dependencies:
```bash
npm install
```

3. Configure the bot:
```bash
cp .env.example .env
```
Edit `.env` and add:
- Your Discord bot token
- Bot client ID and owner ID
- MongoDB connection URL
- Optional: webhook URLs, premium features

4. Deploy slash commands to Discord:
```bash
npm run deploy
```

5. Start the bot:
```bash
npm start
```

## Development Commands

```bash
# Run bot
npm start

# Lint code with Biome
npm run lint

# Lint and auto-fix issues
npm run lint:write

# Type-check without emitting
tsc --noEmit

# Run all tests
npm test

# Run module or slash tests only
npm run test:modules
npm run test:slash

# Deploy slash commands to Discord
npm run deploy
```

## Architecture

### Core Structure
- **Entry Points**:
  - `swgohBotShard.ts` - Shard manager for scaling across multiple instances
  - `swgohBot.ts` - Main bot initialization and client setup

- **Slash Commands**: `slash/*.ts` - Each extends base command class from `base/slashCommand.ts`
- **Event System**: `events/*.ts` - Discord event handlers auto-loaded by `handlers/eventHandler.ts`
- **Modules**: Core utilities in `modules/` including caching, API clients, and helper functions
- **Database**: MongoDB collections managed via `modules/guildConfig/` for settings, events, polls, aliases
- **Workers**: Heavy processing offloaded to worker threads in `modules/workers/`

### Technology Stack
- **Discord.js v14** with sharding support
- **Native TypeScript** using Node.js type-stripping (no compilation step)
- **MongoDB v7** for data persistence
- **Piscina** for worker thread management
- **Biome** for linting and formatting

### Code Style
- **Formatter**: Biome (4 spaces, 140 char width, double quotes, semicolons required)
- **TypeScript**: No `any` types, import with `.ts` extensions, ESM modules
- **Testing**: Node.js native test runner

## Configuration

Configuration is loaded from a `.env` file using Node.js's built-in `process.loadEnvFile()`. Copy `.env.example` to `.env` and fill in your values. Key variables:

- **Discord**: `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_ID`
- **MongoDB**: `MONGODB_URL`
- **Game API**: `SWAPI_URL`, `SWAPI_ACCESS_KEY`, `SWAPI_SECRET_KEY`
- **Optional**: webhook URLs, Patreon integration (`PATREON_*`), image server URL

See [docs/CONFIG.md](../docs/CONFIG.md) for the full variable reference.

## Links

### Support the Bot
- **[Patreon](https://www.patreon.com/swgohbot)** - Unlock premium features

### Community
- **[Official Discord Server](http://www.swgohbot.com/server)** - Get help and suggest features
- **[Invite SWGoHBot](http://www.swgohbot.com/invite)** - Add to your Discord server

### Premium Features (Patreon)
- More frequent in-game data updates
- Arena rank change alerts via DM
- Channel logging for player rank changes
- Auto-updating payout countdown messages
- Guild ticket tracker with auto-updates
- Character unlock/upgrade notifications

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the code style (run `npm run lint:write`)
4. Write tests for new features
5. Commit your changes (the pre-commit hook will run lint, type-check, and tests automatically)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Use Biome for code formatting and linting
- Add tests in `test/` directory
- Update documentation for new features
- Follow existing patterns for slash commands and events

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Jeffrey Milner

## Support & Bug Reports

- **Issues**: [GitHub Issues](https://github.com/jmiln/SWGoHBot/issues)
- **Community**: Join the [Official Discord Server](http://www.swgohbot.com/server)

