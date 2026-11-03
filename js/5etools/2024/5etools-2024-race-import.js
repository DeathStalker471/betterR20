function d20plus2024RaceImport() {
	const raceCtx = d20plus.import2024;

	d20plus.importer.import2024Race = async function (charModel, data) {
		const race = data.Vetoolscontent;
		if (!race) return;

		// Force-load attribs before reading the store - on a freshly-opened character sheet, Roll20
		// may not have finished hydrating charModel.attribs yet, which could make getStore() silently
		// miss the real store attribute and no-op this import for no visible reason.
		const releaseLock = await raceCtx.pAcquireStoreLock(charModel);
		try {
		await d20plus.ut.fetchCharAttribs(charModel);
		const {attr: storeAttr, store} = raceCtx.getStore(charModel);
		if (!store) return;

		let pos = raceCtx.getNextArrayPos(store);
		const ints = store.integrants.integrants;
		const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

		const makeBase = (type) => {
			const {id, base} = raceCtx.makeIntegrantBase(type, pos++);
			base.source = "Species";
			return {id, base};
		};

		const sizeAbvMap = {T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan"};
		const firstSizeAbv = (race.size && race.size[0]) || "M";
		const firstSize = sizeAbvMap[firstSizeAbv] || "Medium";
		const walkSpeed = typeof race.speed === "number" ? race.speed : (race.speed && race.speed.walk) || 30;
		const raceName = race.name || "Unknown";
		const darkvision = race.darkvision || 0;

		// Species (top-level)
		const {id: speciesId, base: speciesBase} = makeBase("Species");
		ints[speciesId] = {
			...speciesBase,
			name: raceName,
			recordName: raceName,
			description: "",
			source: "Custom",
			parentID: "",
			childIDs: "[]",
			cascades: {},
			relations: {},
		};

		const speciesChildren = [];

		// Speed
		const {id: speedId, base: speedBase} = makeBase("Speed");
		ints[speedId] = {
			...speedBase,
			name: `${walkSpeed} Speed`,
			recordName: `${raceName} Speed`,
			speed: "Walking",
			calculation: "Set Base",
			valueFormula: {flatValue: walkSpeed},
			parentID: speciesId,
			sourceID: speciesId,
			childIDs: "[]",
			cascades: {},
			relations: {},
		};
		speciesChildren.push(speedId);

		// Size
		const {id: sizeId, base: sizeBase} = makeBase("Size");
		ints[sizeId] = {
			...sizeBase,
			name: `${firstSize} Size`,
			recordName: `${raceName} Size`,
			size: firstSize,
			parentID: speciesId,
			sourceID: speciesId,
			childIDs: "[]",
			cascades: {},
			relations: {},
		};
		speciesChildren.push(sizeId);

		// Features (one per entry in race.entries)
		let hasDarkvisionFeature = false;
		for (const entry of (race.entries || [])) {
			if (!entry || typeof entry === "string" || !entry.name) continue;

			const renderStack = [];
			if (entry.entries) renderer.recursiveRender({entries: entry.entries}, renderStack);
			const description = d20plus.importer.getCleanText(renderStack.join(""));

			const {id: featId, base: featBase} = makeBase("Features");
			const featChildren = [];

			ints[featId] = {
				...featBase,
				name: entry.name,
				recordName: `${raceName} ${entry.name}`,
				description,
				parentID: speciesId,
				sourceID: speciesId,
				childIDs: "[]",
				cascades: {},
				relations: {},
			};
			speciesChildren.push(featId);

			// Darkvision entry → add Sense child
			if (/darkvision/i.test(entry.name) && darkvision) {
				hasDarkvisionFeature = true;
				const {id: senseId, base: senseBase} = makeBase("Sense");
				ints[senseId] = {
					...senseBase,
					name: "Darkvision",
					recordName: `${raceName} Darkvision`,
					calculation: "Set Base",
					valueFormula: {flatValue: darkvision},
					parentID: featId,
					sourceID: speciesId,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
				featChildren.push(senseId);
			}

			// Breath Weapon (Dragonborn) → build real Resource+Attack(x2)+Damage mechanics instead
			// of only a text Feature. Mirrors the same structure the Charactermancer's
			// buildSubraceRecords builds for this trait, and matches Roll20's own native
			// compendium-built Dragonborn (confirmed live, not guessed): a Resource tracking uses
			// = proficiency bonus (full recovery on Long Rest), and two Attack records - one per
			// shape (Cone/Line), since the real rule lets the player choose the shape each use.
			// Deliberately no level-5/11/17 damage scaling: neither the race data (prose-only, no
			// structured scaling field) nor Roll20's own native build models it here either.
			if (/^breath weapon$/i.test(entry.name)) {
				const {id: resourceId, base: resourceBase} = makeBase("Resource");
				ints[resourceId] = {
					...resourceBase,
					name: "Draconic Breath Weapon",
					recordName: `${raceName} Breath Weapon Resource`,
					maxValueFormula: {customFormula: "@{pb}"},
					recoveryRate: {"Long Rest": {type: "Full"}},
					parentID: featId,
					sourceID: speciesId,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
				featChildren.push(resourceId);

				const saveFormula = {flatValue: 8, ability: {ability: "Constitution", add: true, multiplier: 1}, proficiency: {add: true}};
				for (const [shape, size] of [["Line", "30 ft*"], ["Cone", "15 ft"]]) {
					const atkName = `Breath Weapon (${shape})`;
					const {id: atkId, base: atkBase} = makeBase("Attack");
					const {id: dmgId, base: dmgBase} = makeBase("Damage");
					ints[atkId] = {
						...atkBase,
						name: atkName,
						recordName: `${raceName} ${atkName}`,
						actionType: "Action",
						aoe: {shape, size},
						attack: {type: "Attack Save"},
						save: {saveAbility: "Dexterity", saveFormula, onFail: "1d10 damage determined by Draconic Ancestry"},
						parentID: featId,
						sourceID: speciesId,
						childIDs: JSON.stringify([dmgId]),
						cascades: {},
						relations: {},
					};
					ints[dmgId] = {
						...dmgBase,
						name: `${atkName} Damage`,
						recordName: `${raceName} ${atkName} Damage`,
						ability: "none",
						damageType: "Draconic Ancestry",
						diceCount: 1, diceSize: "d10",
						overrideCrit: false, critDiceSize: "",
						parentID: atkId,
						sourceID: speciesId,
						childIDs: "[]",
						cascades: {},
						relations: {},
					};
					featChildren.push(atkId);
				}
			}

			if (featChildren.length) ints[featId].childIDs = JSON.stringify(featChildren);
		}

		// Darkvision from data root if no Darkvision entry was found in entries
		if (darkvision && !hasDarkvisionFeature) {
			const {id: featId, base: featBase} = makeBase("Features");
			const {id: senseId, base: senseBase} = makeBase("Sense");
			ints[featId] = {
				...featBase,
				name: "Darkvision",
				recordName: `${raceName} Darkvision`,
				description: `You can see in dim light within ${darkvision} feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.`,
				parentID: speciesId,
				sourceID: speciesId,
				childIDs: JSON.stringify([senseId]),
				cascades: {},
				relations: {},
			};
			speciesChildren.push(featId);
			ints[senseId] = {
				...senseBase,
				name: "Darkvision",
				recordName: `${raceName} Darkvision`,
				calculation: "Set Base",
				valueFormula: {flatValue: darkvision},
				parentID: featId,
				sourceID: speciesId,
				childIDs: "[]",
				cascades: {},
				relations: {},
			};
		}

		ints[speciesId].childIDs = JSON.stringify(speciesChildren);

		const speciesFeatureIds = speciesChildren.filter(id => ints[id] && ints[id].type === "Features");
		raceCtx.pushDisplayOrder(store, "features", "speciesTraitsDisplayOrder", speciesFeatureIds);

		raceCtx.saveStore(charModel, storeAttr, store);
		} finally {
			releaseLock();
		}
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024RaceImport);
