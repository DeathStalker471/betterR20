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
		if (options.sidekickType) store.npc._npcSidekickType = options.sidekickType;

		// Write sidekick class features for levels gained
		const sidekickType = options.sidekickType || (store.npc && store.npc._npcSidekickType) || null;
		const featuresWritten = writeSidekickFeatures(store, sidekickType, currentSidekickLevel, targetSidekickLevel);

		// Count how many Proficiency integrants exist (informational for the summary)
		const allInts = (store.integrants && store.integrants.integrants) || {};
		summary.proficienciesUpdated = Object.values(allInts)
			.filter(i => i.type === "Proficiency")
			.length;
		summary.featuresWritten = featuresWritten;

		return { store, summary };
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Sidekick feature writing
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Write sidekick features gained between fromLevel+1 and toLevel into the store.
	 * Returns the number of features written.
	 */
	function writeSidekickFeatures (store, sidekickType, fromLevel, toLevel) {
		if (!d20plus.sidekickData || !sidekickType) return 0;
		const features = d20plus.sidekickData.getFeaturesGained(sidekickType, fromLevel, toLevel);
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
		if (!d20plus.store2024.isNpc2024Sheet(character)) {
			throw new Error("The selected character is not a 2024 NPC sheet.");
		}

		const {attr: sourceAttr, store: sourceStore} = d20plus.store2024.getStore(character);
		if (!sourceStore) throw new Error("Could not read the 2024 store from this character.");

		// Transform the store
		const {store: upgradedStore, summary} = upgrade2024NpcStore(sourceStore, options);

		logGroup(`Upgrade summary for "${character.get("name")}"`, () => {
			log(`Level: ${summary.sourceLevel} → ${summary.newLevel}`);
			log(`PB: +${summary.sourcePb} → +${summary.newPb}${summary.pbChanged ? " (changed)" : ""}`);
			log(`HP: +${summary.hpAdded} (new max ${summary.newHpMax}), roll formula: ${summary.newRollHP}`);
			log(`Hit dice added: ${summary.hitDiceAdded}, proficiencies present: ${summary.proficienciesUpdated}`);
			if (summary.errors.length) logWarn("Warnings:", summary.errors.join("; "));
		});

		if (summary.errors.length) {
			logWarn("Upgrade completed with warnings:", summary.errors);
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

						log(`Created "${upgradedName}" (id: ${newCharacter.id})`);

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

	/**
	 * Build a preview of what a level-up would produce for a given currentLevel.
	 * Returns the same summary shape as upgrade2024NpcStore.
	 */
	function previewUpgrade (store, currentLevel, sidekickType) {
		const overridden = JSON.parse(JSON.stringify(store));
		if (!overridden.npc) overridden.npc = {};
		overridden.npc._npcLevelUpLevel = currentLevel;
		const {summary} = upgrade2024NpcStore(overridden, {levels: 1, sidekickType});
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
		const featuresHtml = features.length
			? `<p style="margin:8px 0 4px"><strong>Features gained (levels 1–${targetLevel})</strong></p><ul style="margin:0;padding-left:1.2em">${
				features.map(f => `<li><span style="color:${f.isTodo ? "#c0392b" : "#27ae60"};font-weight:bold">${f.isTodo ? "TODO" : "AUTO"} ${f.name}</span> <span style="color:#888">(lv${f.level})</span><br><span style="font-size:0.9em">${f.description.slice(0, 120)}${f.description.length > 120 ? "…" : ""}</span></li>`
				).join("")
			}</ul>`
			: `<em>No features for this type/level combination.</em>`;
		return `<table style="border-collapse:collapse;margin-bottom:6px">${rowsHtml}</table>${featuresHtml}`;
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

		let featuresHtml = "";
		if (sidekickType && d20plus.sidekickData) {
			const features = d20plus.sidekickData.getFeaturesGained(sidekickType, fromLevel, toLevel);
			if (features.length) {
				const featureItems = features.map(f => {
					const tag = f.isTodo
						? `<span style="color:#c0392b;font-size:0.85em;font-weight:bold">TODO</span>`
						: `<span style="color:#27ae60;font-size:0.85em;font-weight:bold">AUTO</span>`;
					return `<li style="margin:3px 0">${tag} <strong>${f.name}</strong> <span style="color:#888;font-size:0.88em">(lv${f.level})</span><br><span style="color:#555;font-size:0.88em">${f.description.substring(0, 120)}${f.description.length > 120 ? "…" : ""}</span></li>`;
				}).join("");
				featuresHtml = `
					<hr style="margin:8px 0">
					<p style="margin:4px 0 4px;font-weight:bold;font-size:0.92em">Features gained</p>
					<ul style="margin:0;padding-left:16px;max-height:180px;overflow-y:auto">${featureItems}</ul>
				`;
			} else {
				featuresHtml = `<hr style="margin:8px 0"><p style="color:#888;font-size:0.9em;margin:4px 0">No class features gained at this level.</p>`;
			}
		}

		return `<table style="border-collapse:collapse;width:100%">${rowsHtml}</table>${warnings}${featuresHtml}`;
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
			.b20-sidekick-row label{display:flex;align-items:center;gap:6px;margin:4px 0;cursor:pointer}
			.b20-sidekick-dialog .ui-dialog-buttonpane{padding:.5em .8em}
			.b20-sidekick-dialog .ui-dialog-buttonset button{border-radius:8px;padding:.45em .9em}
			.b20-sidekick-dialog .ui-dialog-buttonset button:first-child{background:#2563eb;color:#fff;border-color:#1d4ed8}
		</style>`;
	}
	function showMakeSidekickDialog (character, store) {
		return new Promise((resolve) => {
			const charName = character.get("name") || "Unnamed character";
			const levelOptions = makeLevelBasisOptions(store);

			const allTypes = (d20plus.sidekickData && d20plus.sidekickData.ALL_TYPES) || ["expert","warrior","mage","healer","prodigy"];
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
					<div class="b20-sidekick-card">
						<h4>Preview</h4>
						<div class="b20-upgrade-preview b20-sidekick-preview"></div>
					</div>
				</div>
			`);

			function getType () { return $dialog.find("input[name=sidekickType]:checked").val() || "expert"; }
			function getLevel () { return getSelectedLevel($dialog, levelOptions); }

			function refresh () {
				const type = getType();
				const level = getLevel();
				$dialog.find(".b20-upgrade-preview").html(makeStartingStateHtml(store, type, level));
			}

			$dialog.on("change", "input[name=sidekickType], input[name=levelBasis]", function () {
				const chosen = $dialog.find("input[name=levelBasis]:checked").val();
				$dialog.find(".b20-custom-level-row").css("display", chosen === "custom" ? "block" : "none");
				refresh();
			});
			$dialog.on("input", ".b20-custom-level-input", refresh);

			$dialog.dialog({
				resizable: true, autoOpen: true, width: 620, dialogClass: "b20-sidekick-dialog",
				title: "Make Sidekick — Create Copy",
				open: () => refresh(),
				close: () => { $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
				buttons: {
					"Create Sidekick Copy": () => {
						const currentLevel = getLevel();
						const sidekickType = getType();
						$dialog.off(); $dialog.dialog("destroy").remove();
						resolve({confirmed: true, currentLevel, sidekickType});
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
			const levelOptions = makeLevelBasisOptions(store);
			const sidekickType = knownSidekickType || (store.npc && store.npc._npcSidekickType) || null;

			// If type is unknown, show a type selector
			const allTypes = (d20plus.sidekickData && d20plus.sidekickData.ALL_TYPES) || ["expert","warrior","mage","healer","prodigy"];
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
							<div class="b20-sidekick-sub">Create a leveled-up sidekick copy</div>
						</div>
					</div>
					<div class="b20-sidekick-grid" style="grid-template-columns:1fr">
						<div class="b20-sidekick-card b20-sidekick-row">
							${typeNote}
							<h4 style="margin-top:0">Current Level</h4>
							${makeLevelBasisHtml(levelOptions)}
							<div class="b20-custom-level-row" style="display:none;margin-top:6px">
								<label>Level (1–20): <input type="number" class="b20-custom-level-input" min="1" max="20" value="1" style="width:64px;margin-left:6px"></label>
							</div>
						</div>
						<div class="b20-sidekick-card">
							<h4>Preview</h4>
							<div class="b20-upgrade-preview b20-sidekick-preview" style="min-height:90px"></div>
						</div>
					</div>
				</div>
			`);

			function getType () {
				if (sidekickType) return sidekickType;
				return $dialog.find("input[name=sidekickType]:checked").val() || "expert";
			}
			function getLevel () { return getSelectedLevel($dialog, levelOptions); }

			function refresh () {
				const type = getType();
				const level = getLevel();
				const summary = previewUpgrade(store, level, type);
				$dialog.find(".b20-upgrade-preview").html(makeStatPreviewHtml(summary, type, level, level + 1));
			}

			$dialog.on("change", "input[name=sidekickType], input[name=levelBasis]", function () {
				const chosen = $dialog.find("input[name=levelBasis]:checked").val();
				$dialog.find(".b20-custom-level-row").css("display", chosen === "custom" ? "block" : "none");
				refresh();
			});
			$dialog.on("input", ".b20-custom-level-input", refresh);

			$dialog.dialog({
				resizable: true, autoOpen: true, width: 620, dialogClass: "b20-sidekick-dialog",
				title: "Level Up Sidekick — Create Copy",
				open: () => refresh(),
				close: () => { $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
				buttons: {
					"Create Copy": () => {
						const currentLevel = getLevel();
						const resolvedType = getType();
						$dialog.off(); $dialog.dialog("destroy").remove();
						resolve({confirmed: true, currentLevel, sidekickType: resolvedType});
					},
					Cancel: () => { $dialog.off(); $dialog.dialog("destroy").remove(); resolve({confirmed: false}); },
				},
			});
		});
	}

	/** Journal context-menu handler — detects Make Sidekick vs Level Up flow. */
	d20plus.npcLevelUp.levelUpFromJournalContext = async function (event) {
		const character = getCharacterFromJournalContext(event);
		log(`Handler invoked — resolved character: "${character?.get?.("name") || "(none)"}" (id: ${character?.id || d20plus.journal?.lastClickedJournalItemId || "?"})`);
		if (!character) return alert("No character found.");
		await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
		log(`Attributes loaded: ${character.attribs?.length || 0}`);
		if (!canLevelUp(character)) return alert("The selected character is not a 2024 NPC sheet.");

		const charName = character.get("name") || "Unnamed character";
		const {attr, store} = d20plus.store2024.getStore(character);
		if (!store) return alert("Could not read the 2024 store from this character.");

		// Only go to Level Up if _npcSidekickType is already set.
		// _npcLevelUpLevel alone (from old flow) is not enough — use Make Sidekick.
		const hasSidekickType = !!(store.npc && store.npc._npcSidekickType);

		let dialogResult;
		if (hasSidekickType) {
			log(`Existing sidekick (type: ${store.npc._npcSidekickType}, level: ${store.npc._npcLevelUpLevel || "?"}) — level-up dialog`);
			dialogResult = await showLevelUpDialog(character, store);
		} else {
			log("No sidekick type set — Make Sidekick dialog");
			dialogResult = await showMakeSidekickDialog(character, store);
		}

		if (!dialogResult.confirmed) return;
		const {currentLevel, sidekickType} = dialogResult;
		const isMakeSidekick = !hasSidekickType;

		try {
			const applyLevels = isMakeSidekick ? 0 : 1;
			const {character: newChar, summary} = await levelUpCharacter(character, {levels: applyLevels, currentLevel, sidekickType});
			log(`Done — created "${newChar.get("name")}"`);
			const featMsg = summary.featuresWritten ? `\nFeatures added: ${summary.featuresWritten}` : "";
			if (isMakeSidekick) {
				alert(`Created "${newChar.get("name")}" as a sidekick.

Starting level: ${summary.newLevel}
HP max: ${summary.newHpMax}
Roll formula: ${summary.newRollHP}${featMsg}`);
			} else {
				alert(`Created "${newChar.get("name")}".

Level: ${summary.sourceLevel} → ${summary.newLevel}
HP: +${summary.hpAdded} (new max ${summary.newHpMax})
Roll formula: ${summary.newRollHP}${featMsg}`);
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
		if (!hadType && !hadLevel) return alert(`No sidekick data to reset on "${character.get("name")}".\n\n(Neither _npcSidekickType nor _npcLevelUpLevel found in the 2024 store.)`);
		const clearMsg = [`Remove sidekick data from "${character.get("name")}"?`, ``, `This will clear:${hadType ? "\n\u2022 Sidekick type: " + hadType : ""}${hadLevel ? "\n\u2022 Stored level: " + hadLevel : ""}`, ``, `The character sheet is NOT modified \u2014 only the stored metadata.`].join("\n");
		if (!window.confirm(clearMsg)) return;
		delete store.npc._npcSidekickType;
		delete store.npc._npcLevelUpLevel;
		d20plus.store2024.saveStore(character, attr, store);
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






