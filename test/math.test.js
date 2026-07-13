'use strict';

const vm   = require('vm');
const { loadSectionFromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// Load baseMath from dist
// ---------------------------------------------------------------------------
let math;

beforeAll(() => {
	const env = { d20plus: {}, SCRIPT_EXTENSIONS: [] };
	const ctx = vm.createContext(env);
	loadSectionFromDist(ctx, 'function baseMath ()', 'SCRIPT_EXTENSIONS.push(baseMath);');
	math = ctx.d20plus.math;
});

// ---------------------------------------------------------------------------
// vec2 — normalize
// ---------------------------------------------------------------------------
describe('vec2.normalize', () => {
	test('normalizes a 3-4-5 vector to unit length', () => {
		const out = [0, 0];
		math.vec2.normalize(out, [3, 4]);
		expect(out[0]).toBeCloseTo(0.6, 10);
		expect(out[1]).toBeCloseTo(0.8, 10);
	});

	test('zero vector is left unchanged', () => {
		const out = [99, 99];
		math.vec2.normalize(out, [0, 0]);
		expect(out[0]).toBe(99);
		expect(out[1]).toBe(99);
	});

	test('returns the out array', () => {
		const out = [0, 0];
		expect(math.vec2.normalize(out, [1, 0])).toBe(out);
	});
});

// ---------------------------------------------------------------------------
// vec2 — scale
// ---------------------------------------------------------------------------
describe('vec2.scale', () => {
	test('scales each component by scalar', () => {
		const out = [0, 0];
		math.vec2.scale(out, [2, 3], 5);
		expect(out).toEqual([10, 15]);
	});

	test('scale by 0 produces zero vector', () => {
		const out = [0, 0];
		math.vec2.scale(out, [7, -4], 0);
		expect(out).toEqual([0, -0]);
	});

	test('returns the out array', () => {
		const out = [0, 0];
		expect(math.vec2.scale(out, [1, 1], 2)).toBe(out);
	});
});

// ---------------------------------------------------------------------------
// vec2 — rotate
// ---------------------------------------------------------------------------
describe('vec2.rotate', () => {
	test('rotates [1,0] 90° around origin to [0,1]', () => {
		const out = [0, 0];
		math.vec2.rotate(out, [1, 0], [0, 0], Math.PI / 2);
		expect(out[0]).toBeCloseTo(0, 10);
		expect(out[1]).toBeCloseTo(1, 10);
	});

	test('rotates 180° around origin negates the vector', () => {
		const out = [0, 0];
		math.vec2.rotate(out, [3, 0], [0, 0], Math.PI);
		expect(out[0]).toBeCloseTo(-3, 10);
		expect(out[1]).toBeCloseTo(0, 10);
	});

	test('rotates around a non-origin pivot', () => {
		const out = [0, 0];
		// rotating [2,1] 90° around pivot [1,1] → [1,2]
		math.vec2.rotate(out, [2, 1], [1, 1], Math.PI / 2);
		expect(out[0]).toBeCloseTo(1, 10);
		expect(out[1]).toBeCloseTo(2, 10);
	});
});

// ---------------------------------------------------------------------------
// vec2 — add / sub / mult
// ---------------------------------------------------------------------------
describe('vec2.add', () => {
	test('adds two vectors component-wise', () => {
		const out = [0, 0];
		math.vec2.add(out, [1, 2], [3, 4]);
		expect(out).toEqual([4, 6]);
	});
});

describe('vec2.sub', () => {
	test('subtracts b from a component-wise', () => {
		const out = [0, 0];
		math.vec2.sub(out, [5, 3], [2, 1]);
		expect(out).toEqual([3, 2]);
	});
});

describe('vec2.mult', () => {
	test('multiplies two vectors element-wise', () => {
		const out = [0, 0];
		math.vec2.mult(out, [2, 3], [4, 5]);
		expect(out).toEqual([8, 15]);
	});
});

// ---------------------------------------------------------------------------
// vec2 — cross
// ---------------------------------------------------------------------------
describe('vec2.cross', () => {
	test('produces a 3D vector with x=y=0 and z=a×b', () => {
		const out = [99, 99, 99];
		math.vec2.cross(out, [3, 0], [0, 3]);
		expect(out[0]).toBe(0);
		expect(out[1]).toBe(0);
		expect(out[2]).toBe(9);   // 3*3 - 0*0
	});

	test('z is negative when winding reverses', () => {
		const out = [0, 0, 0];
		math.vec2.cross(out, [0, 3], [3, 0]);
		expect(out[2]).toBe(-9);
	});
});

// ---------------------------------------------------------------------------
// vec2 — len
// ---------------------------------------------------------------------------
describe('vec2.len', () => {
	test('returns the Euclidean length of a 3-4-5 vector', () => {
		expect(math.vec2.len([3, 4])).toBeCloseTo(5, 10);
	});

	test('zero vector has length 0', () => {
		expect(math.vec2.len([0, 0])).toBe(0);
	});

	test('unit vector on x-axis has length 1', () => {
		expect(math.vec2.len([1, 0])).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// doPolygonsIntersect
// ---------------------------------------------------------------------------
describe('doPolygonsIntersect', () => {
	// Two unit squares
	const squareA = [[0, 0], [1, 0], [1, 1], [0, 1]];
	const squareB = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]];
	const squareC = [[2, 0], [3, 0], [3, 1], [2, 1]];

	test('overlapping squares return true', () => {
		expect(math.doPolygonsIntersect(squareA, squareB)).toBe(true);
	});

	test('non-overlapping squares return false', () => {
		expect(math.doPolygonsIntersect(squareA, squareC)).toBe(false);
	});

	test('identical polygon intersects with itself', () => {
		expect(math.doPolygonsIntersect(squareA, squareA)).toBe(true);
	});

	test('triangle fully inside a square intersects', () => {
		const triangle = [[0.2, 0.2], [0.8, 0.2], [0.5, 0.8]];
		expect(math.doPolygonsIntersect(squareA, triangle)).toBe(true);
	});

	test('adjacent (touching-edge) squares return true', () => {
		// squareA right edge at x=1, squareD left edge at x=1 → sharing edge
		const squareD = [[1, 0], [2, 0], [2, 1], [1, 1]];
		expect(math.doPolygonsIntersect(squareA, squareD)).toBe(true);
	});
});
