'use strict';

const vm = require('vm');
const { createRoll20Env, load2024FromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// getSheetDisplayName — mirrored from 5etools-2024-sheet-config.js.
// Tests the human-readable labels shown in the import sheet-format dropdown.
// ---------------------------------------------------------------------------
const IS_2024_SHEET = new Set(['dnd_2024', 'DnD2024_Character_Sheet', 'dnd2024', 'dnd2024byroll20']);

function getSheetDisplayName (sheetKey, sheetObj) {
	if (sheetKey === 'ogl5e' || sheetKey === 'ogl') return '2014 (OGL)';
	if (IS_2024_SHEET.has(sheetKey)) return '2024';
	if (sheetKey === 'shaped_d20') return 'Shaped';
	if (sheetKey === 'DnD5e_Character_Sheet') return 'Community';
	const name = sheetObj?.attributes?.name || sheetKey;
	return `Other (${name})`;
}

describe('getSheetDisplayName', () => {
	test.each([
		['ogl5e',  null, '2014 (OGL)'],
		['ogl',    null, '2014 (OGL)'],
	])('"%s" → "2014 (OGL)"', (key, obj, expected) => {
		expect(getSheetDisplayName(key, obj)).toBe(expected);
	});

	test.each([...IS_2024_SHEET])('2024 sheet key "%s" → "2024"', (key) => {
		expect(getSheetDisplayName(key, null)).toBe('2024');
	});

	test('"shaped_d20" → "Shaped"', () => {
		expect(getSheetDisplayName('shaped_d20', null)).toBe('Shaped');
	});

	test('"DnD5e_Character_Sheet" → "Community"', () => {
		expect(getSheetDisplayName('DnD5e_Character_Sheet', null)).toBe('Community');
	});

	test('unknown key with no sheetObj falls back to "Other (key)"', () => {
		expect(getSheetDisplayName('some_custom_sheet', null)).toBe('Other (some_custom_sheet)');
	});

	test('unknown key with sheetObj.attributes.name uses the name', () => {
		const sheetObj = { attributes: { name: 'My Custom Sheet' } };
		expect(getSheetDisplayName('custom_id', sheetObj)).toBe('Other (My Custom Sheet)');
	});

	test('unknown key with sheetObj but no attributes.name falls back to key', () => {
		expect(getSheetDisplayName('fallback_key', {})).toBe('Other (fallback_key)');
	});
});

// ---------------------------------------------------------------------------
// shouldUse2024 — tests both d20plus.importer and d20plus.monsters versions,
// loaded from dist so we exercise the real implementation.
// ---------------------------------------------------------------------------
let ctx;
let currentSheetFormat;

beforeAll(() => {
	const env = createRoll20Env();
	// Make cfg.getOrDefault controllable per test
	env.d20plus.cfg.getOrDefault = (_section, key) =>
		key === 'importSheetFormat' ? currentSheetFormat : null;
	ctx = vm.createContext(env);
	load2024FromDist(ctx);
});

beforeEach(() => {
	currentSheetFormat = 'dnd_2024'; // default to a 2024 sheet
});

describe('d20plus.importer.shouldUse2024', () => {
	test.each([...IS_2024_SHEET])('returns true for sheet key "%s"', (key) => {
		currentSheetFormat = key;
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(true);
	});

	test('returns false for "ogl5e"', () => {
		currentSheetFormat = 'ogl5e';
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(false);
	});

	test('returns false for "shaped_d20"', () => {
		currentSheetFormat = 'shaped_d20';
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(false);
	});

	test('returns false for empty string', () => {
		currentSheetFormat = '';
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(false);
	});

	test('returns false for null', () => {
		currentSheetFormat = null;
		expect(ctx.d20plus.importer.shouldUse2024()).toBe(false);
	});
});

describe('d20plus.monsters.shouldUse2024', () => {
	test.each([...IS_2024_SHEET])('returns true for sheet key "%s"', (key) => {
		currentSheetFormat = key;
		expect(ctx.d20plus.monsters.shouldUse2024()).toBe(true);
	});

	test('returns false for "ogl5e" (2014 OGL sheet)', () => {
		currentSheetFormat = 'ogl5e';
		expect(ctx.d20plus.monsters.shouldUse2024()).toBe(false);
	});

	test('returns false when no sheet format is set', () => {
		currentSheetFormat = null;
		expect(ctx.d20plus.monsters.shouldUse2024()).toBe(false);
	});

	test('importer.shouldUse2024 and monsters.shouldUse2024 agree for the same format', () => {
		for (const key of [...IS_2024_SHEET, 'ogl5e', 'shaped_d20']) {
			currentSheetFormat = key;
			expect(ctx.d20plus.monsters.shouldUse2024()).toBe(ctx.d20plus.importer.shouldUse2024());
		}
	});
});
