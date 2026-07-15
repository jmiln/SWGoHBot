import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    InteractionContextType,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import { allUnitsList, characters, ships } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import { type CounterView, distinctLeaders, getCounterView, variantMemberIds } from "../modules/counters/counterQuery.ts";
import { findChar, findCharOrShip } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import type { CounterDoc } from "../schemas/counters.schema.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

const MODE_CHOICES = [
    { name: "5v5", value: "5v5" },
    { name: "3v3", value: "3v3" },
];
const BATTLETYPE_CHOICES = [
    { name: "Characters", value: "char" },
    { name: "Fleet", value: "fleet" },
];

const memberOption = (n: number) => ({
    name: `member${n}`,
    type: ApplicationCommandOptionType.String,
    description: `Defense team member ${n} to narrow the comp (optional)`,
    autocomplete: true,
});

/** baseId -> display name; falls back to the raw baseId when the unit is unknown. */
function makeNameOf(): (baseId: string) => string {
    const byId = new Map(allUnitsList.map((u) => [u.uniqueName, u.name]));
    return (baseId: string) => byId.get(baseId) ?? baseId;
}

interface UnitChoice {
    name: string;
    value: string; // baseId
    aliases: string[];
    crew: string[];
}

/** Case-insensitive match on name, aliases, or (for ships) crew; capped for Discord's 25-item limit. */
export function filterUnitChoices(candidates: UnitChoice[], query: string, limit = 25): { name: string; value: string }[] {
    const q = query.trim().toLowerCase();
    const hit = (c: UnitChoice) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.toLowerCase().includes(q)) ||
        c.crew.some((cr) => cr.toLowerCase().includes(q));
    return candidates
        .filter(hit)
        .slice(0, limit)
        .map((c) => ({ name: c.name, value: c.value }));
}

/** Resolve a list of leader baseIds to autocomplete candidates, labelling capitals so they read as fleet. */
function toChoices(ids: string[], byId: Map<string, BotUnit>, isFleet: boolean): UnitChoice[] {
    return ids
        .map((id) => byId.get(id))
        .filter((u): u is BotUnit => Boolean(u))
        .map((u) => ({
            name: isFleet ? `${u.name} (fleet)` : u.name,
            value: u.uniqueName,
            aliases: u.aliases ?? [],
            crew: u.crew ?? [],
        }));
}

// Brief per-mode cache of resolved leader candidates; the leader set only changes once per GAC event.
const LEADER_CACHE_TTL_MS = 5 * 60 * 1000;
const leaderCache = new Map<string, { at: number; candidates: UnitChoice[] }>();

async function leaderCandidates(mode: "5v5" | "3v3", battletypeArg: string | null): Promise<UnitChoice[]> {
    const key = `${mode}:${battletypeArg ?? "any"}`;
    const cached = leaderCache.get(key);
    if (cached && Date.now() - cached.at < LEADER_CACHE_TTL_MS) return cached.candidates;

    const docs = await cache.get<CounterDoc>(env.MONGODB_SWAPI_DB, "counterData", { mode }, { leader: 1, battleType: 1, _id: 0 });
    const { char, fleet } = distinctLeaders(docs.map((d) => ({ leader: d.leader, battleType: d.battleType })));
    const byId = new Map(allUnitsList.map((u) => [u.uniqueName, u]));

    let candidates: UnitChoice[] = [];
    if (battletypeArg !== "fleet") candidates = candidates.concat(toChoices(char, byId, false));
    if (battletypeArg !== "char") candidates = candidates.concat(toChoices(fleet, byId, true));

    leaderCache.set(key, { at: Date.now(), candidates });
    return candidates;
}

export function buildCounterEmbed(
    view: CounterView,
    leaderName: string,
    mode: string,
    battleType: "char" | "fleet",
    nameOf: (id: string) => string,
    language: Language,
) {
    const compNames = (view.defense ?? []).map(nameOf).join(", ");
    let header: string;
    if (view.kind === "variant") header = language.get("COMMAND_COUNTER_HEADER_VARIANT", mode, battleType, view.bucket.sampleN, compNames);
    else if (view.kind === "closest")
        header = language.get("COMMAND_COUNTER_HEADER_CLOSEST", mode, battleType, view.bucket.sampleN, compNames);
    else header = language.get("COMMAND_COUNTER_HEADER_OVERALL", mode, battleType, view.bucket.sampleN);

    const lines = view.rows.map((r) => {
        const team = [`${nameOf(r.atkLeader)} (L)`, ...r.others.map(nameOf)].join(", ");
        return `${team} — **${r.winPct}%**  n=${r.n}`;
    });
    if (view.totalCounters > view.rows.length) lines.push(`_${language.get("COMMAND_COUNTER_TOP_NOTE")}_`);

    return {
        title: `vs ${leaderName}`,
        description: `${header}\n\n${lines.join("\n")}`,
        footer: { text: language.get("COMMAND_COUNTER_FOOTER", view.doc.season, view.doc.instanceId) },
    };
}

export default class Counter extends Command {
    static readonly metadata = {
        name: "counter",
        description: "Find general PvP counters for a character-squad leader or fleet capital",
        category: "Gamedata",
        permLevel: 0,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            { name: "mode", type: ApplicationCommandOptionType.String, description: "GAC mode", required: true, choices: MODE_CHOICES },
            {
                name: "leader",
                type: ApplicationCommandOptionType.String,
                description: "Leader (character) or capital ship to counter",
                required: true,
                autocomplete: true,
            },
            memberOption(2),
            memberOption(3),
            memberOption(4),
            memberOption(5),
            {
                name: "battletype",
                type: ApplicationCommandOptionType.String,
                description: "Force character or fleet lookup (defaults to character)",
                choices: BATTLETYPE_CHOICES,
            },
        ],
    };

    constructor() {
        super(Counter.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        await interaction.deferReply();

        const mode = interaction.options.getString("mode", true) as "5v5" | "3v3";
        const leaderArg = interaction.options.getString("leader", true);
        const battletypeArg = interaction.options.getString("battletype");

        // Resolve leader + decide char vs fleet.
        let battleType: "char" | "fleet";
        let leaderUnit: BotUnit | undefined;
        if (battletypeArg === "fleet") {
            leaderUnit = findChar(leaderArg, ships, true)[0];
            battleType = "fleet";
        } else if (battletypeArg === "char") {
            leaderUnit = findChar(leaderArg, characters)[0];
            battleType = "char";
        } else {
            const { units, isShip } = findCharOrShip(leaderArg, characters, ships);
            leaderUnit = units[0];
            battleType = isShip ? "fleet" : "char";
        }
        if (!leaderUnit) {
            return super.error(interaction, language.get("COMMAND_COUNTER_NO_UNIT", leaderArg));
        }
        const leaderBaseId = leaderUnit.uniqueName;
        const sideList = battleType === "fleet" ? ships : characters;

        // Resolve member2..5 in the same side; collect unresolved names for a soft note.
        const specifiedMemberIds = new Set<string>();
        const unresolved: string[] = [];
        for (const n of [2, 3, 4, 5]) {
            const raw = interaction.options.getString(`member${n}`);
            if (!raw) continue;
            const match = findChar(raw, sideList, battleType === "fleet")[0];
            if (match) specifiedMemberIds.add(match.uniqueName);
            else unresolved.push(raw);
        }

        const view = await getCounterView(env.MONGODB_SWAPI_DB, { mode, battleType, leader: leaderBaseId }, specifiedMemberIds);
        if (!view) {
            return super.error(interaction, language.get("COMMAND_COUNTER_NO_DATA", leaderUnit.name, mode));
        }

        const nameOf = makeNameOf();
        const embed = buildCounterEmbed(view, leaderUnit.name, mode, battleType, nameOf, language);
        if (unresolved.length) {
            embed.description = `${language.get("COMMAND_COUNTER_UNRESOLVED_MEMBERS", unresolved.join(", "))}\n\n${embed.description}`;
        }
        if (view.kind === "overall" && specifiedMemberIds.size > 0) {
            embed.description = `_${language.get("COMMAND_COUNTER_OVERALL_NOTE", leaderUnit.name)}_\n\n${embed.description}`;
        }

        logger.debug(`[counter] mode=${mode} leader=${leaderBaseId} battleType=${battleType} kind=${view.kind}`);
        return interaction.editReply({ embeds: [embed] });
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        const query = focusedOption.value?.toString() ?? "";
        const mode = interaction.options.getString("mode") as "5v5" | "3v3" | null;
        if (!mode) return interaction.respond([]);

        const battletypeArg = interaction.options.getString("battletype");

        if (focusedOption.name === "leader") {
            const candidates = await leaderCandidates(mode, battletypeArg);
            return interaction.respond(filterUnitChoices(candidates, query));
        }

        // memberN: needs the leader resolved first.
        const leaderArg = interaction.options.getString("leader");
        if (!leaderArg) return interaction.respond([]);

        const isFleet = battletypeArg === "fleet";
        const sideList = isFleet ? ships : characters;
        const leaderUnit = findChar(leaderArg, sideList, isFleet)[0];
        if (!leaderUnit) return interaction.respond([]);

        const battleType: "char" | "fleet" = isFleet ? "fleet" : "char";
        const doc = await cache.getOne<CounterDoc>(env.MONGODB_SWAPI_DB, "counterData", {
            mode,
            battleType,
            leader: leaderUnit.uniqueName,
        });
        if (!doc) return interaction.respond([]);

        // Exclude the leader and any already-picked member slots.
        const exclude = new Set<string>([leaderUnit.uniqueName]);
        for (const n of [2, 3, 4, 5]) {
            if (focusedOption.name === `member${n}`) continue;
            const raw = interaction.options.getString(`member${n}`);
            if (!raw) continue;
            const m = findChar(raw, sideList, isFleet)[0];
            if (m) exclude.add(m.uniqueName);
        }

        const byId = new Map(allUnitsList.map((u) => [u.uniqueName, u]));
        const candidates = toChoices(variantMemberIds(doc, exclude), byId, false);
        return interaction.respond(filterUnitChoices(candidates, query));
    }
}
