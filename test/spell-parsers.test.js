'use strict';

// Unlike most test/*.test.js files, this doesn't need `npm run build` first - it loads
// js/5etools/5etools-spell-parsers.js directly from source via node/require-d20-module.js, the
// same loader node/get-data-roll20.js uses. See that file's header comment for why this works.

const path = require('path');
const requireD20Module = require('../node/require-d20-module');

let sp;

beforeAll(() => {
	sp = requireD20Module(path.join(__dirname, '../js/5etools/5etools-spell-parsers.js'), 'spellParsers');
});

// ---------------------------------------------------------------------------
// areaTagToShape
// ---------------------------------------------------------------------------
describe('areaTagToShape', () => {
	test('C maps to Cube, not Cone (regression: both prior independent copies of this map had this backwards)', () => {
		expect(sp.areaTagToShape('C')).toBe('Cube');
	});

	test('N maps to Cone', () => {
		expect(sp.areaTagToShape('N')).toBe('Cone');
	});

	test('R maps to Circle, not Rectangle', () => {
		expect(sp.areaTagToShape('R')).toBe('Circle');
	});

	test('E maps to Emanation', () => {
		expect(sp.areaTagToShape('E')).toBe('Emanation');
	});

	test('unknown tag returns empty string', () => {
		expect(sp.areaTagToShape('ZZ')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// parseAoeSize
// ---------------------------------------------------------------------------
describe('parseAoeSize', () => {
	test('hyphenated form: "20-foot-radius"', () => {
		expect(sp.parseAoeSize(['A blast in a 20-foot-radius sphere.'])).toBe('20 foot radius');
	});

	test('"within N feet of a point" phrasing (Sleep)', () => {
		expect(sp.parseAoeSize(['Creatures within 20 feet of a point you choose.'])).toBe('20 foot radius');
	});

	test('"N feet on a side" phrasing (Move Earth)', () => {
		expect(sp.parseAoeSize(['An area of terrain no larger than 40 feet on a side.'])).toBe('40 foot');
	});

	test('no match returns null', () => {
		expect(sp.parseAoeSize(['You touch a creature.'])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseFirstDamage / parseAllTypedDamages
// ---------------------------------------------------------------------------
describe('parseFirstDamage', () => {
	test('tagged dice with explicit count', () => {
		expect(sp.parseFirstDamage(['You deal {@damage 8d6} fire damage.']))
			.toEqual({diceCount: 8, diceSize: 'd6', flatBonus: 0});
	});

	test('bare dice with implied count of 1 (Shillelagh-style)', () => {
		expect(sp.parseFirstDamage(['The die becomes a {@damage d10}.']))
			.toEqual({diceCount: 1, diceSize: 'd10', flatBonus: 0});
	});

	test('flat bonus is captured separately, not embedded in diceSize', () => {
		expect(sp.parseFirstDamage(['The target takes {@damage 10d6 + 40} force damage.']))
			.toEqual({diceCount: 10, diceSize: 'd6', flatBonus: 40});
	});

	test('no {@damage} tag returns null', () => {
		expect(sp.parseFirstDamage(['You regain {@dice 1d8} hit points.'])).toBeNull();
	});
});

describe('parseAllTypedDamages', () => {
	test('single tag with a single known type', () => {
		const result = sp.parseAllTypedDamages(['The creature takes {@damage 8d6} fire damage.'], ['fire']);
		expect(result).toEqual([{diceCount: 8, diceSize: 'd6', flatBonus: 0, damageType: 'Fire'}]);
	});

	test('single tag joins all choosable types (Chromatic Orb: type chosen at cast time, listed before the tag)', () => {
		const entries = ['You choose acid, cold, fire, lightning, poison, or thunder. The creature takes {@damage 3d8} damage of the type you chose.'];
		const result = sp.parseAllTypedDamages(entries, ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder']);
		expect(result).toHaveLength(1);
		expect(result[0].damageType).toBe('Acid, cold, fire, lightning, poison, thunder');
	});

	test('two tags in the same entry with types mentioned after each (Ice Storm-style) pair correctly, in text order', () => {
		const entries = ['A creature takes {@damage 2d8} bludgeoning damage and {@damage 4d6} cold damage.'];
		const result = sp.parseAllTypedDamages(entries, ['bludgeoning', 'cold']);
		expect(result).toEqual([
			{diceCount: 2, diceSize: 'd8', flatBonus: 0, damageType: 'Bludgeoning'},
			{diceCount: 4, diceSize: 'd6', flatBonus: 0, damageType: 'Cold'},
		]);
	});

	test('no damageInflict at all still returns dice info with an empty damageType (Hunter\'s Mark-style)', () => {
		const result = sp.parseAllTypedDamages(['You deal an extra {@damage 1d6} damage.'], undefined);
		expect(result).toEqual([{diceCount: 1, diceSize: 'd6', flatBonus: 0, damageType: ''}]);
	});

	test('no {@damage} tags returns an empty array', () => {
		expect(sp.parseAllTypedDamages(['You touch a creature.'], ['fire'])).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// parseFlatDamageFallback / parseFlatHealFallback
// ---------------------------------------------------------------------------
describe('parseFlatDamageFallback', () => {
	test('untagged flat damage number in prose (Armor of Agathys)', () => {
		const entries = ['You gain 5 temporary hit points. A creature that hits you takes 5 cold damage.'];
		expect(sp.parseFlatDamageFallback(entries)).toEqual({amount: '5', damageType: 'Cold'});
	});

	test('no matching phrase returns null', () => {
		expect(sp.parseFlatDamageFallback(['You gain 5 temporary hit points.'])).toBeNull();
	});
});

describe('parseFlatHealFallback', () => {
	test('untagged flat healing number in prose (Heal)', () => {
		expect(sp.parseFlatHealFallback(['The creature regains 70 hit points.'])).toBe('70');
	});

	test('untagged flat temporary-HP number in prose, "gain" not "regain" (Armor of Agathys, 2014 text)', () => {
		expect(sp.parseFlatHealFallback(['You gain 5 temporary hit points for the duration.'])).toBe('5');
	});

	test('a {@variantrule} tag sitting between the number and "hit points" does not break the match (Armor of Agathys, 2024/XPHB text - caught via live Roll20 testing)', () => {
		const entries = ['Protective magical frost surrounds you. You gain 5 {@variantrule Temporary Hit Points|XPHB}. If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage.'];
		expect(sp.parseFlatHealFallback(entries)).toBe('5');
	});

	test('"restoring" verb, not "gain"/"regain" (Heal, 2024/XPHB text - caught via live Roll20 testing against real XPHB data, not the 2014 PHB text used for earlier tests)', () => {
		const entries = ['Choose a creature that you can see within range. Positive energy washes through the target, restoring 70 {@variantrule Hit Points|XPHB}.'];
		expect(sp.parseFlatHealFallback(entries)).toBe('70');
	});

	test('no matching phrase returns null', () => {
		expect(sp.parseFlatHealFallback(['You touch a creature.'])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseFlatUpcastTag
// ---------------------------------------------------------------------------
describe('parseFlatUpcastTag', () => {
	test('range form with a flat (non-dice) scaling value (Heal, 2024/XPHB text: "{@scaledice 70|6-9|10}")', () => {
		const entriesHigherLevel = [{entries: ['The healing increases by {@scaledice 70|6-9|10} for each spell slot level above 6.']}];
		expect(sp.parseFlatUpcastTag(entriesHigherLevel)).toEqual({value: 10, startingLevel: 7, stepLevels: 1});
	});

	test('a real "NdM" dice tag does not match (that is parseUpcastDice\'s job)', () => {
		const entriesHigherLevel = [{entries: ['The damage increases by {@scaledamage 8d6|5,11,17|1d6} at higher levels.']}];
		expect(sp.parseFlatUpcastTag(entriesHigherLevel)).toBeNull();
	});

	test('no scaling tag returns null', () => {
		expect(sp.parseFlatUpcastTag([{entries: ['Nothing scales here.']}])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseHealDice - regression coverage for the false-positive fix
// ---------------------------------------------------------------------------
describe('parseHealDice', () => {
	test('{@heal} tag is used directly', () => {
		expect(sp.parseHealDice(['You regain {@heal 1d8} hit points.']))
			.toEqual({diceCount: 1, diceSize: 'd8', bonus: 0});
	});

	test('{@dice} tag near "hit point" is treated as the healing amount', () => {
		expect(sp.parseHealDice(['A creature regains {@dice 1d8} hit points.']))
			.toEqual({diceCount: 1, diceSize: 'd8', bonus: 0});
	});

	test('{@dice} tag unrelated to healing is ignored (Reincarnate: a race-table roll)', () => {
		const entries = ['The DM rolls a {@dice d100} and consults the following table to determine the new race.'];
		expect(sp.parseHealDice(entries)).toBeNull();
	});

	test('{@dice} tag unrelated to healing is ignored (Temple of the Gods: an ability-check penalty)', () => {
		const entries = ['It must roll a {@dice d4} and subtract the number rolled from the check.'];
		expect(sp.parseHealDice(entries)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseUpcastDice
// ---------------------------------------------------------------------------
describe('parseUpcastDice', () => {
	test('level-list form ({@scaledamage base|5,11,17|1d6}) computes stepLevels from the deltas', () => {
		const entriesHigherLevel = [{entries: ['The damage increases by {@scaledamage 8d6|5,11,17|1d6} at higher levels.']}];
		const result = sp.parseUpcastDice(entriesHigherLevel);
		expect(result).toMatchObject({startingLevel: 11, stepLevels: 6, diceCount: 1, diceSize: 'd6'});
	});

	test('{@scaledice} tag is also recognized, not just {@scaledamage}', () => {
		const entriesHigherLevel = [{entries: ['The healing increases by {@scaledice 1d8|5,11,17|1d8} at higher levels.']}];
		const result = sp.parseUpcastDice(entriesHigherLevel);
		expect(result).toMatchObject({diceCount: 1, diceSize: 'd8'});
	});

	test('range form parses "every N slot levels" step text', () => {
		const entriesHigherLevel = [{entries: ['When cast with a slot of {@scaledamage 1d6|1-9|1d6} level or higher, damage increases by 1d6 for every two slot levels.']}];
		const result = sp.parseUpcastDice(entriesHigherLevel);
		expect(result).toMatchObject({startingLevel: 2, stepLevels: 2, diceCount: 1, diceSize: 'd6'});
	});

	test('no scaling tag returns null', () => {
		expect(sp.parseUpcastDice([{entries: ['Nothing scales here.']}])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseFlatUpcastBonus
// ---------------------------------------------------------------------------
describe('parseFlatUpcastBonus', () => {
	test('"increase(s) by N for each slot level above M" phrasing (Armor of Agathys)', () => {
		const entriesHigherLevel = [{entries: ['Both the temporary hit points and the cold damage increase by 5 for each slot level above 1st.']}];
		expect(sp.parseFlatUpcastBonus(entriesHigherLevel)).toEqual({value: '5', startingLevel: '1'});
	});

	test('"N additional ... for each slot level above M" phrasing', () => {
		const entriesHigherLevel = [{entries: ['You gain 5 additional temporary hit points for each slot level above 1st.']}];
		expect(sp.parseFlatUpcastBonus(entriesHigherLevel)).toEqual({value: '5', startingLevel: '1'});
	});

	test('no matching phrase returns null', () => {
		expect(sp.parseFlatUpcastBonus([{entries: ['Nothing scales here.']}])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseCantripScalingFlag
// ---------------------------------------------------------------------------
describe('parseCantripScalingFlag', () => {
	test('truthy scalingLevelDice returns "dice"', () => {
		expect(sp.parseCantripScalingFlag([{scaling: {1: '1d10'}}])).toBe('dice');
	});

	test('no scalingLevelDice returns null', () => {
		expect(sp.parseCantripScalingFlag(undefined)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseRepeatCount / parseRepeatUpcast
// ---------------------------------------------------------------------------
describe('parseRepeatCount', () => {
	test('word-number projectile count (Magic Missile)', () => {
		expect(sp.parseRepeatCount(['You create three darts of magical force.'])).toBe(3);
	});

	test('no projectile word returns null', () => {
		expect(sp.parseRepeatCount(['You deal 8d6 fire damage.'])).toBeNull();
	});
});

describe('parseRepeatUpcast', () => {
	test('detects "one more dart" style upcast text', () => {
		const entriesHigherLevel = [{entries: ['You create one more dart for each slot level above 1st.']}];
		expect(sp.parseRepeatUpcast(entriesHigherLevel)).toBe(true);
	});

	test('no matching phrase returns false', () => {
		expect(sp.parseRepeatUpcast([{entries: ['Nothing scales here.']}])).toBe(false);
	});
});
