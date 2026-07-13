function d20plus2024ClassImport() {
    const classCtx = d20plus.import2024;

    d20plus.importer.import2024Class = async function (charModel, data) {
        const clss = data.Vetoolscontent;
        if (!clss || !clss.classFeatures) return;

        const levelInput = prompt(`Import ${clss.name} at what level? (1-20)`, "1");
        if (levelInput === null) return;
        const maxLevel = Math.min(20, Math.max(1, parseInt(levelInput, 10) || 1));

        const {attr: storeAttr, store} = classCtx.getStore(charModel);
        if (!store) return;

        let pos = classCtx.getNextArrayPos(store);

        const makeBase = (type) => {
            const {id, base} = classCtx.makeIntegrantBase(type, pos++);
            base.source = "Class";
            return {id, base};
        };

        const ints = store.integrants.integrants;
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

        // Class integrant (top-level)
        const {id: classId, base: classBase} = makeBase("Class");
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

        const classChildren = [];
        const avgHP = Math.ceil((clss.hd.faces + 1) / 2);

        // One Class Level integrant per level
        for (let lvl = 1; lvl <= maxLevel; lvl++) {
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

                // Build spellcasting subtree under the Spellcasting feature
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

                    if (spellProgressionTable) {
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
                                parentID: featId,
                                sourceID: classId,
                                childIDs: "[]",
                                cascades: {},
                                relations: {},
                            };
                            scChildren.push(ssId);
                        });
                    }

                    ints[featId].childIDs = JSON.stringify(scChildren);
                }
            }

            ints[lvlId].childIDs = JSON.stringify(lvlChildren);
        }

        ints[classId].childIDs = JSON.stringify(classChildren);

        classCtx.pushDisplayOrder(store, "features", "classFeatureDisplayOrder", classFeatureIds);

        classCtx.saveStore(charModel, storeAttr, store);
    };
}

SCRIPT_EXTENSIONS.push(d20plus2024ClassImport);
