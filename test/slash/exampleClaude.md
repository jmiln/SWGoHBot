https://medium.com/@jpranav97/stop-wasting-tokens-how-to-optimize-claude-code-context-by-60-bfad6fd477e5
https://code.claude.com/docs/en/costs





# Project: TypeScript Discord Bot

## Objective
The goal is to develop a modular Discord bot using TypeScript and the `discord.js` library. The bot should support slash commands, handle events, and interact with a database (if applicable).

## Technology Stack
*   **Language:** TypeScript / node.js v25
*   **Framework:** Node.js, `discord.js` v14+
*   **Package Manager:** npm
*   **Configuration:** `config.js` file for secrets, `tsconfig.json` for TS config

## Project Structure
*   `slash/`: Folder for individual command definitions
*   `events/`: Folder for event handlers
*   `swgohbotShard.ts`: Bot entry point
*   `package.json`: Project dependencies and scripts
*   `CLAUDE.md`: This configuration file

## Important Commands
*   `npm install`: Install dependencies
*   `npm start`: Run the bot
*   `npm run lint`: Run biome checks (if configured)

## Coding Conventions & Quality
*   Follow TypeScript strict mode where applicable.
*   Use type safety and best practices for robust code.
*   Ensure all new features include appropriate error handling and logging.
*   Prefer `discord.js` guide patterns for command handling.
*   Run `npm run lint <file path>` after any code changes to verify quality.

## Secrets Management
*   API keys and sensitive information are stored in the `config.js` file. Never hardcode them or log them to console.

## Development Workflow
*   Prioritize modularity and maintainability.
*   After making changes, the AI should autonomously run `npm run test-file <file path>` to test the changes.

