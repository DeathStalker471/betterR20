'use strict';
const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

// Minimal Roll20 + 5etools environment needed for 2024-import code to run.
function createRoll20Env () {
	const SCRIPT_EXTENSIONS = [];
	const CONFIG_OPTIONS    = {};

	function addConfigOptions (section, options) {
		if (!CONFIG_OPTIONS[section]) CONFIG_OPTIONS[section] = {};
		Object.assign(CONFIG_OPTIONS[section], options);
	}

	const d20plus = {
		importer: {
			getCleanText: (html) => (html || '').replace(/<[^>]+>/g, '').trim(),
		},
		monsters: {
			getSizeString: (size) => {
				const map = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
				if (Array.isArray(size)) size = size[0];
				return map[size] || size || 'Medium';
			},
		},
		spells: {
			_getHandoutData: () => ['', JSON.stringify({ data: {}, Vetoolscontent: null })],
			formSpellUrl:    (url) => url,
		},
		ut:  { log: () => {}, sendHackerChat: () => {} },
		cfg: { getOrDefault: (_s, key) => key === 'importSheetFormat' ? 'dnd_2024' : null },
		setSheet:   function () {},
		sheet:      'ogl5e',
		import2024: {},
	};

	const Parser = {
		acToFull: (ac) => {
			if (!ac) return '10';
			if (Array.isArray(ac)) {
				const first = ac[0];
				return String(typeof first === 'object' ? (first.ac || 10) : (first || 10));
			}
			return String(ac);
		},
		monTypeToFullObj: (type) => {
			if (!type) return { asText: 'Unknown' };
			if (typeof type === 'string') return { asText: type };
			return { asText: type.type || 'Unknown' };
		},
		alignmentListToFull: (al) => (Array.isArray(al) ? al.join(' ') : String(al || 'Unaligned')),
		crToPb: (cr) => {
			const n = parseFloat(String(cr).replace('/', '.')) || 0;
			return n < 5 ? 2 : n < 9 ? 3 : n < 13 ? 4 : n < 17 ? 5 : n < 21 ? 6 : n < 25 ? 7 : n < 29 ? 8 : 9;
		},
		crToXpNumber: (cr) => {
			const map = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900 };
			return map[String(cr)] || 0;
		},
		getFullImmRes: (arr) => {
			if (!arr) return '';
			if (typeof arr === 'string') return arr;
			return arr.filter(e => typeof e === 'string').join(', ');
		},
		getFullCondImm: (arr) => (!arr ? '' : Array.isArray(arr) ? arr.join(', ') : String(arr)),
		spRangeToFull: (range) => {
			if (!range) return 'Self';
			if (range.type === 'self') return 'Self';
			if (range.type === 'point' && range.distance) return `${range.distance.amount} ${range.distance.type}`;
			return 'Self';
		},
	};

	const Renderer = {
		_inst: null,
		get () {
			if (!this._inst) {
				this._inst = {
					setBaseUrl:      function () { return this; },
					render:          function (entry) {
						if (typeof entry === 'string') return entry;
						if (entry && entry.name) return entry.name;
						return '';
					},
					recursiveRender: function (entry, stack) {
						if (entry && Array.isArray(entry.entries)) {
							entry.entries.forEach(e => { if (typeof e === 'string') stack.push(e); });
						}
					},
				};
			}
			return this._inst;
		},
	};

	const DataUtil = { loadJSON: () => Promise.resolve({ spell: [] }) };
	const d20      = { journal: { characterSheetsManager: { sheets: {} }, customSheets: null } };

	return {
		SCRIPT_EXTENSIONS,
		CONFIG_OPTIONS,
		JSON_DATA:          {},
		EXT_LIB_SCRIPTS:    [],
		EXT_LIB_API_SCRIPTS:[],
		addConfigOptions,
		d20plus,
		d20,
		Parser,
		Renderer,
		DataUtil,
		spellDataUrls: {},
		LINK_BASE_URL: 'https://5e.tools/',
		console,
		setTimeout:    () => {},
		clearTimeout:  () => {},
		prompt:        () => '1',
	};
}

// Extracts and runs the d20plus2024Import function from the built dist file, then boots it.
// Requires dist/betteR20-5etools.user.js to exist — run 'npm run build' first.
function load2024FromDist (context) {
	const distPath = path.resolve(__dirname, '../../dist/betteR20-5etools.user.js');
	if (!fs.existsSync(distPath)) {
		throw new Error(
			`Dist not found at ${distPath}\nRun 'npm run build' before running tests.`
		);
	}

	const dist        = fs.readFileSync(distPath, 'utf8');
	const startMarker = 'function d20plus2024Utils()';
	const endMarker   = 'SCRIPT_EXTENSIONS.push(d20plus2024Router);';

	const start = dist.indexOf(startMarker);
	const end   = dist.indexOf(endMarker);

	if (start === -1) throw new Error('d20plus2024Utils not found in dist — are the 5etools-2024-* files in the build?');
	if (end   === -1) throw new Error('SCRIPT_EXTENSIONS.push(d20plus2024Router) not found in dist');

	const code = dist.slice(start, end + endMarker.length);
	vm.runInContext(code, context, { filename: 'betteR20-5etools.user.js' });

	for (const fn of context.SCRIPT_EXTENSIONS) fn();
}

// Creates a charModel mock whose store starts populated so get2024Store returns it.
// Call model.getStore() after an import to inspect what was saved.
function makeCharModel (initialStore) {
	let store = initialStore || {
		integrants: { integrants: {} },
		features:   { featsDisplayOrder: '[]', classFeatureDisplayOrder: '[]', speciesTraitsDisplayOrder: '[]', otherDisplayOrder: '[]' },
		spells:     { displayOrder: ['[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]'] },
		inventory:  { equipmentDisplayOrder: '[]', otherPossessionsDisplayOrder: '[]', incrementalQuantityEditing: true },
		attacks:    { attackDisplayOrder: '[]' },
	};

	const storeAttr = {
		get:     (key) => key === 'name' ? 'store' : key === 'current' ? store : null,
		destroy: () => {},
	};

	return {
		attribs: {
			find: (predicate) => (predicate(storeAttr) ? storeAttr : null),
			push: (data) => {
				if (data.name === 'store') store = data.current;
				return { syncedSave: () => {} };
			},
		},
		view:     null,
		getStore: () => store,
	};
}

// Empty store for batch spell import tests.
function makeBatchStore () {
	return {
		integrants: { integrants: {} },
		spells:     { displayOrder: ['[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]'] },
	};
}

// Generic helper: extracts and runs the code between two text markers in the dist,
// then boots every registered SCRIPT_EXTENSIONS entry.
function loadSectionFromDist (context, startMarker, endMarker) {
	const distPath = path.resolve(__dirname, '../../dist/betteR20-5etools.user.js');
	if (!fs.existsSync(distPath)) {
		throw new Error(`Dist not found at ${distPath}\nRun 'npm run build' first.`);
	}
	const dist  = fs.readFileSync(distPath, 'utf8');
	const start = dist.indexOf(startMarker);
	const end   = dist.indexOf(endMarker);
	if (start === -1) throw new Error(`Start marker not found: ${startMarker}`);
	if (end   === -1) throw new Error(`End marker not found: ${endMarker}`);
	const code = dist.slice(start, end + endMarker.length);
	vm.runInContext(code, context, { filename: 'betteR20-5etools.user.js' });
	for (const fn of context.SCRIPT_EXTENSIONS) fn();
}

module.exports = { createRoll20Env, load2024FromDist, loadSectionFromDist, makeCharModel, makeBatchStore };
