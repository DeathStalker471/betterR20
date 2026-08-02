function d20plus2024BackgroundImport() {
	const bgCtx = d20plus.import2024;

	const ABILITY_FULL = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};

	const titleCase = (s) => (s || "").replace(/\b\w/g, c => c.toUpperCase());
	const cleanItemName = (raw) => titleCase((raw || "").split("|")[0].trim());

	// 5etools stores item cost in copper; pick whichever unit divides evenly so cheap
	// gear (e.g. a 5 SP pouch) doesn't get rounded down to "0 GP".
	function formatCost(valueInCopper) {
		if (!valueInCopper) return "";
		if (valueInCopper % 100 === 0) return `${valueInCopper / 100} GP`;
		if (valueInCopper % 10 === 0) return `${valueInCopper / 10} SP`;
		return `${valueInCopper} CP`;
	}

	// Short human-readable label for one startingEquipment entry, used to describe choice
	// options to the player - name only, no item-database lookup needed.
	function describeEquipEntry(entry) {
		if (typeof entry === "string") return cleanItemName(entry);
		if (entry.value) return `${entry.value / 100} GP`;
		if (entry.special) return titleCase(entry.special);
		if (entry.equipmentType) return `${titleCase(entry.equipmentType)} (choice)`;
		if (entry.item) {
			const name = cleanItemName(entry.item);
			const qty = entry.quantity || 1;
			return qty > 1 ? `${name} (${qty})` : name;
		}
		return "Unknown Item";
	}
	const describeEquipOption = (entries) => entries.map(describeEquipEntry).join(", ");

	// Resolve one startingEquipment entry against the real item list, for actual cost/weight.
	function resolveEquipEntry(entry, allItems) {
		if (entry && entry.value) return {gold: entry.value / 100};
		const name = describeEquipEntry(entry);
		const found = allItems.find(it => it.name.toLowerCase() === name.toLowerCase());
		const quantity = (entry && typeof entry === "object" && entry.quantity) || 1;
		return {name: found ? found.name : name, resolvedItem: found || null, quantity};
	}

	// Lettered/A-B equipment choice groups need a player pick - a dropdown dialog describing
	// each option's actual contents, same pattern as the ability-score-bonus choice below.
	function chooseEquipmentGroup(group) {
		return new Promise(resolve => {
			const keys = Object.keys(group);
			if (keys.length === 1) { resolve(keys[0]); return; }

			const $dialog = $(`
				<div title="Starting Equipment">
					<label class="flex">
						<span>Choose starting equipment option:</span>
						<select style="width: 350px;">
							${keys.map((k, i) => `<option value="${i}">${describeEquipOption(group[k])}</option>`).join("")}
						</select>
					</label>
				</div>
			`).appendTo($("body"));
			const $sel = $dialog.find("select");

			$dialog.dialog({
				dialogClass: "no-close",
				buttons: [
					{
						text: "OK",
						click: function () {
							const idx = Number($sel.val());
							$(this).dialog("close");
							$dialog.remove();
							resolve(keys[idx] || keys[0]);
						},
					},
				],
			});
		});
	}

	// 2024 (XPHB) background ability bonus: either +2/+1 split (player's choice of which gets
	// +2) or +1/+1/+1 flat across the same 3-ability pool. Dropdown dialog instead of a free-text
	// prompt, matching the jQuery choice-dialog pattern already used elsewhere (e.g. the subclass
	// import-strategy picker in 5etools-classes.js).
	function chooseWeightedAbilityBonus(pool) {
		return new Promise(resolve => {
			const names = pool.map(a => ABILITY_FULL[a] || a);
			const optionLabels = [
				...names.map(n => `${n} +2, others +1`),
				`All three +1`,
			];

			const $dialog = $(`
				<div title="Background Ability Score Bonus">
					<label class="flex">
						<span>Choose how to apply this background's ability score bonus:</span>
						<select style="width: 250px;">
							${optionLabels.map((label, i) => `<option value="${i}">${label}</option>`).join("")}
						</select>
					</label>
				</div>
			`).appendTo($("body"));
			const $sel = $dialog.find("select");

			$dialog.dialog({
				dialogClass: "no-close",
				buttons: [
					{
						text: "Cancel",
						click: function () {
							$(this).dialog("close");
							$dialog.remove();
							resolve([]);
						},
					},
					{
						text: "OK",
						click: function () {
							const idx = Number($sel.val());
							$(this).dialog("close");
							$dialog.remove();
							if (idx === names.length) {
								resolve(names.map(a => ({ability: a, amount: 1})));
								return;
							}
							const plusTwo = names[idx];
							resolve([{ability: plusTwo, amount: 2}, ...names.filter(a => a !== plusTwo).map(a => ({ability: a, amount: 1}))]);
						},
					},
				],
			});
		});
	}

	d20plus.importer.import2024Background = async function (charModel, data) {
		const bg = data.Vetoolscontent;
		if (!bg) return;

		const releaseLock = await bgCtx.pAcquireStoreLock(charModel);
		try {
			await d20plus.ut.fetchCharAttribs(charModel);
			const {attr: storeAttr, store} = bgCtx.getStore(charModel);
			if (!store) return;

			let pos = bgCtx.getNextArrayPos(store);
			const ints = store.integrants.integrants;
			const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

			const makeBase = (type) => {
				const {id, base} = bgCtx.makeIntegrantBase(type, pos++);
				base.source = "Background";
				return {id, base};
			};

			const bgName = bg.name || "Background";

			// Background is a top-level integrant, same as Class/Species - confirmed
			// against a real Roll20-built Charlatan background.
			const {id: bgId, base: bgBase} = bgCtx.makeIntegrantBase("Background", pos++);
			ints[bgId] = {
				...bgBase,
				name: bgName,
				recordName: bgName,
				description: "",
				source: "Custom",
				parentID: "",
				childIDs: "[]",
				cascades: {},
				relations: {},
			};

			const children = [];

			// Named entries (e.g. "Feature: False Identity", "Suggested Characteristics")
			// each become their own flat Features child.
			(bg.entries || []).forEach(e => {
				if (!e || !e.name) return;
				const name = e.name.replace(/^Feature:\s*/, "").trim();

				const renderStack = [];
				if (e.entries) renderer.recursiveRender({entries: e.entries}, renderStack);
				const description = d20plus.importer.getCleanText(renderStack.join(""));

				const {id: featId, base: featBase} = makeBase("Features");
				ints[featId] = {
					...featBase,
					name,
					recordName: name,
					description,
					parentID: bgId,
					sourceID: bgId,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
				children.push(featId);
			});

			// Fixed skill/tool proficiencies (no player choice).
			const addFixedProfs = (profGroups, category) => {
				(profGroups || []).forEach(group => {
					Object.keys(group || {}).forEach(key => {
						if (key === "choose") return;
						const profName = titleCase(key);
						const {id: profId, base: profBase} = makeBase("Proficiency");
						ints[profId] = {
							...profBase,
							category,
							name: profName,
							recordName: `${profName} Proficiency`,
							proficiency: profName,
							proficiencyLevel: "Proficient",
							rollAbility: "Query Attribute",
							notes: "",
							parentID: bgId,
							sourceID: bgId,
							childIDs: "[]",
							cascades: {},
							relations: {},
						};
						children.push(profId);
					});
				});
			};
			addFixedProfs(bg.skillProficiencies, "Skill");
			addFixedProfs(bg.toolProficiencies, "Tool");

			// Starting equipment - fixed "_" lists are granted outright; lettered/A-B choices
			// prompt the player for which option to take. Bundled currency amounts (no
			// confirmed currency integrant) and list-type choices (e.g. "any artisan's tool")
			// are added as unresolved placeholder items rather than silently dropped.
			if (bg.startingEquipment && bg.startingEquipment.length) {
				await Renderer.item.pPopulatePropertyAndTypeReference();
				const allItems = await Renderer.item.pBuildList();

				for (const group of bg.startingEquipment) {
					const chosenKey = group._ ? "_" : await chooseEquipmentGroup(group);
					const entries = group[chosenKey] || [];

					entries.forEach(rawEntry => {
						const resolved = resolveEquipEntry(rawEntry, allItems);
						if (!resolved || resolved.gold) return;

						const it = resolved.resolvedItem;
						const renderStack = [];
						if (it && it.entries) renderer.recursiveRender({entries: it.entries}, renderStack);
						const description = d20plus.importer.getCleanText(renderStack.join(""));

						const {id: itemId, base: itemBase} = makeBase("Item");
						ints[itemId] = {
							...itemBase,
							name: resolved.name,
							recordName: resolved.name,
							quantity: resolved.quantity || 1,
							cost: it ? formatCost(it.value) : "",
							weight: it ? (it.weight || 0) : 0,
							equipData: {equippable: false},
							description,
							parentID: bgId,
							sourceID: bgId,
							childIDs: "[]",
							cascades: {},
							relations: {},
						};
						children.push(itemId);
					});
				}
			}

			// 2024 (XPHB) background ability score bonus - 2014 backgrounds have no `ability`
			// field at all, so this is skipped entirely for those.
			if (bg.ability && bg.ability.length) {
				const ab = bg.ability[0];
				let bonuses = [];
				if (ab.choose && ab.choose.weighted) {
					bonuses = await chooseWeightedAbilityBonus(ab.choose.weighted.from || []);
				} else if (ab.choose) {
					const pool = (ab.choose.from || []).map(a => ABILITY_FULL[a] || a);
					const amount = ab.choose.amount || 1;
					bonuses = pool.map(a => ({ability: a, amount}));
				} else {
					bonuses = Object.entries(ab)
						.filter(([k, v]) => k !== "choose" && typeof v === "number")
						.map(([k, v]) => ({ability: ABILITY_FULL[k] || k, amount: v}));
				}

				bonuses.forEach(({ability, amount}) => {
					const {id: asId, base: asBase} = makeBase("Ability Score");
					ints[asId] = {
						...asBase,
						ability,
						name: "Ability Score Increase",
						calculation: "Modify",
						valueFormula: {flatValue: amount},
						parentID: bgId,
						sourceID: bgId,
						childIDs: "[]",
						cascades: {},
						relations: {},
					};
					children.push(asId);
				});
			}

			// 2024 (XPHB) origin feat - a descriptive stub rather than a fully mechanical Feat
			// integrant, since resolving and attaching a real feat here would need to re-acquire
			// the store lock this function's caller already holds.
			(bg.feats || []).forEach(featGroup => {
				Object.keys(featGroup || {}).forEach(key => {
					if (key === "choose") return;
					const [nameVariant] = key.split("|");
					const [baseName, variant] = nameVariant.split(";").map(s => (s || "").trim());
					const featName = titleCase(baseName);
					const variantTitle = variant ? titleCase(variant) : "";

					const {id: featId, base: featBase} = makeBase("Features");
					ints[featId] = {
						...featBase,
						name: `Origin Feat: ${featName}`,
						recordName: `Origin Feat: ${featName}`,
						description: `This background grants the ${featName} feat${variantTitle ? ` (${variantTitle})` : ""} as a starting feat. Add it via the Feats importer for its full mechanical effects.`,
						parentID: bgId,
						sourceID: bgId,
						childIDs: "[]",
						cascades: {},
						relations: {},
					};
					children.push(featId);
				});
			});

			ints[bgId].childIDs = JSON.stringify(children);

			bgCtx.saveStore(charModel, storeAttr, store);
		} finally {
			releaseLock();
		}
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024BackgroundImport);
