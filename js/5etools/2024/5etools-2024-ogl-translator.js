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
			const match = part.match(/(?:(\w+)\s+)?(\d+)\s*(?:ft\.?)?/i);
			if (match) {
				let type = match[1] ? match[1].toLowerCase() : "walk";
				const value = parseInt(match[2], 10);

				const typeMap = {
					"walk": "Walking",
					"fly": "Flying",
					"swim": "Swimming",
					"climb": "Climbing",
					"burrow": "Burrowing",
					"hover": "Flying",
				};
				type = typeMap[type] || "Walking";

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
			const match = part.match(/(\w+)\s+(\d+)\s*(?:ft\.?)?/i);
			if (match) {
				let type = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
				const value = parseInt(match[2], 10);

				const validSenses = ["Darkvision", "Blindsight", "Tremorsense", "Truesight"];
				if (validSenses.includes(type)) {
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
		store.character.creatureType = creatureType;

		// Challenge Rating
        store.npc.challengeRating = attrMap["npc_challenge"] || "0";

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
		for (const [, trait] of Object.entries(repeatingTraits)) {
			if (!trait.name) continue;
			const { id, base } = createIntegrantBase("Feature");
			integrants[id] = {
				...base,
				name: trait.name,
				description: trait.description || trait.desc || "",
			};
		}

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

		return store;
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024OGLTranslator);
