function d20plus2024ClassImport() {
    const classCtx = d20plus.import2024;

    // _batchStore: when provided, this call mutates the caller's own in-progress store directly
    // instead of doing its own lock/read/save cycle - used by import2024ClassLevelUp so leveling
    // up the class and its subclass together is one read + one save instead of two back-to-back
    // saves on the same "store" attribute, which raced against Roll20's own async sync of the
    // first save and threw inside their bundle (destroy/push happening before the previous
    // syncedSave's callback had resolved).
    d20plus.importer.import2024Class = async function (charModel, data, _batchStore) {
        const clss = data.Vetoolscontent;
        if (!clss || !clss.classFeatures) return;

        // Force-load attribs before reading the store - on a freshly-opened character sheet, Roll20
        // may not have finished hydrating charModel.attribs yet, which could make getStore() silently
        // miss the real store attribute and no-op this import for no visible reason.
        const releaseLock = _batchStore ? null : await classCtx.pAcquireStoreLock(charModel);
        try {
        let storeAttr, store;
        if (_batchStore) {
            storeAttr = null;
            store = _batchStore;
        } else {
            await d20plus.ut.fetchCharAttribs(charModel);
            ({attr: storeAttr, store} = classCtx.getStore(charModel));
            if (!store) return;
        }

        const ints = store.integrants.integrants;

        // Dragging a class that's already on this character re-levels it instead of creating a
        // duplicate Class block - Roll20's own native "Level Up" button refuses to touch a
        // manually-imported (non-compendium-linked) class, so this is the only way to level one up.
        const existingClassInt = Object.values(ints).find(i => i.type === "Class" && (i.name || "").toLowerCase() === clss.name.toLowerCase());

        let startLevel, maxLevel, classId, classChildren;
        if (existingClassInt) {
            classId = existingClassInt.shortID;
            const existingLevels = Object.values(ints).filter(i => i.type === "Class Level" && i.classID === classId);
            const currentMax = existingLevels.length ? Math.max(...existingLevels.map(l => l.level)) : 0;

            const levelInput = prompt(`${clss.name} is already on this character at level ${currentMax}. Level up to what level? (${currentMax + 1}-20)`, String(Math.min(20, currentMax + 1)));
            if (levelInput === null) return;
            const requested = Math.min(20, parseInt(levelInput, 10) || currentMax);
            if (!Number.isInteger(requested) || requested <= currentMax) {
                alert(`${clss.name} is already level ${currentMax} - enter a higher level to level up.`);
                return;
            }
            startLevel = currentMax + 1;
            maxLevel = requested;
            classChildren = JSON.parse(existingClassInt.childIDs || "[]");
        } else {
            const levelInput = prompt(`Import ${clss.name} at what level? (1-20)`, "1");
            if (levelInput === null) return;
            maxLevel = Math.min(20, Math.max(1, parseInt(levelInput, 10) || 1));
            startLevel = 1;
            classChildren = [];
        }

        let pos = classCtx.getNextArrayPos(store);

        const makeBase = (type) => {
            const {id, base} = classCtx.makeIntegrantBase(type, pos++);
            base.source = "Class";
            return {id, base};
        };

        const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

        const abilityMap = {
            str: "Strength",
            dex: "Dexterity",
            con: "Constitution",
            int: "Intelligence",
            wis: "Wisdom",
            cha: "Charisma"
        };
        const spellAbility = clss.spellcastingAbility ? abilityMap[clss.spellcastingAbility] : null;
        const casterTypeMap = {"full": "full", "1/2": "half", "1/3": "third", "artificer": "half", "pact": "pact"};
        const casterType = (spellAbility && clss.casterProgression) ? (casterTypeMap[clss.casterProgression] || "full") : null;

        const spellProgressionTable = clss.classTableGroups
            ?.find(g => g.rowsSpellProgression)?.rowsSpellProgression || null;

        const classFeatureIds = [];

        if (!existingClassInt) {
            const {id: newClassId, base: classBase} = makeBase("Class");
            classId = newClassId;
            ints[classId] = {
                ...classBase,
                name: clss.name,
                recordName: clss.name,
                isPooledCaster: !!spellAbility,
                source: "Custom",
                parentID: "",
                childIDs: "[]",
                cascades: {},
                relations: {},
            };
        }

        const avgHP = Math.ceil((clss.hd.faces + 1) / 2);

        // One Class Level integrant per newly-requested level (1..maxLevel on a fresh import,
        // or just the newly-added levels when leveling up an existing class).
        for (let lvl = startLevel; lvl <= maxLevel; lvl++) {
            const {id: lvlId, base: lvlBase} = makeBase("Class Level");
            ints[lvlId] = {
                ...lvlBase,
                name: clss.name,
                recordName: `${clss.name} Level ${lvl}`,
                level: lvl,
                totalLevel: lvl,
                classID: classId,
                parentID: classId,
                sourceID: classId,
                subClassID: "",
                childIDs: "[]",
                cascades: {},
                relations: {},
            };
            classChildren.push(lvlId);

            const lvlChildren = [];

            // Hit Dice
            const {id: hdId, base: hdBase} = makeBase("Hit Dice");
            ints[hdId] = {
                ...hdBase,
                name: `${clss.name} Hit Dice (Level ${lvl})`,
                recordName: `${clss.name} Hit Dice (Level ${lvl})`,
                ability: "Constitution",
                dieCount: 1,
                dieSize: clss.hd.faces,
                recovery: "Long",
                classID: classId,
                parentID: lvlId,
                sourceID: classId,
                childIDs: "[]",
                cascades: {},
                relations: {},
            };
            lvlChildren.push(hdId);

            // Hit Points (max at level 1, average thereafter)
            const {id: hpId, base: hpBase} = makeBase("Hit Points");
            ints[hpId] = {
                ...hpBase,
                _label: `Hit Points - Max - Level ${lvl}`,
                name: `Hit Points - Max - Level ${lvl}`,
                hitpointType: "Maximum",
                calculation: "Modify",
                isFixed: lvl === 1,
                parentID: lvlId,
                sourceID: classId,
                childIDs: "[]",
                valueFormula: {
                    flatValue: lvl === 1 ? clss.hd.faces : avgHP,
                    ability: {add: true, name: "Constitution"},
                },
                cascades: {},
                relations: {},
            };
            lvlChildren.push(hpId);

            // Features gained at this level
            const levelFeatures = clss.classFeatures[lvl - 1] || [];
            for (const feature of levelFeatures) {
                if (!feature || !feature.name) continue;
                if (feature.gainSubclassFeature) continue;
                if (feature.name === "Ability Score Improvement") continue;

                const renderStack = [];
                if (feature.entries) renderer.recursiveRender({entries: feature.entries}, renderStack);
                const description = d20plus.importer.getCleanText(renderStack.join(""));

                const {id: featId, base: featBase} = makeBase("Features");
                ints[featId] = {
                    ...featBase,
                    name: feature.name,
                    recordName: `${clss.name} ${feature.name}`,
                    description,
                    parentID: lvlId,
                    sourceID: classId,
                    childIDs: "[]",
                    cascades: {},
                    relations: {},
                };
                lvlChildren.push(featId);
                classFeatureIds.push(featId);

                // Build the Spellcasting subtree's static parts under the Spellcasting feature.
                // Spell Slot children are added by the slot-rebuild step below instead of here,
                // so the slot count always reflects the current max level whether Spellcasting
                // was just granted this run or was already granted at an earlier level.
                if (feature.name === "Spellcasting" && spellAbility && casterType) {
                    const scChildren = [];

                    const {id: rdId, base: rdBase} = makeBase("Rest Display");
                    ints[rdId] = {
                        ...rdBase,
                        name: `${clss.name} Spellcasting Rest Display`,
                        recordName: `${clss.name} Spellcasting Rest Display`,
                        description: `Whenever you finish a Long Rest, you can replace one spell on your list with another ${clss.name} spell for which you have spell slots.`,
                        parentID: featId,
                        sourceID: classId,
                        restType: "[\"Long Rest\"]",
                        childIDs: "[]",
                        cascades: {},
                        relations: {},
                    };
                    scChildren.push(rdId);

                    const {id: configId, base: configBase} = makeBase("Spellcasting");
                    ints[configId] = {
                        ...configBase,
                        name: clss.name,
                        recordName: `${clss.name} ${spellAbility} Spellcasting`,
                        ability: spellAbility,
                        casterType,
                        multiclassRoundUp: casterType === "half",
                        overviewDisplay: true,
                        parentID: featId,
                        sourceID: classId,
                        childIDs: "[]",
                        cascades: {},
                        relations: {},
                    };
                    scChildren.push(configId);

                    ints[featId].childIDs = JSON.stringify(scChildren);
                }
            }

            ints[lvlId].childIDs = JSON.stringify(lvlChildren);
        }

        ints[classId].childIDs = JSON.stringify(classChildren);

        // Cache the raw class JSON so a later level-up (e.g. via the hijacked native Level Up
        // button, which has no drag payload to work from) can re-run this same import logic
        // without needing to re-find the class in a compendium or homebrew source that might
        // not even be loaded anymore. This has to live in its own plain attribute rather than
        // inside `store` - Roll20's own client actively reprocesses that attribute (it's what
        // lets it detect "manually set" classes at all) and strips unrecognized fields from it
        // almost immediately, which silently wiped this out when it was stored there.
        const cacheAttr = charModel.attribs.find(a => a.get("name") === "_betterR20ClassData");
        let cacheData = {};
        if (cacheAttr) {
            try { cacheData = JSON.parse(cacheAttr.get("current") || "{}"); } catch (e) { cacheData = {}; }
        }
        cacheData[classId] = clss;
        if (cacheAttr) {
            cacheAttr.set("current", JSON.stringify(cacheData));
            cacheAttr.save();
        } else {
            charModel.attribs.push({name: "_betterR20ClassData", current: JSON.stringify(cacheData)}).syncedSave();
        }

        classCtx.pushDisplayOrder(store, "features", "classFeatureDisplayOrder", classFeatureIds);

        // (Re)build spell slots for the current max level. Runs unconditionally, whether
        // Spellcasting was just granted this run or was already present from an earlier
        // level-up, so slot counts always match the class's new max level.
        if (spellAbility && casterType && spellProgressionTable) {
            const spellcastingFeature = Object.values(ints).find(i => i.type === "Features" && i.name === "Spellcasting" && i.sourceID === classId);
            if (spellcastingFeature) {
                const oldChildren = JSON.parse(spellcastingFeature.childIDs || "[]");
                const keptChildren = [];
                oldChildren.forEach(id => {
                    if (ints[id] && ints[id].type === "Spell Slot") delete ints[id];
                    else keptChildren.push(id);
                });

                const newSlotIds = [];
                const slotsRow = spellProgressionTable[maxLevel - 1] || [];
                slotsRow.forEach((count, slotIdx) => {
                    if (!count) return;
                    const spellLevel = slotIdx + 1;
                    const {id: ssId, base: ssBase} = makeBase("Spell Slot");
                    ints[ssId] = {
                        ...ssBase,
                        name: `${clss.name} Level ${maxLevel} Spell Slot ${count}`,
                        recordName: `${clss.name} Level ${maxLevel} Spell Slot ${count}`,
                        _slotType: casterType,
                        spellLevel,
                        valueFormula: {flatValue: count},
                        calculation: "Set Base",
                        parentID: spellcastingFeature.shortID,
                        sourceID: classId,
                        childIDs: "[]",
                        cascades: {},
                        relations: {},
                    };
                    newSlotIds.push(ssId);
                });

                spellcastingFeature.childIDs = JSON.stringify([...keptChildren, ...newSlotIds]);
            }
        }

        if (!_batchStore) classCtx.saveStore(charModel, storeAttr, store);
        } finally {
            if (!_batchStore) releaseLock();
        }
    };

    // Entry point for the hijacked native "Level Up" button - it has no drag payload to work
    // from, so this resolves which class to level up (prompting if there's more than one),
    // levels it up, then brings a cached subclass up to the same new level - all against one
    // shared store read/save so the two don't race each other's saves (see the _batchStore
    // comment on import2024Class above).
    d20plus.importer.import2024ClassLevelUp = async function (charModel) {
        const releaseLock = await classCtx.pAcquireStoreLock(charModel);
        try {
        await d20plus.ut.fetchCharAttribs(charModel);
        const {attr: storeAttr, store} = classCtx.getStore(charModel);
        if (!store) return;

        const ints = store.integrants.integrants;
        const classInts = Object.values(ints).filter(i => i.type === "Class");
        if (!classInts.length) {
            alert("No BetteR20-imported class found on this character.");
            return;
        }

        const cacheAttr = charModel.attribs.find(a => a.get("name") === "_betterR20ClassData");
        let rawData = {};
        if (cacheAttr) {
            try { rawData = JSON.parse(cacheAttr.get("current") || "{}"); } catch (e) { rawData = {}; }
        }

        let chosen = classInts[0];
        if (classInts.length > 1) {
            const names = classInts.map(c => c.name).join(", ");
            const input = prompt(`Multiple classes found (${names}). Which one do you want to level up?`, classInts[0].name);
            if (input === null) return;
            const match = classInts.find(c => c.name.toLowerCase() === input.trim().toLowerCase());
            if (!match) {
                alert(`No class named "${input}" found on this character.`);
                return;
            }
            chosen = match;
        }

        const cachedClss = rawData[chosen.shortID];
        if (!cachedClss) {
            alert(`"${chosen.name}" wasn't imported via BetteR20 (or its data wasn't cached) - drag the class card onto this character again to level it up instead.`);
            return;
        }

        await d20plus.importer.import2024Class(charModel, {Vetoolscontent: cachedClss}, store);

        // Also bring a cached subclass up to the class's new level, so leveling up the class
        // is a single action instead of two separate re-drags.
        const newLevels = Object.values(ints).filter(i => i.type === "Class Level" && i.classID === chosen.shortID);
        const newMax = newLevels.length ? Math.max(...newLevels.map(l => l.level)) : 0;

        if (newMax) {
            const subclassCacheAttr = charModel.attribs.find(a => a.get("name") === "_betterR20SubclassData");
            if (subclassCacheAttr) {
                let subclassRawData = {};
                try { subclassRawData = JSON.parse(subclassCacheAttr.get("current") || "{}"); } catch (e) { subclassRawData = {}; }

                const cachedSc = subclassRawData[chosen.shortID];
                if (cachedSc) {
                    await d20plus.importer.import2024Subclass(charModel, {Vetoolscontent: cachedSc}, newMax, store);
                }
            }
        }

        classCtx.saveStore(charModel, storeAttr, store);
        } finally {
            releaseLock();
        }
    };
}

SCRIPT_EXTENSIONS.push(d20plus2024ClassImport);
