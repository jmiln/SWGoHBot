import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import { formatPlayerAffix, getDatacronAbilities, getDatacronSet, resolveTargetName } from "../modules/datacrons.ts";
import { getAllyCode } from "../modules/functions.ts";
import { fetchPlayerWithCooldown } from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import type { DatacronAbilityRef, PlayerDatacron } from "../types/datacron_types.ts";
import type { SWAPILang } from "../types/swapi_types.ts";
import type { CommandContext } from "../types/types.ts";

interface EmbedField {
    name: string;
    value: string;
}
interface DatacronEmbed {
    title?: string;
    description?: string;
    fields?: EmbedField[];
}

interface PlayerLike {
    name: string;
    datacron?: PlayerDatacron[];
}

// Discord caps: 25 fields and ~6000 chars per embed, 10 embeds per message. Stay comfortably under.
const FIELDS_PER_EMBED = 20;
const MAX_EMBEDS = 10;

function flagSuffix(datacron: PlayerDatacron, language: Language): string {
    const flags = [
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
    const setName = textMap.get(getDatacronSet(datacron.setId)?.nameKey ?? "") ?? `Set ${datacron.setId}`;
    const target = headlineTarget(datacron, lang);
    const lines = datacron.affix.map((a) => `- ${formatPlayerAffix(a, abilities, textMap, lang)}`).filter((l) => l !== "- ");
    return {
        name: `${setName}${target ? ` - ${target}` : ""}${flagSuffix(datacron, language)}`.slice(0, 256),
        value: (lines.join("\n") || "-").slice(0, 1024),
    };
}

/**
 * Builds the player datacron embeds - every owned datacron, each its own field, spread across as
 * many embeds as needed (Discord allows 10 per message). Exported for testing.
 *
 * A missing `datacron` field means the cached roster predates datacron support - NOT the same as
 * owning none.
 */
export function buildPlayerDatacronEmbeds(
    player: PlayerLike,
    textMap: Map<string, string>,
    abilities: Record<string, DatacronAbilityRef>,
    language: Language,
    lang: SWAPILang,
): DatacronEmbed[] {
    const title = language.get("COMMAND_MYDATACRONS_HEADER", player.name);

    if (player.datacron === undefined) {
        return [{ title, description: language.get("COMMAND_MYDATACRONS_NEEDS_REFRESH", player.name) }];
    }
    if (player.datacron.length === 0) {
        return [{ title, description: language.get("COMMAND_MYDATACRONS_NONE", player.name) }];
    }

    const fields = player.datacron.map((dc) => buildDatacronField(dc, textMap, abilities, language, lang));
    const embeds: DatacronEmbed[] = [];
    for (let i = 0; i < fields.length && embeds.length < MAX_EMBEDS; i += FIELDS_PER_EMBED) {
        embeds.push({ fields: fields.slice(i, i + FIELDS_PER_EMBED) });
    }
    embeds[0].title = title;
    return embeds;
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
        const embeds = buildPlayerDatacronEmbeds(player, textMap, getDatacronAbilities(), language, swgohLanguage);
        return interaction.editReply({ embeds });
    }
}
