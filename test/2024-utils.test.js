'use strict';

const vm   = require('vm');
const { loadSectionFromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// Load d20plus2024Utils from dist (only the utils block, not the full 2024 stack)
// ---------------------------------------------------------------------------
let u;

beforeAll(() => {
	const env = { d20plus: {}, SCRIPT_EXTENSIONS: [], console };
	const ctx = vm.createContext(env);
	loadSectionFromDist(
		ctx,
		'function d20plus2024Utils()',
		'SCRIPT_EXTENSIONS.push(d20plus2024Utils);'
	);
	u = ctx.d20plus.import2024;
});

// ---------------------------------------------------------------------------
// makeId
// ---------------------------------------------------------------------------
describe('makeId', () => {
	test('returns an 8-character string', () => {
		expect(typeof u.makeId()).toBe('string');
		expect(u.makeId()).toHaveLength(8);
	});

	test('contains only alphanumeric characters', () => {
		for (let i = 0; i < 20; i++) {
			expect(u.makeId()).toMatch(/^[A-Za-z0-9]{8}$/);
		}
	});

	test('generates a different ID each call (probabilistic)', () => {
		const ids = new Set(Array.from({ length: 50 }, () => u.makeId()));
		expect(ids.size).toBeGreaterThan(45);
	});
});

// ---------------------------------------------------------------------------
// makeIntegrantBase
// ---------------------------------------------------------------------------
describe('makeIntegrantBase', () => {
	test('returns an object with id and base properties', () => {
		const result = u.makeIntegrantBase('Spell');
		expect(result).toHaveProperty('id');
		expect(result).toHaveProperty('base');
	});

	test('id and base.shortID are the same value', () => {
		const { id, base } = u.makeIntegrantBase('Damage');
		expect(base.shortID).toBe(id);
	});

	test('base.type is set to the supplied type', () => {
		expect(u.makeIntegrantBase('Feature').base.type).toBe('Feature');
		expect(u.makeIntegrantBase('Class').base.type).toBe('Class');
	});

	test('arrayPosition defaults to 0 when not supplied', () => {
		expect(u.makeIntegrantBase('Attack').base.arrayPosition).toBe(0);
	});

	test('arrayPosition is set when explicitly supplied', () => {
		expect(u.makeIntegrantBase('Attack', 7).base.arrayPosition).toBe(7);
	});

	test('base defaults: _enabled=true, childIDs="[]", parentID=""', () => {
		const { base } = u.makeIntegrantBase('Spell');
		expect(base._enabled).toBe(true);
		expect(base.childIDs).toBe('[]');
		expect(base.parentID).toBe('');
		expect(base.parentDisabled).toBe(false);
		expect(base.overwriteDisabled).toBe(false);
	});

	test('generates a fresh id every call', () => {
		const ids = new Set(Array.from({ length: 20 }, () => u.makeIntegrantBase('X').id));
		expect(ids.size).toBeGreaterThan(18);
	});
});

// ---------------------------------------------------------------------------
// getNextArrayPos
// ---------------------------------------------------------------------------
describe('getNextArrayPos', () => {
	test('returns 1 for an empty store', () => {
		const store = { integrants: { integrants: {} } };
		expect(u.getNextArrayPos(store)).toBe(1);
	});

	test('returns max arrayPosition + 1', () => {
		const store = {
			integrants: {
				integrants: {
					abc: { arrayPosition: 5 },
					def: { arrayPosition: 12 },
					ghi: { arrayPosition: 3 },
				},
			},
		};
		expect(u.getNextArrayPos(store)).toBe(13);
	});

	test('returns 1 when integrants object is absent', () => {
		const store = { integrants: {} };
		expect(u.getNextArrayPos(store)).toBe(1);
	});

	test('handles a single entry', () => {
		const store = { integrants: { integrants: { x: { arrayPosition: 99 } } } };
		expect(u.getNextArrayPos(store)).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// pushDisplayOrder
// ---------------------------------------------------------------------------
describe('pushDisplayOrder', () => {
	test('creates the section if it does not exist', () => {
		const store = {};
		u.pushDisplayOrder(store, 'spells', 'displayOrder', ['id1']);
		expect(store.spells).toBeDefined();
	});

	test('initialises the key as a JSON array containing the supplied ids', () => {
		const store = {};
		u.pushDisplayOrder(store, 'spells', 'displayOrder', ['id1', 'id2']);
		expect(JSON.parse(store.spells.displayOrder)).toEqual(['id1', 'id2']);
	});

	test('appends to an already-existing JSON array', () => {
		const store = { spells: { displayOrder: '["existing"]' } };
		u.pushDisplayOrder(store, 'spells', 'displayOrder', ['new1', 'new2']);
		expect(JSON.parse(store.spells.displayOrder)).toEqual(['existing', 'new1', 'new2']);
	});

	test('multiple calls accumulate ids in order', () => {
		const store = {};
		u.pushDisplayOrder(store, 'features', 'featsDisplayOrder', ['a']);
		u.pushDisplayOrder(store, 'features', 'featsDisplayOrder', ['b']);
		u.pushDisplayOrder(store, 'features', 'featsDisplayOrder', ['c']);
		expect(JSON.parse(store.features.featsDisplayOrder)).toEqual(['a', 'b', 'c']);
	});

	test('handles separate sections independently', () => {
		const store = {};
		u.pushDisplayOrder(store, 'spells', 'displayOrder', ['s1']);
		u.pushDisplayOrder(store, 'features', 'featsDisplayOrder', ['f1']);
		expect(JSON.parse(store.spells.displayOrder)).toEqual(['s1']);
		expect(JSON.parse(store.features.featsDisplayOrder)).toEqual(['f1']);
	});
});
