'use strict';

const vm = require('vm');
const { createRoll20Env, loadSectionFromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// Setup — load the importer (CharacterAttributesProxy) and feats module.
// Both modules run their SCRIPT_EXTENSIONS initialiser, which means
// d20plusImporter() runs twice (once per loadSectionFromDist call).
// The second run overwrites d20plus.importer = {} and rebuilds it, which is
// harmless — the final state is identical to a single run.
// ---------------------------------------------------------------------------
let ctx;
let notifyWorkersSpy;

beforeAll(() => {
	const env = createRoll20Env();
	env.d20plus.ut.generateRowId = () => 'testRow';
	notifyWorkersSpy = env.d20.journal.notifyWorkersOfAttrChanges = jest.fn();
	ctx = vm.createContext(env);
	loadSectionFromDist(ctx, 'function d20plusImporter ()', 'SCRIPT_EXTENSIONS.push(d20plusImporter);');
	loadSectionFromDist(ctx, 'function d20plusFeats ()',    'SCRIPT_EXTENSIONS.push(d20plusFeats);');
});

beforeEach(() => {
	ctx.d20plus.sheet = 'ogl';
	notifyWorkersSpy.mockClear();
});

// ---------------------------------------------------------------------------
// OGL character model mock — records every attribs.create() call
// ---------------------------------------------------------------------------
function makeOGLChar () {
	const created = [];
	const model = {
		id: 'char1',
		attribs: {
			create: (data) => {
				created.push({ name: data.name, current: data.current });
				return { save: () => {} };
			},
			toJSON: () => created.map((a, i) => ({ ...a, id: `a${i}` })),
			get: () => null,
		},
	};
	return {
		model,
		getCreated: () => created,
		findAttr:   (name) => created.find(a => a.name === name),
	};
}

// ---------------------------------------------------------------------------
// CharacterAttributesProxy — loaded from dist, tests the real implementation
// ---------------------------------------------------------------------------
describe('CharacterAttributesProxy', () => {
	test('add() creates an attribute via model.attribs.create()', () => {
		const char  = makeOGLChar();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.add('test_attr', 'hello');
		expect(char.getCreated()).toHaveLength(1);
		expect(char.getCreated()[0]).toMatchObject({ name: 'test_attr', current: 'hello' });
	});

	test('add() creates multiple attributes in order', () => {
		const char  = makeOGLChar();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.add('first', '1');
		proxy.add('second', '2');
		proxy.add('third', '3');
		expect(char.getCreated().map(a => a.name)).toEqual(['first', 'second', 'third']);
	});

	test('addOrUpdate() creates attribute when it does not exist', () => {
		const char  = makeOGLChar();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.addOrUpdate('speed', '30');
		expect(char.findAttr('speed')).toMatchObject({ name: 'speed', current: '30' });
	});

	test('notifySheetWorkers() calls d20.journal.notifyWorkersOfAttrChanges', () => {
		const char  = makeOGLChar();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.add('some_attr', 'value');
		proxy.notifySheetWorkers();
		expect(notifyWorkersSpy).toHaveBeenCalledTimes(1);
		expect(notifyWorkersSpy).toHaveBeenCalledWith('char1', expect.arrayContaining(['some_attr']));
	});

	test('notifySheetWorkers() clears the changed-attrs list so a second call sends nothing', () => {
		const char  = makeOGLChar();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.add('a', '1');
		proxy.notifySheetWorkers();
		proxy.notifySheetWorkers();
		// second call should notify with empty list (or be called with char id + [])
		expect(notifyWorkersSpy).toHaveBeenCalledTimes(2);
		const secondCall = notifyWorkersSpy.mock.calls[1];
		expect(secondCall[1]).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// CharacterAttributesProxy — cache behaviour
// ---------------------------------------------------------------------------
describe('CharacterAttributesProxy — cache', () => {
	function makeTracked () {
		const char = makeOGLChar();
		let calls = 0;
		const real = char.model.attribs.toJSON;
		char.model.attribs.toJSON = () => { calls++; return real(); };
		return { char, toJSONCalls: () => calls };
	}

	test('findByName() calls toJSON() only once across multiple reads', () => {
		const { char, toJSONCalls } = makeTracked();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		proxy.findByName('x');
		proxy.findByName('y');
		proxy.findByName('z');
		expect(toJSONCalls()).toBe(1);
	});

	test('add() invalidates cache so the next read sees the new attribute', () => {
		const { char, toJSONCalls } = makeTracked();
		const proxy = new ctx.d20plus.importer.CharacterAttributesProxy(char);
		expect(proxy.findByName('speed')).toEqual({});        // seeds the cache (empty)
		proxy.add('speed', '30');                             // must invalidate
		expect(proxy.findByName('speed')).toMatchObject({ name: 'speed', current: '30' });
		expect(toJSONCalls()).toBe(2);                        // one before add, one after
	});
});

// ---------------------------------------------------------------------------
// importFeat — OGL sheet
// ---------------------------------------------------------------------------
describe('importFeat — OGL sheet', () => {
	test('creates four attributes for an OGL feat', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Alert', Vetoolscontent: 'First to act.' });
		expect(char.getCreated()).toHaveLength(4);
	});

	test('creates repeating_traits row with the feat name', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Lucky', Vetoolscontent: 'Reroll dice.' });
		expect(char.findAttr('repeating_traits_testRow_name')).toMatchObject({ current: 'Lucky' });
	});

	test('stores description from Vetoolscontent', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Tough', Vetoolscontent: 'HP bonus.' });
		expect(char.findAttr('repeating_traits_testRow_description')).toMatchObject({ current: 'HP bonus.' });
	});

	test('sets source to "Feat"', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Resilient', Vetoolscontent: '' });
		expect(char.findAttr('repeating_traits_testRow_source')).toMatchObject({ current: 'Feat' });
	});

	test('sets options-flag to "0"', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Alert', Vetoolscontent: '' });
		expect(char.findAttr('repeating_traits_testRow_options-flag')).toMatchObject({ current: '0' });
	});

	test('all four attribute names use the row ID from generateRowId()', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Observant', Vetoolscontent: '' });
		const names = char.getCreated().map(a => a.name);
		expect(names.every(n => n.includes('testRow'))).toBe(true);
	});

	test('calls notifySheetWorkers (d20.journal.notifyWorkersOfAttrChanges is invoked)', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'War Caster', Vetoolscontent: '' });
		expect(notifyWorkersSpy).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// importFeat — Shaped sheet
// ---------------------------------------------------------------------------
describe('importFeat — shaped sheet', () => {
	beforeEach(() => { ctx.d20plus.sheet = 'shaped'; });

	test('uses repeating_feat row, not repeating_traits', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Alert', Vetoolscontent: 'First.' });
		const names = char.getCreated().map(a => a.name);
		expect(names.some(n => n.startsWith('repeating_feat_'))).toBe(true);
		expect(names.some(n => n.startsWith('repeating_traits_'))).toBe(false);
	});

	test('creates _name field with feat name', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Lucky', Vetoolscontent: 'Reroll.' });
		expect(char.findAttr('repeating_feat_testRow_name')).toMatchObject({ current: 'Lucky' });
	});

	test('creates _content field with feat description', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Lucky', Vetoolscontent: 'Reroll.' });
		expect(char.findAttr('repeating_feat_testRow_content')).toMatchObject({ current: 'Reroll.' });
	});

	test('creates _content_toggle field set to "1"', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Sharpshooter', Vetoolscontent: '' });
		expect(char.findAttr('repeating_feat_testRow_content_toggle')).toMatchObject({ current: '1' });
	});

	test('creates exactly 3 attributes for shaped', () => {
		const char = makeOGLChar();
		ctx.d20plus.feats.importFeat(char, { name: 'Athlete', Vetoolscontent: '' });
		expect(char.getCreated()).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// importFeat — unsupported sheet
// ---------------------------------------------------------------------------
describe('importFeat — unsupported sheet', () => {
	test('creates no attributes for an unknown sheet type', () => {
		const char = makeOGLChar();
		ctx.d20plus.sheet = 'DnD5e_Character_Sheet';
		ctx.d20plus.feats.importFeat(char, { name: 'Alert', Vetoolscontent: '' });
		expect(char.getCreated()).toHaveLength(0);
	});
});
