function d20plus2024ItemImport() {
	const itemCtx = d20plus.import2024;

	d20plus.importer.import2024Item = function (charModel, itemData) {
		const d = itemData.data || {};
		const vc = itemData.Vetoolscontent || {};
		const {attr: storeAttr, store: rawStore} = itemCtx.getStore(charModel);

		const store = rawStore ? JSON.parse(JSON.stringify(rawStore)) : {
			integrants: {integrants: {}},
			inventory: {equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]"},
			attacks: {attackDisplayOrder: "[]"},
		};
		if (!store.integrants) store.integrants = {integrants: {}};
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.inventory) store.inventory = {equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]"};
		if (!store.attacks) store.attacks = {attackDisplayOrder: "[]"};

		const bonusMatch = itemData.name.match(/^\+(\d+)/);
		const magicBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;

		let pos = itemCtx.getNextArrayPos(store);

		const parseDice = (str) => {
			const m = (str || "").match(/(\d+)d(\d+)/i);
			return m ? {diceCount: parseInt(m[1], 10), diceSize: `d${m[2]}`} : {diceCount: 1, diceSize: "d4"};
		};

		const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

		const propMap = {
			V: "Versatile", F: "Finesse", L: "Light", T: "Thrown",
			"2H": "Two-Handed", R: "Reach", A: "Ammunition",
			LD: "Loading", H: "Heavy", S: "Special",
		};

		// Normalise vc.property entries by stripping source suffixes (e.g. "V|XPHB" → "V")
		const vcProps = (vc.property || []).map(p => p.split("|")[0]);
		const hasProp = (key) => vcProps.includes(key);
		const isVersatile = hasProp("V") || !!d["Alternate Damage"];
		const itemType = (d["Item Type"] || "").toLowerCase();
		const isRanged = itemType.includes("ranged");
		const baseAbility = isRanged ? "Dexterity" : "Strength";
		const baseAtkType = isRanged ? "Ranged" : "Melee";

		// Item integrant ID needed before building attacks (attacks reference itemId as sourceID/parentID)
		const {id: itemId, base: itemBase} = itemCtx.makeIntegrantBase("Item", pos++);

		const makeAttackPair = (atkName, atkRecordName, dmgName, atkObj, dmgAbility, dmgStr, dmgType) => {
			const {id: atkId, base: atkBase} = itemCtx.makeIntegrantBase("Attack", pos++);
			const {id: dmgId, base: dmgBase} = itemCtx.makeIntegrantBase("Damage", pos++);
			const {diceCount, diceSize} = parseDice(dmgStr);

			const dmgIntegrant = {
				...dmgBase,
				name: dmgName,
				recordName: dmgName,
				ability: dmgAbility,
				diceCount,
				diceSize,
				damageType: dmgType,
				overrideCrit: false,
				critDiceSize: "",
				parentID: atkId,
				childIDs: "[]",
				source: "",
				relations: {},
			};
			if (magicBonus > 0) dmgIntegrant._bonus = magicBonus;

			const atkIntegrant = {
				...atkBase,
				name: atkName,
				recordName: atkRecordName,
				actionType: "Action",
				attack: atkObj,
				source: "Item",
				sourceID: itemId,
				parentID: itemId,
				childIDs: JSON.stringify([dmgId]),
				relations: {},
			};
			if (atkObj.type === "Ranged" && vc.range) atkIntegrant.range = vc.range;

			store.integrants.integrants[dmgId] = dmgIntegrant;
			store.integrants.integrants[atkId] = atkIntegrant;
			return atkId;
		};

		const makeAtk = (bonus) => {
			const obj = {abilityBonus: baseAbility, type: baseAtkType};
			if (bonus > 0) obj.bonus = bonus;
			return obj;
		};

		const allAtkIds = [];

		// Weapon — build attack+damage pairs based on properties
		if (d["Damage"]) {
			const dmgType = d["Damage Type"] || "Slashing";
			const altDmgType = d["Alternate Damage Type"] || dmgType;
			const baseName = itemData.name;

			if (isVersatile) {
				allAtkIds.push(makeAttackPair(
					`${baseName} (One-Handed)`,
					`${baseName} Attack One-Handed`,
					`${baseName} Damage One-Handed`,
					makeAtk(magicBonus),
					"auto",
					d["Damage"],
					dmgType,
				));
				allAtkIds.push(makeAttackPair(
					`${baseName} (Two-Handed)`,
					`${baseName} Two-Handed Attack`,
					`${baseName} Two Handed Damage`,
					makeAtk(magicBonus),
					"auto",
					d["Alternate Damage"],
					altDmgType,
				));
			} else {
				allAtkIds.push(makeAttackPair(
					baseName,
					`${baseName} Attack`,
					`${baseName} Damage`,
					makeAtk(magicBonus),
					"auto",
					d["Damage"],
					dmgType,
				));
			}

			if (hasProp("F")) {
				const fAtk = {abilityBonus: "Dexterity", type: "Melee"};
				if (magicBonus > 0) fAtk.bonus = magicBonus;
				allAtkIds.push(makeAttackPair(
					`${baseName} (Finesse)`,
					`${baseName} Attack (Finesse)`,
					`${baseName} Damage (Finesse)`,
					fAtk,
					"auto",
					d["Damage"],
					dmgType,
				));
			}

			if (hasProp("L")) {
				const lAtk = {abilityBonus: "Strength", type: "Melee"};
				if (magicBonus > 0) lAtk.bonus = magicBonus;
				allAtkIds.push(makeAttackPair(
					`${baseName} (Off-hand)`,
					`${baseName} Attack (Off-hand)`,
					`${baseName} Damage (Off-hand)`,
					lAtk,
					"none",
					d["Damage"],
					dmgType,
				));
			}

			if (hasProp("T")) {
				const tAtk = {abilityBonus: "Strength", type: "Ranged"};
				if (magicBonus > 0) tAtk.bonus = magicBonus;
				allAtkIds.push(makeAttackPair(
					`${baseName} (Thrown)`,
					`${baseName} Attack (Thrown)`,
					`${baseName} Damage (Thrown)`,
					tAtk,
					"auto",
					d["Damage"],
					dmgType,
				));
			}
		}

		let propertiesStr = undefined;
		if (vcProps.length > 0) {
			propertiesStr = JSON.stringify(vcProps.map(key => {
				if (key === "V") return `Versatile (${d["Alternate Damage"] || "1d10"})`;
				return propMap[key] || key;
			}));
		}

		const itemIntegrant = {
			...itemBase,
			name: itemData.name,
			recordName: itemData.name,
			quantity: 1,
			weight: parseFloat(d["Weight"] || "0") || 0,
			cost: (vc.value != null) ? Math.floor(vc.value / 100) + " GP" : "",
			equipData: {equippable: true, equipped: false},
			description: itemData.content || "",
			source: "",
			childIDs: JSON.stringify(allAtkIds),
			relations: {},
		};
		if (propertiesStr !== undefined) itemIntegrant.properties = propertiesStr;
		if (d["Damage"]) {
			itemIntegrant.weaponData = {
				category: isRanged ? "Ranged" : "Melee",
				training: capitalize(vc.weaponCategory || "martial"),
				type: vc.name || itemData.name,
			};
		}

		store.integrants.integrants[itemId] = itemIntegrant;

		itemCtx.saveStore(charModel, storeAttr, store);
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024ItemImport);
