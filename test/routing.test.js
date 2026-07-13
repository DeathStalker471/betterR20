'use strict';

// Tests the importData dispatch logic from 5etools-main.js.
// importData is a private closure, so we mirror it here and verify it
// correctly dispatches to import2024Data vs importDataOGL based on the
// character's charactersheetname attribute.

const IS_2024_SHEET = new Set(['dnd_2024', 'DnD2024_Character_Sheet', 'dnd2024', 'dnd2024byroll20']);

function buildImportData (d20plus, importDataOGL) {
	return function importData (character, data, event) {
		const charModel = character.model || character;
		const sheetName = charModel.get
			? charModel.get('charactersheetname')
			: charModel?.attributes?.charactersheetname;
		if (typeof d20plus.importer?.is2024Sheet === 'function' && d20plus.importer.is2024Sheet(sheetName)) {
			if (typeof d20plus.importer?.import2024Data === 'function') {
				d20plus.importer.import2024Data(character, data, event, importDataOGL);
				return;
			}
		}
		importDataOGL(character, data, event);
	};
}

function makeEnv (overrides = {}) {
	return {
		importer: {
			is2024Sheet:    (name) => IS_2024_SHEET.has(name),
			import2024Data: jest.fn(),
			...overrides,
		},
	};
}

// character with sheet name stored on .attributes (no .model intermediary)
function makeChar (sheetName) {
	return { attributes: { charactersheetname: sheetName } };
}

// character view with a .model intermediary and a .get() accessor (Roll20 style)
function makeCharView (sheetName) {
	return {
		model: {
			get: (key) => (key === 'charactersheetname' ? sheetName : null),
		},
	};
}

// ---------------------------------------------------------------------------
// 2024-sheet routing
// ---------------------------------------------------------------------------
describe('importData — 2024-sheet routing', () => {
	test('calls import2024Data and not importDataOGL for a 2024 sheet', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);
		const char     = makeChar('dnd_2024');
		const data     = { data: { Category: 'Spells' } };

		dispatch(char, data, 'event');

		expect(d20plus.importer.import2024Data).toHaveBeenCalledTimes(1);
		expect(d20plus.importer.import2024Data).toHaveBeenCalledWith(char, data, 'event', ogl);
		expect(ogl).not.toHaveBeenCalled();
	});

	test.each([...IS_2024_SHEET])(
		'routes sheet key "%s" to import2024Data',
		(sheetKey) => {
			const ogl      = jest.fn();
			const d20plus  = makeEnv();
			const dispatch = buildImportData(d20plus, ogl);

			dispatch(makeChar(sheetKey), { data: {} }, null);

			expect(d20plus.importer.import2024Data).toHaveBeenCalledTimes(1);
			expect(ogl).not.toHaveBeenCalled();
		},
	);

	test('passes importDataOGL as the fallback argument to import2024Data', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeChar('dnd_2024'), { data: { Category: 'Psionics' } }, null);

		const receivedFallback = d20plus.importer.import2024Data.mock.calls[0][3];
		expect(receivedFallback).toBe(ogl);
	});

	test('resolves charModel via character.model when present', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeCharView('dnd_2024'), { data: {} }, null);

		expect(d20plus.importer.import2024Data).toHaveBeenCalledTimes(1);
		expect(ogl).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// 2014-sheet (OGL) routing
// ---------------------------------------------------------------------------
describe('importData — 2014/OGL routing', () => {
	test('calls importDataOGL for an OGL (2014) sheet', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);
		const char     = makeChar('ogl5e');
		const data     = { data: { Category: 'Spells' } };

		dispatch(char, data, 'event');

		expect(ogl).toHaveBeenCalledTimes(1);
		expect(ogl).toHaveBeenCalledWith(char, data, 'event');
		expect(d20plus.importer.import2024Data).not.toHaveBeenCalled();
	});

	test('calls importDataOGL when charactersheetname is absent', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);

		dispatch({ attributes: {} }, { data: {} }, null);

		expect(ogl).toHaveBeenCalledTimes(1);
		expect(d20plus.importer.import2024Data).not.toHaveBeenCalled();
	});

	test('calls importDataOGL for an empty sheet name', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv();
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeChar(''), { data: {} }, null);

		expect(ogl).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// importDataOGL — OGL category dispatch (from 5etools-main.js)
// ---------------------------------------------------------------------------
describe('importDataOGL — OGL category dispatch', () => {
	function makeOGLEnv () {
		return {
			feats:            { importFeat:            jest.fn() },
			backgrounds:      { importBackground:      jest.fn() },
			races:            { importRace:            jest.fn() },
			optionalfeatures: { importOptionalFeature: jest.fn() },
			classes:          { importClass:           jest.fn() },
			subclasses:       { importSubclass:        jest.fn() },
			psionics:         { importPsionicAbility:  jest.fn() },
			items:            { importItem:            jest.fn() },
			spells:           { importSpells:          jest.fn() },
			importer:         { doFakeDrop:            jest.fn() },
		};
	}

	function buildImportDataOGL (d20plus) {
		return function importDataOGL (character, data, event) {
			if      (data.data.Category === 'Feats')             d20plus.feats.importFeat(character, data);
			else if (data.data.Category === 'Backgrounds')       d20plus.backgrounds.importBackground(character, data);
			else if (data.data.Category === 'Races')             d20plus.races.importRace(character, data);
			else if (data.data.Category === 'Optional Features') d20plus.optionalfeatures.importOptionalFeature(character, data);
			else if (data.data.Category === 'Classes')           d20plus.classes.importClass(character, data);
			else if (data.data.Category === 'Subclasses')        d20plus.subclasses.importSubclass(character, data);
			else if (data.data.Category === 'Psionics')          d20plus.psionics.importPsionicAbility(character, data);
			else if (data.data.Category === 'Items')             d20plus.items.importItem(character, data, event);
			else if (data.data.Category === 'Spells')            d20plus.spells.importSpells(character, data, event);
			else                                                  d20plus.importer.doFakeDrop(event, character, data);
		};
	}

	test.each([
		['Feats',             'feats',             'importFeat'],
		['Backgrounds',       'backgrounds',       'importBackground'],
		['Races',             'races',             'importRace'],
		['Optional Features', 'optionalfeatures',  'importOptionalFeature'],
		['Classes',           'classes',           'importClass'],
		['Subclasses',        'subclasses',        'importSubclass'],
		['Psionics',          'psionics',          'importPsionicAbility'],
		['Items',             'items',             'importItem'],
		['Spells',            'spells',            'importSpells'],
	])('routes Category "%s" to %s.%s', (category, mod, method) => {
		const env      = makeOGLEnv();
		const dispatch = buildImportDataOGL(env);
		dispatch({}, { data: { Category: category } }, 'event');
		expect(env[mod][method]).toHaveBeenCalledTimes(1);
	});

	test('calls doFakeDrop for unhandled categories', () => {
		const env      = makeOGLEnv();
		const dispatch = buildImportDataOGL(env);
		dispatch({}, { data: { Category: 'Vehicles' } }, 'event');
		expect(env.importer.doFakeDrop).toHaveBeenCalledTimes(1);
	});

	test('passes event as the third argument to Items', () => {
		const env      = makeOGLEnv();
		const dispatch = buildImportDataOGL(env);
		const char     = {};
		const data     = { data: { Category: 'Items' } };
		dispatch(char, data, 'myEvent');
		expect(env.items.importItem).toHaveBeenCalledWith(char, data, 'myEvent');
	});

	test('passes event as the third argument to Spells', () => {
		const env      = makeOGLEnv();
		const dispatch = buildImportDataOGL(env);
		const char     = {};
		const data     = { data: { Category: 'Spells' } };
		dispatch(char, data, 'myEvent');
		expect(env.spells.importSpells).toHaveBeenCalledWith(char, data, 'myEvent');
	});
});

// ---------------------------------------------------------------------------
// Graceful degradation when helper functions are missing
// ---------------------------------------------------------------------------
describe('importData — graceful degradation', () => {
	test('falls through to importDataOGL when is2024Sheet is not a function', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv({ is2024Sheet: undefined });
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeChar('dnd_2024'), { data: {} }, null);

		expect(ogl).toHaveBeenCalledTimes(1);
		expect(d20plus.importer.import2024Data).not.toHaveBeenCalled();
	});

	test('falls through to importDataOGL when import2024Data is not a function', () => {
		const ogl      = jest.fn();
		const d20plus  = makeEnv({ import2024Data: undefined });
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeChar('dnd_2024'), { data: {} }, null);

		expect(ogl).toHaveBeenCalledTimes(1);
	});

	test('falls through to importDataOGL when importer is null', () => {
		const ogl      = jest.fn();
		const d20plus  = { importer: null };
		const dispatch = buildImportData(d20plus, ogl);

		dispatch(makeChar('dnd_2024'), { data: {} }, null);

		expect(ogl).toHaveBeenCalledTimes(1);
	});
});
