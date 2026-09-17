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

// Minimal character mock — only what import2024TokenActions touches.
function makeAbilitiesChar () {
	const created = [];
	return {
		abilities: {
			create: (data) => { created.push(data); return { save: () => {} }; },
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
describe('build2024Store — __tokenActionMeta', () => {
	test('records one entry per trait, with a name', () => {
		const store = build({
			...goblin,
			trait: [{ name: 'Nimble Escape', entries: ['Can disengage as a bonus action.'] }],
		});
		expect(store.__tokenActionMeta.traits).toHaveLength(1);
		expect(store.__tokenActionMeta.traits[0].name).toBe('Nimble Escape');
	});

	test('assigns sequential 0-based pos to actions', () => {
		const monster = {
			...goblin,
			action: [
				{ name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 (1d6+2) slashing damage.'] },
				{ name: 'Shortbow', entries: ['{@atk rw} {@hit 4} to hit. {@h}5 (1d6+2) piercing damage.'] },
			],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.actions.map(a => a.pos)).toEqual([0, 1]);
		expect(store.__tokenActionMeta.actions.map(a => a.name)).toEqual(['Scimitar', 'Shortbow']);
	});

	test('a plain (non-attack) action also gets a pos', () => {
		const store = build({ ...goblin, action: [{ name: 'Multiattack', entries: ['Makes two attacks.'] }] });
		expect(store.__tokenActionMeta.actions[0]).toMatchObject({ name: 'Multiattack', pos: 0 });
	});

	test('spellcasting (displayAs "action") shifts subsequent action positions', () => {
		const monster = {
			...goblin,
			spellcasting: [{ name: 'Spellcasting', headerEntries: ['The goblin casts a spell.'], spells: {} }],
			action: [{ name: 'Bite', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 (1d6+2) piercing damage.'] }],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.spellcasting).toHaveLength(1);
		// Alphabetically, "Bite" sorts before "Spellcasting" within the actions
		// category, so Bite gets position 0 and Spellcasting position 1.
		expect(store.__tokenActionMeta.actions[0]).toMatchObject({ name: 'Bite', pos: 0 });
		expect(store.__tokenActionMeta.spellcasting[0]).toMatchObject({ pos: 1, baseAction: 'repeating_npcaction' });
	});

	test('a "bonus"-displayAs spellcasting entry competes for a bonusActions position, not actions', () => {
		const monster = {
			...goblin,
			spellcasting: [{ name: 'Innate Spellcasting', displayAs: 'bonus', headerEntries: ['...'], spells: {} }],
			bonus:  [{ name: 'Extra Attack', entries: ['Make an extra attack.'] }],
			action: [{ name: 'Bite', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 (1d6+2) piercing damage.'] }],
		};
		const store = build(monster);
		// Alphabetically, "Extra Attack" sorts before "Innate Spellcasting".
		expect(store.__tokenActionMeta.bonusActions[0]).toMatchObject({ name: 'Extra Attack', pos: 0 });
		expect(store.__tokenActionMeta.spellcasting[0]).toMatchObject({ pos: 1, baseAction: 'repeating_npcbonusaction' });
		// Unaffected — the spellcasting entry competed in "bonusActions", not "actions".
		expect(store.__tokenActionMeta.actions[0].pos).toBe(0);
	});

	test('a "reaction"-displayAs spellcasting entry consumes a reactions position', () => {
		const monster = {
			...goblin,
			spellcasting: [{ name: 'Reactive Spellcasting', displayAs: 'reaction', headerEntries: ['...'], spells: {} }],
			reaction: [{ name: 'Shield', entries: ['...'] }],
		};
		const store = build(monster);
		expect(store.__tokenActionMeta.spellcasting[0]).toMatchObject({ pos: 0, baseAction: 'repeating_npcreaction' });
		expect(store.__tokenActionMeta.reactions[0].pos).toBe(1);
	});

	test('legendary/mythic/reactions each get their own independent, alphabetically-ordered position space', () => {
		const monster = {
			...goblin,
			legendary: [{ name: 'Detect', entries: ['...'] }, { name: 'Attack', entries: ['...'] }],
			mythic:    [{ name: 'Mythic Move', entries: ['...'] }],
			reaction:  [{ name: 'Parry', entries: ['...'] }],
		};
		const store = build(monster);
		// Alphabetically, "Attack" sorts before "Detect", regardless of the
		// order they were declared/created in.
		const byName = (arr, name) => arr.find(a => a.name === name);
		expect(byName(store.__tokenActionMeta.legendaryActions, 'Attack').pos).toBe(0);
		expect(byName(store.__tokenActionMeta.legendaryActions, 'Detect').pos).toBe(1);
		expect(store.__tokenActionMeta.mythicActions.map(a => a.pos)).toEqual([0]);
		expect(store.__tokenActionMeta.reactions.map(a => a.pos)).toEqual([0]);
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
	function baseMeta () {
		return {
			traits: [{ id: 't1', name: 'Keen Senses', desc: 'Advantage on Perception.' }],
			actions: [{ id: 'a1', name: 'Bite', pos: 0 }, { id: 'a2', name: 'Claw', pos: 1 }],
			bonusActions: [],
			reactions: [{ id: 'r1', name: 'Parry', pos: 0 }],
			legendaryActions: [{ id: 'l1', name: 'Detect', pos: 0 }, { id: 'l2', name: 'Attack', pos: 1 }],
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

	test('actions/reactions use positional "$N" macro syntax, gated by tokenactions', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		const bite = char._created.find(a => a.name === '0-Bite');
		expect(bite.action).toBe('/w gm %{selected|repeating_npcaction_$0_action}');

		const claw = char._created.find(a => a.name === '1-Claw');
		expect(claw.action).toBe('/w gm %{selected|repeating_npcaction_$1_action}');

		const parry = char._created.find(a => a.name === 'Reaction-Parry');
		expect(parry.action).toBe('/w gm %{selected|repeating_npcreaction_$0_action}');
	});

	test('combined Legendary Actions macro references each action by position when not expanded', () => {
		setFlags({ tokenactions: true, tokenactionsExpanded: false });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), { legendaryActionCount: 2 });

		const leg = char._created.find(a => a.name === 'Legendary-Actions');
		expect(leg).toBeDefined();
		expect(leg.action).toContain('repeating_npcaction-l_$0_action');
		expect(leg.action).toContain('repeating_npcaction-l_$1_action');
		expect(leg.action).toContain('2 legendary actions');
		expect(char._created.some(a => a.name.startsWith('Legendary0'))).toBe(false);
	});

	test('expanded Legendary Actions creates one ability per action instead of a combined one', () => {
		setFlags({ tokenactions: true, tokenactionsExpanded: true });
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {});

		expect(char._created.some(a => a.name === 'Legendary0-Detect')).toBe(true);
		expect(char._created.some(a => a.name === 'Legendary1-Attack')).toBe(true);
		expect(char._created.some(a => a.name === 'Legendary-Actions')).toBe(false);
		const first = char._created.find(a => a.name === 'Legendary0-Detect');
		expect(first.action).toBe('/w gm %{selected|repeating_npcaction-l_$0_action}');
	});

	test('no Legendary Actions ability at all when the meta array is empty', () => {
		setFlags({ tokenactions: true });
		const char = makeAbilitiesChar();
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

	test('spellcasting uses the baseAction recorded on its own meta entry', () => {
		setFlags({ tokenactionsSpells: true });
		const char = makeAbilitiesChar();
		const meta = baseMeta();
		meta.spellcasting = [{ id: 's1', name: 'Spellcasting', pos: 2, baseAction: 'repeating_npcbonusaction' }];
		ctx.d20plus.monsters.import2024TokenActions(char, meta, {});

		const sc = char._created.find(a => a.name === 'Spellcasting');
		expect(sc.action).toBe('/w gm %{selected|repeating_npcbonusaction_$2_action}');
	});

	test('no abilities are created when every flag is off', () => {
		setFlags({});
		const char = makeAbilitiesChar();
		ctx.d20plus.monsters.import2024TokenActions(char, baseMeta(), {
			legendaryActionCount: 3, sensesText: 'x', languagesText: 'y', vulnerabilitiesText: 'z',
		});
		expect(char._created).toHaveLength(0);
	});
});
