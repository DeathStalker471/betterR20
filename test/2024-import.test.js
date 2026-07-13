'use strict';
const vm = require('vm');
const { createRoll20Env, load2024FromDist, makeCharModel, makeBatchStore } = require('./helpers/env');

// Shared vm context — loaded once for the whole suite.
let ctx;

beforeAll(() => {
	const env = createRoll20Env();
	ctx = vm.createContext(env);
	load2024FromDist(ctx);
});

// ---------------------------------------------------------------------------
// Sheet detection
// ---------------------------------------------------------------------------
describe('Sheet detection', () => {
	test('is2024Sheet returns true for all known 2024 sheet keys', () => {
		expect(ctx.d20plus.importer.is2024Sheet('dnd_2024')).toBe(true);
		expect(ctx.d20plus.importer.is2024Sheet('DnD2024_Character_Sheet')).toBe(true);
		expect(ctx.d20plus.importer.is2024Sheet('dnd2024')).toBe(true);
		expect(ctx.d20plus.importer.is2024Sheet('dnd2024byroll20')).toBe(true);
	});

	test('is2024Sheet returns false for non-2024 sheets', () => {
		expect(ctx.d20plus.importer.is2024Sheet('ogl5e')).toBe(false);
		expect(ctx.d20plus.importer.is2024Sheet('shaped_d20')).toBe(false);
		expect(ctx.d20plus.importer.is2024Sheet('')).toBe(false);
	});

	test('shouldUse2024 reflects the cfg importSheetFormat setting', () => {
		// env mock returns 'dnd_2024' for importSheetFormat → should be true
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// OGL → 2024 store translation
// ---------------------------------------------------------------------------
describe('OGL → 2024 translation (translateOGLTo2024Store)', () => {
	function attrib (name, current, max) {
		return { name, current, max: max !== undefined ? max : '' };
	}

	test('maps all six ability scores', () => {
		const attribs = [
			attrib('strength', '18'), attrib('dexterity', '14'),
			attrib('constitution', '16'), attrib('intelligence', '10'),
			attrib('wisdom', '12'), attrib('charisma', '8'),
		];
		const store  = ctx.d20plus.importer.translateOGLTo2024Store(attribs);
		const scores = Object.values(store.integrants.integrants).filter(i => i.type === 'Ability Score');
		expect(scores).toHaveLength(6);
		expect(scores.find(i => i.ability === 'Strength').valueFormula.flatValue).toBe(18);
		expect(scores.find(i => i.ability === 'Charisma').valueFormula.flatValue).toBe(8);
	});

	test('reads HP from the max field of the hp attribute', () => {
		const store = ctx.d20plus.importer.translateOGLTo2024Store([attrib('hp', '20', '45')]);
		const hp    = Object.values(store.integrants.integrants).find(i => i.type === 'Hit Points');
		expect(hp).toBeDefined();
		expect(hp.valueFormula.flatValue).toBe(45);
		expect(store.hitpoints.currentHP).toBe(45);
	});

	test('maps npc_ac to an Armor Class integrant', () => {
		const store = ctx.d20plus.importer.translateOGLTo2024Store([attrib('npc_ac', '17')]);
		const ac    = Object.values(store.integrants.integrants).find(i => i.type === 'Armor Class');
		expect(ac).toBeDefined();
		expect(ac.valueFormula.flatValue).toBe(17);
	});

	test('maps npc_challenge to store.npc.challengeRating', () => {
		const store = ctx.d20plus.importer.translateOGLTo2024Store([attrib('npc_challenge', '5')]);
		expect(store.npc.challengeRating).toBe('5');
	});

	test('parses multi-speed npc_speed into Speed integrants', () => {
		const store  = ctx.d20plus.importer.translateOGLTo2024Store([attrib('npc_speed', '40 ft., fly 60 ft.')]);
		const speeds = Object.values(store.integrants.integrants).filter(i => i.type === 'Speed');
		expect(speeds.find(s => s.name === 'Walking' && s.valueFormula.flatValue === 40)).toBeDefined();
		expect(speeds.find(s => s.name === 'Flying'  && s.valueFormula.flatValue === 60)).toBeDefined();
	});

	test('creates Sense integrants for darkvision in npc_senses', () => {
		const store  = ctx.d20plus.importer.translateOGLTo2024Store([attrib('npc_senses', 'darkvision 60 ft.')]);
		const senses = Object.values(store.integrants.integrants).filter(i => i.type === 'Sense');
		expect(senses.find(s => s.name === 'Darkvision' && s.valueFormula.flatValue === 60)).toBeDefined();
	});

	test('creates Defense integrants for resistances and immunities', () => {
		const store    = ctx.d20plus.importer.translateOGLTo2024Store([
			attrib('npc_resistances', 'fire, cold'),
			attrib('npc_immunities',  'poison'),
		]);
		const defenses = Object.values(store.integrants.integrants).filter(i => i.type === 'Defense');
		expect(defenses.filter(d => d.defense === 'Resistance')).toHaveLength(2);
		expect(defenses.filter(d => d.defense === 'Immunity')).toHaveLength(1);
	});

	test('maps a melee repeating action with attack flag to an Attack integrant', () => {
		const attribs = [
			attrib('repeating_npcaction_abc_name',           'Claw'),
			attrib('repeating_npcaction_abc_attack_flag',    'on'),
			attrib('repeating_npcaction_abc_attack_damage',  '2d6'),
			attrib('repeating_npcaction_abc_attack_damagetype', 'slashing'),
			attrib('repeating_npcaction_abc_attack_type',    'melee'),
		];
		const store  = ctx.d20plus.importer.translateOGLTo2024Store(attribs);
		const attack = Object.values(store.integrants.integrants).find(i => i.type === 'Attack' && i.name === 'Claw');
		expect(attack).toBeDefined();
		expect(attack.attack.type).toBe('Melee');
	});

	test('maps a non-attack action to an Action integrant', () => {
		const attribs = [
			attrib('repeating_npcaction_xyz_name',        'Frightful Presence'),
			attrib('repeating_npcaction_xyz_description', 'Each creature...'),
		];
		const store  = ctx.d20plus.importer.translateOGLTo2024Store(attribs);
		const action = Object.values(store.integrants.integrants).find(i => i.type === 'Action' && i.name === 'Frightful Presence');
		expect(action).toBeDefined();
	});

	test('maps legendary actions', () => {
		const attribs = [
			attrib('repeating_npcaction-l_leg1_name',        'Detect'),
			attrib('repeating_npcaction-l_leg1_description', 'The dragon...'),
		];
		const store = ctx.d20plus.importer.translateOGLTo2024Store(attribs);
		const leg   = Object.values(store.integrants.integrants).find(i => i.actionType === 'Legendary');
		expect(leg).toBeDefined();
		expect(leg.name).toBe('Detect');
	});
});

// ---------------------------------------------------------------------------
// Monster store builder
// ---------------------------------------------------------------------------
describe('Monster store builder (build2024Store)', () => {
	const renderer = {
		render:          (e) => (typeof e === 'string' ? e : ''),
		recursiveRender: () => {},
	};

	const base = {
		name:      'Test Dragon',
		str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19,
		hp:        { average: 195, formula: '17d12+85' },
		ac:        [{ ac: 19 }],
		cr:        '17',
		size:      ['H'],
		type:      { type: 'dragon' },
		speed:     { walk: 40, fly: 80, swim: 40 },
		alignment: ['L', 'G'],
	};

	function ints (store) { return Object.values(store.integrants.integrants); }

	test('creates all six ability score integrants', () => {
		const store  = ctx.d20plus.monsters.build2024Store(base, renderer);
		const scores = ints(store).filter(i => i.type === 'Ability Score');
		expect(scores).toHaveLength(6);
		expect(scores.find(i => i.ability === 'Strength').valueFormula.flatValue).toBe(23);
		expect(scores.find(i => i.ability === 'Dexterity').valueFormula.flatValue).toBe(10);
	});

	test('creates HP integrant using hp.average', () => {
		const store = ctx.d20plus.monsters.build2024Store(base, renderer);
		const hp    = ints(store).find(i => i.type === 'Hit Points');
		expect(hp).toBeDefined();
		expect(hp.valueFormula.flatValue).toBe(195);
		expect(store.hitpoints.currentHP).toBe(195);
	});

	test('creates Armor Class integrant', () => {
		const store = ctx.d20plus.monsters.build2024Store(base, renderer);
		const ac    = ints(store).find(i => i.type === 'Armor Class');
		expect(ac).toBeDefined();
		expect(ac.valueFormula.flatValue).toBe(19);
	});

	test('creates Speed integrants for walk, fly, swim', () => {
		const store  = ctx.d20plus.monsters.build2024Store(base, renderer);
		const speeds = ints(store).filter(i => i.type === 'Speed');
		expect(speeds.find(s => s.name === 'Walking' && s.valueFormula.flatValue === 40)).toBeDefined();
		expect(speeds.find(s => s.name === 'Flying'  && s.valueFormula.flatValue === 80)).toBeDefined();
		expect(speeds.find(s => s.name === 'Swimming' && s.valueFormula.flatValue === 40)).toBeDefined();
	});

	test('sets challenge rating on store.npc', () => {
		const store = ctx.d20plus.monsters.build2024Store(base, renderer);
		expect(store.npc.challengeRating).toBe('17');
	});

	test('creates a Sense integrant for darkvision', () => {
		// Pass senses as a string to avoid cross-realm instanceof Array issues in the vm context.
		const monster = { ...base, senses: 'darkvision 120 ft.' };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const dv      = ints(store).find(i => i.type === 'Sense' && i.name === 'Darkvision');
		expect(dv).toBeDefined();
		expect(dv.valueFormula.flatValue).toBe(120);
	});

	test('creates Proficiency integrants for saving throws', () => {
		const monster = { ...base, save: { str: '+9', con: '+11' } };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const saves   = ints(store).filter(i => i.type === 'Proficiency' && i.category === 'Saving Throw');
		expect(saves).toHaveLength(2);
	});

	test('creates Proficiency integrants for skills', () => {
		const monster = { ...base, skill: { Perception: '+8', Stealth: '+6' } };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const skills  = ints(store).filter(i => i.type === 'Proficiency' && i.category === 'Skill');
		expect(skills).toHaveLength(2);
	});

	test('creates Defense integrants for resistances', () => {
		const monster     = { ...base, resist: ['fire', 'cold'] };
		const store       = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const resistances = ints(store).filter(i => i.type === 'Defense' && i.defense === 'Resistance');
		expect(resistances.length).toBeGreaterThanOrEqual(2);
	});

	test('creates Defense integrants for condition immunities', () => {
		const monster    = { ...base, conditionImmune: ['frightened', 'charmed'] };
		const store      = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const conditions = ints(store).filter(i => i.type === 'Defense' && i.defense === 'Condition Immunity');
		expect(conditions).toHaveLength(2);
	});

	test('creates Action integrant for non-attack actions', () => {
		const monster = { ...base, action: [{ name: 'Multiattack', entries: ['The dragon makes three attacks.'] }] };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		expect(ints(store).find(i => i.name === 'Multiattack')).toBeDefined();
	});

	test('creates Attack + Damage integrants for attack actions', () => {
		const monster = {
			...base,
			action: [{
				name:    'Bite',
				entries: [
					'{@atkr m} {@hit 14} to hit, reach 10 ft., one target. {@h}19 ({@damage 2d10+8}) piercing damage.',
				],
			}],
		};
		const store = ctx.d20plus.monsters.build2024Store(monster, renderer);
		expect(ints(store).find(i => i.type === 'Attack' && i.name === 'Bite')).toBeDefined();
		expect(ints(store).find(i => i.type === 'Damage')).toBeDefined();
	});

	test('creates legendary action integrants', () => {
		const monster = {
			...base,
			legendary:       [{ name: 'Detect', entries: ['The dragon detects...'] }],
			legendaryActions: 3,
		};
		const store = ctx.d20plus.monsters.build2024Store(monster, renderer);
		expect(store.npc.legendaryActionCount).toBe(3);
	});

	test('creates Features integrants for monster traits', () => {
		const monster = {
			...base,
			trait: [
				{ name: 'Pack Tactics', entries: ['The wolf has advantage on attack rolls.'] },
				{ name: 'Keen Smell',   entries: ['The wolf has advantage on Perception checks.'] },
			],
		};
		const store = ctx.d20plus.monsters.build2024Store(monster, renderer);
		expect(ints(store).find(i => i.type === 'Features' && i.name === 'Pack Tactics')).toBeDefined();
		expect(ints(store).find(i => i.type === 'Features' && i.name === 'Keen Smell')).toBeDefined();
	});

	test('creates Action integrants for bonus actions', () => {
		const monster = {
			...base,
			bonus: [{ name: 'Cunning Action', entries: ['The rogue takes the Dash, Disengage, or Hide action.'] }],
		};
		const store  = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const ba     = ints(store).find(i => i.type === 'Action' && i.actionType === 'Bonus Action');
		expect(ba).toBeDefined();
		expect(ba.name).toBe('Cunning Action');
	});

	test('creates Action integrants for reactions', () => {
		const monster = {
			...base,
			reaction: [{ name: 'Parry', entries: ['The knight adds 2 to its AC against one melee attack.'] }],
		};
		const store = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const react = ints(store).find(i => i.type === 'Action' && i.actionType === 'Reaction');
		expect(react).toBeDefined();
		expect(react.name).toBe('Parry');
	});

	test('creates Action integrants for mythic actions', () => {
		const monster = {
			...base,
			mythic: [{ name: 'Mythic Step', entries: ['The creature teleports up to 60 feet.'] }],
		};
		const store  = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const mythic = ints(store).find(i => i.type === 'Action' && i.actionType === 'Mythic');
		expect(mythic).toBeDefined();
		expect(mythic.name).toBe('Mythic Step');
	});

	test('creates an Action integrant for a spellcasting block', () => {
		const monster = {
			...base,
			spellcasting: [{ name: 'Spellcasting', ability: 'int', entries: ['The mage casts spells...'] }],
		};
		const store    = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const scAction = ints(store).find(i => i.type === 'Action' && i.name === 'Spellcasting');
		expect(scAction).toBeDefined();
		expect(scAction.actionType).toBe('Action');
	});

	test('creates Defense integrants for damage immunities', () => {
		const monster = { ...base, immune: ['poison', 'fire'] };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const imms    = ints(store).filter(i => i.type === 'Defense' && i.defense === 'Immunity');
		expect(imms.length).toBeGreaterThanOrEqual(2);
	});

	test('creates Defense integrants for vulnerabilities', () => {
		const monster = { ...base, vulnerable: ['bludgeoning', 'fire'] };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const vulns   = ints(store).filter(i => i.type === 'Defense' && i.defense === 'Vulnerability');
		expect(vulns.length).toBeGreaterThanOrEqual(2);
	});

	test('creates Language integrants from a language string', () => {
		// Pass as string to avoid cross-realm instanceof Array issue in the vm context
		const monster = { ...base, languages: 'Common, Elvish, Draconic' };
		const store   = ctx.d20plus.monsters.build2024Store(monster, renderer);
		const langs   = ints(store).filter(i => i.type === 'Language');
		expect(langs).toHaveLength(3);
		expect(langs.find(l => l.name === 'Common')).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Spell import (batch mode — skips store read/write)
// ---------------------------------------------------------------------------
describe('Spell import (import2024Spell batch mode)', () => {
	const nullModel = { attribs: { find: () => null } };

	test('creates a Spell integrant for a basic levelled spell', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Fireball',
			data: { 'Level': '3', 'Components': 'V, S, M', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '150 feet', 'Duration': 'Instantaneous', 'data-description': '' },
		}, store);
		const spell = Object.values(store.integrants.integrants).find(i => i.type === 'Spell' && i.name === 'Fireball');
		expect(spell).toBeDefined();
		expect(spell.level).toBe(3);
		expect(spell.school).toBe('Evocation');
	});

	test('places spell in the correct displayOrder slot', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Cure Wounds',
			data: { 'Level': '1', 'Components': 'V, S', 'School': 'Abjuration', 'Casting Time': 'Action', 'Range': 'Touch', 'Duration': 'Instantaneous', 'data-description': '' },
		}, store);
		expect(JSON.parse(store.spells.displayOrder[1])).toHaveLength(1);
	});

	test('places a cantrip in slot 0', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Fire Bolt',
			data: { 'Level': 'cantrip', 'Components': 'V, S', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '120 feet', 'Duration': 'Instantaneous', 'data-description': '' },
		}, store);
		expect(JSON.parse(store.spells.displayOrder[0])).toHaveLength(1);
	});

	test('builds Attack + Damage chain for a saving-throw spell with Vetoolscontent', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Fireball',
			data: { 'Level': '3', 'Components': 'V, S, M', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '150 feet', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 3, school: 'V',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 150, type: 'feet' } },
				duration: [{ type: 'instantaneous' }],
				components: { v: true, s: true, m: 'bat guano' },
				savingThrow:  ['dex'],
				damageInflict:['fire'],
				entries: ['A bright streak...', '{@h}8d6 fire damage.'],
				entriesHigherLevel: [],
			},
		}, store);
		const all = Object.values(store.integrants.integrants);
		expect(all.find(i => i.type === 'Spell')).toBeDefined();
		expect(all.find(i => i.type === 'Attack')).toBeDefined();
		expect(all.find(i => i.type === 'Damage')).toBeDefined();
	});

	test('marks the save.onSucceed field when spell deals half on success', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Ice Storm',
			data: { 'Level': '4', 'Components': 'V, S, M', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '300 feet', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 4, school: 'V',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 300, type: 'feet' } },
				duration: [{ type: 'instantaneous' }],
				components: { v: true, s: true, m: 'a pinch of dust' },
				savingThrow:   ['dex'],
				damageInflict: ['cold', 'bludgeoning'],
				entries: ['Hail rains...half as much damage on success. {@h}2d8 cold and 4d6 bludgeoning damage.'],
				entriesHigherLevel: [],
			},
		}, store);
		const attack = Object.values(store.integrants.integrants).find(i => i.type === 'Attack');
		expect(attack && attack.save && attack.save.onSucceed).toBeTruthy();
	});

	test('creates a Healing integrant for a spell with HL miscTag', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Cure Wounds',
			data: { 'Level': '1', 'Components': 'V, S', 'School': 'Abjuration', 'Casting Time': 'Action', 'Range': 'Touch', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 1, school: 'A',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 0, type: 'touch' } },
				duration: [{ type: 'instantaneous' }],
				components: { v: true, s: true },
				miscTags:   ['HL'],
				entries:    ['A creature you touch regains {@heal 1d8} hit points.'],
				entriesHigherLevel: [],
			},
		}, store);
		const heal = Object.values(store.integrants.integrants).find(i => i.type === 'Healing');
		expect(heal).toBeDefined();
		expect(heal.diceCount).toBe(1);
		expect(heal.diceSize).toBe('d8');
		expect(heal.isTemp).toBe(false);
	});

	test('sets isTemp on the Healing integrant for a THP spell', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'False Life',
			data: { 'Level': '1', 'Components': 'V, S, M', 'School': 'Necromancy', 'Casting Time': 'Action', 'Range': 'Self', 'Duration': '1 hour', 'data-description': '' },
			Vetoolscontent: {
				level: 1, school: 'N',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'self' },
				duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }],
				components: { v: true, s: true, m: 'a small amount of alcohol' },
				miscTags:   ['THP'],
				entries:    ['You gain {@dice 1d4+4} temporary hit points.'],
				entriesHigherLevel: [],
			},
		}, store);
		const heal = Object.values(store.integrants.integrants).find(i => i.type === 'Healing');
		expect(heal).toBeDefined();
		expect(heal.isTemp).toBe(true);
	});

	test('creates an Attack with type Spell Attack for a ranged spell attack roll', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Guiding Bolt',
			data: { 'Level': '1', 'Components': 'V, S', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '120 feet', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 1, school: 'V',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 120, type: 'feet' } },
				duration: [{ type: 'instantaneous' }],
				components:    { v: true, s: true },
				spellAttack:   ['R'],
				damageInflict: ['radiant'],
				entries:    ['A flash of light streaks toward a creature. {@h}4d6 {@damage 4d6} radiant damage.'],
				entriesHigherLevel: [],
			},
		}, store);
		const attack = Object.values(store.integrants.integrants).find(i => i.type === 'Attack');
		expect(attack).toBeDefined();
		expect(attack.attack.type).toBe('Spell Attack');
	});

	test('creates only a Spell integrant for a utility spell with no damage, save, or attack', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Mage Armor',
			data: { 'Level': '1', 'Components': 'V, S, M', 'School': 'Abjuration', 'Casting Time': 'Action', 'Range': 'Touch', 'Duration': '8 hours', 'data-description': '' },
			Vetoolscontent: {
				level: 1, school: 'A',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 0, type: 'touch' } },
				duration: [{ type: 'timed', duration: { type: 'hour', amount: 8 } }],
				components: { v: true, s: true, m: 'a piece of cured leather' },
				entries:    ['You touch a willing creature who is not wearing armor...'],
				entriesHigherLevel: [],
			},
		}, store);
		const all = Object.values(store.integrants.integrants);
		expect(all.find(i => i.type === 'Spell')).toBeDefined();
		expect(all.find(i => i.type === 'Attack')).toBeUndefined();
		expect(all.find(i => i.type === 'Damage')).toBeUndefined();
	});

	test('creates multiple Damage integrants for a multi-damage-type spell', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Ice Storm',
			data: { 'Level': '4', 'Components': 'V, S, M', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': '300 feet', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 4, school: 'V',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'point', distance: { amount: 300, type: 'feet' } },
				duration: [{ type: 'instantaneous' }],
				components:    { v: true, s: true, m: 'a pinch of dust' },
				savingThrow:   ['dex'],
				damageInflict: ['cold', 'bludgeoning'],
				entries:    ['Hail rains down in a 20-foot radius. {@h}2d8 {@damage 2d8} cold damage and 4d6 {@damage 4d6} bludgeoning damage.'],
				entriesHigherLevel: [],
			},
		}, store);
		const damages = Object.values(store.integrants.integrants).filter(i => i.type === 'Damage');
		expect(damages.length).toBeGreaterThanOrEqual(2);
		expect(damages.find(d => d.damageType === 'Cold')).toBeDefined();
		expect(damages.find(d => d.damageType === 'Bludgeoning')).toBeDefined();
	});

	test('creates an Upcasting integrant for a spell with scaledamage in entriesHigherLevel', () => {
		const store = makeBatchStore();
		ctx.d20plus.importer.import2024Spell(nullModel, {
			name: 'Burning Hands',
			data: { 'Level': '1', 'Components': 'V, S', 'School': 'Evocation', 'Casting Time': 'Action', 'Range': 'Self', 'Duration': 'Instantaneous', 'data-description': '' },
			Vetoolscontent: {
				level: 1, school: 'V',
				time:     [{ number: 1, unit: 'action' }],
				range:    { type: 'self' },
				duration: [{ type: 'instantaneous' }],
				components:    { v: true, s: true },
				savingThrow:   ['dex'],
				damageInflict: ['fire'],
				entries:    ['A thin sheet of flames shoots forth. {@h}3d6 {@damage 3d6} fire damage.'],
				entriesHigherLevel: [{
					entries: ['The damage increases by {@scaledamage 3d6|1-9|1d6} for each slot level above 1st.'],
				}],
			},
		}, store);
		const upcast = Object.values(store.integrants.integrants).find(i => i.type === 'Upcasting');
		expect(upcast).toBeDefined();
		expect(upcast.value).toBe(1);
		expect(upcast.target).toBe('$.diceCount');
	});
});

// ---------------------------------------------------------------------------
// Item import
// ---------------------------------------------------------------------------
describe('Item import (import2024Item)', () => {
	test('creates an Item integrant for a non-weapon item', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Healing Potion',
			content: '2d4+2 HP.',
			data:    { 'Item Type': 'Potion', 'Weight': '0.5' },
		});
		const item = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Item');
		expect(item).toBeDefined();
		expect(item.name).toBe('Healing Potion');
		expect(item.weight).toBeCloseTo(0.5);
	});

	test('creates Attack + Damage integrants for a melee weapon', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Longsword',
			content: '',
			data:    { 'Item Type': 'Melee Weapon', 'Damage': '1d8', 'Damage Type': 'Slashing', 'Weight': '3' },
			Vetoolscontent: { property: [], weaponCategory: 'martial' },
		});
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.type === 'Attack')).toBeDefined();
		expect(all.find(i => i.type === 'Damage')).toBeDefined();
		expect(all.find(i => i.type === 'Item' && i.name === 'Longsword')).toBeDefined();
	});

	test('creates two Attack pairs for a versatile weapon', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Longsword',
			content: '',
			data:    { 'Item Type': 'Melee Weapon', 'Damage': '1d8', 'Alternate Damage': '1d10', 'Damage Type': 'Slashing', 'Weight': '3' },
			Vetoolscontent: { property: ['V'], weaponCategory: 'martial' },
		});
		const attacks = Object.values(model.getStore().integrants.integrants).filter(i => i.type === 'Attack');
		expect(attacks.length).toBeGreaterThanOrEqual(2);
	});

	test('adds magic bonus to damage integrant', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    '+2 Longsword',
			content: '',
			data:    { 'Item Type': 'Melee Weapon', 'Damage': '1d8', 'Damage Type': 'Slashing', 'Weight': '3' },
			Vetoolscontent: { property: [], weaponCategory: 'martial' },
		});
		const dmg = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Damage');
		expect(dmg._bonus).toBe(2);
	});

	test('creates a Ranged attack with Dexterity ability for a ranged weapon', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Shortbow',
			content: '',
			data:    { 'Item Type': 'Ranged Weapon', 'Damage': '1d6', 'Damage Type': 'Piercing', 'Weight': '2' },
			Vetoolscontent: { property: ['A'], weaponCategory: 'simple' },
		});
		const attack = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Attack');
		expect(attack).toBeDefined();
		expect(attack.attack.type).toBe('Ranged');
		expect(attack.attack.abilityBonus).toBe('Dexterity');
	});

	test('creates an extra Finesse attack pair with Dexterity for weapons with Finesse', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Rapier',
			content: '',
			data:    { 'Item Type': 'Melee Weapon', 'Damage': '1d8', 'Damage Type': 'Piercing', 'Weight': '2' },
			Vetoolscontent: { property: ['F'], weaponCategory: 'martial' },
		});
		const attacks = Object.values(model.getStore().integrants.integrants).filter(i => i.type === 'Attack');
		// One normal STR/Melee attack + one Finesse DEX attack
		expect(attacks.length).toBeGreaterThanOrEqual(2);
		expect(attacks.find(a => a.attack && a.attack.abilityBonus === 'Dexterity')).toBeDefined();
	});

	test('creates an Item integrant with no Attack or Damage for armor', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Item(model, {
			name:    'Chain Mail',
			content: '',
			data:    { 'Item Type': 'Heavy Armor', 'Weight': '55' },
			Vetoolscontent: {},
		});
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.type === 'Item' && i.name === 'Chain Mail')).toBeDefined();
		expect(all.find(i => i.type === 'Attack')).toBeUndefined();
		expect(all.find(i => i.type === 'Damage')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Feat import
// ---------------------------------------------------------------------------
describe('Feat import (import2024Feat)', () => {
	test('creates a Features integrant tagged as Feat', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, {
			name:           'Alert',
			Vetoolscontent: 'You gain a +5 bonus to initiative.',
		});
		const feat = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Features' && i.name === 'Alert');
		expect(feat).toBeDefined();
		expect(feat.source).toBe('Feat');
		expect(feat.description).toBe('You gain a +5 bonus to initiative.');
	});

	test('adds the feat id to featsDisplayOrder', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, { name: 'War Caster', Vetoolscontent: 'Concentration advantage.' });
		const order = JSON.parse(model.getStore().features.featsDisplayOrder);
		expect(order).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Race import (import2024Race)
// ---------------------------------------------------------------------------
describe('Race import (import2024Race)', () => {
	test('creates a Species integrant with the race name', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: { name: 'Elf', size: ['M'], speed: 30, entries: [] },
		});
		const species = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Species');
		expect(species).toBeDefined();
		expect(species.name).toBe('Elf');
	});

	test('creates Speed and Size child integrants with correct values', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: { name: 'Dwarf', size: ['M'], speed: 25, entries: [] },
		});
		const all   = Object.values(model.getStore().integrants.integrants);
		const speed = all.find(i => i.type === 'Speed');
		const size  = all.find(i => i.type === 'Size');
		expect(speed).toBeDefined();
		expect(speed.valueFormula.flatValue).toBe(25);
		expect(size).toBeDefined();
		expect(size.size).toBe('Medium');
	});

	test('creates Features integrants from race.entries', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: {
				name: 'Half-Elf', size: ['M'], speed: 30,
				entries: [
					{ name: 'Fey Ancestry',      entries: ['You have advantage...'] },
					{ name: 'Skill Versatility', entries: ['You gain proficiency...'] },
				],
			},
		});
		const features = Object.values(model.getStore().integrants.integrants).filter(i => i.type === 'Features');
		expect(features).toHaveLength(2);
		expect(features.find(f => f.name === 'Fey Ancestry')).toBeDefined();
	});

	test('creates Darkvision Sense as child of a darkvision entry', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: {
				name: 'Elf', size: ['M'], speed: 30, darkvision: 60,
				entries: [{ name: 'Darkvision', entries: ['You can see in dim light...'] }],
			},
		});
		const all   = Object.values(model.getStore().integrants.integrants);
		const sense = all.find(i => i.type === 'Sense' && i.name === 'Darkvision');
		expect(sense).toBeDefined();
		expect(sense.valueFormula.flatValue).toBe(60);
		// Sense should be a child of the Darkvision feature (shortID === the map key)
		const dvFeature = all.find(i => i.type === 'Features' && i.name === 'Darkvision');
		expect(JSON.parse(dvFeature.childIDs)).toContain(sense.shortID);
	});

	test('creates standalone Darkvision feature when not present in entries', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: { name: 'Tiefling', size: ['M'], speed: 30, darkvision: 60, entries: [] },
		});
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.type === 'Features' && i.name === 'Darkvision')).toBeDefined();
		expect(all.find(i => i.type === 'Sense'    && i.name === 'Darkvision')).toBeDefined();
	});

	test('adds species feature IDs to speciesTraitsDisplayOrder', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {
			Vetoolscontent: {
				name: 'Gnome', size: ['S'], speed: 25,
				entries: [
					{ name: 'Gnome Cunning', entries: ['You have advantage...'] },
					{ name: 'Gift of the Gems', entries: ['You know a cantrip...'] },
				],
			},
		});
		const order = JSON.parse(model.getStore().features.speciesTraitsDisplayOrder);
		expect(order).toHaveLength(2);
	});

	test('returns early without error when Vetoolscontent is absent', () => {
		const model = makeCharModel();
		expect(() => ctx.d20plus.importer.import2024Race(model, {})).not.toThrow();
		expect(Object.keys(model.getStore().integrants.integrants)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Class import (import2024Class)
// ---------------------------------------------------------------------------
describe('Class import (import2024Class)', () => {
	const FIGHTER = {
		name: 'Fighter',
		hd:   { faces: 10 },
		classFeatures: [
			[{ name: 'Second Wind', entries: ['You can use a bonus action...'] }],
			[
				{ name: 'Action Surge', entries: ['You can push yourself...'] },
				{ name: 'Ability Score Improvement', entries: [] },
			],
			[{ name: 'Martial Archetype', entries: [], gainSubclassFeature: true }],
		],
	};

	const WIZARD = {
		name: 'Wizard',
		hd:   { faces: 6 },
		spellcastingAbility: 'int',
		casterProgression:   'full',
		classFeatures: [
			[{ name: 'Spellcasting', entries: ['As a student of arcane magic...'] }],
		],
		classTableGroups: [{
			rowsSpellProgression: [
				[2, 0, 0, 0, 0, 0, 0, 0, 0],
			],
		}],
	};

	beforeEach(() => {
		ctx.prompt = jest.fn().mockReturnValue('3');
	});

	afterEach(() => {
		ctx.prompt = () => '1';
	});

	test('creates a Class integrant with the class name', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const cls = Object.values(model.getStore().integrants.integrants).find(i => i.type === 'Class');
		expect(cls).toBeDefined();
		expect(cls.name).toBe('Fighter');
	});

	test('creates one Class Level integrant per level up to the prompted level', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const levels = Object.values(model.getStore().integrants.integrants).filter(i => i.type === 'Class Level');
		expect(levels).toHaveLength(3);
		expect(levels.find(l => l.level === 1)).toBeDefined();
		expect(levels.find(l => l.level === 3)).toBeDefined();
	});

	test('creates Hit Dice and Hit Points integrants for each level', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.filter(i => i.type === 'Hit Dice')).toHaveLength(3);
		expect(all.filter(i => i.type === 'Hit Points')).toHaveLength(3);
	});

	test('sets level-1 HP to full die value and subsequent levels to average', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const hpInts = Object.values(model.getStore().integrants.integrants)
			.filter(i => i.type === 'Hit Points')
			.sort((a, b) => a.arrayPosition - b.arrayPosition);
		// Level 1: isFixed true, flatValue = faces (10)
		expect(hpInts[0].isFixed).toBe(true);
		expect(hpInts[0].valueFormula.flatValue).toBe(10);
		// Level 2+: isFixed false, flatValue = average of d10 = ceil((10+1)/2) = 6
		expect(hpInts[1].isFixed).toBe(false);
		expect(hpInts[1].valueFormula.flatValue).toBe(6);
	});

	test('creates Features integrants for regular class features', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.type === 'Features' && i.name === 'Second Wind')).toBeDefined();
		expect(all.find(i => i.type === 'Features' && i.name === 'Action Surge')).toBeDefined();
	});

	test('skips Ability Score Improvement and gainSubclassFeature entries', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.name === 'Ability Score Improvement')).toBeUndefined();
		expect(all.find(i => i.name === 'Martial Archetype')).toBeUndefined();
	});

	test('creates Spellcasting subtree for a caster class', async () => {
		ctx.prompt.mockReturnValue('1');
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: WIZARD });
		const all = Object.values(model.getStore().integrants.integrants);
		expect(all.find(i => i.type === 'Spellcasting')).toBeDefined();
		expect(all.find(i => i.type === 'Rest Display')).toBeDefined();
		expect(all.find(i => i.type === 'Spell Slot')).toBeDefined();
	});

	test('adds feature IDs to classFeatureDisplayOrder', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		const order = JSON.parse(model.getStore().features.classFeatureDisplayOrder);
		expect(order.length).toBeGreaterThan(0);
	});

	test('returns early without error when prompt returns null (user cancels)', async () => {
		ctx.prompt.mockReturnValue(null);
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, { Vetoolscontent: FIGHTER });
		expect(Object.keys(model.getStore().integrants.integrants)).toHaveLength(0);
	});

	test('returns early without error when Vetoolscontent is absent', async () => {
		const model = makeCharModel();
		await ctx.d20plus.importer.import2024Class(model, {});
		expect(Object.keys(model.getStore().integrants.integrants)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Import router
// ---------------------------------------------------------------------------
describe('Import router (import2024Data)', () => {
	function route (category, fallback = jest.fn()) {
		const charModel = {};
		ctx.d20plus.importer.import2024Data({ model: charModel }, { data: { Category: category } }, 'event', fallback);
		return { charModel, fallback };
	}

	test('routes Spells to import2024Spell', () => {
		const spy = jest.spyOn(ctx.d20plus.importer, 'import2024Spell').mockImplementation(() => {});
		route('Spells');
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test('routes Items to import2024Item', () => {
		const spy = jest.spyOn(ctx.d20plus.importer, 'import2024Item').mockImplementation(() => {});
		route('Items');
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test('routes Classes to import2024Class', () => {
		const spy = jest.spyOn(ctx.d20plus.importer, 'import2024Class').mockImplementation(() => {});
		route('Classes');
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test('routes Races to import2024Race', () => {
		const spy = jest.spyOn(ctx.d20plus.importer, 'import2024Race').mockImplementation(() => {});
		route('Races');
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test('routes Feats to import2024Feat', () => {
		const spy = jest.spyOn(ctx.d20plus.importer, 'import2024Feat').mockImplementation(() => {});
		route('Feats');
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	test('calls importDataFallback for unhandled categories', () => {
		const { fallback } = route('Backgrounds');
		expect(fallback).toHaveBeenCalledTimes(1);
	});
});
