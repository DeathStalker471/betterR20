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

function makeData (name, vetoolscontent) {
	return { name, Vetoolscontent: vetoolscontent };
}

// ---------------------------------------------------------------------------
// import2024Feat
// ---------------------------------------------------------------------------
describe('import2024Feat', () => {
	test('creates a Features integrant with the feat name', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Alert', 'You are always on the lookout.'));
		const feats = intsByType(model.getStore(), 'Features');
		expect(feats).toHaveLength(1);
		expect(feats[0].name).toBe('Alert');
	});

	test('sets description from Vetoolscontent', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Alert', 'You are always on the lookout.'));
		const feat = intsByType(model.getStore(), 'Features')[0];
		expect(feat.description).toBe('You are always on the lookout.');
	});

	test('sets empty description when Vetoolscontent is absent', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, { name: 'Lucky' });
		const feat = intsByType(model.getStore(), 'Features')[0];
		expect(feat.description).toBe('');
	});

	test('sets source to "Feat"', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Tough', ''));
		const feat = intsByType(model.getStore(), 'Features')[0];
		expect(feat.source).toBe('Feat');
	});

	test('integrant has _enabled=true and empty parentID', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Resilient', ''));
		const feat = intsByType(model.getStore(), 'Features')[0];
		expect(feat._enabled).toBe(true);
		expect(feat.parentID).toBe('');
	});

	test('feat ID appears in featsDisplayOrder', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Athlete', 'Climb faster.'));
		const store     = model.getStore();
		const order     = JSON.parse(store.features.featsDisplayOrder);
		const featId    = Object.keys(store.integrants.integrants)[0];
		expect(order).toHaveLength(1);
		expect(order[0]).toBe(featId);
	});

	test('importing two feats accumulates both in featsDisplayOrder', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Alert', ''));
		ctx.d20plus.importer.import2024Feat(model, makeData('Lucky', ''));
		const store = model.getStore();
		const order = JSON.parse(store.features.featsDisplayOrder);
		const feats = intsByType(store, 'Features');
		expect(feats).toHaveLength(2);
		expect(order).toHaveLength(2);
	});

	test('second feat name is correct after two imports', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Observant', ''));
		ctx.d20plus.importer.import2024Feat(model, makeData('War Caster', ''));
		const feats = intsByType(model.getStore(), 'Features');
		const names = feats.map(f => f.name).sort();
		expect(names).toEqual(['Observant', 'War Caster']);
	});

	test('recordName matches name', () => {
		const model = makeCharModel();
		ctx.d20plus.importer.import2024Feat(model, makeData('Sharpshooter', ''));
		const feat = intsByType(model.getStore(), 'Features')[0];
		expect(feat.recordName).toBe('Sharpshooter');
	});
});
