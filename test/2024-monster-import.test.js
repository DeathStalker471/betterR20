'use strict';

const vm = require('vm');
const { createRoll20Env, load2024FromDist } = require('./helpers/env');

let ctx;

beforeAll(() => {
	const env = createRoll20Env();
	ctx = vm.createContext(env);
	load2024FromDist(ctx);
});

function intsByType (store, type) {
	return Object.values(store.integrants.integrants).filter(i => i.type === type);
}

// Serialize data through JSON.parse inside the vm so arrays are vm-realm Arrays,
// avoiding instanceof Array failures when crossing the vm context boundary.
function vmParse (data) {
	ctx.__vmTestInput = JSON.stringify(data);
	return vm.runInContext('JSON.parse(__vmTestInput)', ctx);
}

// A minimal valid monster data object.
const goblin = {
	name: 'Goblin',
	size: 'S',
	type: 'humanoid',
	alignment: ['N'],
	ac: [{ ac: 15 }],
	hp: { average: 7, formula: '2d6' },
	speed: { walk: 30 },
	str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
};

function build (data) {
	return ctx.d20plus.monsters.build2024Store(vmParse(data), ctx.Renderer.get());
}

// ---------------------------------------------------------------------------
// Store structure
// ---------------------------------------------------------------------------
describe('build2024Store — store structure', () => {
	test('returns all required top-level sections', () => {
		const store = build(goblin);
		for (const key of ['integrants', 'actions', 'attacks', 'spells', 'npc', 'about', 'character', 'hitpoints', 'features']) {
			expect(store).toHaveProperty(key);
		}
	});
});

// ---------------------------------------------------------------------------
// Ability Scores
// ---------------------------------------------------------------------------
describe('build2024Store — Ability Scores', () => {
	test('creates 6 Ability Score integrants', () => {
		expect(intsByType(build(goblin), 'Ability Score')).toHaveLength(6);
	});

	test('maps all six ability scores to their correct values', () => {
		const monster = { ...goblin, str: 20, dex: 16, con: 14, int: 12, wis: 10, cha: 18 };
		const scores  = intsByType(build(monster), 'Ability Score');
		const byAbility = Object.fromEntries(scores.map(s => [s.ability, s.valueFormula.flatValue]));
		expect(byAbility.Strength).toBe(20);
		expect(byAbility.Dexterity).toBe(16);
		expect(byAbility.Constitution).toBe(14);
		expect(byAbility.Intelligence).toBe(12);
		expect(byAbility.Wisdom).toBe(10);
		expect(byAbility.Charisma).toBe(18);
	});

	test('defaults to 10 when an ability score is absent', () => {
		const { str: _, dex: __, ...noStr } = goblin;
		const scores = intsByType(build(noStr), 'Ability Score');
		const byAbility = Object.fromEntries(scores.map(s => [s.ability, s.valueFormula.flatValue]));
		expect(byAbility.Strength).toBe(10);
		expect(byAbility.Dexterity).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Hit Points
// ---------------------------------------------------------------------------
describe('build2024Store — Hit Points', () => {
	test('creates one Hit Points integrant', () => {
		expect(intsByType(build(goblin), 'Hit Points')).toHaveLength(1);
	});

	test('reads HP from hp.average', () => {
		const store = build({ ...goblin, hp: { average: 52 } });
		expect(intsByType(store, 'Hit Points')[0].valueFormula.flatValue).toBe(52);
	});

	test('sets store.hitpoints.currentHP to hp.average', () => {
		const store = build({ ...goblin, hp: { average: 45 } });
		expect(store.hitpoints.currentHP).toBe(45);
	});

	test('defaults to 10 when hp is absent', () => {
		const { hp: _, ...noHp } = goblin;
		const store = build(noHp);
		expect(intsByType(store, 'Hit Points')[0].valueFormula.flatValue).toBe(10);
	});

	test('stores hp.formula in store.npc.rollHP (spaces stripped)', () => {
		const store = build({ ...goblin, hp: { average: 15, formula: '3d6 + 3' } });
		expect(store.npc.rollHP).toBe('3d6+3');
	});
});

// ---------------------------------------------------------------------------
// Armor Class
// ---------------------------------------------------------------------------
describe('build2024Store — Armor Class', () => {
	test('creates one Armor Class integrant', () => {
		expect(intsByType(build(goblin), 'Armor Class')).toHaveLength(1);
	});

	test('reads AC from the first element of an array', () => {
		const store = build({ ...goblin, ac: [{ ac: 18 }] });
		expect(intsByType(store, 'Armor Class')[0].valueFormula.flatValue).toBe(18);
	});

	test('reads plain numeric AC', () => {
		const store = build({ ...goblin, ac: [13] });
		expect(intsByType(store, 'Armor Class')[0].valueFormula.flatValue).toBe(13);
	});
});

// ---------------------------------------------------------------------------
// Characteristics
// ---------------------------------------------------------------------------
describe('build2024Store — characteristics', () => {
	test('stores creature type on about.characteristics', () => {
		const store = build({ ...goblin, type: 'undead' });
		expect(store.about.characteristics.creatureType).toBe('Undead');
	});

	test('stores size on about.characteristics', () => {
		const store = build(goblin);
		expect(store.about.characteristics.size).toBe('Small');
	});

	test('stores CR string on npc.challengeRating', () => {
		const store = build({ ...goblin, cr: '5' });
		expect(store.npc.challengeRating).toBe('5');
	});

	test('stores fractional CR correctly', () => {
		const store = build({ ...goblin, cr: '1/2' });
		expect(store.npc.challengeRating).toBe('1/2');
	});

	test('defaults CR to "0" when absent', () => {
		const store = build(goblin);
		expect(store.npc.challengeRating).toBe('0');
	});
});

// ---------------------------------------------------------------------------
// Speeds
// ---------------------------------------------------------------------------
describe('build2024Store — speeds', () => {
	test('creates a Walking Speed integrant', () => {
		const speeds = intsByType(build(goblin), 'Speed');
		expect(speeds.some(s => s.name === 'Walking')).toBe(true);
	});

	test('walk speed value matches speed.walk', () => {
		const store = build({ ...goblin, speed: { walk: 40 } });
		const walk  = intsByType(store, 'Speed').find(s => s.name === 'Walking');
		expect(walk.valueFormula.flatValue).toBe(40);
	});

	test('creates Speed integrants for fly and swim', () => {
		const store  = build({ ...goblin, speed: { walk: 30, fly: 60, swim: 40 } });
		const speeds = intsByType(store, 'Speed');
		const byType = Object.fromEntries(speeds.map(s => [s.name, s.valueFormula.flatValue]));
		expect(byType.Walking).toBe(30);
		expect(byType.Flying).toBe(60);
		expect(byType.Swimming).toBe(40);
	});

	test('creates Speed integrants for climb and burrow', () => {
		const store = build({ ...goblin, speed: { climb: 20, burrow: 10 } });
		const names = intsByType(store, 'Speed').map(s => s.name);
		expect(names).toContain('Climbing');
		expect(names).toContain('Burrowing');
	});

	test('defaults to Walking 30 when speed is absent', () => {
		const { speed: _, ...noSpeed } = goblin;
		const speeds = intsByType(build(noSpeed), 'Speed');
		expect(speeds).toHaveLength(1);
		expect(speeds[0]).toMatchObject({ name: 'Walking', valueFormula: { flatValue: 30 } });
	});
});

// ---------------------------------------------------------------------------
// Senses
// ---------------------------------------------------------------------------
describe('build2024Store — senses', () => {
	test('creates no Sense integrants when senses is absent', () => {
		expect(intsByType(build(goblin), 'Sense')).toHaveLength(0);
	});

	test('creates a Darkvision Sense integrant', () => {
		const store = build({ ...goblin, senses: ['darkvision 60 ft.'] });
		const senses = intsByType(store, 'Sense');
		expect(senses).toHaveLength(1);
		expect(senses[0]).toMatchObject({ name: 'Darkvision', valueFormula: { flatValue: 60 } });
	});

	test('creates multiple Sense integrants for multiple senses', () => {
		const store  = build({ ...goblin, senses: ['darkvision 120 ft.', 'tremorsense 30 ft.'] });
		const senses = intsByType(store, 'Sense');
		const byName = Object.fromEntries(senses.map(s => [s.name, s.valueFormula.flatValue]));
		expect(byName.Darkvision).toBe(120);
		expect(byName.Tremorsense).toBe(30);
	});

	test('creates Blindsight and Truesight Sense integrants', () => {
		const store = build({ ...goblin, senses: ['blindsight 30 ft.', 'truesight 60 ft.'] });
		const names = intsByType(store, 'Sense').map(s => s.name);
		expect(names).toContain('Blindsight');
		expect(names).toContain('Truesight');
	});
});

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
describe('build2024Store — languages', () => {
	test('creates no Language integrants when languages is absent', () => {
		expect(intsByType(build(goblin), 'Language')).toHaveLength(0);
	});

	test('creates Language integrants from a language array', () => {
		const store = build({ ...goblin, languages: ['Common', 'Goblin'] });
		const langs = intsByType(store, 'Language').map(l => l.name);
		expect(langs).toContain('Common');
		expect(langs).toContain('Goblin');
	});

	test('creates Language integrants from a comma-separated string', () => {
		const store = build({ ...goblin, languages: 'Common, Goblin' });
		const langs = intsByType(store, 'Language').map(l => l.name);
		expect(langs).toContain('Common');
		expect(langs).toContain('Goblin');
	});
});

// ---------------------------------------------------------------------------
// Defenses
// ---------------------------------------------------------------------------
describe('build2024Store — defenses', () => {
	test('creates Resistance Defense integrants', () => {
		const store = build({ ...goblin, resist: ['fire', 'cold'] });
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Resistance');
		expect(defs.length).toBeGreaterThan(0);
	});

	test('creates Immunity Defense integrants', () => {
		const store = build({ ...goblin, immune: ['poison'] });
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Immunity');
		expect(defs.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Traits (Features)
// ---------------------------------------------------------------------------
describe('build2024Store — traits', () => {
	test('creates Features integrants from monster traits', () => {
		const monster = {
			...goblin,
			trait: [
				{ name: 'Pack Tactics', entries: ['Advantage when ally is adjacent.'] },
				{ name: 'Keen Senses', entries: ['Advantage on Perception.'] },
			],
		};
		const features = intsByType(build(monster), 'Features');
		const names    = features.map(f => f.name);
		expect(names).toContain('Pack Tactics');
		expect(names).toContain('Keen Senses');
	});

	test('trait IDs appear in speciesTraitsDisplayOrder', () => {
		const monster = { ...goblin, trait: [{ name: 'Rampage', entries: ['Make a bite attack.'] }] };
		const store   = build(monster);
		const order   = JSON.parse(store.features.speciesTraitsDisplayOrder);
		expect(order).toHaveLength(1);
	});

	test('creates no Features integrants when traits are absent', () => {
		const store = build(goblin);
		expect(intsByType(store, 'Features')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// arrayPosition uniqueness
// ---------------------------------------------------------------------------
describe('build2024Store — arrayPosition', () => {
	test('all integrant arrayPositions are unique', () => {
		const monster = {
			...goblin,
			senses:  ['darkvision 60 ft.'],
			languages: ['Common'],
			trait:   [{ name: 'Pack Tactics', entries: ['Advantage.'] }],
		};
		const store     = build(monster);
		const positions = Object.values(store.integrants.integrants).map(i => i.arrayPosition);
		expect(new Set(positions).size).toBe(positions.length);
	});

	test('arrayPositions start at 100', () => {
		const positions = Object.values(build(goblin).integrants.integrants).map(i => i.arrayPosition);
		expect(Math.min(...positions)).toBe(100);
	});
});
