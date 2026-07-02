import { env } from "../config/config.ts";
import type { PatreonAPIUser, PatreonMember, UserConfig } from "../types/types.ts";
import cache from "./cache.ts";
// Grab the functions used for checking guilds' supporter arrays against Patreon supporters' info
import { clearSupporterInfo, ensureBonusServerSet, ensureGuildSupporter } from "./guildConfig/patreonSettings.ts";
import logger from "./Logger.ts";

function patreonCredentials() {
    return env.PATREON_CAMPAIGN_ID &&
        env.PATREON_CLIENT_ID &&
        env.PATREON_CLIENT_SECRET &&
        env.PATREON_CREATOR_ACCESS_TOKEN &&
        env.PATREON_CREATOR_REFRESH_TOKEN
        ? {
              campaignId: env.PATREON_CAMPAIGN_ID,
              clientID: env.PATREON_CLIENT_ID,
              clientSecret: env.PATREON_CLIENT_SECRET,
              creatorAccessToken: env.PATREON_CREATOR_ACCESS_TOKEN,
              creatorRefreshToken: env.PATREON_CREATOR_REFRESH_TOKEN,
          }
        : undefined;
}

async function getPatreonTiers(): Promise<{ id: string; amount_cents: number; title: string }[]> {
    const patreon = patreonCredentials();
    if (!patreon) return [];

    const baseMembersUrl = `https://api.patreon.com/oauth2/v2/campaigns/${patreon.campaignId}?include=tiers&fields[tier]=title,amount_cents`;
    let responseJson: { included?: { id: string; attributes: { amount_cents: number; title: string } }[] };
    try {
        const res = await fetch(encodeURI(baseMembersUrl), {
            headers: {
                Authorization: `Bearer ${patreon.creatorAccessToken}`,
            },
        });
        responseJson = await res.json();
    } catch (err) {
        logger.error(`[patreonSync/getPatreonTiers] Error fetching Patreon tiers: ${err instanceof Error ? err.message : String(err)}`);
        return [];
    }

    if (!responseJson.included?.length) return [];

    return responseJson.included.map(({ id, attributes }) => ({
        id,
        amount_cents: attributes.amount_cents,
        title: attributes.title,
    }));
}

async function applyActivePatronBenefits(discordID: string, amountCents: number) {
    const { user: userRes, guild: guildRes } = (await ensureBonusServerSet({
        userId: discordID,
        amount_cents: amountCents,
    })) as { user: { success: boolean; error: string }; guild: { success: boolean; error: string } };

    const userConfExists = await cache.exists(env.MONGODB_SWGOHBOT_DB, "users", { id: discordID });
    if (userConfExists) {
        await cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: discordID }, { patreonAmountCents: amountCents });
    }

    if (userRes?.error || guildRes?.error) {
        logger.error(
            `[patreonSync/updatePatrons] Issue adding info for patron ${discordID}\n${userRes?.error || "N/A"} \nOr guild:\n${guildRes?.error || "N/A"}`,
        );
    }
}

async function processManualPatrons() {
    for (const [discordID, amountCents] of Object.entries(env.PATRONS)) {
        await applyActivePatronBenefits(discordID, amountCents);
    }
}

async function updatePatrons() {
    const patreon = patreonCredentials();
    if (!patreon) {
        try {
            await processManualPatrons();
            await ensureGuildSupporter();
        } catch (e) {
            logger.error(`[patreonSync/updatePatrons] Error processing manual patrons: ${e instanceof Error ? e.message : String(e)}`);
        }
        return;
    }

    try {
        const patreonTiers = await getPatreonTiers();

        const baseMembersUrl = `https://www.patreon.com/api/oauth2/v2/campaigns/${patreon.campaignId}/members?include=user,currently_entitled_tiers`;
        const memberFields = "&fields[member]=full_name,currently_entitled_amount_cents,patron_status";
        const userFields = "&fields[user]=social_connections";
        const countPerPage = "&page[count]=200";

        const fullUrl = encodeURI([baseMembersUrl, memberFields, userFields, countPerPage].join(""));

        // Use the given patId to get all of the supporters
        // https://docs.patreon.com/#get-api-oauth2-v2-campaigns
        const response = await fetch(fullUrl, {
            headers: {
                Authorization: `Bearer ${patreon.creatorAccessToken}`,
            },
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        // Check response status
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Could not read error body");
            logger.error(`[patreonSync/updatePatrons] Patreon API returned ${response.status}: ${response.statusText}\nBody: ${errorBody}`);
            return;
        }

        // Parse JSON with error handling
        let jsonData: unknown;
        try {
            jsonData = await response.json();
        } catch (parseError) {
            logger.error(
                `[patreonSync/updatePatrons] Failed to parse Patreon response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            );
            return;
        }

        // Validate response structure
        if (
            typeof jsonData !== "object" ||
            jsonData === null ||
            !("data" in jsonData) ||
            !Array.isArray((jsonData as { data: unknown }).data)
        ) {
            logger.error("[patreonSync/updatePatrons] Invalid response structure - missing data array");
            return;
        }

        const { data, included = [] } = jsonData as { data: PatreonMember[]; included?: PatreonAPIUser[] };

        // Validate included array
        if (!Array.isArray(included)) {
            logger.warn("[patreonSync/updatePatrons] Invalid included field, using empty array");
        }

        const members = data.filter((item: PatreonMember) => item.type === "member" && item.attributes.patron_status === "active_patron");
        const users = Array.isArray(included) ? included.filter((inc: PatreonAPIUser) => inc.type === "user") : [];

        for (const member of members) {
            const memberId = member.relationships?.user?.data?.id;
            const memberStatus = member.attributes?.patron_status;
            const memberName = member.attributes?.full_name;
            const user = users.find((user) => user.id === memberId);

            // In case the user's currently_entitled_amount_cents is showing 0 (Patreon bug/ gifted subs?), grab it by their tiers
            const memberTiers = member.relationships?.currently_entitled_tiers?.data ?? [];
            const userTierCents = memberTiers.map((t) => patreonTiers.find((tier) => tier.id === t.id)?.amount_cents ?? 0);
            const memberCents = Math.max(member.attributes.currently_entitled_amount_cents, ...userTierCents);

            // Couldn't find a user to match with the pledge (Shouldn't happen, but just in case)
            if (!user) {
                logger.log(`Patreon user not found for member: ${memberName} (ID: ${memberId})`);
                continue;
            }

            const discordID = user.attributes.social_connections?.discord?.user_id;

            // Check before the put so we can detect new supporters
            const isNewSupporter = !(await cache.exists(env.MONGODB_SWGOHBOT_DB, "patrons", { id: memberId }));

            // Save this user's info to the db (omit discordID field if not linked)
            await cache.put(
                env.MONGODB_SWGOHBOT_DB,
                "patrons",
                { id: memberId },
                {
                    id: memberId,
                    ...(discordID && { discordID }),
                    amount_cents: memberCents,
                    patron_status: memberStatus,
                    tiers: memberTiers.map((tier) => tier.id),
                    updatedAt: new Date(),
                },
            );

            if (isNewSupporter) {
                if (discordID) {
                    logger.log(`[patreonSync/updatePatrons] New Patreon supporter ${memberName} (${discordID})`);
                } else {
                    logger.log(`[patreonSync/updatePatrons] New Patreon supporter ${memberName} — no Discord account linked`);
                }
            }

            // If they don't have a discord id to work with, move on
            if (!discordID) continue;

            if (!memberCents) {
                // If the user isn't currently active, make sure they don't have any bonusServers linked
                const userConf = (await cache.getOne(env.MONGODB_SWGOHBOT_DB, "users", { id: discordID })) as UserConfig | null;

                // Cache patreon status as 0 (inactive) on userconf if the user is registered
                if (userConf) {
                    await cache.put(env.MONGODB_SWGOHBOT_DB, "users", { id: discordID }, { patreonAmountCents: 0 });
                }

                // If they don't have bonusServer set (As it should be), move on
                if (!userConf?.bonusServer?.length) continue;

                // If it is set, remove it
                const { user: userRes, guild: guildRes } = await clearSupporterInfo({ userId: discordID });

                // No issues, move on
                if (!userRes?.error && !guildRes?.error) {
                    logger.log(`User ${discordID} has been ended their Patreon support`);
                    continue;
                }

                // If it somehow got here / there are issues, log em
                logger.error(
                    `[patreonSync clearSupporterInfo] Issue clearing info from user\n${userRes?.error || "N/A"} \nOr guild:\n${
                        guildRes?.error || "N/A"
                    }`,
                );
            } else {
                await applyActivePatronBenefits(discordID, memberCents);
            }
        }

        // Process manually configured patrons from env.PATRONS
        await processManualPatrons();

        // Go through each of the guilds that have a supporter and make sure all of the listed users are supposed to be there
        await ensureGuildSupporter();
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorStack = e instanceof Error ? e.stack : "No stack trace available";

        if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
            logger.error("[patreonSync/updatePatrons] Patreon API request timed out after 30 seconds");
        } else {
            // Log both the message and the stack for full visibility
            logger.error(`[patreonSync/updatePatrons] Error getting patrons: ${errorMessage}\nStack: ${errorStack}`);
        }
    }
}

export default { updatePatrons };
