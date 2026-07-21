'use strict';

const vm = require('vm');
const { createRoll20Env, load2024FromDist, loadCharactermancerFromDist } = require('./helpers/env');

let ctx;

beforeAll(() => {
	const env = createRoll20Env();
	ctx = vm.createContext(env);
	// Load order matters: the Charactermancer's real bootstrap waits for d20plus.spellParsers to
	// exist before injecting, which only happens once the whole main script (including
	// 5etools-2024-spell-import.js, which sets up d20plus.import2024.spellPlan) has already run.
	load2024FromDist(ctx);
	loadCharactermancerFromDist(ctx);
});

function buildRecords (spell) {
	return ctx.d20plus.import2024.charmanBuildSpellRecords(spell);
}

function findRecord (records, name) {
	const rec = records.find(r => r.name === name);
	if (!rec) return undefined;
	return { ...rec, payload: JSON.parse(rec.payload) };
}

describe('Charactermancer spell builder shares the real spellPlan logic', () => {
	test('does not throw - spellPlan is wired up (regression guard for the stale d20plus.spellParsers.* calls)', () => {
		expect(() => buildRecords({
			name: 'Test Spell', level: 1, school: 'V',
			time: [{ number: 1, unit: 'action' }],
			range: { type: 'point', distance: { amount: 30, type: 'feet' } },
			duration: [{ type: 'instant' }],
			components: { v: true },
			entries: ['Nothing interesting happens.'],
		})).not.toThrow();
	});

	test('Flame Blade (XPHB): damage gets ability "auto" from "plus your spellcasting ability modifier"', () => {
		const records = buildRecords({
			name: 'Flame Blade', level: 2, school: 'V',
			time: [{ number: 1, unit: 'bonus' }],
			range: { type: 'point', distance: { type: 'self' } },
			duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }],
			components: { v: true, s: true, m: 'a sumac leaf' },
			damageInflict: ['fire'],
			spellAttack: ['M'],
			entries: ['As a Magic action, you can make a melee spell attack with the fiery blade. On a hit, the target takes Fire damage equal to {@damage 3d6} plus your spellcasting ability modifier.'],
		});

		const dmg = findRecord(records, 'Flame Blade Damage');
		expect(dmg.payload.ability).toBe('auto');
		expect(dmg.payload.diceCount).toBe(3);
		expect(dmg.payload.diceSize).toBe('d6');
	});

	test('Green-Flame Blade: scalingLevelDice produces two separate labeled attack chains, matching import2024Spell', () => {
		const spell = {
			name: 'Green-Flame Blade', level: 0, school: 'V',
			time: [{ number: 1, unit: 'action' }],
			range: { type: 'point', distance: { type: 'self' } },
			duration: [{ type: 'instant' }],
			components: { s: true, m: 'a melee weapon worth at least 1 sp' },
			damageInflict: ['fire'],
			spellAttack: ['M'],
			miscTags: ['SCL'],
			scalingLevelDice: [
				{
					label: 'fire damage to secondary creature',
					scaling: { '1': '{{spellcasting_mod}}', '5': '1d8 + {{spellcasting_mod}}', '11': '2d8 + {{spellcasting_mod}}', '17': '3d8 + {{spellcasting_mod}}' },
				},
				{
					label: 'fire damage on hit',
					scaling: { '5': '1d8', '11': '2d8', '17': '3d8' },
				},
			],
			entries: [
				"You brandish the weapon used in the spell's casting and make a melee attack with it. The second creature takes fire damage equal to your spellcasting ability modifier.",
				'This spell\'s damage increases when you reach certain levels.',
			],
		};
		const records = buildRecords(spell);

		const secondaryDmg = findRecord(records, 'Green-Flame Blade (fire damage to secondary creature) Damage');
		expect(secondaryDmg.payload.ability).toBe('auto');
		expect(secondaryDmg.payload.diceCount).toBeUndefined(); // flat at level 1, no die yet

		const onHitDmg = findRecord(records, 'Green-Flame Blade (fire damage on hit) Damage');
		expect(onHitDmg.payload.ability).toBe('none');
		expect(onHitDmg.payload.diceCount).toBe(1);
		expect(onHitDmg.payload.diceSize).toBe('d8');

		// Upcast at 11/17 only - 5 is already baked into the base value, would double-count otherwise
		const upcastLevels = records
			.filter(r => r.parent === 'Green-Flame Blade (fire damage on hit) Damage')
			.map(r => JSON.parse(r.payload).startingLevel);
		expect(upcastLevels.sort()).toEqual([11, 17]);
	});

	test('Magic Missile: repeat count from "three darts" appears on the Attack record', () => {
		const records = buildRecords({
			name: 'Magic Missile', level: 1, school: 'V',
			time: [{ number: 1, unit: 'action' }],
			range: { type: 'point', distance: { amount: 120, type: 'feet' } },
			duration: [{ type: 'instant' }],
			components: { v: true, s: true },
			damageInflict: ['force'],
			entries: ['You create three glowing darts of magical force. A dart deals {@damage 1d4 + 1} force damage to its target.'],
		});

		const attack = findRecord(records, 'Magic Missile Attack');
		expect(attack.payload.repeat).toBe(3);
	});

	test('Cure Wounds (XPHB): healing gets ability "auto" from "plus your spellcasting ability modifier"', () => {
		const records = buildRecords({
			name: 'Cure Wounds', level: 1, school: 'A',
			time: [{ number: 1, unit: 'action' }],
			range: { type: 'point', distance: { type: 'touch' } },
			duration: [{ type: 'instant' }],
			components: { v: true, s: true },
			miscTags: ['HL'],
			entries: ['A creature you touch regains a number of hit points equal to {@dice 2d8} plus your spellcasting ability modifier.'],
		});

		const heal = findRecord(records, 'Cure Wounds Healing');
		expect(heal.payload.ability).toBe('auto');
		expect(heal.payload.diceCount).toBe(2);
		expect(heal.payload.diceSize).toBe('d8');
	});
});

describe('Charactermancer equipment builder handles all defaultData item shapes', () => {
	function buildEquip (cls) {
		return ctx.d20plus.import2024.charmanBuildEquipRecords(cls, 'Test Basics');
	}

	function findRecord (records, name) {
		const rec = records.find(r => r.name === name);
		if (!rec) return undefined;
		return { ...rec, payload: JSON.parse(rec.payload) };
	}

	// Mirrors the real Wizard (XPHB) startingEquipment.defaultData shape - a choice between (A) a
	// bundle of named items plus a `{special}` entry (Spellbook) and a bare `{value}` gold amount
	// (5 GP), or (B) a single bare `{value}` gold amount (55 GP) with no items at all.
	const wizardLikeClass = {
		name: 'Wizard',
		startingEquipment: {
			goldAlternative: '4d4',
			defaultData: [{
				A: [
					{ item: 'dagger|xphb', quantity: 2 },
					{ item: 'quarterstaff|xphb' },
					{ special: 'Spellbook' },
					{ value: 500 },
				],
				B: [
					{ value: 5500 },
				],
			}],
		},
	};

	test('the "Choice 1" wrapper record has a short, stable label instead of concatenating every item in the first option', () => {
		const records = buildEquip(wizardLikeClass);
		const choiceWrapper = findRecord(records, 'Wizard Equipment Choice 1');
		expect(choiceWrapper.builderDisplayName).toBe('Wizard Equipment Choice');
	});

	test('a {special} entry (e.g. Spellbook) is included as a named item, not silently dropped', () => {
		const records = buildEquip(wizardLikeClass);
		const optionA = findRecord(records, 'Wizard Equipment A');
		expect(optionA.payload.items).toContain('Spellbook');
	});

	test('a {value} entry bundled alongside items becomes a child Starting Currency record', () => {
		const records = buildEquip(wizardLikeClass);
		const goldRec = findRecord(records, 'Wizard Equipment A Gold');
		expect(goldRec).toBeDefined();
		expect(goldRec.payload.type).toBe('Starting Currency');
		expect(goldRec.payload.gold).toBe('5');
		expect(goldRec.parent).toBe('Wizard Equipment A');
	});

	test('an option that is entirely a {value} entry (no items) still grants its gold instead of nothing', () => {
		const records = buildEquip(wizardLikeClass);
		const optionB = findRecord(records, 'Wizard Equipment B');
		expect(optionB.payload.items).toEqual([]);

		const goldRec = findRecord(records, 'Wizard Equipment B Gold');
		expect(goldRec).toBeDefined();
		expect(goldRec.payload.gold).toBe('55');
		expect(goldRec.parent).toBe('Wizard Equipment B');
	});

	test('a gold child record has a natural builderDisplayName (e.g. "5 GP") instead of leaking its internal prefixed name (e.g. "Wizard Equipment A Gold") into the parent\'s "You receive" summary', () => {
		const records = buildEquip(wizardLikeClass);
		const goldRec = findRecord(records, 'Wizard Equipment A Gold');
		expect(goldRec.builderDisplayName).toBe('5 GP');
	});

	test('does not create an empty pass-through "${n} Equipment" container - Roll20 renders an empty {subtype:"fixed", items:[]} record as a broken "choose one, nothing to choose" widget', () => {
		const records = buildEquip(wizardLikeClass);
		const emptyContainer = records.find(r => r.name === 'Wizard Equipment' && JSON.parse(r.payload).items.length === 0 && JSON.parse(r.payload).subtype === 'fixed');
		expect(emptyContainer).toBeUndefined();

		// The real equipment choice should parent directly to the top-level Equipment Choice node.
		const equipChoice1 = findRecord(records, 'Wizard Equipment Choice 1');
		expect(equipChoice1.parent).toBe('Wizard Equipment Choice');
	});
});

describe('Charactermancer injects Languages (category(name:"Proficiencies") filtered by Type=Language)', () => {
	test('STD_LANGUAGES is a non-empty list covering the standard PHB languages', () => {
		const langs = ctx.d20plus.import2024.charmanStdLanguages;
		expect(Array.isArray(langs)).toBe(true);
		expect(langs.length).toBeGreaterThan(10);
		expect(langs).toContain('Common');
		expect(langs).toContain('Draconic');
	});

	test('languageEntry builds a page with Type "Language" so it matches the live filter regex (?:^|, ?)Language', () => {
		const entry = ctx.d20plus.import2024.charmanLanguageEntry('Elvish');
		expect(entry.name).toBe('Elvish');
		expect(entry.properties.Type).toBe('Language');
		expect(/^Language|, ?Language/.test(entry.properties.Type)).toBe(true);
	});
});

describe('Charactermancer background equipment - no empty "choose one, nothing to choose" record', () => {
	function buildBg (bg) {
		return ctx.d20plus.import2024.charmanBuildBgRecords(bg, new Map());
	}

	test('a background with no fixed starting items (e.g. Sage) does not create an empty Equipment choice record', () => {
		const sageLike = { name: 'Sage', entries: [] }; // no startingEquipment at all, matching Sage
		const records = buildBg(sageLike);
		const emptyEquip = records.find(r => (r.payload || '').includes('"Starting Equipment"') && JSON.parse(r.payload).items.length === 0);
		expect(emptyEquip).toBeUndefined();
	});

	test('a background that grants a flat "_" list of fixed starting items (no A/B choice) still gets a real Equipment record', () => {
		const withItems = {
			name: 'Guide',
			entries: [],
			startingEquipment: [{ _: [{ item: 'quarterstaff|xphb' }, { item: 'traveler\'s clothes|xphb' }] }],
		};
		const records = buildBg(withItems);
		const equip = records.find(r => r.name === 'Guide Fixed Equipment');
		expect(equip).toBeDefined();
		const payload = JSON.parse(equip.payload);
		expect(payload.items).toEqual(expect.arrayContaining(['Quarterstaff', "Traveler's clothes"]));
		expect(equip.parent).toBe('Guide');
	});

	// Criminal's real startingEquipment is [{A:[...6 items incl. a bundled 16 GP], B:[{value:5000}]}]
	// - no "_" key at all. The pre-refactor background-only equipment code only ever read `_`, so
	// this shape (identical to how classes represent an A/B choice) silently produced zero
	// equipment records. Reusing the shared class equipment logic fixes that.
	const criminalLikeBg = {
		name: 'Criminal',
		entries: [],
		startingEquipment: [{
			A: [
				{ item: 'dagger|xphb', quantity: 2 },
				{ item: "thieves' tools|xphb" },
				{ item: 'crowbar|xphb' },
				{ item: 'pouch|xphb', quantity: 2 },
				{ item: 'common clothes|xphb', displayName: 'dark common clothes including a hood' },
				{ value: 1600 },
			],
			B: [{ value: 5000 }],
		}],
	};

	test('a background using an A/B equipment choice (e.g. Criminal) now gets real equipment records instead of none at all', () => {
		const records = buildBg(criminalLikeBg);
		const optionA = records.find(r => r.name === 'Criminal Equipment A');
		expect(optionA).toBeDefined();
		expect(optionA.parent).toBe('Criminal Equipment Choice 1');

		const goldA = records.find(r => r.name === 'Criminal Equipment A Gold');
		expect(JSON.parse(goldA.payload).gold).toBe('16');

		const optionB = records.find(r => r.name === 'Criminal Equipment B');
		expect(optionB).toBeDefined();
		const goldB = records.find(r => r.name === 'Criminal Equipment B Gold');
		expect(JSON.parse(goldB.payload).gold).toBe('50');
	});

	test('a {displayName} override (e.g. Criminal\'s "dark common clothes including a hood") takes priority over the plain item name', () => {
		const records = buildBg(criminalLikeBg);
		const optionA = records.find(r => r.name === 'Criminal Equipment A');
		const items = JSON.parse(optionA.payload).items;
		expect(items).toContain('Dark common clothes including a hood');
		expect(items).not.toContain('Common clothes');
	});
});
