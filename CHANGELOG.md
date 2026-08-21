# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-08-21

Roughly seven months and 382 commits since the 3.0.0 baseline, so this is a curated summary rather
than a complete list.

### Breaking changes

Read these before upgrading; each needs an action.

- **Configuration moved to environment variables.** `config.js` is gone. Copy `.env.example` to
  `.env` and fill it in; the Zod schema in `config/config.ts` fails at startup, naming the missing
  variable. See `docs/CONFIG.md`.
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
