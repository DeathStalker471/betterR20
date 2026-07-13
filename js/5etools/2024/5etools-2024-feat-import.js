function d20plus2024FeatImport() {
    const featCtx = d20plus.import2024;

    d20plus.importer.import2024Feat = function (charModel, data) {
        const {attr: storeAttr, store} = featCtx.getStore(charModel);
        if (!store) return;

        let pos = featCtx.getNextArrayPos(store);
        const ints = store.integrants.integrants;

        const {id, base} = featCtx.makeIntegrantBase("Features", pos++);
        ints[id] = {
            ...base,
            name: data.name,
            recordName: data.name,
            description: data.Vetoolscontent || "",
            source: "Feat",
            parentID: "",
            childIDs: "[]",
            cascades: {},
            relations: {},
        };

        featCtx.pushDisplayOrder(store, "features", "featsDisplayOrder", [id]);

        featCtx.saveStore(charModel, storeAttr, store);
    };
}

SCRIPT_EXTENSIONS.push(d20plus2024FeatImport);
