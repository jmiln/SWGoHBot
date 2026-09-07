import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import { formatPlayerAffix, getDatacronAbilities, getDatacronSet, resolveTargetName } from "../modules/datacrons.ts";
import { getAllyCode } from "../modules/functions.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import { type EmbedField, paginateEmbedFields, sendPaginatedEmbeds } from "../modules/utils/embeds.ts";
import type { DatacronAbilityRef, PlayerDatacron } from "../types/datacron_types.ts";
import type { SWAPILang } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

interface DatacronEmbed {
    title?: string;
    description?: string;
    fields?: EmbedField[];
}

interface PlayerLike {
    name: string;
    datacron?: PlayerDatacron[];
}

const FIELDS_PER_EMBED = 20;

/** A datacron is dead once its set expires, so that is worth flagging above focused/locked. */
function isExpired(datacron: PlayerDatacron): boolean {
    const expiry = getDatacronSet(datacron.setId)?.expirationTimeMs;
    return !!expiry && expiry < Date.now();
}

function flagSuffix(datacron: PlayerDatacron, language: Language): string {
    const flags = [
        isExpired(datacron) ? language.get("COMMAND_MYDATACRONS_EXPIRED") : null,
        datacron.focused ? language.get("COMMAND_MYDATACRONS_FOCUSED") : null,
        datacron.locked ? language.get("COMMAND_MYDATACRONS_LOCKED") : null,
    ].filter(Boolean);
    return flags.length ? ` (${flags.join(", ")})` : "";
}

/** The datacron's headline target: the target of its last (highest-tier) ability affix, if any. */
function headlineTarget(datacron: PlayerDatacron, lang: SWAPILang): string | null {
    for (let i = datacron.affix.length - 1; i >= 0; i--) {
        const rule = datacron.affix[i].abilityId ? datacron.affix[i].targetRule : undefined;
        if (rule) return resolveTargetName(rule, lang);
    }
    return null;
}

/**
 * Builds one embed field per owned datacron: set name + headline target + flags as the field name,
 * every affix (ability text with `{0}` filled, stat lines de-scaled) as the value.
 */
export function buildDatacronField(
    datacron: PlayerDatacron,
    textMap: Map<string, string>,
    abilities: Record<string, DatacronAbilityRef>,
    language: Language,
    lang: SWAPILang,
): EmbedField {
    const set = getDatacronSet(datacron.setId);
    const setName = textMap.get(set?.nameKey ?? "") ?? `Set ${datacron.setId}`;
    const target = headlineTarget(datacron, lang);
    const lines = datacron.affix.map((a) => `- ${formatPlayerAffix(a, abilities, textMap, lang)}`).filter((l) => l !== "- ");

    // Expiry as a live relative timestamp on its own line below the field name (embed field names
    // don't render <t:...:R>, only values do), so a player can see how long each datacron has left.
    const body = set?.expirationTimeMs
        ? [language.get("COMMAND_MYDATACRONS_EXPIRES", `<t:${Math.floor(set.expirationTimeMs / 1000)}:R>`), ...lines]
        : lines;
    return {
        name: `${setName}${target ? ` - ${target}` : ""}${flagSuffix(datacron, language)}`.slice(0, 256),
        value: (body.join("\n") || "-").slice(0, 1024),
    };
}

/**
 * A missing `datacron` field means the cached roster predates datacron support - NOT the same as
 * owning none. Exported for testing.
 */
export function buildPlayerDatacronMessages(
    player: PlayerLike,
    textMap: Map<string, string>,
    abilities: Record<string, DatacronAbilityRef>,
    language: Language,
    lang: SWAPILang,
): DatacronEmbed[][] {
    const title = language.get("COMMAND_MYDATACRONS_HEADER", player.name);

    if (player.datacron === undefined) {
        return [[{ title, description: language.get("COMMAND_MYDATACRONS_NEEDS_REFRESH", player.name) }]];
    }
    if (player.datacron.length === 0) {
        return [[{ title, description: language.get("COMMAND_MYDATACRONS_NONE", player.name) }]];
    }

    // Live datacrons first, then newest set first - an expired one is dead weight and should not
    // push the set the player is actually using down the list.
    const ordered = [...player.datacron].sort((a, b) => Number(isExpired(a)) - Number(isExpired(b)) || b.setId - a.setId);

    const fields = ordered.map((dc) => buildDatacronField(dc, textMap, abilities, language, lang));
    const description = `_${language.get("COMMAND_MYDATACRONS_SET_HINT")}_`;

    // Follow-up messages repeat the title so each stands on its own in the channel.
    return paginateEmbedFields(fields, {
        fieldsPerEmbed: FIELDS_PER_EMBED,
        reservedChars: title.length + description.length,
    }).map((embeds, index) => {
        const built: DatacronEmbed[] = embeds.map((embedFields) => ({ fields: embedFields }));
        built[0].title = title;
        if (index === 0) built[0].description = description;
        return built;
    });
}

export default class MyDatacrons extends Command {
    static readonly metadata = {
        name: "mydatacrons",
        description: "Show all the datacrons on your account, or any ally code's",
        category: "SWGoH",
        permLevel: 0,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycode",
                type: ApplicationCommandOptionType.String,
                description: "The ally code whose datacrons you want to see",
                autocomplete: true,
            },
        ],
    };

    constructor() {
        super(MyDatacrons.metadata);
    }

    async run({ interaction, language, swgohLanguage }: CommandContext) {
        const ac = interaction.options.getString("allycode");

        const allyCode = await getAllyCode(interaction, ac, true);
        if (!allyCode) {
            return super.error(interaction, language.get("BASE_INVALID_ALLY_CODE_AC", ac ?? ""));
        }

        await interaction.deferReply();
        const player = await fetchPlayerWithCooldown(interaction, allyCode);
        if (!player) {
            return super.error(interaction, language.get("COMMAND_MYPROFILE_PLAYER_NOT_FOUND"));
        }

        const textMap = await swgohAPI.datacronText(swgohLanguage);
        const messages = buildPlayerDatacronMessages(player, textMap, getDatacronAbilities(), language, swgohLanguage);
        return sendPaginatedEmbeds(interaction, messages);
    }
}
