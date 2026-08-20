// SPECIFYING PATH TO 5eTOOLS:
// Console: node get-data.js <path_to_5etools_root> <path_to_5e2014_root>
// OR create /node/path.js with the following contents:
// module.exports = {mirror5e: "<path_to_5etools_root>", mirror5e2014: "<path_to_5e2014_root>"}
// Omit second console argument / path.js.mirror5e2014 if you only want 2024+ updates

const process = require("process");
const fs = require("fs");
const path = require("path");
const beautify_html = require("js-beautify").js;
const requireD20Module = require("./require-d20-module");
const msg = console;

const pathFromFile = fs.existsSync("node/path.js") && require("./path.js");
const pathFromArg = process.argv[2];
const path2014FromArg = process.argv[3];
const SRC_PATH = pathFromFile.mirror5e || pathFromArg;
const SRC_2014_PATH = pathFromFile.mirror5e2014 || path2014FromArg;

if (!SRC_PATH) {
	msg.error(`We need the path to 5etools data to work`);
	process.exit(1);
}

// Shared spell-text-mechanic extraction, also used live by the browser's 2024 spell importer
// (js/5etools/2024/5etools-2024-spell-import.js) - see js/5etools/5etools-spell-parsers.js.
const {
	areaTagToShape,
	parseAoeSize,
	parseAllTypedDamages,
	parseFlatDamageFallback,
	parseHealDice,
	parseFlatHealFallback,
	parseUpcastDice,
	parseFlatUpcastBonus,
	parseCantripScalingFlag,
} = requireD20Module(path.join(__dirname, "..", "js/5etools/5etools-spell-parsers.js"), "spellParsers");

const toUpperFirst = (str) => {
	return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

// Renders a parsed dice result back to the same "XdY + Z" string shape the old raw-regex capture
// produced (e.g. Disintegrate's "10d6 + 40") - the structured parsers return the flat bonus as a
// separate number, which must be re-appended here rather than dropped.
const formatDice = (diceCount, diceSize, bonus) => {
	const base = `${diceCount}${diceSize}`;
	if (!bonus) return base;
	return `${base} ${bonus > 0 ? "+" : "-"} ${Math.abs(bonus)}`;
}

const processSpells = (spellDir) => {
	const spellData = [];

	fs.readdirSync(spellDir)
		.filter(f => f.endsWith(".json")
			&& !f.startsWith("fluff-") // && f === "spells-phb.json"
			&& !["index.json", "roll20.json", "sources.json"].includes(f))
		.forEach(f => {
			const spellsRaw = fs.readFileSync(`${spellDir}${f}`);
			const spells = JSON.parse(spellsRaw)?.spell;

			spells.forEach(spell => {
				const data = {};
				const entries = spell.entries.map(txt => (txt.entries && txt.entries.join()) || txt).join();

				spell.savingThrow && (data.Save = toUpperFirst(spell.savingThrow[0]));

				const typedDamages = parseAllTypedDamages(spell.entries, spell.damageInflict);
				if (typedDamages.length) {
					data["Damage"] = formatDice(typedDamages[0].diceCount, typedDamages[0].diceSize, typedDamages[0].flatBonus);
					// Only set when non-empty - a spell with no damageInflict at all (e.g. Hunter's
					// Mark, which uses whatever weapon type is already in play) legitimately has no
					// type to report, and should omit the field rather than write an empty string.
					if (typedDamages[0].damageType) data["Damage Type"] = typedDamages[0].damageType;
					// "hen you reach 5th" (i.e. "when you reach 5th [level]"): excludes cantrips whose
					// character-level damage-scaling text ends up as a 2nd {@damage} tag in the same
					// entry (e.g. Toll the Dead's "{@damage 1d12}" for a damaged target is an
					// *alternative* to its base "{@damage 1d8}", not a simultaneous secondary damage
					// type - pairing them as primary+secondary would be wrong).
					if (typedDamages[1] && !entries.includes("hen you reach 5th")) {
						data["Secondary Damage"] = formatDice(typedDamages[1].diceCount, typedDamages[1].diceSize, typedDamages[1].flatBonus);
						if (typedDamages[1].damageType) data["Secondary Damage Type"] = typedDamages[1].damageType;
					}
					entries.toLowerCase().includes("on a successful") && (entries.includes("half damage") || entries.includes("half as much")) && (data["Save Success"] = "Half damage");
					spell.spellAttack && (data["Spell Attack"] = spell.spellAttack[0] === "M" ? "Melee" : "Ranged");
				} else {
					// Preserves legacy tolerance for compound/bare dice expressions the shared
					// structured parser can't decompose into a single dice-count/size pair (e.g.
					// Chaos Bolt's "{@damage 2d8 + 1d6}" - a two-dice-term expression whose damage
					// type is chosen randomly, so there's no single type to pair it with anyway).
					const legacyDamageMatch = entries.match(/\{@damage ([^}]+)\}/);
					if (legacyDamageMatch) {
						data["Damage"] = legacyDamageMatch[1];
						spell.damageInflict?.length && (data["Damage Type"] = toUpperFirst(spell.damageInflict.join(", ")));
						entries.toLowerCase().includes("on a successful") && (entries.includes("half damage") || entries.includes("half as much")) && (data["Save Success"] = "Half damage");
						spell.spellAttack && (data["Spell Attack"] = spell.spellAttack[0] === "M" ? "Melee" : "Ranged");
					}
				}

				if (spell.miscTags?.includes("HL")) {
					const healDice = parseHealDice(spell.entries);
					if (healDice) data["Healing"] = formatDice(healDice.diceCount, healDice.diceSize, healDice.bonus);
				}
				// Flat (untagged) damage/healing numbers written as plain prose, e.g. Armor of
				// Agathys' "the creature takes 5 cold damage" or Heal's "regain 70 hit points" -
				// no {@damage}/{@dice} tag at all. Gated on the spell already being curated as
				// dealing that kind of effect (damageInflict / "HL" miscTag) and only tried when
				// the tagged extraction above found nothing, to avoid matching unrelated numbers.
				if (!data["Damage"] && spell.damageInflict?.length) {
					const flatDmg = parseFlatDamageFallback(spell.entries);
					if (flatDmg) {
						data["Damage"] = flatDmg.amount;
						data["Damage Type"] = flatDmg.damageType;
					}
				}
				if (!data["Healing"] && spell.miscTags?.includes("HL")) {
					const flatHeal = parseFlatHealFallback(spell.entries);
					if (flatHeal) data["Healing"] = flatHeal;
				}
				if (entries.includes("spellcasting ability modifier")) {
					data["Add Casting Modifier"] = "Yes";
				}

				const upcast = parseUpcastDice(spell.entriesHigherLevel);
				if (upcast) {
					const base = upcast.base.split(";");
					if (base.includes(data["Damage"]) || base.includes(data["Healing"])) {
						data["Higher Spell Slot Die"] = upcast.diceSize;
						data["Higher Spell Slot Dice"] = String(upcast.diceCount);
					}
					if (base.includes(data["Secondary Damage"]) && data["Damage"] !== data["Secondary Damage"]) {
						data["Secondary Higher Spell Slot Die"] = upcast.diceSize;
						data["Secondary Higher Spell Slot Dice"] = String(upcast.diceCount);
					}
				}
				const cantripFlag = parseCantripScalingFlag(spell.scalingLevelDice);
				if (cantripFlag) data["data-Cantrip Scaling"] = cantripFlag;

				const aoeShape = spell.areaTags?.length ? areaTagToShape(spell.areaTags[0]) : "";
				const aoeSize = parseAoeSize(spell.entries);
				if (aoeShape && aoeSize) {
					// aoeSize sometimes already ends in the shape word itself (e.g. "20 foot cube"
					// for a Cube) rather than a dimension word (radius/wide/long/tall) - avoid
					// duplicating it as "20 foot cube Cube".
					const sizeWords = aoeSize.split(" ");
					if (sizeWords[sizeWords.length - 1].toLowerCase() === aoeShape.toLowerCase()) {
						sizeWords[sizeWords.length - 1] = aoeShape;
						data["Target"] = sizeWords.join(" ");
					} else {
						data["Target"] = `${aoeSize} ${aoeShape}`;
					}
				}

				// Only set a flat per-level bonus where we don't already have a dice-based
				// upcast (`Higher Spell Slot Die`/`Dice`) - the two are mutually exclusive ways
				// a spell can scale with slot level.
				if (!data["Higher Spell Slot Dice"] && (data["Damage"] || data["Healing"])) {
					const flatBonus = parseFlatUpcastBonus(spell.entriesHigherLevel);
					if (flatBonus) data["Higher Spell Slot Bonus"] = flatBonus.value;
				}

				Object.keys(data).length && spellData.push({
					name: spell.name,
					source: spell.source,
					data,
				})
			})
		});

	const spellFile = beautify_html(JSON.stringify({spell: spellData}), {
		indent_with_tabs: true,
		brace_style: "expand",
		jslint_happy: false,
		space_in_empty_paren: true,
		keep_array_indentation: true,
	})
		.replace(/":([\n,\t]*)\{\}/g, `": {}`)
		.replace(/":([\n,\t]*)\{/g, `": {`);

	fs.writeFileSync(`${spellDir}roll20.json`, spellFile);
	msg.log(`Processed roll20 spells (${spellDir})`);
}

// `data2014/` mirrors `data/`'s structure (see node/get-data.js) - process it too whenever it's
// present locally, so the 2014-ruleset build's spell metadata doesn't silently go stale relative
// to the 2024 build's.
const processAllSpells = () => {
	processSpells("data/spells/");
	if (fs.existsSync("data2014/spells/")) processSpells("data2014/spells/");
}

if (require.main === module) {
	processAllSpells();
	msg.log("Done!");
}

module.exports = processAllSpells;
