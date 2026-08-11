/**
 * 2024 NPC Level-Up Support
 *
 * Provides sidekick-style progression for 2024 (Jumpgate) NPC sheets.
 * Creates a new upgraded copy rather than mutating the source character.
 *
 * v1 scope: PB progression · hit dice + HP · PB-derived save/skill refresh
 * Deferred: full spell-slot progression, ASI/feat automation
 *
 * Depends on: js/5etools-2024-store.js (d20plus.store2024)
 */
function d20plusNpcLevelUp () {
	d20plus.npcLevelUp = {};

	// ─────────────────────────────────────────────────────────────────────────
	// Logging helpers
	// ─────────────────────────────────────────────────────────────────────────

	const LOG_TAG = "%cbetterR20 NPC Level-Up%c";
	const LOG_STYLE = "color:#b48ead;font-weight:bold";
	const LOG_RESET = "color:inherit;font-weight:normal";

	function log (msg, ...args) {
		console.log(`${LOG_TAG} ${msg}`, LOG_STYLE, LOG_RESET, ...args);
	}

	function logWarn (msg, ...args) {
		console.warn(`${LOG_TAG} ${msg}`, LOG_STYLE, LOG_RESET, ...args);
	}

	function logError (msg, ...args) {
		console.error(`${LOG_TAG} ${msg}`, LOG_STYLE, LOG_RESET, ...args);
	}

	function logGroup (label, fn) {
		console.groupCollapsed(`${LOG_TAG} ${label}`, LOG_STYLE, LOG_RESET);
		try { fn(); } finally { console.groupEnd(); }
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Sidekick progression tables (TCE p.142)
	// Level is the "sidekick level" that maps a CR range to a virtual level.
	//
	// CR → sidekick level mapping (conservative; matches TCE guidance)
	//   CR 0–1/8  → level 1
	//   CR 1/4    → level 2
	//   CR 1/2    → level 3
	//   CR 1      → level 4
	//   CR 2      → level 5
	//   CR 3–4    → level 6
	//   CR 5–6    → level 7
	//   CR 7–8    → level 8
	//   CR 9–10   → level 9
	//   CR 11–12  → level 10
	//   CR 13–15  → level 11 (PB 5 threshold)
	//   CR 16–19  → level 12
	//   CR 20+    → level 13
	// ─────────────────────────────────────────────────────────────────────────

	// CR 0–1/2 → level 1 (Tasha's sidekick eligibility threshold).
	// CR 1–18 map 1:1 to levels 2–19. CR 19+ → level 20.
	const CR_TO_SIDEKICK_LEVEL = [
		// [maxCrNum, sidekickLevel]
		[0.5,  1],
		[1,    2],
		[2,    3],
		[3,    4],
		[4,    5],
		[5,    6],
		[6,    7],
		[7,    8],
		[8,    9],
		[9,    10],
		[10,   11],
		[11,   12],
		[12,   13],
		[13,   14],
		[14,   15],
		[15,   16],
		[16,   17],
		[17,   18],
		[18,   19],
		[Infinity, 20],
	];

	/** Proficiency bonus by sidekick level (standard character PB schedule, levels 1–20). */
	const SIDEKICK_LEVEL_TO_PB = [
		// index 0 unused; index 1..20
		0,
		2, 2, 2, 2,   // levels 1–4
		3, 3, 3, 3,   // levels 5–8
		4, 4, 4, 4,   // levels 9–12
		5, 5, 5, 5,   // levels 13–16
		6, 6, 6, 6,   // levels 17–20
	];

	const SIDEKICK_LEVEL_TO_CR = [
		null,
		"1/2", "1", "2", "3", "4", "5", "6", "7", "8", "9",
		"10", "11", "12", "13", "14", "15", "16", "17", "18",
	];

	const SIDEKICK_BONUS_PROFICIENCY_CONFIG = {
		expert: {
			saves: { maxChoices: 1, options: ["Dexterity", "Intelligence", "Charisma"] },
			skills: { maxChoices: 5, options: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"] },
		},
		__warriorShared: {
			saves: { maxChoices: 1, options: ["Strength", "Dexterity", "Constitution"] },
			skills: { maxChoices: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
		},
		mage: {
			saves: { maxChoices: 1, options: ["Wisdom", "Intelligence", "Charisma"] },
			skills: { maxChoices: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Performance", "Persuasion", "Religion"] },
		},
		healer: {
			saves: { maxChoices: 1, options: ["Wisdom", "Intelligence", "Charisma"] },
			skills: { maxChoices: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Performance", "Persuasion", "Religion"] },
		},
		prodigy: {
			saves: { maxChoices: 1, options: ["Wisdom", "Intelligence", "Charisma"] },
			skills: { maxChoices: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Performance", "Persuasion", "Religion"] },
		},
	};
	// The Attacker/Defender warrior types share one proficiency rules block.
	SIDEKICK_BONUS_PROFICIENCY_CONFIG["warrior-attacker"] = SIDEKICK_BONUS_PROFICIENCY_CONFIG.__warriorShared;
	SIDEKICK_BONUS_PROFICIENCY_CONFIG["warrior-defender"] = SIDEKICK_BONUS_PROFICIENCY_CONFIG.__warriorShared;

	/**
	 * Parse a CR string ("1/8", "1/4", "1/2", "1", "20", etc.) to a number.
	 */
	function parseCr (crStr) {
		if (!crStr) return 0;
		const s = String(crStr).trim();
		if (s.includes("/")) {
			const [num, den] = s.split("/");
			return parseInt(num, 10) / parseInt(den, 10);
		}
		return parseFloat(s) || 0;
	}

	/**
	 * Return the current sidekick level for a given CR string.
	 */
	function crToSidekickLevel (crStr) {
		const cr = parseCr(crStr);
		for (const [max, level] of CR_TO_SIDEKICK_LEVEL) {
			if (cr <= max) return level;
		}
		return 20;
	}

	/**
	 * Return the PB for a given CR string, derived via the sidekick-level table.
	 */
	function crToPb (crStr) {
		return SIDEKICK_LEVEL_TO_PB[crToSidekickLevel(crStr)] || 2;
	}

	/**
	 * Return the standard D&D proficiency bonus for a CR number
	 * (the formula used by the main 5e stat-block convention).
	 */
	function crNumToStandardPb (crNum) {
		if (crNum < 5) return 2;
		if (crNum < 9) return 3;
		if (crNum < 13) return 4;
		if (crNum < 17) return 5;
		if (crNum < 21) return 6;
		if (crNum < 25) return 7;
		if (crNum < 29) return 8;
		return 9;
	}

	/**
	 * Average HP gain per hit die (half die + 1, following class HP convention).
	 */
	function avgHpPerDie (dieFaces) {
		return Math.ceil((dieFaces + 1) / 2);
	}

	/**
	 * Parse a roll formula like "4d8+12" or "9d10+18" to { count, faces, bonus }.
	 * Returns null on failure.
	 */
	function parseHpFormula (formula) {
		if (!formula) return null;
		const m = String(formula).replace(/\s/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
		if (!m) return null;
		return {
			count: parseInt(m[1], 10),
			faces: parseInt(m[2], 10),
			bonus: m[3] ? parseInt(m[3], 10) : 0,
		};
	}

	/**
	 * Format a roll formula object back to a string like "5d8+15".
	 */
	function formatHpFormula ({ count, faces, bonus }) {
		if (bonus > 0) return `${count}d${faces}+${bonus}`;
		if (bonus < 0) return `${count}d${faces}${bonus}`;
		return `${count}d${faces}`;
	}

	/**
	 * Derive the CON modifier from a CON-score integrant in the store.
	 */
	function getConModFromStore (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		for (const int of Object.values(ints)) {
			if (int.type === "Ability Score" && int.ability === "Constitution") {
				const score = int.valueFormula && int.valueFormula.flatValue != null
					? int.valueFormula.flatValue
					: 10;
				return Math.floor((score - 10) / 2);
			}
		}
		return 0;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Core transformer
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Produce a new upgraded store from an existing 2024 NPC store.
	 *
	 * @param {object} sourceStore   - Deep clone of the source 2024 NPC store
	 * @param {object} options
	 * @param {number} options.levels - Number of sidekick levels to add (default 1)
	 * @returns {{ store: object, summary: object }} - Transformed store and a human-readable diff summary
	 */
	function upgrade2024NpcStore (sourceStore, options = {}) {
		const levels = Math.max(0, Math.min(options.levels != null ? options.levels : 1, 10));

		// Deep clone — never mutate the source
		const store = JSON.parse(JSON.stringify(sourceStore));

		const summary = {
			sourceLevel: null,
			newLevel: null,
			sourcePb: null,
			newPb: null,
			hpAdded: 0,
			newHpMax: null,
			hitDiceAdded: 0,
			newRollHP: null,
			pbChanged: false,
			proficienciesUpdated: 0,
			errors: [],
		};

		// ── Resolve current sidekick level ────────────────────────────────────
		// Priority: explicit override from options > stored _npcLevelUpLevel > CR mapping
		const crStr = store.npc && store.npc.challengeRating ? String(store.npc.challengeRating) : "0";
		const currentSidekickLevel = options.currentLevel != null
			? Math.max(1, Math.min(options.currentLevel, 20))
			: (store.npc && store.npc._npcLevelUpLevel) || crToSidekickLevel(crStr);
		const targetSidekickLevel = Math.min(currentSidekickLevel + levels, 20);
		const sourcePb = SIDEKICK_LEVEL_TO_PB[currentSidekickLevel] || 2;
		const newPb = SIDEKICK_LEVEL_TO_PB[targetSidekickLevel] || 2;
		const pbChanged = newPb !== sourcePb;

		summary.sourceLevel = currentSidekickLevel;
		summary.newLevel = targetSidekickLevel;
		summary.sourcePb = sourcePb;
		summary.newPb = newPb;
		summary.pbChanged = pbChanged;

		// ── Determine hit die size from rollHP formula ───────────────────────
		const rollHPStr = store.npc && store.npc.rollHP ? store.npc.rollHP : null;
		const parsedHP = parseHpFormula(rollHPStr);
		const conMod = getConModFromStore(store);

		// ── Add hit dice and HP per level gained ─────────────────────────────
		if (parsedHP) {
			const levelsGained = targetSidekickLevel - currentSidekickLevel;
			const avgPerDie = avgHpPerDie(parsedHP.faces);
			const perLevelHpGain = options.hpIncreaseMode === "roll" && parsedHP.faces
				? Math.max(1, (options.hpRollTotal != null ? options.hpRollTotal : avgPerDie) + conMod)
				: Math.max(1, avgPerDie + conMod);
			const totalHpGain = levelsGained * perLevelHpGain;
			const totalNewDice = parsedHP.count + levelsGained;
			const totalNewBonus = parsedHP.count + levelsGained > 0
				? conMod * totalNewDice
				: parsedHP.bonus;

			const newFormula = formatHpFormula({ count: totalNewDice, faces: parsedHP.faces, bonus: totalNewBonus });

			// Update rollHP (display formula)
			store.npc.rollHP = newFormula;
			summary.newRollHP = newFormula;
			summary.hitDiceAdded = levelsGained;

			// Update the Hit Points integrant flatValue and currentHP
			const hpIntegrant = findIntegrantByType(store, "Hit Points");
			const currentHpMax = hpIntegrant && hpIntegrant.valueFormula
				? (hpIntegrant.valueFormula.flatValue || 0)
				: (store.hitpoints && store.hitpoints.currentHP) || 0;

			const newHpMax = currentHpMax + totalHpGain;

			if (hpIntegrant) {
				hpIntegrant.valueFormula = { flatValue: newHpMax };
			}
			if (store.hitpoints) {
				store.hitpoints.currentHP = newHpMax;
			}
			summary.hpAdded = totalHpGain;
			summary.newHpMax = newHpMax;
		} else {
			summary.errors.push("Could not parse rollHP formula — HP and hit dice not updated.");
		}

		// ── Proficiency Bonus ─────────────────────────────────────────────────
		// The NPC card derives PB from CR unless a "Proficiency Bonus Modifier"
		// integrant exists (this is what the sheet's "Proficiency Override" edit
		// field writes — shape confirmed from a live sheet dump). Update any
		// existing modifier, else create one matching the sheet's exact shape.
		// Applied unconditionally so re-running a level-up repairs the override.
		{
			if (!store.integrants) store.integrants = {};
			if (!store.integrants.integrants) store.integrants.integrants = {};
			const ints = store.integrants.integrants;
			let pbModifierFound = false;
			Object.values(ints).forEach(int => {
				if (!int) return;
				// Update both the real override type and any legacy "Proficiency Bonus"
				// integrants written by earlier betterR20 builds.
				if (int.type === "Proficiency Bonus Modifier" || int.type === "Proficiency Bonus") {
					if (!int.valueFormula) int.valueFormula = {};
					int.valueFormula.flatValue = newPb;
					if (int.type === "Proficiency Bonus Modifier") pbModifierFound = true;
				}
			});
			if (!pbModifierFound) {
				const uuid = d20plus.store2024.makeUuid();
				ints[uuid] = {
					_id: uuid,
					shortID: d20plus.store2024.makeId(),
					name: "",
					builderDisplayName: "",
					label: "",
					createdTime: Date.now(),
					type: "Proficiency Bonus Modifier",
					_enabled: true,
					source: "Custom",
					childIDs: "[]",
					parentID: "",
					calculation: "Set Value",
					valueFormula: { flatValue: newPb },
					cascades: {},
					relations: {},
				};
			}
		}

		// Store the new "virtual level" as a custom note on the store so we can detect
		// the current level on future upgrades without re-deriving from CR.
		if (!store.npc) store.npc = {};
		// Write the mapped CR into the store — the Jumpgate renderer reads
		// store.npc.challengeRating for the statblock CR display (flat attrs are ignored).
		const mappedCr = sidekickLevelToCr(targetSidekickLevel);
		store.npc.challengeRating = mappedCr;
		summary.newCr = mappedCr;
		store.npc._npcLevelUpLevel = targetSidekickLevel;
		if (options.sidekickType) store.npc._npcSidekickType = options.sidekickType;
		// Empowered Spells school: new choice this pass, or carried over from a
		// previous level-up (restored into the store from b20_sidekick meta).
		const empoweredSchool = options.empoweredSchool || store.npc._npcEmpoweredSchool || null;
		if (empoweredSchool) store.npc._npcEmpoweredSchool = empoweredSchool;

		// Write sidekick class features for levels gained.
		// For Make Sidekick (options.featureFromLevel = 0), write all features from 0 up to
		// targetSidekickLevel so a level-4 sidekick gets levels 1–4 features at creation.
		const sidekickType = options.sidekickType || (store.npc && store.npc._npcSidekickType) || null;
		const featureFromLevel = options.featureFromLevel != null ? options.featureFromLevel : currentSidekickLevel;
		const shouldHandleBonusProficiencies = shouldApplyBonusProficiencies(featureFromLevel, targetSidekickLevel);
		const asiHasFeatures = shouldApplyAsi(sidekickType, featureFromLevel, targetSidekickLevel);

		const bonusProficienciesAdded = shouldHandleBonusProficiencies
			? applyBonusProficiencies(store, options.bonusProficiencies)
			: 0;
		// Apply ASI score bumps before writing features (so store scores are updated)
		const asiApplied = asiHasFeatures
			? applyAsiToStore(store, options.asiChoices)
			: 0;
		// Expertise (expert L3/L15) — after bonus proficiencies so new skills can be chosen
		const expertiseApplied = options.expertiseChoices
			? applyExpertise(store, options.expertiseChoices)
			: 0;
		// Sharp Mind (expert L18) — one extra saving throw proficiency
		let sharpMindApplied = 0;
		if (options.sharpMindChoice) {
			const existingSaves = getExistingProficiencies(store).saves;
			if (!existingSaves.has(options.sharpMindChoice)) {
				const pos = d20plus.store2024.getNextArrayPos(store);
				const { id, integrant } = makeProficiencyIntegrant("Saving Throw", options.sharpMindChoice, pos);
				store.integrants.integrants[id] = integrant;
				sharpMindApplied = 1;
			}
		}
		const featuresWritten = writeSidekickFeatures(
			store,
			sidekickType,
			featureFromLevel,
			targetSidekickLevel,
			{
				skipBonusProficienciesTodo: shouldHandleBonusProficiencies,
				skipAsiTodo: asiHasFeatures,
				skipSpellcastingAdvancementTodo: !!options.spellChoices,
				skipExpertiseTodo: !!options.expertiseChoices,
				skipSharpMindTodo: !!options.sharpMindChoice,
				skipEmpoweredSpellsTodo: !!options.empoweredSchool,
			},
		);
		const bonusProficiencyFeatureWritten = shouldHandleBonusProficiencies
			? writeBonusProficiencyFeature(store, sidekickType, options.bonusProficiencies)
			: 0;
		const asiTraitsWritten = asiHasFeatures
			? writeAsiFeatures(store, sidekickType, featureFromLevel, targetSidekickLevel, options.asiChoices, options.asiInstances)
			: 0;
		const expertiseTraitWritten = options.expertiseChoices
			? writeExpertiseFeature(store, sidekickType, featureFromLevel, targetSidekickLevel, options.expertiseChoices)
			: 0;
		const sharpMindTraitWritten = options.sharpMindChoice
			? writeSharpMindFeature(store, sidekickType, featureFromLevel, targetSidekickLevel, options.sharpMindChoice)
			: 0;
		const empoweredTraitWritten = options.empoweredSchool
			? writeEmpoweredSpellsFeature(store, sidekickType, featureFromLevel, targetSidekickLevel, options.empoweredSchool)
			: 0;

		// Write (or replace) the sidekick identity feature — always done so level-up keeps it current.
		writeSidekickIdentityFeature(store, sidekickType, targetSidekickLevel);

		// Spellcasting Advancement: import picked spells (and apply a replacement)
		// before Potent Cantrips so newly added cantrips get the damage ability too.
		// Spell slots and the spellcasting source label are updated on every
		// spellcaster level-up, regardless of whether spells were picked.
		let spellResult = null;
		let spellSlotsChanged = 0;
		let spellSourceRenamed = 0;
		if (isSpellcasterType(sidekickType)) {
			// Always ensure a Spellcasting config exists — the sheet derives spell
			// save DC (8 + ability mod + PB) and spell attack mod from it — then
			// rename its source to "<Type> Sidekick".
			ensureSidekickSpellcastingConfig(store, sidekickType);
			spellSourceRenamed = renameSidekickSpellcastingSource(store, sidekickType);
			if (options.spellChoices) {
				spellResult = applySpellChoices(store, sidekickType, options.spellChoices);
				writeSpellcastingAdvancementFeature(store, sidekickType, options.spellChoices, targetSidekickLevel, spellResult);
			}
			spellSlotsChanged = writeSidekickSpellSlots(store, sidekickType, targetSidekickLevel);
		}
		summary.spellsAdded = spellResult ? spellResult.added : 0;
		summary.spellRemoved = spellResult ? spellResult.removedName : null;
		summary.spellsFailed = spellResult ? spellResult.failed : [];
		summary.spellSlotsChanged = spellSlotsChanged;
		summary.spellSourceRenamed = spellSourceRenamed;

		// Potent Cantrips (spellcaster level 6+): add the spellcasting ability modifier
		// to cantrip damage. Applied on every level-up at 6+ so cantrips added since the
		// last level-up are covered too.
		const potentCantripsApplied = targetSidekickLevel >= 6
			? applyPotentCantrips(store, sidekickType)
			: 0;
		summary.potentCantripsApplied = potentCantripsApplied;
		summary.helpfulBonusActionApplied = applyHelpfulBonusAction(store, sidekickType, featureFromLevel, targetSidekickLevel);

		// Empowered Spells (spellcaster level 14+): re-applied every level-up so
		// spells added since the school was chosen are covered too.
		summary.empoweredSpellsApplied = targetSidekickLevel >= 14 && empoweredSchool
			? applyEmpoweredSpells(store, sidekickType, empoweredSchool)
			: 0;
		summary.empoweredSchool = empoweredSchool;

		// Martial Role: Attacker (warrior-attacker) — +2 to all attack rolls.
		// Run on every level-up so attacks added since the last one are covered.
		summary.attackerBonusApplied = applyMartialRoleAttacker(store, sidekickType);

		// Count how many Proficiency integrants exist (informational for the summary)
		const allInts = (store.integrants && store.integrants.integrants) || {};
		summary.proficienciesUpdated = Object.values(allInts)
			.filter(i => i.type === "Proficiency")
			.length;
		summary.bonusProficienciesAdded = bonusProficienciesAdded;
		summary.asiApplied = asiApplied;
		summary.featsChosen = (options.asiInstances || []).filter(inst => inst.mode === "feat" && inst.feat).map(inst => inst.feat.name);
		summary.expertiseApplied = expertiseApplied;
		summary.sharpMindApplied = sharpMindApplied;
		summary.featuresWritten = featuresWritten + bonusProficiencyFeatureWritten + asiTraitsWritten + expertiseTraitWritten + sharpMindTraitWritten + empoweredTraitWritten + (spellResult ? 1 : 0);

		return { store, summary };
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Sidekick feature writing
	// ─────────────────────────────────────────────────────────────────────────

	const SIDEKICK_IDENTITY_FEATURE_NAME = "betterR20 Sidekick";

	/** Spellcasting ability by sidekick type (TCE p.144). Non-casters absent. */
	const SIDEKICK_SPELLCASTING_ABILITY = {
		mage: "Intelligence",
		healer: "Wisdom",
		prodigy: "Charisma",
	};

	/**
	 * Apply the Potent Cantrips feature: set the damage ability of every cantrip's
	 * Damage integrant to the sidekick's spellcasting ability.
	 *
	 * Cantrips are Spell integrants with level === 0; their Attack integrants are
	 * children (parentID = spell id) and Damage integrants are children of the
	 * Attack. We walk each Damage integrant's parentID chain up to a Spell to
	 * decide whether it belongs to a cantrip. Only "none"/empty abilities are
	 * overwritten so manual per-spell choices are preserved.
	 *
	 * @returns {number} count of Damage integrants updated
	 */
	function applyPotentCantrips (store, sidekickType) {
		const ability = SIDEKICK_SPELLCASTING_ABILITY[sidekickType];
		if (!ability) return 0;
		const ints = (store.integrants && store.integrants.integrants) || {};

		// Map from both full ids and shortIDs to integrants for parent lookups
		const byId = {};
		Object.entries(ints).forEach(([id, int]) => {
			if (!int) return;
			byId[id] = int;
			if (int.shortID) byId[int.shortID] = int;
			if (int._id) byId[int._id] = int;
		});

		const isCantripAncestor = (int, depth = 0) => {
			if (!int || depth > 5) return false;
			if (int.type === "Spell") return int.level === 0;
			return isCantripAncestor(byId[int.parentID], depth + 1);
		};

		let updated = 0;
		Object.values(ints).forEach(int => {
			if (!int || int.type !== "Damage") return;
			const currentAbility = (int.ability || "none").toLowerCase();
			if (currentAbility !== "none" && currentAbility !== "") return;
			if (!isCantripAncestor(byId[int.parentID])) return;
			int.ability = ability;
			updated++;
		});
		return updated;
	}

	/**
	 * Apply the Empowered Spells feature (spellcaster L14): add the spellcasting
	 * ability modifier to the damage/healing rolls of leveled spells of the
	 * chosen school. Walks each Damage/Healing integrant's parentID chain up to
	 * its Spell (same approach as Potent Cantrips); only "none"/empty abilities
	 * are overwritten. The "only when expending a slot" condition can't be
	 * represented on the sheet, so the bonus applies to all casts.
	 * Run on every level-up ≥14 so spells added later are covered.
	 *
	 * @returns {number} count of Damage/Healing integrants updated
	 */
	function applyEmpoweredSpells (store, sidekickType, school) {
		const ability = SIDEKICK_SPELLCASTING_ABILITY[sidekickType];
		if (!ability || !school) return 0;
		const ints = (store.integrants && store.integrants.integrants) || {};

		const byId = {};
		Object.entries(ints).forEach(([id, int]) => {
			if (!int) return;
			byId[id] = int;
			if (int.shortID) byId[int.shortID] = int;
			if (int._id) byId[int._id] = int;
		});

		const findSpellAncestor = (int, depth = 0) => {
			if (!int || depth > 5) return null;
			if (int.type === "Spell") return int;
			return findSpellAncestor(byId[int.parentID], depth + 1);
		};

		let updated = 0;
		Object.values(ints).forEach(int => {
			if (!int || (int.type !== "Damage" && int.type !== "Healing")) return;
			const currentAbility = (int.ability || "none").toLowerCase();
			if (currentAbility !== "none" && currentAbility !== "") return;
			const spell = findSpellAncestor(byId[int.parentID]);
			if (!spell || !(spell.level >= 1)) return;
			if ((spell.school || "") !== school) return;
			int.ability = ability;
			updated++;
		});
		return updated;
	}

	/**
	 * Write (or replace) a single "betterR20 Sidekick" identity feature recording type and level.
	 * On level-up this removes the old one and inserts a fresh one.
	 */
	function writeSidekickIdentityFeature (store, sidekickType, targetLevel) {
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};

		const typeLabel = d20plus.sidekickData ? d20plus.sidekickData.typeLabel(sidekickType) : sidekickType;
		const pb = SIDEKICK_LEVEL_TO_PB[targetLevel] || 2;

		// Remove any existing identity integrant(s)
		const ints = store.integrants.integrants;
		const oldIds = Object.keys(ints).filter(k => ints[k].name === SIDEKICK_IDENTITY_FEATURE_NAME);
		oldIds.forEach(k => delete ints[k]);

		// Remove old ID from display order
		const displayOrderRaw = store.features.speciesTraitsDisplayOrder;
		let displayOrder = [];
		try { displayOrder = JSON.parse(displayOrderRaw || "[]"); } catch (e) { displayOrder = []; }
		displayOrder = displayOrder.filter(id => !oldIds.includes(id));

		// Build fresh integrant
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);
		ints[id] = {
			...base,
			name: SIDEKICK_IDENTITY_FEATURE_NAME,
			description: `This character is a Level ${targetLevel} ${typeLabel} Sidekick (Proficiency Bonus: +${pb}).\n\nManaged by betterR20.`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.unshift(id); // show at top of species traits
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
	}


	function writeSidekickFeatures (store, sidekickType, fromLevel, toLevel, options = {}) {
		if (!d20plus.sidekickData || !sidekickType) return 0;
		const features = d20plus.sidekickData
			.getFeaturesGained(sidekickType, fromLevel, toLevel)
			.filter(feature => !(options.skipBonusProficienciesTodo && feature.name === "Bonus Proficiencies") && !(options.skipAsiTodo && feature.name === "Ability Score Improvement") && !(options.skipSpellcastingAdvancementTodo && feature.name === "Spellcasting Advancement") && !(options.skipExpertiseTodo && feature.name === "Expertise") && !(options.skipSharpMindTodo && feature.name === "Sharp Mind") && !(options.skipEmpoweredSpellsTodo && feature.name === "Empowered Spells"));
		if (!features.length) return 0;

		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};

		const integrants = store.integrants.integrants;
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		let pos = d20plus.store2024.getNextArrayPos(store);

		for (const feature of features) {
			const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos++);
			const name = feature.isTodo
				? `TODO: ${feature.name}`
				: feature.name;
			const description = feature.isTodo
				? `${feature.description}\n\n(Delete this trait once resolved — added by betterR20 sidekick level-up, ${feature.source})`
				: `${feature.description}\n\n(Added by betterR20 sidekick level-up, ${feature.source})`;

			integrants[id] = {
				...base,
				name,
				description,
				source: "Species",
				cascades: {},
				relations: {},
			};
			displayOrder.push(id);
		}

		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return features.length;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────────────────

	/** Return the first integrant of a given type from the store, or null. */
	function findIntegrantByType (store, type) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		return Object.values(ints).find(i => i.type === type) || null;
	}

	function getProficiencyIntegrants (store, category) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		return Object.values(ints).filter(i => i.type === "Proficiency" && i.category === category);
	}

	function getExistingProficiencies (store) {
		return {
			saves: new Set(getProficiencyIntegrants(store, "Saving Throw").map(i => i.proficiency).filter(Boolean)),
			skills: new Set(getProficiencyIntegrants(store, "Skill").map(i => i.proficiency).filter(Boolean)),
		};
	}

	function getSidekickBonusProficiencyConfig (sidekickType) {
		return sidekickType ? SIDEKICK_BONUS_PROFICIENCY_CONFIG[sidekickType] || null : null;
	}

	function makeBonusProfChoiceState (store, sidekickType) {
		const config = getSidekickBonusProficiencyConfig(sidekickType);
		if (!config) return null;
		const existing = getExistingProficiencies(store);
		const makeItems = (configKey, existingSet) => config[configKey].options.map(option => ({
			value: option,
			isNative: existingSet.has(option),
		}));
		return {
			saves: {
				maxChoices: config.saves.maxChoices,
				items: makeItems("saves", existing.saves),
			},
			skills: {
				maxChoices: config.skills.maxChoices,
				items: makeItems("skills", existing.skills),
			},
		};
	}

	function getBonusProficiencyRequirementText (sidekickType) {
		const config = getSidekickBonusProficiencyConfig(sidekickType);
		if (!config) return "Choose the level 1 sidekick Bonus Proficiencies for this class feature.";
		return `Choose the level 1 sidekick Bonus Proficiencies for this class feature: ${config.saves.maxChoices} saving throw${config.saves.maxChoices === 1 ? "" : "s"} and ${config.skills.maxChoices} skill proficienc${config.skills.maxChoices === 1 ? "y" : "ies"}.`;
	}

	function isAutomatedBonusProficienciesFeature (feature) {
		return feature && feature.name === "Bonus Proficiencies" && feature.level === 1;
	}

	function renderBonusProfCheckboxes (items, inputName) {
		return items.map(item => `
			<label class="b20-sidekick-checkbox ${item.isNative ? "b20-sidekick-checkbox-locked" : ""}">
				<input type="checkbox" name="${inputName}" value="${item.value}" ${item.isNative ? 'checked disabled data-native="true"' : ""}>
				<span>${item.value}${item.isNative ? ' <span class="b20-sidekick-note">(native proficiency)</span>' : ""}</span>
			</label>
		`).join("");
	}

	function readSelectedValues ($dialog, inputName) {
		return $dialog.find(`input[name="${inputName}"]:checked`).map((_, el) => $(el).val()).get();
	}

	function enforceCheckboxLimit ($dialog, inputName, maxChoices) {
		const $inputs = $dialog.find(`input[name="${inputName}"]`);
		const checkedCount = $inputs.filter(":checked").filter((_, el) => !$(el).is("[data-native=true]")).length;
		const shouldDisableUnchecked = checkedCount >= maxChoices;
		$inputs.each((_, el) => {
			const $el = $(el);
			const $label = $el.closest(".b20-sidekick-checkbox");
			if ($el.is("[data-native=true]")) {
				$el.prop("disabled", true);
				$label.addClass("b20-sidekick-checkbox-locked");
				return;
			}
			const isVisuallyLocked = shouldDisableUnchecked && !$el.is(":checked");
			$el.prop("disabled", isVisuallyLocked);
			$label.toggleClass("b20-sidekick-checkbox-locked", isVisuallyLocked);
		});
	}

	function validateBonusProfChoices ($dialog, sidekickType) {
		const config = getSidekickBonusProficiencyConfig(sidekickType);
		if (!config) return { ok: true, selections: { saves: [], skills: [] } };
		const selections = {
			saves: readSelectedValues($dialog, "bonusProfSaves").filter(value => !$dialog.find(`input[name="bonusProfSaves"][value="${value}"]`).is("[data-native=true]")),
			skills: readSelectedValues($dialog, "bonusProfSkills").filter(value => !$dialog.find(`input[name="bonusProfSkills"][value="${value}"]`).is("[data-native=true]")),
		};
		if (selections.saves.length < config.saves.maxChoices) {
			return { ok: false, message: `Select ${config.saves.maxChoices} saving throw proficiency${config.saves.maxChoices === 1 ? "" : "ies"} before continuing.` };
		}
		if (selections.skills.length < config.skills.maxChoices) {
			return { ok: false, message: `Select ${config.skills.maxChoices} skill proficienc${config.skills.maxChoices === 1 ? "y" : "ies"} before continuing.` };
		}
		return { ok: true, selections };
	}

	function makeProficiencyIntegrant (category, proficiency, pos) {
		const { id, base } = d20plus.store2024.makeIntegrantBase("Proficiency", pos);
		return {
			id,
			integrant: {
				...base,
				name: category === "Saving Throw" ? "Saving Throw Proficiency" : "Skill Proficiency",
				category,
				proficiency,
				proficiencyLevel: "Proficient",
				increaseIfAlreadyAt: false,
				rollAbility: "Query Attribute",
				notes: "",
				cascades: {},
				relations: {},
			},
		};
	}

	function applyBonusProficiencies (store, selections) {
		if (!selections || (!selections.saves?.length && !selections.skills?.length)) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		const existing = getExistingProficiencies(store);
		let pos = d20plus.store2024.getNextArrayPos(store);
		let added = 0;
		(selections.saves || []).forEach(proficiency => {
			if (existing.saves.has(proficiency)) return;
			const { id, integrant } = makeProficiencyIntegrant("Saving Throw", proficiency, pos++);
			store.integrants.integrants[id] = integrant;
			existing.saves.add(proficiency);
			added++;
		});
		(selections.skills || []).forEach(proficiency => {
			if (existing.skills.has(proficiency)) return;
			const { id, integrant } = makeProficiencyIntegrant("Skill", proficiency, pos++);
			store.integrants.integrants[id] = integrant;
			existing.skills.add(proficiency);
			added++;
		});
		return added;
	}

	function formatChosenBonusProficiencies (selections) {
		const saves = selections?.saves?.length ? selections.saves.join(", ") : "None";
		const skills = selections?.skills?.length ? selections.skills.join(", ") : "None";
		return { saves, skills };
	}

	function getBonusProficiencyFeatureDescription (sidekickType, selections) {
		const sidekickFeatures = d20plus.sidekickData && d20plus.sidekickData[sidekickType];
		const baseFeature = sidekickFeatures && sidekickFeatures.find(feature => feature.name === "Bonus Proficiencies" && feature.level === 1);
		const { saves, skills } = formatChosenBonusProficiencies(selections);
		const baseDescription = baseFeature ? baseFeature.description : "The sidekick gains its level 1 Bonus Proficiencies feature.";
		return `${baseDescription}\n\nChosen saving throw proficiencies: ${saves}\nChosen skill proficiencies: ${skills}`;
	}

	function writeBonusProficiencyFeature (store, sidekickType, selections) {
		if (!sidekickType || !selections) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const integrants = store.integrants.integrants;
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);
		integrants[id] = {
			...base,
			name: "Bonus Proficiencies",
			description: `${getBonusProficiencyFeatureDescription(sidekickType, selections)}\n\n(Added by betterR20 sidekick level-up, recorded from level 1 sidekick feature choices.)`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.push(id);
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return 1;
	}

	/**
	 * Expert Helpful (L1): create a Bonus Action "Help" action entry so the feature
	 * is actually usable on the sheet, not just a descriptive trait.
	 * Idempotent: if a Bonus Action Help already exists, no duplicate is created.
	 */
	function applyHelpfulBonusAction (store, sidekickType, featureFromLevel, targetSidekickLevel) {
		if (sidekickType !== "expert") return 0;
		const helpfulFeatures = getFeaturesByName(sidekickType, featureFromLevel, targetSidekickLevel, "Helpful");
		if (!helpfulFeatures.length) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		const ints = store.integrants.integrants;
		const exists = Object.values(ints).some(i =>
			i
			&& i.type === "Action"
			&& (i.actionType === "Bonus Action")
			&& String(i.name || "").toLowerCase() === "help"
		);
		if (exists) return 0;
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Action", pos);
		ints[id] = {
			...base,
			name: "Help",
			actionType: "Bonus Action",
			displayAsAttack: false,
			description: "You can lend your aid to another creature in the completion of a task. When you take the Help action, the creature you aid gains advantage on the next ability check it makes to perform the task you are helping with, provided that it makes the check before the start of your next turn.\n\nAlternatively, you can aid a friendly creature in attacking a creature within 5 feet of you. You feint, distract the target, or in some other way team up to make your ally's attack more effective. If your ally attacks the target before your next turn, the first attack roll is made with advantage.\n\n(Added by betterR20 sidekick Helpful automation.)",
			rechargeType: "None",
			range: "",
			target: "",
			conditions: "",
			cascades: {},
			relations: {},
		};
		return 1;
	}

	/** Build a sidekick copy name, stripping any previous sidekick/level suffixes. */
	function getLevelUpName (sourceName) {
		const base = (sourceName || "Unnamed")
			.replace(/\s*\(Level\s+\d+\)/gi, "")
			.replace(/\s*\(Sidekick\)/gi, "")
			.trim();
		return `${base} (Sidekick)`;
	}

	function sidekickLevelToCr (level) {
		const lvl = Math.max(1, Math.min(Number(level) || 1, 20));
		return SIDEKICK_LEVEL_TO_CR[lvl] || "18";
	}

	function buildSidekickTags (existingTags, sidekickType, sidekickLevel) {
		const raw = existingTags == null ? "" : existingTags;
		let asList;
		if (Array.isArray(raw)) {
			asList = raw;
		} else {
			const str = String(raw).trim();
			// Roll20 stores tags as a JSON array string e.g. ["_roll20_internal_party_tag_"]
			if (str.startsWith("[")) {
				try { asList = JSON.parse(str); } catch (e) { asList = [str]; }
			} else {
				asList = str ? str.split(",") : [];
			}
		}
		const tokens = asList
			.map(t => String(t).trim())
			.filter(Boolean)
			.filter(t => !/^sidekick$/i.test(t))
			.filter(t => !/^sidekick-type:/i.test(t))
			.filter(t => !/^sidekick-level:/i.test(t));
		const typeLabel = d20plus.sidekickData ? d20plus.sidekickData.typeLabel(sidekickType || "unknown") : (sidekickType || "unknown");
		tokens.push("Sidekick");
		tokens.push(`Sidekick-Type: ${typeLabel}`);
		tokens.push(`Sidekick-Level: ${sidekickLevel}`);
		// Return as a JSON array so Roll20 round-trips it correctly
		return JSON.stringify(tokens);
	}

	function shouldApplyBonusProficiencies (currentLevel, targetLevel) {
		return currentLevel <= 1 && targetLevel >= 1;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Ability Score Improvement (ASI) helpers
	// ─────────────────────────────────────────────────────────────────────────

	const ASI_ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

	/**
	 * Return the current ability scores from the store as a map { Strength: 10, ... }.
	 */
	function getAbilityScoresFromStore (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		const scores = {};
		for (const int of Object.values(ints)) {
			if (int.type === "Ability Score" && ASI_ABILITIES.includes(int.ability)) {
				scores[int.ability] = (int.valueFormula && int.valueFormula.flatValue != null)
					? int.valueFormula.flatValue
					: 10;
			}
		}
		// Fill missing abilities with 10
		for (const ab of ASI_ABILITIES) { if (scores[ab] == null) scores[ab] = 10; }
		return scores;
	}

	/**
	 * Return the list of ASI features gained between featureFromLevel+1 and targetLevel.
	 * Each ASI instance in the sidekick data is a separate feature entry.
	 */
	function getAsiFeatures (sidekickType, featureFromLevel, targetSidekickLevel) {
		if (!d20plus.sidekickData || !sidekickType) return [];
		return d20plus.sidekickData.getFeaturesGained(sidekickType, featureFromLevel, targetSidekickLevel)
			.filter(f => f.name === "Ability Score Improvement");
	}

	/**
	 * True when a feature is an ASI that betterR20 is automating.
	 */
	function isAutomatedAsiFeature (feature) {
		return feature && feature.name === "Ability Score Improvement";
	}

	/** Features whose TODO is resolved by a dialog choice/automation rather than manually. */
	function isDialogAutomatedFeature (feature) {
		if (!feature) return false;
		return isAutomatedBonusProficienciesFeature(feature)
			|| isAutomatedAsiFeature(feature)
			|| feature.name === "Spellcasting Advancement"
			|| feature.name === "Expertise"
			|| feature.name === "Sharp Mind"
			|| feature.name === "Empowered Spells";
	}

	/**
	 * Returns true when at least one ASI needs to be chosen in the given level range.
	 */
	function shouldApplyAsi (sidekickType, featureFromLevel, targetSidekickLevel) {
		return getAsiFeatures(sidekickType, featureFromLevel, targetSidekickLevel).length > 0;
	}

	/**
	 * Render the ASI picker for one ASI instance.
	 * instanceIndex: 0-based index used for input names (asiFeat-0, asiAbility1-0, asiAbility2-0)
	 */
	function renderAsiPicker (scores, instanceIndex, asiLevel) {
		const i = instanceIndex;
		const abilityOptions = ASI_ABILITIES.map(ab =>
			`<option value="${ab}">${ab} (${scores[ab] ?? 10})</option>`
		).join("");
		const featOptions = [{name: "Ability Score Improvement", source: "betterR20", isAsi: true}]
			.concat(d20plus.sidekickData.getFeatOptionsForLevel ? d20plus.sidekickData.getFeatOptionsForLevel(asiLevel) : []);
		const featOptionsHtml = featOptions
			.map(f => `<option value="${f.name}|${f.source}">${f.name}</option>`)
			.join("");
		return `
			<div class="b20-asi-instance" data-asi-index="${i}">
				<p style="margin:0 0 6px;font-weight:600;font-size:12px;color:#334155">ASI gained at level ${asiLevel}</p>
				<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
					<label class="b20-asi-mode-label" style="gap:8px">
						<span style="min-width:72px;font-weight:600">Feat:</span>
						<select name="asiFeat-${i}" style="max-width:300px">
							${featOptionsHtml}
						</select>
					</label>
					<div class="b20-asi-score-controls" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
						<label class="b20-asi-mode-label">
							<input type="radio" name="asiMode${i}" value="one" checked>
							<span>+2 to one score:</span>
							<select name="asiAbility1-${i}" style="margin-left:6px">
								${abilityOptions}
							</select>
						</label>
						<label class="b20-asi-mode-label">
							<input type="radio" name="asiMode${i}" value="two">
							<span>+1 to two scores:</span>
							<select name="asiAbilityA-${i}" style="margin-left:6px">
								${abilityOptions}
							</select>
							<span style="margin:0 6px">and</span>
							<select name="asiAbilityB-${i}" style="margin-left:0">
								${abilityOptions.replace(/<option value="Strength"/, '<option value="Strength" selected')}
							</select>
						</label>
					</div>
				</div>
				<div class="b20-asi-feat-note" style="margin:8px 0 0;display:none;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc">
					<div style="font-size:11px;color:#64748b;margin-bottom:4px">The feat's text is added as a trait; apply any mechanical effects manually.</div>
					<div class="b20-asi-feat-preview" style="font-size:12px;line-height:1.4;color:#334155;white-space:pre-wrap">Choose a feat to preview its effects.</div>
				</div>
			</div>
		`;
	}

	/**
	 * Render all ASI pickers for the given level range.
	 * Returns HTML string, or "" if no ASIs in range.
	 */
	function renderAsiSection ($container, store, sidekickType, featureFromLevel, targetSidekickLevel) {
		const asiFeatures = getAsiFeatures(sidekickType, featureFromLevel, targetSidekickLevel);
		if (!asiFeatures.length) { $container.html(""); return; }
		const scores = getAbilityScoresFromStore(store);
		const pickersHtml = asiFeatures.map((f, idx) => renderAsiPicker(scores, idx, f.level)).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:10px 0">');
		$container.html(`
			<div class="b20-sidekick-card">
				<h4>Ability Score Improvement${asiFeatures.length > 1 ? "s" : ""}</h4>
				<p style="margin:0 0 10px;color:#475569;font-size:12px">Increase one ability score by 2, or two ability scores by 1 each (max 20). Feat choices are limited to legal XPHB options for that level: Origin/General feats before 19, Epic Boons from 19+, no Fighting Style feats.</p>
				${pickersHtml}
			</div>
		`);
		$container.find("select[name^='asiFeat-']").on("change", function () {
			const $inst = $(this).closest(".b20-asi-instance");
			updateAsiFeatPreview($inst, $inst.data("asi-index"));
		});
		$container.find("input[type=radio]").on("change", function () {
			updateAsiSelectState($container);
		});
		updateAsiSelectState($container);
	}

	function updateAsiSelectState ($container) {
		$container.find(".b20-asi-instance").each((_, el) => {
			const $inst = $(el);
			const idx = $inst.data("asi-index");
			const featVal = $inst.find(`select[name="asiFeat-${idx}"]`).val() || "";
			const [featName] = featVal.split("|");
			const isAsi = featName === "Ability Score Improvement";
			const mode = isAsi ? ($inst.find(`input[name="asiMode${idx}"]:checked`).val() || "one") : "feat";
			$inst.find(`input[name="asiMode${idx}"]`).prop("disabled", !isAsi);
			$inst.find(".b20-asi-score-controls").css("display", isAsi ? "flex" : "none");
			$inst.find(`select[name="asiAbility1-${idx}"]`).prop("disabled", !isAsi || mode !== "one");
			$inst.find(`select[name="asiAbilityA-${idx}"], select[name="asiAbilityB-${idx}"]`).prop("disabled", !isAsi || mode !== "two");
			$inst.find(".b20-asi-feat-note").css("display", isAsi ? "none" : "block");
			if (!isAsi) updateAsiFeatPreview($inst, idx);
		});
	}

	function updateAsiFeatPreview ($inst, idx) {
		const featVal = $inst.find(`select[name="asiFeat-${idx}"]`).val();
		const $preview = $inst.find(".b20-asi-feat-preview");
		if (!featVal) {
			$preview.text("Choose a feat to preview its effects.");
			return;
		}
		const [featName, featSource] = featVal.split("|");
		const featData = d20plus.sidekickData.getFeatByName(featName, featSource);
		const summary = featData && d20plus.sidekickData.getFeatSummary
			? d20plus.sidekickData.getFeatSummary(featData)
			: "";
		$preview.text(summary || "No feat summary available.");
	}

	/**
	 * Read and validate ASI choices from the dialog.
	 * Returns { ok, message, asiChoices: [{ability, bonus}, ...] (flat score bumps),
	 * asiInstances: [{mode, choiceDesc, feat?}] aligned with the ASI features in range }.
	 */
	function validateAsiChoices ($dialog, sidekickType, featureFromLevel, targetSidekickLevel) {
		const asiFeatures = getAsiFeatures(sidekickType, featureFromLevel, targetSidekickLevel);
		if (!asiFeatures.length) return { ok: true, asiChoices: [], asiInstances: [] };
		const asiChoices = [];
		const asiInstances = [];
		for (let i = 0; i < asiFeatures.length; i++) {
			const featVal = $dialog.find(`select[name="asiFeat-${i}"]`).val();
			if (!featVal) return { ok: false, message: `Select a feat for ASI ${i + 1}.` };
			const [featName, featSource] = featVal.split("|");
			if (featName === "Ability Score Improvement") {
				const mode = $dialog.find(`input[name="asiMode${i}"]:checked`).val() || "one";
				const ability = $dialog.find(`select[name="asiAbility1-${i}"]`).val();
				if (mode === "one") {
					if (!ability) return { ok: false, message: `Select an ability score for ASI ${i + 1}.` };
					asiChoices.push({ ability, bonus: 2 });
					asiInstances.push({ mode, choiceDesc: `+2 ${ability}` });
				} else if (mode === "two") {
					const abilityA = $dialog.find(`select[name="asiAbilityA-${i}"]`).val();
					const abilityB = $dialog.find(`select[name="asiAbilityB-${i}"]`).val();
					if (!abilityA || !abilityB) return { ok: false, message: `Select both ability scores for ASI ${i + 1}.` };
					if (abilityA === abilityB) return { ok: false, message: `ASI ${i + 1}: choose two different ability scores for the +1/+1 option.` };
					asiChoices.push({ ability: abilityA, bonus: 1 }, { ability: abilityB, bonus: 1 });
					asiInstances.push({ mode, choiceDesc: `+1 ${abilityA}, +1 ${abilityB}` });
				} else {
					return { ok: false, message: `Choose an Ability Score Improvement mode for ASI ${i + 1}.` };
				}
			} else {
				const featData = d20plus.sidekickData.getFeatByName(featName, featSource);
				if (!featData) return { ok: false, message: `Feat "${featName}" not found in the bundled data.` };
				const text = d20plus.sidekickData.entriesToText(featData.entries);
				asiInstances.push({ mode: "feat", choiceDesc: `Feat: ${featName}`, feat: { name: featName, source: featSource, page: featData.page, text } });
			}
		}
		return { ok: true, asiChoices, asiInstances };
	}

	/**
	 * Apply ASI choices to the store: bump the flatValue of each Ability Score integrant.
	 * Returns number of integrant score bumps applied.
	 */
	function applyAsiToStore (store, asiChoices) {
		if (!asiChoices || !asiChoices.length) return 0;
		const ints = (store.integrants && store.integrants.integrants) || {};
		let applied = 0;
		// Accumulate total bonus per ability (multiple ASIs can target same ability)
		const bonusByAbility = {};
		for (const { ability, bonus } of asiChoices) {
			bonusByAbility[ability] = (bonusByAbility[ability] || 0) + bonus;
		}
		for (const int of Object.values(ints)) {
			if (int.type === "Ability Score" && bonusByAbility[int.ability] != null) {
				const current = (int.valueFormula && int.valueFormula.flatValue != null) ? int.valueFormula.flatValue : 10;
				const newScore = Math.min(20, current + bonusByAbility[int.ability]);
				if (!int.valueFormula) int.valueFormula = {};
				int.valueFormula.flatValue = newScore;
				applied++;
			}
		}
		return applied;
	}

	/**
	 * Write the ASI feature trait(s) to the store, one trait per ASI instance.
	 * Returns number of traits written.
	 */
	/**
	 * Write the ASI feature trait(s) to the store, one trait per ASI instance.
	 * When asiInstances is provided (from validateAsiChoices), feat-mode instances
	 * write the chosen feat's text as a trait instead of an ASI trait.
	 * Returns number of traits written.
	 */
	function writeAsiFeatures (store, sidekickType, featureFromLevel, targetSidekickLevel, asiChoices, asiInstances) {
		const asiFeatures = getAsiFeatures(sidekickType, featureFromLevel, targetSidekickLevel);
		if (!asiFeatures.length || (!asiChoices && !asiInstances)) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const integrants = store.integrants.integrants;
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		let pos = d20plus.store2024.getNextArrayPos(store);
		let choiceOffset = 0;
		let written = 0;
		for (let fi = 0; fi < asiFeatures.length; fi++) {
			const f = asiFeatures[fi];
			const instance = asiInstances && asiInstances[fi];
			let name = "Ability Score Improvement";
			let description;
			if (instance && instance.mode === "feat" && instance.feat) {
				const feat = instance.feat;
				name = `Feat: ${feat.name}`;
				description = `${feat.text}\n\n(Chosen instead of the level ${f.level} Ability Score Improvement. Feat text only — apply any mechanical effects manually. Added by betterR20 sidekick level-up, ${feat.source}${feat.page ? ` p.${feat.page}` : ""})`;
			} else {
				let choiceDesc;
				if (instance) {
					choiceDesc = instance.choiceDesc;
				} else {
					// Legacy fallback: reconstruct per-ASI text from the flat bump list
					const firstChoice = asiChoices[choiceOffset];
					if (!firstChoice) {
						choiceDesc = "(no selection recorded)";
					} else if (firstChoice.bonus === 2) {
						choiceDesc = `+2 ${firstChoice.ability}`;
						choiceOffset += 1;
					} else {
						const secondChoice = asiChoices[choiceOffset + 1];
						choiceDesc = secondChoice
							? `+1 ${firstChoice.ability}, +1 ${secondChoice.ability}`
							: `+1 ${firstChoice.ability}`;
						choiceOffset += secondChoice ? 2 : 1;
					}
				}
				description = `${f.description}\n\nChosen: ${choiceDesc}\n\n(Added by betterR20 sidekick level-up, ${f.source})`;
			}
			const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos++);
			integrants[id] = {
				...base,
				name,
				description,
				source: "Species",
				cascades: {},
				relations: {},
			};
			displayOrder.push(id);
			written++;
		}
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return written;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Expertise (expert L3/L15), Sharp Mind (expert L18), Martial Role (warrior)
	// ─────────────────────────────────────────────────────────────────────────

	function getFeaturesByName (sidekickType, fromLevel, toLevel, name) {
		if (!d20plus.sidekickData || !sidekickType) return [];
		return d20plus.sidekickData.getFeaturesGained(sidekickType, fromLevel, toLevel)
			.filter(f => f.name === name);
	}

	/** Skills the sidekick is proficient (but not yet expert) in, sorted. */
	function getExpertiseCandidates (store) {
		return getProficiencyIntegrants(store, "Skill")
			.filter(i => i.proficiency && (i.proficiencyLevel || "Proficient") === "Proficient")
			.map(i => i.proficiency)
			.sort();
	}

	/** Skills already at Expertise on the sheet. */
	function getExistingExpertiseSkills (store) {
		return new Set(getProficiencyIntegrants(store, "Skill")
			.filter(i => i.proficiency && i.proficiencyLevel === "Expertise")
			.map(i => i.proficiency));
	}

	/**
	 * Render the Expertise picker (expert L3/L15). Options are the sidekick's
	 * proficient skills plus any skills currently ticked in the Bonus
	 * Proficiencies section of the same dialog (pendingSkills).
	 */
	function renderExpertiseSection ($container, store, sidekickType, fromLevel, toLevel, pendingSkills) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Expertise");
		if (!features.length) { $container.html("").removeData("b20ExpKey"); return; }
		const maxChoices = 2 * features.length;
		const existingExpertise = getExistingExpertiseSkills(store);
		const options = [...new Set([...getExpertiseCandidates(store), ...(pendingSkills || [])])]
			.filter(skill => !existingExpertise.has(skill))
			.sort();
		const renderKey = `${sidekickType}|${fromLevel}|${toLevel}|${options.join(",")}`;
		if ($container.data("b20ExpKey") === renderKey) return;
		// Preserve any picks that survive the option-list change
		const previousPicks = new Set(readSelectedValues($container, "expertiseSkills"));
		$container.data("b20ExpKey", renderKey);
		if (!options.length) {
			$container.html(`<div class="b20-sidekick-card"><h4>Expertise</h4><p style="margin:0;color:#c0392b;font-size:12px">No proficient skills found to choose Expertise from — resolve the TODO trait manually.</p></div>`);
			return;
		}
		const levelsText = features.map(f => f.level).join(" and ");
		$container.html(`
			<div class="b20-sidekick-card b20-expertise-picker">
				<h4>Expertise</h4>
				<p style="margin:0 0 6px;color:#475569;font-size:12px">Gained at level ${levelsText}: choose ${maxChoices} of the sidekick's skill proficiencies. Its proficiency bonus is doubled for ability checks using those skills. (<span class="b20-expertise-count">0</span>/${maxChoices} chosen)</p>
				<div class="b20-spell-check-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px 10px">
					${options.map(skill => `
						<label class="b20-sidekick-checkbox">
							<input type="checkbox" name="expertiseSkills" value="${skill}" ${previousPicks.has(skill) ? "checked" : ""}>
							<span>${skill}</span>
						</label>`).join("")}
				</div>
			</div>
		`);
		const update = () => {
			enforceCheckboxLimit($container, "expertiseSkills", maxChoices);
			$container.find(".b20-expertise-count").text(readSelectedValues($container, "expertiseSkills").length);
		};
		$container.off(".b20exp").on("change.b20exp", "input[name=expertiseSkills]", update);
		update();
	}

	function validateExpertiseChoices ($dialog, sidekickType, fromLevel, toLevel) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Expertise");
		if (!features.length || !$dialog.find(".b20-expertise-picker").length) return { ok: true, expertiseChoices: null };
		const maxChoices = 2 * features.length;
		const chosen = readSelectedValues($dialog, "expertiseSkills");
		if (chosen.length !== maxChoices) {
			return { ok: false, message: `Select exactly ${maxChoices} skills for Expertise.` };
		}
		return { ok: true, expertiseChoices: chosen };
	}

	/** Set proficiencyLevel = "Expertise" on the matching Skill Proficiency integrants. */
	function applyExpertise (store, skills) {
		if (!skills || !skills.length) return 0;
		let applied = 0;
		getProficiencyIntegrants(store, "Skill").forEach(int => {
			if (skills.includes(int.proficiency) && int.proficiencyLevel !== "Expertise") {
				int.proficiencyLevel = "Expertise";
				applied++;
			}
		});
		return applied;
	}

	function writeExpertiseFeature (store, sidekickType, fromLevel, toLevel, skills) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Expertise");
		if (!features.length || !skills || !skills.length) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);
		store.integrants.integrants[id] = {
			...base,
			name: "Expertise",
			description: `${features[0].description}\n\nChosen skills: ${skills.join(", ")}\n\n(Added by betterR20 sidekick level-up, ${features[0].source})`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.push(id);
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return 1;
	}

	/** Render the Sharp Mind picker (expert L18): one save from Int/Wis/Cha. */
	function renderSharpMindSection ($container, store, sidekickType, fromLevel, toLevel) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Sharp Mind");
		if (!features.length) { $container.html("").removeData("b20SharpKey"); return; }
		const renderKey = `${sidekickType}|${fromLevel}|${toLevel}`;
		if ($container.data("b20SharpKey") === renderKey) return;
		$container.data("b20SharpKey", renderKey);
		const existingSaves = getExistingProficiencies(store).saves;
		const options = ["Intelligence", "Wisdom", "Charisma"];
		$container.html(`
			<div class="b20-sidekick-card b20-sharpmind-picker">
				<h4>Sharp Mind</h4>
				<p style="margin:0 0 6px;color:#475569;font-size:12px">Gained at level 18: choose one saving throw proficiency.</p>
				${options.map((save, i) => {
					const isNative = existingSaves.has(save);
					return `<label class="b20-sidekick-checkbox ${isNative ? "b20-sidekick-checkbox-locked" : ""}">
						<input type="radio" name="sharpMindSave" value="${save}" ${isNative ? "disabled" : ""}>
						<span>${save}${isNative ? ' <span class="b20-sidekick-note">(already proficient)</span>' : ""}</span>
					</label>`;
				}).join("")}
			</div>
		`);
	}

	function validateSharpMindChoice ($dialog, sidekickType, fromLevel, toLevel) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Sharp Mind");
		if (!features.length || !$dialog.find(".b20-sharpmind-picker").length) return { ok: true, sharpMindChoice: null };
		const chosen = $dialog.find("input[name=sharpMindSave]:checked").val();
		if (!chosen) return { ok: false, message: "Select a saving throw proficiency for Sharp Mind." };
		return { ok: true, sharpMindChoice: chosen };
	}

	function writeSharpMindFeature (store, sidekickType, fromLevel, toLevel, save) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Sharp Mind");
		if (!features.length || !save) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);
		store.integrants.integrants[id] = {
			...base,
			name: "Sharp Mind",
			description: `${features[0].description}\n\nChosen saving throw: ${save}\n\n(Added by betterR20 sidekick level-up, ${features[0].source})`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.push(id);
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return 1;
	}

	const MAGIC_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];

	/** Render the Empowered Spells picker (spellcaster L14): one school of magic. */
	function renderEmpoweredSpellsSection ($container, store, sidekickType, fromLevel, toLevel) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Empowered Spells");
		if (!features.length) { $container.html("").removeData("b20EmpKey"); return; }
		const renderKey = `${sidekickType}|${fromLevel}|${toLevel}`;
		if ($container.data("b20EmpKey") === renderKey) return;
		$container.data("b20EmpKey", renderKey);
		$container.html(`
			<div class="b20-sidekick-card b20-empowered-picker">
				<h4>Empowered Spells</h4>
				<p style="margin:0 0 6px;color:#475569;font-size:12px">Gained at level 14: choose one school of magic. The sidekick adds its spellcasting ability modifier to damage and healing rolls of leveled spells of that school (applied automatically, including spells learned later).</p>
				<label style="font-size:12px;color:#475569">School:
					<select name="empoweredSchool" style="margin-left:6px">
						<option value="">— choose a school —</option>
						${MAGIC_SCHOOLS.map(s => `<option value="${s}">${s}</option>`).join("")}
					</select>
				</label>
			</div>
		`);
	}

	function validateEmpoweredSpellsChoice ($dialog, sidekickType, fromLevel, toLevel) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Empowered Spells");
		if (!features.length || !$dialog.find(".b20-empowered-picker").length) return { ok: true, empoweredSchool: null };
		const chosen = $dialog.find("select[name=empoweredSchool]").val();
		if (!chosen) return { ok: false, message: "Select a school of magic for Empowered Spells." };
		return { ok: true, empoweredSchool: chosen };
	}

	function writeEmpoweredSpellsFeature (store, sidekickType, fromLevel, toLevel, school) {
		const features = getFeaturesByName(sidekickType, fromLevel, toLevel, "Empowered Spells");
		if (!features.length || !school) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);
		store.integrants.integrants[id] = {
			...base,
			name: "Empowered Spells",
			description: `${features[0].description}\n\nChosen school: ${school}\n\n(Applied automatically by betterR20 to the sidekick's ${school} spell damage/healing rolls, including spells learned later. Added by betterR20 sidekick level-up, ${features[0].source})`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.push(id);
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return 1;
	}

	/**
	 * Martial Role: Attacker — add +2 to every Attack integrant's flat to-hit
	 * bonus. Marked with _b20AttackerBonus so re-running level-ups is idempotent
	 * while attacks added since the last level-up still get the bonus.
	 * @returns {number} attacks updated
	 */
	function applyMartialRoleAttacker (store, sidekickType) {
		if (sidekickType !== "warrior-attacker") return 0;
		const ints = (store.integrants && store.integrants.integrants) || {};
		let applied = 0;
		Object.values(ints).forEach(int => {
			if (!int || int.type !== "Attack" || !int.attack) return;
			if (int._b20AttackerBonus) return;
			int.attack.bonus = (Number(int.attack.bonus) || 0) + 2;
			int._b20AttackerBonus = true;
			applied++;
		});
		return applied;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Spellcasting Advancement — spell picks (mage/healer/prodigy)
	// ─────────────────────────────────────────────────────────────────────────

	function isSpellcasterType (sidekickType) {
		return !!(d20plus.sidekickData && d20plus.sidekickData.SPELL_LISTS && d20plus.sidekickData.SPELL_LISTS[sidekickType]);
	}

	/** Cantrips/spells newly known going from fromLevel to toLevel (fromLevel 0 = full loadout). */
	function getSpellPickDelta (fromLevel, toLevel) {
		const known = (d20plus.sidekickData && d20plus.sidekickData.spellcasterKnown) || {};
		const from = known[fromLevel] || [0, 0];
		const to = known[toLevel] || from;
		return { cantrips: Math.max(0, to[0] - from[0]), spells: Math.max(0, to[1] - from[1]) };
	}

	/** All Spell integrants in the store, as [{id, name, level}]. */
	function getKnownSpellIntegrants (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		return Object.entries(ints)
			.filter(([, it]) => it && it.type === "Spell")
			.map(([id, it]) => ({ id, name: it.name || "(unnamed)", level: it.level || 0 }))
			.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
	}

	function renderSpellCheckboxes (options, inputName, knownNames) {
		return options.map(sp => {
			const isKnown = knownNames.has(sp.name.toLowerCase());
			return `<label class="b20-sidekick-checkbox ${isKnown ? "b20-sidekick-checkbox-locked" : ""}" data-spell-name="${sp.name.toLowerCase()}">
				<input type="checkbox" name="${inputName}" value="${sp.name}" ${isKnown ? 'checked disabled data-native="true"' : ""}>
				<span>${sp.name}${isKnown ? ' <span class="b20-sidekick-note">(known)</span>' : ""}</span>
				<a class="b20-spell-info" data-spell="${sp.name}" title="Show spell details" style="cursor:pointer;color:#2563eb;font-weight:bold;margin-left:2px;text-decoration:none">&#9432;</a>
			</label>`;
		}).join("");
	}

	/** Open a small dialog showing the full rendered spell details. */
	function showSpellDetailDialog (spellName) {
		const spell = d20plus.sidekickData && d20plus.sidekickData.getSpellByName(spellName);
		if (!spell) return alert(`Spell "${spellName}" not found in the bundled data.`);
		let html;
		try {
			// Deep clone — _getHandoutData mutates its input (defaults, roll20 meta)
			const [notecontents] = d20plus.spells._getHandoutData(JSON.parse(JSON.stringify(spell)));
			// Strip the embedded machine-readable JSON blob
			html = notecontents.replace(/<del class="hidden">[\s\S]*<\/del>/, "");
		} catch (e) {
			html = `<p>Could not render spell details — see console.</p>`;
			logError(`showSpellDetailDialog failed for "${spellName}":`, e);
		}
		const $detail = $(`<div class="b20-spell-detail" style="max-height:60vh;overflow:auto;font-size:13px;line-height:1.45;padding:2px 6px">${html}</div>`);
		$detail.dialog({
			title: spellName,
			width: 480,
			resizable: true,
			close: () => { $detail.dialog("destroy").remove(); },
			buttons: { Close: () => { $detail.dialog("destroy").remove(); } },
		});
	}

	/**
	 * Render the Spellcasting Advancement picker into $container.
	 * fromLevel 0 = Make Sidekick (full loadout); otherwise level-up delta.
	 * No-op (clears container) for non-spellcasters or when nothing new is known.
	 */
	function renderSpellPickerSection ($container, store, sidekickType, fromLevel, toLevel) {
		if (!isSpellcasterType(sidekickType)) { $container.html("").removeData("b20SpellKey"); return; }
		// Skip re-render when nothing relevant changed (preserves in-progress picks
		// when unrelated dialog inputs trigger a refresh)
		const renderKey = `${sidekickType}|${fromLevel}|${toLevel}`;
		if ($container.data("b20SpellKey") === renderKey) return;
		$container.data("b20SpellKey", renderKey);
		const delta = getSpellPickDelta(fromLevel, toLevel);
		const isLevelUp = fromLevel > 0;
		const knownSpells = getKnownSpellIntegrants(store);
		const knownLeveled = knownSpells.filter(sp => sp.level > 0);
		if (!delta.cantrips && !delta.spells && !(isLevelUp && knownLeveled.length)) { $container.html(""); return; }

		const maxSpellLevel = d20plus.sidekickData.maxSpellLevelAt(toLevel);
		const opts = d20plus.sidekickData.getSpellOptions(sidekickType, maxSpellLevel);
		if (!opts.cantrips.length && !opts.spells.length) {
			$container.html(`<div class="b20-sidekick-card"><h4>Spellcasting Advancement</h4><p style="margin:0;color:#c0392b;font-size:12px">Bundled XPHB spell data unavailable — resolve the TODO trait manually.</p></div>`);
			return;
		}
		const knownNames = new Set(knownSpells.map(sp => sp.name.toLowerCase()));
		const listLabel = d20plus.sidekickData.spellListLabel(sidekickType);

		const cantripHtml = delta.cantrips > 0 ? `
			<div class="b20-spell-group" data-spell-group="cantrip">
				<p class="b20-sidekick-check-title" style="margin:8px 0 6px;color:#475569;font-size:12px">Cantrips (<span class="b20-spell-count-cantrip">0</span>/${delta.cantrips} chosen)</p>
				<div class="b20-spell-check-grid">${renderSpellCheckboxes(opts.cantrips, "spellPickCantrip", knownNames)}</div>
			</div>` : "";

		const spellsByLevel = {};
		opts.spells.forEach(sp => { (spellsByLevel[sp.level] = spellsByLevel[sp.level] || []).push(sp); });
		const spellGroupsHtml = Object.keys(spellsByLevel).sort((a, b) => a - b).map(lvl => `
			<div class="b20-spell-group" data-spell-group="spell">
				<p class="b20-sidekick-check-title" style="margin:8px 0 6px;color:#475569;font-size:12px">Level ${lvl} Spells</p>
				<div class="b20-spell-check-grid">${renderSpellCheckboxes(spellsByLevel[lvl], "spellPickSpell", knownNames)}</div>
			</div>`).join("");
		const spellsHtml = delta.spells > 0 || (isLevelUp && knownLeveled.length) ? `
			<p class="b20-sidekick-check-title" style="margin:8px 0 0;color:#475569;font-size:12px">Spells (<span class="b20-spell-count-spell">0</span>/<span class="b20-spell-limit-spell">${delta.spells}</span> chosen — any level shown below)</p>
			${spellGroupsHtml}` : "";

		const replaceHtml = isLevelUp && knownLeveled.length ? `
			<div style="margin:10px 0 0;padding-top:8px;border-top:1px solid #e2e8f0">
				<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569">Replace one known spell (optional):
					<select name="spellReplaceTarget" style="margin-left:4px">
						<option value="">— no replacement —</option>
						${knownLeveled.map(sp => `<option value="${sp.id}">${sp.name} (level ${sp.level})</option>`).join("")}
					</select>
				</label>
				<p style="margin:4px 0 0;color:#64748b;font-size:11px">Replacing grants one extra spell pick above; the replaced spell is removed from the sheet.</p>
			</div>` : "";

		$container.html(`
			<div class="b20-sidekick-card b20-spell-picker">
				<h4>Spellcasting Advancement</h4>
				<p style="margin:0 0 6px;color:#475569;font-size:12px">Choose from the ${listLabel} spell list (2024 PHB). Max spell level: ${maxSpellLevel}.
					${delta.cantrips ? ` New cantrips: ${delta.cantrips}.` : ""}${delta.spells ? ` New spells: ${delta.spells}.` : ""}</p>
				<label style="display:flex;align-items:center;gap:6px;margin:0 0 6px;font-size:12px;color:#475569;cursor:pointer">
					<input type="checkbox" name="spellPickSkip">Skip spell selection for now (keeps the TODO trait to resolve manually)
				</label>
				<input type="text" class="b20-spell-filter" placeholder="Filter spells…" style="width:220px;margin:0 0 4px;padding:2px 6px">
				<div class="b20-spell-lists">
					${cantripHtml}
					${spellsHtml}
					${replaceHtml}
				</div>
				<style>.b20-spell-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 10px}</style>
			</div>
		`);

		function spellPickLimit () {
			const replacing = $container.find("select[name=spellReplaceTarget]").val();
			return delta.spells + (replacing ? 1 : 0);
		}
		function updateSpellPickerState () {
			const skipped = $container.find("input[name=spellPickSkip]").is(":checked");
			$container.find(".b20-spell-lists").css("opacity", skipped ? 0.4 : 1)
				.find("input,select").prop("disabled", skipped);
			if (skipped) return;
			// Re-enable everything, then let the limit enforcement re-disable as needed
			$container.find(".b20-spell-lists").find("input,select").prop("disabled", false);
			enforceCheckboxLimit($container, "spellPickCantrip", delta.cantrips);
			enforceCheckboxLimit($container, "spellPickSpell", spellPickLimit());
			$container.find(".b20-spell-count-cantrip").text(readSelectedNonNative($container, "spellPickCantrip").length);
			$container.find(".b20-spell-count-spell").text(readSelectedNonNative($container, "spellPickSpell").length);
			$container.find(".b20-spell-limit-spell").text(spellPickLimit());
		}
		$container.off(".b20spell")
			.on("change.b20spell", "input[name=spellPickCantrip], input[name=spellPickSpell], input[name=spellPickSkip], select[name=spellReplaceTarget]", updateSpellPickerState)
			.on("click.b20spell", ".b20-spell-info", function (evt) {
				// Inside a <label> — stop it toggling the checkbox
				evt.preventDefault();
				evt.stopPropagation();
				showSpellDetailDialog($(this).data("spell"));
			})
			.on("input.b20spell", ".b20-spell-filter", function () {
				const q = String($(this).val() || "").toLowerCase().trim();
				$container.find(".b20-sidekick-checkbox[data-spell-name]").each((_, el) => {
					const $el = $(el);
					const show = !q || $el.data("spell-name").includes(q) || $el.find("input").is(":checked");
					$el.css("display", show ? "" : "none");
				});
			});
		updateSpellPickerState();
	}

	function readSelectedNonNative ($scope, inputName) {
		return $scope.find(`input[name="${inputName}"]:checked`).filter((_, el) => !$(el).is("[data-native=true]")).map((_, el) => $(el).val()).get();
	}

	/**
	 * Read + validate spell picks from the dialog.
	 * Returns {ok, message, spellChoices} where spellChoices is null when skipped
	 * or not applicable, else {cantrips: [names], spells: [names], replace: {id, name}|null}.
	 */
	function validateSpellChoices ($dialog, store, sidekickType, fromLevel, toLevel) {
		if (!isSpellcasterType(sidekickType)) return { ok: true, spellChoices: null };
		if (!$dialog.find(".b20-spell-picker").length) return { ok: true, spellChoices: null };
		if ($dialog.find("input[name=spellPickSkip]").is(":checked")) return { ok: true, spellChoices: null };

		const delta = getSpellPickDelta(fromLevel, toLevel);
		const cantrips = readSelectedNonNative($dialog, "spellPickCantrip");
		const spells = readSelectedNonNative($dialog, "spellPickSpell");
		const replaceId = $dialog.find("select[name=spellReplaceTarget]").val() || "";
		const replace = replaceId
			? (() => { const sp = getKnownSpellIntegrants(store).find(k => k.id === replaceId); return sp ? { id: sp.id, name: sp.name } : null; })()
			: null;
		const spellLimit = delta.spells + (replace ? 1 : 0);

		if (cantrips.length !== delta.cantrips) {
			return { ok: false, message: `Select exactly ${delta.cantrips} cantrip${delta.cantrips === 1 ? "" : "s"} (or tick "Skip spell selection").` };
		}
		if (spells.length !== spellLimit) {
			return { ok: false, message: `Select exactly ${spellLimit} spell${spellLimit === 1 ? "" : "s"} (or tick "Skip spell selection").` };
		}
		if (!cantrips.length && !spells.length && !replace) return { ok: true, spellChoices: null };
		return { ok: true, spellChoices: { cantrips, spells, replace } };
	}

	/** Delete a Spell integrant and all descendants, and clean displayOrder. */
	function removeSpellFromStore (store, spellId) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		if (!ints[spellId]) return false;
		// Collect descendants breadth-first via parentID links (covers Attack/Damage/Heal children)
		const toRemove = new Set([spellId]);
		let grew = true;
		while (grew) {
			grew = false;
			Object.entries(ints).forEach(([id, it]) => {
				if (!toRemove.has(id) && it && toRemove.has(it.parentID)) { toRemove.add(id); grew = true; }
			});
		}
		toRemove.forEach(id => delete ints[id]);
		if (store.spells && Array.isArray(store.spells.displayOrder)) {
			store.spells.displayOrder = store.spells.displayOrder.map(lvlJson => {
				try { return JSON.stringify(JSON.parse(lvlJson || "[]").filter(id => !toRemove.has(id))); } catch (e) { return lvlJson; }
			});
		}
		return true;
	}

	/**
	 * Find or create the sidekick's Class + Spellcasting config integrant pair
	 * (mirrors the monster spellcasting import wiring). Returns {classId, configId}.
	 */
	function ensureSidekickSpellcastingConfig (store, sidekickType) {
		const ability = d20plus.sidekickData.SPELLCASTING_ABILITY[sidekickType];
		const ints = store.integrants.integrants;

		// Reuse any existing Spellcasting config with the right ability
		const existing = Object.entries(ints).find(([, it]) => it && it.type === "Spellcasting" && it.ability === ability);
		if (existing) {
			const [configId, config] = existing;
			return { classId: config.parentID || "", configId };
		}

		const label = "Sidekick";
		let pos = d20plus.store2024.getNextArrayPos(store);
		const { id: classId, base: classBase } = d20plus.store2024.makeIntegrantBase("Class", pos++);
		const { id: configId, base: configBase } = d20plus.store2024.makeIntegrantBase("Spellcasting", pos++);
		ints[classId] = {
			...classBase,
			name: label,
			_label: label,
			parentID: "",
			childIDs: JSON.stringify([configId]),
			cascades: {},
			relations: {},
		};
		ints[configId] = {
			...configBase,
			name: "Spellcasting",
			ability,
			casterType: "other",
			overviewDisplay: true,
			parentID: classId,
			sourceID: classId,
			childIDs: "[]",
			cascades: {},
			relations: {},
		};
		return { classId, configId };
	}

	/**
	 * Apply spell picks to the store: remove replacement target, import picked
	 * spells from the bundled XPHB data, and wire them to the sidekick's
	 * Spellcasting config. Returns {added, removedName, failed: [names]}.
	 */
	function applySpellChoices (store, sidekickType, spellChoices) {
		const result = { added: 0, removedName: null, failed: [] };
		if (!spellChoices) return result;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};

		if (spellChoices.replace && removeSpellFromStore(store, spellChoices.replace.id)) {
			result.removedName = spellChoices.replace.name;
		}

		const picks = [...(spellChoices.cantrips || []), ...(spellChoices.spells || [])];
		if (!picks.length) return result;

		const { classId, configId } = ensureSidekickSpellcastingConfig(store, sidekickType);
		const preIds = new Set(Object.keys(store.integrants.integrants));

		for (const name of picks) {
			try {
				const spell = d20plus.sidekickData.getSpellByName(name);
				if (!spell) { result.failed.push(name); continue; }
				const [, gmnotes] = d20plus.spells._getHandoutData(spell);
				d20plus.importer.import2024Spell(null, JSON.parse(gmnotes), store);
				result.added++;
			} catch (e) {
				console.warn(`betterR20 sidekick: failed to import spell "${name}"`, e);
				result.failed.push(name);
			}
		}

		// Wire new Spell integrants to the class, and their Attack integrants to the config
		Object.entries(store.integrants.integrants).forEach(([id, it]) => {
			if (preIds.has(id) || !it) return;
			if (it.type === "Spell") {
				it.sourceID = classId;
			} else if (it.type === "Attack" && it.attack && (it.attack.type === "Spell Save" || it.attack.type === "Spell Attack")) {
				const config = store.integrants.integrants[configId];
				if (!config) return;
				it.relations = it.relations || {};
				it.relations[configId] = "uses";
				config.relations = config.relations || {};
				config.relations[id] = "usedBy";
			}
		});

		return result;
	}

	/** Display name for the sidekick's spellcasting source header, per type. */
	function sidekickSpellcastingSourceLabel (sidekickType) {
		const label = d20plus.sidekickData ? d20plus.sidekickData.typeLabel(sidekickType) : sidekickType;
		// typeLabel returns e.g. "Healer (Spellcaster)" — use the base word
		return `${String(label).replace(/\s*\(.*\)$/, "")} Sidekick`;
	}

	/**
	 * Rename the spellcasting source shown in the sheet's spells header (e.g.
	 * "Acolyte of Fierna") to "<Type> Sidekick". On NPC sheets the source is a
	 * plain name string held in parentID/sourceID of the Spellcasting config,
	 * Spell Slot and Spell integrants (confirmed from a live dump); when a real
	 * Class integrant exists (our created pair), its name is renamed instead.
	 * Returns count of renames performed.
	 */
	function renameSidekickSpellcastingSource (store, sidekickType) {
		const ability = d20plus.sidekickData && d20plus.sidekickData.SPELLCASTING_ABILITY
			? d20plus.sidekickData.SPELLCASTING_ABILITY[sidekickType] : null;
		if (!ability) return 0;
		const ints = (store.integrants && store.integrants.integrants) || {};
		const newName = sidekickSpellcastingSourceLabel(sidekickType);
		let renamed = 0;

		const configs = Object.values(ints).filter(it => it && it.type === "Spellcasting" && it.ability === ability);
		configs.forEach(cfg => {
			const oldRef = cfg.parentID;
			if (!oldRef || oldRef === newName) return;
			const target = ints[oldRef];
			if (target) {
				// Real Class integrant — rename its display name only
				if (target.name !== newName) {
					target.name = newName;
					if ("_label" in target) target._label = newName;
					renamed++;
				}
				return;
			}
			// Name-string convention — rewrite every reference to the old name
			Object.values(ints).forEach(it => {
				if (!it) return;
				if (it.parentID === oldRef) it.parentID = newName;
				if (it.sourceID === oldRef) it.sourceID = newName;
			});
			renamed++;
		});
		return renamed;
	}

	/**
	 * Write the sidekick's spell slots for the target level (TCE table).
	 * Slots persist as "Spell Slot" integrants (calculation "Modify",
	 * flatValue = slot count, parentID/sourceID = spellcasting source name —
	 * shape confirmed from a live sheet dump). One integrant per spell level is
	 * kept; extras are removed and levels with no slots are cleared. Current
	 * slots (store.spellSlots.currentByLevel) are refilled to the new maximums.
	 * Returns count of slot integrants changed.
	 */
	function writeSidekickSpellSlots (store, sidekickType, targetLevel) {
		const slots = d20plus.sidekickData && d20plus.sidekickData.spellcasterSlots
			? d20plus.sidekickData.spellcasterSlots[targetLevel] : null;
		if (!slots) return 0;
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		const ints = store.integrants.integrants;

		// Parent reference: reuse whatever the existing Spellcasting config points at
		const ability = d20plus.sidekickData.SPELLCASTING_ABILITY[sidekickType];
		const cfg = Object.values(ints).find(it => it && it.type === "Spellcasting" && it.ability === ability)
			|| Object.values(ints).find(it => it && it.type === "Spellcasting");
		const parentRef = cfg ? (cfg.parentID || "") : "";

		let changed = 0;
		for (let lvl = 1; lvl <= 5; lvl++) {
			const want = slots[lvl - 1] || 0;
			const existing = Object.entries(ints).filter(([, it]) => it && it.type === "Spell Slot" && it.spellLevel === lvl);
			if (!want) {
				existing.forEach(([id]) => { delete ints[id]; changed++; });
				continue;
			}
			if (existing.length) {
				const [, keep] = existing[0];
				if (!keep.valueFormula || keep.valueFormula.flatValue !== want) {
					keep.valueFormula = { flatValue: want };
					changed++;
				}
				existing.slice(1).forEach(([id]) => { delete ints[id]; changed++; });
			} else {
				const uuid = d20plus.store2024.makeUuid();
				ints[uuid] = {
					_enabled: true,
					_id: uuid,
					_slotType: "other",
					builderDisplayName: "",
					calculation: "Modify",
					childIDs: "[]",
					createdTime: Date.now(),
					label: "",
					name: "",
					parentID: parentRef,
					shortID: d20plus.store2024.makeId(),
					source: "Custom",
					sourceID: parentRef,
					spellLevel: lvl,
					type: "Spell Slot",
					valueFormula: { flatValue: want },
				};
				changed++;
			}
		}

		// Refill current slots to the new maximums (word-keyed, from live dump)
		if (!store.spellSlots) store.spellSlots = { currentByLevel: {}, currentPactByLevel: {}, useSpellSlotOnCast: true };
		if (!store.spellSlots.currentByLevel) store.spellSlots.currentByLevel = {};
		["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"].forEach((key, ix) => {
			store.spellSlots.currentByLevel[key] = slots[ix] || 0;
		});

		return changed;
	}

	/** Write a resolved "Spellcasting Advancement" trait recording the choices made. */	function writeSpellcastingAdvancementFeature (store, sidekickType, spellChoices, targetLevel, spellResult) {
		if (!store.integrants) store.integrants = { integrants: {} };
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.features) store.features = {};
		const displayOrder = JSON.parse(store.features.speciesTraitsDisplayOrder || "[]");
		const pos = d20plus.store2024.getNextArrayPos(store);
		const { id, base } = d20plus.store2024.makeIntegrantBase("Features", pos);

		const slots = d20plus.sidekickData.spellcasterSlots[targetLevel] || [];
		const slotDesc = slots.map((n, i) => n > 0 ? `${n}\u00d7${["1st", "2nd", "3rd", "4th", "5th"][i]}` : null).filter(Boolean).join(", ");
		const lines = [];
		if (spellChoices.cantrips && spellChoices.cantrips.length) lines.push(`Cantrips chosen: ${spellChoices.cantrips.join(", ")}`);
		if (spellChoices.spells && spellChoices.spells.length) lines.push(`Spells chosen: ${spellChoices.spells.join(", ")}`);
		if (spellResult && spellResult.removedName) lines.push(`Replaced: ${spellResult.removedName}`);
		if (spellResult && spellResult.failed.length) lines.push(`FAILED to import (add manually): ${spellResult.failed.join(", ")}`);
		if (slotDesc) lines.push(`Spell slots at level ${targetLevel}: ${slotDesc} (set automatically)`);

		store.integrants.integrants[id] = {
			...base,
			name: "Spellcasting Advancement",
			description: `${lines.join("\n")}\n\n(Added by betterR20 sidekick level-up, TCE p.144)`,
			source: "Species",
			cascades: {},
			relations: {},
		};
		displayOrder.push(id);
		store.features.speciesTraitsDisplayOrder = JSON.stringify(displayOrder);
		return 1;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Character creation flow
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Create an upgraded copy of a 2024 NPC character.
	 * Reads the source store, transforms it, creates a new character with the
	 * same metadata, writes the upgraded store, and places it in the same folder.
	 *
	 * @param {object} character - Roll20 character model
	 * @param {object} options   - Passed through to upgrade2024NpcStore
	 * @returns {Promise<object>} - The newly created character model
	 */
	async function levelUpCharacter (character, options = {}) {
		if (!d20plus.store2024.isNpc2024Sheet(character)) {
			throw new Error("The selected character is not a 2024 NPC sheet.");
		}

		const {attr: sourceAttr, store: sourceStore} = d20plus.store2024.getStore(character);
		if (!sourceStore) throw new Error("Could not read the 2024 store from this character.");

		// Transform the store
		const {store: upgradedStore, summary} = upgrade2024NpcStore(sourceStore, options);
		log(`[level-up] CR from level mapping: level ${summary.newLevel} -> CR ${summary.newCr}`);

		logGroup(`Upgrade summary for "${character.get("name")}"`, () => {
			log(`Level: ${summary.sourceLevel} → ${summary.newLevel}`);
			log(`PB: +${summary.sourcePb} → +${summary.newPb}${summary.pbChanged ? " (changed)" : ""}`);
			log(`HP: +${summary.hpAdded} (new max ${summary.newHpMax}), roll formula: ${summary.newRollHP}`);
			log(`Hit dice added: ${summary.hitDiceAdded}, proficiencies present: ${summary.proficienciesUpdated}`);
			log(`Bonus proficiencies added: ${summary.bonusProficienciesAdded || 0}, Potent Cantrips applied: ${summary.potentCantripsApplied || 0}`);
			if (summary.errors.length) logWarn("Warnings:", summary.errors.join("; "));
		});

		if (summary.errors.length) {
			logWarn("Upgrade completed with warnings:", summary.errors);
		}

		const sourceName = character.get("name") || "Unnamed character";
		const sourceAttributes = {...character.attributes};
		delete sourceAttributes.id;
		const upgradedName = getLevelUpName(sourceName);
		const upgradedSidekickType = options.sidekickType || upgradedStore.npc?._npcSidekickType;
		const upgradedTags = buildSidekickTags(sourceAttributes.tags || "", upgradedSidekickType, summary.newLevel);

		return new Promise((resolve, reject) => {
			d20.Campaign.characters.create({
				...sourceAttributes,
				name: upgradedName,
				charactersheetname: d20plus.cfg.getOrDefault("import", "importSheetFormat"),
				inplayerjournals: sourceAttributes.inplayerjournals || "",
				controlledby: sourceAttributes.controlledby || "",
				tags: upgradedTags,
				tags_string: upgradedTags,
			}, {
				success: async (newCharacter) => {
					try {
						// Carry over token image if the importer helper is available
						if (d20plus.importer && d20plus.importer._setDefaultTokenImage) {
							const attrMap = {};
							(character.attribs?.toJSON?.() || []).forEach(a => { attrMap[a.name] = a.current; });
							await d20plus.importer._setDefaultTokenImage(
								newCharacter,
								{id: newCharacter.id, name: upgradedName, senses: attrMap.npc_senses || ""},
								sourceAttributes.avatar || "",
							);
						}

						// Copy bio / gmnotes blobs
						await d20plus.store2024.copyBioAndNotes(character, newCharacter);

						// Place in the same folder as source
						const folderContext = d20plus.store2024.getCharacterFolderContext(character);
						if (folderContext?.folderId) {
							d20.journal.addItemToFolderStructure(newCharacter.id, folderContext.folderId);
						}

						// Wait for the sheet to finish its own async initialisation (which may push a
						// blank store attr). We then overwrite it with multiple attempts.
						await new Promise(r => setTimeout(r, 500));

						// Write the store and keep re-writing for up to 5 seconds to beat
						// any late blank-store writes by Roll20's sheet initialisation.
						// Also writes b20_sidekick — a dedicated attr Roll20 never blanks —
						// so sidekick routing works even if the store gets overwritten.
						const writeAndVerify = async () => {
							d20plus.store2024.saveNewNpcState(newCharacter, upgradedStore);
							d20plus.store2024.saveNpcNames(newCharacter, upgradedName);
							
							// Write flat character attributes for PB and CR so sheet display updates
							d20plus.store2024.writeSidekickStats(newCharacter, summary.newPb, summary.newCr);
							
							// Poll every 200ms for 5s. If Roll20 blanks our store, rewrite immediately.
							// NOTE: the sheet re-serializes store.npc and strips custom keys
							// (_npcSidekickType etc.), so only check fields that survive —
							// otherwise the guard would fight the sheet's own init forever.
							const deadline = Date.now() + 5000;
							while (Date.now() < deadline) {
								await new Promise(r => setTimeout(r, 200));
								const storeAttr = newCharacter.attribs.find(a => a.get("name") === "store");
								if (!storeAttr) {
									log(`[guard] store attr missing — rewriting (t=${Date.now()})`);
									d20plus.store2024.saveNewNpcState(newCharacter, upgradedStore);
									continue;
								}
								const val = storeAttr.get("current");
								let parsed = null;
								try { parsed = typeof val === "string" ? JSON.parse(val) : val; } catch (e) {}
								const storeBlanked = !parsed || !parsed.npc || !parsed.integrants;
								const crRegressed = !storeBlanked && String(parsed.npc.challengeRating) !== String(summary.newCr);
								if (storeBlanked || crRegressed) {
									log(`[guard] Store ${storeBlanked ? "blanked" : "CR regressed"} — rewriting (t=${Date.now()})`);
									d20plus.store2024.saveNewNpcState(newCharacter, upgradedStore);
								} else {
									// Store looks good — ensure b20_sidekick is also present.
									// (The store's _npcSidekickType gets stripped by the sheet, so
									// this attr is the persistent source of truth for routing.)
									const meta = d20plus.store2024.getSidekickMeta(newCharacter);
									if (!meta || !meta.type) {
										log(`[guard] b20_sidekick missing — rewriting meta attr (t=${Date.now()})`);
										d20plus.store2024.saveSidekickMeta(newCharacter, upgradedStore.npc._npcSidekickType, upgradedStore.npc._npcLevelUpLevel);
									}
								}
							}
							log(`[guard] Store guard complete for "${upgradedName}"`);
						};
						writeAndVerify(); // fire and forget — don't await, just let it guard in background

						log(`Created "${upgradedName}" (id: ${newCharacter.id})`);
						resolve({character: newCharacter, summary});
					} catch (e) {
						reject(e);
					}
				},
				error: reject,
			});
		});
	}

	/**
	 * Level up an existing sidekick character in-place (no copy created).
	 * Updates the store, HP, features, and name suffix directly on the character.
	 */
	async function levelUpCharacterInPlace (character, options = {}) {
		if (!d20plus.store2024.isNpc2024Sheet(character)) {
			throw new Error("The selected character is not a 2024 NPC sheet.");
		}

		const {attr: sourceAttr, store: sourceStore} = d20plus.store2024.getStore(character);
		if (!sourceStore) throw new Error("Could not read the 2024 store from this character.");

		const {store: upgradedStore, summary} = upgrade2024NpcStore(sourceStore, options);

		logGroup(`Upgrade summary (in-place) for "${character.get("name")}"`, () => {
			log(`Level: ${summary.sourceLevel} → ${summary.newLevel}`);
			log(`PB: +${summary.sourcePb} → +${summary.newPb}${summary.pbChanged ? " (changed)" : ""}`);
			log(`HP: +${summary.hpAdded} (new max ${summary.newHpMax}), roll formula: ${summary.newRollHP}`);
			log(`Bonus proficiencies added: ${summary.bonusProficienciesAdded || 0}, Potent Cantrips applied: ${summary.potentCantripsApplied || 0}`);
			if (summary.errors.length) logWarn("Warnings:", summary.errors.join("; "));
		});

		const newName = getLevelUpName(character.get("name") || "Unnamed character");
		const sidekickType = options.sidekickType || upgradedStore.npc?._npcSidekickType;
		const newTags = buildSidekickTags(character.get("tags") || character.attributes?.tags || "", sidekickType, summary.newLevel);
		character.save({name: newName, tags: newTags, tags_string: newTags});
		d20plus.store2024.saveNewNpcState(character, upgradedStore);
		d20plus.store2024.saveNpcNames(character, newName);

		// Write flat character attributes for PB and CR so sheet display updates
		d20plus.store2024.writeSidekickStats(character, summary.newPb, summary.newCr);

		// Post-init reapply guard: the sheet's Vue iframe init can re-save a stale
		// store on top of ours. Poll for a few seconds and rewrite if CR/PB regress.
		// Only checks fields that survive the sheet's re-serialization (it strips
		// custom store.npc keys like _npcLevelUpLevel).
		(async () => {
			const deadline = Date.now() + 5000;
			while (Date.now() < deadline) {
				await new Promise(r => setTimeout(r, 500));
				const {store: liveStore} = d20plus.store2024.getStore(character);
				if (!liveStore || !liveStore.npc) continue;
				const crOk = String(liveStore.npc.challengeRating) === String(summary.newCr);
				const pbOk = Object.values((liveStore.integrants && liveStore.integrants.integrants) || {})
					.some(i => i && i.type === "Proficiency Bonus Modifier" && i.valueFormula?.flatValue === summary.newPb);
				if (!crOk || !pbOk) {
					log(`[guard] In-place store regressed (crOk=${crOk}, pbOk=${pbOk}) — rewriting`);
					d20plus.store2024.saveNewNpcState(character, upgradedStore);
					d20plus.store2024.writeSidekickStats(character, summary.newPb, summary.newCr);
				}
			}
			// Final instrumentation: dump renderer-bound PB/CR fields after settle
			const {store: finalStore} = d20plus.store2024.getStore(character);
			const pbInts = Object.values((finalStore?.integrants?.integrants) || {})
				.filter(i => i && (i.type === "Proficiency Bonus Modifier" || i.type === "Proficiency Bonus"))
				.map(i => `${i.type}=${i.valueFormula?.flatValue}`);
			log(`[guard] In-place store guard complete for "${newName}" — final: challengeRating=${finalStore?.npc?.challengeRating}, PB integrants=[${pbInts.join(", ")}]`);
		})();

		log(`[level-up] Updated tags: ${newTags}`);
		return {character, summary};
	}

	// ─────────────────────────────────────────────────────────────────────────
	// UI entry points
	// ─────────────────────────────────────────────────────────────────────────

	function getCharacterFromJournalContext (event) {
		const $target = event ? $(event.target) : $();
		const $characterRoot = $target.closest(`[data-characterid]`);
		const $fallbackRoot = $characterRoot.length ? $characterRoot : (event ? $(event.currentTarget).closest(`[data-characterid]`) : $());
		const cId = $fallbackRoot.attr("data-characterid");
		if (!cId && d20plus.journal?.lastClickedJournalItemId) return d20.Campaign.characters.get(d20plus.journal.lastClickedJournalItemId);
		if (!cId) return null;
		return d20.Campaign.characters.get(cId);
	}

	function canLevelUp (character) {
		return !!character && d20plus.store2024.isNpc2024Sheet(character);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Level basis helpers
	// ─────────────────────────────────────────────────────────────────────────

	/** Derive sidekick level from hit-die count (1:1). Clamped 1–13. */
	function hitDiceToSidekickLevel (store) {
		const formula = store.npc && store.npc.rollHP ? store.npc.rollHP : null;
		const parsed = parseHpFormula(formula);
		if (!parsed || parsed.count < 1) return null;
		return Math.max(1, Math.min(parsed.count, 20));
	}

	/** Derive sidekick level from stored _npcLevelUpLevel if present. */
	function storedLevel (store) {
		return (store.npc && store.npc._npcLevelUpLevel) || null;
	}

	async function waitForStoreAttr(character, timeout = 5000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			// First check the dedicated b20_sidekick attr — it is never blanked by Roll20 sheet init
			const meta = d20plus.store2024.getSidekickMeta(character);
			if (meta && (meta.type || meta.level)) {
				const {attr, store} = d20plus.store2024.getStore(character);
				return { attr, store, sidekickMeta: meta };
			}
			// Fall back to checking the store attr directly
			const storeAttr = character.attribs.find(a => a.get("name") === "store");
			if (storeAttr && storeAttr.get("current")) {
				const val = storeAttr.get("current");
				try {
					const parsed = typeof val === "string" ? JSON.parse(val) : val;
					if (parsed.npc && (parsed.npc._npcSidekickType || parsed.npc._npcLevelUpLevel)) {
						return { attr: storeAttr, store: parsed, sidekickMeta: null };
					}
				} catch (e) {}
			}
			await new Promise(r => setTimeout(r, 100));
		}
		const {attr, store} = d20plus.store2024.getStore(character);
		if (!store) logWarn(`waitForStoreAttr: timeout waiting for sidekick store on ${character.get("name")}`);
		return { attr, store, sidekickMeta: d20plus.store2024.getSidekickMeta(character) };
	}

	function formatSignedConText (conMod) {
		return `${conMod >= 0 ? "+" : ""}${conMod} (CON)`;
	}

	/**
	 * Build a preview of what a level-up would produce for a given currentLevel.
	 * Returns the same summary shape as upgrade2024NpcStore.
	 */
	function previewUpgrade (store, currentLevel, sidekickType, options = {}) {
		const overridden = JSON.parse(JSON.stringify(store));
		if (!overridden.npc) overridden.npc = {};
		overridden.npc._npcLevelUpLevel = currentLevel;
		const {summary} = upgrade2024NpcStore(overridden, {levels: 1, currentLevel, sidekickType, ...options});
		return summary;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Shared modal helpers
	// ─────────────────────────────────────────────────────────────────────────

	function makeLevelBasisOptions (store) {
		const crStr = store.npc && store.npc.challengeRating ? String(store.npc.challengeRating) : null;
		const levelFromStored = storedLevel(store);
		const levelFromHD = hitDiceToSidekickLevel(store);
		const levelFromCR = crStr ? crToSidekickLevel(crStr) : null;
		const options = [];
		if (levelFromStored != null) options.push({id: "stored", label: `Previously stored level (${levelFromStored})`, level: levelFromStored});
		if (levelFromHD != null) options.push({id: "hd", label: `Hit dice count (${levelFromHD} HD → level ${levelFromHD})`, level: levelFromHD});
		if (levelFromCR != null) options.push({id: "cr", label: `CR mapping (CR ${crStr} → level ${levelFromCR})`, level: levelFromCR});
		options.push({id: "custom", label: "Custom level…", level: null});
		return options;
	}

	function makeLevelBasisHtml (options) {
		return options.map((opt, i) => `
			<label style="display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer">
				<input type="radio" name="levelBasis" value="${opt.id}" ${i === 0 ? "checked" : ""}>
				${opt.label}
			</label>
		`).join("");
	}

	function getSelectedLevel ($dialog, options) {
		const chosen = $dialog.find("input[name=levelBasis]:checked").val();
		if (chosen === "custom") {
			const v = parseInt($dialog.find(".b20-custom-level-input").val(), 10);
			return (v >= 1 && v <= 20) ? v : 1;
		}
		const opt = options.find(o => o.id === chosen);
		return opt ? opt.level : 1;
	}

		function makeSplitPreviewHtml (rowsHtml, featuresTitle, featureItemsHtml, warningsHtml) {
		return `
			<div class="b20-preview-split">
				<div class="b20-preview-pane b20-preview-pane-stats">
					<div class="b20-preview-pane-title">Summary</div>
					<table class="b20-preview-table">${rowsHtml}</table>
					${warningsHtml || ""}
				</div>
				<div class="b20-preview-pane b20-preview-pane-features">
					<div class="b20-preview-pane-title">${featuresTitle}</div>
					<div class="b20-preview-features-scroll">${featureItemsHtml}</div>
				</div>
			</div>
		`;
	}
function makeStartingStateHtml (store, sidekickType, targetLevel) {
		const pb = SIDEKICK_LEVEL_TO_PB[targetLevel] || 2;
		const rollHPStr = store.npc && store.npc.rollHP ? store.npc.rollHP : null;
		const parsedHP = parseHpFormula(rollHPStr);
		const conMod = getConModFromStore(store);

		// Read current HP using the same logic as upgrade2024NpcStore
		const hpIntegrant = findIntegrantByType(store, "Hit Points");
		const currentHpMax = hpIntegrant && hpIntegrant.valueFormula
			? (hpIntegrant.valueFormula.flatValue || 0)
			: (store.hitpoints && store.hitpoints.currentHP) || null;

		let hpLine, rollLine, hdLine;

		if (parsedHP) {
			const avgPerDie = avgHpPerDie(parsedHP.faces);
			const totalHpGain = 0;
			const newDice = parsedHP.count;
			rollLine = formatHpFormula({count: newDice, faces: parsedHP.faces, mod: conMod * newDice});
			hdLine = `${newDice}d${parsedHP.faces}`;
			if (currentHpMax != null) {
				const newHpMax = currentHpMax + totalHpGain;
				hpLine = totalHpGain > 0 ? `${currentHpMax} + ${totalHpGain} = ${newHpMax}` : String(currentHpMax);
			} else {
				hpLine = totalHpGain > 0 ? `current + ${totalHpGain}` : "unchanged";
			}
		} else {
			hpLine = currentHpMax != null ? String(currentHpMax) : "unknown";
			rollLine = rollHPStr || "unknown";
			hdLine = parsedHP ? String(parsedHP.count) : "unknown";
		}

		const rows = [
			["Starting level", String(targetLevel)],
			["Proficiency Bonus", `+${pb}`],
			["HP Max", hpLine],
			["Roll Formula", rollLine],
			["Hit Dice", hdLine],
		];
		const rowsHtml = rows.map(([label, val]) =>
			`<tr><td style="padding:2px 8px 2px 0;color:#888;white-space:nowrap">${label}</td><td style="padding:2px 0"><strong>${val}</strong></td></tr>`
		).join("");
		const features = d20plus.sidekickData.getFeaturesGained(sidekickType, 0, targetLevel);
		const featureItemsHtml = features.length
			? `<ul class="b20-preview-feature-list">${
				features.map(f => {
					const isTodo = f.isTodo && !isDialogAutomatedFeature(f);
					return `<li><span style="color:${isTodo ? "#c0392b" : "#27ae60"};font-weight:bold">${isTodo ? "TODO" : "AUTO"} ${f.name}</span> <span style="color:#888">(lv${f.level})</span><br><span style="font-size:0.9em">${f.description.slice(0, 120)}${f.description.length > 120 ? "…" : ""}</span></li>`;
				}).join("")
			}</ul>`
			: `<p style="color:#64748b;margin:0">No features for this type/level combination.</p>`;
		return makeSplitPreviewHtml(rowsHtml, `Features gained (levels 1–${targetLevel})`, featureItemsHtml, "");
	}


	function makeStatPreviewHtml (summary, sidekickType, fromLevel, toLevel) {
		if (!summary) return `<em>Unable to calculate preview.</em>`;
		const rows = [
			["Level", `${summary.sourceLevel} → ${summary.newLevel}`],
			["Proficiency Bonus", summary.pbChanged ? `+${summary.sourcePb} → +${summary.newPb}` : `+${summary.sourcePb} (unchanged)`],
			["HP Max", summary.newHpMax != null ? `+${summary.hpAdded} (new max: ${summary.newHpMax})` : "—"],
			["Roll Formula", summary.newRollHP || "—"],
			["Hit Dice Added", summary.hitDiceAdded || 0],
		];
		const rowsHtml = rows.map(([label, val]) =>
			`<tr><td style="padding:2px 8px 2px 0;color:#888;white-space:nowrap">${label}</td><td style="padding:2px 0"><strong>${val}</strong></td></tr>`
		).join("");
		const warnings = summary.errors && summary.errors.length
			? `<p style="color:#c0392b;margin:6px 0 0">⚠ ${summary.errors.join("; ")}</p>`
			: "";

		let featureItemsHtml = `<p style="color:#64748b;margin:0">No class features gained at this level.</p>`;
		if (sidekickType && d20plus.sidekickData) {
			const features = d20plus.sidekickData.getFeaturesGained(sidekickType, fromLevel, toLevel);
			if (features.length) {
				const featureItems = features.map(f => {
					const tag = (f.isTodo && !isDialogAutomatedFeature(f))
						? `<span style="color:#c0392b;font-size:0.85em;font-weight:bold">TODO</span>`
						: `<span style="color:#27ae60;font-size:0.85em;font-weight:bold">AUTO</span>`;
					return `<li>${tag} <strong>${f.name}</strong> <span style="color:#888;font-size:0.88em">(lv${f.level})</span><br><span style="color:#555;font-size:0.88em">${f.description.substring(0, 120)}${f.description.length > 120 ? "…" : ""}</span></li>`;
				}).join("");
				featureItemsHtml = `<ul class="b20-preview-feature-list">${featureItems}</ul>`;
			}
		}

		return makeSplitPreviewHtml(rowsHtml, "Features gained", featureItemsHtml, warnings);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// "Make Sidekick" modal
	// ─────────────────────────────────────────────────────────────────────────

		function getCharacterAvatarUrl (character) {
		const avatar = character && character.get ? character.get("avatar") : null;
		return avatar || "https://raw.githubusercontent.com/TheOctonaut/betterR20/refs/heads/Jumpgate-Importer/img/icon32.png";
	}

	function makeDialogChromeCss () {
		return `<style class="b20-sidekick-dialog-style">
			.b20-sidekick-shell{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937}
			.b20-sidekick-hero{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #d5d9e0;border-radius:10px;background:#f8fafc;margin-bottom:12px}
			.b20-sidekick-avatar{width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid #cbd5e1;background:#fff}
			.b20-sidekick-title{font-weight:700;font-size:14px;line-height:1.2}
			.b20-sidekick-sub{color:#64748b;font-size:12px;margin-top:2px}
			.b20-sidekick-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
			.b20-sidekick-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff}
			.b20-sidekick-card h4{margin:0 0 8px;font-size:12px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.02em}
			.b20-sidekick-preview{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff;min-height:100px}
			.b20-preview-split{display:grid;grid-template-columns:260px minmax(0,1fr);gap:10px;align-items:start}
			.b20-preview-pane{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:8px}
			.b20-preview-pane-title{font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.02em;margin:0 0 6px}
			.b20-preview-table{border-collapse:collapse;width:100%}
			.b20-preview-table td{padding:2px 6px 2px 0;vertical-align:top}
			.b20-preview-table td:first-child{color:#64748b;white-space:nowrap}
			.b20-preview-features-scroll{max-height:220px;overflow-y:auto;padding-right:2px}
			.b20-preview-feature-list{margin:0;padding-left:16px}
			.b20-preview-feature-list li{margin:4px 0}
			@media (max-width: 760px){.b20-preview-split{grid-template-columns:1fr}}
			.b20-sidekick-row label{display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer}
			.b20-sidekick-dialog .ui-dialog-buttonpane{padding:.5em .8em}
			.b20-sidekick-dialog .ui-dialog-buttonset button{border-radius:8px;padding:.45em .9em}
			.b20-sidekick-dialog .ui-dialog-buttonset button:first-child{background:#2563eb;color:#fff;border-color:#1d4ed8}
			.b20-sidekick-check-grid{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:12px}
			.b20-sidekick-check-group-save{grid-column:1}
			.b20-sidekick-check-group-skill{grid-column:2 / span 3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 14px}
			.b20-sidekick-check-group-skill .b20-sidekick-check-title{grid-column:1 / -1}
			.b20-sidekick-checkbox{display:flex;align-items:flex-start;gap:8px;margin:4px 0;cursor:pointer}
			.b20-sidekick-checkbox input{margin-top:2px}
			.b20-sidekick-checkbox-locked{color:#64748b}
			.b20-asi-instance{padding:8px 0}
			.b20-asi-mode-label{display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer;font-size:13px}
			.b20-asi-mode-label select{font-size:13px;padding:2px 4px}
			.b20-asi-mode-label input[type=radio]{margin:0}
			@media (max-width: 980px){.b20-sidekick-check-grid{grid-template-columns:1fr}.b20-sidekick-check-group-save,.b20-sidekick-check-group-skill{grid-column:auto}.b20-sidekick-check-group-skill{grid-template-columns:1fr}}
		</style>`;
	}
	function showMakeSidekickDialog (character, store) {
		return new Promise((resolve) => {
			const charName = character.get("name") || "Unnamed character";
			const levelOptions = makeLevelBasisOptions(store);

			const allTypes = (d20plus.sidekickData && d20plus.sidekickData.ALL_TYPES) || ["expert","warrior-attacker","warrior-defender","mage","healer","prodigy"];
			const typeButtons = allTypes.map((type, i) => {
				const label = d20plus.sidekickData ? d20plus.sidekickData.typeLabel(type) : type;
				return `<label style="display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer">
					<input type="radio" name="sidekickType" value="${type}" ${i === 0 ? "checked" : ""}>${label}
				</label>`;
			}).join("");

			const avatarUrl = getCharacterAvatarUrl(character);
			const $dialog = $(`
				<div class="dialog largedialog b20-npc-sidekick-dialog b20-sidekick-shell" style="padding:6px 8px">
					${makeDialogChromeCss()}
					<div class="b20-sidekick-hero">
						<img class="b20-sidekick-avatar" src="${avatarUrl}" alt="${charName}">
						<div>
							<div class="b20-sidekick-title">${charName}</div>
							<div class="b20-sidekick-sub">Create a sidekick copy with class features applied</div>
						</div>
					</div>
					<div class="b20-sidekick-grid">
						<div class="b20-sidekick-card b20-sidekick-row">
							<h4>Sidekick Type</h4>
							${typeButtons}
						</div>
						<div class="b20-sidekick-card b20-sidekick-row">
							<h4>Starting Level</h4>
							${makeLevelBasisHtml(levelOptions)}
							<div class="b20-custom-level-row" style="display:none;margin-top:6px">
								<label>Level (1–20): <input type="number" class="b20-custom-level-input" min="1" max="20" value="1" style="width:64px;margin-left:6px"></label>
							</div>
						</div>
					</div>
					<div class="b20-bonus-prof-container"></div>
					<div class="b20-expertise-container"></div>
					<div class="b20-sharpmind-container"></div>
					<div class="b20-empowered-container"></div>
					<div class="b20-asi-container"></div>
					<div class="b20-spell-container"></div>
					<div class="b20-sidekick-card">
						<h4>Preview</h4>
						<div class="b20-upgrade-preview b20-sidekick-preview"></div>
					</div>
				</div>
			`);

			function getType () { return $dialog.find("input[name=sidekickType]:checked").val() || "expert"; }
			function getLevel () { return storedLevel(store) || hitDiceToSidekickLevel(store) || 1; }
		function getHpMode () { return $dialog.find('input[name=hpMode]:checked').val() || "average"; }
		function getHpRollTotal () {
			const v = Number($dialog.find('.b20-hp-roll-input').val());
			return Number.isFinite(v) ? v : null;
		}

			function renderBonusSection () {
				const choiceState = makeBonusProfChoiceState(store, getType());
				if (!choiceState) {
					$dialog.find(".b20-bonus-prof-container").html("");
					return;
				}
				$dialog.find(".b20-bonus-prof-container").html(`
					<div class="b20-sidekick-card">
						<h4>Bonus Proficiencies</h4>
						<p style="margin:0 0 10px;color:#475569;font-size:12px">${getBonusProficiencyRequirementText(getType())}</p>
						<div class="b20-sidekick-check-grid">
							<div class="b20-sidekick-check-group-save">
								<p class="b20-sidekick-check-title" style="margin:0 0 6px;color:#475569;font-size:12px">Saving Throws (${choiceState.saves.maxChoices} required)</p>
								${renderBonusProfCheckboxes(choiceState.saves.items, "bonusProfSaves")}
							</div>
							<div class="b20-sidekick-check-group-skill">
								<p class="b20-sidekick-check-title" style="margin:0 0 6px;color:#475569;font-size:12px">Skills (${choiceState.skills.maxChoices} required)</p>
								${renderBonusProfCheckboxes(choiceState.skills.items, "bonusProfSkills")}
							</div>
						</div>
					</div>
				`);
				enforceCheckboxLimit($dialog, "bonusProfSaves", choiceState.saves.maxChoices);
				enforceCheckboxLimit($dialog, "bonusProfSkills", choiceState.skills.maxChoices);
			}

			function refresh () {
				const type = getType();
				const level = getLevel();
				renderBonusSection();
				renderExpertiseSection($dialog.find(".b20-expertise-container"), store, type, 0, level, readSelectedValues($dialog, "bonusProfSkills"));
				renderSharpMindSection($dialog.find(".b20-sharpmind-container"), store, type, 0, level);
				renderEmpoweredSpellsSection($dialog.find(".b20-empowered-container"), store, type, 0, level);
				renderAsiSection($dialog.find(".b20-asi-container"), store, type, 0, level);
				renderSpellPickerSection($dialog.find(".b20-spell-container"), store, type, 0, level);
				$dialog.find(".b20-upgrade-preview").html(makeStartingStateHtml(store, type, level));
			}

			$dialog.on("change", "input[name=sidekickType], input[name=levelBasis]", function () {
				const chosen = $dialog.find("input[name=levelBasis]:checked").val();
				$dialog.find(".b20-custom-level-row").css("display", chosen === "custom" ? "block" : "none");
				refresh();
			});
			$dialog.on("input", ".b20-custom-level-input", refresh);
			$dialog.on("change", "input[name=bonusProfSaves]", () => {
				const cfg = getSidekickBonusProficiencyConfig(getType());
				if (cfg) enforceCheckboxLimit($dialog, "bonusProfSaves", cfg.saves.maxChoices);
			});
			$dialog.on("change", "input[name=bonusProfSkills]", () => {
				const cfg = getSidekickBonusProficiencyConfig(getType());
				if (cfg) enforceCheckboxLimit($dialog, "bonusProfSkills", cfg.skills.maxChoices);
				// Bonus-prof skills are Expertise candidates — refresh its options
				renderExpertiseSection($dialog.find(".b20-expertise-container"), store, getType(), 0, getLevel(), readSelectedValues($dialog, "bonusProfSkills"));
			});
			const $mapViewport = $("#playerzone").length ? $("#playerzone") : ($("#editor-wrapper").length ? $("#editor-wrapper") : $(window));

			$dialog.dialog({
				resizable: true, autoOpen: true, width: 1000, dialogClass: "b20-sidekick-dialog",
				position: {my: "center top+30", at: "center top", of: $mapViewport},
				maxHeight: Math.floor(window.innerHeight * 0.92),
				title: "Make Sidekick — Create Copy",
				open: () => {
					refresh();
					$dialog.dialog("widget").css("max-height", `${Math.floor(window.innerHeight * 0.92)}px`);
				},
				close: () => { $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
				buttons: {
					"Create Sidekick Copy": () => {
						const currentLevel = getLevel();
						const sidekickType = getType();
						const profValidation = validateBonusProfChoices($dialog, sidekickType);
						if (!profValidation.ok) return alert(profValidation.message);
						const expertiseValidation = validateExpertiseChoices($dialog, sidekickType, 0, currentLevel);
						if (!expertiseValidation.ok) return alert(expertiseValidation.message);
						const sharpMindValidation = validateSharpMindChoice($dialog, sidekickType, 0, currentLevel);
						if (!sharpMindValidation.ok) return alert(sharpMindValidation.message);
						const empoweredValidation = validateEmpoweredSpellsChoice($dialog, sidekickType, 0, currentLevel);
						if (!empoweredValidation.ok) return alert(empoweredValidation.message);
						const asiValidation = validateAsiChoices($dialog, sidekickType, 0, currentLevel);
						if (!asiValidation.ok) return alert(asiValidation.message);
						const spellValidation = validateSpellChoices($dialog, store, sidekickType, 0, currentLevel);
						if (!spellValidation.ok) return alert(spellValidation.message);
						$dialog.off(); $dialog.dialog("destroy").remove();
						resolve({confirmed: true, currentLevel, sidekickType, bonusProficiencies: profValidation.selections, expertiseChoices: expertiseValidation.expertiseChoices, sharpMindChoice: sharpMindValidation.sharpMindChoice, empoweredSchool: empoweredValidation.empoweredSchool, asiChoices: asiValidation.asiChoices, asiInstances: asiValidation.asiInstances, spellChoices: spellValidation.spellChoices});
					},
					Cancel: () => { $dialog.off(); $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
				},
			});
		});
	}

	// ─────────────────────────────────────────────────────────────────────────
	// "Level Up Sidekick" modal
	// ─────────────────────────────────────────────────────────────────────────

	function showLevelUpDialog (character, store, knownSidekickType) {
		return new Promise((resolve) => {
			const charName = character.get("name") || "Unnamed character";
			const sidekickType = knownSidekickType || (store.npc && store.npc._npcSidekickType) || null;
			const currentStoredLevel = storedLevel(store) || hitDiceToSidekickLevel(store) || 1;
			const parsedHP = parseHpFormula(store.npc && store.npc.rollHP ? store.npc.rollHP : null);
			const dieFaces = parsedHP ? parsedHP.faces : 8;
			const avgHp = parsedHP ? avgHpPerDie(parsedHP.faces) : 5;
			const conMod = getConModFromStore(store);

			const allTypes = (d20plus.sidekickData && d20plus.sidekickData.ALL_TYPES) || ["expert","warrior-attacker","warrior-defender","mage","healer","prodigy"];
			const typeNote = !sidekickType
				? `<div style="margin-bottom:10px">
					<p style="margin:0 0 4px;font-weight:bold;font-size:0.92em">Sidekick Type <span style="color:#c0392b">(not yet set — choose once)</span></p>
					${allTypes.map((type, i) => {
						const label = d20plus.sidekickData ? d20plus.sidekickData.typeLabel(type) : type;
						return `<label style="display:flex;align-items:center;gap:6px;margin:3px 0;cursor:pointer">
							<input type="radio" name="sidekickType" value="${type}" ${i === 0 ? "checked" : ""}>${label}
						</label>`;
					}).join("")}
				</div>`
				: `<p style="margin:0 0 10px;color:#555">Sidekick type: <strong>${d20plus.sidekickData ? d20plus.sidekickData.typeLabel(sidekickType) : sidekickType}</strong></p>`;

			const avatarUrl = getCharacterAvatarUrl(character);
			const $dialog = $(`
				<div class="dialog largedialog b20-npc-level-up-dialog b20-sidekick-dialog b20-sidekick-shell" style="padding:6px 8px">
					${makeDialogChromeCss()}
					<div class="b20-sidekick-hero">
						<img class="b20-sidekick-avatar" src="${avatarUrl}" alt="${charName}">
						<div>
							<div class="b20-sidekick-title">${charName}</div>
							<div class="b20-sidekick-sub">Level up this sidekick</div>
						</div>
					</div>
					<div class="b20-sidekick-grid" style="grid-template-columns:1fr 1fr">
						<div class="b20-sidekick-card b20-sidekick-row">
							${typeNote}
							<h4 style="margin-top:0">Current Level</h4>
							<p style="margin:0;color:#475569">This sidekick is currently level <strong>${currentStoredLevel}</strong>. Confirming will level it up to <strong>${currentStoredLevel + 1}</strong> in-place.</p>
						</div>
						<div class="b20-sidekick-card b20-sidekick-row">
							<h4 style="margin-top:0">Hit Point Increase</h4>
							<p style="margin:0 0 8px;color:#64748b;font-size:12px">Gain one Hit Die and increase maximum HP by the die result plus Constitution modifier (minimum 1).</p>
							<label style="display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer"><input type="radio" name="hpMode" value="average" checked>Average (${avgHp}${formatSignedConText(conMod)})</label>
							<label style="display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer"><input type="radio" name="hpMode" value="roll">Roll 1d${dieFaces}${formatSignedConText(conMod)}</label>
							<div class="b20-hp-roll-row" style="display:none;margin-top:6px">
								<label>Roll result: <input type="number" class="b20-hp-roll-input" min="1" max="99" value="${avgHp}" style="width:64px;margin-left:6px"></label>
								<button type="button" class="btn b20-hp-roll-chat" style="margin-left:8px">Roll in chat</button>
								<span style="margin-left:8px;color:#64748b;font-size:12px">Uses Roll20 chat; copy the die result here.</span>
							</div>
						</div>
					</div>
					<div class="b20-expertise-container"></div>
					<div class="b20-sharpmind-container"></div>
					<div class="b20-empowered-container"></div>
					<div class="b20-asi-container"></div>
					<div class="b20-spell-container"></div>
					<div class="b20-sidekick-card">
						<h4>Preview</h4>
						<div class="b20-upgrade-preview b20-sidekick-preview" style="min-height:140px"></div>
					</div>
						<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0">
							<button type="button" class="btn b20-levelup-cancel">Cancel</button>
							<button type="button" class="btn btn-primary b20-levelup-confirm">Level Up</button>
						</div>
				</div>
			`);

			function getType () {
				if (sidekickType) return sidekickType;
				return $dialog.find("input[name=sidekickType]:checked").val() || "expert";
			}
			function getLevel () { return currentStoredLevel; }
			function getHpMode () { return $dialog.find('input[name=hpMode]:checked').val() || "average"; }
			function getHpRollTotal () {
				const v = Number($dialog.find('.b20-hp-roll-input').val());
				return Number.isFinite(v) ? v : null;
			}

			function refresh () {
				const type = getType();
				const level = getLevel();
				const hpMode = getHpMode();
				const hpRollTotal = getHpRollTotal();
				$dialog.find('.b20-hp-roll-row').css('display', hpMode === 'roll' ? 'block' : 'none');
				renderExpertiseSection($dialog.find(".b20-expertise-container"), store, type, level, level + 1, []);
				renderSharpMindSection($dialog.find(".b20-sharpmind-container"), store, type, level, level + 1);
				renderEmpoweredSpellsSection($dialog.find(".b20-empowered-container"), store, type, level, level + 1);
				renderAsiSection($dialog.find(".b20-asi-container"), store, type, level, level + 1);
				renderSpellPickerSection($dialog.find(".b20-spell-container"), store, type, level, level + 1);
				const summary = previewUpgrade(store, level, type, { hpIncreaseMode: hpMode, hpRollTotal });
				$dialog.find(".b20-upgrade-preview").html(makeStatPreviewHtml(summary, type, level, level + 1));
			}

			$dialog.on("change", "input[name=sidekickType], input[name=hpMode]", refresh);
			$dialog.on("input", ".b20-hp-roll-input", refresh);
			$dialog.on("click", ".b20-hp-roll-chat", () => { d20.textchat.doChatInput(`/r 1d${dieFaces}`); });
			$dialog.on("click", ".b20-levelup-cancel", () => { $dialog.off(); $dialog.dialog("destroy").remove(); resolve({confirmed: false}); });
			$dialog.on("click", ".b20-levelup-confirm", () => {
				const currentLevel = getLevel();
				const resolvedType = getType();
				const expertiseValidation = validateExpertiseChoices($dialog, resolvedType, currentLevel, currentLevel + 1);
				if (!expertiseValidation.ok) return alert(expertiseValidation.message);
				const sharpMindValidation = validateSharpMindChoice($dialog, resolvedType, currentLevel, currentLevel + 1);
				if (!sharpMindValidation.ok) return alert(sharpMindValidation.message);
				const empoweredValidation = validateEmpoweredSpellsChoice($dialog, resolvedType, currentLevel, currentLevel + 1);
				if (!empoweredValidation.ok) return alert(empoweredValidation.message);
				const asiValidation = validateAsiChoices($dialog, resolvedType, currentLevel, currentLevel + 1);
				if (!asiValidation.ok) return alert(asiValidation.message);
				const spellValidation = validateSpellChoices($dialog, store, resolvedType, currentLevel, currentLevel + 1);
				if (!spellValidation.ok) return alert(spellValidation.message);
				$dialog.off(); $dialog.dialog("destroy").remove();
				resolve({confirmed: true, currentLevel, sidekickType: resolvedType, bonusProficiencies: { saves: [], skills: [] }, expertiseChoices: expertiseValidation.expertiseChoices, sharpMindChoice: sharpMindValidation.sharpMindChoice, empoweredSchool: empoweredValidation.empoweredSchool, asiChoices: asiValidation.asiChoices, asiInstances: asiValidation.asiInstances, spellChoices: spellValidation.spellChoices, hpIncreaseMode: getHpMode(), hpRollTotal: getHpRollTotal()});
			});
			const $mapViewport = $("#playerzone").length ? $("#playerzone") : ($("#editor-wrapper").length ? $("#editor-wrapper") : $(window));

			$dialog.dialog({
				resizable: true, autoOpen: true, width: 1000, height: "auto", dialogClass: "b20-sidekick-dialog",
				position: {my: "center top+30", at: "center top", of: $mapViewport},
				title: "Level Up Sidekick",
				open: () => { refresh(); },
				close: () => { $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
			});
		});
	}

	/** Journal context-menu handler — detects Make Sidekick vs Level Up flow. */
	d20plus.npcLevelUp.levelUpFromJournalContext = async function (event) {
		const character = getCharacterFromJournalContext(event);
		log(`Handler invoked — resolved character: "${character?.get?.("name") || "(none)"}" (id: ${character?.id || d20plus.journal?.lastClickedJournalItemId || "?"})`);
		if (!character) return alert("No character found.");
		log(`[fetch] Starting attribs fetch for "${character.get("name")}"`);
		await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
		log(`[fetch] Attributes loaded: ${character.attribs?.length || 0}; checking b20_sidekick + store...`);
		const storeWaitResult = await waitForStoreAttr(character);
		const sidekickMeta = storeWaitResult.sidekickMeta || d20plus.store2024.getSidekickMeta(character);
		if (storeWaitResult.store) {
			log(`[fetch] Store after wait: type=${storeWaitResult.store.npc?._npcSidekickType}, level=${storeWaitResult.store.npc?._npcLevelUpLevel}`);
		}
		log(`[fetch] b20_sidekick attr: ${sidekickMeta ? JSON.stringify(sidekickMeta) : "(none)"}`);
		if (!canLevelUp(character)) return alert("The selected character is not a 2024 NPC sheet.");

		const charName = character.get("name") || "Unnamed character";
		const {attr, store} = d20plus.store2024.getStore(character);
		if (!store) return alert("Could not read the 2024 store from this character.");

		// Primary: check dedicated b20_sidekick attr (survives Roll20 sheet re-init)
		// Fallback: check store fields (for sidekicks created before this version)
		const hasSidekickType = !!(
			(sidekickMeta && (sidekickMeta.type || sidekickMeta.level)) ||
			(store.npc && (store.npc._npcSidekickType || store.npc._npcLevelUpLevel))
		);
		// If b20_sidekick has type/level but the store was blanked, restore them into the store
		// so the rest of the code (level derivation, type lookup) still works.
		if (sidekickMeta && (sidekickMeta.type || sidekickMeta.level) && store.npc && !store.npc._npcSidekickType && !store.npc._npcLevelUpLevel) {
			log(`[routing] Restoring sidekick meta from b20_sidekick into store (type=${sidekickMeta.type}, level=${sidekickMeta.level})`);
			if (sidekickMeta.type) store.npc._npcSidekickType = sidekickMeta.type;
			if (sidekickMeta.level) store.npc._npcLevelUpLevel = sidekickMeta.level;
		}
		// Empowered Spells school lives only in b20_sidekick meta (store custom keys
		// can be blanked by sheet re-init) — restore it whenever present.
		if (sidekickMeta && sidekickMeta.school && store.npc && !store.npc._npcEmpoweredSchool) {
			store.npc._npcEmpoweredSchool = sidekickMeta.school;
		}
		log(`Store read — _npcSidekickType: ${store.npc?._npcSidekickType || "(none)"}, _npcLevelUpLevel: ${store.npc?._npcLevelUpLevel || "(none)"}, hasSidekickType: ${hasSidekickType}, store attr id: ${attr?.id || "(no attr)"}, total store attrs: ${character.attribs.filter(a => a.get("name") === "store").length}`);

		let dialogResult;
		if (hasSidekickType) {
			log(`Existing sidekick (type: ${store.npc._npcSidekickType}, level: ${store.npc._npcLevelUpLevel || "?"}) — level-up dialog`);
			dialogResult = await showLevelUpDialog(character, store);
		} else {
			log("No sidekick type set — Make Sidekick dialog");
			dialogResult = await showMakeSidekickDialog(character, store);
		}

		if (!dialogResult.confirmed) return;
		const {currentLevel, sidekickType, bonusProficiencies, expertiseChoices, sharpMindChoice, asiChoices, asiInstances, spellChoices, hpIncreaseMode, hpRollTotal} = dialogResult;
		// School chosen this pass (L14 dialog) or carried in b20_sidekick meta from
		// a prior level-up — pass through so it re-applies to newly-added spells.
		const empoweredSchool = dialogResult.empoweredSchool || (sidekickMeta && sidekickMeta.school) || null;
		const isMakeSidekick = !hasSidekickType;

		try {
			let newChar, summary;
			if (isMakeSidekick) {
				// Make Sidekick: create a copy with all features applied from level 1
				({character: newChar, summary} = await levelUpCharacter(character, {levels: 0, currentLevel, featureFromLevel: 0, sidekickType, bonusProficiencies, expertiseChoices, sharpMindChoice, empoweredSchool, asiChoices, asiInstances, spellChoices, hpIncreaseMode, hpRollTotal}));
				log(`Done — created sidekick copy "${newChar.get("name")}"`);
			} else {
				// Level Up: modify the existing character in-place
				({character: newChar, summary} = await levelUpCharacterInPlace(character, {levels: 1, currentLevel, sidekickType, bonusProficiencies, expertiseChoices, sharpMindChoice, empoweredSchool, asiChoices, asiInstances, spellChoices, hpIncreaseMode, hpRollTotal}));
				log(`Done — levelled up "${newChar.get("name")}" in-place`);
			}
			const featMsg = summary.featuresWritten ? `\nFeatures added: ${summary.featuresWritten}` : "";
			const profMsg = summary.bonusProficienciesAdded ? `\nBonus proficiencies added: ${summary.bonusProficienciesAdded}` : "";
			const asiMsg = summary.asiApplied ? `\nAbility scores improved: ${summary.asiApplied}` : "";
			const featPickMsg = summary.featsChosen && summary.featsChosen.length ? `\nFeat(s) taken instead of ASI: ${summary.featsChosen.join(", ")} (text added as trait — apply mechanics manually)` : "";
			const expertiseMsg = summary.expertiseApplied ? `\nExpertise applied to ${summary.expertiseApplied} skill(s)` : "";
			const sharpMindMsg = summary.sharpMindApplied ? `\nSharp Mind saving throw proficiency added` : "";
			const attackerMsg = summary.attackerBonusApplied ? `\nAttacker +2 applied to ${summary.attackerBonusApplied} attack(s)` : "";
			const cantripMsg = summary.potentCantripsApplied ? `\nPotent Cantrips applied to ${summary.potentCantripsApplied} cantrip damage roll(s)` : "";
			const helpfulMsg = summary.helpfulBonusActionApplied ? `\nHelpful action added as Bonus Action` : "";
			const empoweredMsg = summary.empoweredSchool ? `\nEmpowered Spells (${summary.empoweredSchool}) applied to ${summary.empoweredSpellsApplied || 0} damage/healing roll(s)` : "";
			const spellMsg = summary.spellsAdded ? `\nSpells added: ${summary.spellsAdded}${summary.spellRemoved ? ` (replaced ${summary.spellRemoved})` : ""}` : "";
			const spellFailMsg = summary.spellsFailed && summary.spellsFailed.length ? `\nSpells FAILED to import (add manually): ${summary.spellsFailed.join(", ")}` : "";
			const slotMsg = summary.spellSlotsChanged ? `\nSpell slots updated (${summary.spellSlotsChanged} change(s))` : "";
			if (isMakeSidekick) {
				alert(`Created "${newChar.get("name")}" as a sidekick.

Starting level: ${summary.newLevel}
HP max: ${summary.newHpMax}
Roll formula: ${summary.newRollHP}${featMsg}${profMsg}${asiMsg}${featPickMsg}${expertiseMsg}${sharpMindMsg}${attackerMsg}${helpfulMsg}${cantripMsg}${empoweredMsg}${spellMsg}${spellFailMsg}${slotMsg}`);
			} else {
				alert(`Levelled up "${newChar.get("name")}".

Level: ${summary.sourceLevel} → ${summary.newLevel}
HP: +${summary.hpAdded} (new max ${summary.newHpMax})
Roll formula: ${summary.newRollHP}${featMsg}${profMsg}${asiMsg}${featPickMsg}${expertiseMsg}${sharpMindMsg}${attackerMsg}${helpfulMsg}${cantripMsg}${empoweredMsg}${spellMsg}${spellFailMsg}${slotMsg}`);
			}
		} catch (e) {
			logError(`Failed to level up "${charName}":`, e);
			alert(`Failed to level up "${charName}". See the console for details.`);
		}
	};

	/** Remove stored sidekick metadata from a character (in-place, no copy). */
	d20plus.npcLevelUp.resetSidekickDataFromJournalContext = async function (event) {
		const character = getCharacterFromJournalContext(event);
		if (!character) return alert("No character found.");
		await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
		const {attr, store} = d20plus.store2024.getStore(character) || {};
		const hadType = store && store.npc && store.npc._npcSidekickType;
		const hadLevel = store && store.npc && store.npc._npcLevelUpLevel;
		const hadMeta = d20plus.store2024.getSidekickMeta(character);
		if (!hadType && !hadLevel && !hadMeta) return alert(`No sidekick data to reset on "${character.get("name")}".\n\n(Neither _npcSidekickType nor _npcLevelUpLevel found in the 2024 store, and no b20_sidekick attr present.)`);
		const clearMsg = [`Remove sidekick data from "${character.get("name")}"?`, ``, `This will clear:${hadType ? "\n\u2022 Sidekick type: " + hadType : ""}${hadLevel ? "\n\u2022 Stored level: " + hadLevel : ""}${hadMeta ? "\n\u2022 b20_sidekick attr: " + JSON.stringify(hadMeta) : ""}`, ``, `The character sheet is NOT modified \u2014 only the stored metadata.`].join("\n");
		if (!window.confirm(clearMsg)) return;
		if (store && store.npc) {
			delete store.npc._npcSidekickType;
			delete store.npc._npcLevelUpLevel;
			d20plus.store2024.saveStore(character, attr, store);
		}
		// Also destroy the dedicated b20_sidekick attr
		character.attribs.filter(a => a.get("name") === "b20_sidekick").forEach(a => a.destroy());
		log(`Reset sidekick data on "${character.get("name")}"`);
		alert(`Sidekick data cleared from "${character.get("name")}".`);
	};

	/** Initialise the journal context-menu button. */
	d20plus.npcLevelUp.initJournalContextButton = () => {
		const injectButton = () => {
			const $menu = $("#journalitemmenu ul");
			if (!$menu.length) { logWarn("initJournalContextButton: #journalitemmenu not found"); return; }
			$menu.find(".Vetools-npc-level-up").remove();
			$menu.find(".Vetools-npc-sidekick-reset").remove();

			const $duplicate = $menu.find(`li:contains("Duplicate File")`).first();
			const $entry = $(`<li class="Vetools-npc-level-up" data-action-type="npcLevelUp">Sidekick…</li>`);
			const $reset = $(`<li class="Vetools-npc-sidekick-reset" data-action-type="npcSidekickReset" style="color:#c0392b">Reset Sidekick Data</li>`);
			if ($duplicate.length) { $duplicate.after($entry); $entry.after($reset); }
			else { $menu.append($entry); $menu.append($reset); }
		};

		$("#journalitemmenu ul")
			.off(window.mousedowntype, "li[data-action-type=npcLevelUp]")
			.on(window.mousedowntype, "li[data-action-type=npcLevelUp]", async function (evt) {
				$("#journalitemmenu").hide();
				await d20plus.npcLevelUp.levelUpFromJournalContext(evt);
			})
			.off(window.mousedowntype, "li[data-action-type=npcSidekickReset]")
			.on(window.mousedowntype, "li[data-action-type=npcSidekickReset]", async function (evt) {
				$("#journalitemmenu").hide();
				await d20plus.npcLevelUp.resetSidekickDataFromJournalContext(evt);
			});

		injectButton();
		log("initJournalContextButton: menu button registered");
	};

	// ─────────────────────────────────────────────────────────────────────────
	// Expose internals for testing and future extension
	// ─────────────────────────────────────────────────────────────────────────
	d20plus.npcLevelUp._upgrade2024NpcStore = upgrade2024NpcStore;
	d20plus.npcLevelUp._parseCr = parseCr;
	d20plus.npcLevelUp._crToSidekickLevel = crToSidekickLevel;
	d20plus.npcLevelUp._crToPb = crToPb;
	d20plus.npcLevelUp._parseHpFormula = parseHpFormula;
	d20plus.npcLevelUp._formatHpFormula = formatHpFormula;
}

SCRIPT_EXTENSIONS.push(d20plusNpcLevelUp);
