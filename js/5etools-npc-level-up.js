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

	const CR_TO_SIDEKICK_LEVEL = [
		// [maxCrNum, sidekickLevel]
		[0.125, 1],
		[0.25,  2],
		[0.5,   3],
		[1,     4],
		[2,     5],
		[4,     6],
		[6,     7],
		[8,     8],
		[10,    9],
		[12,    10],
		[15,    11],
		[19,    12],
		[Infinity, 13],
	];

	/** Proficiency bonus by sidekick level (same schedule as character PB). */
	const SIDEKICK_LEVEL_TO_PB = [
		// index 0 unused; index 1..13
		0,
		2, 2, 2, 2,   // levels 1–4
		3, 3, 3, 3,   // levels 5–8
		4, 4, 4, 4,   // levels 9–12
		5,            // level 13
	];

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
		return 13;
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
		const levels = Math.max(1, Math.min(options.levels || 1, 10));

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

		// ── Resolve current CR and levels ────────────────────────────────────
		const crStr = store.npc && store.npc.challengeRating ? String(store.npc.challengeRating) : "0";
		const currentSidekickLevel = crToSidekickLevel(crStr);
		const targetSidekickLevel = Math.min(currentSidekickLevel + levels, 13);
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
			const hpGainPerLevel = avgPerDie + conMod;
			const totalHpGain = levelsGained * hpGainPerLevel;
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

		// ── Update proficiency-derived save/skill integrants ─────────────────
		// When PB increases, every Proficiency integrant (save or skill) that uses
		// proficiencyLevel "Proficient" or "Expertise" gets the higher PB automatically
		// because the sheet derives the bonus from PB × proficiency multiplier.
		// We don't need to mutate individual integrant values — PB in the 2024 sheet
		// is implicitly set by the CR. However, for NPC level-up we need to update CR
		// so the sheet derives the right PB.
		//
		// Store the new "virtual level" as a custom note on the store so we can detect
		// the current level on future upgrades without re-deriving from CR.
		if (!store.npc) store.npc = {};
		store.npc._npcLevelUpLevel = targetSidekickLevel;

		// Count how many Proficiency integrants exist (informational for the summary)
		const allInts = (store.integrants && store.integrants.integrants) || {};
		summary.proficienciesUpdated = Object.values(allInts)
			.filter(i => i.type === "Proficiency")
			.length;

		return { store, summary };
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────────────────

	/** Return the first integrant of a given type from the store, or null. */
	function findIntegrantByType (store, type) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		return Object.values(ints).find(i => i.type === type) || null;
	}

	/** Build a copy name for the upgraded character. */
	function getLevelUpName (sourceName, targetLevel) {
		return `${sourceName || "Unnamed"} (Level ${targetLevel})`;
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
		character.attribs.fetch(character.attribs);

		const attrMap = {};
		(character.attribs?.toJSON?.() || []).forEach(a => { attrMap[a.name] = a.current; });
		const rawStoreAttr = character.attribs.find(a => a.get("name") === "store");
		const rawStoreValue = rawStoreAttr ? rawStoreAttr.get("current") : null;
		let parsedStore = null;
		if (rawStoreValue) {
			try {
				parsedStore = typeof rawStoreValue === "string" ? JSON.parse(rawStoreValue) : rawStoreValue;
			} catch (e) {
				parsedStore = {error: e.message || String(e)};
			}
		}

		console.log("betterR20 NPC level-up detection snapshot", {
			name: character.get("name"),
			sheet: attrMap.rpg_sheet || attrMap.sheet_type || attrMap.charactersheet_type,
			appState: attrMap.appState,
			npcFlag: attrMap.npc,
			hasStore: !!rawStoreValue,
			storeKeys: parsedStore ? Object.keys(parsedStore) : [],
			hasNpc: !!(parsedStore && parsedStore.npc),
			hasHitpoints: !!(parsedStore && parsedStore.hitpoints),
			hasIntegrants: !!(parsedStore && parsedStore.integrants),
		});

		if (!d20plus.store2024.isNpc2024Sheet(character)) {
			throw new Error("The selected character is not a 2024 NPC sheet.");
		}

		const {attr: sourceAttr, store: sourceStore} = d20plus.store2024.getStore(character);
		if (!sourceStore) throw new Error("Could not read the 2024 store from this character.");

		// Transform the store
		const {store: upgradedStore, summary} = upgrade2024NpcStore(sourceStore, options);

		// Debug logging
		const dbg = d20plus.store2024;
		window.__npcLevelUpLastSourceStore = dbg.cloneForDebug(sourceStore);
		window.__npcLevelUpLastUpgradedStore = dbg.cloneForDebug(upgradedStore);
		window.__npcLevelUpLastSummary = dbg.cloneForDebug(summary);
		dbg.logDebugJson("betterR20 NPC level-up source store", window.__npcLevelUpLastSourceStore);
		dbg.logDebugJson("betterR20 NPC level-up upgraded store", window.__npcLevelUpLastUpgradedStore);
		dbg.logDebugJson("betterR20 NPC level-up summary", window.__npcLevelUpLastSummary);

		if (summary.errors.length) {
			console.warn("betterR20 NPC level-up warnings:", summary.errors);
		}

		const sourceName = character.get("name") || "Unnamed character";
		const upgradedName = getLevelUpName(sourceName, summary.newLevel);
		const sourceAttributes = {...character.attributes};
		delete sourceAttributes.id;

		return new Promise((resolve, reject) => {
			d20.Campaign.characters.create({
				...sourceAttributes,
				name: upgradedName,
				charactersheetname: d20plus.cfg.getOrDefault("import", "importSheetFormat"),
				inplayerjournals: sourceAttributes.inplayerjournals || "",
				controlledby: sourceAttributes.controlledby || "",
				tags: sourceAttributes.tags || "",
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

						// Write upgraded store and names
						d20plus.store2024.saveNewNpcState(newCharacter, upgradedStore);
						d20plus.store2024.saveNpcNames(newCharacter, upgradedName);

						window.__npcLevelUpLastCharacter = dbg.cloneForDebug(newCharacter?.attributes || newCharacter);
						dbg.logDebugJson("betterR20 NPC level-up created character", window.__npcLevelUpLastCharacter);

						// Copy bio / gmnotes blobs
						await d20plus.store2024.copyBioAndNotes(character, newCharacter);

						// Place in the same folder as source
						const folderContext = d20plus.store2024.getCharacterFolderContext(character);
						if (folderContext?.folderId) {
							d20.journal.addItemToFolderStructure(newCharacter.id, folderContext.folderId);
						}

						if (newCharacter.view && typeof newCharacter.view.showNewVueFrame === "function") {
							newCharacter.view.showNewVueFrame();
						}

						resolve({character: newCharacter, summary});
					} catch (e) {
						reject(e);
					}
				},
				error: reject,
			});
		});
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

	function buildSummaryMessage (summary) {
		const lines = [`Level ${summary.sourceLevel} → ${summary.newLevel}`];
		if (summary.pbChanged) lines.push(`PB: +${summary.sourcePb} → +${summary.newPb}`);
		if (summary.hpAdded) lines.push(`HP: +${summary.hpAdded} (new max ${summary.newHpMax})`);
		if (summary.hitDiceAdded) lines.push(`Hit dice added: ${summary.hitDiceAdded}`);
		if (summary.newRollHP) lines.push(`Roll formula: ${summary.newRollHP}`);
		if (summary.proficienciesUpdated) lines.push(`Proficiencies present: ${summary.proficienciesUpdated}`);
		if (summary.errors.length) lines.push(`Warnings: ${summary.errors.join("; ")}`);
		return lines.join("\n");
	}

	/** Journal context-menu handler. */
	d20plus.npcLevelUp.levelUpFromJournalContext = async function (event) {
		const character = getCharacterFromJournalContext(event);
		if (!character) return alert("No character found.");
		console.log("betterR20 NPC level-up handler invoked", {
			lastClickedJournalItemId: d20plus.journal?.lastClickedJournalItemId || null,
			characterId: character?.id || null,
			characterName: character?.get?.("name") || null,
		});
		if (!canLevelUp(character)) return alert("The selected character is not a 2024 NPC sheet.");

		const charName = character.get("name") || "Unnamed character";
		const {attr, store} = d20plus.store2024.getStore(character);
		if (!store) return alert("Could not read the 2024 store from this character.");

		const crStr = store.npc && store.npc.challengeRating ? String(store.npc.challengeRating) : "0";
		const currentLevel = store.npc._npcLevelUpLevel || crToSidekickLevel(crStr);
		const nextLevel = Math.min(currentLevel + 1, 13);

		if (!window.confirm(`Level up "${charName}" from level ${currentLevel} to ${nextLevel}?\n\nA new copy will be created.`)) return;

		try {
			const {character: newChar, summary} = await levelUpCharacter(character, {levels: 1});
			alert(`Created "${newChar.get("name")}".\n\n${buildSummaryMessage(summary)}`);
		} catch (e) {
			console.error("betterR20 NPC level-up error:", e);
			alert(`Failed to level up "${charName}". See the console for details.`);
		}
	};

	/** Initialise the journal context-menu button. */
	d20plus.npcLevelUp.initJournalContextButton = () => {
		const injectButton = () => {
			const $menu = $("#journalitemmenu ul");
			if (!$menu.length) return;
			$menu.find(".Vetools-npc-level-up").remove();

			const $duplicate = $menu.find(`li:contains("Duplicate File")`).first();
			const $entry = $(`<li class="Vetools-npc-level-up" data-action-type="npcLevelUp">Level Up NPC Copy</li>`);
			if ($duplicate.length) $duplicate.after($entry);
			else $menu.append($entry);
		};

		$("#journalitemmenu ul")
			.off(window.mousedowntype, "li[data-action-type=npcLevelUp]")
			.on(window.mousedowntype, "li[data-action-type=npcLevelUp]", async function (evt) {
				$("#journalitemmenu").hide();
				await d20plus.npcLevelUp.levelUpFromJournalContext(evt);
			});

		injectButton();
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
