'use strict';

const vm   = require('vm');
const { loadSectionFromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// Load baseUtil from dist with a minimal mock context.
// Only the saveAs IIFE runs at load time — everything else is just function defs.
// ---------------------------------------------------------------------------
let ut;
let ctx;

beforeAll(() => {
	const fakeElem = { download: undefined };
	const fakeDoc  = { createElementNS: () => fakeElem };
	const env = {
		d20plus:          {},
		SCRIPT_EXTENSIONS: [],
		window: {
			document:    fakeDoc,
			setTimeout:  () => {},
			setImmediate: null,
		},
		navigator:   { userAgent: '' },
		BASE_SITE_URL: 'https://5e.tools/',
		console,
	};
	ctx = vm.createContext(env);
	loadSectionFromDist(ctx, 'function baseUtil ()', 'SCRIPT_EXTENSIONS.push(baseUtil);');
	ut = ctx.d20plus.ut;
});

// ---------------------------------------------------------------------------
// cmpVersions
// ---------------------------------------------------------------------------
describe('cmpVersions', () => {
	test('equal versions return 0', () => {
		expect(ut.cmpVersions('1.0', '1.0')).toBe(0);
	});

	test('trailing .0 segments are ignored (1.0.0 === 1.0)', () => {
		expect(ut.cmpVersions('1.0.0', '1.0')).toBe(0);
	});

	test('older present vs newer available returns negative', () => {
		expect(ut.cmpVersions('1.35', '1.36')).toBeLessThan(0);
	});

	test('newer present vs older available returns positive', () => {
		expect(ut.cmpVersions('1.36', '1.35')).toBeGreaterThan(0);
	});

	test('patch-level comparison', () => {
		expect(ut.cmpVersions('1.36.1', '1.36.2')).toBeLessThan(0);
		expect(ut.cmpVersions('1.36.2', '1.36.1')).toBeGreaterThan(0);
	});

	test('longer segment list beats shorter when all prefix segments match', () => {
		expect(ut.cmpVersions('1.36.1', '1.36')).toBeGreaterThan(0);
	});

	test('beta suffix string is parsed as integer prefix (3-beta → 3)', () => {
		expect(ut.cmpVersions('1.36.1.3-beta', '1.36.1.3')).toBe(0);
	});

	test('null/undefined returns 0 (guard)', () => {
		expect(ut.cmpVersions(null, '1.0')).toBe(0);
		expect(ut.cmpVersions('1.0', null)).toBe(0);
		expect(ut.cmpVersions(null, null)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// fixS3Url
// ---------------------------------------------------------------------------
describe('fixS3Url', () => {
	test('converts full S3 AWS URL to files.d20.io', () => {
		const url = 'https://s3.amazonaws.com/files.d20.io/images/12345/abc/token.png';
		expect(ut.fixS3Url(url)).toBe('https://files.d20.io/images/12345/abc/token.png');
	});

	test('converts relative /files.d20.io path to absolute https URL', () => {
		const url = '/files.d20.io/images/99/xyz/portrait.jpg';
		expect(ut.fixS3Url(url)).toBe('https://files.d20.io/images/99/xyz/portrait.jpg');
	});

	test('strips query string from already-correct files.d20.io URL', () => {
		const url = 'https://files.d20.io/images/1/a/img.png?v=1234567890';
		expect(ut.fixS3Url(url)).toBe('https://files.d20.io/images/1/a/img.png');
	});

	test('converts bare files.d20.io domain path to full https URL', () => {
		const url = 'files.d20.io/images/2/b/img.gif';
		expect(ut.fixS3Url(url)).toBe('https://files.d20.io/images/2/b/img.gif');
	});

	test('leaves non-matching URLs unchanged', () => {
		const url = 'https://example.com/image.png';
		expect(ut.fixS3Url(url)).toBe(url);
	});

	test('passes through null/undefined unchanged', () => {
		expect(ut.fixS3Url(null)).toBeNull();
		expect(ut.fixS3Url(undefined)).toBeUndefined();
	});

	test('passes through empty string unchanged', () => {
		expect(ut.fixS3Url('')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------
describe('sanitizeFilename', () => {
	test('trims leading and trailing whitespace', () => {
		expect(ut.sanitizeFilename('  hello  ')).toBe('hello');
	});

	test('replaces spaces with underscores', () => {
		expect(ut.sanitizeFilename('my file')).toBe('my_file');
	});

	test('replaces special characters with underscores', () => {
		expect(ut.sanitizeFilename('file<name>:test')).toBe('file_name__test');
	});

	test('preserves word characters and dashes', () => {
		expect(ut.sanitizeFilename('my-file_name123')).toBe('my-file_name123');
	});

	test('replaces dots and slashes', () => {
		expect(ut.sanitizeFilename('path/to/file.js')).toBe('path_to_file_js');
	});
});

// ---------------------------------------------------------------------------
// ascSort
// ---------------------------------------------------------------------------
describe('ascSort', () => {
	test('equal values return 0', () => {
		expect(ut.ascSort('a', 'a')).toBe(0);
		expect(ut.ascSort(1, 1)).toBe(0);
	});

	test('a < b returns negative (b comes first in sort)', () => {
		expect(ut.ascSort('b', 'a')).toBeGreaterThan(0);
	});

	test('a > b returns positive (a comes first)', () => {
		expect(ut.ascSort('a', 'b')).toBeLessThan(0);
	});

	test('sorts an array ascending when used with Array.sort', () => {
		const arr = ['cherry', 'apple', 'banana'];
		arr.sort(ut.ascSort);
		expect(arr).toEqual(['apple', 'banana', 'cherry']);
	});
});

// ---------------------------------------------------------------------------
// layerToName
// ---------------------------------------------------------------------------
describe('layerToName', () => {
	const cases = [
		['map',        'Map'],
		['floors',     'Floors'],
		['background', 'Background'],
		['objects',    'Objects & Tokens'],
		['roofs',      'Roofs'],
		['foreground', 'Foreground'],
		['gmlayer',    'GM Info Overlay'],
		['walls',      'Dynamic Lighting'],
		['weather',    'Weather Exclusions'],
	];

	test.each(cases)('layer "%s" maps to "%s"', (layer, name) => {
		expect(ut.layerToName(layer)).toBe(name);
	});
});

// ---------------------------------------------------------------------------
// getReadableFileSizeString
// ---------------------------------------------------------------------------
describe('getReadableFileSizeString', () => {
	test('512 KB', () => {
		expect(ut.getReadableFileSizeString(512 * 1024)).toBe('512.0kB');
	});

	test('1 MB (uses > 1024 threshold, so 1025 * 1024 is the first MB value)', () => {
		expect(ut.getReadableFileSizeString(1025 * 1024)).toBe('1.0MB');
	});

	test('1.5 MB', () => {
		expect(ut.getReadableFileSizeString(1.5 * 1024 * 1024)).toBe('1.5MB');
	});

	test('tiny size floors at 0.1 kB', () => {
		// 1 byte → rounds to 0.1 kB (Math.max(0.000977, 0.1).toFixed(1))
		expect(ut.getReadableFileSizeString(1)).toBe('0.1kB');
	});
});

// ---------------------------------------------------------------------------
// timeAgo
// ---------------------------------------------------------------------------
describe('timeAgo', () => {
	test('returns "0 min ago" for a very recent timestamp', () => {
		expect(ut.timeAgo(Date.now())).toBe('0 min ago');
	});

	test('returns "1 min ago" for a timestamp 65 seconds in the past', () => {
		expect(ut.timeAgo(Date.now() - 65_000)).toBe('1 min ago');
	});

	test('returns "2 min ago" for a timestamp 130 seconds in the past', () => {
		expect(ut.timeAgo(Date.now() - 130_000)).toBe('2 min ago');
	});

	test('returns "1 hr ago" for a timestamp ~1.03 hours in the past', () => {
		expect(ut.timeAgo(Date.now() - 3_700_000)).toBe('1 hr ago');
	});

	test('returns "1 d ago" for a timestamp ~1 day in the past', () => {
		expect(ut.timeAgo(Date.now() - 86_500_000)).toBe('1 d ago');
	});
});

// ---------------------------------------------------------------------------
// isUseSharedJs — reads BASE_SITE_URL from vm context
// ---------------------------------------------------------------------------
describe('isUseSharedJs', () => {
	afterEach(() => {
		ctx.BASE_SITE_URL = 'https://5e.tools/';
	});

	test('returns true for 5e.tools', () => {
		ctx.BASE_SITE_URL = 'https://5e.tools/';
		expect(ut.isUseSharedJs()).toBe(true);
	});

	test('returns true for 5etools.com', () => {
		ctx.BASE_SITE_URL = 'https://5etools.com/';
		expect(ut.isUseSharedJs()).toBe(true);
	});

	test('returns true for a numbered mirror (5etools-mirror-1.github.io)', () => {
		ctx.BASE_SITE_URL = 'https://5etools-mirror-1.github.io/';
		expect(ut.isUseSharedJs()).toBe(true);
	});

	test('returns false for localhost', () => {
		ctx.BASE_SITE_URL = 'http://localhost:3000/';
		expect(ut.isUseSharedJs()).toBe(false);
	});

	test('returns false for an unrelated domain', () => {
		ctx.BASE_SITE_URL = 'https://example.com/';
		expect(ut.isUseSharedJs()).toBe(false);
	});
});
