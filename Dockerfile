FROM node:26-slim

ENV NODE_ENV=production

WORKDIR /app

# Dependencies before source, so editing a command does not reinstall the tree.
# --ignore-scripts because package.json's `prepare` runs husky, which installs git hooks: it is a
# devDependency, so --omit=dev leaves it absent and the lifecycle script exits 127. Nothing this
# image runs needs an install script; the same reason imageServe sets ignore-scripts in .npmrc.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .

USER node

# Overridden per service by compose. The bot is the sensible default for a bare `docker run`.
CMD ["node", "swgohBotShard.ts"]
