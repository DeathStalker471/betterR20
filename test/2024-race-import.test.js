'use strict';

const vm = require('vm');
const { createRoll20Env, load2024FromDist, makeCharModel } = require('./helpers/env');

let ctx;

beforeAll(() => {
	const env = createRoll20Env();
	ctx = vm.createContext(env);
	load2024FromDist(ctx);
});

function intsByType (store, type) {
	return Object.values(store.integrants.integrants).filter(i => i.type === type);
}

function makeRaceData (race) {
	return { Vetoolscontent: race };
}

const minRace = { name: 'Human', size: ['M'], speed: 30, entries: [] };

// ---------------------------------------------------------------------------
// Guard: missing Vetoolscontent
// ---------------------------------------------------------------------------
describe('import2024Race — guard', () => {
	test('returns without creating integrants when Vetoolscontent is absent', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, {});
		expect(Object.keys(model.getStore().integrants.integrants)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Species integrant
// ---------------------------------------------------------------------------
describe('import2024Race — Species integrant', () => {
	test('creates exactly one Species integrant', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData(minRace));
		expect(intsByType(model.getStore(), 'Species')).toHaveLength(1);
	});

	test('Species name matches race name', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, name: 'Elf' }));
		expect(intsByType(model.getStore(), 'Species')[0].name).toBe('Elf');
	});

	test('Species childIDs contains Speed and Size integrant IDs', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData(minRace));
		const store    = model.getStore();
		const species  = intsByType(store, 'Species')[0];
		const children = JSON.parse(species.childIDs);
		const speedId  = Object.keys(store.integrants.integrants).find(k => store.integrants.integrants[k].type === 'Speed');
		const sizeId   = Object.keys(store.integrants.integrants).find(k => store.integrants.integrants[k].type === 'Size');
		expect(children).toContain(speedId);
		expect(children).toContain(sizeId);
	});
});

// ---------------------------------------------------------------------------
// Speed integrant
// ---------------------------------------------------------------------------
describe('import2024Race — Speed integrant', () => {
	test('creates one Speed integrant', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData(minRace));
		expect(intsByType(model.getStore(), 'Speed')).toHaveLength(1);
	});

	test('Speed value matches numeric race.speed', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, speed: 35 }));
		expect(intsByType(model.getStore(), 'Speed')[0].valueFormula.flatValue).toBe(35);
	});

	test('reads walk speed from speed.walk when speed is an object', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, speed: { walk: 25 } }));
		expect(intsByType(model.getStore(), 'Speed')[0].valueFormula.flatValue).toBe(25);
	});

	test('defaults to 30 when speed is absent', () => {
		const model = makeCharModel();
		const { speed: _, ...noSpeed } = minRace;
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...noSpeed }));
		expect(intsByType(model.getStore(), 'Speed')[0].valueFormula.flatValue).toBe(30);
	});

	test('Speed integrant speed property is "Walking"', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData(minRace));
		expect(intsByType(model.getStore(), 'Speed')[0].speed).toBe('Walking');
	});
});

// ---------------------------------------------------------------------------
// Size integrant
// ---------------------------------------------------------------------------
describe('import2024Race — Size integrant', () => {
	test('creates one Size integrant', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData(minRace));
		expect(intsByType(model.getStore(), 'Size')).toHaveLength(1);
	});

	test.each([
		['M', 'Medium'],
		['S', 'Small'],
		['T', 'Tiny'],
		['L', 'Large'],
	])('size abbreviation "%s" maps to "%s"', (abv, expected) => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, size: [abv] }));
		expect(intsByType(model.getStore(), 'Size')[0].size).toBe(expected);
	});

	test('defaults to Medium when size is absent', () => {
		const model = makeCharModel();
		const { size: _, ...noSize } = minRace;
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...noSize }));
		expect(intsByType(model.getStore(), 'Size')[0].size).toBe('Medium');
	});
});

// ---------------------------------------------------------------------------
// Feature integrants from race.entries
// ---------------------------------------------------------------------------
describe('import2024Race — Feature integrants', () => {
	test('creates a Features integrant for each named entry', () => {
		const model = makeCharModel();
		const race = {
			...minRace,
			entries: [
				{ name: 'Gnome Cunning', entries: ['Advantage on saving throws.'] },
				{ name: 'Tinker', entries: ['Create tiny devices.'] },
			],
		};
		ctx.d20plus.importer.import2024Race(model, makeRaceData(race));
		const features = intsByType(model.getStore(), 'Features');
		const names = features.map(f => f.name);
		expect(names).toContain('Gnome Cunning');
		expect(names).toContain('Tinker');
	});

	test('skips plain string entries in race.entries', () => {
		const model = makeCharModel();
		const race  = { ...minRace, entries: ['some plain string'] };
		ctx.d20plus.importer.import2024Race(model, makeRaceData(race));
		expect(intsByType(model.getStore(), 'Features')).toHaveLength(0);
	});

	test('feature IDs appear in speciesTraitsDisplayOrder', () => {
		const model = makeCharModel();
		const race = { ...minRace, entries: [{ name: 'Relentless Endurance', entries: ['Drop to 1 HP.'] }] };
		ctx.d20plus.importer.import2024Race(model, makeRaceData(race));
		const order = JSON.parse(model.getStore().features.speciesTraitsDisplayOrder);
		expect(order.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// Darkvision
// ---------------------------------------------------------------------------
describe('import2024Race — Darkvision', () => {
	test('adds a Darkvision Sense when darkvision is in root and no Darkvision entry exists', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, darkvision: 60 }));
		const senses = intsByType(model.getStore(), 'Sense');
		expect(senses).toHaveLength(1);
		expect(senses[0].name).toBe('Darkvision');
		expect(senses[0].valueFormula.flatValue).toBe(60);
	});

	test('adds no Sense when darkvision is 0', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Race(model, makeRaceData({ ...minRace, darkvision: 0 }));
		expect(intsByType(model.getStore(), 'Sense')).toHaveLength(0);
	});

	test('adds a Sense child inside a Darkvision entry when entry name contains "darkvision"', () => {
		const model = makeCharModel();
		const race  = {
			...minRace,
			darkvision: 60,
			entries: [{ name: 'Darkvision', entries: ['You can see in dim light.'] }],
		};
		ctx.d20plus.importer.import2024Race(model, makeRaceData(race));
		const senses = intsByType(model.getStore(), 'Sense');
		expect(senses).toHaveLength(1);
		expect(senses[0].valueFormula.flatValue).toBe(60);
	});
});
