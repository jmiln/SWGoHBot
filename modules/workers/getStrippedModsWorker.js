const ComlinkStub = require("@swgoh-utils/comlink");

module.exports = async ({playerId, modMap, clientStub}) => {
    // console.log(`[getStrippedModsWorker] ${playerId}`);
    const comlinkStub = new ComlinkStub(clientStub);
    return await comlinkStub.getPlayer(null, playerId.toString())
        .then((res) => {
            return res?.rosterUnit
                .filter((unit) => unit?.equippedStatMod?.length)
                .map((unit) => ({
                    defId: unit.definitionId.split(":")[0],
                    mods: unit.equippedStatMod.map(({ definitionId, primaryStat }) => {
                        const modSchema = modMap[definitionId] || {};
                        return {
                            slot: modSchema.slot - 1, // mod slots are numbered 2-7
                            set: Number(modSchema.set),
                            primaryStat: primaryStat?.stat.unitStatId,
                        };
                    }),
                }));
        })
        .catch((err) => {
            console.error(err.message);
        });
};
