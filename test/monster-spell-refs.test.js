'use strict';

// Tests for the two pure helpers inside import2024Spells (5etools-2024-monster-import.js).
// Both are private closures so they are mirrored here exactly as they appear in source.

// ---------------------------------------------------------------------------
// parseSpellTag — extracts name and source from a 5etools {@spell} tag string.
// ---------------------------------------------------------------------------

function parseSpellTag (sp) {
	if (typeof sp !== 'string') return null;
	const m = sp.match(/\{@spell ([^|}]+?)(?:\|([^}]+?))?}/i);
	if (!m) return null;
	return { name: m[1].trim(), source: (m[2] || 'PHB').trim() };
}

describe('parseSpellTag', () => {
	test('returns null for non-string input', () => {
		expect(parseSpellTag(null)).toBeNull();
		expect(parseSpellTag(42)).toBeNull();
		expect(parseSpellTag({ name: 'Fireball' })).toBeNull();
	});

	test('returns null for a string with no {@spell} tag', () => {
		expect(parseSpellTag('Fireball')).toBeNull();
		expect(parseSpellTag('{@creature Goblin}')).toBeNull();
		expect(parseSpellTag('')).toBeNull();
	});

	test('parses a bare spell name, defaulting source to "PHB"', () => {
		expect(parseSpellTag('{@spell Fireball}')).toEqual({ name: 'Fireball', source: 'PHB' });
	});

	test('parses a spell with an explicit source', () => {
		expect(parseSpellTag('{@spell Fireball|PHB}')).toEqual({ name: 'Fireball', source: 'PHB' });
	});

	test('parses a spell from a non-PHB source', () => {
		expect(parseSpellTag('{@spell Silvery Barbs|SCAG}')).toEqual({ name: 'Silvery Barbs', source: 'SCAG' });
	});

	test('trims whitespace from the parsed name and source', () => {
		expect(parseSpellTag('{@spell  Magic Missile | XPHB }')).toEqual({ name: 'Magic Missile', source: 'XPHB' });
	});

	test('is case-insensitive for the @spell tag keyword', () => {
		expect(parseSpellTag('{@SPELL Fireball}')).toEqual({ name: 'Fireball', source: 'PHB' });
	});

	test('parses a spell tag embedded in a larger string', () => {
		const result = parseSpellTag('Casts {@spell Lightning Bolt|PHB} at will.');
		expect(result).toEqual({ name: 'Lightning Bolt', source: 'PHB' });
	});

	test('parses multi-word spell names', () => {
		expect(parseSpellTag('{@spell Cone of Cold}')).toEqual({ name: 'Cone of Cold', source: 'PHB' });
	});

	test('stops at the pipe when a source is present (does not include source in name)', () => {
		const result = parseSpellTag('{@spell Detect Magic|PHB}');
		expect(result.name).toBe('Detect Magic');
		expect(result.source).toBe('PHB');
	});
});

// ---------------------------------------------------------------------------
// extractSpellRefs — collects all {@spell} tag strings from a spellcasting block.
// ---------------------------------------------------------------------------
const SLOT_KEYS = ['constant', 'will', 'rest', 'restLong', 'restShort', 'daily', 'weekly'];

function extractSpellRefs (sc) {
	const refs = [];
	SLOT_KEYS.forEach(k => {
		if (!sc[k]) return;
		Object.values(sc[k]).forEach(spOrArr => {
			(Array.isArray(spOrArr) ? spOrArr : [spOrArr]).forEach(sp => refs.push(sp));
		});
	});
	if (sc.spells) {
		Object.values(sc.spells).forEach(lvlData => {
			(lvlData.spells || []).forEach(sp => refs.push(sp));
		});
	}
	return refs;
}

describe('extractSpellRefs', () => {
	test('returns an empty array for a spellcasting block with no spells', () => {
		expect(extractSpellRefs({})).toEqual([]);
	});

	test('collects spells from the "will" slot key', () => {
		const sc = { will: { '0': ['{@spell Detect Magic}', '{@spell Invisibility}'] } };
		expect(extractSpellRefs(sc)).toEqual(['{@spell Detect Magic}', '{@spell Invisibility}']);
	});

	test('collects spells from the "daily" slot key', () => {
		const sc = { daily: { '1': ['{@spell Fireball}'] } };
		expect(extractSpellRefs(sc)).toEqual(['{@spell Fireball}']);
	});

	test('unwraps a single spell entry that is not an array', () => {
		const sc = { constant: { '0': '{@spell Thaumaturgy}' } };
		expect(extractSpellRefs(sc)).toEqual(['{@spell Thaumaturgy}']);
	});

	test('collects spells from the sc.spells slot-level map', () => {
		const sc = {
			spells: {
				1: { spells: ['{@spell Magic Missile}', '{@spell Shield}'] },
				3: { spells: ['{@spell Fireball}'] },
			},
		};
		expect(extractSpellRefs(sc)).toEqual([
			'{@spell Magic Missile}', '{@spell Shield}', '{@spell Fireball}',
		]);
	});

	test('collects from both slot keys and sc.spells together', () => {
		const sc = {
			will: { '0': ['{@spell Detect Magic}'] },
			spells: { 1: { spells: ['{@spell Shield}'] } },
		};
		const refs = extractSpellRefs(sc);
		expect(refs).toContain('{@spell Detect Magic}');
		expect(refs).toContain('{@spell Shield}');
	});

	test('collects from all SLOT_KEYS that are present', () => {
		const sc = {
			constant: { '0': ['{@spell A}'] },
			will:     { '0': ['{@spell B}'] },
			rest:     { '1': ['{@spell C}'] },
			daily:    { '1': ['{@spell D}'] },
		};
		const refs = extractSpellRefs(sc);
		expect(refs).toHaveLength(4);
		expect(refs).toContain('{@spell A}');
		expect(refs).toContain('{@spell D}');
	});

	test('sc.spells entries with no spells array contribute nothing', () => {
		const sc = { spells: { 0: {}, 1: { spells: ['{@spell Fireball}'] } } };
		expect(extractSpellRefs(sc)).toEqual(['{@spell Fireball}']);
	});

	test('handles multiple values in the same slot-key group', () => {
		const sc = { will: { '1': ['{@spell X}'], '2': ['{@spell Y}'] } };
		const refs = extractSpellRefs(sc);
		expect(refs).toContain('{@spell X}');
		expect(refs).toContain('{@spell Y}');
	});
});

// ---------------------------------------------------------------------------
// Round-trip: extractSpellRefs → parseSpellTag — the pipeline used in import2024Spells
// ---------------------------------------------------------------------------
describe('extractSpellRefs + parseSpellTag pipeline', () => {
	test('collects and parses a real-world dragon spellcasting block', () => {
		const sc = {
			spells: {
				1: { spells: ['{@spell Detect Magic|PHB}', '{@spell Sleep|PHB}'] },
				2: { spells: ['{@spell Invisibility|PHB}'] },
				3: { spells: ['{@spell Fireball|PHB}', '{@spell Lightning Bolt|PHB}'] },
			},
		};
		const refs   = extractSpellRefs(sc);
		const parsed = refs.map(parseSpellTag).filter(Boolean);
		expect(parsed).toHaveLength(5);
		expect(parsed.map(p => p.name)).toContain('Fireball');
		expect(parsed.map(p => p.source).every(s => s === 'PHB')).toBe(true);
	});

	test('deduplication: same spell appearing in multiple slots is parsed once per ref', () => {
		const sc = {
			will:  { '0': ['{@spell Fireball}'] },
			daily: { '1': ['{@spell Fireball}'] },
		};
		const refs   = extractSpellRefs(sc);
		const parsed = refs.map(parseSpellTag).filter(Boolean);
		expect(parsed).toHaveLength(2);
		const seen = new Set(parsed.map(p => `${p.name}|${p.source}`));
		expect(seen.size).toBe(1); // same spell, deduplicated downstream by import2024Spells
	});
});
