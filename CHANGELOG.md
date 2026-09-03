# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Unit autocomplete is localized.** Every unit picker (`unit`/`character`/`ship`), the `/panic`
  journey picker, and guild alias rows now render in the user's `swgohLanguage`. Searching matches
  the localized name **or** the English one, since SWGoH's wikis and counters chat are English and a
  localized-only picker would take away a lookup path players actually use. The option `value` is
  still the defId, so no command behaviour changed. Results sort using the language's own collation
  rather than the host default, which had been misordering umlauts and Korean.

### Fixed

- **Guild aliases are capped at 32 characters.** They were unbounded, and a long one could push an
  autocomplete choice name past Discord's 100-character limit, which fails the whole response and
  broke that guild's picker for everyone. Enforced on the `/aliases add` option, in the command, and
  in the schema. Existing over-length aliases keep working; they are truncated for display only.
- **`/setconf swgohLanguage` was accepted and then ignored.** The setting existed at both guild and
  user level, but only the user's own value was ever read, so a server-wide language never took
  effect for anyone who had not set their own. Resolution is now user, then guild, then default.
  Guilds that set the value and never saw it work will see a visible change.

### Changed

- **A failure to bind the shard status endpoint no longer stops the bot starting.** It is awaited
  before `Manager.spawn`, so an occupied port previously meant no shards spawned at all, and
  `restart: unless-stopped` would turn that into a loop. The bot would have been down because its
  diagnostics could not start. It now logs and continues: losing the endpoint costs visibility,
  losing the shards costs the service.

### Added

- CI smoke test for the shard status surface, matching the ones swapiServe and eventServe already
  have. It starts the module directly rather than booting the shard manager, because
  `Manager.spawn` fails against a dummy token and exits before a probe could land. Using
  `curl -fsS` also pins the startup rule: `/health` must answer `200` while the fleet is
  `starting`, since a regression to `503` there would make every deploy report unhealthy for the
  length of the spawn.

## [4.2.0] - 2026-08-25

### Added

- **The shard manager now serves fleet health over HTTP** on `SHARD_STATUS_PORT` (3810), backed by
  `modules/shardStatus/`. `swgohBotShard.ts` is the only process that sees every shard, and until
  now it did nothing with that beyond logging lifecycle events, which is why the `bot` service
  carried no healthcheck.
  - `GET /health` returns `200` while the fleet is starting, ready or degraded, and `503` only on
    total fleet loss. That is the one case a container restart fixes; a single sick shard is left
    to the `ShardingManager`'s own `respawn`, because restarting would kill every healthy shard to
    fix one.
  - `GET /status` always returns `200` while the manager answers, carrying per-shard status, ping,
    guild count, uptime and RSS. It deliberately does not mirror `/health`'s status code: a `503`
    there would fail every per-shard monitor at once.
  - Each shard reports itself every 15s over the existing IPC channel. Heartbeats are the state
    because they are level-sampled, so a shard that dies, hangs, or silently loses its gateway
    stops sending and one staleness check catches all three. The endpoint never messages a shard,
    since a request-time fan-out would not resolve against a wedged shard and the healthcheck would
    hang rather than report it.
- `SHARD_STATUS_PORT` and `SHARD_STATUS_HOST` settings. As with swapiServe's queue path there is no
  shared secret, so the bind is the only access control: loopback by default, `0.0.0.0` in the
  container, with the host-side port published to `127.0.0.1` only.

### Changed

- The `bot` service in `docker-compose.yml` now has a healthcheck, replacing the comment explaining
  why it could not have one.

## [4.1.0] - 2026-08-24

### Changed

- **GAC counter ingestion is now a phase of the nightly `dataUpdater`** rather than a service of its
  own. It runs between the game data and mod phases, so a `--skip-mods` run still refreshes it.
  Counters are now at most a day stale instead of an hour, which does not matter when `/counter`
  shows the previous few seasons. A failure in one mode is isolated: the other mode still runs, the
  cycle finishes, and the exit code becomes 1 so a source outage shows up in the cron log.
- The ingestion bookmark moved from `modules/counters/counterMetadata.json` to
  `data/counterMetadata.json`. Under `modules/` it was baked into the image and its writes landed in
  a container layer that `docker compose run --rm` discards, so the bookmark could never advance and
  every run would re-ingest. `data/` is a bind mount, so it persists. Both it and
  `data/metadata.json` are now gitignored, being runtime state rather than source.

### Added

- `dataUpdater` flags: `--skip-counters`, `--counters-only` (mutually exclusive), plus
  `--counter-concurrency`, `--max-per-10s` and `--min-battles`. `--counters-only` exists so an
  ad-hoc ingest does not need a full cycle.

### Removed

- `services/counterUpdater.ts` and `counterUpdater.config.cjs`. The hourly cron line its comment
  documented was never actually installed, so nothing had run it since the feature shipped.
- `ecosystem.config.cjs`. All three processes it defined now run as containers; pm2 is no longer
  used by this project at all. A deployment still starting the bot with
  `pm2 start ecosystem.config.cjs` must switch to `docker compose up -d`.
- `jsconfig.json`, inert since the TypeScript migration and superseded by `tsconfig.json`.

## [4.0.0] - 2026-08-21

Roughly seven months and 382 commits since the 3.0.0 baseline, so this is a curated summary rather
than a complete list.

### Breaking changes

Read these before upgrading; each needs an action.

- **Configuration moved to environment variables.** `config.js` is gone. Copy `.env.example` to
  `.env` and fill it in; the Zod schema in `config/config.ts` fails at startup, naming the missing
  variable.
- **The `users` collection changed shape, and ally codes are numbers rather than strings.** Existing
  databases must be migrated before starting 4.0.0. Run all three, in this order, since each reads
  the shape the previous one produces:
  ```bash
  node --env-file=.env scripts/allycodeToAllyCode.ts       # field rename: allycode -> allyCode
  node --env-file=.env scripts/migrateAllyCodeToNumber.ts  # "123456789" -> 123456789
  node --env-file=.env scripts/migrateArenaPlayers.ts      # accounts -> flat number array
  ```
  The last one also introduces `primaryAllyCode` and moves embedded arena player data out to a
  dedicated `arenaPlayers` collection. Back the database up first; `scripts/MONGO_BACKUP_SCRIPT.sh`
  is there for it.
- **`eventServe` speaks plain HTTP instead of socket.io.** The dependency is removed outright, so
  any external client of that service must be updated; the bot's own client was.
- **`/need` takes one `faction` option instead of two `faction_group_N` options.** The single option
  is autocompleted and covers all 53 generated faction categories rather than a capped list. Saved
  invocations of the old form will not carry over.
- **`/userconf` lost its duplicate `arenaalert` subcommand**, and `/arenawatch`'s options were
  reworked. Configure arena alerts through the remaining path.
- Any deployment upgrading from 3.x must run `npm run deploy` once, since several command
  signatures changed.

### Added

- **swapiServe**: a local queueing reverse proxy that every comlink request now passes through, from
  the bot shards, `dataUpdater`, and its mod workers. Five priority tiers each hold a reserved share
  of capacity, so the once-a-minute arena payout tick cannot be starved or head-of-line blocked by
  bulk work. An AIMD governor adapts the concurrency limit and rate per backend rather than relying
  on fixed pool sizes, and a `/status` endpoint exposes the metrics. Previously `modules/swapi.ts`
  opened four independent pools with nothing tracking the total across processes, so the upstream
  rate limit was regularly overshot.
- **Live refresh of `data/*.json`**: `modules/dataRefresh.ts` polls file mtimes every 15 minutes and
  reloads in place once the newest write has settled for 2 minutes, so a nightly `dataUpdater` run
  reaches the running bot without a restart. Previously `/mods` served mod recommendations frozen at
  process start, because `characters.json` is rewritten every cycle while `data/constants/units.ts`
  loaded it once at boot.
- **Container deployment**: one image (`ghcr.io/jmiln/swgohbot`) running the bot, `eventServe`, and
  `swapiServe` as three independently managed containers, published to GHCR by CI on tag push.
  Includes `Dockerfile`, `docker-compose.yml`, and a CI workflow that lints, type checks, tests, and
  smoke-tests the built image before anything is published.
- **Datacron support**: `/datacron` and `/mydatacrons`, backed by a hybrid store that keeps set
  structure in `data/datacrons.json` and localized text in MongoDB.
- **PvP counters**: `/counter`, with its own ingestion pipeline.
- **New commands**: `/strike`, `/arenahist` (a patreon rank-history chart), and `/info cmdstats`,
  backed by new command-usage tracking. The command count is now 49.
- **Arena payout history**, kept per player, which is what `/arenahist` reads. `/myarena` now shows
  time until payout, and `/showconf` renders as a formatted embed.
- **Generated faction names**: `factionNames.json` replaces the hand-maintained `factionMap.ts`,
  covering 53 categories across 14 languages instead of 38 English-only pairs.
- **Autocomplete** on ally codes, event names, faction names and several other options.
- **Operational scripts**: `scripts/verifyIndexes.ts` (`npm run indexes`),
  `scripts/MONGO_BACKUP_SCRIPT.sh`, and the two ally-code migrations above. Husky pre-commit hooks
  run lint, type check and tests.
- `GET /health` on `eventServe`, for the container healthcheck.
- `SWAPI_SERVE_HOST` and `SWAPI_SERVE_CONTROL_SECRET`. The first sets the bind address, which
  containers must widen from loopback; the second guards the `/backend/<url>/drain|enable|set-limit`
  control routes, whose only protection until now was that loopback bind.

### Changed

- TypeScript now runs with `strict: true`, completing the migration begun in 3.0.0.
- `config/config.ts` no longer treats a missing `.env` file as fatal. Container runtimes supply
  configuration as environment variables without creating a file, and the Zod schema still fails
  loudly, by name, when a required variable is absent either way.
- The three API map files (`modMap`, `unitMap`, `skillMap`) are refreshed on the shared
  `dataRefresh` cadence rather than on a private 6-minute interval inside `modules/swapi.ts`.
- Arena rank fetching is one batched `arenaTick` cycle instead of the separate `getRanks` and
  `shardRanks` paths, with real dirty-tracking so unchanged players are not rewritten.
- `dataUpdater`'s database cleanup is opt-in behind `--cleanup`, so a manual run can no longer
  delete data by accident; the scheduled crontab line passes it explicitly. Phase flags
  (`--force-gamedata`, `--skip-mods`) make partial runs practical.
- The external campaign and store files are fetched from `Kidori78/swgoh-json-files` on every run,
  with `data/swgoh-json-files/` kept as an offline fallback cache. It was a git submodule pinned at
  2024-03-07, so the first run after the switch corrected `charLocations.json`.
- Ability costs are generated into MongoDB from `gameData.recipe` rather than read from a static
  file. This fixed a double-count and a factor-of-ten typo: of 1939 abilities, 583 were corrected
  downward and 350 ship abilities gained a cost they never had.

### Removed

- `socket.io`, along with the `eventServe` transport that used it.
- The `Bot` god-object. Mongo, the cache, languages, `swgohAPI`, `patreonFuncs`, the slash-command
  list and the handlers were each decoupled from it first, and it is now unused.
- The `data/swgoh-json-files` git submodule, replaced by the runtime fetch above.
- Seven dead or superseded data files: `catMap.json`, `timezones.json` (superseded by `Intl`),
  `missions.json`, `resources.json`, `emoteIDs.ts` (a duplicate of `emoteStrings.ts`),
  `abilityCosts.json`, and `factionMap.ts`. The removed v2 `resources` and `missions` commands took
  their `COMMAND_RESOURCES_*` strings in all three languages with them.
- `fetchWithRetry`, `createRetryBudget` and `isNonRetryableFetchError` from `modules/swapi.ts`, plus
  the mod worker's separate retry loop, which would have stacked multiplicatively. Retry is
  `swapiServe`'s job now.

### Fixed

- `swapiServe` never started under pm2 while reporting `online`, because the entry-point guard
  tested `process.argv[1]`, which pm2 replaces with its own wrapper path. Every client silently fell
  back to direct comlink calls.
- `dataUpdater` stopped running nightly: `pm2` resolves only through an fnm per-shell path that
  cron's `PATH` cannot see, so the scheduled line had been failing silently. Cron now invokes `node`
  by absolute path.
- Arena payout warnings and results self-heal a dropped tick within their window, instead of being
  lost to an exact-minute check.

## [3.0.0] - 2026-01-14

### Changed

- Full migration from JavaScript to TypeScript, run natively via Node's type stripping with no build
  step, alongside an overhaul of the slash command structure.
