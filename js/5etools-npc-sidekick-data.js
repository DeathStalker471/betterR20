/**
 * Sidekick feature tables — Tasha's Cauldron of Everything pp.142–147
 *
 * Five types: expert, warrior, mage, healer, prodigy
 * (mage/healer/prodigy are the three Spellcaster roles treated as distinct types)
 *
 * Each feature entry:
 *   level       {number}  Sidekick level at which the feature is gained
 *   name        {string}  Display name
 *   description {string}  Full text shown in the trait/feature body
 *   isTodo      {boolean} true  → write as "TODO: [name] — [instruction]" trait
 *                         false → write as a plain trait/feature
 *   source      {string}  e.g. "TCE p.142"
 *
 * Depends on: js/5etools-2024-store.js (d20plus.store2024)
 */
function d20plusNpcSidekickData () {
	d20plus.sidekickData = {};

	// ─────────────────────────────────────────────────────────────────────────
	// Expert (TCE pp.142–143)
	// ─────────────────────────────────────────────────────────────────────────

	d20plus.sidekickData.expert = [
		{
			level: 1,
			name: "Bonus Proficiencies",
			isTodo: true,
			source: "TCE p.142",
			description: "Choose one saving throw proficiency (Dexterity, Intelligence, or Charisma). Choose five skill proficiencies. The sidekick gains proficiency with light armor. If it is a humanoid or has a simple or martial weapon in its stat block, it also gains proficiency with all simple weapons and with two tools of your choice.",
		},
		{
			level: 1,
			name: "Helpful",
			isTodo: false,
			source: "TCE p.142",
			description: "The sidekick can take the Help action as a bonus action.",
		},
		{
			level: 2,
			name: "Cunning Action",
			isTodo: false,
			source: "TCE p.142",
			description: "On its turn in combat, the sidekick can take the Dash, Disengage, or Hide action as a bonus action.",
		},
		{
			level: 3,
			name: "Expertise",
			isTodo: true,
			source: "TCE p.142",
			description: "Choose two of the sidekick's skill proficiencies. Its proficiency bonus is doubled for any ability check using those skills.",
		},
		{
			level: 4,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 6,
			name: "Coordinated Strike",
			isTodo: false,
			source: "TCE p.142",
			description: "When the sidekick uses its Helpful feature to aid an ally attacking a creature, that target can be up to 30 feet away, and the sidekick can deal an extra 2d6 damage of the same type the next time it hits that creature before the end of the current turn.",
		},
		{
			level: 7,
			name: "Evasion",
			isTodo: false,
			source: "TCE p.142",
			description: "When the sidekick is subjected to an effect that allows a Dexterity saving throw for half damage, it takes no damage on a success and half damage on a failure. Doesn't apply while incapacitated.",
		},
		{
			level: 8,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 10,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 11,
			name: "Inspiring Help",
			isTodo: false,
			source: "TCE p.142",
			description: "When the sidekick takes the Help action, the recipient also gains a 1d6 bonus to the d20 roll. If it's an attack roll, the recipient can forgo the bonus and instead add it to the damage roll if the attack hits.",
		},
		{
			level: 12,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 14,
			name: "Reliable Talent",
			isTodo: false,
			source: "TCE p.142",
			description: "Whenever the sidekick makes an ability check that includes its full proficiency bonus, it can treat a d20 roll of 9 or lower as a 10.",
		},
		{
			level: 15,
			name: "Expertise",
			isTodo: true,
			source: "TCE p.142",
			description: "Choose two more of the sidekick's skill proficiencies. Its proficiency bonus is doubled for any ability check using those skills.",
		},
		{
			level: 16,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 18,
			name: "Sharp Mind",
			isTodo: true,
			source: "TCE p.142",
			description: "The sidekick gains proficiency in one saving throw of your choice: Intelligence, Wisdom, or Charisma.",
		},
		{
			level: 19,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.142",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 20,
			name: "Inspiring Help Improvement",
			isTodo: false,
			source: "TCE p.142",
			description: "The bonus dice granted by the sidekick's Inspiring Help feature increases to 2d6.",
		},
	];

	// ─────────────────────────────────────────────────────────────────────────
	// Warrior (TCE pp.146–147)
	// ─────────────────────────────────────────────────────────────────────────

	d20plus.sidekickData.warrior = [
		{
			level: 1,
			name: "Bonus Proficiencies",
			isTodo: true,
			source: "TCE p.146",
			description: "Choose one saving throw proficiency (Strength, Dexterity, or Constitution). Choose two skill proficiencies from: Acrobatics, Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival. The sidekick gains proficiency with all armor. If it is a humanoid or has a simple or martial weapon in its stat block, it gains proficiency with shields and all simple and martial weapons.",
		},
		{
			level: 1,
			name: "Martial Role",
			isTodo: true,
			source: "TCE p.146",
			description: "Choose one: Attacker — the sidekick gains a +2 bonus to all attack rolls. Defender — the sidekick can use its reaction to impose disadvantage on the attack roll of a creature within 5 feet of it whose target isn't the sidekick (provided the sidekick can see the attacker).",
		},
		{
			level: 2,
			name: "Second Wind",
			isTodo: false,
			source: "TCE p.146",
			description: "Once per short or long rest, the sidekick can use a bonus action to regain hit points equal to 1d10 + its sidekick level.",
		},
		{
			level: 3,
			name: "Improved Critical",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick's attack rolls score a critical hit on a roll of 19 or 20 on the d20.",
		},
		{
			level: 4,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 6,
			name: "Extra Attack",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick can attack twice instead of once when it takes the Attack action. If it has Multiattack, it can use Extra Attack or Multiattack on a turn, not both.",
		},
		{
			level: 7,
			name: "Battle Readiness",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick has advantage on initiative rolls.",
		},
		{
			level: 8,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 10,
			name: "Improved Defense",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick's Armor Class increases by 1.",
		},
		{
			level: 11,
			name: "Indomitable",
			isTodo: false,
			source: "TCE p.146",
			description: "Once per long rest, the sidekick can reroll a saving throw it fails, and must use the new roll.",
		},
		{
			level: 12,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 14,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 15,
			name: "Extra Attack Improvement",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick can now attack three times instead of once when it takes the Attack action.",
		},
		{
			level: 16,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 18,
			name: "Indomitable Improvement",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick can now use Indomitable twice between long rests.",
		},
		{
			level: 19,
			name: "Ability Score Improvement",
			isTodo: true,
			source: "TCE p.146",
			description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
		},
		{
			level: 20,
			name: "Second Wind Improvement",
			isTodo: false,
			source: "TCE p.146",
			description: "The sidekick can now use its Second Wind feature twice between rests.",
		},
	];

	// ─────────────────────────────────────────────────────────────────────────
	// Shared spellcasting level-up features (levels 4–20, all three roles)
	// Role-specific details are in the per-type arrays below.
	// ─────────────────────────────────────────────────────────────────────────

	// Spellcaster spell slots by level (same for all three roles)
	// [level]: [1st, 2nd, 3rd, 4th, 5th]
	d20plus.sidekickData.spellcasterSlots = {
		1:  [2, 0, 0, 0, 0],
		2:  [3, 0, 0, 0, 0],
		3:  [4, 2, 0, 0, 0],
		4:  [4, 3, 0, 0, 0],
		5:  [4, 3, 2, 0, 0],
		6:  [4, 3, 3, 0, 0],
		7:  [4, 3, 3, 1, 0],
		8:  [4, 3, 3, 2, 0],
		9:  [4, 3, 3, 3, 1],
		10: [4, 3, 3, 3, 2],
		11: [4, 3, 3, 3, 2],
		12: [4, 3, 3, 3, 2],
		13: [4, 3, 3, 3, 2],
		14: [4, 3, 3, 3, 2],
		15: [4, 3, 3, 3, 2],
		16: [4, 3, 3, 3, 2],
		17: [4, 3, 3, 3, 2],
		18: [4, 3, 3, 3, 3],
		19: [4, 3, 3, 3, 3],
		20: [4, 3, 3, 3, 3],
	};

	// Cantrips known and spells known by level (same for all three roles)
	d20plus.sidekickData.spellcasterKnown = {
		//        [cantrips, spells]
		1:  [2, 1],
		2:  [2, 2],
		3:  [2, 3],
		4:  [2, 4],
		5:  [2, 5],
		6:  [3, 6],
		7:  [3, 7],
		8:  [3, 8],
		9:  [3, 9],
		10: [3, 10],
		11: [3, 11],
		12: [3, 12],
		13: [3, 13],
		14: [4, 14],
		15: [4, 15],
		16: [4, 16],
		17: [4, 17],
		18: [4, 18],
		19: [4, 19],
		20: [4, 20],
	};

	function makeSpellcasterFeatures (roleName, spellList, spellcastingAbility, sourcePage, asiLevels) {
		const features = [
			{
				level: 1,
				name: "Bonus Proficiencies",
				isTodo: true,
				source: sourcePage,
				description: `Choose one saving throw proficiency (Wisdom, Intelligence, or Charisma). Choose two skill proficiencies from: Arcana, History, Insight, Investigation, Medicine, Performance, Persuasion, or Religion. The sidekick gains proficiency with light armor, and if it is a humanoid or has a simple or martial weapon in its stat block, it also gains proficiency with all simple weapons.`,
			},
			{
				level: 1,
				name: "Spellcasting",
				isTodo: true,
				source: sourcePage,
				description: `The sidekick is a ${roleName}. Its spellcasting ability is ${spellcastingAbility} and its spell list is ${spellList}. It knows 2 cantrips and 1 1st-level spell of your choice from its spell list. Spell save DC = 8 + ${spellcastingAbility} modifier + PB. Spell attack modifier = ${spellcastingAbility} modifier + PB. Set up spell slots: 1st-level ×2.`,
			},
		];

		// Spells-known gain at each level (generate as TODO features)
		for (let lvl = 2; lvl <= 20; lvl++) {
			const known = d20plus.sidekickData.spellcasterKnown[lvl];
			const prevKnown = d20plus.sidekickData.spellcasterKnown[lvl - 1];
			const slots = d20plus.sidekickData.spellcasterSlots[lvl];
			const prevSlots = d20plus.sidekickData.spellcasterSlots[lvl - 1];

			const newCantrips = known[0] - prevKnown[0];
			const newSpells = known[1] - prevKnown[1];
			const slotDesc = slots.map((n, i) => n > 0 ? `${n}×${["1st","2nd","3rd","4th","5th"][i]}` : null).filter(Boolean).join(", ");

			if (newCantrips > 0 || newSpells > 0) {
				const lines = [];
				if (newCantrips > 0) lines.push(`+${newCantrips} cantrip${newCantrips > 1 ? "s" : ""} known`);
				if (newSpells > 0) lines.push(`+${newSpells} spell${newSpells > 1 ? "s" : ""} known (max level for which slots exist)`);
				lines.push(`Total spell slots now: ${slotDesc}`);
				features.push({
					level: lvl,
					name: "Spellcasting Advancement",
					isTodo: true,
					source: sourcePage,
					description: lines.join(". ") + `. You may also replace one known spell with another from the ${spellList} list.`,
				});
			}
		}

		// ASIs
		for (const lvl of asiLevels) {
			features.push({
				level: lvl,
				name: "Ability Score Improvement",
				isTodo: true,
				source: sourcePage,
				description: "Increase one ability score by 2, or two ability scores by 1 each (max 20). Alternatively, take a feat if your DM allows it.",
			});
		}

		// Shared spellcaster class features
		features.push({
			level: 6,
			name: "Potent Cantrips",
			isTodo: false,
			source: sourcePage,
			description: `The sidekick can add its ${spellcastingAbility} modifier to the damage it deals with any cantrip.`,
		});
		features.push({
			level: 14,
			name: "Empowered Spells",
			isTodo: true,
			source: sourcePage,
			description: "Choose one school of magic. Whenever the sidekick casts a spell of that school by expending a slot, it can add its spellcasting ability modifier to the damage or healing roll.",
		});
		features.push({
			level: 20,
			name: "Focused Casting",
			isTodo: false,
			source: sourcePage,
			description: "Taking damage cannot break the sidekick's concentration on a spell.",
		});

		// Sort by level, then alphabetically within level
		features.sort((a, b) => a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name));
		return features;
	}

	// ASI levels differ between roles: mage/healer/prodigy share 4,8,12,16,18
	const SPELLCASTER_ASI_LEVELS = [4, 8, 12, 16, 18];

	d20plus.sidekickData.mage = makeSpellcasterFeatures(
		"Mage", "Wizard spell list", "Intelligence", "TCE p.144", SPELLCASTER_ASI_LEVELS,
	);

	d20plus.sidekickData.healer = makeSpellcasterFeatures(
		"Healer", "Cleric and Druid spell lists", "Wisdom", "TCE p.144", SPELLCASTER_ASI_LEVELS,
	);

	d20plus.sidekickData.prodigy = makeSpellcasterFeatures(
		"Prodigy", "Bard and Warlock spell lists", "Charisma", "TCE p.144", SPELLCASTER_ASI_LEVELS,
	);

	// ─────────────────────────────────────────────────────────────────────────
	// Public helpers
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Return all features for a type gained between fromLevel+1 and toLevel (inclusive).
	 * If fromLevel is 0, returns all features up to toLevel (i.e. "make sidekick" view).
	 */
	d20plus.sidekickData.getFeaturesGained = function (type, fromLevel, toLevel) {
		const list = d20plus.sidekickData[type];
		if (!list) return [];
		return list.filter(f => f.level > fromLevel && f.level <= toLevel);
	};

	/**
	 * Return a human-readable type label.
	 */
	d20plus.sidekickData.typeLabel = function (type) {
		return {
			expert: "Expert",
			warrior: "Warrior",
			mage: "Mage (Spellcaster)",
			healer: "Healer (Spellcaster)",
			prodigy: "Prodigy (Spellcaster)",
		}[type] || type;
	};

	d20plus.sidekickData.ALL_TYPES = ["expert", "warrior", "mage", "healer", "prodigy"];

	// ─────────────────────────────────────────────────────────────────────────
	// Sidekick spell lists (2024 PHB / XPHB data, bundled into the build)
	// ─────────────────────────────────────────────────────────────────────────

	// TCE p.144: mage uses the Wizard list, healer Cleric+Druid, prodigy Bard+Warlock.
	d20plus.sidekickData.SPELL_LISTS = {
		mage: ["Wizard"],
		healer: ["Cleric", "Druid"],
		prodigy: ["Bard", "Warlock"],
	};

	d20plus.sidekickData.SPELLCASTING_ABILITY = {
		mage: "Intelligence",
		healer: "Wisdom",
		prodigy: "Charisma",
	};

	/** Highest spell level for which the sidekick has slots at the given level. */
	d20plus.sidekickData.maxSpellLevelAt = function (level) {
		const slots = d20plus.sidekickData.spellcasterSlots[level];
		if (!slots) return 0;
		let max = 0;
		slots.forEach((count, ix) => { if (count > 0) max = ix + 1; });
		return max;
	};

	let _spellOptionCache = null;

	/**
	 * Build (and cache) the XPHB spell option list from the bundled data
	 * (JSON_DATA, embedded at build time; see base-jsload.js).
	 * Returns [{name, level, school, classes: Set}] or [] if data unavailable.
	 */
	function loadXphbSpellOptions () {
		if (_spellOptionCache) return _spellOptionCache;
		try {
			const spellFile = typeof JSON_DATA !== "undefined" ? JSON_DATA["data/spells/spells-xphb.json"] : null;
			const sources = typeof JSON_DATA !== "undefined" ? JSON_DATA["data/spells/sources.json"] : null;
			if (!spellFile || !spellFile.spell || !sources || !sources.XPHB) return [];

			const classLists = sources.XPHB;
			_spellOptionCache = spellFile.spell.map(sp => {
				const entry = classLists[sp.name];
				const classes = new Set(((entry && entry.class) || []).map(c => c.name));
				return {name: sp.name, level: sp.level || 0, school: sp.school || "", classes, _spell: sp};
			});
			return _spellOptionCache;
		} catch (e) {
			console.warn("betterR20: failed to load XPHB spell options", e);
			return [];
		}
	}

	/**
	 * Spell options for a sidekick type, split into cantrips and leveled spells.
	 * @param type sidekick type (mage/healer/prodigy)
	 * @param maxSpellLevel highest allowed spell level (from slot table)
	 * @return {cantrips: [...], spells: [...]} sorted by level then name
	 */
	d20plus.sidekickData.getSpellOptions = function (type, maxSpellLevel) {
		const lists = d20plus.sidekickData.SPELL_LISTS[type];
		if (!lists) return {cantrips: [], spells: []};
		const all = loadXphbSpellOptions()
			.filter(sp => lists.some(cls => sp.classes.has(cls)))
			.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
		return {
			cantrips: all.filter(sp => sp.level === 0),
			spells: all.filter(sp => sp.level >= 1 && sp.level <= maxSpellLevel),
		};
	};

	/** Full 5etools spell object by name (XPHB), for import. Null if not found. */
	d20plus.sidekickData.getSpellByName = function (name) {
		const found = loadXphbSpellOptions().find(sp => sp.name.toLowerCase() === String(name).toLowerCase());
		return found ? found._spell : null;
	};

	/** Human-readable spell list label for dialogs, e.g. "Cleric and Druid". */
	d20plus.sidekickData.spellListLabel = function (type) {
		const lists = d20plus.sidekickData.SPELL_LISTS[type];
		return lists ? lists.join(" and ") : "";
	};
}

SCRIPT_EXTENSIONS.push(d20plusNpcSidekickData);
