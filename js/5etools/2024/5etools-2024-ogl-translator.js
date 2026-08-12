function d20plus2024OGLTranslator() {
	// Generate a 21-character ID for OGL→2024 module importer integrants.
	// Uses a wider charset and longer length than the drag-drop 8-char IDs;
	// shortID is set to the first 9 characters.
	function generate2024Id() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
		let id = '';
		for (let i = 0; i < 21; i++) {
			id += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return id;
	}

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

	function parseSpeeds(speedStr) {
		if (!speedStr) return [{ type: "Walking", value: 30 }];

		const speeds = [];
		const parts = speedStr.split(",").map(s => s.trim());

		for (const part of parts) {
			// Trailing "(hover)" etc. is captured separately from the leading type word, so a
			// speed like "fly 60 ft. (hover)" is detected via `note`, not via the typeMap below.
			const match = part.match(/(?:(\w+)\s+)?(\d+)\s*(?:ft\.?)?\s*(\(([^)]+)\))?/i);
			if (match) {
				let type = match[1] ? match[1].toLowerCase() : "walk";
				const value = parseInt(match[2], 10);
				const note = match[4] ? match[4].trim() : "";

				const typeMap = {
					"walk": "Walking",
					"fly": "Flying",
					"swim": "Swimming",
					"climb": "Climbing",
					"burrow": "Burrowing",
					"hover": "Flying",
				};
				type = typeMap[type] || "Walking";
				if (type === "Flying" && note.toLowerCase() === "hover") type = "Flying (Hover)";

				speeds.push({ type, value });
			}
		}

		return speeds.length > 0 ? speeds : [{ type: "Walking", value: 30 }];
	}

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

	d20plus.importer.translateOGLTo2024Store = function(attribs) {
		const attrMap = {};
		const attrMaxMap = {};
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
		store.npc.acNotes = attrMap["npc_actype"] || "";

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
			const hasNumericSave = saveVal !== undefined && saveVal !== null && `${saveVal}`.trim() !== "";
			const isExplicitlyProficient = `${saveFlag || ""}` === "1";
			// OGL sheets can emit npc_*_save = "0" for non-proficient saves.
			// Only create save proficiency when the sheet explicitly marks it
			// proficient, or when a concrete save bonus value is present.
			if (!hasNumericSave && !isExplicitlyProficient) return;
			if (hasNumericSave && parseInt(`${saveVal}`.trim() || "0", 10) === 0 && !isExplicitlyProficient) return;

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

		// Defenses - match native 2024 sheet fields
		const cap = v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

		// Defenses - Resistances
		const resistancesStr = attrMap["npc_resistances"] || "";
		if (resistancesStr) {
			const resistances = resistancesStr.split(",").map(s => s.trim()).filter(s => s);
			for (const res of resistances) {
				const { id, base } = createIntegrantBase("Defense");
				integrants[id] = {
					...base,
					name: `Resistance: ${cap(res)}`,
					defense: "Resistance",
					damage: cap(res),
					cascades: {},
					relations: {},
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
					name: `Immunity: ${cap(imm)}`,
					defense: "Immunity",
					damage: cap(imm),
					cascades: {},
					relations: {},
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
					name: `Vulnerability: ${cap(vuln)}`,
					defense: "Vulnerability",
					damage: cap(vuln),
					cascades: {},
					relations: {},
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
					name: `Condition Immunity: ${cap(cond)}`,
					defense: "Condition Immunity",
					condition: cap(cond),
					cascades: {},
					relations: {},
				};
			}
		}

		// Traits (as Features)
		const traitDisplayOrder = [];
		for (const [, trait] of Object.entries(repeatingTraits)) {
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

		for (const [, action] of Object.entries(repeatingActions)) {
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

		for (const [, legendary] of Object.entries(repeatingLegendary)) {
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
		for (const [, mythic] of Object.entries(repeatingMythic)) {
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
		for (const [, reaction] of Object.entries(repeatingReactions)) {
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

		for (const [, spell] of Object.entries(repeatingSpells)) {
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

		return store;
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024OGLTranslator);
