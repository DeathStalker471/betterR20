'use strict';

// Tests the import2024Data dispatch logic from 5etools-2024-router.js.
// The function is mirrored here so the suite runs without loading dist.


function buildImport2024Data (d20plus) {
	return function import2024Data (charView, data, event, importDataFallback) {
		const charModel = charView.model;
		const category  = data.data && data.data.Category;

		if      (category === 'Spells')  d20plus.importer.import2024Spell(charModel, data);
		else if (category === 'Items')   d20plus.importer.import2024Item(charModel, data);
		else if (category === 'Classes') d20plus.importer.import2024Class(charModel, data);
		else if (category === 'Races')   d20plus.importer.import2024Race(charModel, data);
		else if (category === 'Feats')   d20plus.importer.import2024Feat(charModel, data);
		else                             importDataFallback(charView, data, event);
	};
}

function makeEnv () {
	return {
		importer: {
			import2024Spell: jest.fn(),
			import2024Item:  jest.fn(),
			import2024Class: jest.fn(),
			import2024Race:  jest.fn(),
			import2024Feat:  jest.fn(),
		},
	};
}

function makeCharView (model) {
	return { model };
}

// ---------------------------------------------------------------------------
// Category dispatch
// ---------------------------------------------------------------------------
describe('import2024Data — category dispatch', () => {
	test.each([
		['Spells',  'import2024Spell'],
		['Items',   'import2024Item'],
		['Classes', 'import2024Class'],
		['Races',   'import2024Race'],
		['Feats',   'import2024Feat'],
	])('routes Category "%s" to importer.%s', (category, method) => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);
		const model    = { id: 'char1' };
		const charView = makeCharView(model);
		const data     = { data: { Category: category } };

		dispatch(charView, data, 'event', fallback);

		expect(env.importer[method]).toHaveBeenCalledTimes(1);
		expect(env.importer[method]).toHaveBeenCalledWith(model, data);
		expect(fallback).not.toHaveBeenCalled();
	});

	test('passes charModel (not charView) to import handlers', () => {
		const env      = makeEnv();
		const dispatch = buildImport2024Data(env);
		const model    = { id: 'theModel' };

		dispatch(makeCharView(model), { data: { Category: 'Spells' } }, null, jest.fn());

		expect(env.importer.import2024Spell).toHaveBeenCalledWith(model, expect.anything());
	});

	test('calls fallback for an unhandled category', () => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);
		const charView = makeCharView({});
		const data     = { data: { Category: 'Vehicles' } };

		dispatch(charView, data, 'event', fallback);

		expect(fallback).toHaveBeenCalledTimes(1);
		expect(fallback).toHaveBeenCalledWith(charView, data, 'event');
		for (const m of Object.values(env.importer)) expect(m).not.toHaveBeenCalled();
	});

	test('calls fallback when Category is absent', () => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);

		dispatch(makeCharView({}), { data: {} }, null, fallback);

		expect(fallback).toHaveBeenCalledTimes(1);
	});

	test('calls fallback when data.data is absent', () => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);

		dispatch(makeCharView({}), {}, null, fallback);

		expect(fallback).toHaveBeenCalledTimes(1);
	});

	test('passes event to fallback', () => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);

		dispatch(makeCharView({}), { data: { Category: 'Unknown' } }, 'myEvent', fallback);

		expect(fallback).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'myEvent');
	});

	test('only one handler is called per dispatch', () => {
		const env      = makeEnv();
		const fallback = jest.fn();
		const dispatch = buildImport2024Data(env);

		dispatch(makeCharView({}), { data: { Category: 'Feats' } }, null, fallback);

		const callCounts = Object.values(env.importer).map(m => m.mock.calls.length);
		expect(callCounts.filter(n => n > 0)).toHaveLength(1);
		expect(fallback).not.toHaveBeenCalled();
	});
});
