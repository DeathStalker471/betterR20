'use strict';

const vm   = require('vm');
const { createRoll20Env, load2024FromDist, loadSectionFromDist } = require('./helpers/env');

let ctx;

beforeAll(() => {
	const env = createRoll20Env();
	ctx = vm.createContext(env);
	load2024FromDist(ctx);
	// import2024TokenActions calls into d20plus.macro.* (base-macro.js), which
	// isn't part of the 2024-only range load2024FromDist extracts.
	loadSectionFromDist(ctx, 'const baseMacro = function', 'SCRIPT_EXTENSIONS.push(baseMacro);');
});

// Serialize data through JSON.parse inside the vm so arrays are vm-realm Arrays,
// avoiding instanceof Array failures when crossing the vm context boundary.
function vmParse (data) {
	ctx.__vmTestInput = JSON.stringify(data);
	return vm.runInContext('JSON.parse(__vmTestInput)', ctx);
}

function build (data) {
	return ctx.d20plus.monsters.build2024Store(vmParse(data), ctx.Renderer.get());
}

// Minimal character mock — only what import2024TokenActions/getAttackPositions/
// getSpellDerivedAttacks touch. `attackList` is the set of {name, actionType,
// isSpellDerived?} Attack-type integrants "already in the store" (standing in for
// weapon attacks from build2024Store plus any spell-derived attacks import2024Spells
// would have added by the time this real code path runs) - isSpellDerived also adds a
// same-named Spell-type integrant, matching how a real spell's Attack mirror is paired.
function makeAbilitiesChar (attackList) {
	const created = [];
	const integrants = {};
	(attackList || []).forEach((i, idx) => {
		integrants[`int${idx}`] = { type: 'Attack', actionType: i.actionType, name: i.name };
		if (i.isSpellDerived) integrants[`spell${idx}`] = { type: 'Spell', name: i.name };
	});
	const storeAttrObj = {
		get: (key) => (key === 'name' ? 'store' : (key === 'current' ? { integrants: { integrants } } : undefined)),
	};
	return {
		abilities: {
			create: (data) => { created.push(data); return { save: () => {} }; },
		},
		attribs: {
			find: (pred) => (pred(storeAttrObj) ? storeAttrObj : undefined),
		},
		_created: created,
	};
}

// The shared test env's d20plus.cfg.getOrDefault returns null for every key by
// default (see helpers/env.js) — override it per-test to control which
// tokenactions* flags read as enabled.
function setFlags (flags) {
	ctx.d20plus.cfg.getOrDefault = (section, key) => {
		if (section !== 'import') return null;
		return Object.prototype.hasOwnProperty.call(flags, key) ? flags[key] : false;
	};
}

const goblin = {
	name: 'Goblin', size: 'S', type: 'humanoid', alignment: ['N'],
	ac: [{ ac: 15 }], hp: { average: 7, formula: '2d6' }, speed: { walk: 30 },
	str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
};

// ---------------------------------------------------------------------------
// build2024Store — __tokenActionMeta
// ---------------------------------------------------------------------------
// Position numbers are NOT computed here (see 5etools-2024-monster-tokenactions.js
// for why) - build2024Store only tags each entry with isAttack (does it have a real
// attack-roll/damage chain at all) and, for non-attack entries, a baked description.
describe('build2024Store — __tokenActionMeta', () => {
	test('records one entry per trait, with a name', () => {
		const store = build({
			...goblin,
			trait: [{ name: 'Nimble Escape', entries: ['Can disengage as a bonus action.'] }],
		});
		expect(store.__tokenActionMeta.traits).toHaveLength(1);
		expect(store.__tokenActionMeta.traits[0].name).toBe('Nimble Escape');
	});

	test('tags attack-type actions with isAttack: true', () => {
		const monster = {
			...goblin,
			action: [
				{ name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6+2}) slashing damage.'] },
				{ name: 'Shortbow', entries: ['{@atk rw} {@hit 4} to hit. {@h}5 ({@damage 1d6+2}) piercing damage.'] },
			],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.actions.map(a => a.isAttack)).toEqual([true, true]);
		expect(store.__tokenActionMeta.actions.map(a => a.name)).toEqual(['Scimitar', 'Shortbow']);
	});

	test('a plain (non-attack) action is tagged isAttack: false, with a baked description', () => {
		const store = build({ ...goblin, action: [{ name: 'Multiattack', entries: ['Makes two attacks.'] }] });
		expect(store.__tokenActionMeta.actions[0]).toMatchObject({ name: 'Multiattack', isAttack: false });
		// The test harness's Renderer stub doesn't fully render plain prose entries - this
		// just confirms a desc field is present at all (import2024TokenActions bakes it).
		expect(typeof store.__tokenActionMeta.actions[0].desc).toBe('string');
	});

	test('spellcasting summary carries a baked description, never a position', () => {
		const monster = {
			...goblin,
			spellcasting: [{ name: 'Spellcasting', headerEntries: ['The goblin casts a spell.'], spells: {} }],
			action: [{ name: 'Bite', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6+2}) piercing damage.'] }],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.spellcasting).toHaveLength(1);
		expect(store.__tokenActionMeta.spellcasting[0]).not.toHaveProperty('pos');
		// The test harness's Renderer stub doesn't fully render "type: spellcasting"
		// headerEntries - this just confirms a desc field is present at all.
		expect(typeof store.__tokenActionMeta.spellcasting[0].desc).toBe('string');
		// Unaffected by spellcasting existing at all - actions are tagged independently.
		expect(store.__tokenActionMeta.actions[0]).toMatchObject({ name: 'Bite', isAttack: true });
	});

	test('spellcasting displayAs "bonus" still produces a baked spellcasting entry', () => {
		const monster = {
			...goblin,
			spellcasting: [{ name: 'Innate Spellcasting', displayAs: 'bonus', headerEntries: ['...'], spells: {} }],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.spellcasting[0]).toMatchObject({ name: 'Innate Spellcasting' });
		expect(store.__tokenActionMeta.spellcasting[0].desc).toBeTruthy();
	});

	test('legendary/mythic/reactions are each tagged isAttack correctly', () => {
		const monster = {
			...goblin,
			legendary: [
				{ name: 'Detect', entries: ['Makes a Wisdom check.'] },
				{ name: 'Attack', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6+2}) slashing damage.'] },
			],
			mythic:   [{ name: 'Mythic Move', entries: ['...'] }],
			reaction: [{ name: 'Parry', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6+2}) slashing damage.'] }],
		};
		const store = build(monster);
		const byName = (arr, name) => arr.find(a => a.name === name);
		expect(byName(store.__tokenActionMeta.legendaryActions, 'Detect').isAttack).toBe(false);
		expect(byName(store.__tokenActionMeta.legendaryActions, 'Attack').isAttack).toBe(true);
		expect(store.__tokenActionMeta.mythicActions[0].isAttack).toBe(false);
		expect(store.__tokenActionMeta.reactions[0].isAttack).toBe(true);
	});

	test('__tokenActionMeta is present even for a monster with none of these sections', () => {
		const store = build(goblin);
		expect(store.__tokenActionMeta).toMatchObject({
			traits: [], actions: [], bonusActions: [], reactions: [],
			legendaryActions: [], mythicActions: [], spellcasting: [],
		});
	});
});

// ---------------------------------------------------------------------------
// import2024TokenActions
// ---------------------------------------------------------------------------
describe('import2024TokenActions', () => {
	// Matches the Attack-type integrants makeAbilitiesChar(defaultAttacks) puts in the
	// mock store: Bite/Claw as "Action" attacks, Parry as a "Reaction" attack, and
	// "Attack" (only) as a "Legendary" attack - Detect stays a plain (baked) legendary.
	// "Command" is a spell-derived Attack (paired with a same-named Spell integrant),
	// like Command/Crown of Madness on a real Bone Knight.
	const defaultAttacks = [
		{ name: 'Bite', actionType: 'Action' },
		{ name: 'Claw', actionType: 'Action' },
		{ name: 'Parry', actionType: 'Reaction' },
		{ name: 'Attack', actionType: 'Legendary' },
		{ name: 'Command', actionType: 'Action', isSpellDerived: true },
	];

	function baseMeta () {
		return {
			traits: [{ id: 't1', name: 'Keen Senses', desc: 'Advantage on Perception.' }],
			actions: [
				{ id: 'a1', name: 'Bite', isAttack: true },
				{ id: 'a2', name: 'Claw', isAttack: true },
				{ id: 'a3', name: 'Multiattack', isAttack: false, desc: 'Makes two attacks.' },
			],
			bonusActions: [],
			reactions: [{ id: 'r1', name: 'Parry', isAttack: true }],
			legendaryActions: [
				{ id: 'l1', name: 'Detect', isAttack: false, desc: 'Perception check.' },
				{ id: 'l2', name: 'Attack', isAttack: true },
			],
			mythicActions: [],
			spellcasting: [],
		};
	}

	test('does nothing when tokenActionMeta is falsy', () => {
		setFlags({ tokenactions: true, tokenactionsTraits: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, null, {});
		expect(char._created).toHaveLength(0);
	});

	test('creates one ability per trait, gated by tokenactionsTraits', () => {
		setFlags({ tokenactionsTraits: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});
		expect(char._created).toHaveLength(1);
		// Ability names can't contain spaces on the 2024 sheet (they silently
		// fail to save) — whitespace gets collapsed into hyphens.
		expect(char._created[0]).toMatchObject({ name: 'Keen-Senses', istokenaction: true });
	});

	test('strips "()?/\\" from ability names and collapses resulting stray hyphens', () => {
		setFlags({ tokenactionsTraits: true });
		const char = makeAbilitiesChar();
		const meta = baseMeta();
		meta.traits = [{ id: 't2', name: 'Legendary Resistance (3/Day)', desc: 'x' }];
		ctx.d20plus.monsters.import2024TokenActions(char, meta, {});
		expect(char._created[0].name).toBe('Legendary-Resistance-3Day');
	});

	test('trait macro bakes name/desc text (no live attribute) and whispers to GM', () => {
		setFlags({ tokenactionsTraits: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});
		expect(char._created[0].action).toContain('/w gm');
		expect(char._created[0].action).toContain('Advantage on Perception.');
	});

	test('traits create nothing when tokenactionsTraits is off', () => {
		setFlags({});
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});
		expect(char._created).toHaveLength(0);
	});

	test('attack-type actions/reactions use positional "$N" macro syntax, addressed by live store position', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		const bite = char._created.find(a => a.name === '0-Bite');
		expect(bite.action).toBe('/w gm %{selected|repeating_npcaction_$0_action}');

		const claw = char._created.find(a => a.name === '1-Claw');
		expect(claw.action).toBe('/w gm %{selected|repeating_npcaction_$1_action}');

		const parry = char._created.find(a => a.name === 'Reaction-Parry');
		expect(parry.action).toBe('/w gm %{selected|repeating_npcreaction_$0_action}');
	});

	test('a non-attack action (e.g. Multiattack) is baked as name+description text instead', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		const multi = char._created.find(a => a.name === '2-Multiattack');
		expect(multi.action).toContain('/w gm');
		expect(multi.action).toContain('Makes two attacks.');
		expect(multi.action).not.toContain('repeating_npcaction');
	});

	test('combined Legendary Actions macro links attack-type entries by position and inlines non-attack ones', () => {
		setFlags({ tokenactions: true, tokenactionsExpanded: false });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), { legendaryActionCount: 2 });

		const leg = char._created.find(a => a.name === 'Legendary-Actions');
		expect(leg).toBeDefined();
		// "Attack" is the only Legendary-actionType Attack integrant in the mock store, so it's position 0.
		expect(leg.action).toContain('repeating_npcaction-l_$0_action');
		expect(leg.action).toContain('**Detect.** Perception check.');
		expect(leg.action).toContain('2 legendary actions');
		expect(char._created.some(a => a.name.startsWith('Legendary0'))).toBe(false);
	});

	test('expanded Legendary Actions creates one ability per action, attack-type positional and baked mixed', () => {
		setFlags({ tokenactions: true, tokenactionsExpanded: true });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		expect(char._created.some(a => a.name === 'Legendary-Actions')).toBe(false);

		const detect = char._created.find(a => a.name === 'Legendary0-Detect');
		expect(detect.action).toContain('/w gm');
		expect(detect.action).toContain('Perception check.');

		const atk = char._created.find(a => a.name === 'Legendary1-Attack');
		expect(atk.action).toBe('/w gm %{selected|repeating_npcaction-l_$0_action}');
	});

	test('no Legendary Actions ability at all when the meta array is empty', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar(defaultAttacks);
		const meta = baseMeta();
		meta.legendaryActions = [];
		ctx.d20plus.monsters.import2024TokenActions(char, meta, {});
		expect(char._created.some(a => a.name.includes('Legendary'))).toBe(false);
	});

	test('Skill-Check / Saving Throw / Ability Check / Initiative are static, live-referencing macros', () => {
		setFlags({ tokenactionsSkills: true, tokenactionsSaves: true, tokenactionsChecks: true, tokenactionsInitiative: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		expect(char._created.find(a => a.name === 'Skill-Check').action).toContain('npc_acrobatics');
		expect(char._created.find(a => a.name === 'Saving-Throw').action).toContain('npc_str_save');
		expect(char._created.find(a => a.name === 'Ability-Check').action).toContain('strength_mod');
		expect(char._created.find(a => a.name === 'Initiative').action)
			.toBe('/w gm [[1d20+@{selected|initiative_bonus}]]');
	});

	test('Perception keeps npc_perception live but bakes the senses text', () => {
		setFlags({ tokenactionsPerception: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), { sensesText: 'darkvision 60 ft.' });

		const perc = char._created.find(a => a.name === 'Perception');
		expect(perc.action).toContain('npc_perception');
		expect(perc.action).toContain('darkvision 60 ft.');
	});

	test('DR/Immunities keeps resistance/immunity live but bakes vulnerabilities; Stats bakes languages', () => {
		setFlags({ tokenactionsOther: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {
			vulnerabilitiesText: 'Bludgeoning', languagesText: 'Common',
		});

		const dr = char._created.find(a => a.name === 'DR/Immunities');
		expect(dr.action).toContain('npc_resistances');
		expect(dr.action).toContain('npc_immunities');
		expect(dr.action).toContain('Bludgeoning');

		const stats = char._created.find(a => a.name === 'Stats');
		expect(stats.action).toContain('npc_ac');
		expect(stats.action).toContain('npc_challenge');
		expect(stats.action).toContain('Common');
	});

	test('spellcasting is always baked as name+description text, gated by tokenactionsSpells', () => {
		setFlags({ tokenactionsSpells: true });
		const char = makeAbilitiesChar();
		const meta = baseMeta();
		meta.spellcasting = [{ id: 's1', name: 'Spellcasting', desc: 'The knight is an 8th-level spellcaster.' }];
		ctx.d20plus.monsters.import2024TokenActions(char, meta, {});

		const sc = char._created.find(a => a.name === 'Spellcasting');
		expect(sc.action).toContain('/w gm');
		expect(sc.action).toContain('8th-level spellcaster');
	});

	test('an individual attack/save spell (e.g. Command) gets its own positional token action, gated by tokenactionsSpells', () => {
		setFlags({ tokenactionsSpells: true });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		// Alphabetically among Action-type Attacks: Bite(0), Claw(1), Command(2).
		const cmd = char._created.find(a => a.name === 'Spell-Command');
		expect(cmd).toBeDefined();
		expect(cmd.action).toBe('/w gm %{selected|repeating_npcaction_$2_action}');
	});

	test('spell-derived attacks are not created when tokenactionsSpells is off', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});
		expect(char._created.some(a => a.name.startsWith('Spell-'))).toBe(false);
	});

	test('no abilities are created when every flag is off', () => {
		setFlags({});
		const char = makeAbilitiesChar(defaultAttacks);
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {
			legendaryActionCount: 3, sensesText: 'x', languagesText: 'y', vulnerabilitiesText: 'z',
		});
		expect(char._created).toHaveLength(0);
	});
});
