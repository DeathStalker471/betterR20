function d20plus2024RaceImport() {
	const raceCtx = d20plus.import2024;

	d20plus.importer.import2024Race = function (charModel, data) {
		const race = data.Vetoolscontent;
		if (!race) return;

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
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024RaceImport);
