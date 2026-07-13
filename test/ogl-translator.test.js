'use strict';

const vm   = require('vm');
const { loadSectionFromDist } = require('./helpers/env');

// ---------------------------------------------------------------------------
// Load d20plus2024OGLTranslator from dist.
// The module is self-contained — it only needs d20plus.importer to attach to.
// ---------------------------------------------------------------------------
let translate;

beforeAll(() => {
	const env = { d20plus: { importer: {}, import2024: {} }, SCRIPT_EXTENSIONS: [], console };
	const ctx = vm.createContext(env);
	loadSectionFromDist(
		ctx,
		'function d20plus2024OGLTranslator()',
		'SCRIPT_EXTENSIONS.push(d20plus2024OGLTranslator);'
	);
	translate = ctx.d20plus.importer.translateOGLTo2024Store;
});

// ---------------------------------------------------------------------------
// Helper: build an attribs array from a flat key-value map
// ---------------------------------------------------------------------------
function attrs (map) {
	return Object.entries(map).map(([name, value]) => {
		if (typeof value === 'object' && value !== null && 'current' in value) {
			return { name, current: value.current, max: value.max };
		}
		return { name, current: value };
	});
}

function intsByType (store, type) {
	return Object.values(store.integrants.integrants).filter(i => i.type === type);
}

// ---------------------------------------------------------------------------
// generate2024Id (tested indirectly via integrant IDs)
// ---------------------------------------------------------------------------
describe('generate2024Id (via integrant IDs)', () => {
	test('integrant IDs are 21 characters long', () => {
		const store = translate([]);
		// Ability scores are always created — 6 of them
		const ids = Object.keys(store.integrants.integrants);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(id).toHaveLength(21);
	});

	test('integrant base.shortID is the first 9 chars of the id', () => {
		const store = translate([]);
		for (const [id, integrant] of Object.entries(store.integrants.integrants)) {
			expect(integrant.shortID).toBe(id.substring(0, 9));
		}
	});

	test('IDs use only the expected charset', () => {
		const store = translate([]);
		for (const id of Object.keys(store.integrants.integrants)) {
			expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/);
		}
	});
});

// ---------------------------------------------------------------------------
// Ability Scores
// ---------------------------------------------------------------------------
describe('Ability Scores', () => {
	test('creates 6 Ability Score integrants for an empty attribs list', () => {
		const store = translate([]);
		expect(intsByType(store, 'Ability Score')).toHaveLength(6);
	});

	test('parses all six ability scores from OGL attrs', () => {
		const store = translate(attrs({
			strength: '18', dexterity: '14', constitution: '16',
			intelligence: '10', wisdom: '12', charisma: '8',
		}));
		const scores = intsByType(store, 'Ability Score');
		const byAbility = Object.fromEntries(scores.map(s => [s.ability, s.valueFormula.flatValue]));
		expect(byAbility.Strength).toBe(18);
		expect(byAbility.Dexterity).toBe(14);
		expect(byAbility.Constitution).toBe(16);
		expect(byAbility.Intelligence).toBe(10);
		expect(byAbility.Wisdom).toBe(12);
		expect(byAbility.Charisma).toBe(8);
	});

	test('defaults to 10 when ability score attr is absent', () => {
		const store = translate([]);
		const scores = intsByType(store, 'Ability Score');
		for (const s of scores) expect(s.valueFormula.flatValue).toBe(10);
	});

	test('falls back to strength_base when strength is absent', () => {
		const store = translate(attrs({ strength_base: '20' }));
		const scores = intsByType(store, 'Ability Score');
		const str = scores.find(s => s.ability === 'Strength');
		expect(str.valueFormula.flatValue).toBe(20);
	});
});

// ---------------------------------------------------------------------------
// Hit Points
// ---------------------------------------------------------------------------
describe('Hit Points', () => {
	test('reads HP from max field of hp attribute', () => {
		const store = translate([{ name: 'hp', current: '45', max: '60' }]);
		const hp = intsByType(store, 'Hit Points')[0];
		expect(hp.valueFormula.flatValue).toBe(60);
	});

	test('falls back to hp current when max is absent', () => {
		const store = translate(attrs({ hp: '45' }));
		const hp = intsByType(store, 'Hit Points')[0];
		expect(hp.valueFormula.flatValue).toBe(45);
	});

	test('falls back to hp_max attr', () => {
		const store = translate(attrs({ hp_max: '55' }));
		const hp = intsByType(store, 'Hit Points')[0];
		expect(hp.valueFormula.flatValue).toBe(55);
	});

	test('sets store.hitpoints.currentHP to the parsed max', () => {
		const store = translate([{ name: 'hp', current: '30', max: '90' }]);
		expect(store.hitpoints.currentHP).toBe(90);
	});

	test('defaults to 10 when hp attr is absent', () => {
		const store = translate([]);
		const hp = intsByType(store, 'Hit Points')[0];
		expect(hp.valueFormula.flatValue).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Armor Class
// ---------------------------------------------------------------------------
describe('Armor Class', () => {
	test('reads AC from npc_ac', () => {
		const store = translate(attrs({ npc_ac: '17' }));
		const ac = intsByType(store, 'Armor Class')[0];
		expect(ac.valueFormula.flatValue).toBe(17);
	});

	test('falls back to ac attr', () => {
		const store = translate(attrs({ ac: '13' }));
		const ac = intsByType(store, 'Armor Class')[0];
		expect(ac.valueFormula.flatValue).toBe(13);
	});

	test('defaults to 10 when AC attr absent', () => {
		const store = translate([]);
		const ac = intsByType(store, 'Armor Class')[0];
		expect(ac.valueFormula.flatValue).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// parseNpcType (via store.about.characteristics)
// ---------------------------------------------------------------------------
describe('parseNpcType (via characteristics)', () => {
	test('empty npc_type gives Medium / Unknown / Unaligned', () => {
		const store = translate([]);
		expect(store.about.characteristics).toMatchObject({
			size: 'Medium', creatureType: 'Unknown', alignment: 'Unaligned',
		});
	});

	test('parses "Large humanoid, chaotic evil"', () => {
		const store = translate(attrs({ npc_type: 'Large humanoid, chaotic evil' }));
		expect(store.about.characteristics).toMatchObject({
			size: 'Large', creatureType: 'Humanoid', alignment: 'Chaotic Evil',
		});
	});

	test('parses "Medium undead, lawful neutral"', () => {
		const store = translate(attrs({ npc_type: 'Medium undead, lawful neutral' }));
		expect(store.about.characteristics).toMatchObject({
			size: 'Medium', creatureType: 'Undead', alignment: 'Lawful Neutral',
		});
	});

	test('parses "Huge dragon" with no alignment', () => {
		const store = translate(attrs({ npc_type: 'Huge dragon' }));
		expect(store.about.characteristics).toMatchObject({
			size: 'Huge', creatureType: 'Dragon', alignment: 'Unaligned',
		});
	});

	test('creatureType is also stored on store.character.creatureType', () => {
		const store = translate(attrs({ npc_type: 'Small fey, neutral' }));
		expect(store.character.creatureType).toBe('Fey');
	});

	test('challenge rating is stored on store.npc.challengeRating', () => {
		const store = translate(attrs({ npc_challenge: '5' }));
		expect(store.npc.challengeRating).toBe('5');
	});

	test('size recognition: Tiny', () => {
		const store = translate(attrs({ npc_type: 'Tiny construct, unaligned' }));
		expect(store.about.characteristics.size).toBe('Tiny');
	});

	test('size recognition: Gargantuan', () => {
		const store = translate(attrs({ npc_type: 'Gargantuan monstrosity, chaotic neutral' }));
		expect(store.about.characteristics.size).toBe('Gargantuan');
	});
});

// ---------------------------------------------------------------------------
// parseSpeeds (via Speed integrants)
// ---------------------------------------------------------------------------
describe('parseSpeeds', () => {
	test('creates a Walking 30 Speed integrant when npc_speed is absent', () => {
		const store = translate([]);
		const speeds = intsByType(store, 'Speed');
		expect(speeds).toHaveLength(1);
		expect(speeds[0].name).toBe('Walking');
		expect(speeds[0].valueFormula.flatValue).toBe(30);
	});

	test('parses a plain "30 ft." speed', () => {
		const store = translate(attrs({ npc_speed: '30 ft.' }));
		const speeds = intsByType(store, 'Speed');
		expect(speeds[0]).toMatchObject({ name: 'Walking', valueFormula: { flatValue: 30 } });
	});

	test('parses multiple comma-separated speeds', () => {
		const store = translate(attrs({ npc_speed: '30 ft., fly 60 ft., swim 40 ft.' }));
		const speeds = intsByType(store, 'Speed');
		const byType = Object.fromEntries(speeds.map(s => [s.name, s.valueFormula.flatValue]));
		expect(byType.Walking).toBe(30);
		expect(byType.Flying).toBe(60);
		expect(byType.Swimming).toBe(40);
	});

	test('maps climb and burrow movement types', () => {
		const store = translate(attrs({ npc_speed: 'climb 20 ft., burrow 10 ft.' }));
		const speeds = intsByType(store, 'Speed');
		const names = speeds.map(s => s.name);
		expect(names).toContain('Climbing');
		expect(names).toContain('Burrowing');
	});

	test('hover maps to Flying', () => {
		const store = translate(attrs({ npc_speed: 'hover 40 ft.' }));
		const speeds = intsByType(store, 'Speed');
		expect(speeds[0].name).toBe('Flying');
	});
});

// ---------------------------------------------------------------------------
// parseSenses (via Sense integrants)
// ---------------------------------------------------------------------------
describe('parseSenses', () => {
	test('creates no Sense integrants when npc_senses is absent', () => {
		const store = translate([]);
		expect(intsByType(store, 'Sense')).toHaveLength(0);
	});

	test('parses "darkvision 60 ft."', () => {
		const store = translate(attrs({ npc_senses: 'darkvision 60 ft.' }));
		const senses = intsByType(store, 'Sense');
		expect(senses).toHaveLength(1);
		expect(senses[0]).toMatchObject({ name: 'Darkvision', valueFormula: { flatValue: 60 } });
	});

	test('parses multiple senses', () => {
		const store = translate(attrs({ npc_senses: 'darkvision 120 ft., tremorsense 30 ft.' }));
		const senses = intsByType(store, 'Sense');
		const byName = Object.fromEntries(senses.map(s => [s.name, s.valueFormula.flatValue]));
		expect(byName.Darkvision).toBe(120);
		expect(byName.Tremorsense).toBe(30);
	});

	test('ignores senses not in the valid list', () => {
		// "passive perception" is not a valid sense
		const store = translate(attrs({ npc_senses: 'darkvision 60 ft., passive Perception 15' }));
		const senses = intsByType(store, 'Sense');
		expect(senses).toHaveLength(1);
		expect(senses[0].name).toBe('Darkvision');
	});

	test('parses Blindsight and Truesight', () => {
		const store = translate(attrs({ npc_senses: 'blindsight 30 ft., truesight 60 ft.' }));
		const senses = intsByType(store, 'Sense');
		const names = senses.map(s => s.name);
		expect(names).toContain('Blindsight');
		expect(names).toContain('Truesight');
	});
});

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
describe('Languages', () => {
	test('creates Language integrants from npc_languages', () => {
		const store = translate(attrs({ npc_languages: 'Common, Elvish, Draconic' }));
		const langs = intsByType(store, 'Language');
		const names = langs.map(l => l.name);
		expect(names).toContain('Common');
		expect(names).toContain('Elvish');
		expect(names).toContain('Draconic');
	});

	test('creates no Language integrants when npc_languages is absent', () => {
		const store = translate([]);
		expect(intsByType(store, 'Language')).toHaveLength(0);
	});

	test('creates no Language integrants when npc_languages is empty string', () => {
		const store = translate(attrs({ npc_languages: '' }));
		expect(intsByType(store, 'Language')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Defenses
// ---------------------------------------------------------------------------
describe('Defenses', () => {
	test('creates Resistance Defense integrants from npc_resistances', () => {
		const store = translate(attrs({ npc_resistances: 'fire, cold' }));
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Resistance');
		const names = defs.map(d => d.damageType);
		expect(names).toContain('Fire');
		expect(names).toContain('Cold');
	});

	test('creates Immunity Defense integrants from npc_immunities', () => {
		const store = translate(attrs({ npc_immunities: 'poison, psychic' }));
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Immunity');
		const names = defs.map(d => d.damageType);
		expect(names).toContain('Poison');
		expect(names).toContain('Psychic');
	});

	test('creates Vulnerability Defense integrants from npc_vulnerabilities', () => {
		const store = translate(attrs({ npc_vulnerabilities: 'bludgeoning' }));
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Vulnerability');
		expect(defs[0].damageType).toBe('Bludgeoning');
	});

	test('creates Condition Immunity Defense integrants from npc_condition_immunities', () => {
		const store = translate(attrs({ npc_condition_immunities: 'charmed, frightened' }));
		const defs = intsByType(store, 'Defense').filter(d => d.defense === 'Condition Immunity');
		const types = defs.map(d => d.conditionType);
		expect(types).toContain('Charmed');
		expect(types).toContain('Frightened');
	});

	test('capitalizes damage type correctly', () => {
		const store = translate(attrs({ npc_resistances: 'FIRE' }));
		const defs = intsByType(store, 'Defense');
		expect(defs[0].damageType).toBe('Fire');
	});
});

// ---------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------
describe('Traits', () => {
	function traitAttrs (id, name, description) {
		return [
			{ name: `repeating_npctrait_${id}_name`,        current: name },
			{ name: `repeating_npctrait_${id}_description`, current: description },
		];
	}

	test('creates a Feature integrant from a repeating trait', () => {
		const store = translate(traitAttrs('abc123', 'Keen Senses', 'Advantage on Perception.'));
		const features = intsByType(store, 'Feature');
		expect(features).toHaveLength(1);
		expect(features[0].name).toBe('Keen Senses');
		expect(features[0].description).toBe('Advantage on Perception.');
	});

	test('ignores traits with no name', () => {
		const store = translate([{ name: 'repeating_npctrait_zz1_description', current: 'Some text' }]);
		expect(intsByType(store, 'Feature')).toHaveLength(0);
	});

	test('creates multiple traits', () => {
		const store = translate([
			...traitAttrs('t1', 'Pack Tactics', 'Advantage when ally is adjacent.'),
			...traitAttrs('t2', 'Rampage', 'Can make bonus bite attack.'),
		]);
		expect(intsByType(store, 'Feature')).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// Actions (non-attack)
// ---------------------------------------------------------------------------
describe('Actions (non-attack)', () => {
	function actionAttrs (id, name, description) {
		return [
			{ name: `repeating_npcaction_${id}_name`,        current: name },
			{ name: `repeating_npcaction_${id}_description`, current: description },
		];
	}

	test('creates an Action integrant for a non-attack action', () => {
		const store = translate(actionAttrs('a1', 'Multiattack', 'Makes two attacks.'));
		const actions = intsByType(store, 'Action');
		expect(actions).toHaveLength(1);
		expect(actions[0]).toMatchObject({ name: 'Multiattack', actionType: 'Action' });
	});

	test('action ID appears in actionDisplayOrder', () => {
		const store = translate(actionAttrs('x1', 'Breath Weapon', 'Exhales fire.'));
		const order = JSON.parse(store.actions.actionDisplayOrder);
		expect(order).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Attacks
// ---------------------------------------------------------------------------
describe('Attacks', () => {
	function attackAttrs (id, fields) {
		return Object.entries(fields).map(([k, v]) => ({
			name: `repeating_npcaction_${id}_${k}`, current: v,
		}));
	}

	test('creates an Attack integrant when attack_flag is on', () => {
		const store = translate(attackAttrs('atk1', {
			name:               'Longsword',
			attack_flag:        'on',
			attack_type:        'melee',
			attack_damage:      '2d6',
			attack_damagetype:  'slashing',
		}));
		const attacks = intsByType(store, 'Attack');
		expect(attacks).toHaveLength(1);
		expect(attacks[0].name).toBe('Longsword');
		expect(attacks[0].attack.type).toBe('Melee');
	});

	test('melee attack uses Strength ability bonus', () => {
		const store = translate(attackAttrs('m1', {
			name: 'Claw', attack_flag: 'on', attack_type: 'melee',
		}));
		const atk = intsByType(store, 'Attack')[0];
		expect(atk.attack.abilityBonus).toBe('Strength');
	});

	test('ranged attack uses Dexterity ability bonus', () => {
		const store = translate(attackAttrs('r1', {
			name: 'Longbow', attack_flag: 'on', attack_type: 'ranged',
		}));
		const atk = intsByType(store, 'Attack')[0];
		expect(atk.attack.abilityBonus).toBe('Dexterity');
	});

	test('creates a Damage child integrant for primary damage', () => {
		const store = translate(attackAttrs('d1', {
			name:              'Bite',
			attack_flag:       'on',
			attack_type:       'melee',
			attack_damage:     '1d6+3',
			attack_damagetype: 'piercing',
		}));
		const damages = intsByType(store, 'Damage');
		expect(damages).toHaveLength(1);
		expect(damages[0]).toMatchObject({
			diceCount: 1, diceSize: 'd6', _bonus: 3, damageType: 'Piercing',
		});
	});

	test('damage child parentID matches the attack integrant map key', () => {
		const store = translate(attackAttrs('p1', {
			name: 'Claws', attack_flag: 'on', attack_type: 'melee', attack_damage: '2d4',
		}));
		// parentID is set to the full 21-char map key (attackIntId), not shortID
		const attackEntry = Object.entries(store.integrants.integrants).find(([, v]) => v.type === 'Attack');
		const [attackId] = attackEntry;
		const damage = intsByType(store, 'Damage')[0];
		expect(damage.parentID).toBe(attackId);
	});

	test('creates two Damage integrants for secondary damage', () => {
		const store = translate(attackAttrs('s1', {
			name:               'Fire Bite',
			attack_flag:        'on',
			attack_type:        'melee',
			attack_damage:      '2d6',
			attack_damagetype:  'piercing',
			attack_damage2:     '1d8',
			attack_damagetype2: 'fire',
		}));
		const damages = intsByType(store, 'Damage');
		expect(damages).toHaveLength(2);
		const damageTypes = damages.map(d => d.damageType);
		expect(damageTypes).toContain('Piercing');
		expect(damageTypes).toContain('Fire');
	});

	test('attack ID appears in attackDisplayOrder', () => {
		const store = translate(attackAttrs('ord1', {
			name: 'Sword', attack_flag: 'on', attack_type: 'melee',
		}));
		const order = JSON.parse(store.attacks.attackDisplayOrder);
		expect(order).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Legendary / Mythic / Reactions
// ---------------------------------------------------------------------------
describe('Legendary Actions', () => {
	function legAttrs (id, name, description) {
		return [
			{ name: `repeating_npcaction-l_${id}_name`,        current: name },
			{ name: `repeating_npcaction-l_${id}_description`, current: description },
		];
	}

	test('creates an Action integrant with actionType Legendary', () => {
		const store = translate(legAttrs('l1', 'Wing Attack', 'Costs 2 actions.'));
		const actions = intsByType(store, 'Action').filter(a => a.actionType === 'Legendary');
		expect(actions).toHaveLength(1);
		expect(actions[0].name).toBe('Wing Attack');
	});

	test('ID appears in legendaryActionDisplayOrder', () => {
		const store = translate(legAttrs('l2', 'Tail Swipe', 'Melee attack.'));
		const order = JSON.parse(store.actions.legendaryActionDisplayOrder);
		expect(order).toHaveLength(1);
	});

	test('legendary action count defaults to 3 when attr absent', () => {
		const store = translate([]);
		expect(store.npc.legendaryActionCount).toBe(3);
	});

	test('reads legendary action count from npc_legendary_actions', () => {
		const store = translate(attrs({ npc_legendary_actions: '2' }));
		expect(store.npc.legendaryActionCount).toBe(2);
	});
});

describe('Mythic Actions', () => {
	function mythicAttrs (id, name, description) {
		return [
			{ name: `repeating_npcaction-m_${id}_name`,        current: name },
			{ name: `repeating_npcaction-m_${id}_description`, current: description },
		];
	}

	test('creates an Action integrant with actionType Mythic', () => {
		const store = translate(mythicAttrs('m1', 'Spore Cloud', 'Releases spores.'));
		const actions = intsByType(store, 'Action').filter(a => a.actionType === 'Mythic');
		expect(actions).toHaveLength(1);
		expect(actions[0].name).toBe('Spore Cloud');
	});

	test('ID appears in mythicActionDisplayOrder', () => {
		const store = translate(mythicAttrs('m2', 'Cry', 'Terrible cry.'));
		const order = JSON.parse(store.actions.mythicActionDisplayOrder);
		expect(order).toHaveLength(1);
	});
});

describe('Reactions', () => {
	function reactionAttrs (id, name, description) {
		return [
			{ name: `repeating_npcreaction_${id}_name`,        current: name },
			{ name: `repeating_npcreaction_${id}_description`, current: description },
		];
	}

	test('creates an Action integrant with actionType Reaction', () => {
		const store = translate(reactionAttrs('r1', 'Parry', 'Add 2 to AC against one attack.'));
		const actions = intsByType(store, 'Action').filter(a => a.actionType === 'Reaction');
		expect(actions).toHaveLength(1);
		expect(actions[0].name).toBe('Parry');
	});

	test('ID appears in reactionDisplayOrder', () => {
		const store = translate(reactionAttrs('r2', 'Uncanny Dodge', 'Halve damage.'));
		const order = JSON.parse(store.actions.reactionDisplayOrder);
		expect(order).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------
describe('Spells', () => {
	function spellAttrs (level, id, name, fields = {}) {
		const base = [
			{ name: `repeating_spell-${level}_${id}_spellname`, current: name },
			{ name: `repeating_spell-${level}_${id}_level`,     current: level },
		];
		for (const [k, v] of Object.entries(fields)) {
			base.push({ name: `repeating_spell-${level}_${id}_${k}`, current: v });
		}
		return base;
	}

	test('creates a Spell integrant for a repeating spell', () => {
		const store = translate(spellAttrs('1', 's1', 'Magic Missile'));
		const spells = intsByType(store, 'Spell');
		expect(spells).toHaveLength(1);
		expect(spells[0].name).toBe('Magic Missile');
		expect(spells[0].level).toBe(1);
	});

	test('cantrip level maps to index 0', () => {
		const store = translate(spellAttrs('cantrip', 'c1', 'Fire Bolt'));
		const spells = intsByType(store, 'Spell');
		expect(spells[0].level).toBe(0);
	});

	test('spell ID appears in the correct slot of store.spells.displayOrder', () => {
		const store = translate(spellAttrs('3', 'sp3', 'Fireball'));
		const slot3 = JSON.parse(store.spells.displayOrder[3]);
		expect(slot3).toHaveLength(1);
	});

	test('cantrip ID appears in slot 0 of displayOrder', () => {
		const store = translate(spellAttrs('cantrip', 'ct1', 'Prestidigitation'));
		const slot0 = JSON.parse(store.spells.displayOrder[0]);
		expect(slot0).toHaveLength(1);
	});

	test('ignores spell entries without spellname', () => {
		const store = translate([
			{ name: 'repeating_spell-1_x1_spelldescription', current: 'Some text' },
		]);
		expect(intsByType(store, 'Spell')).toHaveLength(0);
	});

	test('stores additional spell fields', () => {
		const store = translate(spellAttrs('2', 'shatter1', 'Shatter', {
			spellschool:       'Evocation',
			spellcastingtime:  'Action',
			spellrange:        '60 feet',
			spellcomp:         'V, S, M',
			spellduration:     'Instantaneous',
			spelldescription:  'A sudden loud ringing noise.',
		}));
		const spell = intsByType(store, 'Spell')[0];
		expect(spell.school).toBe('Evocation');
		expect(spell.castingTime).toBe('Action');
		expect(spell.range).toBe('60 feet');
	});
});

// ---------------------------------------------------------------------------
// Store structure
// ---------------------------------------------------------------------------
describe('Store structure', () => {
	test('returns all expected top-level sections', () => {
		const store = translate([]);
		const requiredSections = [
			'integrants', 'actions', 'attacks', 'spells', 'npc', 'npcEdit',
			'about', 'character', 'settings', 'hitpoints', 'classLevel',
			'currencies', 'effects', 'features', 'inspiration', 'inventory',
			'notes', 'proficiencies', 'rest', 'shop', 'spellSlots',
			'weaponMasteries', 'bastion', 'background',
		];
		for (const key of requiredSections) {
			expect(store).toHaveProperty(key);
		}
	});

	test('arrayPosition increments across integrants', () => {
		const store = translate(attrs({ npc_senses: 'darkvision 60 ft.', npc_languages: 'Common' }));
		const positions = Object.values(store.integrants.integrants).map(i => i.arrayPosition);
		const unique = new Set(positions);
		expect(unique.size).toBe(positions.length);
	});

	test('arrayPosition values start at 100', () => {
		const store = translate([]);
		const positions = Object.values(store.integrants.integrants).map(i => i.arrayPosition);
		expect(Math.min(...positions)).toBe(100);
	});
});
