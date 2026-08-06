/**
 * 2024 Character Sheet Import Support
 * Included in both the 5etools (2024) and 5et2014 builds
 */
function d20plus2024Import() {
	// ========================================
	// 2024 Sheet Configuration and Detection
	// ========================================

	// Add import sheet format config option — __values/__texts populated at setSheet time
	addConfigOptions("import", {
		"importSheetFormat": {
			"name": "Import Sheet Format",
			"default": "auto",
			"_type": "_enum",
			"__values": [],
			"__texts": [],
		},
	});

	// Reorder so importSheetFormat appears first among user-configurable options
	// (addConfigOptions uses Object.assign which appends; JS objects preserve insertion order)
	{
		const grp = CONFIG_OPTIONS["import"];
		const reordered = {};
		for (const k of Object.keys(grp)) { if (k.startsWith("_")) reordered[k] = grp[k]; }
		reordered["importSheetFormat"] = grp["importSheetFormat"];
		for (const k of Object.keys(grp)) { if (!k.startsWith("_") && k !== "importSheetFormat") reordered[k] = grp[k]; }
		CONFIG_OPTIONS["import"] = reordered;
	}

	// Map sheet keys to friendly display names
	function getSheetDisplayName(sheetKey, sheetObj) {
		if (sheetKey === "ogl5e" || sheetKey === "ogl") return "2014 (OGL)";
		if (sheetKey === "dnd_2024" || sheetKey === "DnD2024_Character_Sheet" || sheetKey === "dnd2024" || sheetKey === "dnd2024byroll20") return "2024";
		if (sheetKey === "shaped_d20") return "Shaped";
		if (sheetKey === "DnD5e_Character_Sheet") return "Community";
		const name = sheetObj?.attributes?.name || sheetKey;
		return `Other (${name})`;
	}

	// Wrap setSheet to detect available sheets and populate the dropdown
	const originalSetSheet = d20plus.setSheet;
	d20plus.setSheet = function() {
		originalSetSheet.call(this);

		try {
			const sheetsObj = d20.journal.characterSheetsManager?.sheets || {};
			const sheetKeys = Object.keys(sheetsObj);

			// Also check for customSheets
			const customSheet = d20.journal.customSheets;
			if (customSheet && customSheet.attributes?.id && !sheetsObj[customSheet.attributes.id]) {
				sheetKeys.push(customSheet.attributes.id);
				sheetsObj[customSheet.attributes.id] = customSheet;
			}

			const values = [];
			const texts = [];

			for (const key of sheetKeys) {
				values.push(key);
				texts.push(getSheetDisplayName(key, sheetsObj[key]));
			}

			// Fallback: if nothing detected, use current d20plus.sheet
			if (values.length === 0) {
				values.push(d20plus.sheet);
				texts.push(getSheetDisplayName(d20plus.sheet, null));
			}

			CONFIG_OPTIONS["import"]["importSheetFormat"].__values = values;
			CONFIG_OPTIONS["import"]["importSheetFormat"].__texts = texts;

			// Smart default: single option → use it; multiple → prefer 2024 sheet, else first
			if (values.length === 1) {
				CONFIG_OPTIONS["import"]["importSheetFormat"].default = values[0];
			} else {
				const prefer2024 = values.find(v => v === "dnd_2024" || v === "DnD2024_Character_Sheet" || v === "dnd2024" || v === "dnd2024byroll20");
				CONFIG_OPTIONS["import"]["importSheetFormat"].default = prefer2024 || values[0];
			}

			d20plus.ut.log(`Import sheet format options detected: ${values.join(", ")}`);
		} catch (e) {
			console.warn("Import sheet format detection failed:", e);
		}
	};

	// ========================================
	// 2024 Sheet Translation Layer for Module Importer
	// ========================================

	/**
	 * Generate a 21-character ID for 2024 sheet integrants
	 */
	function generate2024Id() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
		let id = '';
		for (let i = 0; i < 21; i++) {
			id += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return id;
	}

	/**
	 * Parse OGL npc_type string into size, creature type, and alignment
	 */
	function parseNpcType(npcType) {
		if (!npcType) return { size: "Medium", creatureType: "Unknown", alignment: "Unaligned" };

		const parts = npcType.split(",").map(s => s.trim());
		const firstPart = parts[0] || "";
		const alignment = parts[1] || "Unaligned";

		const sizes = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
		let size = "Medium";
		let creatureType = firstPart;

		for (const s of sizes) {
			if (firstPart.toLowerCase().startsWith(s.toLowerCase())) {
				size = s;
				creatureType = firstPart.substring(s.length).trim();
				break;
			}
		}

		if (creatureType) {
			creatureType = creatureType.charAt(0).toUpperCase() + creatureType.slice(1).toLowerCase();
		} else {
			creatureType = "Unknown";
		}

		const alignmentCap = alignment.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

		return { size, creatureType, alignment: alignmentCap };
	}

	/**
	 * Parse speed string into array of {type, value} objects
	 */
	function parseSpeeds(speedStr) {
		if (!speedStr) return [{ type: "Walk", value: 30 }];

		const speeds = [];
		const parts = speedStr.split(",").map(s => s.trim());

		for (const part of parts) {
			const match = part.match(/(?:(\w+)\s+)?(\d+)\s*(?:ft\.?)?\s*(\(([^)]+)\))?/i);
			if (match) {
				let type = match[1] ? match[1].toLowerCase() : "walk";
				const value = parseInt(match[2], 10);
				const note = match[4] ? match[4].trim() : "";

				const typeMap = {
					"walk": "Walk",
					"fly": "Fly",
					"swim": "Swim",
					"climb": "Climb",
					"burrow": "Burrow",
					"hover": "Fly",
				};
				type = typeMap[type] || "Walk";
				if (type === "Fly" && note.toLowerCase() === "hover") type = "Fly (Hover)";

				speeds.push({ type, value });
			}
		}

		return speeds.length > 0 ? speeds : [{ type: "Walk", value: 30 }];
	}

	/**
	 * Parse senses string into array of {type, value} objects
	 */
	function parseSenses(sensesStr) {
		if (!sensesStr) return [];

		const senses = [];
		const parts = sensesStr.split(",").map(s => s.trim());

		for (const part of parts) {
			if (/^passive perception\b/i.test(part)) continue;
			const match = part.match(/(\w+)\s+(\d+)\s*(?:ft\.?)?/i);
			if (match) {
				let type = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
				const value = parseInt(match[2], 10);

				const validSenses = ["Darkvision", "Blindsight", "Tremorsense", "Truesight"];
				if (validSenses.includes(type) && value > 0) {
					senses.push({ type, value });
				}
			}
		}

		return senses;
	}

	/**
	 * Parse damage string into dice components
	 */
	function parseDamage(damageStr) {
		if (!damageStr) return null;

		const match = damageStr.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/i);
		if (match) {
			return {
				diceCount: parseInt(match[1], 10),
				diceSize: "d" + match[2],
				bonus: match[3] ? parseInt(match[3], 10) : 0,
			};
		}
		return null;
	}

	/**
	 * Translate OGL attribs array to 2024 store format (for Module Importer)
	 */
	d20plus.importer.translateOGLTo2024Store = function(attribs) {
		const attrMap = {};
		const attrMaxMap = {}; // Store max values separately for HP etc.
		const repeatingActions = {};
		const repeatingLegendary = {};
		const repeatingMythic = {};
		const repeatingReactions = {};
		const repeatingTraits = {};
		const repeatingSpells = {};

		for (const attr of attribs) {
			const name = attr.name;
			attrMap[name] = attr.current;
			if (attr.max !== undefined && attr.max !== "") {
				attrMaxMap[name] = attr.max;
			}

			if (name.startsWith("repeating_npcaction-l_")) {
				const match = name.match(/repeating_npcaction-l_([^_]+)_(.+)/);
				if (match) {
					const id = match[1];
					const field = match[2];
					if (!repeatingLegendary[id]) repeatingLegendary[id] = {};
					repeatingLegendary[id][field] = attr.current;
				}
			} else if (name.startsWith("repeating_npcaction-m_")) {
				const match = name.match(/repeating_npcaction-m_([^_]+)_(.+)/);
				if (match) {
					const id = match[1];
					const field = match[2];
					if (!repeatingMythic[id]) repeatingMythic[id] = {};
					repeatingMythic[id][field] = attr.current;
				}
			} else if (name.startsWith("repeating_npcreaction_")) {
				const match = name.match(/repeating_npcreaction_([^_]+)_(.+)/);
				if (match) {
					const id = match[1];
					const field = match[2];
					if (!repeatingReactions[id]) repeatingReactions[id] = {};
					repeatingReactions[id][field] = attr.current;
				}
			} else if (name.startsWith("repeating_npctrait_")) {
				const match = name.match(/repeating_npctrait_([^_]+)_(.+)/);
				if (match) {
					const id = match[1];
					const field = match[2];
					if (!repeatingTraits[id]) repeatingTraits[id] = {};
					repeatingTraits[id][field] = attr.current;
				}
			} else if (name.startsWith("repeating_npcaction_")) {
				const match = name.match(/repeating_npcaction_([^_]+)_(.+)/);
				if (match) {
					const id = match[1];
					const field = match[2];
					if (!repeatingActions[id]) repeatingActions[id] = {};
					repeatingActions[id][field] = attr.current;
				}
			} else if (name.startsWith("repeating_spell-")) {
				const match = name.match(/repeating_spell-(\w+)_([^_]+)_(.+)/);
				if (match) {
					const level = match[1];
					const id = match[2];
					const field = match[3];
					const key = `${level}_${id}`;
					if (!repeatingSpells[key]) repeatingSpells[key] = { level };
					repeatingSpells[key][field] = attr.current;
				}
			}
		}

		const store = {
			integrants: { integrants: {} },
			actions: {
				actionDisplayOrder: "[]",
				bonusActionDisplayOrder: "[]",
				freeActionDisplayOrder: "[]",
				reactionDisplayOrder: "[]",
				legendaryActionDisplayOrder: "[]",
				mythicActionDisplayOrder: "[]",
			},
			attacks: { attackDisplayOrder: "[]" },
			spells: { displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"], generalSpellSettings: {} },
			npc: { acNotes: "", legendaryActionCompendiumNum: 0 },
			npcEdit: {},
			about: { characteristics: {}, aboutTabApperancesDisplayOrder: "[]", aboutTabCharacteristicsDisplayOrder: "[]", aboutItems: {} },
			background: { aboutTabBackgroundDisplayOrder: "[]" },
			character: { createdWithBuilder: false, creatureType: "", pronouns: "" },
			settings: { layoutState: "Stat Block", addDexTiebreaker: false, encumbranceType: "Normal", ignoreCoinWeight: false },
			hitpoints: { deathSaves: { failures: 0, open: false, successes: 0 } },
			classLevel: { currentExp: 0 },
			currencies: { initialized: true },
			effects: { effectDisplayOrder: "[]" },
			features: { classFeatureDisplayOrder: "[]", featsDisplayOrder: "[]", otherDisplayOrder: "[]", speciesDisplayOrder: "[]" },
			inspiration: { isInspired: false },
			inventory: { equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]" },
			notes: { emptyCategories: "[]", order: {}, notes: {} },
			proficiencies: {},
			rest: { longRestModalData: {}, shortRestModalData: {}, usedHitDiceData: {} },
			shop: { isLocked: false, lockDC: 10, shopDiscountMarkup: 0 },
			spellSlots: { currentByLevel: {}, currentPactByLevel: {}, useSpellSlotOnCast: true },
			weaponMasteries: { masteryDisplayOrder: "[]" },
			bastion: { bastionDefenders: "", bastionDescription: "", bastionLevel: 1 },
		};

		let arrayPosition = 100;
		const integrants = store.integrants.integrants;

		const createIntegrantBase = (type) => {
			const id = generate2024Id();
			return {
				id,
				base: {
					_enabled: true,
					_label: "",
					type,
					childIDs: "[]",
					parentID: "",
					parentDisabled: false,
					overwriteDisabled: false,
					builderDisplayName: "",
					createdTime: Date.now(),
					arrayPosition: arrayPosition++,
					shortID: id.substring(0, 9),
					source: "",
				},
			};
		};

		// Ability Scores
		const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
		const abilityNames = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

		// Debug logging
		for (let i = 0; i < abilities.length; i++) {
			const value = parseInt(attrMap[abilities[i]] || attrMap[abilities[i] + "_base"] || "10", 10);
			const { id, base } = createIntegrantBase("Ability Score");
			integrants[id] = {
				...base,
				ability: abilityNames[i],
				calculation: "Set Value",
				name: "",
				valueFormula: { flatValue: value },
			};
		}

		// Hit Points - OGL stores max HP in the "max" field of "hp" attribute
		const hpMax = parseInt(attrMaxMap["hp"] || attrMap["hp"] || attrMap["hp_max"] || "10", 10);
		const { id: hpId, base: hpBase } = createIntegrantBase("Hit Points");
		integrants[hpId] = {
			...hpBase,
			hitpointType: "Maximum",
			isFixed: false,
			isTemp: false,
			calculation: "Set Value",
			name: "",
			valueFormula: { flatValue: hpMax },
		};
		store.hitpoints.currentHP = hpMax;
		if (attrMap["npc_hpformula"]) store.npc.rollHP = String(attrMap["npc_hpformula"]).replace(/\s/g, "");

		// Armor Class
		const ac = parseInt(attrMap["npc_ac"] || attrMap["ac"] || "10", 10);
		const { id: acId, base: acBase } = createIntegrantBase("Armor Class");
		integrants[acId] = {
			...acBase,
			defaultAbility: false,
			calculation: "Set Base",
			name: "",
			valueFormula: { flatValue: ac },
		};

		// NPC Type, Size, Alignment
		const npcTypeStr = attrMap["npc_type"] || "";
		const { size, creatureType, alignment } = parseNpcType(npcTypeStr);
		store.about.characteristics = { size, creatureType, alignment };
		const npcDisplayName = (attrMap["npc_name"] || "").trim();
		if (npcDisplayName) store.about.characteristics.species = npcDisplayName;
		store.character.creatureType = creatureType;

		// Challenge Rating
		const cr = attrMap["npc_challenge"] || "0";
		store.npc.challengeRating = cr;
		const passivePerception = parseInt(
			attrMap["passive"]
			|| attrMap["npc_passive"]
			|| attrMap["passive_wisdom"]
			|| "0",
			10,
		);
		const perceptionBonus = parseInt(attrMap["npc_perception"] || attrMap["perception_bonus"] || "0", 10);
		if (passivePerception > 0) store.npc.passivePerceptionOverride = passivePerception;
		else if (!Number.isNaN(perceptionBonus)) store.npc.passivePerceptionOverride = 10 + perceptionBonus;
		store.npc.gear = store.npc.gear || "Any";
		store.npc.habitat = store.npc.habitat || "Any";
		store.npc.treasure = store.npc.treasure || "Any";

		// Speeds
		const speedStr = attrMap["npc_speed"] || "30 ft.";
		const speeds = parseSpeeds(speedStr);
		for (const speed of speeds) {
			const { id, base } = createIntegrantBase("Speed");
			integrants[id] = {
				...base,
				name: speed.type,
				speed: speed.type,
				calculation: "Set Base",
				valueFormula: { flatValue: speed.value },
			};
		}

		// Senses
		const sensesStr = attrMap["npc_senses"] || "";
		const senses = parseSenses(sensesStr);
		for (const sense of senses) {
			const { id, base } = createIntegrantBase("Sense");
			integrants[id] = {
				...base,
				name: sense.type,
				calculation: "Set Base",
				valueFormula: { flatValue: sense.value },
			};
		}

		// Saving Throws
		const saveAbilityMap = {
			str: "Strength",
			dex: "Dexterity",
			con: "Constitution",
			int: "Intelligence",
			wis: "Wisdom",
			cha: "Charisma",
		};
		Object.entries(saveAbilityMap).forEach(([key, abilityName]) => {
			const saveVal = attrMap[`npc_${key}_save`];
			const saveFlag = attrMap[`npc_${key}_save_flag`];
			if (saveVal === undefined && `${saveFlag || ""}` !== "1") return;

			const { id, base } = createIntegrantBase("Proficiency");
			integrants[id] = {
				...base,
				name: "Saving Throw Proficiency",
				category: "Saving Throw",
				proficiency: abilityName,
				proficiencyLevel: "Proficient",
				increaseIfAlreadyAt: false,
				rollAbility: "Query Attribute",
				notes: "",
				cascades: {},
				relations: {},
			};
		});

		// Skills
		const skillNameMap = {
			acrobatics: "Acrobatics",
			"animal_handling": "Animal Handling",
			arcana: "Arcana",
			athletics: "Athletics",
			deception: "Deception",
			history: "History",
			insight: "Insight",
			intimidation: "Intimidation",
			investigation: "Investigation",
			medicine: "Medicine",
			nature: "Nature",
			perception: "Perception",
			performance: "Performance",
			persuasion: "Persuasion",
			religion: "Religion",
			"sleight_of_hand": "Sleight of Hand",
			stealth: "Stealth",
			survival: "Survival",
		};
		Object.entries(skillNameMap).forEach(([skillKey, skillName]) => {
			const skillValRaw = attrMap[`npc_${skillKey}`];
			const skillFlagRaw = attrMap[`npc_${skillKey}_flag`];
			const skillVal = parseInt(skillValRaw || "0", 10);
			const skillFlag = parseInt(skillFlagRaw || "0", 10);
			if ((!skillValRaw && !skillFlagRaw) || Number.isNaN(skillVal) || skillFlag <= 0) return;

			const { id, base } = createIntegrantBase("Proficiency");
			integrants[id] = {
				...base,
				name: "Skill Proficiency",
				category: "Skill",
				proficiency: skillName,
				proficiencyLevel: "Proficient",
				increaseIfAlreadyAt: false,
				rollAbility: "Query Attribute",
				notes: "",
				cascades: {},
				relations: {},
			};
		});

		// Languages
		const languagesStr = attrMap["npc_languages"] || "";
		if (languagesStr) {
			const languages = languagesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const lang of languages) {
				const { id, base } = createIntegrantBase("Language");
				integrants[id] = {
					...base,
					name: lang,
				};
			}
		}

		// Defenses - Resistances
		const resistancesStr = attrMap["npc_resistances"] || "";
		if (resistancesStr) {
			const resistances = resistancesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const res of resistances) {
				const { id, base } = createIntegrantBase("Defense");
				integrants[id] = {
					...base,
					name: res,
					defense: "Resistance",
					damageType: res.charAt(0).toUpperCase() + res.slice(1).toLowerCase(),
				};
			}
		}

		// Defenses - Immunities
		const immunitiesStr = attrMap["npc_immunities"] || "";
		if (immunitiesStr) {
			const immunities = immunitiesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const imm of immunities) {
				const { id, base } = createIntegrantBase("Defense");
				integrants[id] = {
					...base,
					name: imm,
					defense: "Immunity",
					damageType: imm.charAt(0).toUpperCase() + imm.slice(1).toLowerCase(),
				};
			}
		}

		// Defenses - Vulnerabilities
		const vulnerabilitiesStr = attrMap["npc_vulnerabilities"] || "";
		if (vulnerabilitiesStr) {
			const vulnerabilities = vulnerabilitiesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const vuln of vulnerabilities) {
				const { id, base } = createIntegrantBase("Defense");
				integrants[id] = {
					...base,
					name: vuln,
					defense: "Vulnerability",
					damageType: vuln.charAt(0).toUpperCase() + vuln.slice(1).toLowerCase(),
				};
			}
		}

		// Condition Immunities
		const conditionImmunitiesStr = attrMap["npc_condition_immunities"] || "";
		if (conditionImmunitiesStr) {
			const conditions = conditionImmunitiesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const cond of conditions) {
				const { id, base } = createIntegrantBase("Defense");
				integrants[id] = {
					...base,
					name: cond,
					defense: "Condition Immunity",
					conditionType: cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase(),
				};
			}
		}

		// Traits (as Features)
		const traitDisplayOrder = [];
		for (const [traitId, trait] of Object.entries(repeatingTraits)) {
			if (!trait.name) continue;
			const { id, base } = createIntegrantBase("Features");
			integrants[id] = {
				...base,
				name: trait.name,
				description: trait.description || trait.desc || "",
				source: "Species",
				cascades: {},
				relations: {},
			};
			traitDisplayOrder.push(id);
		}
		store.features.speciesTraitsDisplayOrder = JSON.stringify(traitDisplayOrder);

		// Actions/Attacks
		const actionDisplayOrder = [];
		const attackDisplayOrder = [];

		for (const [actionId, action] of Object.entries(repeatingActions)) {
			if (!action.name) continue;

			const isAttack = action.attack_flag === "on" || action.attack_tohit;

			if (isAttack) {
				const { id: attackIntId, base: attackBase } = createIntegrantBase("Attack");

				const attackTypeStr = (action.attack_type || "").toLowerCase();
				const isMelee = attackTypeStr.includes("melee") || !attackTypeStr.includes("ranged");

				let abilityBonus = isMelee ? "Strength" : "Dexterity";

				const damageIds = [];

				const primaryDamage = parseDamage(action.attack_damage || "");
				if (primaryDamage) {
					const { id: dmgId, base: dmgBase } = createIntegrantBase("Damage");
					integrants[dmgId] = {
						...dmgBase,
						name: `${action.name} Damage`,
						damageType: (action.attack_damagetype || "Slashing").charAt(0).toUpperCase() + (action.attack_damagetype || "slashing").slice(1).toLowerCase(),
						diceSize: primaryDamage.diceSize,
						diceCount: primaryDamage.diceCount,
						_bonus: primaryDamage.bonus,
						ability: "",
						parentID: attackIntId,
					};
					damageIds.push(dmgId);
				}

				const secondaryDamage = parseDamage(action.attack_damage2 || "");
				if (secondaryDamage) {
					const { id: dmgId2, base: dmgBase2 } = createIntegrantBase("Damage");
					integrants[dmgId2] = {
						...dmgBase2,
						name: `${action.name} Damage 2`,
						damageType: (action.attack_damagetype2 || "").charAt(0).toUpperCase() + (action.attack_damagetype2 || "fire").slice(1).toLowerCase(),
						diceSize: secondaryDamage.diceSize,
						diceCount: secondaryDamage.diceCount,
						_bonus: secondaryDamage.bonus,
						ability: "",
						parentID: attackIntId,
					};
					damageIds.push(dmgId2);
				}

				integrants[attackIntId] = {
					...attackBase,
					name: action.name,
					actionType: "Action",
					description: action.description || "",
					attack: {
						abilityBonus,
						proficiencyLevel: "Proficient",
						type: isMelee ? "Melee" : "Ranged",
					},
					childIDs: JSON.stringify(damageIds),
				};

				attackDisplayOrder.push(attackIntId);
			} else {
				const { id: actionIntId, base: actionBase } = createIntegrantBase("Action");
				integrants[actionIntId] = {
					...actionBase,
					name: action.name,
					actionType: "Action",
					description: action.description || "",
				};
				actionDisplayOrder.push(actionIntId);
			}
		}

		// Legendary Actions
		const legendaryActionDisplayOrder = [];
		const legendaryCount = attrMap["npc_legendary_actions"] || "3";
		store.npc.legendaryActionCount = parseInt(legendaryCount, 10);

		for (const [legId, legendary] of Object.entries(repeatingLegendary)) {
			if (!legendary.name) continue;
			const { id, base } = createIntegrantBase("Action");
			integrants[id] = {
				...base,
				name: legendary.name,
				actionType: "Legendary",
				description: legendary.description || legendary.desc || "",
			};
			legendaryActionDisplayOrder.push(id);
		}

		// Mythic Actions
		const mythicActionDisplayOrder = [];
		for (const [mythId, mythic] of Object.entries(repeatingMythic)) {
			if (!mythic.name) continue;
			const { id, base } = createIntegrantBase("Action");
			integrants[id] = {
				...base,
				name: mythic.name,
				actionType: "Mythic",
				description: mythic.description || mythic.desc || "",
			};
			mythicActionDisplayOrder.push(id);
		}

		// Reactions
		const reactionDisplayOrder = [];
		for (const [reactId, reaction] of Object.entries(repeatingReactions)) {
			if (!reaction.name) continue;
			const { id, base } = createIntegrantBase("Action");
			integrants[id] = {
				...base,
				name: reaction.name,
				actionType: "Reaction",
				description: reaction.description || reaction.desc || "",
			};
			reactionDisplayOrder.push(id);
		}

		// Spells
		const spellDisplayOrder = [[], [], [], [], [], [], [], [], [], []];

		for (const [spellKey, spell] of Object.entries(repeatingSpells)) {
			if (!spell.spellname) continue;

			let levelIdx = 0;
			if (spell.level === "cantrip") {
				levelIdx = 0;
			} else {
				levelIdx = parseInt(spell.level, 10) || 0;
			}
			if (levelIdx > 9) levelIdx = 9;

			const { id, base } = createIntegrantBase("Spell");
			integrants[id] = {
				...base,
				_prepared: true,
				name: spell.spellname,
				level: levelIdx,
				school: spell.spellschool || "Evocation",
				castingTime: spell.spellcastingtime || "Action",
				range: spell.spellrange || "Self",
				components: spell.spellcomp || "V, S",
				duration: spell.spellduration || "Instantaneous",
				description: spell.spelldescription || "",
			};
			spellDisplayOrder[levelIdx].push(id);
		}

		// Update display orders
		store.actions.actionDisplayOrder = JSON.stringify(actionDisplayOrder);
		store.actions.reactionDisplayOrder = JSON.stringify(reactionDisplayOrder);
		store.actions.legendaryActionDisplayOrder = JSON.stringify(legendaryActionDisplayOrder);
		store.actions.mythicActionDisplayOrder = JSON.stringify(mythicActionDisplayOrder);
		store.attacks.attackDisplayOrder = JSON.stringify(attackDisplayOrder);
		store.spells.displayOrder = spellDisplayOrder.map(arr => JSON.stringify(arr));
		store.spells.generalSpellSettings = store.spells.generalSpellSettings || {};
		store.spells.generalSpellSettings.showPreparedBar = Object.values(repeatingSpells).some(sp => sp.spellname);

		// Debug: log final store
		return store;
	};

	const IS_2024_SHEET = new Set(["dnd_2024", "DnD2024_Character_Sheet", "dnd2024", "dnd2024byroll20"]);

	/**
	 * Check if we should use 2024 sheet format
	 */
	d20plus.importer.shouldUse2024 = function() {
		return IS_2024_SHEET.has(d20plus.cfg.getOrDefault("import", "importSheetFormat"));
	};

	d20plus.importer.is2024Sheet = function(sheetName) {
		return IS_2024_SHEET.has(sheetName);
	};

	// ========================================
	// 2024 Sheet Monster Import Support
	// ========================================

	/**
	 * Parse speed object into array of {type, value} objects
	 */
	function parse2024MonsterSpeeds(speedObj) {
		if (!speedObj) return [{ type: "Walk", value: 30 }];

		const speeds = [];
		const typeMap = {
			"walk": "Walk",
			"fly": "Fly",
			"swim": "Swim",
			"climb": "Climb",
			"burrow": "Burrow",
		};

		for (const [key, val] of Object.entries(speedObj)) {
			if (key === "canHover") continue;
			const type = typeMap[key] || "Walk";
			const value = typeof val === "number" ? val : (val.number || 30);
			speeds.push({ type, value });
		}

		return speeds.length > 0 ? speeds : [{ type: "Walk", value: 30 }];
	}

	/**
	 * Parse senses array into array of {type, value} objects
	 */
	function parse2024MonsterSenses(sensesArr) {
		if (!sensesArr || !Array.isArray(sensesArr)) return [];

		const senses = [];
		const validSenses = ["darkvision", "blindsight", "tremorsense", "truesight"];

		for (const sense of sensesArr) {
			if (typeof sense !== "string") continue;
			const match = sense.match(/(\w+)\s+(\d+)/i);
			if (match) {
				const senseType = match[1].toLowerCase();
				const senseValue = parseInt(match[2], 10);
				if (validSenses.includes(senseType) && senseValue > 0) {
					senses.push({
						type: senseType.charAt(0).toUpperCase() + senseType.slice(1),
						value: senseValue,
					});
				}
			}
		}

		return senses;
	}

	/**
	 * Parse damage/dice string into components
	 */
	function parse2024MonsterDamage(damageStr) {
		if (!damageStr) return null;
		const match = damageStr.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i);
		if (match) {
			const bonus = match[4] ? parseInt(match[4], 10) : 0;
			return {
				diceCount: parseInt(match[1], 10),
				diceSize: "d" + match[2],
				bonus: match[3] === "-" ? -bonus : bonus,
			};
		}
		return null;
	}

	/**
	 * Extract attack info from action entries
	 */
	function extractMonsterAttackInfo(entries) {
		const result = {
			isAttack: false,
			attackType: "Melee",
			toHit: 0,
			damages: [],
			reach: 5,
			reachText: "5 ft.",
			range: "",
		};

		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;

			// Attack tag — handles {@atk mw} (2014) and {@atkr m} (2024)
			const atkMatch = entry.match(/\{@atkr?\s+([^}]+)\}/i);
			if (atkMatch) {
				result.isAttack = true;
				const tag = atkMatch[1].toLowerCase().replace(/\s/g, "");
				const isSpell  = tag.includes("s");
				const isMelee  = tag.includes("m");
				const isRanged = tag.includes("r");
				if      (isSpell)              result.attackType = "Spell Attack";
				else if (isRanged && !isMelee) result.attackType = "Ranged";
				else                           result.attackType = "Melee";
			}

			// To-hit: {@hit N} (2024) or literal +N to hit (2014)
			const hitTagMatch = entry.match(/\{@hit\s+(\d+)\}/i);
			if (hitTagMatch) result.toHit = parseInt(hitTagMatch[1], 10);
			else {
				const toHitMatch = entry.match(/\+(\d+)\s+to hit/i);
				if (toHitMatch) result.toHit = parseInt(toHitMatch[1], 10);
			}

			// Reach: "reach N ft."
			const reachMatch = entry.match(/reach\s+(\d+)\s*ft/i);
			if (reachMatch) {
				result.reach = parseInt(reachMatch[1], 10);
				result.reachText = `${result.reach} ft.`;
			}

			// Range: "range N/N ft." or "range N ft."
			const rangeMatch = entry.match(/range\s+(\d+)(?:\/(\d+))?\s*ft/i);
			if (rangeMatch) {
				result.range = rangeMatch[2]
					? `${rangeMatch[1]}/${rangeMatch[2]} ft.`
					: `${rangeMatch[1]} ft.`;
			}

			// Damages: {@damage XdY+Z} tags in the hit section (after {@h})
			const hitSection = entry.split(/\{@h\}/i)[1];
			if (hitSection) {
				const dmgPattern = /\{@damage\s+([^}]+)\}\)\s*(\w+)\s*damage/gi;
				let m;
				while ((m = dmgPattern.exec(hitSection)) !== null) {
					const parsed = parse2024MonsterDamage(m[1]);
					if (parsed) result.damages.push({
						...parsed,
						damageType: m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase(),
					});
				}
			}
		}

		return result;
	}

	/**
	 * Build 2024 store from 5etools monster data
	 */
	d20plus.monsters.build2024Store = function(data, renderer) {
		const store = {
			integrants: { integrants: {} },
			actions: {
				actionDisplayOrder: "[]",
				bonusActionDisplayOrder: "[]",
				freeActionDisplayOrder: "[]",
				reactionDisplayOrder: "[]",
				legendaryActionDisplayOrder: "[]",
				mythicActionDisplayOrder: "[]",
			},
			attacks: { attackDisplayOrder: "[]" },
			spells: {
				displayOrder: { "0": "[]", "1": "[]", "2": "[]", "3": "[]", "4": "[]", "5": "[]", "6": "[]", "7": "[]", "8": "[]", "9": "[]" },
				generalSpellSettings: { defaultToFullscreen: false, showPreparedBar: false, showPreparedSpellsOnly: false, spellcastings: "$__$[]", useSlotDefault: true, useSlotAlwaysPrepared: false },
			},
			npc: {},
			about: { characteristics: {}, aboutTabApperancesDisplayOrder: "[]", aboutTabCharacteristicsDisplayOrder: "[]", aboutItems: {} },
			character: {},
			features: { classFeatureDisplayOrder: "[]", speciesTraitsDisplayOrder: "[]", featsDisplayOrder: "[]", otherDisplayOrder: "[]" },
			background: { aboutTabBackgroundDisplayOrder: "[]" },
			effects: { effectDisplayOrder: "[]" },
			inventory: { incrementalQuantityEditing: true, equipmentDisplayOrder: "[]", otherPossessionsDisplayOrder: "[]" },
			notes: { order: {}, emptyCategories: "[]", notes: {} },
			settings: { layoutState: "Stat Block", newRules: true, rolls: { advancedMode: "Normal", mode: "Automatic", privacy: "gm" } },
			hitpoints: { deathSaves: { failures: 0, open: false, successes: 0 }, tempHP: 0 },
			npcEdit: {},
			proficiencies: {},
		};

		let arrayPosition = 100;
		const integrants = store.integrants.integrants;

		const createIntegrantBase = (type) => {
			const id = generate2024Id();
			return {
				id,
				base: {
					_enabled: true,
					_label: "",
					type,
					childIDs: "[]",
					parentID: "",
					parentDisabled: false,
					overwriteDisabled: false,
					builderDisplayName: "",
					createdTime: Date.now(),
					arrayPosition: arrayPosition++,
					shortID: id.substring(0, 9),
					source: "",
				},
			};
		};

		// Ability Scores
		const abilities = [
			{ key: "str", name: "Strength" },
			{ key: "dex", name: "Dexterity" },
			{ key: "con", name: "Constitution" },
			{ key: "int", name: "Intelligence" },
			{ key: "wis", name: "Wisdom" },
			{ key: "cha", name: "Charisma" },
		];

		for (const ability of abilities) {
			const value = data[ability.key] || 10;
			const { id, base } = createIntegrantBase("Ability Score");
			integrants[id] = {
				...base,
				ability: ability.name,
				calculation: "Set Base",
				name: "",
				valueFormula: { flatValue: value },
			};
		}

		// Hit Points
		const hp = data.hp?.average ?? data.hp?.special ?? 10;
		const { id: hpId, base: hpBase } = createIntegrantBase("Hit Points");
		integrants[hpId] = {
			...hpBase,
			hitpointType: "Maximum",
			isFixed: false,
			isTemp: false,
			calculation: "Set Value",
			name: "",
			valueFormula: { flatValue: typeof hp === "number" ? hp : parseInt(hp, 10) || 10 },
		};
		store.hitpoints.currentHP = typeof hp === "number" ? hp : parseInt(hp, 10) || 10;

		// Armor Class
		const parsedAc = typeof data.ac === "string" ? data.ac : Parser.acToFull(data.ac);
		const acMatch = String(parsedAc).match(/^\d+/);
		const ac = acMatch ? parseInt(acMatch[0], 10) : 10;
		const { id: acId, base: acBase } = createIntegrantBase("Armor Class");
		integrants[acId] = {
			...acBase,
			defaultAbility: false,
			calculation: "Set Base",
			name: "",
			valueFormula: { flatValue: ac },
		};

		// Size, Type, Alignment
		const size = d20plus.monsters.getSizeString(data.size || "");
		const pType = Parser.monTypeToFullObj(data.type);
		const creatureType = pType.asText || "Unknown";
		const alignment = data.alignment ? Parser.alignmentListToFull(data.alignment) : "Unaligned";

		store.about.characteristics = {
			size: size,
			creatureType: creatureType.charAt(0).toUpperCase() + creatureType.slice(1).toLowerCase(),
			alignment: alignment.charAt(0).toUpperCase() + alignment.slice(1).toLowerCase(),
		};
		store.character.creatureType = creatureType;

		// Challenge Rating, HP formula, habitat, treasure
		const cr = data.cr ? (data.cr.cr || data.cr) : "0";
		store.npc.challengeRating = String(cr);
		store.npc.acNotes = "";
		store.npc.gear = "";
		if (data.hp && data.hp.formula) store.npc.rollHP = data.hp.formula.replace(/\s/g, "");
		if (data.environment && data.environment.length) {
			store.npc.habitat = data.environment.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(", ");
		}
		if (data.treasure && data.treasure.length) {
			store.npc.treasure = data.treasure.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
		}
		// initiativeModOverride = DEX mod + PB × initiative.proficiency
		// (the value is the total bonus, not a score — the sheet adds 10 for the static display)
		if (data.dex !== undefined) {
			const dexMod = Math.floor((data.dex - 10) / 2);
			const pb = Parser.crToPb ? Parser.crToPb(cr) : 2;
			const initProf = (data.initiative && data.initiative.proficiency) ? data.initiative.proficiency : 0;
			store.npc.initiativeModOverride = dexMod + pb * initProf;
		}
		// Custom XP from CR (with lair bonus if present)
		const regularXP = Parser.crToXpNumber(cr);
		if (regularXP) {
			const lairXP = data.cr && data.cr.xpLair;
			store.npc.customXP = lairXP
				? `${Number(regularXP).toLocaleString()}, or ${Number(lairXP).toLocaleString()} in lair`
				: String(regularXP);
		}

		// Speeds
		const speeds = parse2024MonsterSpeeds(data.speed);
		for (const speed of speeds) {
			const { id, base } = createIntegrantBase("Speed");
			integrants[id] = {
				...base,
				name: speed.type,
				speed: speed.type,
				calculation: "Set Base",
				valueFormula: { flatValue: speed.value },
			};
		}

		// Senses
		const sensesArr = data.senses instanceof Array ? data.senses : (data.senses ? [data.senses] : []);
		const senses = parse2024MonsterSenses(sensesArr);
		for (const sense of senses) {
			if (!sense.value) continue;
			const { id, base } = createIntegrantBase("Sense");
			integrants[id] = {
				...base,
				name: sense.type,
				calculation: "Set Base",
				valueFormula: { flatValue: sense.value },
			};
		}

		// Languages
		const languages = data.languages instanceof Array ? data.languages :
			(data.languages ? data.languages.split(",").map(s => s.trim()) : []);
		for (const lang of languages) {
			if (!lang) continue;
			const { id, base } = createIntegrantBase("Language");
			integrants[id] = {
				...base,
				name: lang,
			};
		}

		// Saving Throws
		const saveAbilityMap = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
		for (const [key] of Object.entries(data.save || {})) {
			const abilityName = saveAbilityMap[key.toLowerCase()];
			if (!abilityName) continue;
			const { id, base } = createIntegrantBase("Proficiency");
			integrants[id] = {
				...base,
				name: "Saving Throw Proficiency",
				category: "Saving Throw",
				proficiency: abilityName,
				proficiencyLevel: "Proficient",
				increaseIfAlreadyAt: false,
				rollAbility: "Query Attribute",
				notes: "",
				cascades: {},
				relations: {},
			};
		}

		// Skills
		const skillAbilityMap = {
			athletics: "str",
			acrobatics: "dex", "sleight of hand": "dex", stealth: "dex",
			arcana: "int", history: "int", investigation: "int", nature: "int", religion: "int",
			"animal handling": "wis", insight: "wis", medicine: "wis", perception: "wis", survival: "wis",
			deception: "cha", intimidation: "cha", performance: "cha", persuasion: "cha",
		};
		const crNum = parseFloat(String(cr).replace(/\//g, ".")) || 0;
		const profBonus = crNum < 5 ? 2 : crNum < 9 ? 3 : crNum < 13 ? 4 : crNum < 17 ? 5 : crNum < 21 ? 6 : crNum < 25 ? 7 : crNum < 29 ? 8 : 9;
		for (const [skill, bonusStr] of Object.entries(data.skill || {})) {
			const skillLower = skill.toLowerCase();
			const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
			const abilityKey = skillAbilityMap[skillLower] || "wis";
			const abilityScore = data[abilityKey] || 10;
			const abilityMod = Math.floor((abilityScore - 10) / 2);
			const bonusNum = parseInt(bonusStr, 10) || 0;
			const proficiencyLevel = bonusNum >= abilityMod + profBonus * 2 ? "Expertise" : "Proficient";
			const { id, base } = createIntegrantBase("Proficiency");
			integrants[id] = {
				...base,
				name: "Skill Proficiency",
				category: "Skill",
				proficiency: skillName,
				proficiencyLevel,
				increaseIfAlreadyAt: false,
				rollAbility: "Query Attribute",
				notes: "",
				cascades: {},
				relations: {},
			};
		}

		// Defenses — field is "damage" for damage types, "condition" for conditions (matching native sheet)
		const makeDefense = (defense, value) => {
			const cap = v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
			const { id, base } = createIntegrantBase("Defense");
			integrants[id] = { ...base, name: `${defense}: ${cap(value)}`, defense, damage: cap(value), cascades: {}, relations: {} };
		};

		if (data.resist) {
			const resistances = d20plus.importer.getCleanText(Parser.getFullImmRes(data.resist));
			if (resistances) resistances.split(",").map(s => s.trim()).filter(s => s).forEach(r => makeDefense("Resistance", r));
		}
		if (data.immune) {
			const immunities = d20plus.importer.getCleanText(Parser.getFullImmRes(data.immune));
			if (immunities) immunities.split(",").map(s => s.trim()).filter(s => s).forEach(i => makeDefense("Immunity", i));
		}
		if (data.vulnerable) {
			const vulnerabilities = d20plus.importer.getCleanText(Parser.getFullImmRes(data.vulnerable));
			if (vulnerabilities) vulnerabilities.split(",").map(s => s.trim()).filter(s => s).forEach(v => makeDefense("Vulnerability", v));
		}
		if (data.conditionImmune) {
			const conditions = d20plus.importer.getCleanText(Parser.getFullCondImm(data.conditionImmune));
			if (conditions) {
				for (const cond of conditions.split(",").map(s => s.trim()).filter(s => s)) {
					const cap = v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
					const { id, base } = createIntegrantBase("Defense");
					integrants[id] = { ...base, name: `Condition Immunity: ${cap(cond)}`, defense: "Condition Immunity", condition: cap(cond), cascades: {}, relations: {} };
				}
			}
		}

		// Traits (Features) — add to speciesTraitsDisplayOrder so they appear in the Traits section
		const traitDisplayOrder = [];
		if (data.trait) {
			for (const trait of data.trait) {
				const name = d20plus.importer.getCleanText(renderer.render(trait.name));
				const text = d20plus.importer.getCleanText(renderer.render({ entries: trait.entries }, 1));
				const { id, base } = createIntegrantBase("Features");
				integrants[id] = {
					...base,
					name: name,
					description: text,
					source: "Species",
					cascades: {},
					relations: {},
				};
				traitDisplayOrder.push(id);
			}
		}
		store.features.speciesTraitsDisplayOrder = JSON.stringify(traitDisplayOrder);

		// Actions
		const actionDisplayOrder = [];
		const attackDisplayOrder = [];

		// Spellcasting — render as an Action integrant with the full spellcasting description
		if (data.spellcasting && data.spellcasting.length > 0) {
			for (const sc of data.spellcasting) {
				const scName = d20plus.importer.getCleanText(renderer.render(sc.name || "Spellcasting"));
				const scText = d20plus.importer.getCleanText(renderer.render({ type: "spellcasting", ...sc }, 1));
				const { id, base } = createIntegrantBase("Action");
				integrants[id] = {
					...base,
					name: scName,
					actionType: sc.displayAs === "bonus" ? "Bonus Action" : sc.displayAs === "reaction" ? "Reaction" : "Action",
					description: scText,
					excludeFamilialResources: false,
					cascades: {},
					relations: {},
				};
				actionDisplayOrder.push(id);
			}
		}

		// Helper: build Attack + Damage integrants for any action category that has an attack roll
		const buildAttackIntegrants = (actionData, actionType, displayOrder) => {
			const name = d20plus.importer.getCleanText(renderer.render(actionData.name));
			const text = d20plus.importer.getCleanText(renderer.render({ entries: actionData.entries }, 1));
			const attackInfo = extractMonsterAttackInfo(actionData.entries);

			if (attackInfo.isAttack && attackInfo.damages.length > 0) {
				const { id: attackIntId, base: attackBase } = createIntegrantBase("Attack");
				const damageIds = [];

				for (let i = 0; i < attackInfo.damages.length; i++) {
					const dmg = attackInfo.damages[i];
					const { id: dmgId, base: dmgBase } = createIntegrantBase("Damage");
					integrants[dmgId] = {
						...dmgBase,
						name: i === 0 ? `${name} Damage` : `${name} Damage ${i + 1}`,
						damageType: dmg.damageType,
						diceCount: dmg.diceCount,
						diceSize: dmg.diceSize,
						_bonus: dmg.bonus,
						ability: "none",
						overrideCrit: false,
						critDiceSize: "",
						parentID: attackIntId,
						childIDs: "[]",
						cascades: {},
						relations: {},
					};
					damageIds.push(dmgId);
				}

				integrants[attackIntId] = {
					...attackBase,
					name: name,
					actionType,
					description: text,
					attack: {
						type: attackInfo.attackType,
						proficiencyLevel: "Proficient",
					},
					_reach: attackInfo.attackType === "Melee",
					_reachText: "",
					range: attackInfo.range,
					childIDs: JSON.stringify(damageIds),
					parentID: "",
					cascades: {},
					relations: {},
				};
				attackDisplayOrder.push(attackIntId);
			} else {
				const { id, base } = createIntegrantBase("Action");
				integrants[id] = {
					...base,
					name: name,
					actionType,
					description: text,
					excludeFamilialResources: false,
					cascades: {},
					relations: {},
				};
				displayOrder.push(id);
			}
		};

		if (data.action) {
			for (const action of data.action) buildAttackIntegrants(action, "Action", actionDisplayOrder);
		}

		// Bonus Actions
		const bonusActionDisplayOrder = [];
		if (data.bonus) {
			for (const bonus of data.bonus) buildAttackIntegrants(bonus, "Bonus Action", bonusActionDisplayOrder);
		}

		// Reactions
		const reactionDisplayOrder = [];
		if (data.reaction) {
			for (const reaction of data.reaction) buildAttackIntegrants(reaction, "Reaction", reactionDisplayOrder);
		}

		// Legendary Actions
		const legendaryActionDisplayOrder = [];
		if (data.legendary) {
			const legendaryCount = data.legendaryActions || 3;
			store.npc.legendaryActionCount = legendaryCount;
			for (const legendary of data.legendary) buildAttackIntegrants(legendary, "Legendary", legendaryActionDisplayOrder);
		}

		// Mythic Actions
		const mythicActionDisplayOrder = [];
		if (data.mythic) {
			for (const mythic of data.mythic) buildAttackIntegrants(mythic, "Mythic", mythicActionDisplayOrder);
		}

		// Leave all display orders as "[]" — the 2024 sheet auto-discovers integrants
		// by type/actionType in stat block mode (matches native compendium behaviour).
		// Explicitly populating them causes the sheet to use a lookup that fails to
		// match integrants by shortID, so bonus/reaction actions don't appear.

		return store;
	};

	/**
	 * Check if we should use 2024 sheet format for monster import
	 */
	d20plus.monsters.shouldUse2024 = function() {
		return IS_2024_SHEET.has(d20plus.cfg.getOrDefault("import", "importSheetFormat"));
	};

	/**
	 * After build2024Store saves the monster, asynchronously load each spell listed
	 * in the spellcasting block and call import2024Spell for each one sequentially.
	 */
	d20plus.monsters.import2024Spells = function (charModel, monsterData) {
		if (!monsterData.spellcasting || !monsterData.spellcasting.length) return;

		// All slot key names that can contain spell references
		const SLOT_KEYS = ["constant", "will", "rest", "restLong", "restShort", "daily", "weekly"];

		function extractSpellRefs (sc) {
			const refs = [];
			SLOT_KEYS.forEach(k => {
				if (!sc[k]) return;
				Object.values(sc[k]).forEach(spOrArr => {
					(Array.isArray(spOrArr) ? spOrArr : [spOrArr]).forEach(sp => refs.push(sp));
				});
			});
			if (sc.spells) {
				Object.values(sc.spells).forEach(lvlData => {
					(lvlData.spells || []).forEach(sp => refs.push(sp));
				});
			}
			return refs;
		}

		function parseSpellTag (sp) {
			if (typeof sp !== "string") return null;
			const m = sp.match(/\{@spell ([^|}]+?)(?:\|([^}]+?))?\}/i);
			if (!m) return null;
			return {name: m[1].trim(), source: (m[2] || "PHB").trim()};
		}

		// Collect all unique spells to fetch
		const toLoad = [];
		const seen = new Set();
		monsterData.spellcasting.forEach(sc => {
			extractSpellRefs(sc).forEach(sp => {
				const parsed = parseSpellTag(sp);
				if (!parsed) return;
				const key = `${parsed.name.toLowerCase()}|${parsed.source.toLowerCase()}`;
				if (seen.has(key)) return;
				seen.add(key);
				toLoad.push(parsed);
			});
		});

		if (!toLoad.length) return;

		setTimeout(() => {
			Promise.all(toLoad.map(({name, source}) => {
				const urlKey = Object.keys(spellDataUrls).find(src => src.toLowerCase() === source.toLowerCase());
				if (!urlKey) {
					console.warn(`betterR20: No spell data URL for source "${source}" (${name})`);
					return null;
				}
				const url = d20plus.spells.formSpellUrl(spellDataUrls[urlKey]);
				return DataUtil.loadJSON(url).then(spellFile => {
					const spell = spellFile.spell.find(s => s.name.toLowerCase() === name.toLowerCase());
					if (!spell) {
						console.warn(`betterR20: Spell "${name}" not found in ${source}`);
						return null;
					}
					const [, gmnotes] = d20plus.spells._getHandoutData(spell);
					return JSON.parse(gmnotes);
				}).catch(err => {
					console.warn(`betterR20: Error fetching spell "${name}" from ${source}:`, err);
					return null;
				});
			})).then(spellDataList => {
				const {attr: storeAttr, store: rawStore} = get2024Store(charModel);
				const store = rawStore ? JSON.parse(JSON.stringify(rawStore)) : {
					integrants: {integrants: {}},
					spells: {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]},
				};

				// Build Class + Spellcasting config integrants — one pair per spellcasting block.
				// The 2024 sheet derives the dropdown label from the Class integrant's name + ability,
				// e.g. "Adult Gold Dragon (CHA)" or "Arch-hag (INT)".
				const abilityMap = {str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
				const monsterName = monsterData._displayName || monsterData.name;
				const configIds = [];
				const classIds = [];

				// spellSourceMap: spellNameLower → {configId, classId} for correct per-block linking
				const spellSourceMap = {};

				monsterData.spellcasting.forEach(sc => {
					const scName = sc.name || "Spellcasting";
					const ability = abilityMap[(sc.ability || "").toLowerCase()] || "Intelligence";

					let scPos = getNextArrayPos(store);
					const {id: classId, base: classBase} = make2024IntegrantBase("Class", scPos++);
					const {id: configId, base: configBase} = make2024IntegrantBase("Spellcasting", scPos++);

					store.integrants.integrants[classId] = {
						...classBase,
						name: monsterName,
						_label: monsterName,
						parentID: "",
						childIDs: JSON.stringify([configId]),
						cascades: {},
						relations: {},
					};
					store.integrants.integrants[configId] = {
						...configBase,
						name: scName,
						ability,
						casterType: "other",
						overviewDisplay: true,
						parentID: classId,
						sourceID: classId,
						childIDs: "[]",
						cascades: {},
						relations: {},
					};
					classIds.push(classId);
					configIds.push(configId);

					// Map each spell in this block to its config so multi-ability monsters link correctly
					extractSpellRefs(sc).forEach(sp => {
						const parsed = parseSpellTag(sp);
						if (parsed && !spellSourceMap[parsed.name.toLowerCase()]) {
							spellSourceMap[parsed.name.toLowerCase()] = {configId, classId};
						}
					});
				});

				// Batch-add all spell integrant chains
				for (const spellData of spellDataList) {
					if (spellData) d20plus.importer.import2024Spell(charModel, spellData, store);
				}

				// Wire up each Spell integrant to its block's Class (dropdown source) and
				// each spell Attack integrant to its block's Spellcasting config (DC/to-hit).
				Object.entries(store.integrants.integrants).forEach(([id, integrant]) => {
					if (integrant.type === "Spell") {
						const mapping = spellSourceMap[integrant.name.toLowerCase()];
						integrant.sourceID = mapping ? mapping.classId : (classIds[0] || "");
					} else if (integrant.type === "Attack" && integrant.attack) {
						const t = integrant.attack.type;
						if (t !== "Spell Save" && t !== "Spell Attack") return;
						const parentSpell = store.integrants.integrants[integrant.parentID];
						const mapping = parentSpell ? spellSourceMap[parentSpell.name.toLowerCase()] : null;
						const targetConfigId = mapping ? mapping.configId : (configIds[0] || null);
						if (!targetConfigId) return;
						const targetConfig = store.integrants.integrants[targetConfigId];
						if (!targetConfig) return;
						integrant.relations = integrant.relations || {};
						integrant.relations[targetConfigId] = "uses";
						targetConfig.relations[id] = "usedBy";
					}
				});

				save2024Store(charModel, storeAttr, store);
			});
		}, 500);
	};

	// ========================================
	// 2024 Drag-Drop Import Support
	// ========================================

	function make2024Id () {
		// Keep IDs short (8 chars) so shortID === full ID — the 2024 sheet indexes by shortID
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let id = "";
		for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
		return id;
	}

	function make2024IntegrantBase (type, arrayPosition) {
		const id = make2024Id();
		return {
			id,
			base: {
				_enabled: true,
				_label: "",
				type,
				childIDs: "[]",
				parentID: "",
				parentDisabled: false,
				overwriteDisabled: false,
				builderDisplayName: "",
				createdTime: Date.now(),
				arrayPosition: arrayPosition !== undefined ? arrayPosition : 0,
				shortID: id, // must equal the full ID — sheet indexes by shortID
				source: "",
			},
		};
	}

	// Returns next safe arrayPosition — one above the current max in the store.
	// All new integrants in the same save MUST use distinct positions to avoid
	// Roll20 deduplicating them when multiple are written at once.
	function getNextArrayPos (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		let max = 0;
		Object.values(ints).forEach(function (i) {
			if ((i.arrayPosition || 0) > max) max = i.arrayPosition;
		});
		return max + 1;
	}

	function get2024Store (charModel) {
		const storeAttr = charModel.attribs.find(a => a.get("name") === "store");
		if (!storeAttr) return {attr: null, store: null};
		let store = storeAttr.get("current");
		if (typeof store === "string") store = JSON.parse(store);
		return {attr: storeAttr, store};
	}

	function save2024Store (charModel, storeAttr, store) {
		const storeClone = JSON.parse(JSON.stringify(store));
		try {
			if (storeAttr) storeAttr.destroy();
			charModel.attribs.push({name: "store", current: storeClone}).syncedSave();
			if (charModel.view && typeof charModel.view.showNewVueFrame === "function") {
				charModel.view.showNewVueFrame();
			}
		} catch (e) {
			console.error("betterR20 save2024Store error:", e);
		}
	}

	// Returns the first {@damage XdY} (with optional flat bonus) found in a 5etools entries array, or null.
	function parseSpell2024Damage (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\{@damage (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\}/i);
			if (m) return {
				diceCount: parseInt(m[1], 10),
				diceSize: "d" + m[2],
				flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
			};
		}
		return null;
	}

	// For spells with multiple damage types, parse each {@damage XdY} tag alongside the
	// damage type keyword(s) that follow it in the text.
	// Handles:
	//   "{@damage 20d6} fire damage"          → "Fire"
	//   "{@damage 5d6} radiant or necrotic"   → "Radiant or Necrotic" (combined, matching native)
	// Returns [{diceCount, diceSize, flatBonus, damageType}] in text order.
	function parseAllSpell2024DamagesTyped (entries, damageInflict) {
		const capWord = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
		const knownTypes = (damageInflict || []).map(t => t.toLowerCase());
		const tagRe = /\{@damage (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\}/gi;

		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;

			// Collect all tag positions first so we can bound each context window
			const tags = [];
			let m;
			while ((m = tagRe.exec(entry)) !== null) {
				tags.push({
					diceCount: parseInt(m[1], 10),
					diceSize: "d" + m[2],
					flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
					tagStart: m.index,
					tagEnd: m.index + m[0].length,
				});
			}
			if (!tags.length) continue;

			// For each tag, look at the text between its end and the next tag's start
			const orTypeRe = knownTypes.length > 1
				? new RegExp(`(${knownTypes.join("|")}) or (${knownTypes.join("|")})`)
				: null;

			const results = tags.map((tag, i) => {
				const contextEnd = i + 1 < tags.length ? tags[i + 1].tagStart : entry.length;
				const context = entry.slice(tag.tagEnd, contextEnd).toLowerCase();
				let damageType;
				const orMatch = orTypeRe && context.match(orTypeRe);
				if (orMatch) {
					damageType = `${capWord(orMatch[1])} or ${capWord(orMatch[2])}`;
				} else {
					const single = knownTypes.find(t => context.includes(t));
					damageType = capWord(single || knownTypes[i] || "");
				}
				return {diceCount: tag.diceCount, diceSize: tag.diceSize, flatBonus: tag.flatBonus, damageType};
			});
			return results;
		}
		return [];
	}

	// Returns {startingLevel, value, stepLevels} from {@scaledamage} tag, or null.
	// Handles both range format (N-M) and comma-separated level list (A,B,C,...).
	function parseSpell2024Upcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				// Comma-separated list: {@scaledamage base|A,B,C,...|XdY}
				// e.g. Spiritual Weapon: {@scaledamage 1d8|2,4,6,8|1d8} → starts at slot 4, every 2 levels
				const mc = entry.match(/\{@scaledamage [^|]+\|(\d+(?:,\d+)+)\|(\d+)d\d+\}/i);
				if (mc) {
					const levels = mc[1].split(",").map(Number);
					const startingLevel = levels[1]; // first slot that actually adds damage
					const stepLevels = levels.length > 1 ? levels[1] - levels[0] : 2;
					return {startingLevel, value: parseInt(mc[2], 10), stepLevels};
				}
				// Range format: {@scaledamage base|N-M|XdY}
				const mr = entry.match(/\{@scaledamage [^|]+\|(\d+)-\d+\|(\d+)d\d+\}/i);
				if (mr) {
					const startingLevel = parseInt(mr[1], 10) + 1;
					const wordNums = {one:1, two:2, three:3, four:4, five:5, six:6};
					const sm = entry.match(/every\s+(one|two|three|four|five|six|\d+)\s+(?:spell\s+)?slot\s+levels?/i);
					const stepLevels = sm ? (wordNums[sm[1].toLowerCase()] || parseInt(sm[1], 10) || 1) : 1;
					return {startingLevel, value: parseInt(mr[2], 10), stepLevels};
				}
			}
		}
		return null;
	}

	// Returns {diceCount, diceSize, bonus} from {@heal XdY} or {@dice XdY + N} in spell entries, or null.
	function parseSpell2024HealDice (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const mh = entry.match(/\{@heal (\d+)d(\d+)\}/i);
			if (mh) return {diceCount: parseInt(mh[1], 10), diceSize: "d" + mh[2], bonus: 0};
			const md = entry.match(/\{@dice (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\}/i);
			if (md) return {
				diceCount: parseInt(md[1], 10),
				diceSize: "d" + md[2],
				bonus: md[3] && md[4] ? (md[3] === "+" ? 1 : -1) * parseInt(md[4], 10) : 0,
			};
		}
		return null;
	}

	// Returns {value, startingLevel, stepLevels, targetBonus} for heal upcasting, or null.
	// targetBonus:true → "$._bonus" (flat HP per slot, e.g. False Life); false → "$.diceCount" (dice per slot, e.g. Cure Wounds).
	function parseSpell2024HealUpcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				// Flat HP per slot: "5 additional (temporary) hit points for each slot level above 1st"
				const mf = entry.match(/(\d+) additional (?:temporary )?hit points? for each (?:spell )?slot level above (\d+)/i);
				if (mf) return {value: parseInt(mf[1], 10), startingLevel: parseInt(mf[2], 10) + 1, stepLevels: 1, targetBonus: true};
			}
		}
		// Fall through to scaledamage for dice-based healing (e.g. Cure Wounds)
		const scaled = parseSpell2024Upcast(entriesHigherLevel);
		if (scaled) return {...scaled, targetBonus: false};
		return null;
	}

	// Returns number of projectiles for auto-hit spells (e.g. 3 for Magic Missile), or null if no projectile word found.
	// Returns null (not 1) when no match so callers can gate isAutoHit on a real projectile being present.
	function parseSpell2024Repeat (entries) {
		const wordNums = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]*\b(?:dart|missile|bolt|beam|ray|orb|needle|lance|streak)s?\b/i);
			if (m) return wordNums[m[1].toLowerCase()] || parseInt(m[1], 10) || 1;
		}
		return null;
	}

	// Returns true if the higher-level text describes adding more projectiles per slot (not more damage dice).
	function parseSpell2024RepeatUpcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				if (/one more|additional|extra/i.test(entry) && /dart|missile|bolt|beam|ray/i.test(entry)) return true;
			}
		}
		return false;
	}

	// Returns sorted character-level thresholds for cantrip scaling, e.g. [5, 11, 17].
	// Prefers scalingLevelDice keys when available (Shocking Grasp style),
	// otherwise parses "at Nth level" text (Eldritch Blast style).
	function parseSpell2024CantripLevels (vc) {
		// Handle both object form {label, scaling} and array form [{label, scaling}, ...]
		const sld = Array.isArray(vc.scalingLevelDice) ? vc.scalingLevelDice[0] : vc.scalingLevelDice;
		if (sld && sld.scaling) {
			const levels = Object.keys(sld.scaling)
				.map(Number)
				.filter(l => l > 1)
				.sort((a, b) => a - b);
			if (levels.length) return levels;
		}
		const levels = [];
		for (const entry of (vc.entries || [])) {
			if (typeof entry !== "string") continue;
			const re = /at (\d+)(?:st|nd|rd|th) level/gi;
			let m;
			while ((m = re.exec(entry)) !== null) levels.push(parseInt(m[1], 10));
		}
		const unique = [...new Set(levels)].sort((a, b) => a - b);
		return unique.length ? unique : [5, 11, 17];
	}

	// Maps a 5etools areaTags entry to the 2024 sheet shape name.
	function areaTagTo2024Shape (tag) {
		const map = {S: "Sphere", C: "Cone", L: "Line", Q: "Square", Y: "Cylinder", H: "Hemisphere", W: "Wall", R: "Rectangle"};
		return map[tag] || "";
	}

	// Extracts AoE size text from entry strings, e.g. "20-foot-radius" → "20 foot radius".
	function parseSpell2024AoeSize (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/(\d+)[- ]foot[- ](?:radius|wide|long|tall|cone|line|cube)/i);
			if (m) return m[0].replace(/-/g, " ").toLowerCase();
		}
		return "";
	}

	/**
	 * Import a single spell into a 2024 character sheet's store attribute.
	 * When Vetoolscontent is present builds the full native
	 * Spell → Attack → Damage → Upcasting integrant chain.
	 */
	// _batchStore: if provided, mutate it in place and skip the read/save (batch mode for monster import).
	d20plus.importer.import2024Spell = function (charModel, spellData, _batchStore) {
		const d = spellData.data;
		const vc = spellData.Vetoolscontent || null;

		let storeAttr, store;
		if (_batchStore) {
			storeAttr = null;
			store = _batchStore;
		} else {
			const s = get2024Store(charModel);
			storeAttr = s.attr;
			store = s.store ? JSON.parse(JSON.stringify(s.store)) : {
				integrants: {integrants: {}},
				spells: {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]},
			};
		}
		if (!store.integrants) store.integrants = {integrants: {}};
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.spells) store.spells = {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]};
		if (!store.spells.displayOrder) store.spells.displayOrder = ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"];

		const levelStr = d["Level"] || "0";
		let levelIdx = levelStr === "cantrip" ? 0 : (parseInt(levelStr, 10) || 0);
		if (levelIdx > 9) levelIdx = 9;

		const cap = str => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

		// Components
		const compStr = (d["Components"] || "").toUpperCase();
		const components = {};
		if (compStr.includes("V")) components.verbal = true;
		if (compStr.includes("S")) components.somatic = true;
		if (compStr.includes("M")) {
			components.material = true;
			if (vc && vc.components && vc.components.m) {
				components.materialDescription = typeof vc.components.m === "string"
					? vc.components.m : (vc.components.m.text || "");
			}
		}

		// Range and duration as full strings, matching native Roll20 format
		const range = vc ? Parser.spRangeToFull(vc.range) : (d["Range"] || "");
		// Build duration from JSON to avoid Parser.spDurationToFull returning raw HTML anchor tags
		function parseDuration2024 (durArr) {
			if (!durArr || !durArr.length) return "Instantaneous";
			const du = durArr[0];
			if (du.type === "instantaneous") return "Instantaneous";
			if (du.type === "permanent") return "Until Dispelled";
			if (du.type === "special") return "Special";
			if (du.type === "timed" && du.duration) {
				const amt = du.duration.amount;
				const unit = du.duration.type;
				const plural = amt !== 1 ? "s" : "";
				if (du.concentration) return `Concentration, up to ${amt} ${unit}${plural}`;
				return `${amt} ${unit}${plural}`;
			}
			return "Instantaneous";
		}
		const duration = vc ? parseDuration2024(vc.duration) : (d["Duration"] || "");
		// Build casting time from JSON for the same reason
		function parseCastingTime2024 (timeArr) {
			if (!timeArr || !timeArr.length) return "Action";
			const t = timeArr[0];
			if (t.unit === "action") return "Action";
			if (t.unit === "bonus") return "Bonus Action";
			if (t.unit === "reaction") return "Reaction";
			if (t.unit === "minute") return t.number === 1 ? "1 Minute" : `${t.number} Minutes`;
			if (t.unit === "hour") return t.number === 1 ? "1 Hour" : `${t.number} Hours`;
			if (t.unit === "day") return t.number === 1 ? "1 Day" : `${t.number} Days`;
			return "Action";
		}
		const castingTimeBase = vc ? parseCastingTime2024(vc.time) : (d["Casting Time"] || "Action");
		const isRitual = vc ? !!(vc.meta && vc.meta.ritual) : (d["Ritual"] || "") === "Yes";
		const castingTime = isRitual ? `${castingTimeBase} or Ritual` : castingTimeBase;

		// AoE
		const aoeShape = vc && vc.areaTags && vc.areaTags.length ? areaTagTo2024Shape(vc.areaTags[0]) : "";
		const aoeSize = vc ? parseSpell2024AoeSize(vc.entries) : "";
		const aoe = {shape: aoeShape, size: aoeSize};

		// Determine whether to build the Attack/Damage chain
		const hasSave = vc && vc.savingThrow && vc.savingThrow.length;
		const hasSpellAtk = vc && vc.spellAttack && vc.spellAttack.length;
		const hasDamage = vc && vc.damageInflict && vc.damageInflict.length;
		const isCantripScaling = vc && vc.level === 0 && (vc.miscTags || []).includes("SCL");

		// isAutoHit: no save/attack but fires explicit projectiles (Magic Missile "three darts").
		// parseSpell2024Repeat returns null when no projectile word found → excludes buff spells like Elemental Weapon.
		const rawRepeat = (hasDamage && !hasSave && !hasSpellAtk) ? parseSpell2024Repeat(vc.entries) : null;
		const isAutoHit = rawRepeat !== null;
		const repeatCount = rawRepeat || 1;

		// isMultiRay: leveled spell with a spell attack roll that fires multiple projectiles (Scorching Ray "three rays").
		const rayRepeat = (!isCantripScaling && hasSpellAtk) ? parseSpell2024Repeat(vc.entries) : null;
		const isMultiRay = rayRepeat !== null;

		// Build chain for any spell with a save, attack roll, or auto-hit (damage OR save-only like Zone of Truth)
		const buildChain = hasSave || hasSpellAtk || isAutoHit;

		const parsed = buildChain ? parseSpell2024Damage(vc.entries) : null;
		// isRepeatUpcast: auto-hit OR multi-ray spells that add more projectiles per slot
		const isRepeatUpcast = !isCantripScaling && (isAutoHit || isMultiRay) && parseSpell2024RepeatUpcast(vc.entriesHigherLevel);
		// Standard upcast (diceCount) only for non-cantrip, non-repeat spells
		const upcast = (!isCantripScaling && buildChain && !isRepeatUpcast) ? parseSpell2024Upcast(vc.entriesHigherLevel) : null;
		const isDiceScaling = isCantripScaling && !!vc.scalingLevelDice;
		const isMultiDamage = isDiceScaling && Array.isArray(vc.scalingLevelDice) && vc.scalingLevelDice.length > 1;
		const cantripLevels = (isCantripScaling && buildChain) ? parseSpell2024CantripLevels(vc) : [];
		// Detect whether a failed save deals half damage or no damage on success
		const onSucceedHalf = hasSave && vc && vc.entries && vc.entries.some(e => typeof e === "string" && /\bhalf\b/i.test(e));

		// Healing chain: spells that grant HP or temp HP (False Life, Cure Wounds, etc.)
		const hasTHP = vc && (vc.miscTags || []).includes("THP");
		const hasHeal = vc && (vc.miscTags || []).includes("HL");
		const healParsed = (hasTHP || hasHeal) ? parseSpell2024HealDice(vc.entries) : null;
		const healUpcastData = healParsed ? parseSpell2024HealUpcast(vc.entriesHigherLevel) : null;

		// Generate all IDs + arrayPositions upfront so parents can reference children
		let pos = getNextArrayPos(store);
		const {id: spellId, base: spellBase} = make2024IntegrantBase("Spell", pos++);
		let attackId, attackBase, dmgId, dmgBase, upcastId, upcastBase;
		let cantripUpcastEntries = []; // [{id, base, level}] for cantrip scaling
		// Multi-type damage (e.g. Meteor Swarm: Fire + Bludgeoning). Each type gets its own
		// Damage integrant named "${spell} ${Type} Damage", matching the native Roll20 format.
		const multiDmgTypes = (!isCantripScaling && !isMultiDamage && hasDamage && vc.damageInflict && vc.damageInflict.length > 1)
			? parseAllSpell2024DamagesTyped(vc.entries, vc.damageInflict)
			: [];
		const isMultiDmgType = multiDmgTypes.length > 1;
		// Extra damage integrant entries beyond the first [{id, base, parsed}]
		let extraDmgEntries = [];
		if (buildChain && !isMultiDamage) {
			({id: attackId, base: attackBase} = make2024IntegrantBase("Attack", pos++));
			if (hasDamage) {
				({id: dmgId, base: dmgBase} = make2024IntegrantBase("Damage", pos++));
				// Allocate IDs for extra damage types
				if (isMultiDmgType) {
					extraDmgEntries = multiDmgTypes.slice(1).map(p => {
						const {id, base} = make2024IntegrantBase("Damage", pos++);
						return {id, base, parsed: p};
					});
				}
				if (isCantripScaling) {
					cantripUpcastEntries = cantripLevels.map(lvl => {
						const {id, base} = make2024IntegrantBase("Upcasting", pos++);
						return {id, base, level: lvl};
					});
				} else if (upcast || isRepeatUpcast) {
					({id: upcastId, base: upcastBase} = make2024IntegrantBase("Upcasting", pos++));
				}
			}
		}
		let healId, healBase, healUpcastId, healUpcastBase;
		if (healParsed) {
			({id: healId, base: healBase} = make2024IntegrantBase("Healing", pos++));
			if (healUpcastData) ({id: healUpcastId, base: healUpcastBase} = make2024IntegrantBase("Upcasting", pos++));
		}

		// Write integrants bottom-up so childIDs can reference already-known IDs
		if (upcastId) {
			const isRepeat = isRepeatUpcast;
			store.integrants.integrants[upcastId] = {
				...upcastBase,
				name: `${spellData.name} Upcast`,
				recordName: `${spellData.name} Upcast`,
				startingLevel: isRepeat ? levelIdx + 1 : upcast.startingLevel,
				level: isRepeat ? 1 : (upcast.stepLevels || 1),
				mode: "Per X Spell Level",
				target: isRepeat ? "$.repeat" : "$.diceCount",
				value: isRepeat ? 1 : upcast.value,
				changeMode: "Add",
				parentID: isRepeat ? attackId : dmgId,
				childIDs: "[]",
				relations: {},
			};
		}

		if (dmgId) {
			const firstParsed = isMultiDmgType ? multiDmgTypes[0] : parsed;
			const diceCount = firstParsed ? firstParsed.diceCount : (parsed ? parsed.diceCount : 1);
			const diceSize  = firstParsed ? firstParsed.diceSize  : (parsed ? parsed.diceSize  : "d6");
			const dmgType   = isMultiDmgType ? multiDmgTypes[0].damageType : cap(vc.damageInflict[0]);
			const dmgName   = isMultiDmgType ? `${spellData.name} ${dmgType} Damage` : `${spellData.name} Damage`;
			// Dice-scaling cantrips: upcastings are children of Damage
			const dmgUpcastChildIds = isDiceScaling ? cantripUpcastEntries.map(e => e.id) : [];
			const dmgChildIds = upcastId && !isRepeatUpcast
				? JSON.stringify([upcastId])
				: dmgUpcastChildIds.length ? JSON.stringify(dmgUpcastChildIds) : "[]";

			const dmgIntegrant = {
				...dmgBase,
				name: dmgName,
				recordName: dmgName,
				ability: "none",
				diceCount,
				diceSize,
				damageType: dmgType,
				overrideCrit: false,
				critDiceSize: "",
				parentID: attackId,
				childIDs: dmgChildIds,
				relations: {},
			};
			if (firstParsed && firstParsed.flatBonus) dmgIntegrant._bonus = firstParsed.flatBonus;
			store.integrants.integrants[dmgId] = dmgIntegrant;

			// Write extra damage integrants for multi-type spells (e.g. Bludgeoning for Meteor Swarm)
			for (const {id, base, parsed: ep} of extraDmgEntries) {
				const eName = `${spellData.name} ${ep.damageType} Damage`;
				store.integrants.integrants[id] = {
					...base,
					name: eName,
					recordName: eName,
					ability: "none",
					diceCount: ep.diceCount,
					diceSize: ep.diceSize,
					damageType: ep.damageType,
					overrideCrit: false,
					critDiceSize: "",
					parentID: attackId,
					childIDs: "[]",
					relations: {},
				};
				if (ep.flatBonus) store.integrants.integrants[id]._bonus = ep.flatBonus;
			}
		}

		// Write cantrip scaling Upcasting integrants
		for (const {id, base, level} of cantripUpcastEntries) {
			const isDice = isDiceScaling;
			// Dice scaling (scalingLevelDice): children of Damage, named "X Damage Upcast N"
			// Repeat scaling (no scalingLevelDice): children of Attack, named "X Upcast N"
			store.integrants.integrants[id] = {
				...base,
				name: isDice ? `${spellData.name} Damage Upcast ${level}` : `${spellData.name} Upcast ${level}`,
				recordName: isDice ? `${spellData.name} Damage Upcast ${level}` : `${spellData.name} Upcast ${level}`,
				mode: "Specific Character Level",
				level,
				startingLevel: 0,
				target: isDice ? "$.diceCount" : "$.repeat",
				value: 1,
				changeMode: "Add",
				parentID: isDice ? dmgId : attackId,
				childIDs: "[]",
				relations: {},
			};
		}

		if (attackId) {
			const diceCount = parsed ? parsed.diceCount : 1;
			const diceSize = parsed ? parsed.diceSize : "d6";
			const damageType = hasDamage ? cap(vc.damageInflict[0]) : "";

			let atkIntegrant;
			if (isAutoHit) {
				// Auto-hit spell (e.g. Magic Missile): uses autoHit + repeat, no attack object.
				// Range goes on the attack integrant for auto-hit spells (matches native Roll20 format).
				const childIds = upcastId ? [dmgId, upcastId] : [dmgId];
				atkIntegrant = {
					...attackBase,
					name: spellData.name,
					recordName: `${spellData.name} Free Attack`,
					actionType: castingTime,
					range,
					autoHit: true,
					repeat: repeatCount,
					parentID: spellId,
					childIDs: JSON.stringify(childIds),
					cascades: {},
					relations: {},
				};
			} else {
				// Attack roll or saving throw spell
				let atkType;
				if (hasSave) atkType = "Spell Save";
				else if (hasSpellAtk) atkType = "Spell Attack";
				else atkType = "Spell Attack";

				// Repeat-scaling cantrips: Attack childIDs = [dmg, upcast5, upcast11, upcast17]
				// Dice-scaling cantrips: Attack childIDs = [dmg] only (upcastings live under Damage)
				// Multi-damage-type: Attack childIDs = [dmg1, dmg2, ...] (all damage integrants)
				const repeatChildIds = (!isDiceScaling && isCantripScaling) ? cantripUpcastEntries.map(e => e.id) : [];
				const allDmgIds = dmgId ? [dmgId, ...extraDmgEntries.map(e => e.id)] : [];
				const childIDs = allDmgIds.length ? JSON.stringify([...allDmgIds, ...repeatChildIds]) : "[]";

				atkIntegrant = {
					...attackBase,
					name: spellData.name,
					recordName: `${spellData.name} Attack`,
					actionType: castingTime,
					...(aoe.shape ? {aoe} : {}),
					attack: {type: atkType},
					parentID: spellId,
					childIDs,
					cascades: {},
					relations: {},
				};
				if (isCantripScaling && !isDiceScaling) atkIntegrant.repeat = 1;
			if (isMultiRay) atkIntegrant.repeat = rayRepeat;
			if (isRepeatUpcast && upcastId) atkIntegrant.childIDs = JSON.stringify([dmgId, upcastId]);
				if (hasSave) {
					let onFailText = "";
					if (hasDamage) {
						if (isMultiDmgType) {
							// e.g. "Takes 20d6 Fire damage and 20d6 Bludgeoning damage."
							const allDmgParts = multiDmgTypes.map(p => `${p.diceCount}${p.diceSize} ${p.damageType}`);
							onFailText = `Takes ${allDmgParts.join(" damage and ")} damage.`;
						} else {
							onFailText = `Takes ${diceCount}${diceSize} ${damageType} damage.`;
						}
					}
					atkIntegrant.save = {
						saveAbility: cap(vc.savingThrow[0]),
						onFail: onFailText,
					};
					if (hasDamage && onSucceedHalf) atkIntegrant.save.onSucceed = "Half as much damage.";
				}
			}
			store.integrants.integrants[attackId] = atkIntegrant;
		}

		// Multi-damage cantrip chains (e.g. Toll the Dead: two Attack+Damage+Upcast sets)
		const multiDamageAtkIds = [];
		if (isMultiDamage) {
			const damageType = cap(vc.damageInflict[0]);

			for (const sldEntry of vc.scalingLevelDice) {
				const baseDiceStr = sldEntry.scaling["1"] || "1d8";
				const baseDiceM = baseDiceStr.match(/(\d+)d(\d+)/i);
				const baseDiceCount = baseDiceM ? parseInt(baseDiceM[1], 10) : 1;
				const baseDiceSize = baseDiceM ? "d" + baseDiceM[2] : "d8";

				const suffix = `(${baseDiceStr})`;
				const dmgName = `${spellData.name} ${suffix} Damage`;
				const atkName = `${spellData.name} ${suffix}`;
				const atkRecordName = `${spellData.name} ${suffix} Attack`;

				const {id: mAtkId, base: mAtkBase} = make2024IntegrantBase("Attack", pos++);
				const {id: mDmgId, base: mDmgBase} = make2024IntegrantBase("Damage", pos++);
				const mUpcastEntries = cantripLevels.map(lvl => {
					const {id, base} = make2024IntegrantBase("Upcasting", pos++);
					return {id, base, level: lvl};
				});

				for (const {id, base, level} of mUpcastEntries) {
					store.integrants.integrants[id] = {
						...base,
						name: `${dmgName} Upcast ${level}`,
						recordName: `${dmgName} Upcast ${level}`,
						mode: "Specific Character Level",
						level,
						startingLevel: 0,
						target: "$.diceCount",
						value: 1,
						changeMode: "Add",
						parentID: mDmgId,
						childIDs: "[]",
						relations: {},
					};
				}

				store.integrants.integrants[mDmgId] = {
					...mDmgBase,
					name: dmgName,
					recordName: dmgName,
					ability: "none",
					diceCount: baseDiceCount,
					diceSize: baseDiceSize,
					damageType,
					overrideCrit: false,
					critDiceSize: "",
					parentID: mAtkId,
					childIDs: JSON.stringify(mUpcastEntries.map(e => e.id)),
					relations: {},
				};

				const mAtkIntegrant = {
					...mAtkBase,
					name: atkName,
					recordName: atkRecordName,
					actionType: castingTime,
					...(aoe.shape ? {aoe} : {}),
					attack: {type: hasSave ? "Spell Save" : "Spell Attack"},
					parentID: spellId,
					childIDs: JSON.stringify([mDmgId]),
					cascades: {},
					relations: {},
				};
				if (hasSave) {
					mAtkIntegrant.save = {
						saveAbility: cap(vc.savingThrow[0]),
						onFail: `Takes ${baseDiceStr} ${damageType} damage.`,
					};
					if (onSucceedHalf) mAtkIntegrant.save.onSucceed = "Half as much damage.";
				}
				store.integrants.integrants[mAtkId] = mAtkIntegrant;
				multiDamageAtkIds.push(mAtkId);
			}
		}

			// Healing chain (False Life, Cure Wounds, etc.)
		if (healParsed) {
			const healLabel = hasTHP ? "Temporary Hit Points" : "Hit Points";
			if (healUpcastId) {
				store.integrants.integrants[healUpcastId] = {
					...healUpcastBase,
					name: `${spellData.name} ${healLabel} Upcast`,
					recordName: `${spellData.name} ${healLabel} Upcast`,
					startingLevel: healUpcastData.startingLevel,
					level: healUpcastData.stepLevels || 1,
					mode: "Per X Spell Level",
					target: healUpcastData.targetBonus ? "$._bonus" : "$.diceCount",
					value: healUpcastData.value,
					changeMode: "Add",
					parentID: healId,
					childIDs: "[]",
					relations: {},
				};
			}
			store.integrants.integrants[healId] = {
				...healBase,
				name: `${spellData.name} ${healLabel}`,
				recordName: `${spellData.name} ${healLabel}`,
				_bonus: healParsed.bonus,
				ability: "none",
				diceCount: healParsed.diceCount,
				diceSize: healParsed.diceSize,
				overrideCrit: false,
				critDiceSize: "",
				isTemp: !!hasTHP,
				parentID: spellId,
				childIDs: healUpcastId ? JSON.stringify([healUpcastId]) : "[]",
				relations: {},
			};
		}

		// Spell integrant (always created)
		const spellChildIDs = isMultiDamage
			? JSON.stringify(multiDamageAtkIds)
			: attackId ? JSON.stringify([attackId])
			: healId ? JSON.stringify([healId])
			: "[]";

		const schoolMap = {A:"Abjuration",C:"Conjuration",D:"Divination",E:"Enchantment",I:"Illusion",N:"Necromancy",T:"Transmutation",V:"Evocation"};
		const spellIntegrant = {
			...spellBase,
			_prepared: !!_batchStore ? false : true,  // NPC batch imports are not "prepared"
			alwaysPrepared: false,
			...(aoe.shape ? {aoe} : {}),
			concentration: vc ? !!(vc.duration && vc.duration[0] && vc.duration[0].concentration) : (d["Concentration"] || "") === "Yes",
			name: spellData.name,
			recordName: spellData.name,
			level: levelIdx,
			school: (vc && schoolMap[vc.school]) || d["School"] || "Evocation",
			castingTime,
			range,
			components,
			duration,
			description: d["data-description"] || "",
			relations: {},
			ritual: isRitual,
			childIDs: spellChildIDs,
		};
		if (isDiceScaling) spellIntegrant.cantripScale = "Dice";
		store.integrants.integrants[spellId] = spellIntegrant;

		const order = JSON.parse(store.spells.displayOrder[levelIdx] || "[]");
		order.push(spellId);
		store.spells.displayOrder[levelIdx] = JSON.stringify(order);

		if (!_batchStore) save2024Store(charModel, storeAttr, store);
	};

	/**
	 * Import a single item into a 2024 character sheet's store attribute.
	 * Weapons also create Attack + Damage integrants.
	 */
	d20plus.importer.import2024Item = function (charModel, itemData) {
		const d = itemData.data || {};
		const vc = itemData.Vetoolscontent || {};
		const {attr: storeAttr, store: rawStore} = get2024Store(charModel);

		const store = rawStore ? JSON.parse(JSON.stringify(rawStore)) : {
			integrants: {integrants: {}},
			inventory: {equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]"},
			attacks: {attackDisplayOrder: "[]"},
		};
		if (!store.integrants) store.integrants = {integrants: {}};
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.inventory) store.inventory = {equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]"};
		if (!store.attacks) store.attacks = {attackDisplayOrder: "[]"};

		// Parse magic item bonus from name e.g. "+1 Longsword" → 1
		const bonusMatch = itemData.name.match(/^\+(\d+)/);
		const magicBonus = bonusMatch ? parseInt(bonusMatch[1], 10) : 0;

		// All new integrants in this save need distinct arrayPositions to prevent
		// Roll20 from deduplicating them during the Firebase write.
		let pos = getNextArrayPos(store);

		const parseDice = (str) => {
			const m = (str || "").match(/(\d+)d(\d+)/i);
			return m ? {diceCount: parseInt(m[1], 10), diceSize: `d${m[2]}`} : {diceCount: 1, diceSize: "d4"};
		};

		const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

		// Property abbreviation → display name
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

		// Helper: build one Attack+Damage pair and write into store
		const makeAttackPair = (atkName, atkRecordName, dmgName, atkObj, dmgAbility, dmgStr, dmgType) => {
			const {id: atkId, base: atkBase} = make2024IntegrantBase("Attack", pos++);
			const {id: dmgId, base: dmgBase} = make2024IntegrantBase("Damage", pos++);
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

		// Collect all attack IDs for Item.childIDs — created below once itemId is known
		const allAtkIds = [];

		// Item integrant — written after attacks so childIDs is known
		const {id: itemId, base: itemBase} = make2024IntegrantBase("Item", pos++);

		// Weapon — build attack+damage pairs based on properties
		if (d["Damage"]) {
			const dmgType = d["Damage Type"] || "Slashing";
			const altDmgType = d["Alternate Damage Type"] || dmgType;
			const baseName = itemData.name;

			if (isVersatile) {
				// Two-handed weapon: base attack becomes One-Handed
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
				// Base attack (non-versatile)
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

			// Finesse variant (Dexterity melee)
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

			// Off-hand variant (Light property) — ability:"none" on damage
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

			// Thrown variant (Ranged)
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

		// Build properties display string
		let propertiesStr = undefined;
		if (vcProps.length > 0) {
			propertiesStr = JSON.stringify(vcProps.map(key => {
				if (key === "V") return `Versatile (${d["Alternate Damage"] || "1d10"})`;
				return propMap[key] || key;
			}));
		}

		// Item integrant
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

		save2024Store(charModel, storeAttr, store);
	};

	// Helper: append IDs to a JSON-stringified display order array in the store.
	function push2024DisplayOrder (store, section, key, ids) {
		if (!store[section]) store[section] = {};
		const current = JSON.parse(store[section][key] || "[]");
		store[section][key] = JSON.stringify([...current, ...ids]);
	}

	/**
	 * Import a 5etools feat onto a 2024 Jumpgate character.
	 * Creates a Features integrant and adds it to featsDisplayOrder.
	 */
	d20plus.importer.import2024Feat = function (charModel, data) {
		const {attr: storeAttr, store} = get2024Store(charModel);
		if (!store) return;

		let pos = getNextArrayPos(store);
		const ints = store.integrants.integrants;

		const {id, base} = make2024IntegrantBase("Features", pos++);
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

		push2024DisplayOrder(store, "features", "featsDisplayOrder", [id]);

		save2024Store(charModel, storeAttr, store);
	};

	/**
	 * Import a 5etools race/subrace onto a 2024 Jumpgate character.
	 * Creates: Species → Speed, Size, Features (one per trait), Sense (for darkvision)
	 */
	d20plus.importer.import2024Race = function (charModel, data) {
		const race = data.Vetoolscontent;
		if (!race) return;

		const {attr: storeAttr, store} = get2024Store(charModel);
		if (!store) return;

		let pos = getNextArrayPos(store);
		const ints = store.integrants.integrants;
		const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

		const makeBase = (type) => {
			const {id, base} = make2024IntegrantBase(type, pos++);
			base.source = "Species";
			return {id, base};
		};

		const sizeAbvMap = {T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan"};
		const firstSizeAbv = (race.size && race.size[0]) || "M";
		const firstSize = sizeAbvMap[firstSizeAbv] || "Medium";
		const walkSpeed = typeof race.speed === "number" ? race.speed : (race.speed && race.speed.walk) || 30;
		const raceName = race.name || "Unknown";
		const darkvision = race.darkvision || 0;

		// --- Species (top-level) ---
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

		// Add all Features children to speciesTraitsDisplayOrder so the sheet shows them
		const speciesFeatureIds = speciesChildren.filter(id => ints[id] && ints[id].type === "Features");
		push2024DisplayOrder(store, "features", "speciesTraitsDisplayOrder", speciesFeatureIds);

		save2024Store(charModel, storeAttr, store);
	};

	/**
	 * Import a 5etools class onto a 2024 Jumpgate character.
	 * Creates: Class → Class Level(s) → Hit Dice, Hit Points, Features
	 * For spellcasting classes: Spellcasting Features → Spellcasting config + Spell Slots
	 */
	d20plus.importer.import2024Class = async function (charModel, data) {
		const clss = data.Vetoolscontent;
		if (!clss || !clss.classFeatures) return;

		const levelInput = prompt(`Import ${clss.name} at what level? (1-20)`, "1");
		if (levelInput === null) return;
		const maxLevel = Math.min(20, Math.max(1, parseInt(levelInput, 10) || 1));

		const {attr: storeAttr, store} = get2024Store(charModel);
		if (!store) return;

		let pos = getNextArrayPos(store);

		const makeBase = (type) => {
			const {id, base} = make2024IntegrantBase(type, pos++);
			base.source = "Class";
			return {id, base};
		};

		const ints = store.integrants.integrants;
		const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

		const abilityMap = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
		const spellAbility = clss.spellcastingAbility ? abilityMap[clss.spellcastingAbility] : null;
		const casterTypeMap = {"full": "full", "1/2": "half", "1/3": "third", "artificer": "half", "pact": "pact"};
		const casterType = (spellAbility && clss.casterProgression) ? (casterTypeMap[clss.casterProgression] || "full") : null;

		const spellProgressionTable = clss.classTableGroups
			?.find(g => g.rowsSpellProgression)?.rowsSpellProgression || null;

		const classFeatureIds = []; // collect all top-level Features for classFeatureDisplayOrder

		// --- Class integrant (top-level) ---
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

		// --- One Class Level integrant per level ---
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

					// Rest Display
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

					// Spellcasting config
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

					// Spell slots for maxLevel total
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

		push2024DisplayOrder(store, "features", "classFeatureDisplayOrder", classFeatureIds);

		save2024Store(charModel, storeAttr, store);
	};

	/**
	 * Route a drag-drop import to the appropriate 2024 handler.
	 * Falls back to the standard importData path for unhandled categories.
	 */
	d20plus.importer.import2024Data = function (charView, data, event, importDataFallback) {
		const charModel = charView.model;
		const category = data.data && data.data.Category;

		if (category === "Spells") {
			d20plus.importer.import2024Spell(charModel, data);
		} else if (category === "Items") {
			d20plus.importer.import2024Item(charModel, data);
		} else if (category === "Classes") {
			d20plus.importer.import2024Class(charModel, data);
		} else if (category === "Races") {
			d20plus.importer.import2024Race(charModel, data);
		} else if (category === "Feats") {
			d20plus.importer.import2024Feat(charModel, data);
		} else {
			// For other categories fall back to the standard path
			importDataFallback(charView, data, event);
		}
	};
}

SCRIPT_EXTENSIONS.push(d20plus2024Import);
