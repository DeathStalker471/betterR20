// Shared spell-text-mechanic extraction, used by both:
//  - node/get-data-roll20.js (Node, pre-bakes data/spells/roll20.json + data2014/spells/roll20.json
//    for the classic/OGL sheet pipeline), via node/require-d20-module.js, which reads this file's
//    raw source directly - no `npm run build` required.
//  - js/5etools/2024/5etools-2024-spell-import.js (live browser import for the 2024/"Jumpgate" sheet).
//
// IMPORTANT: this file is loaded two different ways (see above), both of which depend on its exact
// shape. Do not add any code after the trailing `SCRIPT_EXTENSIONS.push(...)` line, and do not
// reference `d20plus`/`SCRIPT_EXTENSIONS` outside the wrapper function below - the Node loader
// extracts everything between the wrapper's braces and runs it standalone against stub globals.
function d20plusSpellParsers () {
	// Flattens a 5etools `entries` array (including one level of nested `.entries`) into a single
	// string, matching how node/get-data-roll20.js has always searched spell text for plain-prose
	// patterns (untagged flat numbers, "hit point" proximity, etc).
	function joinEntriesText (entriesArr) {
		return (entriesArr || []).map(txt => (txt && txt.entries && txt.entries.join()) || txt).join("");
	}

	// Strips only {@variantrule ...} tags (e.g. "{@variantrule Temporary Hit Points|XPHB}") down to
	// their display text. Deliberately narrow - only used by the flat-prose fallback parsers below
	// (parseFlatDamageFallback/parseFlatHealFallback), and deliberately does NOT strip every
	// {@\w+ ...} tag: an earlier, broader version of this also stripped {@damage}/{@dice}/{@d20}/
	// {@skill}/etc. tags, which exposed their inner dice/number text to the flat-fallback regexes
	// and produced wrong matches on long multi-effect spells (Control Water, Teleport, Bigby's Hand,
	// Symbol - all have incidental {@damage}-tagged or {@dice}-tagged numbers buried in unrelated
	// prose that aren't the spell's actual flat damage/healing amount). {@variantrule} is safe to
	// strip broadly because 2024 (XPHB) text uses it purely for glossary-linking plain nouns
	// ("Hit Points", "Temporary Hit Points", "Bonus Action") with no dice/numeric content of its
	// own - confirmed necessary live: XPHB Armor of Agathys is "You gain 5
	// {@variantrule Temporary Hit Points|XPHB}." - the tag sits directly between the number and
	// "hit points", breaking plain-adjacency prose regexes unless stripped first.
	function stripRefTags (text) {
		return text.replace(/\{@variantrule ([^|}]+)(?:\|[^}]*)?\}/g, "$1");
	}

	// Maps a 5etools areaTags entry to its full shape name. Matches the authoritative mapping
	// vendored in lib/parser.js (`Parser.SPELL_AREA_TYPE_TO_FULL`) - both prior independent copies
	// of this map (in get-data-roll20.js and 5etools-2024-spell-import.js) had the same bug (C
	// mapped to "Cone" instead of "Cube", R to "Rectangle" instead of "Circle", no "E"/Emanation),
	// caught via a real spell (Alarm, areaTag "C", is a cube).
	const AREA_TAG_TO_SHAPE = {C: "Cube", N: "Cone", Y: "Cylinder", S: "Sphere", R: "Circle", Q: "Square", L: "Line", H: "Hemisphere", W: "Wall", E: "Emanation"};
	function areaTagToShape (tag) {
		return AREA_TAG_TO_SHAPE[tag] || "";
	}

	// Extracts AoE size text from entry strings, e.g. "20-foot-radius" -> "20 foot radius".
	// Handles 3 phrasings 5etools spell text actually uses: the hyphenated form, "within N feet of
	// a point" (a radius, worded differently - e.g. Sleep), and "N feet on a side" (a square/cube -
	// e.g. Move Earth).
	function parseAoeSize (entriesArr) {
		for (const entry of (entriesArr || [])) {
			if (typeof entry !== "string") continue;
			let m = entry.match(/(\d+)[- ]foot[- ](radius|wide|long|tall|cone|line|cube)/i);
			if (m) return `${m[1]} foot ${m[2].toLowerCase()}`;
			m = entry.match(/within (\d+) feet of a point/i);
			if (m) return `${m[1]} foot radius`;
			m = entry.match(/(\d+) feet on a side/i);
			if (m) return `${m[1]} foot`;
		}
		return null;
	}

	// Returns the first {@damage XdY} (with optional flat bonus) found in a 5etools entries array,
	// or null. Dice count is optional (bare "{@damage d10}" means 1 die - e.g. Shillelagh).
	function parseFirstDamage (entriesArr) {
		for (const entry of (entriesArr || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\{@damage (\d*)d(\d+)(?:\s*([+-])\s*(\d+))?\}/i);
			if (m) { return {
				diceCount: m[1] ? parseInt(m[1], 10) : 1,
				diceSize: `d${m[2]}`,
				flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
			}; }
		}
		return null;
	}

	// For spells with multiple damage types, parses each {@damage XdY} tag alongside the damage
	// type keyword(s) that follow it in the text (including "X or Y" phrasing), correctly pairing
	// each dice roll with its real type regardless of order or count.
	function parseAllTypedDamages (entriesArr, damageInflict) {
		const capWord = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
		const knownTypes = (damageInflict || []).map(t => t.toLowerCase());
		const tagRe = /\{@damage (\d*)d(\d+)(?:\s*([+-])\s*(\d+))?\}/gi;

		for (const entry of (entriesArr || [])) {
			if (typeof entry !== "string") continue;

			const tags = [];
			let m;
			while ((m = tagRe.exec(entry)) !== null) {
				tags.push({
					diceCount: m[1] ? parseInt(m[1], 10) : 1,
					diceSize: `d${m[2]}`,
					flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
					tagStart: m.index,
					tagEnd: m.index + m[0].length,
				});
			}
			if (!tags.length) continue;

			// A single damage tag has nothing to disambiguate against - just report every listed
			// damage type, joined (e.g. Chromatic Orb: "You choose acid, cold, fire... the
			// creature takes {@damage 3d8} damage of the type you chose" - the choice list is
			// BEFORE the tag, so scanning the text after it would never find a match anyway).
			if (tags.length === 1) {
				const [tag] = tags;
				return [{diceCount: tag.diceCount, diceSize: tag.diceSize, flatBonus: tag.flatBonus, damageType: capWord(knownTypes.join(", "))}];
			}

			const orTypeRe = knownTypes.length > 1
				? new RegExp(`(${knownTypes.join("|")}) or (${knownTypes.join("|")})`)
				: null;

			return tags.map((tag, i) => {
				const contextEnd = i + 1 < tags.length ? tags[i + 1].tagStart : entry.length;
				const context = entry.slice(tag.tagEnd, contextEnd).toLowerCase();
				let damageType;
				const orMatch = orTypeRe && context.match(orTypeRe);
				if (orMatch) {
					damageType = `${capWord(orMatch[1])} or ${capWord(orMatch[2])}`;
				} else {
					const single = knownTypes.find(t => context.includes(t));
					// Positional fallback (knownTypes[i]) only makes sense when there's one
					// listed type per tag. When the spell has exactly one type overall (e.g. a
					// second {@damage} tag for ongoing/repeat damage of the same element), that
					// one type applies regardless of tag position - don't index out of bounds.
					const positional = knownTypes.length === 1 ? knownTypes[0] : knownTypes[i];
					damageType = capWord(single || positional || "");
				}
				return {diceCount: tag.diceCount, diceSize: tag.diceSize, flatBonus: tag.flatBonus, damageType};
			});
		}
		return [];
	}

	// Flat (untagged) damage number written as plain prose, e.g. Armor of Agathys' "the creature
	// takes 5 cold damage" - no {@damage} tag at all. Callers should gate this on the spell already
	// being curated as dealing damage (`damageInflict`) to avoid matching unrelated numbers.
	function parseFlatDamageFallback (entriesArr) {
		const m = stripRefTags(joinEntriesText(entriesArr)).match(/(\d+)\s+(\w+)\s+damage\b/i);
		if (!m) return null;
		return {amount: m[1], damageType: m[2].charAt(0).toUpperCase() + m[2].slice(1)};
	}

	// Finds a healing dice amount: checks {@heal XdY} first (semantically unambiguous when
	// present), then falls back to a {@dice XdY} tag whose surrounding text actually mentions
	// "hit point" - avoids grabbing an unrelated dice roll elsewhere in the spell (Reincarnate's
	// race-table {@dice d100}, Temple of the Gods' ability-check-penalty {@dice d4} both being
	// "HL"-tagged for unrelated reasons is why a plain "first {@dice} tag" search is unsafe).
	function parseHealDice (entriesArr) {
		for (const entry of (entriesArr || [])) {
			if (typeof entry !== "string") continue;
			const mh = entry.match(/\{@heal (\d+)d(\d+)\}/i);
			if (mh) return {diceCount: parseInt(mh[1], 10), diceSize: `d${mh[2]}`, bonus: 0};
		}
		const text = joinEntriesText(entriesArr);
		const re = /\{@dice ([^}]+)\}/g;
		let m;
		while ((m = re.exec(text))) {
			const windowStart = Math.max(0, m.index - 60);
			const windowEnd = Math.min(text.length, m.index + m[0].length + 60);
			if (!/hit point/i.test(text.slice(windowStart, windowEnd))) continue;
			const dm = m[1].match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i);
			if (dm) { return {
				diceCount: parseInt(dm[1], 10),
				diceSize: `d${dm[2]}`,
				bonus: dm[3] && dm[4] ? (dm[3] === "+" ? 1 : -1) * parseInt(dm[4], 10) : 0,
			}; }
		}
		return null;
	}

	// Flat (untagged) healing number written as plain prose - no {@dice}/{@heal} tag at all.
	// Covers actual healing ("Heal", 2014/PHB text: "regain 70 hit points"), temporary HP grants
	// ("Armor of Agathys": "gain 5 temporary hit points" - a THP spell "gains", not "regains"), and
	// the 2024/XPHB rewrite's "restor(e|ing)" verb ("Heal", 2024 text: "restoring 70 Hit Points").
	// Callers should gate this on the spell's "HL"/"THP" miscTags.
	function parseFlatHealFallback (entriesArr) {
		const m = stripRefTags(joinEntriesText(entriesArr)).match(/(?:(?:re)?gains?|restores?|restoring)\s+(\d+)\s+(?:temporary )?hit points?/i);
		return m ? m[1] : null;
	}

	// Returns {base, startingLevel, stepLevels, diceCount, diceSize} from a {@scaledice}/
	// {@scaledamage} tag, or null. Handles both the explicit level-list form
	// ({@scaledamage base|5,11,17|1d6}, computing real stepLevels from the level deltas) and the
	// range form ({@scaledamage base|1-9|1d6}, parsing free text like "every two slot levels" for
	// the step, with word-number support). `base` is the tag's own leading dice/value text
	// (sometimes semicolon-joined for multi-component spells) - callers that need to associate an
	// upcast with a specific already-extracted Damage/Healing value can match against it.
	function parseUpcastDice (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				const mc = entry.match(/\{@scale(?:dice|damage) ([^|]+)\|(\d+(?:,\d+)+)\|(\d+)d(\d+)\}/i);
				if (mc) {
					const levels = mc[2].split(",").map(Number);
					const startingLevel = levels[1];
					const stepLevels = levels.length > 1 ? levels[1] - levels[0] : 2;
					return {base: mc[1], startingLevel, stepLevels, diceCount: parseInt(mc[3], 10), diceSize: `d${mc[4]}`};
				}
				const mr = entry.match(/\{@scale(?:dice|damage) ([^|]+)\|(\d+)-\d+\|(\d+)d(\d+)\}/i);
				if (mr) {
					const startingLevel = parseInt(mr[2], 10) + 1;
					const wordNums = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
					const sm = entry.match(/every\s+(one|two|three|four|five|six|\d+)\s+(?:spell\s+)?slot\s+levels?/i);
					const stepLevels = sm ? (wordNums[sm[1].toLowerCase()] || parseInt(sm[1], 10) || 1) : 1;
					return {base: mr[1], startingLevel, stepLevels, diceCount: parseInt(mr[3], 10), diceSize: `d${mr[4]}`};
				}
			}
		}
		return null;
	}

	// Returns {value, startingLevel, stepLevels} from a {@scaledice}/{@scaledamage} tag whose
	// scaling amount is a flat number rather than dice notation - the 2024/XPHB rewrite of Heal
	// uses "{@scaledice 70|6-9|10}" (heals 70 at 6th level, +10 flat per slot level above 6th, no
	// "NdM" anywhere). parseUpcastDice's regexes require a trailing "NdM" and correctly don't match
	// this shape, so this is a separate tier tried between it and the plain-prose
	// parseFlatUpcastBonus fallback.
	function parseFlatUpcastTag (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				const mc = entry.match(/\{@scale(?:dice|damage) [^|]+\|(\d+(?:,\d+)+)\|(\d+)\}/i);
				if (mc) {
					const levels = mc[1].split(",").map(Number);
					const startingLevel = levels[1];
					const stepLevels = levels.length > 1 ? levels[1] - levels[0] : 2;
					return {value: parseInt(mc[2], 10), startingLevel, stepLevels};
				}
				const mr = entry.match(/\{@scale(?:dice|damage) [^|]+\|(\d+)-\d+\|(\d+)\}/i);
				if (mr) {
					return {value: parseInt(mr[2], 10), startingLevel: parseInt(mr[1], 10) + 1, stepLevels: 1};
				}
			}
		}
		return null;
	}

	// Flat (non-dice) bonus added per slot level above some threshold, e.g. Armor of Agathys'
	// "the temporary hit points and the cold damage increase by 5 for each slot level above 1st"
	// or the more common "5 additional temporary hit points for each slot level above 1st".
	// Returns {value, startingLevel} as raw regex-captured strings (not parsed to numbers), matching
	// this codebase's existing convention for these fields.
	const FLAT_UPCAST_RES = [
		/(\d+) additional (?:temporary )?(?:hit points?|\w+ damage) for each (?:spell )?slot level above (\d+)/i,
		/increase(?:s)? by (\d+) for each (?:spell )?slot level above (\d+)/i,
	];
	function parseFlatUpcastBonus (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				for (const re of FLAT_UPCAST_RES) {
					const m = entry.match(re);
					if (m) return {value: m[1], startingLevel: m[2]};
				}
			}
		}
		return null;
	}

	// Trivial cantrip-scaling presence check (does this cantrip scale with character level at
	// all), matching the classic sheet's boolean-flag model - the classic sheet's
	// `spell_damage_progression` dropdown only supports a single "Cantrip Dice" value, not
	// per-level thresholds, so this deliberately does not attempt to extract real levels.
	function parseCantripScalingFlag (scalingLevelDice) {
		return scalingLevelDice ? "dice" : null;
	}

	// Returns number of projectiles for auto-hit spells (e.g. 3 for Magic Missile), or null if no
	// projectile word is found (so callers can gate auto-hit handling on a real projectile being
	// present, rather than treating "1" and "not found" the same).
	function parseRepeatCount (entriesArr) {
		const wordNums = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10};
		for (const entry of (entriesArr || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]*\b(?:dart|missile|bolt|beam|ray|orb|needle|lance|streak)s?\b/i);
			if (m) return wordNums[m[1].toLowerCase()] || parseInt(m[1], 10) || 1;
		}
		return null;
	}

	// Returns true if the higher-level text describes adding more projectiles per slot (not more
	// damage dice).
	function parseRepeatUpcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				if (/one more|additional|extra/i.test(entry) && /dart|missile|bolt|beam|ray/i.test(entry)) return true;
			}
		}
		return false;
	}

	d20plus.spellParsers = {
		areaTagToShape,
		parseAoeSize,
		parseFirstDamage,
		parseAllTypedDamages,
		parseFlatDamageFallback,
		parseHealDice,
		parseFlatHealFallback,
		parseUpcastDice,
		parseFlatUpcastTag,
		parseFlatUpcastBonus,
		parseCantripScalingFlag,
		parseRepeatCount,
		parseRepeatUpcast,
	};
}
SCRIPT_EXTENSIONS.push(d20plusSpellParsers);
