/**
 * Converts a Roll20 2014/OGL 5e player-character sheet's flat + repeating attribs into the
 * 2024 Jumpgate sheet's "store" format, for the "Overwrite JSON" PC path (js/base/base-character-io.js).
 *
 * Architecture: rather than parsing OGL free-text fields ourselves, this resolves each piece of
 * identity (race/subrace/background/class/subclass) and each inventory/spell row BY NAME against
 * the site's already-loaded 5etools data, then drives the exact same store-builder functions the
 * Charactermancer's own drag-and-drop importers use (import2024Race/Background/ClassAtLevel/
 * Subclass/Item/Spell) - reusing proven integrant-building logic instead of duplicating it.
 *
 * Known limits (see plan for reasoning):
 * - Feat/Ability Score Improvement choices come through as descriptive text only, matching the
 *   existing precedent in 5etools-2024-feat-import.js (nothing in this codebase gives feats or
 *   ASIs mechanical effects anywhere, including the manual Charactermancer path).
 * - Armor/Weapon/Tool proficiencies (repeating_proficiencies/repeating_tool) are not parsed - the
 *   OGL sheet stores these as an untyped flat name list with no category field to key off, and no
 *   other file in this codebase builds Armor/Weapon Proficiency integrants directly to model from
 *   (Roll20's native Charactermancer wizard builds them server-side from a GraphQL payload we
 *   never see resolved). Skill/Saving-Throw proficiencies ARE covered (see below).
 * - Prepared vs. known-but-unprepared spell status isn't distinguished - import2024Spell's
 *   non-batch mode always marks spells "_prepared: true".
 */
function d20plus2024PcConverter() {
	const pcCtx = d20plus.import2024;

	const ABILITY_NAMES = {
		strength: "Strength", dexterity: "Dexterity", constitution: "Constitution",
		intelligence: "Intelligence", wisdom: "Wisdom", charisma: "Charisma",
	};
	const SKILL_DISPLAY = {
		acrobatics: "Acrobatics", animal_handling: "Animal Handling", arcana: "Arcana", athletics: "Athletics",
		deception: "Deception", history: "History", insight: "Insight", intimidation: "Intimidation",
		investigation: "Investigation", medicine: "Medicine", nature: "Nature", perception: "Perception",
		performance: "Performance", persuasion: "Persuasion", religion: "Religion", sleight_of_hand: "Sleight of Hand",
		stealth: "Stealth", survival: "Survival",
	};
	const LEVEL_WORDS = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH"];

	function attrMap (attribs) {
		const map = {};
		attribs.forEach(a => { map[a.name] = a.current; });
		return map;
	}

	// OGL stores max HP in the "max" field of the "hp" attribute itself, not a separate
	// "hp_max"-named attrib - same pattern already documented for NPCs in ogl-translator.js.
	function findAttrMax (attribs, name) {
		const attr = attribs.find(a => a.name === name);
		return attr ? attr.max : undefined;
	}

	// Groups a repeating section's flattened attribs (repeating_x_-rowid_field) back into rows.
	function groupRepeating (attribs, sectionPrefix) {
		const rows = {};
		const re = new RegExp(`^${sectionPrefix}_(-[A-Za-z0-9_-]+)_(.+)$`);
		attribs.forEach(a => {
			const m = re.exec(a.name);
			if (!m) return;
			const [, rowid, field] = m;
			rows[rowid] = rows[rowid] || {};
			rows[rowid][field] = a.current;
		});
		return Object.values(rows);
	}

	async function findByName (prop, name, source) {
		if (!name) return null;
		try {
			const all = await DataLoader.pCacheAndGetAllSite(prop);
			const lower = name.trim().toLowerCase();
			const candidates = (all || []).filter(x => (x.name || "").toLowerCase() === lower);
			if (!candidates.length) return null;
			if (source) {
				const bySource = candidates.find(x => (x.source || "").toLowerCase() === source.toLowerCase());
				if (bySource) return bySource;
			}
			return candidates[0];
		} catch (e) {
			return null;
		}
	}

	async function findSubclassByName (className, subclassName) {
		if (!subclassName) return null;
		try {
			const all = await DataLoader.pCacheAndGetAllSite("subclass");
			const lowerClass = (className || "").trim().toLowerCase();
			const lowerSub = subclassName.trim().toLowerCase();
			return (all || []).find(sc => (sc.className || "").toLowerCase() === lowerClass
				&& ((sc.shortName || sc.name || "").toLowerCase() === lowerSub || (sc.name || "").toLowerCase() === lowerSub));
		} catch (e) {
			return null;
		}
	}

	// import2024Item/import2024Spell expect the r20json handout-wrapper shape ({name, data,
	// content, Vetoolscontent}), not raw 5etools JSON - _getHandoutData is the same conversion
	// step already used when dragging a compendium spell/item onto an NPC (5etools-2024-monster-import.js).
	async function toHandoutData (helperNamespace, rawEntry) {
		try {
			const [, gmnotes] = helperNamespace._getHandoutData(rawEntry);
			return JSON.parse(gmnotes);
		} catch (e) {
			return null;
		}
	}

	async function toFeatData (feat) {
		const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);
		const renderStack = [];
		if (feat.entries) renderer.recursiveRender({entries: feat.entries}, renderStack);
		return {name: feat.name, Vetoolscontent: d20plus.importer.getCleanText(renderStack.join(""))};
	}

	function makeBlankPcStore () {
		return {
			integrants: {integrants: {}},
			actions: {
				actionDisplayOrder: "[]", bonusActionDisplayOrder: "[]", freeActionDisplayOrder: "[]",
				reactionDisplayOrder: "[]", legendaryActionDisplayOrder: "[]", mythicActionDisplayOrder: "[]",
			},
			attacks: {attackDisplayOrder: "[]"},
			spells: {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"], generalSpellSettings: {}},
			npc: {},
			npcEdit: {},
			about: {characteristics: {}, aboutTabApperancesDisplayOrder: "[]", aboutTabCharacteristicsDisplayOrder: "[]", aboutItems: {}},
			background: {aboutTabBackgroundDisplayOrder: "[]"},
			character: {createdWithBuilder: false, creatureType: "Humanoid", pronouns: ""},
			settings: {layoutState: "Stat Block", addDexTiebreaker: false, encumbranceType: "Normal", ignoreCoinWeight: false},
			hitpoints: {deathSaves: {failures: 0, open: false, successes: 0}},
			classLevel: {currentExp: 0},
			currencies: {initialized: true},
			effects: {effectDisplayOrder: "[]"},
			features: {classFeatureDisplayOrder: "[]", featsDisplayOrder: "[]", otherDisplayOrder: "[]", speciesTraitsDisplayOrder: "[]"},
			inspiration: {isInspired: false},
			inventory: {equipmentDisplayOrder: "[]", incrementalQuantityEditing: true, otherPossessionsDisplayOrder: "[]"},
			notes: {emptyCategories: "[]", order: {}, notes: {}},
			proficiencies: {},
			rest: {longRestModalData: {}, shortRestModalData: {}, usedHitDiceData: {}},
			shop: {isLocked: false, lockDC: 10, shopDiscountMarkup: 0},
			spellSlots: {currentByLevel: {}, currentPactByLevel: {}, useSpellSlotOnCast: true},
			weaponMasteries: {masteryDisplayOrder: "[]"},
			bastion: {bastionDefenders: "", bastionDescription: "", bastionLevel: 1},
		};
	}

	d20plus.importer.translatePcOGLTo2024Store = async function (charModel, attribs) {
		const map = attrMap(attribs);
		const summary = {
			race: null, background: null, classes: [],
			itemsImported: 0, itemsFailed: [], spellsImported: 0, spellsFailed: [],
			featTraitStubs: 0,
		};

		// ---- Identity ----
		const raceName = map.race || "";
		const subraceName = map.subrace || "";
		const backgroundName = map.background || "";
		const classes = [];
		if (map.class) classes.push({name: map.class, subclass: map.subclass || "", level: parseInt(map.level, 10) || 1});
		for (let i = 1; i <= 3; i++) {
			const mcName = map[`multiclass${i}`];
			if (!mcName) continue;
			classes.push({name: mcName, subclass: map[`multiclass${i}_subclass`] || "", level: parseInt(map[`multiclass${i}_level`], 10) || 1});
		}

		// ---- Resolve everything against loaded 5etools data BEFORE touching the store ----
		const raceData = await findByName("race", subraceName || raceName);
		const bgData = await findByName("background", backgroundName);

		const classDataList = [];
		for (const c of classes) {
			const clsData = await findByName("class", c.name);
			const scData = (clsData && c.subclass) ? await findSubclassByName(clsData.name, c.subclass) : null;
			classDataList.push({...c, clsData, scData});
		}

		const invRows = groupRepeating(attribs, "repeating_inventory");
		const itemResolved = [];
		for (const row of invRows) {
			if (!row.itemname) continue;
			const item = (await findByName("item", row.itemname)) || (await findByName("baseitem", row.itemname));
			itemResolved.push({row, item});
		}

		const spellSectionNames = ["repeating_spell-cantrip"].concat(Array.from({length: 9}, (_, i) => `repeating_spell-${i + 1}`));
		const spellRows = [];
		spellSectionNames.forEach(section => groupRepeating(attribs, section).forEach(row => spellRows.push(row)));
		const spellResolved = [];
		for (const row of spellRows) {
			if (!row.spellname) continue;
			const spell = await findByName("spell", row.spellname, row.spellsource);
			spellResolved.push({row, spell});
		}

		const traitRows = groupRepeating(attribs, "repeating_traits");

		// ---- Build the starting store (skeleton + ability scores + HP/AC/currency/proficiencies) ----
		let pos = 100;
		const makeInt = (type) => {
			const id = pcCtx.makeId();
			return {
				id,
				base: {
					_enabled: true, _label: "", type, childIDs: "[]", parentID: "", parentDisabled: false,
					overwriteDisabled: false, builderDisplayName: "", createdTime: Date.now(),
					arrayPosition: pos++, shortID: id, source: "",
				},
			};
		};

		const store = makeBlankPcStore();
		const ints = store.integrants.integrants;

		Object.entries(ABILITY_NAMES).forEach(([ogl, full]) => {
			const value = parseInt(map[ogl] || map[`${ogl}_base`] || "10", 10);
			const {id, base} = makeInt("Ability Score");
			ints[id] = {...base, ability: full, calculation: "Set Value", name: "", valueFormula: {flatValue: value}};
		});

		const hpMax = parseInt(findAttrMax(attribs, "hp") || map.hp || "1", 10);
		const hpCurrent = parseInt(map.hp || String(hpMax), 10);
		{
			const {id, base} = makeInt("Hit Points");
			ints[id] = {...base, hitpointType: "Maximum", isFixed: false, isTemp: false, calculation: "Set Value", name: "", valueFormula: {flatValue: hpMax}};
		}
		store.hitpoints.currentHP = hpCurrent;

		{
			const acValue = parseInt(map.ac || "10", 10);
			const {id, base} = makeInt("Armor Class");
			ints[id] = {...base, defaultAbility: false, calculation: "Set Base", name: "", valueFormula: {flatValue: acValue}};
		}

		store.about.characteristics = {
			size: map.size || "Medium",
			creatureType: "Humanoid",
			alignment: map.alignment || "",
		};
		store.character.creatureType = "Humanoid";
		store.currencies = {
			initialized: true,
			cp: parseInt(map.cp, 10) || 0,
			sp: parseInt(map.sp, 10) || 0,
			ep: parseInt(map.ep, 10) || 0,
			gp: parseInt(map.gp, 10) || 0,
			pp: parseInt(map.pp, 10) || 0,
		};

		// Skill / Saving-Throw proficiencies - driven by what the sheet says was actually chosen,
		// not re-derived from a class's proficiency LIST (which is just the pool of legal choices,
		// not what was picked). Ground-truthed against a real pregen: the OGL sheet does NOT use a
		// simple "1"/"0" flag here - {ability}_save_prof and {skill}_prof hold a roll-formula string
		// (e.g. "(@{pb})" / "(@{pb}*@{skill}_type)") when proficient, and an empty string otherwise.
		// {skill}_type (the prof-vs-expertise multiplier) isn't reliably present as its own stored
		// attrib, so expertise isn't distinguished here - everything comes through as "Proficient".
		// Same "Proficiency" integrant shape already confirmed identical between ogl-translator.js
		// and background-import.js.
		const isChosenProf = (v) => !!v && v !== "0";
		Object.entries(ABILITY_NAMES).forEach(([ogl, full]) => {
			if (!isChosenProf(map[`${ogl}_save_prof`])) return;
			const {id, base} = makeInt("Proficiency");
			ints[id] = {
				...base, name: "Saving Throw Proficiency", category: "Saving Throw", proficiency: full,
				proficiencyLevel: "Proficient", increaseIfAlreadyAt: false, rollAbility: "Query Attribute",
				notes: "", cascades: {}, relations: {},
			};
		});
		Object.entries(SKILL_DISPLAY).forEach(([ogl, display]) => {
			if (!isChosenProf(map[`${ogl}_prof`])) return;
			const {id, base} = makeInt("Proficiency");
			ints[id] = {
				...base, name: "Skill Proficiency", category: "Skill", proficiency: display,
				proficiencyLevel: "Proficient", rollAbility: "Query Attribute", notes: "",
				cascades: {}, relations: {},
			};
		});

		// Spell slots - current count is a word-keyed flat dict (ground-truthed), max count comes
		// from "Spell Slot" integrants built by import2024ClassAtLevel below.
		LEVEL_WORDS.forEach((word, ix) => {
			const total = parseInt(map[`lvl${ix + 1}_slots_total`], 10) || 0;
			const expended = parseInt(map[`lvl${ix + 1}_slots_expended`], 10) || 0;
			if (total) store.spellSlots.currentByLevel[word] = Math.max(0, total - expended);
		});

		// ---- Write the initial store as a real attrib so subsequent import2024* calls (which
		// each do their own getStore/saveStore round-trip) find something to read. ----
		const existingStoreAttr = charModel.attribs.find(a => a.get("name") === "store");
		if (existingStoreAttr) existingStoreAttr.destroy();
		charModel.attribs.push({name: "store", current: JSON.parse(JSON.stringify(store))}).syncedSave();
		await new Promise(r => setTimeout(r, 300)); // let the push land before the next call reads it back

		// ---- Race / Background ----
		if (raceData) {
			await d20plus.importer.import2024Race(charModel, {Vetoolscontent: raceData});
			summary.race = raceData.name;
		}
		if (bgData) {
			await d20plus.importer.import2024Background(charModel, {Vetoolscontent: bgData});
			summary.background = bgData.name;
		}

		// ---- Class(es) / Subclass(es) ----
		for (const c of classDataList) {
			if (!c.clsData) continue;
			await d20plus.importer.import2024ClassAtLevel(charModel, {Vetoolscontent: c.clsData}, c.level);
			if (c.scData) await d20plus.importer.import2024Subclass(charModel, {Vetoolscontent: c.scData}, c.level);
			summary.classes.push(`${c.clsData.name}${c.scData ? ` (${c.scData.shortName || c.scData.name})` : ""} ${c.level}`);
		}

		// ---- Inventory ----
		for (const {row, item} of itemResolved) {
			if (item) {
				const handoutData = await toHandoutData(d20plus.items, item);
				if (handoutData) {
					await d20plus.importer.import2024Item(charModel, handoutData);
					summary.itemsImported++;
					continue;
				}
			}
			summary.itemsFailed.push(row.itemname);
		}

		// ---- Spells ----
		for (const {row, spell} of spellResolved) {
			if (spell) {
				const handoutData = await toHandoutData(d20plus.spells, spell);
				if (handoutData) {
					await d20plus.importer.import2024Spell(charModel, handoutData);
					summary.spellsImported++;
					continue;
				}
			}
			summary.spellsFailed.push(row.spellname);
		}

		// ---- Leftover trait rows / feats: written as plain text "Features" stubs, same pattern
		// feat-import.js already uses (no mechanical effects - see file docblock). Only for rows
		// NOT already covered by a successful import2024Race/Background/ClassAtLevel call above -
		// e.g. Dragonborn species traits already got written properly (with real mechanics, under
		// Species Traits) by import2024Race, so re-stubbing them here from repeating_traits text
		// would just duplicate them under Other. This only catches genuinely uncovered content:
		// homebrew traits, non-English names that failed to resolve, or features from a class that
		// itself failed to resolve (e.g. a class name in another language).
		if (traitRows.length) {
			const releaseLock = await pcCtx.pAcquireStoreLock(charModel);
			try {
				await d20plus.ut.fetchCharAttribs(charModel, true);
				const {attr: storeAttr, store: liveStore} = pcCtx.getStore(charModel);
				if (liveStore) {
					const liveInts = liveStore.integrants.integrants;
					const existingNames = new Set(
						Object.values(liveInts)
							.filter(i => i.type === "Features" && i.name)
							.map(i => i.name.trim().toLowerCase()),
					);
					let livePos = pcCtx.getNextArrayPos(liveStore);
					const stubIds = [];
					traitRows.forEach(row => {
						if (!row.name) return;
						if (existingNames.has(row.name.trim().toLowerCase())) return;
						const {id, base} = pcCtx.makeIntegrantBase("Features", livePos++);
						liveInts[id] = {
							...base, name: row.name, recordName: row.name, description: row.description || "",
							source: row.source || "Trait", parentID: "", childIDs: "[]", cascades: {}, relations: {},
						};
						stubIds.push(id);
						existingNames.add(row.name.trim().toLowerCase());
					});
					if (stubIds.length) {
						pcCtx.pushDisplayOrder(liveStore, "features", "otherDisplayOrder", stubIds);
						pcCtx.saveStore(charModel, storeAttr, liveStore);
						summary.featTraitStubs = stubIds.length;
					}
				}
			} finally {
				releaseLock();
			}
		}

		return summary;
	};
}

SCRIPT_EXTENSIONS.push(d20plus2024PcConverter);
