function d20plus2024OptionalFeatureImport() {
    const ofCtx = d20plus.import2024;

    d20plus.importer.import2024OptionalFeature = async function (charModel, data) {
        const releaseLock = await ofCtx.pAcquireStoreLock(charModel);
        try {
        // Force-load attribs before reading the store - on a freshly-opened character sheet, Roll20
        // may not have finished hydrating charModel.attribs yet, which could make getStore() silently
        // miss the real store attribute and no-op this import for no visible reason.
        await d20plus.ut.fetchCharAttribs(charModel);
        const {attr: storeAttr, store} = ofCtx.getStore(charModel);
        if (!store) return;

        const optionalFeature = data.Vetoolscontent;
        const renderer = new Renderer();
        renderer.setBaseUrl(LINK_BASE_URL);
        const rendered = renderer.render({entries: optionalFeature.entries});
        const description = d20plus.importer.getCleanText(rendered);

        let pos = ofCtx.getNextArrayPos(store);
        const ints = store.integrants.integrants;

        const {id, base} = ofCtx.makeIntegrantBase("Features", pos++);
        ints[id] = {
            ...base,
            name: optionalFeature.name,
            recordName: optionalFeature.name,
            description,
            source: Parser.optFeatureTypeToFull(optionalFeature.featureType),
            parentID: "",
            childIDs: "[]",
            cascades: {},
            relations: {},
        };

        ofCtx.pushDisplayOrder(store, "features", "otherDisplayOrder", [id]);

        ofCtx.saveStore(charModel, storeAttr, store);
        } finally {
            releaseLock();
        }
    };
}

SCRIPT_EXTENSIONS.push(d20plus2024OptionalFeatureImport);
