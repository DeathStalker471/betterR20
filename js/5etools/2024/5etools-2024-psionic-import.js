function d20plus2024PsionicImport() {
    const psiCtx = d20plus.import2024;

    d20plus.importer.import2024Psionic = async function (charModel, data) {
        const releaseLock = await psiCtx.pAcquireStoreLock(charModel);
        try {
        // Force-load attribs before reading the store - on a freshly-opened character sheet, Roll20
        // may not have finished hydrating charModel.attribs yet, which could make getStore() silently
        // miss the real store attribute and no-op this import for no visible reason.
        await d20plus.ut.fetchCharAttribs(charModel);
        const {attr: storeAttr, store} = psiCtx.getStore(charModel);
        if (!store) return;

        const psionic = data.Vetoolscontent;
        if (!psionic) {
            alert("Missing data. Please re-import Psionics.");
            return;
        }

        const renderer = new Renderer();
        renderer.setBaseUrl(LINK_BASE_URL);
        // Psi points are a resource the 2024 store has no equivalent for (same limitation as the
        // OGL sheet's own psi-point notes), so this is imported as a descriptive text stub - not
        // a castable spell - matching how Feats/Optional Features are handled for this sheet.
        const description = d20plus.importer.getCleanText(Renderer.psionic.getBodyHtml(psionic, renderer));
        const source = psionic.type === "D"
            ? `${psionic.order || "Orderless"} ${Parser.psiTypeToFull(psionic.type)}`
            : Parser.psiTypeToFull(psionic.type);

        let pos = psiCtx.getNextArrayPos(store);
        const ints = store.integrants.integrants;

        const {id, base} = psiCtx.makeIntegrantBase("Features", pos++);
        ints[id] = {
            ...base,
            name: psionic.name,
            recordName: psionic.name,
            description,
            source,
            parentID: "",
            childIDs: "[]",
            cascades: {},
            relations: {},
        };

        psiCtx.pushDisplayOrder(store, "features", "otherDisplayOrder", [id]);

        psiCtx.saveStore(charModel, storeAttr, store);
        } finally {
            releaseLock();
        }
    };
}

SCRIPT_EXTENSIONS.push(d20plus2024PsionicImport);
