// ==UserScript==
// @name         betteR20-beta-charactermancer-death-jumpagate-import
// @namespace    https://5e.tools/
// @license      MIT (https://opensource.org/licenses/MIT)
// @version      1.36.1.7-beta-testing
// @updateURL    https://deathstalker471.github.io/betterR20/betteR20-charactermancer.meta.js
// @downloadURL  https://deathstalker471.github.io/betterR20/betteR20-charactermancer.user.js
// @description  Charactermancer for betteR20 (can be disabled independently in Tampermonkey)
// @author       5egmegaanon/astranauta/MrLabRat/TheGiddyLimit/DBAWiseMan/BDeveau/Remuz/Callador Julaan/Erogroth/Stormy/FlayedOne/Cucucc/Cee/oldewyrm/darthbeep/Mertang/Redweller/DeathStalker

// @match        https://app.roll20.net/editor
// @match        https://app.roll20.net/editor#*
// @match        https://app.roll20.net/editor?*
// @match        https://app.roll20.net/editor/
// @match        https://app.roll20.net/editor/#*
// @match        https://app.roll20.net/editor/?*
// @match        https://*.roll20preflight.net/*

// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==


/**
 * Charactermancer Integration
 * Intercepts Roll20's compendium GraphQL API and injects 5etools class/race/background
 * data into the Charactermancer wizard when the user does not own the PHB.
 */
function d20plus2024Charactermancer () {
	const GRAPHQL_HOST = "compendium.production.roll20preflight.net/graphql";
	const CDN_BASE = "https://storage.googleapis.com/roll20-cdn/advanced-sheets-production-9b1f7af9/dnd2024byroll20/assets/compendium";
	const GENERIC_CLASS_IMG    = `${CDN_BASE}/generic-class.png`;
	const GENERIC_SPECIES_IMG  = `${CDN_BASE}/generic-species.svg`;
	const PHB_BOOK = {name: "Player's Handbook", itemId: "5", isOwned: true, systemVersion: "2014", marketplaceLink: null};

	// Roll20 PHB artwork — keyed by class/race name as it appears in 5etools
	const CLASS_IMG = {
		"Barbarian": `${CDN_BASE}/webp/classes/Barbarian-PHB.webp`,
		"Bard":      `${CDN_BASE}/webp/classes/Bard-PHB.webp`,
		"Cleric":    `${CDN_BASE}/webp/classes/Cleric-PHB.webp`,
		"Druid":     `${CDN_BASE}/webp/classes/Druid-PHB.webp`,
		"Fighter":   `${CDN_BASE}/webp/classes/Fighter-PHB.webp`,
		"Monk":      `${CDN_BASE}/webp/classes/Monk-PHB.webp`,
		"Paladin":   `${CDN_BASE}/webp/classes/Paladin-PHB.webp`,
		"Ranger":    `${CDN_BASE}/webp/classes/Ranger-PHB.webp`,
		"Rogue":     `${CDN_BASE}/webp/classes/Rogue-PHB.webp`,
		"Sorcerer":  `${CDN_BASE}/webp/classes/Sorcerer-PHB.webp`,
		"Warlock":   `${CDN_BASE}/webp/classes/Warlock-PHB.webp`,
		"Wizard":    `${CDN_BASE}/webp/classes/Wizard-PHB.webp`,
	};
	const RACE_IMG = {
		"Dragonborn": `${CDN_BASE}/webp/species/Dragonborn-PHB.webp`,
		"Dwarf":      `${CDN_BASE}/webp/species/Dwarf-PHB.webp`,
		"Elf":        `${CDN_BASE}/webp/species/Elf-PHB.webp`,
		"Gnome":      `${CDN_BASE}/webp/species/Gnome-PHB.webp`,
		"Half-Elf":   `${CDN_BASE}/webp/species/Half-Elf-PHB.webp`,
		"Half-Orc":   `${CDN_BASE}/webp/species/Half-Orc-PHB.webp`,
		"Halfling":   `${CDN_BASE}/webp/species/Halfling-PHB.webp`,
		"Human":      `${CDN_BASE}/webp/species/Human-PHB.webp`,
		"Tiefling":   `${CDN_BASE}/webp/species/Tiefling-PHB.webp`,
	};

	const ABV = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};

	// Explicit language list so Language Choice dropdowns populate without depending on
	// Roll20's category(name:"Languages") query (which requires PHB ownership to return data)
	const STD_LANGUAGES = [
		"Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
		"Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon",
	];
	const CASTER_MAP = {"full": "full", "1/2": "half", "1/3": "third", "artificer": "half", "pact": "pact"};
	const SIZE_MAP = {T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan"};
	// 5etools → Roll20 weapon property names
	const ITEM_PROP = {
		F:"Finesse", L:"Light", T:"Thrown", V:"Versatile", "2H":"Two-Handed",
		H:"Heavy", R:"Reach", A:"Ammunition", LD:"Loading", S:"Special",
	};
	// 5etools → Roll20 damage type names
	const ITEM_DMG = {
		B:"Bludgeoning", P:"Piercing", S:"Slashing", N:"Necrotic", F:"Fire",
		C:"Cold", L:"Lightning", A:"Acid", T:"Thunder", R:"Radiant", Y:"Psychic",
		O:"Force", I:"Poison",
	};
	// List name → filter criteria used to query category(name:"Items")
	const STANDARD_LISTS = {
		"Simple Weapons":        [{key:"Subtype",value:"simple"},{key:"Item Rarity",value:"None, Standard"}],
		"Martial Weapons":       [{key:"Subtype",value:"martial"},{key:"Item Rarity",value:"None, Standard"}],
		"Simple Melee Weapons":  [{key:"Subtype",value:"simple"},{key:"Item Type",value:"Melee Weapon"},{key:"Item Rarity",value:"None, Standard"}],
		"Simple Ranged Weapons": [{key:"Subtype",value:"simple"},{key:"Item Type",value:"Ranged Weapon"},{key:"Item Rarity",value:"None, Standard"}],
		"Martial Melee Weapons": [{key:"Subtype",value:"martial"},{key:"Item Type",value:"Melee Weapon"},{key:"Item Rarity",value:"None, Standard"}],
		"Martial Ranged Weapons":[{key:"Subtype",value:"martial"},{key:"Item Type",value:"Ranged Weapon"},{key:"Item Rarity",value:"None, Standard"}],
	};

	const ARMOR_CLEAN = {
		"light": "Light Armor", "medium": "Medium Armor", "heavy": "Heavy Armor",
		"shield": "Shields", "shields": "Shields",
	};
	const WEAPON_CLEAN = {
		"simple": "Simple Weapons", "martial": "Martial Weapons",
		"simple melee": "Simple Weapons", "simple ranged": "Simple Weapons",
		"martial melee": "Martial Weapons", "martial ranged": "Martial Weapons",
	};

	// ── Data cache ───────────────────────────────────────────────────────────

	let _clsP = null, _raceP = null, _bgP = null, _subclsP = null, _featP = null, _subraceP = null, _itemsP = null, _packsP = null, _gearP = null, _spellsP = null, _toolProfsP = null;
	// Cache our synthesised entries by id so page(id:...) queries can be answered
	const _pageCache = new Map();

	// System version of the current character build — set when the user selects a class
	// or species. "2024" → prefer XPHB content; "2014" → prefer PHB content; null → unknown.
	let _buildVersion = null;

	function getClasses () {
		if (!_clsP) _clsP = DataLoader.pCacheAndGetAllSite("class").catch(() => []);
		return _clsP;
	}
	function getSpells () {
		if (!_spellsP) _spellsP = DataLoader.pCacheAndGetAllSite("spell").catch(() => []);
		return _spellsP;
	}
	function getRaces () {
		if (!_raceP) _raceP = DataLoader.pCacheAndGetAllSite("race")
			.then(arr => Renderer.race.mergeSubraces(arr || []))
			.catch(() => []);
		return _raceP;
	}
	function getBackgrounds () {
		if (!_bgP) _bgP = DataUtil.loadJSON(BACKGROUND_DATA_URL)
			.then(d => d.background || [])
			.catch(() => []);
		return _bgP;
	}

	function getItems () {
		if (!_itemsP) {
			_itemsP = (async () => {
				const result = [];
				const seen   = new Set();
				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						if (!data?.baseitem) continue;
						for (const item of data.baseitem) {
							if (!item.name || !item.weaponCategory) continue;
							if (item.type !== "M" && item.type !== "R") continue;
							const key = item.name.toLowerCase();
							if (seen.has(key)) continue;
							seen.add(key);
							result.push(item);
						}
					}
				}
				d20plus.ut.log(`[Charactermancer] Loaded ${result.length} weapon items`);
				return result;
			})().catch(() => []);
		}
		return _itemsP;
	}

	function getGear () {
		if (!_gearP) {
			_gearP = (async () => {
				const result = [];
				const seen   = new Set();
				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						if (!data?.item) continue;
						for (const item of data.item) {
							if (!item.name || item.weaponCategory) continue; // skip weapons (already in getItems)
							// Types can have source suffixes like "G|XPHB" — match on the base type
			const baseType = (item.type || "").split("|")[0];
			if (!["G","AT","A","EXP","INS","GS","MNT","VEH","SHP","AIR","SPC"].includes(baseType)) continue;
							const key = item.name.toLowerCase();
							if (seen.has(key)) continue;
							seen.add(key);
							result.push(item);
						}
					}
				}
				return result;
			})().catch(() => []);
		}
		return _gearP;
	}

	function getPacks () {
		if (!_packsP) {
			_packsP = (async () => {
				const result = [];
				const seen   = new Set();
				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						if (!data?.item) continue;
						for (const item of data.item) {
							if (!item.name || !item.packContents?.length) continue;
							if (item.type !== "G" && item.type !== "G|XPHB") continue;
							const key = item.name.toLowerCase();
							if (seen.has(key)) continue;
							seen.add(key);
							result.push(item);
						}
					}
				}
				return result;
			})().catch(() => []);
		}
		return _packsP;
	}

	// Parse a single packContents entry into {name, qty}
	function packItemToNameQty (raw) {
		let base, qty;
		if (typeof raw === "string") {
			base = cleanItem(raw);
			qty  = 1;
		} else if (raw?.item) {
			const s = raw.item.split("|")[0].replace(/\s*\([^)]*\)\s*$/, "").trim();
			base = s.charAt(0).toUpperCase() + s.slice(1);
			qty  = raw.quantity || 1;
		} else {
			return null;
		}
		return base ? {name: base, qty} : null;
	}

	function getSubraces () {
		if (!_subraceP) {
			_subraceP = (async () => {
				const result = [];

				// Helper: expand a _versions block into synthetic subrace entries
				function expandVersions (raceName, raceSource, source, versionsArr) {
					for (const version of versionsArr) {
						for (const impl of (version._implementations || [])) {
							const vars = impl._variables || {};
							const colorName = vars.color || vars.name;
							if (!colorName) continue;
							result.push({
								name: colorName,
								raceName,
								raceSource,
								source,
								_expandedVars: vars,
								_expandedResist: impl.resist || [],
							});
						}
					}
				}

				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						// Named subraces and subrace _versions
						for (const sub of (data.subrace || [])) {
							if (!sub?.raceName) continue;
							if (sub.name) {
								result.push(sub);
							} else if (sub._versions) {
								expandVersions(sub.raceName, sub.raceSource, sub.source, sub._versions);
							}
						}
						// Top-level races with _versions (e.g. XPHB Dragonborn, FTD variants)
						// These races carry their own ancestry variants — surface them as virtual subraces
						for (const race of (data.race || [])) {
							if (!race?._versions || !race?.name) continue;
							const hasImpls = race._versions.some(v => v._implementations?.length);
							if (!hasImpls) continue;
							expandVersions(race.name, race.source, race.source, race._versions);
						}
					}
				}

				if (result.length) {
					d20plus.ut.log(`[Charactermancer] Loaded ${result.length} subraces (including expanded versions)`);
					return result;
				}
				return DataLoader.pCacheAndGetAllSite("race")
					.then(arr => (arr || []).filter(r => r.raceName && r.name))
					.catch(() => []);
			})().catch(() => []);
		}
		return _subraceP;
	}

	function getSubclasses () {
		if (!_subclsP) {
			_subclsP = (async () => {
				// Class data files contain both "subclass" and "subclassFeature" as separate top-level arrays.
				// Scan JSON_DATA directly so we can join them without a second DataLoader call.
				const result = [];

				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						if (!data?.subclass?.length || !data?.subclassFeature?.length) continue;

						// Build className::shortName → features[] map for this file
						const featMap = {};
						for (const feat of data.subclassFeature) {
							if (!feat?.className || !feat?.subclassShortName) continue;
							const key = `${feat.className}::${feat.subclassShortName}`.toLowerCase();
							(featMap[key] || (featMap[key] = [])).push(feat);
						}

						for (const sub of data.subclass) {
							if (!sub?.name || !sub?.className) continue;
							const key = `${sub.className}::${sub.shortName}`.toLowerCase();
							const enriched = {...sub, _features: featMap[key] || []};
							// Replace any existing entry with same class+shortName (keeps newest/last version)
							const idx = result.findIndex(s =>
								s.className?.toLowerCase() === sub.className?.toLowerCase() &&
								s.shortName?.toLowerCase() === sub.shortName?.toLowerCase());
							if (idx >= 0) result[idx] = enriched;
							else result.push(enriched);
						}
					}
				}

				if (result.length) {
					d20plus.ut.log(`[Charactermancer] Loaded ${result.length} subclasses`);
					return result;
				}

				// Fallback: DataLoader (may not have subclassFeature resolved)
				return DataLoader.pCacheAndGetAllSite("subclass").catch(() => []);
			})().catch(() => []);
		}
		return _subclsP;
	}

	function getFeats () {
		if (!_featP) {
			_featP = (async () => {
				if (typeof JSON_DATA !== "undefined") {
					for (const data of Object.values(JSON_DATA)) {
						if (data && data.feat && data.feat.length > 50) return data.feat;
					}
				}
				return DataLoader.pCacheAndGetAllSite("feat").catch(() => []);
			})().catch(() => []);
		}
		return _featP;
	}

	// Builds a map of proficiency list name → array of proficiency item names from 5etools data.
	// Covers Artisan's Tools (AT), Gaming Sets (GS), Musical Instruments (INS).
	function getToolProfLists () {
		if (!_toolProfsP) {
			_toolProfsP = (async () => {
				const TYPE_MAP = {
					"AT":  "Artisan's Tools Proficiency",
					"GS":  "Gaming Sets Proficiency",
					"INS": "Musical Instruments Proficiency",
					"T": "Other Tool Proficiency",
				};
				// Load all items including base items
				const [allItems, baseItems] = await Promise.all([
					DataLoader.pCacheAndGetAllSite("item").catch(() => []),
					DataLoader.pCacheAndGetAllSite("baseitem").catch(() => []),
				]);
				const combined = [...(allItems || []), ...(baseItems || [])];
				const byList = {};
				const seen = new Set();
				for (const item of combined) {
					const listName = TYPE_MAP[item.type];
					if (!listName) continue;
					// Deduplicate by name (base items + regular items may overlap)
					const key = `${listName}|${item.name.toLowerCase()}`;
					if (seen.has(key)) continue;
					seen.add(key);
					if (!byList[listName]) byList[listName] = [];
					byList[listName].push(item.name);
				}
				// Sort each list alphabetically
				for (const list of Object.values(byList)) list.sort();
				_toolProfsP = byList
				return byList;
			})().catch(() => ({}));
		}
		return _toolProfsP;
	}

	// ── Utilities ────────────────────────────────────────────────────────────

	// Deterministic 24-char hex id from a string seed
	function makeId (seed) {
		let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
		for (let i = 0; i < seed.length; i++) {
			const c = seed.charCodeAt(i);
			h1 = Math.imul(h1 ^ c, 2654435761);
			h2 = Math.imul(h2 ^ c, 1597334677);
		}
		h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
		h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
		const hex = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(24, "0").slice(0, 24);
		return /^[0-9]+$/.test(hex) ? `f${hex.slice(1)}` : hex;
	}

	function stripHtml (html) {
		return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
	}

	function renderDesc (entries) {
		if (!entries?.length) return "";
		const stack = [];
		Renderer.get().recursiveRender({entries}, stack);
		return stripHtml(stack.join(""));
	}

	function cleanProf (raw) {
		return raw.split("|", 1)[0].replace(/\{@[a-z]+\s+/gi, "").replace(/\}/g, "").trim();
	}

	// 5etools sources that belong to the 2024 D&D system
	const SRC_2024 = new Set(["XPHB","XDMG","XMM","TCE2024","PHB2024"]);
	function book (source) {
		return {
			name: Parser.sourceJsonToFull(source) || source,
			itemId: null,
			systemVersion: SRC_2024.has(source) ? "2024" : "",
			isOwned: true,
			cost: 0, marketplaceLink: null, coverImage: null, notForSale: false, bundles: [],
		};
	}

	function pay (obj) { return JSON.stringify(obj); }

	// The About tab's Language dropdown queries category(name:"Proficiencies") filtered by
	// Type matching a "Language" regex (confirmed against the live GraphQL request body) - it's
	// not served by any of the other injected categories, so PHB-less users get nothing there
	// unless we inject synthetic "Language" pages ourselves, same as every other category.
	function languageEntry (name) {
		return {
			id: makeId(`language:${name}`),
			name,
			properties: {"Type": "Language", "Category": "Proficiencies"},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: {name: "Player's Handbook (2024)", itemId: null, systemVersion: "2024", isOwned: true},
		};
	}

	// ── General record builders ───────────────────────────────────────────────

	function choiceRecord(name, choicesCount = 1, parentName = undefined, level = 1) {
		return {
			name: name, parent: parentName, level: level,
			payload: pay({type:"Generic Choice",category:"",replace:false,numOfChoices:choicesCount})
		};
	}

	function defenseRecord(defType, damageType, parentName = undefined, level = 1, isCondition = false) {
		const damageName = damageType.toTitleCase();

		const pl = {type:"Defense",defense:defType};
		if (isCondition)
			pl["condition"] = damageName;
		else
			pl["damage"] = damageName;

		return {
			name: `${damageName} ${defType}`, parent: parentName, level: level,
			payload: pay(pl),
		};
	}

	function defenseRecords(defType, list, level = 1, isCondition = false) {
		const recs = [];

		if (!list || !(list.length > 0))
			return recs;

		// Choice counter in case there are multiple choices
		let choiceNum = 1;

		// Add resistances
		for (r of list) {
			if (r.choose?.from?.length > 0) {
				// Handle choice
				const choiceName = defType + " Choice " + choiceNum;
				recs.push(choiceRecord(choiceName, r.choose.count, undefined, level, isCondition));

				for (choice of r.choose.from) {
					recs.push(defenseRecord(defType, choice, choiceName, level));
				}
			}
			else
				recs.push(defenseRecord(defType, r, undefined, level, isCondition));
		}

		return recs;
	}

	function skillRecord(skill, parentName = undefined, level = 1, isExpertise = false) {
		const name = skill.toTitleCase()

		return {
			name: `${name} ${isExpertise ? "Expertise" : "Proficiency"}`, parent: parentName, level: level,
			payload: pay({type: "Proficiency", category: "Skill", proficiency: name, proficiencyLevel: isExpertise ? "Expertise" : "Proficient"}),
		};
	}

	function skillChoice(name, options, choicesCount = 1, parentName = undefined, level = 1, isExpertise = false) {
		return {
			name: name,
			parent: parentName, level: level,
			payload: pay({
				type: "Proficiency Choice",
				subtype: "Skill",
				proficiencyLevel: isExpertise ? "Expertise" : "Proficient",
				list: options?.map((s)=> s === "any" ? s : s.toTitleCase()) || [],
				numOfChoices: choicesCount || 2,
				increaseIfAlreadyAt: false,
			}),
		};
	}

	function skillRecords(list, sourceName = "", parentName = undefined, level = 1, isExpertise = false) {
		const recs = [];

		if (!list)
			return recs;

		// Choice counter in case there are multiple choices
		let choiceNum = 1;

		// Add skills
		for (const [s, v] of Object.entries(list)) {
			if (v.from?.length > 0 || s === "any") {
				const any = s === "any";

				// Handle choice
				const choiceName = `${sourceName} Skill ${isExpertise ? "Expertise" : "Proficiency"} ${choiceNum > 1 ? '' : choiceNum}`;
				recs.push(skillChoice(choiceName, any ? [s] : v.from, any ? v : v.count || 1, parentName, level, isExpertise));
			}
			else if (Number.isInteger(s))
				recs.push(skillRecord(v, parentName, level, isExpertise));
			else
				recs.push(skillRecord(s, parentName, level, isExpertise));
		}

		return recs;
	}

	function languageRecords(list, parentName = undefined, level = 1) {
		const recs = [];

		// Language proficiencies
		const fixedLangs = Object.entries(list)
			.filter(([k, v]) => v === true && !k.startsWith("any") && k != "other")
			.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
		// "other" language is replaced by language choice. This could be replaced by parsing for the unspecified language.
		const anyLangs = (list.anyStandard || list.any || 0) + (list.other || 0);
		if (fixedLangs.length || anyLangs) {
			const langParent = `${parentName || ""} Languages`;
			recs.push({name: langParent, level: level,
				payload: pay({type: "Features", name: "Languages",
					description: `You can speak${fixedLangs.length ? `, read, and write ${fixedLangs.join(", ")}` : ""}${anyLangs ? ` and ${anyLangs} additional language${anyLangs > 1 ? "s" : ""} of your choice` : ""}.`})});
			for (const lang of fixedLangs) {
				recs.push({name: `${lang} Proficiency`, parent: langParent, level: level,
					payload: pay({type: "Language", name: lang})});
			}
			if (anyLangs) {
				recs.push({name: `${parentName || ""} Language Choice`, parent: langParent, level: level,
					payload: pay({type: "Language Choice", numOfChoices: anyLangs, list: STD_LANGUAGES})});
			}
		}

		return recs;
	}

	// Tool lists must be cached before this function is called
	function parseTools(name, choices = undefined) {
		// Treat name as a choice
		if (name === "any") {
			name = "choose"

			choices = {
				from: Object.keys(BG_TOOL_LIST)
			}
		}

		// Handle choice by calling recursively
		if (name === "choose") {
			const tools = []

			for (const choice of choices.from) {
				tools.push(...parseTools(choice));
			}

			return tools;
		}

		// Check for list
		const listRef = BG_TOOL_LIST[name];
		if (listRef && _toolProfsP) {
			// Use explicit tool names from 5etools data (same approach as native Dwarf class).
			// This avoids a "Lists:..." server query that returns 0 items and grays out the dropdown.
			const listKey = listRef.replace("Lists:", "");
			const toolNames = _toolProfsP[listKey] || [];
			const list = toolNames.length ? toolNames : [listRef];
			return list;
		}

		// Just return a cleaned version of the tool
		return [cleanToolName(name)]
	}

	function toolRecords(toolProfs, parentName = undefined, level = 1) {
		recs = [];

		// - fixed tools and list-choice tools
		for (let [tool, val] of Object.entries(toolProfs)) {
			if (!val) continue;

			// Either return a list to choose from or a cleaned version of one tool
			let tools = parseTools(tool, val);

			if (tools.length > 1) {
				const count = typeof val === "number" ? val : (val.count || 1);
				
				recs.push({
					name: `${tool === "any" ? "Tool" : cleanToolName(tool)} Proficiency`, parent: parentName, level: "1",
					builderDisplayName: "Background Proficiencies",
					payload: pay({type: "Proficiency Choice", subtype: "Tool",
						proficiencyLevel: "Proficient", list: tools, numOfChoices: count,
						increaseIfAlreadyAt: false}),
				});
			} else {
				recs.push({
					name: `${tools[0]} Proficiency`, parent: parentName, level: "1",
					builderDisplayName: "Background Proficiencies",
					payload: pay({type: "Proficiency", category: "Tool", proficiency: tools[0],
						proficiencyLevel: "Proficient", increaseIfAlreadyAt: false}),
				});
			}
		}
    	return recs;
	}

	// ── Class helpers ─────────────────────────────────────────────────────────

	function savingThrows (cls) {
		return (cls.proficiency || []).map(a => ABV[a] || a);
	}

	function subclassLevel (cls) {
		for (let i = 0; i < (cls.classFeatures?.length ?? 0); i++) {
			if ((cls.classFeatures[i] || []).some(f => f?.gainSubclassFeature)) return i + 1;
		}
		return 3;
	}

	function asiLevels (cls) {
		const lvls = [];
		for (let i = 0; i < (cls.classFeatures?.length ?? 0); i++) {
			if ((cls.classFeatures[i] || []).some(f => f?.name === "Ability Score Improvement")) lvls.push(String(i + 1));
		}
		return lvls.length ? lvls : ["4", "8", "12", "16", "19"];
	}

	function armorProfs (cls) {
		return (cls.startingProficiencies?.armor || [])
			.map(a => ARMOR_CLEAN[cleanProf(a).toLowerCase()] || (cleanProf(a).charAt(0).toUpperCase() + cleanProf(a).slice(1)));
	}

	function weaponProfs (cls) {
		return (cls.startingProficiencies?.weapons || [])
			.map(w => WEAPON_CLEAN[cleanProf(w).toLowerCase()] || (cleanProf(w).charAt(0).toUpperCase() + cleanProf(w).slice(1)));
	}

	function startingGold (cls) {
		const hd = cls.hd?.faces ?? 8;
		if (hd >= 10) return "5d4*10";
		if (hd >= 8)  return "4d4*10";
		return "3d4*10";
	}

	// ── Spell slot records (incremental) ──────────────────────────────────────

	function spellSlotRecords (clsName, parentName, table, isPact) {
		const records = [];
		const prev = new Array(10).fill(0);
		let prevPactName = null;

		for (let lvl = 0; lvl < table.length; lvl++) {
			const row = table[lvl] || [];

			if (isPact) {
				// Pact casters: one slot level that changes over time, use overwrite chain
				for (let sp = row.length - 1; sp >= 0; sp--) {
					const cnt = row[sp] || 0;
					if (!cnt) continue;
					const recName = `${clsName} Pact Slots (${lvl + 1})`;
					const rec = {
						name: recName,
						parent: parentName,
						level: String(lvl + 1),
						payload: pay({type: "Spell Slot", spellLevel: sp + 1, calculation: "Set Base", valueFormula: {flatValue: cnt}}),
					};
					if (prevPactName) rec.overwrite = prevPactName;
					records.push(rec);
					prevPactName = recName;
					break;
				}
			} else {
				for (let sp = 0; sp < row.length; sp++) {
					const cnt = row[sp] || 0;
					const old = prev[sp];
					if (cnt === old || cnt === 0) continue;
					records.push({
						name: `${clsName} Level ${sp + 1} Slots (${lvl + 1})`,
						parent: parentName,
						level: String(lvl + 1),
						payload: pay({
							type: "Spell Slot",
							spellLevel: sp + 1,
							calculation: old === 0 ? "Set Base" : "Modify",
							valueFormula: {flatValue: old === 0 ? cnt : cnt - old},
						}),
					});
					prev[sp] = cnt;
				}
			}
		}
		return records;
	}

	// ── Equipment helpers ─────────────────────────────────────────────────────

	const EQUIP_TYPE_MAP = {
		weaponMartial:          "Lists:Martial Weapons",
		weaponMartialMelee:     "Lists:Martial Melee Weapons",
		weaponMartialRanged:    "Lists:Martial Ranged Weapons",
		weaponSimple:           "Lists:Simple Weapons",
		weaponSimpleMelee:      "Lists:Simple Melee Weapons",
		weaponSimpleRanged:     "Lists:Simple Ranged Weapons",
		focusSpellcastingHoly:  "Lists:Holy Symbols",
		focusSpellcastingArcane: "Lists:Arcane Focus",
		focusSpellcastingDruidic: "Lists:Druidic Focus",
		instrumentMusical:      "Lists:Musical Instruments",
		toolArtisan:            "Lists:Artisan's Tools",
	};

	function cleanItem (raw) {
		// "chain mail|phb" → "Chain Mail"
		const s = raw.split("|")[0].trim();
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function parseGold (raw) {
		if (!raw) return "5d4*10";
		const m = raw.match(/(\d+d\d+)/i);
		return m ? m[1] + "*10" : "5d4*10";
	}

	// Convert a single defaultData item to {items, numOfChoices, gold}
	// Keep pack names as a SINGLE item in the items array — the Charactermancer uses this for
	// display and to look up the Items entry.  Individual item expansion happens in buildPackEntry.
	function eqItemToR20 (item) {
		if (typeof item === "string") {
			return {items: [cleanItem(item)], numOfChoices: 1};
		}
		// Named non-purchasable gear (e.g. a Wizard's Spellbook) - not an "item"/"equipmentType"
		// reference, just a plain label to show/grant as-is.
		if (item.special) {
			return {items: [item.special], numOfChoices: 1};
		}
		// A flat currency amount bundled into an equipment option (e.g. "and 5 GP", or an option
		// that's entirely just gold, like "(B) 55 GP"). 5etools stores "value" in copper pieces.
		if (item.value) {
			return {items: [], numOfChoices: 1, gold: item.value / 100};
		}
		// A flavorful override name (e.g. Criminal's "dark common clothes including a hood" instead
		// of the item's plain name "Common clothes") - takes priority over {item}/{equipmentType}'s
		// generic naming when present. Widely used across data/backgrounds.json (Acolyte, Criminal,
		// Sailor, Soldier, dozens more) - the pre-refactor background-only equipment code already
		// handled this; matching that same behavior here so the shared function doesn't regress it.
		if (item.displayName) {
			const name = item.displayName.charAt(0).toUpperCase() + item.displayName.slice(1);
			return {items: [name], numOfChoices: 1};
		}
		if (item.equipmentType) {
			return {
				items: [EQUIP_TYPE_MAP[item.equipmentType] || item.equipmentType],
				numOfChoices: item.quantity || 1,
			};
		}
		if (item.item) {
			const name = cleanItem(item.item);
			const qty  = item.quantity || 1;
			const displayName = qty > 1 ? `${name} (${qty})` : name;
			return {items: [displayName], numOfChoices: 1};
		}
		return {items: [], numOfChoices: 1};
	}

	// Build Starting Equipment records from cls.startingEquipment.defaultData
	// Shared by both the class equipment builder (buildEquipRecords) and the background equipment
	// section (buildBgRecords) - a defaultData-shaped array of groups (each either an always-given
	// `_` list, or an A/B/etc choice) is identical between the two; backgrounds can use the A/B
	// choice form too (e.g. Criminal), not just a flat `_` list like Sage's (lack of any
	// startingEquipment at all) previously suggested. `parentName` is where the top-level
	// fixed/choice records attach - the class version passes its own "Equipment Choice" wrapper,
	// backgrounds pass their own name directly since they have no such wrapper.
	function buildEquipmentGroupRecords (eqData, n, parentName) {
		const recs = [];
		if (!eqData?.length) return recs;

		let choiceIdx = 0;
		for (const group of eqData) {
			const keys = Object.keys(group);

			if (keys.includes("_")) {
				// Always-given fixed items
				const items = group._.flatMap(i => eqItemToR20(i).items);
				if (items.length) {
					recs.push({
						name: `${n} Fixed Equipment`, parent: parentName, level: "1",
						builderDisplayName: "Fixed Equipment", multiclass: "FALSE",
						payload: pay({type: "Starting Equipment", subtype: "fixed", items}),
					});
				}
			} else {
				// A/B (or more) choice
				choiceIdx++;
				const choiceName = `${n} Equipment Choice ${choiceIdx}`;

				// For choices where every option is exactly one named item (no lists, no bundles),
				// put all option names directly in the choice record's items[]. The Charactermancer
				// silently skips binary fixed-child choices but handles items[] correctly.
				const isFlatNamed = Object.values(group).every(optItems => {
					if (optItems.length !== 1) return false;
					const r = eqItemToR20(optItems[0]);
					return r.items.length === 1 && !r.items[0].startsWith("Lists:");
				});

				if (isFlatNamed) {
					const optionItems = keys.map(k => eqItemToR20(group[k][0]).items[0]);
					// When the parent choice builderDisplayName matches a child's name, the Charactermancer
					// queries that item twice and auto-applies it. Use a distinct label for binary choices
					// so the parent and children never share a query key.
					const displayName = optionItems.length === 2
						? `${optionItems[0]} or ${optionItems[1]}`
						: optionItems[0];
					recs.push({
						name: choiceName, parent: parentName, level: "1",
						builderDisplayName: displayName, multiclass: "FALSE",
						payload: pay({type: "Starting Equipment", subtype: "choice", items: [], numOfChoices: 1}),
					});
					for (const [k, v] of Object.entries(group)) {
						const itemName = eqItemToR20(v[0]).items[0];
						// Synthetic record name (e.g. "Cleric Equipment Choice 1 A") prevents
						// the class child record from adding a duplicate dropdown entry alongside
						// the Items compendium entry for the same item name.
						recs.push({
							name: `${choiceName} ${k.toUpperCase()}`, parent: choiceName, level: "1",
							builderDisplayName: itemName, multiclass: "FALSE",
							payload: pay({type: "Starting Equipment", subtype: "fixed", items: [itemName]}),
						});
					}
				} else {
					// Complex choice: multi-item options, or options with list items
					// A short, stable label instead of concatenating every item in the first option
					// (which made the header unreadable, e.g. "Dagger (2) + Thieves' tools + Crowbar
					// + Pouch (2) + Traveler's clothes + 16 GP") - the actual items still show up in
					// this choice's own child records ("Criminal Equipment A"/"B" etc.) and their
					// "You receive" summaries. Only disambiguated with an index on the rare class/
					// background that has more than one such choice (choiceIdx starts at 1).
					const choiceLabel = choiceIdx > 1 ? `${n} Equipment Choice ${choiceIdx}` : `${n} Equipment Choice`;
					recs.push({
						name: choiceName, parent: parentName, level: "1",
						builderDisplayName: choiceLabel, multiclass: "FALSE",
						payload: pay({type: "Starting Equipment", subtype: "choice", items: [], numOfChoices: 1}),
					});

					for (const [opt, optItems] of Object.entries(group)) {
						const label = opt.toUpperCase();

						const listItems  = [];
						const namedItems = [];
						let   numChoices = 1;
						let   goldAmount = 0;

						for (const raw of optItems) {
							const result = eqItemToR20(raw);
							if (result.gold) goldAmount += result.gold;
							for (const it of result.items) {
								if (it.startsWith("Lists:")) { listItems.push(it); numChoices = result.numOfChoices; }
								else namedItems.push(it);
							}
						}

						let primaryRecName;
						if (listItems.length && namedItems.length) {
							const bundleName = `${n} Equipment ${label}`;
							recs.push({
								name: bundleName, parent: choiceName, level: "1",
								builderDisplayName: `${namedItems.join(", ")} + weapon`, multiclass: "FALSE",
								payload: pay({type: "Starting Equipment", subtype: "fixed", items: namedItems}),
							});
							recs.push({
								name: `${n} Equipment ${label} Weapon`, parent: bundleName, level: "1",
								multiclass: "FALSE",
								payload: pay({type: "Starting Equipment", subtype: "choice", items: listItems, numOfChoices: numChoices}),
							});
							primaryRecName = bundleName;
						} else if (listItems.length) {
							const listName = `${n} Equipment ${label}`;
							recs.push({
								name: listName, parent: choiceName, level: "1",
								builderDisplayName: `Option ${label}`, multiclass: "FALSE",
								payload: pay({type: "Starting Equipment", subtype: "choice", items: listItems, numOfChoices: numChoices}),
							});
							primaryRecName = listName;
						} else {
							const recName  = (namedItems.length === 1 && !goldAmount) ? namedItems[0] : `${n} Equipment ${label}`;
							const dispName = [namedItems.join(", "), goldAmount ? `${goldAmount} GP` : ""].filter(Boolean).join(" + ") || `Option ${label}`;
							recs.push({
								name: recName, parent: choiceName, level: "1",
								builderDisplayName: dispName, multiclass: "FALSE",
								payload: pay({type: "Starting Equipment", subtype: "fixed", items: namedItems}),
							});
							primaryRecName = recName;
						}

						// A gold amount bundled into this option (e.g. Wizard's "(A) ... and 5 GP", or
						// an option that's entirely gold, like "(B) 55 GP") - attach as a child
						// Starting Currency record so it's actually granted instead of silently
						// dropped (previously eqItemToR20 had no case for bare {value} entries at all).
						// builderDisplayName keeps the "You receive" summary reading naturally (e.g.
						// "9 GP") instead of leaking this record's internal, prefixed `name` (e.g.
						// "Paladin Equipment A Gold") into the item list - same name/display split
						// every other record in this function already relies on.
						if (goldAmount) {
							recs.push({
								name: `${n} Equipment ${label} Gold`, parent: primaryRecName, level: "1",
								builderDisplayName: `${goldAmount} GP`, multiclass: "FALSE",
								payload: pay({type: "Starting Currency", gold: String(goldAmount)}),
							});
						}
					}
				}
			}
		}

		return recs;
	}

	// Class-specific wrapper: adds the "Equipment Choice"/"Starting Gold" top level (classes have
	// a goldAlternative - "skip all items, just take a dice roll of gold instead" - that backgrounds
	// don't), then delegates the actual defaultData-group processing to the shared function above.
	function buildEquipRecords (cls, basicsName) {
		const recs = [];
		const n = cls.name;
		const goldStr = parseGold(cls.startingEquipment?.goldAlternative);

		const eqChoiceName = `${n} Equipment Choice`;
		recs.push({
			name: eqChoiceName, parent: basicsName, level: "1",
			builderDisplayName: "Equipment Choice", multiclass: "FALSE",
			payload: pay({type: "Starting Equipment", subtype: "choice", items: [], numOfChoices: 1}),
		});
		recs.push({
			name: `${n} Starting Gold`, parent: eqChoiceName, level: "1",
			builderDisplayName: "Starting Currency", multiclass: "FALSE",
			payload: pay({type: "Starting Currency", gold: goldStr}),
		});

		recs.push(...buildEquipmentGroupRecords(cls.startingEquipment?.defaultData, n, eqChoiceName));
		return recs;
	}

// ── Build data-datarecords for a class ────────────────────────────────────

	function buildClassRecords (cls) {
		const recs = [];
		const n = cls.name;
		const basicsName = `${n} Basics`;
		const spellAbility = cls.spellcastingAbility ? ABV[cls.spellcastingAbility] : null;
		const casterType   = spellAbility ? (CASTER_MAP[cls.casterProgression] || "full") : null;
		const isPact       = casterType === "pact";
		const isPooled     = !!cls.preparedSpells || ["half", "third"].includes(casterType);
		const spellTable   = cls.classTableGroups?.find(g => g.rowsSpellProgression)?.rowsSpellProgression;

		// Class Details
		recs.push({
			name: basicsName,
			level: "1",
			payload: pay({
				type: "Class Details",
				subclassName: cls.subclassTitle || `${n} Subclass`,
				suggestedAbilities: savingThrows(cls).slice(0, 2),
				subclassLevel: subclassLevel(cls),
				abilityScoreIncreases: asiLevels(cls),
				...(isPooled ? {isPooledCaster: true} : {}),
			}),
		});

		// Saving throws
		for (const st of savingThrows(cls)) {
			recs.push({
				name: `${st} Saving Throw Proficiency`,
				parent: basicsName, level: "1", multiclass: "FALSE",
				payload: pay({type: "Proficiency", category: "Saving Throw", proficiency: st, proficiencyLevel: "Proficient"}),
			});
		}

		// Hit Dice
		recs.push({
			name: "Hit Dice",
			parent: basicsName, level: "every", multiclass: "FALSE",
			payload: pay({type: "Hit Dice", dieSize: cls.hd?.faces ?? 8, dieCount: 1, recovery: "Long Rest"}),
		});

		// Armor proficiencies
		for (const a of armorProfs(cls)) {
			recs.push({
				name: `${a} Proficiency`,
				parent: basicsName, level: "1",
				payload: pay({type: "Proficiency", category: "Armor", proficiency: a, proficiencyLevel: "Proficient"}),
			});
		}

		// Weapon proficiencies
		for (const w of weaponProfs(cls)) {
			recs.push({
				name: `${w} Proficiency`,
				parent: basicsName, level: "1",
				payload: pay({type: "Proficiency", category: "Weapon", proficiency: w, proficiencyLevel: "Proficient"}),
			});
		}

		
		// Skill proficiencies
		if (cls.startingProficiencies?.skills)
			recs.push(...skillRecords(cls.startingProficiencies.skills[0], n, basicsName))
		
		// Tool proficiencies
		const toolProfs = (cls.startingProficiencies?.toolProficiencies || [])[0] || false;
		if (toolProfs)
			recs.push(...toolRecords(toolProfs, basicsName));

		// Starting equipment choices (gold OR specific items)
		recs.push(...buildEquipRecords(cls, basicsName));

		// Class features per level
		let scAdded = false;

		for (let lvl = 1; lvl <= 20; lvl++) {
			const feats = cls.classFeatures?.[lvl - 1];
			if (!Array.isArray(feats)) continue;

			for (const feat of feats) {
				if (!feat?.name) continue;
				if (feat.gainSubclassFeature) continue;

				const desc = renderDesc(feat.entries);

				if (feat.name === "Ability Score Improvement") {
					recs.push({
						name: `Ability Score Improvement (${lvl})`, level: String(lvl),
						payload: pay({type: "Builder-Exclusive Feature", name: "Ability Score Improvement",
							description: "Your ability scores each increase by 1, or one ability score increases by 2."}),
					});
					continue;
				}

				// Spellcasting feature — add config + spell slot children
				if (feat.name === "Spellcasting" && spellAbility && casterType && !scAdded) {
					scAdded = true;
					const scParent = `${n} Spellcasting`;
					recs.push({name: scParent, level: String(lvl),
						payload: pay({type: "Features", name: feat.name, description: desc})});

					recs.push({
						name: `${n} ${spellAbility} Spellcasting`,
						parent: scParent, level: String(lvl),
						payload: pay({type: "Spellcasting", ability: spellAbility, casterType, name: n}),
					});

					if (spellTable) {
						recs.push(...spellSlotRecords(n, scParent, spellTable, isPact));
					}

					// Cantrip selection (any caster with cantrips at level 1)
					const cantripCount = (cls.cantripProgression || [])[0] || 0;
					if (cantripCount > 0) {
						recs.push({
							name: `${n} Cantrips`, parent: scParent, level: String(lvl),
							builderDisplayName: `${n} Cantrips`,
							payload: pay({type: "Spell Choice", spellLevel: 0, includeBelow: false,
								choices: cantripCount, fromClassList: [n], filter: [], list: [], replace: false}),
						});
					}

					// Per-level spell choices for known-spell casters.
					// Add a Spell Choice at each level where new spells are gained,
					// using the max available spell slot level at that character level.
					const spellProgression = cls.spellsKnownProgression || cls.preparedSpellsProgression || [];
					if (spellProgression.length > 0) {
						// One record per character level where spells are gained — matching
						// Roll20 native behaviour exactly. Native shows separate level sections
						// each with the DELTA at that level (e.g. "Sorcerer Level 1 Spells: 0/2"
						// at level 1, then another "Sorcerer Level 1 Spells: 0/2" at level 2).
						let prevKnown = 0;
						for (let charLvl = 1; charLvl <= spellProgression.length; charLvl++) {
							const knownNow = spellProgression[charLvl - 1] || 0;
							const newSpells = knownNow - prevKnown;
							prevKnown = knownNow;
							if (newSpells <= 0) continue;
							const row = spellTable ? (spellTable[charLvl - 1] || []) : [];
							let maxSlot = 1;
							for (let i = row.length - 1; i >= 0; i--) { if (row[i] > 0) { maxSlot = i + 1; break; } }
							recs.push({
								name: `${n} Level ${maxSlot} Spell Choice ${charLvl}`,
								parent: scParent, level: String(charLvl),
								builderDisplayName: `${n} Level ${maxSlot} Spells`,
								payload: pay({type: "Spell Choice", spellLevel: maxSlot,
									includeBelow: maxSlot > 1, includeCantrips: false,
									choices: newSpells, fromClassList: [n], filter: [], list: [], replace: false}),
							});
						}

						// Replace Spell: at every level from 2+ for known-spell casters.
						// PHB: spellsKnownProgression (no preparedSpellsChange)
						// XPHB: preparedSpellsChange === "level"
						const maxCharLvl = spellProgression.length;
						for (let charLvl = 2; charLvl <= maxCharLvl; charLvl++) {
							if (!(spellProgression[charLvl - 1] > 0)) continue;
							const row = spellTable ? (spellTable[charLvl - 1] || []) : [];
							let maxSlot = 1;
							for (let i = row.length - 1; i >= 0; i--) { if (row[i] > 0) { maxSlot = i + 1; break; } }
							recs.push({
								name: `${n} Replace Spell ${charLvl}`,
								parent: scParent, level: String(charLvl),
								builderDisplayName: `Replace ${n} Spell`,
								payload: pay({type: "Spell Choice", spellLevel: maxSlot,
									includeBelow: true, includeCantrips: false,
									choices: 1, fromClassList: [n], filter: [], list: [], replace: true}),
							});
						}

						// Replace Cantrip: only for classes with preparedSpellsChange:"level"
						// (XPHB 2024 style — PHB 2014 casters don't replace cantrips).
						if (cls.preparedSpellsChange === "level" && cantripCount > 0) {
							for (let charLvl = 2; charLvl <= maxCharLvl; charLvl++) {
								recs.push({
									name: `${n} Replace Cantrip ${charLvl}`,
									parent: scParent, level: String(charLvl),
									builderDisplayName: `Replace ${n} Cantrip`,
									payload: pay({type: "Spell Choice", spellLevel: 0,
										includeBelow: false, includeCantrips: true,
										choices: 1, fromClassList: [n], filter: [], list: [], replace: true}),
								});
							}
						}
					}

					continue;
				}

				recs.push({name: feat.name, level: String(lvl),
					payload: pay({type: "Features", name: feat.name, description: desc})});
			}
		}

		return recs;
	}

	// ── Build data-datarecords for a race ─────────────────────────────────────

	function buildRaceRecords (race) {
		const recs = [];
		const n = race.name;
		const sizeAbv  = (race.size || ["M"])[0];
		const sizeName = SIZE_MAP[sizeAbv] || "Medium";
		const walkSpd  = typeof race.speed === "number" ? race.speed : (race.speed?.walk || 30);
		const otherSpd = Object.keys(race.speed).length > 0 ? race.speed : null;
		const dv       = race.darkvision || 0;

		// Ability score increases
		const abilityEntry = (race.ability || [])[0] || {};
		const staticASIs = Object.entries(abilityEntry).filter(([k]) => k !== "choose");
		if (staticASIs.length) {
			const asiParent = `${n} Ability Score Increase`;
			recs.push({
				name: asiParent,
				builderDisplayName: "Ability Score Increase",
				payload: pay({
					type: "Builder-Exclusive Feature",
					name: "Ability Score Increase",
					description: staticASIs.map(([k, v]) => `Your ${ABV[k] || k} score increases by ${v}.`).join(" "),
				}),
			});
			for (const [abv, val] of staticASIs) {
				recs.push({
					name: `${ABV[abv] || abv} Score Bonus`, parent: asiParent, level: "1",
					payload: pay({type: "Ability Score", ability: ABV[abv] || abv, calculation: "Modify", valueFormula: {flatValue: val}}),
				});
			}
		}

		// Skill proficiencies
		if (race.skillProficiencies)
			recs.push(...skillRecords(race.skillProficiencies[0], n))

		// Size
		recs.push({
			name: `${n} Size`, level: "1", builderDisplayName: `${sizeName} Size`,
			payload: pay({type: "Features", name: "Size", description: `Your size is ${sizeName}.`}),
		});
		recs.push({
			name: `${sizeName} Size`, parent: `${n} Size`, level: "1",
			payload: pay({type: "Size", sizeValue: sizeName}),
		});

		// Speed
		recs.push({
			name: `${n} Speed`, level: "1", builderDisplayName: `${walkSpd} Speed`,
			payload: pay({type: "Features", name: "Speed", description: `Your base walking speed is ${walkSpd} feet.`}),
		});
		recs.push({
			name: "Walk Speed Base", parent: `${n} Speed`, level: "1",
			payload: pay({type: "Speed", speed: "Walk", calculation: "Set Base", valueFormula: {flatValue: walkSpd}}),
		});
		if (otherSpd != null)
			for (spd in otherSpd) {
				if (spd == "walk")
					continue;
				
				const spdName = spd.toTitleCase();
				let spdNum = otherSpd[spd];
				
				if (spdNum === true)
					spdNum = walkSpd;

				recs.push({
					name: `${spdNum} ${spdName} Speed Base`, parent: `${n} Speed`, level: "1",
					payload: pay({type: "Speed", speed: spdName, calculation: "Set Base", valueFormula: {flatValue: spdNum}}),
				});
			}

		// Darkvision
		if (dv) {
			recs.push({
				name: `${n} Darkvision`, level: "1", builderDisplayName: "Darkvision",
				payload: pay({type: "Features", name: "Darkvision",
					description: `You can see in dim light within ${dv} feet as if it were bright light, and in darkness as if it were dim light.`}),
			});
			recs.push({
				name: "Darkvision", parent: `${n} Darkvision`, level: "1",
				payload: pay({type: "Sense", name: "Darkvision", calculation: "Set Base", valueFormula: {flatValue: dv}}),
			});
		}

		// Defenses (Resistances, Vulnerabilities, and Immunities)
		recs.push(...defenseRecords("Resistance", race.resist));
		recs.push(...defenseRecords("Vulnerability", race.vulnerable));
		recs.push(...defenseRecords("Immunity", race.immune));
		recs.push(...defenseRecords("Condition Immunity", race.conditionImmune, 1, true));

		// Feature entries
		for (const entry of (race.entries || [])) {
			if (!entry?.name) continue;
			const desc = renderDesc(entry.entries);
			recs.push({name: entry.name, level: "1",
				payload: pay({type: "Features", name: entry.name, description: desc})});
		}

		// Tool proficiencies
		const toolProfs = (race.toolProficiencies || [])[0] || false;
		if (toolProfs)
			recs.push(...toolRecords(toolProfs));

		// Language proficiencies
		const langProfs = (race.languageProficiencies || [])[0] || false;
		if (langProfs)
			recs.push(...languageRecords(langProfs, n));

		return recs;
	}

	// ── Build data-datarecords for a background ───────────────────────────────

	// Keys that map to a list choice (not a fixed proficiency)
	const BG_TOOL_LIST = {
		anyGamingSet:         "Lists:Gaming Sets Proficiency",
		anyMusicalInstrument: "Lists:Musical Instruments Proficiency",
		anyArtisansTool:      "Lists:Artisan's Tools Proficiency",
		otherTool:			  "Lists:Other Tool Proficiency",
	};

	// Convert a 5etools tool key to a human-readable display name.
	//   "alchemist's supplies" → "Alchemist's Supplies"  (lowercase-with-spaces: title-case each word)
	//   "disguiseKit"          → "Disguise Kit"           (camelCase: split on capitals)
	//   "anyArtisansTool"      → "Artisan's Tool"         (camelCase: split + drop leading "Any ")
	//   "vehicles (land)"      → "Land Vehicles"          (manual override)
	const TOOL_NAME_OVERRIDE = {
		anyArtisansTool:    "Artisan's Tools",
		anyGamingSet:       "Gaming Set",
		anyMusicalInstrument:"Musical Instrument",
		"vehicles (land)":  "Land Vehicles",
		"vehicles (water)": "Water Vehicles",
		"vehicles (space)": "Space Vehicles",
	};
	function cleanToolName(key) {
		if (TOOL_NAME_OVERRIDE[key]) return TOOL_NAME_OVERRIDE[key];
		if (key.includes(" ")) {
			return key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
		}
		// camelCase split + drop leading "Any "
		const spaced = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
		return spaced.replace(/^Any\s+/i, "").trim();
	}

	const BG_GOLD = {
		Noble: 25, Knight: 25, Hermit: 5, Outlander: 10,
		"Folk Hero": 10, Sage: 10, Soldier: 10, Sailor: 10, Pirate: 10,
	};

	function bgTableRows (table) {
		return (table.rows || []).map(r => Array.isArray(r) ? r[r.length - 1] : "").filter(Boolean);
	}

	// Extract personality tables and specialty tables from a background's entries
	function extractBgTables (bg) {
		const result = {traits: [], ideals: [], bonds: [], flaws: [], specialty: [], specialtyName: null};
		for (const section of (bg.entries || [])) {
			if (!section || typeof section !== "object") continue;
			const isSugChar = /suggested characteristics/i.test(section.name || "");
			for (const entry of (section.entries || [])) {
				if (!entry || entry.type !== "table") continue;
				const label = entry.colLabels && entry.colLabels[1];
				const rows  = bgTableRows(entry);
				if (isSugChar) {
					if (label === "Personality Trait") result.traits = rows;
					else if (label === "Ideal")        result.ideals  = rows;
					else if (label === "Bond")         result.bonds   = rows;
					else if (label === "Flaw")         result.flaws   = rows;
				} else if (rows.length) {
					result.specialty     = rows;
					result.specialtyName = section.name || label || "Specialty";
				}
			}
		}
		return result;
	}

	function buildBgRecords (bg, featByKey) {
		const recs = [];
		const n = bg.name;

		// Top-level background record
		const bgDesc = (bg.entries || []).filter(e => typeof e === "string").join(" ").trim();
		recs.push({name: n, level: "1",
			payload: pay({type: "Background", name: n, description: bgDesc})});

		// Skill proficiencies
		if (bg.skillProficiencies)
			recs.push(...skillRecords(bg.skillProficiencies[0], n, n))

		// Tool proficiencies
		const toolProfs = (bg.toolProficiencies || [])[0] || false;
		if (toolProfs)
			recs.push(...toolRecords(toolProfs, n));

		// Language proficiency choice
		const langProfs = (bg.languageProficiencies || [])[0] || false;
		if (langProfs)
			recs.push(...languageRecords(langProfs, n));

		// Starting equipment — some backgrounds only grant a flat "_" list (Sage grants none at
		// all), but others use the exact same A/B choice structure classes do (e.g. Criminal:
		// dagger/tools/crowbar/pouches/clothes + 16 GP, or 50 GP) - reuse the shared class equipment
		// logic instead of a second, `_`-only implementation that silently produced zero records
		// for any background using the A/B form. No top-level "Equipment Choice"/"Starting Gold"
		// wrapper here (backgrounds have no goldAlternative - no "skip items, just take gold"
		// option exists in the source data - and Starting Currency at the top level was previously
		// found to render as a confusing selectable item, hence the parent is the background name
		// directly rather than a synthetic choice wrapper).
		recs.push(...buildEquipmentGroupRecords(bg.startingEquipment, n, n));

		// Entry sections (Features + specialty tables), skip Suggested Characteristics
		for (const section of (bg.entries || [])) {
			if (!section?.name || section.type === "list") continue;
			if (/suggested characteristics/i.test(section.name)) continue;

			// Check for a specialty table inside this section
			const specialtyTable = (section.entries || []).find(e => e?.type === "table");

			// Feature description (skip pure-string paragraphs already in bgDesc)
			const featDesc = renderDesc(section.entries);
			recs.push({name: section.name, parent: n, level: "1",
				payload: pay({type: "Features", name: section.name, description: featDesc})});

			if (specialtyTable) {
				const colLabel = specialtyTable.colLabels && specialtyTable.colLabels[1];
				const options  = bgTableRows(specialtyTable);
				if (options.length) {
					recs.push({
						name: `${section.name} Table`, parent: section.name, level: "1",
						payload: pay({type: "Personality Trait Choice",
							name: colLabel || "Specialty", numOfChoices: 1, options}),
					});
				}
			}
		}

		// Suggested Characteristics section — Personality Traits, Ideals, Bonds, Flaws
		const sugChar = (bg.entries || []).find(e => e?.name && /suggested characteristics/i.test(e.name));
		if (sugChar) {
			const sugDesc = (sugChar.entries || []).filter(e => typeof e === "string").join(" ").trim();
			const sugName = `${n} Suggested Characteristics`;
			recs.push({name: sugName, parent: n, level: "1",
				payload: pay({type: "Features", name: `${n} Suggested Characteristics`, description: sugDesc})});

			const labelMap = {
				"Personality Trait": {payloadName: "Personality Traits", choices: 2},
				"Ideal": {payloadName: "Ideals", choices: 1},
				"Bond":  {payloadName: "Bonds",  choices: 1},
				"Flaw":  {payloadName: "Flaws",  choices: 1},
			};
			for (const entry of (sugChar.entries || [])) {
				if (!entry || entry.type !== "table") continue;
				const rawLabel = entry.colLabels && entry.colLabels[1];
				const spec     = labelMap[rawLabel];
				if (!spec) continue;
				const options  = bgTableRows(entry);
				if (options.length) {
					recs.push({
						name: `${n} ${spec.payloadName}`, parent: sugName, level: "1",
						payload: pay({type: "Personality Trait Choice",
							name: spec.payloadName, numOfChoices: spec.choices, options}),
					});
				}
			}
		}

		// 2024 (XPHB) ability score options — native Roll20 uses "Ability Score Choice" type
		if (bg.ability) {
			// Use entry[0] for the themed ability pool (e.g. Int/Wis/Cha for Acolyte).
			// XPHB format: weights:[2,1] gives total=3; split as (total-1)+1 = 2+1 records,
			// matching native Roll20's "Select 2 ability score(s) +1" / "Select 1 ability score(s) +1".
			// excludeFrom:"Local" on the first record prevents the same score appearing in both.
			const ab = bg.ability[0];

			if (ab?.choose?.weighted) {
				const pool  = (ab.choose.weighted.from || []).map(a => ABV[a] || a);
				const total = (ab.choose.weighted.weights || [1]).reduce((s, w) => s + w, 0);
				recs.push({name: `${n} Ability Score Choice`, parent: n, level: "1",
					builderDisplayName: "Background Ability Scores",
					builderDisplayDescription: `Increase one of these scores by 2 and a different one by 1, or increase all three by 1. None of these increases can raise a score above 20. ${pool.join(", ")}\r\n`,
					payload: pay({type: "Ability Score Choice", choose: total - 1, from: pool, increase: 1, excludeFrom: "Local"})});
				recs.push({name: `${n} Ability Score Choice 2`, parent: n, level: "1",
					payload: pay({type: "Ability Score Choice", choose: 1, from: pool, increase: 1})});
			} else if (ab?.choose) {
				const from   = (ab.choose.from || []).map(a => ABV[a] || a);
				const count  = ab.choose.count  || 1;
				const amount = ab.choose.amount || 1;
				recs.push({name: `${n} Ability Score Choice`, parent: n, level: "1",
					payload: pay({type: "Ability Score Choice", choose: count, from: from, increase: amount})});
			} else if (ab) {
				for (const [k, v] of Object.entries(ab)) {
					if (k === "choose" || k === "hidden" || typeof v !== "number") continue;
					recs.push({name: `${ABV[k] || k} Score Bonus`, parent: n, level: "1",
						payload: pay({type: "Ability Score", ability: ABV[k] || k,
							calculation: "Modify", valueFormula: {flatValue: v}})});
				}
			}
		}

		// 2024 (XPHB) origin feat — use "Feat Attach" to reference the native compendium feat.
		// The limitations object pre-selects the spell list variant (e.g. "Magic Initiate - Cleric").
		if (bg.feats) {
			for (const featGroup of bg.feats) {
				for (const featKey of Object.keys(featGroup)) {
					if (!featKey || featKey === "choose") continue;
					// featKey format: "magic initiate; cleric|xphb"
					const [nameVariant] = featKey.split("|");
					const [baseName, variant = ""] = nameVariant.split(";").map(s => s.trim());
					const baseFeatName = baseName.replace(/\b\w/g, c => c.toUpperCase()).trim();
					const variantTitle = variant ? variant.charAt(0).toUpperCase() + variant.slice(1) : "";
					const payload = {type: "Feat Attach", feats: [baseFeatName]};
					if (variantTitle) {
						payload.limitations = {
							choiceName:  `${baseFeatName} Spell List Choice`,
							optionNames: [`${baseFeatName} - ${variantTitle}`],
						};
					}
					recs.push({
						name: `${n} Origin Feat`, parent: n, level: "1",
						...(variantTitle ? {builderDisplayDescription: `${variantTitle} Spell List`} : {}),
						payload: pay(payload),
					});
				}
			}
		}

		return recs;
	}

	// ── Charactermancer entry builders ────────────────────────────────────────

	function classEntry (cls) {
		const sts = savingThrows(cls);
		const spellAbility = cls.spellcastingAbility ? ABV[cls.spellcastingAbility] : null;
		const casterType   = spellAbility ? (CASTER_MAP[cls.casterProgression] || "full") : null;
		const entry = {
			id: makeId(`class:${cls.name}:${cls.source}`),
			name: cls._displayName || cls.name,
			properties: {
				"Category": "Classes",
				"Hit Die": `d${cls.hd?.faces ?? 8}`,
				"data-List": "false",
				"data-builderImage": CLASS_IMG[cls.name] || GENERIC_CLASS_IMG,
				"data-datarecords": JSON.stringify(buildClassRecords(cls)),
				"data-Saving Throws": JSON.stringify(sts),
				"data-Subclass Level": subclassLevel(cls),
				"data-Ability Score Levels": JSON.stringify(asiLevels(cls)),
				...(spellAbility ? {"Caster Progression": casterType, "Spellcasting Ability": spellAbility} : {}),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(cls.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	function raceEntry (race) {
		const sizeAbv  = (race.size || ["M"])[0];
		const sizeName = SIZE_MAP[sizeAbv] || "Medium";
		const walkSpd  = typeof race.speed === "number" ? race.speed : (race.speed?.walk || 30);
		const entry = {
			id: makeId(`race:${race.name}:${race.source}`),
			name: race._displayName || race.name,
			properties: {
				"Category": "Races",
				"Size": sizeName,
				"Speed": walkSpd,
				"data-List": "false",
				"data-builderImage": RACE_IMG[race.name] || GENERIC_SPECIES_IMG,
				"data-datarecords": JSON.stringify(buildRaceRecords(race)),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(race.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	function bgEntry (bg, featByKey) {
		const tables = extractBgTables(bg);
		const gold   = BG_GOLD[bg.name] ?? 15;

		// Derive filter-Origin Feat from bg.feats (e.g. "magic initiate; cleric|xphb" → "Magic Initiate")
		let originFeatName = null;
		if (bg.feats?.length) {
			const firstKey = Object.keys(bg.feats[0] || {})[0] || "";
			if (firstKey && firstKey !== "choose") {
				const [nameVariant] = firstKey.split("|");
				const [baseName] = nameVariant.split(";").map(s => s.trim());
				originFeatName = baseName.replace(/\b\w/g, c => c.toUpperCase()).trim();
			}
		}

		// Derive filter-Ability Score from bg.ability pool (themed scores for XPHB backgrounds)
		let abilityScoreFilter = null;
		const ab0 = bg.ability?.[0];
		if (ab0?.choose?.weighted) {
			abilityScoreFilter = (ab0.choose.weighted.from || []).map(a => ABV[a] || a).join(", ");
		} else if (ab0?.choose?.from) {
			abilityScoreFilter = (ab0.choose.from || []).map(a => ABV[a] || a).join(", ");
		}

		const entry  = {
			id: makeId(`bg:${bg.name}:${bg.source}`),
			name: bg._displayName || bg.name,
			properties: {
				"Category": "Backgrounds",
				"data-List": "false",
				"filter-Feat": bg.feats?.length ? "Yes" : "No",
				...(originFeatName   ? {"filter-Origin Feat":   originFeatName}   : {}),
				...(abilityScoreFilter ? {"filter-Ability Score": abilityScoreFilter} : {}),
				"data-datarecords": JSON.stringify(buildBgRecords(bg, featByKey)),
				"data-Starting Gold": gold,
				...(tables.traits.length  ? {"data-Personality Traits": JSON.stringify(tables.traits)} : {}),
				...(tables.bonds.length   ? {"data-Bonds":              JSON.stringify(tables.bonds)}  : {}),
				...(tables.flaws.length   ? {"data-Flaws":              JSON.stringify(tables.flaws)}  : {}),
				...(tables.ideals.length  ? {"data-Ideals":             JSON.stringify(tables.ideals)} : {}),
				...(tables.specialty.length ? {
					"data-Background Choices":    JSON.stringify(tables.specialty),
					"data-Background Choice Name": tables.specialtyName,
				} : {}),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(bg.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	// ── Spell entry ──────────────────────────────────────────────────────────

	// Builds spell integrant "records" ({name, parent, payload}, keyed by name/parent rather than
	// ID like the store) using the exact same parsing primitives as regular drag-and-drop spell
	// import (d20plus.import2024.spellPlan, set up in 5etools-2024-spell-import.js) - so
	// Charactermancer-created spells get the same "auto" spellcasting-modifier ability, the same
	// scalingLevelDice-driven multi-instance handling (Booming Blade, Green-Flame Blade, Toll the
	// Dead), and the same repeat/projectile handling (Magic Missile) as everything else, instead
	// of a second, separately-maintained implementation.
	function buildSpellBuilderRecords (spell) {
		const sp = d20plus.import2024.spellPlan;
		const univSp = d20plus.spellParsers; // cross-sheet primitives (areaTagToShape/parseAoeSize)
		const n  = spell.name;
		const recs = [];
		const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

		// Components object
		const comp = spell.components || {};
		const components = {};
		if (comp.v) components.verbal = true;
		if (comp.s) components.somatic = true;
		if (comp.m) {
			components.material = true;
			components.materialDescription = typeof comp.m === "string" ? comp.m : (comp.m.text || "");
		}

		// Casting time and duration
		const castingTimeBase = sp.parseCastingTime(spell.time);
		const isRitual = !!(spell.meta && spell.meta.ritual);
		const castingTime = isRitual ? `${castingTimeBase} or Ritual` : castingTimeBase;
		const duration = sp.parseDuration(spell.duration);

		// Concentration
		const isConcentration = (spell.duration || []).some(d => d.concentration);

		// AoE
		const aoeShape = spell.areaTags && spell.areaTags.length ? univSp.areaTagToShape(spell.areaTags[0]) : "";
		const aoeSize  = univSp.parseAoeSize(spell.entries);
		const aoe = (aoeShape && aoeSize) ? {shape: aoeShape, size: aoeSize} : null;

		// Description — use renderDesc which strips HTML and 5etools tags
		const description = renderDesc(spell.entries || []).trim();

		// Upcast text
		let upcastText = "";
		if (spell.entriesHigherLevel?.length) {
			upcastText = renderDesc(spell.entriesHigherLevel[0].entries || []).trim();
		}

		// Main spell record
		recs.push({
			name: n, level: String(spell.level),
			payload: pay({
				type: "Spell", name: n, description,
				...(upcastText ? {upcastText} : {}),
				level: spell.level,
				school: Parser.spSchoolAbvToFull(spell.school),
				castingTime, range: Parser.spRangeToFull(spell.range),
				duration,
				...(isConcentration ? {concentration: true} : {}),
				...(isRitual ? {ritual: true} : {}),
				components,
				...(aoe ? {aoe} : {}),
			}),
		});

		// Determine attack chain - mirrors import2024Spell's decision structure exactly so both
		// consumers agree on which spells get which chain shape.
		const hasSave         = !!(spell.savingThrow && spell.savingThrow.length);
		const hasSpellAtk     = !!(spell.spellAttack && spell.spellAttack.length);
		const hasDamage       = !!(spell.damageInflict && spell.damageInflict.length);
		const isCantrip       = spell.level === 0;
		const isCantripScaling = isCantrip && (spell.miscTags || []).includes("SCL");
		const scalingLevelDice = spell.scalingLevelDice;
		const isDiceScaling   = isCantripScaling && !!scalingLevelDice;
		const isMultiDamage   = isDiceScaling && Array.isArray(scalingLevelDice) && scalingLevelDice.length > 1;
		const cantripLevels   = (isCantripScaling && (hasSave || hasSpellAtk || hasDamage)) ? sp.parseCantripLevels(spell) : [];
		const {isAutoHit, repeatCount, rayRepeat, isMultiRay} = sp.parseAttackShape(spell, isCantripScaling);

		if (isMultiDamage) {
			// Multi-instance cantrip chains (Booming Blade, Green-Flame Blade, Toll the Dead) - one
			// Attack+Damage(+Upcasting) record chain per scalingLevelDice entry, identical to
			// import2024Spell's handling of the same spells.
			const damageType = cap(spell.damageInflict[0]);
			const multiDamageEntries = sp.parseMultiDamageEntries(scalingLevelDice, cantripLevels, damageType);
			for (const entry of multiDamageEntries) {
				const suffix = `(${entry.label})`;
				const atkName = `${n} ${suffix}`;
				const dmgName = `${n} ${suffix} Damage`;
				const attackPayload = {
					type: "Attack", name: atkName,
					attack: {type: hasSave ? "Spell Save" : "Spell Attack"},
					...(aoe ? {aoe} : {}),
				};
				if (hasSave) {
					attackPayload.save = {saveAbility: cap(spell.savingThrow[0]), onFail: entry.onFailText};
				}
				recs.push({name: atkName, parent: n, payload: pay(attackPayload)});

				const dmgPayload = {
					type: "Damage", ability: entry.ability,
					damageType: entry.damageType,
					...(entry.isFlatOnly ? {} : {diceCount: entry.diceCount, diceSize: entry.diceSize}),
				};
				recs.push({name: dmgName, parent: atkName, payload: pay(dmgPayload)});

				for (const lvl of entry.upcastLevels) {
					recs.push({name: `${dmgName} Upcast ${lvl}`, parent: dmgName, payload: pay({
						type: "Upcasting", mode: "Specific Character Level", startingLevel: lvl,
						level: 1, target: "$.diceCount", value: 1, changeMode: "Add",
					})});
				}
			}
		} else if (hasDamage || hasSave || hasSpellAtk) {
			const atkName   = `${n} Attack`;
			const dmgParsed = sp.parseDamage(spell.entries);

			// Attack record
			let attackPayload;
			if (hasSave) {
				attackPayload = {
					type: "Attack", name: n,
					save: {saveAbility: cap(spell.savingThrow[0]), onFail: dmgParsed ? `${dmgParsed.diceCount}${dmgParsed.diceSize} ${cap(spell.damageInflict[0])} damage.` : "Take damage.", onSucceed: "Half damage."},
					...(aoe ? {aoe} : {}),
				};
			} else {
				const atkType = spell.spellAttack && spell.spellAttack[0] === "M" ? "Melee Spell Attack" : "Spell Attack";
				attackPayload = {
					type: "Attack", name: n,
					attack: {type: atkType},
					range: Parser.spRangeToFull(spell.range),
					...(aoe ? {aoe} : {}),
				};
				// Repeat/projectile handling (Magic Missile's 3 darts, Scorching Ray's multiple rays,
				// Armor of Agathys' reactive proc) - matches import2024Spell's Attack.repeat field.
				if (isAutoHit && repeatCount > 1) attackPayload.repeat = repeatCount;
				if (isMultiRay) attackPayload.repeat = rayRepeat;
			}
			recs.push({name: atkName, parent: n, payload: pay(attackPayload)});

			// Damage record(s)
			if (dmgParsed) {
				const dmgName = `${n} Damage`;
				const dmgPayload = {
					type: "Damage", ability: sp.hasCastingModDamage(spell.entries) ? "auto" : "none",
					damageType: cap(spell.damageInflict[0]),
					diceCount: dmgParsed.diceCount, diceSize: dmgParsed.diceSize,
					...(dmgParsed.flatBonus ? {_bonus: dmgParsed.flatBonus} : {}),
				};
				recs.push({name: dmgName, parent: atkName, payload: pay(dmgPayload)});

				// Second damage type (spells with two genuinely different simultaneous damage
				// types, e.g. Ice Knife - distinct from isMultiDamage's per-level-scaled instances).
				if (spell.damageInflict.length > 1) {
					const multiTypes = univSp.parseAllTypedDamages(spell.entries, spell.damageInflict);
					if (multiTypes.length > 1) {
						const p2 = multiTypes[1];
						recs.push({name: `${n} Damage 2`, parent: atkName, payload: pay({
							type: "Damage", ability: "none",
							damageType: cap(p2.damageType || spell.damageInflict[1]),
							diceCount: p2.diceCount, diceSize: p2.diceSize,
						})});
					}
				}

				// Upcasting
				const upcast = sp.parseDamageUpcast(spell.entriesHigherLevel);
				if (upcast) {
					const mode = upcast.stepLevels > 1 ? `Per ${upcast.stepLevels} Spell Levels` : "Per X Spell Level";
					recs.push({name: `${n} Damage Upcast`, parent: dmgName, payload: pay({
						type: "Upcasting", mode, startingLevel: upcast.startingLevel,
						level: upcast.stepLevels || 1, target: upcast.targetBonus ? "$._bonus" : "$.diceCount",
						value: upcast.value, changeMode: "Add",
					})});
				}

				// Cantrip scaling
				if (isCantrip) {
					for (const lvl of cantripLevels) {
						recs.push({name: `${n} Cantrip ${lvl}`, parent: dmgName, payload: pay({
							type: "Upcasting", mode: "Cantrip Level", startingLevel: lvl,
							level: 1, target: "$.diceCount", value: 1, changeMode: "Add",
						})});
					}
				}
			}
		}

		// Healing spells
		const isHeal = !hasDamage && (spell.miscTags || []).includes("HL");
		if (isHeal) {
			const healDice = sp.parseHeal(spell.entries);
			if (healDice) {
				recs.push({name: `${n} Healing`, parent: n, payload: pay({
					type: "Healing", ability: sp.hasCastingModDamage(spell.entries) ? "auto" : "none", isTemp: false,
					diceCount: healDice.diceCount, diceSize: healDice.diceSize,
					...(healDice.bonus ? {_bonus: healDice.bonus} : {}),
				})});
				const healUp = sp.parseHealUpcast(spell.entriesHigherLevel);
				if (healUp) {
					recs.push({name: `${n} Healing Upcast`, parent: `${n} Healing`, payload: pay({
						type: "Upcasting", mode: "Per X Spell Level", startingLevel: healUp.startingLevel,
						level: healUp.stepLevels || 1,
						target: healUp.targetBonus ? "$._bonus" : "$.diceCount",
						value: healUp.value, changeMode: "Add",
					})});
				}
			}
		}

		return recs;
	}

	function spellEntry (spell) {
		if (!d20plus.import2024 || !d20plus.import2024.spellPlan) return null;
		const sp = d20plus.import2024.spellPlan;
		const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
		const classList = ((spell.classes || {}).fromClassList || []).map(c => cap(c.name));
		const compObj   = spell.components || {};
		const compParts = [];
		if (compObj.v) compParts.push("V");
		if (compObj.s) compParts.push("S");
		if (compObj.m) compParts.push("M");
		const compStr = compParts.join(" ");

		const isRitual    = !!(spell.meta && spell.meta.ritual);
		const isConc      = (spell.duration || []).some(d => d.concentration);
		const castingBase = sp.parseCastingTime(spell.time);
		const castingTime = isRitual ? `${castingBase} or Ritual` : castingBase;

		const id = makeId(`spell:${spell.name}:${spell.source}`);
		const records = buildSpellBuilderRecords(spell);
		const entry = {
			id,
			name: spell._displayName || spell.name,
			properties: {
				"Category":             "Spells",
				"Level":                spell.level,
				"School":               Parser.spSchoolAbvToFull(spell.school),
				"Classes":              classList.join(", "),
				"Duration":             sp.parseDuration(spell.duration),
				"data-List":            "false",
				"Components":           compStr,
				"Casting Time":         castingTime,
				"filter-Level":         spell.level,
				"filter-Ritual":        isRitual ? "Yes" : "No",
				"filter-Concentration": isConc   ? "Yes" : "No",
				"data-datarecords":     JSON.stringify(records),
			},
			children:  [],
			publisher: {name: "5etools", logoUrl: ""},
			book:      book(spell.source),
		};
		_pageCache.set(id, entry);
		return entry;
	}

	// ── Feat helpers ──────────────────────────────────────────────────────────

	function prereqToString (prereqs) {
		if (!prereqs) return "";
		const parts = [];
		for (const p of prereqs) {
			const lvl = p.level;
			if (lvl != null) parts.push(`Level ${typeof lvl === "object" ? lvl.level : lvl}`);
			if (p.ability) p.ability.forEach(ab => Object.entries(ab).forEach(([k, v]) => parts.push(`${ABV[k] || k} ${v}+`)));
			if (p.spellcasting) parts.push("Spellcasting");
			if (p.feature) parts.push(typeof p.feature === "string" ? p.feature : p.feature.name || "Feature");
			if (p.proficiency) p.proficiency.forEach(pr => parts.push(Object.values(pr)[0] + " proficiency"));
			if (p.other) parts.push(p.other);
		}
		return parts.join(", ");
	}

	function buildFeatRecords (feat) {
		const recs = [];
		const n    = feat.name;
		const desc = renderDesc(feat.entries);
		recs.push({name: n, level: "1", payload: pay({type: "Features", name: n, description: desc})});

		// Detect multi-class spell list feats (Magic Initiate, Fey-Touched, etc.):
		// additionalSpells has multiple entries, each for a different class.
		// These need the native Roll20 hierarchical structure:
		//   Spellcasting Ability Choice → INT/WIS/CHA options
		//   Spell List Choice → Class options (Magic Initiate - Cleric, etc.)
		//     each class option → Spell Choice cantrips + level spell + replace
		// This matches native XPHB Magic Initiate exactly, allowing Feat Attach
		// limitations.optionNames to pre-select a specific class.
		const isMultiClass = (feat.additionalSpells?.length ?? 0) > 1;

		// Ability score grants (fixed and choose)
		let hasSpellcastingAbilityChoice = false;
		for (const ab of (feat.ability || [])) {
			if (ab.hidden) continue;
			for (const [k, v] of Object.entries(ab)) {
				if (k === "choose" || k === "hidden" || k === "max") continue;
				if (typeof v === "number") {
					recs.push({
						name: `${ABV[k] || k} Score Bonus`, parent: n, level: "1",
						payload: pay({type: "Ability Score", ability: ABV[k] || k, calculation: "Modify", valueFormula: {flatValue: v}}),
					});
				}
			}
			if (ab.choose) {
				const from = (ab.choose.from || []).map(a => ABV[a] || a);
				if (!from.length) continue;
				if (isMultiClass) {
					// For multi-class spell feats the ability choice is the spellcasting
					// ability (INT/WIS/CHA), not an ASI — generate Generic Choice + Spellcasting.
					const choiceName = `${n} Spellcasting Ability Choice`;
					recs.push({name: choiceName, parent: n,
						payload: pay({type: "Generic Choice", category: "", replace: false, numOfChoices: 1})});
					for (const abil of from) {
						recs.push({
							name: `${n} ${abil} Spellcasting DC`, parent: choiceName,
							builderDisplayName: abil,
							payload: pay({type: "Spellcasting", ability: abil, casterType: "other", name: n}),
						});
					}
					hasSpellcastingAbilityChoice = true;
				} else {
					// Regular feat ASI choice
					recs.push({
						name: `${n} Ability Score`, parent: n, level: "1",
						payload: pay({type: "Ability Score Choice",
							from: from, choose: ab.choose.count || 1, increase: ab.choose.amount || 1}),
					});
				}
			}
		}

		// Multi-class spell feats (Magic Initiate) store the spellcasting ability choice
		// inside each additionalSpells entry as entry.ability.choose (e.g. ["int","wis","cha"]),
		// NOT in feat.ability at the top level. Generate it from there if not already done.
		if (isMultiClass && !hasSpellcastingAbilityChoice) {
			const abilityFrom = feat.additionalSpells
				?.find(e => e.ability?.choose?.length)
				?.ability?.choose ?? [];
			const abilities = abilityFrom.map(a => ABV[a] || a).filter(Boolean);
			if (abilities.length) {
				const choiceName = `${n} Spellcasting Ability Choice`;
				recs.push({name: choiceName, parent: n,
					payload: pay({type: "Generic Choice", category: "", replace: false, numOfChoices: 1})});
				for (const abil of abilities) {
					recs.push({
						name: `${n} ${abil} Spellcasting DC`, parent: choiceName,
						builderDisplayName: abil,
						payload: pay({type: "Spellcasting", ability: abil, casterType: "other", name: n}),
					});
				}
			}
		}

		// Skill proficiencies
		if (feat.skillProficiencies)
			recs.push(...skillRecords(feat.skillProficiencies[0], n, n));

		// Tool proficiencies
		const toolProfs = (feat.toolProficiencies || [])[0] || false;
		if (toolProfs)
			recs.push(...toolRecords(toolProfs, n));

		// Defenses
		recs.push(...defenseRecords("Resistance", feat.resist));
		recs.push(...defenseRecords("Vulnerability", feat.vulnerable));
		recs.push(...defenseRecords("Immunity", feat.immune));
		recs.push(...defenseRecords("Condition Immunity", feat.conditionImmune, 1, true));

		// Spell choices from additionalSpells
		if (feat.additionalSpells?.length) {
			if (isMultiClass) {
				// Multi-class spell list feat (Magic Initiate, Fey-Touched, etc.)
				// Build the hierarchical structure matching native XPHB Magic Initiate.
				// Resource for the free once-per-long-rest cast
				recs.push({
					name: `${n} Spell Resource`, parent: n,
					payload: pay({type: "Resource", name: `${n} Level 1 Spell Free Cast`,
						value: 1, maxValueFormula: {flatValue: 1}, recovery: "Long Rest", recoveryRate: "Full"}),
				});

				// Spell List Choice — one child per class (e.g. "Magic Initiate - Cleric")
				const spellListChoiceName = `${n} Spell List Choice`;
				recs.push({name: spellListChoiceName, parent: n,
					payload: pay({type: "Generic Choice", category: "", replace: false, numOfChoices: 1})});

				for (const entry of feat.additionalSpells) {
					// Derive class name: "Cleric Spells" → "Cleric"
					const rawName = entry.name || "";
					const className = rawName.replace(/\s+spells?$/i, "").trim() ||
					                  rawName.replace(/\b\w/g, c => c.toUpperCase());
					if (!className) continue;
					const optionName = `${n} - ${className}`;

					// modifier record: renames the feat and updates its description
					recs.push({
						name: optionName, parent: spellListChoiceName,
						builderDisplayName: className,
						modify: n,
						payload: pay({type: "modifier",
							modifications: {description: desc},
							concat: {name: ` - ${className}`}}),
					});

					// Cantrips
					for (const item of (entry.known?._ || [])) {
						if (typeof item !== "object" || typeof item.choose !== "string") continue;
						if (!item.choose.includes("level=0")) continue;
						recs.push({
							name: `${n} ${className} Cantrips`, parent: optionName,
							builderDisplayName: `${n} Cantrips`,
							payload: pay({type: "Spell Choice", spellLevel: 0, includeBelow: false,
								choices: item.count || 2, fromClassList: [className], filter: [], list: [], replace: false}),
						});
					}

					// Leveled spell + replace
					const daily = entry.innate?._?.daily || {};
					for (const spells of Object.values(daily)) {
						for (const item of (Array.isArray(spells) ? spells : [])) {
							if (typeof item !== "object" || typeof item.choose !== "string") continue;
							const lm = item.choose.match(/level=(\d+)/i);
							if (!lm || parseInt(lm[1]) < 1) continue;
							const spellLvl = parseInt(lm[1]);
							recs.push({
								name: `${n} ${className} Spell Choice`, parent: optionName,
								builderDisplayName: `${n} Level ${spellLvl} Spell`,
								payload: pay({type: "Spell Choice", spellLevel: spellLvl, includeBelow: false,
									choices: item.count || 1, fromClassList: [className],
									filter: [], list: [], replace: false, alwaysPrepared: true}),
							});
							recs.push({
								name: `${n} ${className} Replace Spell`, parent: optionName,
								builderDisplayName: `Replace ${n} Spell`,
								payload: pay({type: "Spell Choice", spellLevel: spellLvl, includeBelow: true,
									choices: 1, fromClassList: [className],
									filter: [], list: [], replace: true, alwaysPrepared: true}),
							});
						}
					}
				}
			} else {
				// Single-class or fixed-class feat (Fey-Touched with one class, etc.)
				const cantripMap = new Map();
				const spellMap   = new Map();
				for (const entry of feat.additionalSpells) {
					for (const item of (entry.known?._ || [])) {
						if (typeof item !== "object" || typeof item.choose !== "string") continue;
						if (!item.choose.includes("level=0")) continue;
						const count = item.count || 1;
						const cm = item.choose.match(/class=([^|]+)/i);
						if (!cantripMap.has(count)) cantripMap.set(count, new Set());
						if (cm) cantripMap.get(count).add(cm[1].trim().toLowerCase());
					}
					const daily = entry.innate?._?.daily || {};
					for (const spells of Object.values(daily)) {
						for (const item of (Array.isArray(spells) ? spells : [])) {
							if (typeof item !== "object" || typeof item.choose !== "string") continue;
							const lm = item.choose.match(/level=(\d+)/i);
							if (!lm || parseInt(lm[1]) < 1) continue;
							const count = item.count || 1;
							const cm = item.choose.match(/class=([^|]+)/i);
							const key = `${parseInt(lm[1])}:${count}`;
							if (!spellMap.has(key)) spellMap.set(key, new Set());
							if (cm) spellMap.get(key).add(cm[1].trim().toLowerCase());
						}
					}
				}
				for (const [count, classes] of cantripMap) {
					const fromList = classes.size === 1 ? [[...classes][0]] : [];
					recs.push({name: `${n} Cantrips`, level: "1", builderDisplayName: `${n} Cantrips`,
						payload: pay({type: "Spell Choice", spellLevel: 0, includeBelow: false, includeCantrips: true,
							choices: count, fromClassList: fromList, filter: [], list: [], replace: false})});
				}
				for (const [key, classes] of spellMap) {
					const [spellLvl, count] = key.split(":").map(Number);
					const fromList = classes.size === 1 ? [[...classes][0]] : [];
					recs.push({name: `${n} Level ${spellLvl} Spell`, level: "1", builderDisplayName: `${n} Level ${spellLvl} Spell`,
						payload: pay({type: "Spell Choice", spellLevel: spellLvl, includeBelow: false, includeCantrips: false,
							choices: count, fromClassList: fromList, filter: [], list: [], replace: false})});
					recs.push({name: `${n} Replace Spell`, level: "1", builderDisplayName: `Replace ${n} Spell`,
						payload: pay({type: "Spell Choice", spellLevel: spellLvl, includeBelow: false, includeCantrips: false,
							choices: 1, fromClassList: fromList, filter: [], list: [], replace: true})});
				}
			}
		}

		return recs;
	}

	function featEntry (feat) {
		const prereq = prereqToString(feat.prerequisite);
		const entry = {
			id: makeId(`feat:${feat.name}:${feat.source}`),
			name: feat._displayName || feat.name,
			properties: {
				"Category": "Feats",
				"data-List": "false",
				"data-builderImage": "",
				"data-datarecords": JSON.stringify(buildFeatRecords(feat)),
				...(prereq ? {"Prerequisite": prereq} : {}),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(feat.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	// ── Subclass helpers ──────────────────────────────────────────────────────

	function buildSubclassRecords (subcls) {
		const recs = [];
		// _features are the resolved subclassFeature objects joined in getSubclasses()
		for (const feat of (subcls._features || [])) {
			if (!feat?.name) continue;
			if (/subclass feature/i.test(feat.name)) continue;
			if (feat.name === subcls.name) continue; // skip intro entry that shares the subclass name
			const desc = renderDesc(feat.entries);
			recs.push({
				name: feat.name,
				level: String(feat.level || 1),
				payload: pay({type: "Features", name: feat.name, description: desc}),
			});
		}
		return recs;
	}

	function subclassEntry (subcls, className) {
		const entry = {
			id: makeId(`subclass:${subcls.name}:${subcls.source}`),
			name: subcls._displayName || subcls.name,
			properties: {
				"Category": "Subclasses",
				"Class": className,
				"Parent Class": className,
				"data-List": "false",
				"data-builderImage": "",
				"data-datarecords": JSON.stringify(buildSubclassRecords(subcls)),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(subcls.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	// ── Subrace helpers ───────────────────────────────────────────────────────

	function buildSubraceRecords (subrace) {
		const recs = [];

		// Expanded _versions entries (e.g. Dragonborn draconic ancestries from PHB)
		if (subrace._expandedVars) {
			const vars    = subrace._expandedVars;
			const resist  = subrace._expandedResist || [];
			const dmgRaw  = vars.damageType || "";
			const dmgType = dmgRaw.charAt(0).toUpperCase() + dmgRaw.slice(1);
			const area    = vars.area || "15-foot cone";
			const saveAbil = vars.savingThrow || "Dexterity";

			recs.push({name: "Draconic Ancestry", level: "1",
				payload: pay({type: "Features", name: "Draconic Ancestry",
					description: `Your draconic ancestry is ${vars.color || subrace.name}. Your damage type is ${dmgType}, and your breath weapon covers a ${area}.`})});
			recs.push({name: "Breath Weapon", level: "1",
				payload: pay({type: "Features", name: "Breath Weapon",
					description: `You can use your action to exhale ${dmgType.toLowerCase()} energy in a ${area}. Each creature must make a ${saveAbil} saving throw (DC 8 + Con modifier + proficiency bonus). A creature takes 2d6 damage on a failed save, or half on a success. Damage increases to 3d6 at 6th, 4d6 at 11th, 5d6 at 16th level.`})});
			for (const r of resist) {
				const rt = r.charAt(0).toUpperCase() + r.slice(1);
				recs.push({name: `${rt} Resistance`, level: "1",
					payload: pay({type: "Defense", defense: "Resistance", damage: rt})});
			}
			return recs;
		}

		const n = subrace.name;

		// Ability score bonuses
		const abilityEntry = (subrace.ability || [])[0] || {};
		const staticASIs = Object.entries(abilityEntry).filter(([k]) => k !== "choose");
		if (staticASIs.length) {
			const asiParent = `${n} Ability Score Increase`;
			recs.push({
				name: asiParent,
				payload: pay({
					type: "Builder-Exclusive Feature",
					name: "Ability Score Increase",
					description: staticASIs.map(([k, v]) => `Your ${ABV[k] || k} score increases by ${v}.`).join(" "),
				}),
			});
			for (const [abv, val] of staticASIs) {
				recs.push({
					name: `${ABV[abv] || abv} Score Bonus`, parent: asiParent, level: "1",
					payload: pay({type: "Ability Score", ability: ABV[abv] || abv, calculation: "Modify", valueFormula: {flatValue: val}}),
				});
			}
		}

		if (subrace.skillProficiencies)
			recs.push(...skillRecords(subrace.skillProficiencies[0], n))

		// Feature entries
		for (const entry of (subrace.entries || [])) {
			if (!entry?.name) continue;
			const desc = renderDesc(entry.entries);
			recs.push({name: entry.name, level: "1",
				payload: pay({type: "Features", name: entry.name, description: desc})});
		}

		/* This has been disabled for the sake of preventing duplicates. If any subraces provide languages, this may need to be uncommented
		// Language proficiencies
		const langProfs = (subrace.languageProficiencies || [])[0] || false;
		if (langProfs)
			recs.push(...languageRecords(langProfs, n));*/

		// Darkvision override
		if (subrace.darkvision) {
			recs.push({
				name: "Darkvision", level: "1",
				payload: pay({type: "Sense", name: "Darkvision", calculation: "Set Base", valueFormula: {flatValue: subrace.darkvision}}),
			});
		}

		return recs;
	}

	function subraceEntry (subrace, parentRaceName) {
		const entry = {
			id: makeId(`subrace:${subrace.name}:${subrace.raceName}:${subrace.source}`),
			name: subrace._displayName || subrace.name,
			properties: {
				"Category": "Subraces",
				"Race": parentRaceName,
				"Parent Race": parentRaceName,
				"data-List": "false",
				"data-builderImage": "",
				"data-datarecords": JSON.stringify(buildSubraceRecords(subrace)),
			},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(subrace.source),
		};
		_pageCache.set(entry.id, entry);
		return entry;
	}

	// Extract the target name from a Subclasses or Subraces category query.
	// Roll20 hex-encodes the first letter in the regex filter:
	//   JSON body contains (.*?)\\\\x57izard(.*?)  (4 raw backslashes before xNN)
	function extractSubclassTargetClass (body) {
		const m = body.match(/\(\.\*\?\)(.*?)\(\.\*\?\)/);
		if (!m) return null;
		let raw = m[1];
		// Replace any run of backslashes + xNN with the decoded character
		raw = raw.replace(/\\+x([0-9a-fA-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
		raw = raw.replace(/\\/g, ""); // strip any leftover backslashes
		// Strip source label appended by our inject deduplication (e.g. "Barbarian (PHB)" → "Barbarian")
		raw = raw.replace(/\s+\([A-Z][A-Za-z0-9]+\)$/, "");
		return raw.trim() || null;
	}

	// ── Weapon item builders ─────────────────────────────────────────────────

	function formatGp (cp) {
		if (!cp) return "";
		if (cp % 100 === 0) return `${cp / 100} GP`;
		if (cp % 10  === 0) return `${cp / 10} SP`;
		return `${cp} CP`;
	}

	function buildWeaponRecords (item) {
		const recs  = [];
		const n     = item.name;
		const props = (item.property || []).map(p => ITEM_PROP[p]).filter(Boolean);
		const dmgT  = ITEM_DMG[item.dmgType] || "Bludgeoning";
		const dmg1  = item.dmg1 || "1d4";
		const dmg2  = item.dmg2 || dmg1;
		const die1  = dmg1.replace(/^\d+/, "");          // "1d6" → "d6", "2d6" → "d6"
		const cnt1  = parseInt(dmg1) || 1;               // "2d6" → 2
		const die2  = dmg2.replace(/^\d+/, "");
		const cnt2  = parseInt(dmg2) || 1;
		const isM   = item.type === "M";
		const isFin = (item.property||[]).includes("F");
		const isLt  = (item.property||[]).includes("L");
		const isThr = (item.property||[]).includes("T");
		const isVer = (item.property||[]).includes("V");
		const range = item.range ? `${item.range} ft` : null;
		const training = item.weaponCategory === "simple" ? "Simple" : "Martial";
		const cat = isM ? "Melee" : "Ranged";

		const itmPay = pay({type:"Item", name:n, weight: item.weight||"",
			properties: props, cost: formatGp(item.value||0),
			weaponData:{category:cat, training, type:n}, equipData:{equippable:true}});
		recs.push({name:n, payload:itmPay});

		const atkPay = (atkName, type, ability, atkRange) => pay({
			type:"Attack", name:atkName,
			...(atkRange ? {range:atkRange} : {}),
			attack:{type, abilityBonus:ability},
		});
		const dmgPay = (ability, dieSize, dieCount, bonus) => pay({
			type:"Damage", ability,
			...(dieCount > 1 ? {diceCount} : {}),
			...(bonus ? {bonus} : {}),
			damageType:dmgT, diceSize:dieSize,
		});

		if (isM) {
			if (isVer) {
				const a1 = `${n} Attack One-Handed`;
				recs.push({name:a1, parent:n, payload:atkPay(`${n} (One Handed)`,"Melee","Strength")});
				recs.push({name:`${n} Damage 1`, parent:a1, payload:dmgPay("auto",die1,cnt1)});
				const a2 = `${n} Attack Two-Handed`;
				recs.push({name:a2, parent:n, payload:atkPay(`${n} (Two Handed)`,"Melee","Strength")});
				recs.push({name:`${n} Damage 2`, parent:a2, payload:dmgPay("auto",die2,cnt2)});
			} else if (isFin) {
				const aStr = `${n} STR Attack`;
				recs.push({name:aStr, parent:n, payload:atkPay(n,"Melee","Strength")});
				recs.push({name:`${n} STR Damage`, parent:aStr, payload:dmgPay("auto",die1,cnt1)});
				const aDex = `${n} DEX Attack`;
				recs.push({name:aDex, parent:n, payload:atkPay(`${n} (Finesse)`,"Melee","Dexterity")});
				recs.push({name:`${n} DEX Damage`, parent:aDex, payload:dmgPay("auto",die1,cnt1)});
			} else {
				const atk = `${n} Attack`;
				recs.push({name:atk, parent:n, payload:atkPay(n,"Melee","Strength")});
				recs.push({name:`${n} Damage`, parent:atk, payload:dmgPay("auto",die1,cnt1)});
			}
			if (isLt) {
				const aOff = `${n} (Off-hand) Attack`;
				recs.push({name:aOff, parent:n, payload:atkPay(`${n} (Off-hand)`,"Melee","Strength")});
				recs.push({name:`${n} (Off-hand) Damage`, parent:aOff,
					payload:dmgPay("none",die1,cnt1,"min(@{strength_mod},0)")});
			}
			if (isThr && range) {
				const aThr = `Throw ${n}`;
				recs.push({name:aThr, parent:n,
					payload:atkPay(`Throw ${n}`,"Ranged",isFin?"Dexterity":"Strength",range)});
				recs.push({name:`Thrown ${n} Damage`, parent:aThr, payload:dmgPay("auto",die1,cnt1)});
			}
		} else {
			const atk = `${n} Attack`;
			recs.push({name:atk, parent:n, payload:atkPay(n,"Ranged","Dexterity",range)});
			recs.push({name:`${n} Damage`, parent:atk, payload:dmgPay("auto",die1,cnt1)});
		}
		return recs;
	}

	function buildWeaponEntry (item) {
		const isM    = item.type === "M";
		const props  = (item.property||[]).map(p => ITEM_PROP[p]).filter(Boolean).join(", ");
		const dmgT   = ITEM_DMG[item.dmgType] || "Bludgeoning";
		const sub    = item.weaponCategory || "simple";
		const iType  = isM ? "Melee Weapon" : "Ranged Weapon";
		const fLists = ["Weapon", sub==="simple"?"Simple Weapon":"Martial Weapon", iType].join(", ");
		const id     = makeId(`item:${item.name}:${item.source}`);
		const baseProps = {
			"Category": "Items",
			"Damage": item.dmg1 || "1d4",
			...(item.weight ? {Weight: item.weight} : {}),
			"Subtype": sub,
			"Item Type": iType,
			"data-List": "false",
			...(props ? {Properties: props} : {}),
			"Damage Type": dmgT,
			"Item Rarity": "None",
			"filter-Lists": fLists,
			"filter-Damage": dmgT,
			"filter-Charges": "No",
			"filter-Attunement": "No",
			"filter-Consumable": "No",
			"Name": item.name,
			"data-RarityNum": 0,
		};
		// filterAndSortPages gets a single Item record (no Attack/Damage children) so the Charactermancer
		// can display the choice option without crashing on parent: field lookups.
		// The full entry (with attack/damage integrant records) lives in _pageCache for page(id:...).
		const displayRecs = [{
			name: item.name,
			payload: pay({type: "Item", name: item.name, weight: item.weight || "", cost: formatGp(item.value || 0)}),
		}];
		_pageCache.set(id, {
			id, name: item.name,
			properties: {...baseProps, "data-datarecords": JSON.stringify(buildWeaponRecords(item))},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(item.source),
		});
		return {
			id, name: item.name,
			properties: {...baseProps, "data-datarecords": JSON.stringify(displayRecs)},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(item.source),
		};
	}

	// ── Pack builders ────────────────────────────────────────────────────────

	// gearData is the pre-loaded allGear array (passed from the async Items handler)
	// queriedName is the exact string the Charactermancer used to look this up (may differ in case)
	function buildPackEntry (item, gearData, queriedName) {
		const packItems = (item.packContents || []).map(packItemToNameQty).filter(Boolean);
		const cost      = formatGp(item.value || 0);
		const entryName = queriedName || item.name;
		const id        = makeId(`item:${item.name}:${item.source}`);

		// Build full records (used in page(id:...) response post-selection).
		// These must NOT be in the filterAndSortPages response: the Charactermancer processes
		// data-datarecords from that query for display purposes and crashes on parent: fields,
		// also auto-applying the first option before the user sees the choice.
		const fullRecs = [{
			name: entryName,
			payload: pay({type: "Item", name: entryName, weight: item.weight || "", cost}),
		}];
		for (const {name: cName, qty} of packItems) {
			const g = (gearData || []).find(x => x.name.toLowerCase() === cName.toLowerCase());
			fullRecs.push({
				name: `${entryName} ${cName}`,
				parent: entryName,
				payload: pay({
					type: "Item", name: cName,
					...(qty > 1 ? {quantity: qty} : {}),
					weight: g?.weight || "",
					cost: formatGp(g?.value || 0) || "",
				}),
			});
		}

		const baseProps = {
			"Category": "Items",
			"Subtype": "Equipment Pack",
			"Item Type": "Adventuring Gear",
			"data-List": "false",
			"Item Rarity": "None",
			"filter-Lists": "Adventuring Gear, Equipment Pack",
			"filter-Charges": "No",
			"filter-Attunement": "No",
			"filter-Consumable": "Multiple Uses",
			"Name": item.name,
			"data-RarityNum": 0,
		};

		// Store full entry in _pageCache for page(id:...) queries (made post-selection).
		_pageCache.set(id, {
			id,
			name: item.name,
			properties: {...baseProps, "data-datarecords": JSON.stringify(fullRecs)},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(item.source),
		});

		// Return display entry for filterAndSortPages.
		// Use "adventuring-gear" subtype instead of "Equipment Pack" — the Charactermancer may
		// auto-apply "Equipment Pack" subtype items during choice display, bypassing the picker.
		// Single Item record (no parent: children) avoids the crash on parent: field lookups.
		// Use full records so pack contents are added to inventory when the pack is applied.
		// "adventuring-gear" subtype prevents the Charactermancer from auto-applying during display.
		const displayProps = {
			...baseProps,
			"Subtype": "adventuring-gear",
			"filter-Lists": "Adventuring Gear",
			"data-datarecords": JSON.stringify(fullRecs),
		};
		return {id, name: item.name, properties: displayProps, children: [], publisher: {name: "5etools", logoUrl: ""}, book: book(item.source)};
	}

	function buildGearEntry (item) {
		const cost = formatGp(item.value || 0);
		const desc = typeof (item.entries||[])[0] === "string" ? item.entries[0] : "";
		const id   = makeId(`gear:${item.name}:${item.source}`);
		const baseProps = {
			"Category": "Items",
			"Subtype": "adventuring-gear",
			"Item Type": "Adventuring Gear",
			"data-List": "false",
			...(item.weight ? {Weight: item.weight} : {}),
			"Item Rarity": "None",
			"filter-Lists": "Adventuring Gear",
			"filter-Charges": "No",
			"filter-Attunement": "No",
			"filter-Consumable": "No",
			"Name": item.name,
			"data-RarityNum": 0,
		};
		const recs = [{
			name: item.name,
			payload: pay({type: "Item", name: item.name, weight: item.weight || "", cost, description: desc}),
		}];
		_pageCache.set(id, {
			id, name: item.name,
			properties: {...baseProps, "data-datarecords": JSON.stringify(recs)},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(item.source),
		});
		return {
			id, name: item.name,
			properties: {...baseProps, "data-datarecords": JSON.stringify(recs)},
			children: [],
			publisher: {name: "5etools", logoUrl: ""},
			book: book(item.source),
		};
	}

	// ── Fetch interceptor ─────────────────────────────────────────────────────

	const _origFetch = window.fetch;
	window.fetch = async function (...args) {
		const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
		if (!url || !url.includes(GRAPHQL_HOST)) return _origFetch.apply(this, args);

		const body = typeof (args[1] || {}).body === "string" ? args[1].body : "";

		// page(id:...) — return from cache immediately for our synthetic entries.
		// Also captures the build system version when a class or species is selected.
		if (body.includes("page(id:")) {
			const idMatch = body.match(/page\(id:[^)]*?([a-f0-9]{24})/);

			if (idMatch) {
				const cached = _pageCache.get(idMatch[1]);
				if (cached) {
					// Detect system version from the selected entry's category + book version
					const cat = cached.properties?.Category;
					if ((cat === "Classes" || cat === "Races") && !_buildVersion) {
						_buildVersion = cached.book?.systemVersion === "2024" ? "2024" : "2014";
						console.log(`[B20] Build version set to ${_buildVersion} from ${cat}: ${cached.name}`);
					}
					return new Response(
						JSON.stringify({data: {ruleSystem: {page: cached}}, extensions: {}}),
						{status: 200, headers: {"Content-Type": "application/json"}},
					);
				}
			}
		}


		const isBooks      = body.includes("books {") || body.includes("books{");
		// Order matters: more-specific substring checks first
		const isSubraces   = body.includes("Subraces");
		const isSubclasses = body.includes("Subclasses");
		// Exclude queries where "Classes"/"Races" appear as a filter *key* (e.g. spell queries
		// filtered by class: k:\\"Classes\\" or field:\\"Classes\\"). Those are not category queries.
		const isClasses    = !isSubclasses && body.includes("Classes") && !body.match(/[,{](?:field|k)\s*:\s*\\"Classes\\"/);
		const isRaces      = !isSubraces  && body.includes("Races")   && !body.match(/[,{](?:field|k)\s*:\s*\\"Races\\"/);
		const isBgs        = body.includes("Backgrounds");
		const isFeats      = body.includes("Feats") && !isBgs;
		// Match Items/Lists — body contains \\\"Items\\\" so check for the literal word too
		const isItems      = body.includes("Items");
		const isLists      = !isItems && body.includes("Lists");
		// Only intercept the standalone spell browser query. Must be mutually exclusive with every
		// other category flag — if any other category matched, "Spells" is just a property name
		// in that query body, not the queried category itself.
		const isSpells        = !isClasses && !isSubclasses && !isSubraces && !isRaces && !isBgs && !isFeats && !isItems && !isLists
		                        && body.includes("Spells")
		                        && !body.match(/[,{](?:field|k)\s*:\s*\\"Classes\\"/);
		// getSpellsFor class-filtered queries: category(name:"Spells") with k:"Classes" filter.
		// Used by the spell selection modal to load available spells for a given class.
		const isSpellsForClass = !isClasses && body.includes("Spells") && !isFeats && !isItems
		                         && !!body.match(/k:\\"Classes\\"/);
		// The About tab's Language dropdown queries category(name:"Proficiencies") filtered by
		// Type matching a "Language" regex (confirmed against the actual live GraphQL request
		// body) - not a dedicated "Languages" category like the name might suggest.
		const isLanguages = body.includes("Proficiencies") && /Language/.test(body);
		if (!isBooks && !isClasses && !isSubclasses && !isSubraces && !isRaces && !isBgs && !isFeats && !isItems && !isLists && !isSpells && !isSpellsForClass && !isLanguages) return _origFetch.apply(this, args);


		const response = await _origFetch.apply(this, args);
		let data;
		try { data = await response.json(); } catch (e) { return response; }

		try {
			// We only are adding on to the final page for now
			if (data?.extensions?.pageNumber < data?.extensions?.totalPages)
				return new Response(JSON.stringify(data), {status: 200, headers: {"Content-Type": "application/json"}});
			
			// Used for filtering out results that don't apply
			const filteredResults = (list, key, match, caseSensitive = true) => {
				let result
				
				if (!caseSensitive)
					match = match.toLowerCase()

				return list.filter( function (el) {
					// If the key is missing, just filter it out
					if (typeof el[key] != "string") {
						return false;
					}
					if (!caseSensitive)
						result = el[key].toLowerCase();
					else
						result = el[key];

					// Filter out if key result doesn't match
					return result.includes(match)
				})
			}

			// Make sure tool proficiency lists are cached
			// Cached toolProfs are used in records so "any*" tool choices use explicit
			// name arrays (like native Dwarf) rather than "Lists:..." references, which
			// cause a grayed-out dropdown when Roll20 can't serve the list.
			if (!_toolProfsP)
				await getToolProfLists();

			if (isBooks) {
				const books = data?.data?.ruleSystem?.books;
				if (Array.isArray(books) && !books.find(b => b.itemId === "5")) {
					books.push(PHB_BOOK);
					d20plus.ut.log("[Charactermancer] Injected PHB into books response");
				}
			}

			const pages = data?.data?.ruleSystem?.category?.filterAndSortPages;
			if (Array.isArray(pages)) {
				// These queries all set showUnownedContent:true (confirmed live), so Roll20's own
				// response already includes locked/unowned pages (e.g. Artificer for an account
				// that doesn't own its book) alongside owned ones - "the name is already in
				// `pages`" does NOT mean "the player already has full access to it". Strip those
				// locked placeholders out before computing `existing` below, so our own fully-
				// unlocked (isOwned:true) synthetic version can take their place instead of being
				// silently skipped as a "duplicate" of content the player can't actually use.
				for (let i = pages.length - 1; i >= 0; i--) {
					if (!pages[i]?.book?.isOwned) pages.splice(i, 1);
				}

				// Deduplicate and label: when multiple entries share a name (e.g. PHB vs XPHB),
				// append "(SOURCE)" so players can tell them apart.
				const existing = new Set(pages.map(p => p.name.toLowerCase()));
				const inject = (all, toEntry) => {
					// Count how many times each name appears in our dataset
					const nameCounts = {};
					for (const x of all) { const k = x.name.toLowerCase(); nameCounts[k] = (nameCounts[k] || 0) + 1; }

					// Apply filters
					const filters = Array.from(body.matchAll(/[,{]v\s*:\s*\\"([^"\\]+)\\"/g)).map(m => m[1]);
					if (filters.length > 0) {
						const types = Array.from(body.matchAll(/[,{](?:field|k)\s*:\s*\\"([^"\\]+)\\"/g)).map(m => m[1]);

						// Apply general filters
						for (let i = 0; i < types.length; i++) {
							if (types[i] == "name")
								all = filteredResults(all, "name", filters[i], false);
						}
					}

					const results = [];
					for (const x of all) {
						const k = x.name.toLowerCase();
						const isDupe = nameCounts[k] > 1;
						// If Roll20 already returned this base name (owned book), skip all our
						// labeled versions — no need to add "(PHB)" when the user owns the PHB.
						if (isDupe && existing.has(k)) continue;
						// When names clash and Roll20 doesn't have it, show "(PHB)" / "(XPHB)" etc.
						const displayName = isDupe ? `${x.name} (${x.source})` : x.name;
						const checkKey   = displayName.toLowerCase();
						if (existing.has(checkKey)) continue;
						existing.add(checkKey);
						const item = isDupe ? Object.assign(Object.create(Object.getPrototypeOf(x)), x, {_displayName: displayName}) : x;
						try { const entry = toEntry(item); if (entry) results.push(entry); } catch (e) { /* skip */ }
					}
					return results;
				};

				if (isClasses) {
					const entries = inject(await getClasses(), classEntry);
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} classes (${pages.length - entries.length} from server)`);
				}

				if (isSubclasses) {
					const className = extractSubclassTargetClass(body);
					if (className) {
						const allSubs = await getSubclasses();
						const toInject = allSubs.filter(s =>
							s.className?.toLowerCase() === className.toLowerCase() &&
							!existing.has(s.name.toLowerCase()),
						);
						for (const sub of toInject) {
							try { pages.push(subclassEntry(sub, className)); } catch (e) { /* skip */ }
						}
						d20plus.ut.log(`[Charactermancer] Injected ${toInject.length} subclasses for ${className} (${existing.size} from server)`);
					} else {
						d20plus.ut.log("[Charactermancer] Subclasses query — could not extract class name from body");
					}
				}

				if (isSubraces) {
					const raceName = extractSubclassTargetClass(body);
					if (raceName) {
						const allSubs = await getSubraces();
						// Deduplicate against server results AND against each other
						// (multiple sources can produce the same color name, e.g. PHB + XPHB Dragonborn)
						const seen = new Set(existing);
						const toInject = [];
						for (const s of allSubs) {
							if (s.raceName?.toLowerCase() !== raceName.toLowerCase()) continue;
							if (seen.has(s.name.toLowerCase())) continue;
							seen.add(s.name.toLowerCase());
							toInject.push(s);
						}
						for (const sub of toInject) {
							try { pages.push(subraceEntry(sub, raceName)); } catch (e) { /* skip */ }
						}
						d20plus.ut.log(`[Charactermancer] Injected ${toInject.length} subraces for ${raceName} (${existing.size} from server)`);
					} else {
						d20plus.ut.log("[Charactermancer] Subraces query — could not extract race name from body");
					}
				}

				if (isFeats) {
					// Deduplicate feats by name, preferring the version that matches the
					// current character build (2024 → XPHB first; 2014 → PHB first).
					// This ensures "Magic Initiate" is a single injected entry without
					// the "(XPHB)"/"(PHB)" rename suffix, so Feat Attach can find it by name.
					const allFeats = await getFeats();
					const is2024 = _buildVersion === "2024" || _buildVersion === null; // default 2024 if unknown
					const SOURCE_PREF_FEATS = is2024
						? ["XPHB","PHB","TCE","XGE","SCAG","DMG"]
						: ["PHB","XPHB","TCE","XGE","SCAG","DMG"];
					const featsByName = new Map();
					for (const f of allFeats) {
						const key = f.name.toLowerCase();
						if (!featsByName.has(key)) { featsByName.set(key, f); continue; }
						const curPref = SOURCE_PREF_FEATS.indexOf(featsByName.get(key).source);
						const newPref = SOURCE_PREF_FEATS.indexOf(f.source);
						if (newPref !== -1 && (curPref === -1 || newPref < curPref)) featsByName.set(key, f);
					}
					const nativeBefore = pages.length;
					const entries = inject([...featsByName.values()], featEntry);
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} feats (${nativeBefore} from server)`);
					console.log(`[B20 Feats] ${nativeBefore} native + ${entries.length} injected = ${pages.length} total`);
					console.log("[B20 Feats] Native entries:", pages.slice(0, nativeBefore).map(p => `${p.name} (${p.book?.name || "?"})`));
					const miEntry = entries.find(e => e.name === "Magic Initiate");
					if (miEntry) console.log("[B20 Feats] Magic Initiate record structure:", JSON.parse(miEntry.properties["data-datarecords"]).map(r => `${r.name} → parent:${r.parent||"(root)"}`));
				}

				if (isRaces) {
					const entries = inject(await getRaces(), raceEntry);
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} races/subraces (${pages.length - entries.length} from server)`);
					console.log(`[B20 Races] ${pages.length - entries.length} native + ${entries.length} injected = ${pages.length} total`);
				}
				if (isBgs) {
					// Pre-load feat data for granting by backgrounds
					const allFeats = await getFeats();
					const featByKey = new Map(allFeats.map(f => [`${f.name.toLowerCase()}|${(f.source||"").toLowerCase()}`, f]));
					const entries = inject(await getBackgrounds(), bg => bgEntry(bg, featByKey));
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} backgrounds (${pages.length - entries.length} from server)`);
					console.log(`[B20 Backgrounds] ${pages.length - entries.length} native + ${entries.length} injected = ${pages.length} total`);
					// Log any injected XPHB backgrounds with their origin feat records so we can verify
					const xphbBgs = entries.filter(e => e.book?.systemVersion === "2024");
					if (xphbBgs.length) {
						console.log("[B20 Backgrounds] XPHB injected sample:", xphbBgs.slice(0,3).map(e => ({
							name: e.name,
							filterFeat: e.properties["filter-Feat"],
							filterOriginFeat: e.properties["filter-Origin Feat"],
							filterAbilityScore: e.properties["filter-Ability Score"],
							originFeatRecord: JSON.parse(e.properties["data-datarecords"]).find(r => r.name?.includes("Origin Feat")),
							abilityScoreRecords: JSON.parse(e.properties["data-datarecords"]).filter(r => r.payload?.includes("Ability Score Choice")),
						})));
					}
				}

				if (isSpells) {
					const entries = inject(await getSpells(), spellEntry);
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} spells (${pages.length - entries.length} from server)`);
				}

				if (isLanguages) {
					const entries = inject(STD_LANGUAGES.map(name => ({name})), item => languageEntry(item.name));
					pages.push(...entries);
					d20plus.ut.log(`[Charactermancer] Injected ${entries.length} languages (${pages.length - entries.length} from server)`);
				}

				if (isSpellsForClass) {
					// When native has no results (totalPages=0) the early-return doesn't filter out
					// pages 2+, so ALL page requests would inject and create duplicates.
					// Only inject on page 1 in that case.
					const spellPageNum       = parseInt(body.match(/pageNumber:\s*(\d+)/)?.[1] ?? "1");
					const nativeSpellTotalPg = data?.extensions?.totalPages ?? 0;
					if (nativeSpellTotalPg === 0 && spellPageNum > 1) {
						// No native results and this isn't page 1 — skip to avoid duplicates
					} else {
						const classMatch  = body.match(/v:\\"([^"\\]+)\\",operator:\\"regex\\",k:\\"Classes\\"/);
						const className   = classMatch?.[1] || "";
						const levelMatch    = body.match(/v:(\d+),operator:\\"(eq|lte|leq)\\",k:\\"Level\\"/);
						const filterLevel   = levelMatch ? parseInt(levelMatch[1]) : -1;
						const filterLevelOp = levelMatch?.[2] || "eq";
						if (className) {
							const allSpells = await getSpells();
							const filtered  = allSpells.filter(spell => {
								const classes = (spell.classes?.fromClassList || []).map(c => c.name.toLowerCase());
								if (!classes.includes(className.toLowerCase())) return false;
								if (filterLevel < 0) return true;
								return filterLevelOp === "eq" ? spell.level === filterLevel : spell.level <= filterLevel;
							});
							// Deduplicate by spell name, preferring the version that matches
							// the active character build (XPHB for 2024, PHB for 2014).
							const SOURCE_PREF = (_buildVersion === "2014")
								? ["PHB","XPHB","TCE","SCAG","XGE","DMG","MM"]
								: ["XPHB","PHB","TCE","SCAG","XGE","DMG","MM"];
							const byName = new Map();
							for (const spell of filtered) {
								const key = spell.name.toLowerCase();
								if (!byName.has(key)) { byName.set(key, spell); continue; }
								const curPref = SOURCE_PREF.indexOf(byName.get(key).source);
								const newPref = SOURCE_PREF.indexOf(spell.source);
								if (newPref !== -1 && (curPref === -1 || newPref < curPref)) byName.set(key, spell);
							}
							const entries = inject([...byName.values()], spellEntry);
							pages.push(...entries);
							d20plus.ut.log(`[Charactermancer] Injected ${entries.length} ${className} spells (level ${filterLevel < 0 ? "all" : filterLevel})`);
						}
					}
				}

				if (isItems) {
					// Weapon list query (has Subtype filter) OR specific-name query
					const allWeapons = await getItems();
					const wantSimple  = body.includes("Subtype") && body.includes("simple");
					const wantMartial = body.includes("Subtype") && body.includes("martial");
						const wantMelee   = body.includes("Melee Weapon");
					const wantRanged  = body.includes("Ranged Weapon");

					if (wantSimple || wantMartial) {
						const toInject = allWeapons.filter(w => {
							if (existing.has(w.name.toLowerCase())) return false;
							if (wantSimple  && !wantMartial && w.weaponCategory !== "simple")  return false;
							if (wantMartial && !wantSimple  && w.weaponCategory !== "martial") return false;
							if (wantMelee   && !wantRanged  && w.type !== "M") return false;
							if (wantRanged  && !wantMelee   && w.type !== "R") return false;
							return true;
						});
						for (const w of toInject) {
							try { pages.push(buildWeaponEntry(w)); } catch (e) { /* skip */ }
						}
						d20plus.ut.log(`[Charactermancer] Injected ${toInject.length} weapon items`);
					} else {
						// Specific item name queries — GraphQL uses unquoted key: v:\"ItemName\"
						const nameMatches = Array.from(body.matchAll(/[,{]v\s*:\s*\\"([^"\\]+)\\"/g)).map(m => m[1]);
							const allPacks = await getPacks();
						const allGear  = await getGear();
						for (const name of nameMatches) {
							if (existing.has(name.toLowerCase())) continue;
							existing.add(name.toLowerCase());

							// Weapon check
							const w = allWeapons.find(x => x.name.toLowerCase() === name.toLowerCase());
							if (w) { try { pages.push(buildWeaponEntry(w)); } catch (e) { /* skip */ } continue; }

							// Pack — queriedName passed so entry.name matches exactly what was queried
							const p = allPacks.find(x => x.name.toLowerCase() === name.toLowerCase());
							if (p) {
								try { pages.push(buildPackEntry(p, allGear, name)); } catch (e) { /* skip */ }
								continue;
							}

							// Generic gear check
							const g = allGear.find(x => x.name.toLowerCase() === name.toLowerCase());
							if (g) { try { pages.push(buildGearEntry(g)); } catch (e) { /* skip */ } }
						}
					}
				}
			}

			// Lists: inject standard weapon list definitions and proficiency lists.
			if (isLists) {
				const listPages = data?.data?.ruleSystem?.category?.filterAndSortPages;
				if (Array.isArray(listPages)) {
					const existing_lists = new Set(listPages.map(p => p.name));

					// Standard item lists (Simple Weapons, Martial Weapons, etc.)
					for (const [listName, filter] of Object.entries(STANDARD_LISTS)) {
						if (!body.includes(listName)) continue;
						if (existing_lists.has(listName)) continue;
						existing_lists.add(listName);
						listPages.push({
							id: makeId(`list:${listName}`),
							name: listName,
							properties: {"Category": "Lists", "data-filter": JSON.stringify(filter), "data-listCategory": "Items"},
							children: [],
							publisher: {name: "5etools", logoUrl: ""},
							book: {name: "5etools SRD", itemId: null, systemVersion: "", isOwned: true},
						});
						d20plus.ut.log(`[Charactermancer] Injected list definition: ${listName}`);
					}

					// Proficiency lists (Artisan's Tools, Gaming Sets, Musical Instruments)
					// These are queried when Proficiency Choice records reference "Lists:X Proficiency".
					// Roll20 may not have these for users without the relevant books, so we inject
					// them from 5etools item data (AT/GS/INS item types).
					const PROF_LIST_NAMES = [
						"Artisan's Tools Proficiency",
						"Gaming Sets Proficiency",
						"Musical Instruments Proficiency",
					];
					const neededLists = PROF_LIST_NAMES.filter(n => body.includes(n) && !existing_lists.has(n));
					if (neededLists.length) {
						const toolProfs = await getToolProfLists();
						for (const listName of neededLists) {
							const toolNames = toolProfs[listName] || [];
							if (!toolNames.length) continue;
							existing_lists.add(listName);
							listPages.push({
								id: makeId(`list:${listName}`),
								name: listName,
								properties: {"Category": "Lists"},
								children: toolNames.map(name => ({
									id: makeId(`profitem:${listName}:${name}`),
									name,
									properties: {"Category": "Lists", "Type": "Tool"},
									children: [],
									publisher: {name: "5etools", logoUrl: ""},
									book: {name: "5etools SRD", itemId: null, systemVersion: "", isOwned: true},
								})),
								publisher: {name: "5etools", logoUrl: ""},
								book: {name: "5etools SRD", itemId: null, systemVersion: "", isOwned: true},
							});
							d20plus.ut.log(`[Charactermancer] Injected proficiency list: ${listName} (${toolNames.length} items)`);
						}
					}
				}
			}

			// Make sure total pages is at least 1 if anything has been added
			// This prevents infinite reloading
			if (pages?.length > 0 && data?.extensions?.totalPages == undefined) {
				data.extensions.totalPages = 1;
				data.extensions.pageNumber = 1;
			}
		} catch (e) {
			console.error("[B20 Charactermancer]", e);
		}

		return new Response(JSON.stringify(data), {status: 200, headers: {"Content-Type": "application/json"}});
	};

	// Test-facing exports - these builders are otherwise private (this file's only real entry
	// point is patching window.fetch), but exposing them lets tests call them directly.
	d20plus.import2024.charmanBuildSpellRecords = buildSpellBuilderRecords;
	d20plus.import2024.charmanBuildEquipRecords = buildEquipRecords;
	d20plus.import2024.charmanLanguageEntry = languageEntry;
	d20plus.import2024.charmanStdLanguages = STD_LANGUAGES;
	d20plus.import2024.charmanBuildBgRecords = buildBgRecords;
}



(function tryInjectCharactermancer() {
  if (typeof unsafeWindow.d20plus === "undefined" || typeof unsafeWindow.d20plus.spellParsers === "undefined") {
    setTimeout(tryInjectCharactermancer, 100);
    return;
  }
  const strip = (str) => str.replace(/use strict/, "").substring(str.indexOf("\n") + 1, str.lastIndexOf("\n")) + "\n";
  unsafeWindow.eval("(function() {\n" + strip(d20plus2024Charactermancer.toString()) + "\n})()");
  unsafeWindow.d20plus.charactermancerLoaded = true;
  unsafeWindow.d20plus.charactermancerVersion = "1.36.1.7-beta-testing";
})();