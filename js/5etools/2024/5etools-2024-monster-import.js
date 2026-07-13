function d20plus2024MonsterImport() {
	const monsterCtx = d20plus.import2024;

	function parse2024MonsterSpeeds(speedObj) {
		if (!speedObj) return [{ type: "Walking", value: 30 }];

		const speeds = [];
		const typeMap = {
			"walk": "Walking",
			"fly": "Flying",
			"swim": "Swimming",
			"climb": "Climbing",
			"burrow": "Burrowing",
		};

		for (const [key, val] of Object.entries(speedObj)) {
			if (key === "canHover") continue;
			const type = typeMap[key] || "Walking";
			const value = typeof val === "number" ? val : (val.number || 30);
			speeds.push({ type, value });
		}

		return speeds.length > 0 ? speeds : [{ type: "Walking", value: 30 }];
	}

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
			const atkMatch = entry.match(/\{@atkr?\s+([^}]+)}/i);
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
			const hitTagMatch = entry.match(/\{@hit\s+(\d+)}/i);
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
			const hitSection = entry.split(/\{@h}/i)[1];
			if (hitSection) {
				const dmgPattern = /\{@damage\s+([^}]+)}\)\s*(\w+)\s*damage/gi;
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
			const { id, base } = monsterCtx.makeIntegrantBase("Ability Score", arrayPosition++);
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
		const { id: hpId, base: hpBase } = monsterCtx.makeIntegrantBase("Hit Points", arrayPosition++);
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
		const { id: acId, base: acBase } = monsterCtx.makeIntegrantBase("Armor Class", arrayPosition++);
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
		if (data.dex !== undefined) {
			const dexMod = Math.floor((data.dex - 10) / 2);
			const pb = Parser.crToPb ? Parser.crToPb(cr) : 2;
			const initProf = (data.initiative && data.initiative.proficiency) ? data.initiative.proficiency : 0;
			store.npc.initiativeModOverride = dexMod + pb * initProf;
		}
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
			const { id, base } = monsterCtx.makeIntegrantBase("Speed", arrayPosition++);
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
			const { id, base } = monsterCtx.makeIntegrantBase("Sense", arrayPosition++);
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
			const { id, base } = monsterCtx.makeIntegrantBase("Language", arrayPosition++);
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
			const { id, base } = monsterCtx.makeIntegrantBase("Proficiency", arrayPosition++);
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
			const { id, base } = monsterCtx.makeIntegrantBase("Proficiency", arrayPosition++);
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

		// Defenses
		const makeDefense = (defense, value) => {
			const cap = v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
			const { id, base } = monsterCtx.makeIntegrantBase("Defense", arrayPosition++);
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
					const { id, base } = monsterCtx.makeIntegrantBase("Defense", arrayPosition++);
					integrants[id] = { ...base, name: `Condition Immunity: ${cap(cond)}`, defense: "Condition Immunity", condition: cap(cond), cascades: {}, relations: {} };
				}
			}
		}

		// Traits (Features)
		const traitDisplayOrder = [];
		if (data.trait) {
			for (const trait of data.trait) {
				const name = d20plus.importer.getCleanText(renderer.render(trait.name));
				const text = d20plus.importer.getCleanText(renderer.render({ entries: trait.entries }, 1));
				const { id, base } = monsterCtx.makeIntegrantBase("Features", arrayPosition++);
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

		// Spellcasting — render as an Action integrant
		if (data.spellcasting && data.spellcasting.length > 0) {
			for (const sc of data.spellcasting) {
				const scName = d20plus.importer.getCleanText(renderer.render(sc.name || "Spellcasting"));
				const scText = d20plus.importer.getCleanText(renderer.render({ type: "spellcasting", ...sc }, 1));
				const { id, base } = monsterCtx.makeIntegrantBase("Action", arrayPosition++);
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

		const buildAttackIntegrants = (actionData, actionType, displayOrder) => {
			const name = d20plus.importer.getCleanText(renderer.render(actionData.name));
			const text = d20plus.importer.getCleanText(renderer.render({ entries: actionData.entries }, 1));
			const attackInfo = extractMonsterAttackInfo(actionData.entries);

			if (attackInfo.isAttack && attackInfo.damages.length > 0) {
				const { id: attackIntId, base: attackBase } = monsterCtx.makeIntegrantBase("Attack", arrayPosition++);
				const damageIds = [];

				for (let i = 0; i < attackInfo.damages.length; i++) {
					const dmg = attackInfo.damages[i];
					const { id: dmgId, base: dmgBase } = monsterCtx.makeIntegrantBase("Damage", arrayPosition++);
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
				const { id, base } = monsterCtx.makeIntegrantBase("Action", arrayPosition++);
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

		const bonusActionDisplayOrder = [];
		if (data.bonus) {
			for (const bonus of data.bonus) buildAttackIntegrants(bonus, "Bonus Action", bonusActionDisplayOrder);
		}

		const reactionDisplayOrder = [];
		if (data.reaction) {
			for (const reaction of data.reaction) buildAttackIntegrants(reaction, "Reaction", reactionDisplayOrder);
		}

		const legendaryActionDisplayOrder = [];
		if (data.legendary) {
            store.npc.legendaryActionCount = data.legendaryActions || 3;
			for (const legendary of data.legendary) buildAttackIntegrants(legendary, "Legendary", legendaryActionDisplayOrder);
		}

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

	d20plus.monsters.shouldUse2024 = function() {
		return monsterCtx.IS_2024_SHEET.has(d20plus.cfg.getOrDefault("import", "importSheetFormat"));
	};

	d20plus.monsters.import2024Spells = function (charModel, monsterData) {
		if (!monsterData.spellcasting || !monsterData.spellcasting.length) return;

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
			const m = sp.match(/\{@spell ([^|}]+?)(?:\|([^}]+?))?}/i);
			if (!m) return null;
			return {name: m[1].trim(), source: (m[2] || "PHB").trim()};
		}

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
				const {attr: storeAttr, store: rawStore} = monsterCtx.getStore(charModel);
				const store = rawStore ? JSON.parse(JSON.stringify(rawStore)) : {
					integrants: {integrants: {}},
					spells: {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]},
				};

				const abilityMap = {str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
				const monsterName = monsterData._displayName || monsterData.name;
				const configIds = [];
				const classIds = [];
				const spellSourceMap = {};

				monsterData.spellcasting.forEach(sc => {
					const scName = sc.name || "Spellcasting";
					const ability = abilityMap[(sc.ability || "").toLowerCase()] || "Intelligence";

					let scPos = monsterCtx.getNextArrayPos(store);
					const {id: classId, base: classBase} = monsterCtx.makeIntegrantBase("Class", scPos++);
					const {id: configId, base: configBase} = monsterCtx.makeIntegrantBase("Spellcasting", scPos++);

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

					extractSpellRefs(sc).forEach(sp => {
						const parsed = parseSpellTag(sp);
						if (parsed && !spellSourceMap[parsed.name.toLowerCase()]) {
							spellSourceMap[parsed.name.toLowerCase()] = {configId, classId};
						}
					});
				});

				for (const spellData of spellDataList) {
					if (spellData) d20plus.importer.import2024Spell(charModel, spellData, store);
				}

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

				monsterCtx.saveStore(charModel, storeAttr, store);
			});
		}, 500);
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024MonsterImport);
