class ScaleSummonedCreature {
	static _mutSimpleSpecialAcItem (acItem) {
		// Try to convert to "from" AC
		const mSimpleNatural = /^(\d+) \(natural armor\)$/i.exec(acItem.special);
		if (mSimpleNatural) {
			delete acItem.special;
			acItem.ac = Number(mSimpleNatural[1]);
			acItem.from = ["natural armor"];
		}
	}

	/** */
	static _mutSimpleSpecialHp (mon) {
		if (!mon.hp?.special) return;

		const cleanHp = mon.hp.special.toLowerCase().replace(/ /g, "");
		const mHp = /^(?<averagePart>\d+)(?<hdPart>\((?<dicePart>\d+d\d+)(?<bonusPart>[-+]\d+)?\))?$/.exec(cleanHp);

		if (!mHp) return;

		if (!mHp.groups.hdPart) return {average: Number(mHp.groups.averagePart)};

		mon.hp = {
			average: Number(mHp.groups.averagePart),
			formula: `${mHp.groups.dicePart}${mHp.groups.bonusPart ? mHp.groups.bonusPart.replace(/[-+]/g, " $0 ") : ""}`,
		};
	}

	static _getHpParts (str) {
		let ptBase = str; let ptHd = ""; let ptYourAbilMod = "";
		if (str.includes("(")) {
			let [start, ...rest] = str.split("(");
			rest = rest.join("(");
			if (rest.toLowerCase().includes("hit dice")) {
				ptBase = start.trim();
				ptHd = rest.trimAnyChar("() ");
			}
		}

		ptBase = ptBase
			.replace(/\+\s*your (?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i, (...m) => {
				ptYourAbilMod = m[0];
				return "";
			})
			.replace(/ +/g, " ")
			.trim();

		return {
			ptBase,
			ptHd,
			ptYourAbilMod,
		};
	}

	static _getAssembledHpParts ({ptBase, ptHd, ptYourAbilMod}) {
		// If there is an ability modifier part, we cannot scale purely by level--display an expression instead.
		if (ptYourAbilMod) {
			return `${ptBase} ${ptYourAbilMod}${ptHd ? ` (${ptHd})` : ""}`.trim();
		} else {
			return `${ptBase}${ptHd ? ` (${ptHd})` : ""}`.trim();
		}
	}
}

class ScaleSpellSummonedCreature extends ScaleSummonedCreature {
	static async scale (mon, toSpellLevel) {
		mon = MiscUtil.copyFast(mon);

		if (mon.summonedBySpellLevel == null) return mon;

		ScaleSpellSummonedCreature._WALKER = ScaleSpellSummonedCreature._WALKER || MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});

		const state = new ScaleSpellSummonedCreature._State({});

		mon._displayName = `${mon.name} (${Parser.getOrdinalForm(toSpellLevel)}-Level Spell)`;

		this._scale_ac(mon, toSpellLevel, state);
		this._scale_hp(mon, toSpellLevel, state);

		this._scale_traits(mon, toSpellLevel, state);
		this._scale_actions(mon, toSpellLevel, state);
		this._scale_bonusActions(mon, toSpellLevel, state);
		this._scale_reactions(mon, toSpellLevel, state);

		mon._summonedBySpell_level = toSpellLevel;
		mon._scaledSpellSummonLevel = toSpellLevel;
		mon._isScaledSpellSummon = true;

		return mon;
	}

	static _scale_ac (mon, toSpellLevel, state) {
		if (!mon.ac) return;

		mon.ac = mon.ac.map(it => {
			if (!it.special) return it;

			it.special = it.special
				// "11 + the level of the spell (natural armor)"
				// "11 + the spell's level"
				// "10 + 1 per spell level"
				.replace(/(\d+)\s*\+\s*(?:the level of the spell|the spell's level|1 per spell level)/g, (...m) => Number(m[1]) + toSpellLevel)
			;

			this._mutSimpleSpecialAcItem(it);

			return it;
		});
	}

	static _scale_hp (mon, toSpellLevel, state) {
		if (!mon.hp?.special) return;

		let {ptBase, ptHd, ptYourAbilMod} = this._getHpParts(mon.hp.special);

		ptBase = ptBase
			// "40 + 10 for each spell level above 4th"
			// "40 + 10 for each spell level above 4"
			.replace(/(?<hpBaseRaw>\d+)\s*\+\s*(?<hpBonusRaw>\d+) for each spell level above (?<spLevelThresholdRaw>\d+)(?:st|nd|rd|th)?/g, (...m) => {
				const {hpBaseRaw, hpBonusRaw, spLevelThresholdRaw} = m.at(-1);
				const spLevelThreshold = Number(spLevelThresholdRaw);
				if (toSpellLevel < spLevelThreshold) return Number(hpBaseRaw);
				return Number(hpBaseRaw) + (Number(hpBonusRaw) * (toSpellLevel - spLevelThreshold));
			})
			// "5 + 10 per spell level"
			.replace(/(\d+)\s*\+\s*(\d+) per spell level/g, (...m) => {
				const [, hpBase, hpPlus] = m;
				return Number(hpBase) + (Number(hpPlus) * Number(toSpellLevel));
			})
			// "equal the aberration's Constitution modifier + your spellcasting ability modifier + ten times the spell's level"
			.replace(/(ten) times the spell's level/g, (...m) => {
				const [, numMult] = m;
				return Parser.textToNumber(numMult) * toSpellLevel;
			})
		;

		// "20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2"
		ptBase = ptBase
			// Simplify bonus
			.replace(/\+\s*(\d+) for each spell level above (\d+)(?:st|nd|rd|th)?/g, (...m) => {
				const [, hpPlus, spLevelMin] = m;
				const bonus = Number(hpPlus) * (toSpellLevel - Number(spLevelMin));
				if (!bonus) return "";
				return `+ ${bonus}`;
			})
			.trim()
			// Apply bonus
			.replace(/^(?<ptsModes>(?:\d+ \([^)]+\)(?:,? or )?)+) \+\s*(?<bonus>\d+)$/g, (...m) => {
				const {ptsModes, bonus} = m.at(-1);
				const bonusNum = Number(bonus);
				return ptsModes
					.replace(/(\d+)(?= \([^)]+\))/g, (...m) => Number(m[0]) + bonusNum);
			})
		;

		if (ptHd) {
			ptHd = ptHd
				// "the swarm has a number of Hit Dice [d8s] equal to the spell's level"
				.replace(/(?<intro>.*) a number of hit dice \[d(?<hdSides>\d+)s?] equal to the spell's level/i, (...m) => {
					const {intro, hdSides} = m.at(-1);

					const hdFormula = `${toSpellLevel}d${hdSides}`;
					if (!ptYourAbilMod) return hdFormula;

					return `${intro} {@dice ${hdFormula}} Hit Dice`;
				})
			;
		}

		mon.hp.special = this._getAssembledHpParts({ptBase, ptHd, ptYourAbilMod});

		this._mutSimpleSpecialHp(mon);
	}

	static _scale_genericEntries (mon, toSpellLevel, state, prop) {
		if (!mon[prop]) return;
		mon[prop] = ScaleSpellSummonedCreature._WALKER.walk(
			mon[prop],
			{
				string: (str) => {
					str = str
						// "The aberration makes a number of attacks equal to half this spell's level (rounded down)."
						// "The spirit makes a number of attacks equal to half this spell's level (round down)."
						// ---
						// "The spirit makes a number of Rend attacks equal to half this spell's level (round down)."
						.replace(/a number of(?: (?<ptName>[^.!?]+))? attacks equal to half (?:this|the) spell's level \(round(?:ed)? down\)/g, (...m) => {
							const {ptName} = m.at(-1);

							const count = Math.floor(toSpellLevel / 2);

							return [
								Parser.numberToText(count),
								ptName,
								`attack${count === 1 ? "" : "s"}`,
							]
								.filter(Boolean)
								.join(" ");
						})
						// "{@damage 1d8 + 3 + summonSpellLevel}"
						.replace(/{@(?:dice|damage|hit|d20) [^}]+}/g, (...m) => {
							return m[0]
								.replace(/\bsummonSpellLevel\b/g, (...n) => toSpellLevel)
							;
						})
					;

					return str;
				},
			},
		);
	}

	static _scale_traits (mon, toSpellLevel, state) { this._scale_genericEntries(mon, toSpellLevel, state, "trait"); }
	static _scale_actions (mon, toSpellLevel, state) { this._scale_genericEntries(mon, toSpellLevel, state, "action"); }
	static _scale_bonusActions (mon, toSpellLevel, state) { this._scale_genericEntries(mon, toSpellLevel, state, "bonus"); }
	static _scale_reactions (mon, toSpellLevel, state) { this._scale_genericEntries(mon, toSpellLevel, state, "reaction"); }

	static _State = class {
		// (Implement as required)
		// this.whatever = null;
	};

	static _WALKER = null;
}

class ScaleClassSummonedCreature extends ScaleSummonedCreature {
	static async scale (mon, toClassLevel) {
		mon = MiscUtil.copyFast(mon);

		if ((!mon.summonedByClass && !mon.summonedScaleByPlayerLevel) || toClassLevel < 1) return mon;

		ScaleClassSummonedCreature._WALKER = ScaleClassSummonedCreature._WALKER || MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});

		const className = mon.summonedByClass ? mon.summonedByClass.split("|")[0].toTitleCase() : null;
		const state = new ScaleClassSummonedCreature._State({
			className,
			proficiencyBonus: Parser.levelToPb(toClassLevel),
		});

		mon._displayName = `${mon.name} (Level ${toClassLevel}${className ? ` ${className}` : ""})`;

		this._scale_ac(mon, toClassLevel, state);
		this._scale_hp(mon, toClassLevel, state);

		this._scale_saves(mon, toClassLevel, state);
		this._scale_skills(mon, toClassLevel, state);

		this._scale_pbNote(mon, toClassLevel, state);

		this._scale_traits(mon, toClassLevel, state);
		this._scale_actions(mon, toClassLevel, state);
		this._scale_bonusActions(mon, toClassLevel, state);
		this._scale_reactions(mon, toClassLevel, state);

		mon._summonedByClass_level = toClassLevel;
		mon._scaledClassSummonLevel = toClassLevel;
		mon._isScaledClassSummon = true;

		return mon;
	}

	static _scale_ac (mon, toClassLevel, state) {
		if (!mon.ac) return;

		mon.ac = mon.ac.map(it => {
			if (!it.special) return it;

			it.special = it.special
				// "13 + PB (natural armor)"
				// "13 plus PB (natural armor)"
				.replace(/(\d+)\s*(\+|plus)\s*PB\b/g, (...m) => Number(m[1]) + state.proficiencyBonus)
			;

			this._mutSimpleSpecialAcItem(it);

			return it;
		});
	}

	static _scale_getConvertedPbString (state, str, {isBonus = false} = {}) {
		let out = str
			.replace(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, (...m) => Parser.textToNumber(m[0]))
			.replace(/\bplus\b/gi, "+")
			.replace(/\btimes\b/, "*")
			.replace(/\b×\b/, "*")
			.replace(/(\b|[-+/*])PB\b/g, `$1${state.proficiencyBonus}`)
			.replace(/\bPB(d\d+)/g, `${state.proficiencyBonus}$1`)
			// eslint-disable-next-line no-eval
			.replace(/\b\d+\s*[/*]\s*\d+\b/g, (...n) => eval(n[0]))
			// eslint-disable-next-line no-eval
			.replace(/[-+]\s*\d+\s*[-+]\s*\d+\b/g, (...n) => eval(n[0]))
		;

		const reDice = /(\b(?:\d+)?d\d+\b)/g;
		let ix = 0;
		const outSimplified = out.split(reDice)
			.map(pt => {
				// Don't increase index for empty strings
				if (!pt.trim()) return pt;

				if (reDice.test(pt)) {
					ix++;
					return pt;
				}

				const simplified = Renderer.dice.parseRandomise2(pt);
				if (simplified != null) {
					if (ix) {
						ix++;
						return UiUtil.intToBonus(simplified);
					}
					ix++;
					return simplified;
				}

				ix++;
				return pt;
			})
			.join("")
			.replace(/\s*[-+]\s*/g, (...m) => ` ${m[0].trim()} `);

		if (!isNaN(outSimplified) && isBonus) return UiUtil.intToBonus(outSimplified);
		return outSimplified;
	}

	static _scale_savesSkills (mon, toClassLevel, state, prop) {
		mon[prop] = Object.entries(mon[prop])
			.mergeMap(([k, v]) => {
				if (typeof v !== "string") return {[k]: v};
				return {[k]: this._scale_getConvertedPbString(state, v, {isBonus: true})};
			});
	}

	static _scale_saves (mon, toClassLevel, state) {
		if (!mon.save) return;
		this._scale_savesSkills(mon, toClassLevel, state, "save");
	}

	static _scale_skills (mon, toClassLevel, state) {
		if (mon.passive != null) mon.passive = this._scale_getConvertedPbString(state, `${mon.passive}`);

		if (!mon.skill) return;
		this._scale_savesSkills(mon, toClassLevel, state, "skill");
	}

	static _scale_hp (mon, toClassLevel, state) {
		if (!mon.hp?.special) return;

		let {ptBase, ptHd, ptYourAbilMod} = this._getHpParts(mon.hp.special);

		ptBase = ptBase
			// "5 + five times your ranger level"
			// "5 plus five times your Ranger level"
			.replace(/(?<base>\d+)\s*(?:\+|plus)\s*(?<perLevel>\d+|[a-z]+) times your (?:(?<className>[^(]*) )?level/g, (...m) => {
				const numTimes = isNaN(m.last().perLevel) ? Parser.textToNumber(m.last().perLevel) : Number(m.last().perLevel);
				return `${Number(m.last().base) + (numTimes * toClassLevel)}`;
			})
			// "1 + <...> + your artificer level"
			.replace(/(?<base>\d+)\s*\+\s*your (?:(?<className>[^(]*) )?level/g, (...m) => {
				return `${Number(m.last().base) + toClassLevel}`;
			})
			// "equal the beast's Constitution modifier + five times your ranger level"
			.replace(/equal .*? Constitution modifier\s*\+\s*(?<perLevel>\d+|[a-z]+) times your (?:(?<className>[^(]*) )?level/g, (...m) => {
				const numTimes = isNaN(m.last().perLevel) ? Parser.textToNumber(m.last().perLevel) : Number(m.last().perLevel);
				return `${Parser.getAbilityModNumber(mon.con) + (numTimes * toClassLevel)}`;
			})
			// "Eight times their level"
			.replace(/\btheir level\b/gi, toClassLevel)
			// "7 + seven times caregiver's level"
			.replace(/\bcaregiver's level\b/gi, toClassLevel)
		;

		ptBase = this._scale_getConvertedPbString(state, ptBase);

		if (ptHd) {
			ptHd = ptHd
				// "the beast has a number of Hit Dice [d8s] equal to your ranger level"
				.replace(/(?<intro>.*) a number of hit dice \[d(?<hdSides>\d+)s?] equal to (?:your (?:(?<className>[^(]*) )?|their caregiver's |their )level/i, (...m) => {
					const {intro, hdSides, className} = m.at(-1);

					const hdFormula = `${toClassLevel}d${hdSides}`;
					if (!ptYourAbilMod) return hdFormula;

					return `${intro} {@dice ${hdFormula}} Hit Dice`;
				})
				// "(number of d8 Hit Dice equal to their caregiver's level)"
				.replace(/number of d(?<hdSides>\d+)s? hit dice equal to (?:your (?:(?<className>[^(]*) )?|their caregiver's |their )level/i, (...m) => {
					const {hdSides, className} = m.at(-1);

					const hdFormula = `${toClassLevel}d${hdSides}`;
					if (!ptYourAbilMod) return hdFormula;

					return `{@dice ${hdFormula}} Hit Dice`;
				})
			;
		}

		mon.hp.special = this._getAssembledHpParts({ptBase, ptHd, ptYourAbilMod});

		this._mutSimpleSpecialHp(mon);
	}

	static _scale_genericEntries (mon, toClassLevel, state, prop) {
		if (!mon[prop]) return;
		mon[prop] = ScaleClassSummonedCreature._WALKER.walk(
			mon[prop],
			{
				string: (str) => {
					str = str
						// "add your proficiency bonus"
						.replace(/add your proficiency bonus/gi, (...m) => {
							return `${m[0]} (${UiUtil.intToBonus(state.proficiencyBonus)})`;
						})
						// Merge " plus PB" into DC/dice tags, where simple
						.replace(/{@(?<tag>dice|damage|hit|d20|dc) (?<text>[^}]+)}(?<suffix> plus PB\b)/g, (...m) => {
							const {tag, text, suffix} = m.last();
							const [, ...ptsRest] = text.split("|");
							if (ptsRest.length) return m[0];

							return `{@${tag} ${text} ${suffix}}`;
						})
						// "{@damage 1d8 + 2 + PB}"
						.replace(/{@(?<tag>dice|damage|hit|d20|dc) (?<text>[^}]+)}/g, (...m) => {
							const {tag, text} = m.last();
							const [ptNumber, ...ptsRest] = text.split("|");

							const ptNumberOut = this._scale_getConvertedPbString(state, ptNumber);

							return `{@${tag} ${[ptNumberOut, ...ptsRest].join("|")}}`;
						})
						.replace(/(?<factor>\d+)\s*[×*]\s*PB\b/g, (...m) => {
							const {factor} = m.at(-1);
							return `${factor * state.proficiencyBonus}`;
						})
						.replace(/\bPB\s*[×*]\s*(?<factor>\d+)/g, (...m) => {
							const {factor} = m.at(-1);
							return `${factor * state.proficiencyBonus}`;
						})
						.replace(/\b(?<ptOp>\+\s*)?PB\b/g, (...m) => {
							const {ptOp} = m.at(-1);
							return `${(ptOp || "").trim()}${state.proficiencyBonus}`;
						})
					;

					return str;
				},
			},
		);
	}

	static _scale_traits (mon, toClassLevel, state) { this._scale_genericEntries(mon, toClassLevel, state, "trait"); }
	static _scale_actions (mon, toClassLevel, state) { this._scale_genericEntries(mon, toClassLevel, state, "action"); }
	static _scale_bonusActions (mon, toClassLevel, state) { this._scale_genericEntries(mon, toClassLevel, state, "bonus"); }
	static _scale_reactions (mon, toClassLevel, state) { this._scale_genericEntries(mon, toClassLevel, state, "reaction"); }

	static _scale_pbNote (mon, toClassLevel, state) {
		if (!mon.pbNote) return;

		mon.pbNote = mon.pbNote
			.replace(/equals (?:your|the mentor's|the caregiver's) (?:Proficiency )?bonus\b/i, (...m) => `${m[0]} [${UiUtil.intToBonus(state.proficiencyBonus, {isPretty: true})}]`);
	}

	static _State = class {
		constructor ({className, proficiencyBonus}) {
			this.className = className;
			this.proficiencyBonus = proficiencyBonus;
		}
	};

	static _WALKER = null;
}

class ScaleCreatureUtils {
	/**
	 * Calculate outVal based on a ratio equality.
	 *
	 *   inVal       outVal
	 * --------- = ----------
	 *  inTotal     outTotal
	 *
	 * @param inVal
	 * @param inTotal
	 * @param outTotal
	 * @returns {number} outVal
	 */
	static getScaledToRatio (inVal, inTotal, outTotal) {
		return Math.round(inVal * (outTotal / inTotal));
	}

	/* -------------------------------------------- */

	/**
	 * X in L-H
	 * --L---X------H--
	 *   \   \     |
	 *    \   \    |
	 *   --M---Y---I--
	 * to Y; relative position in M-I
	 * so (where D is "delta;" fractional position in L-H range)
	 * X = D(H - L) + L
	 *   => D = X - L / H - L
	 *
	 * @param x position within L-H space
	 * @param lh L-H is the original space (1 dimension; a range)
	 * @param mi M-I is the target space (1 dimension; a range)
	 * @returns {number} the relative position in M-I space
	 */
	static interpAndTranslateToSpace (x, lh, mi) {
		let [l, h] = lh;
		let [m, i] = mi;
		// adjust to avoid infinite delta
		const OFFSET = 0.1;
		l -= OFFSET; h += OFFSET;
		m -= OFFSET; i += OFFSET;
		const delta = (x - l) / (h - l);
		return Math.round((delta * (i - m)) + m); // round to nearest whole number
	}

	/* -------------------------------------------- */

	static _RE_HIT = /{@hit ([-+]?\d+)}/g;

	static applyPbDeltaToHit (str, pbDelta) {
		if (!pbDelta) return str;

		return str.replace(this._RE_HIT, (_, m1) => {
			const curToHit = Number(m1);
			const outToHit = curToHit + pbDelta;
			return `{@hit ${outToHit}}`;
		});
	}

	static _RE_DC_PLAINTEXT = /DC (\d+)/g;
	// Strip display text, as it may no longer be accurate
	static _RE_DC_TAG = /{@dc (\d+)(?:\|[^}]+)?}/g;

	static applyPbDeltaDc (str, pbDelta) {
		if (!pbDelta) return str;

		return str
			.replace(this._RE_DC_PLAINTEXT, (_, m1) => `{@dc ${m1}}`)
			.replace(this._RE_DC_TAG, (_, m1) => {
				const curDc = Number(m1);
				const outDc = curDc + pbDelta;
				return `{@dc ${outDc}}`;
			});
	}

	/* -------------------------------------------- */

	static getDiceExpressionAverage (diceExp) {
		diceExp = diceExp.replace(/\s*/g, "");
		const asAverages = diceExp.replace(/d(\d+)/gi, (...m) => {
			return ` * ${(Number(m[1]) + 1) / 2}`;
		});
		return MiscUtil.expEval(asAverages);
	}

	static getScaledDpr ({dprIn, crInNumber, dprTargetIn, dprTargetOut}) {
		if (crInNumber === 0) dprIn = Math.min(dprIn, 0.63); // cap CR 0 DPR to prevent average damage in the thousands
		return this.getScaledToRatio(dprIn, dprTargetIn, dprTargetOut);
	}
}

class ScaleCreatureState {
	constructor (mon) {
		this._abilityScoresOriginal = Object.fromEntries(Parser.ABIL_ABVS.map(ab => [ab, mon[ab]]));
		this._hasModifiedAbilityScore = Object.fromEntries(Parser.ABIL_ABVS.map(ab => [ab, false]));

		this._abilityModsTemp = Object.fromEntries(Parser.ABIL_ABVS.map(ab => [ab, null]));

		this._abilityModsCandidates = {};
		this.clearCandidateAbilityMods();
	}

	/* ----- */

	getOriginalScore (abv) { return this._abilityScoresOriginal[abv]; }

	/* ----- */

	setHasModifiedAbilityScore (abv) { this._hasModifiedAbilityScore[abv] = true; }
	getHasModifiedAbilityScore (abv) { return !!this._hasModifiedAbilityScore[abv]; }

	/* ----- */

	getTempAbilityMod (abv) { return this._abilityModsTemp[abv]; }
	setTempAbilityMod (abv, mod) { return this._abilityModsTemp[abv] = mod; }

	addCandidateAbilityMod (abv, mod) { return this._abilityModsCandidates[abv].push(mod); }
	hasCandidateAbilityMods (abv) { return !!this._abilityModsCandidates[abv].length; }
	getCandidateAbilityMods (abv) { return MiscUtil.copyFast(this._abilityModsCandidates[abv]); }
	clearCandidateAbilityMods () { this._abilityModsCandidates = Object.fromEntries(Parser.ABIL_ABVS.map(ab => [ab, []])); }
}

class CrScalerUtils {
	static crRangeToVal (cr, ranges) {
		return Object.keys(ranges).find(k => {
			const [a, b] = ranges[k];
			return cr >= a && cr <= b;
		});
	}

	/* -------------------------------------------- */

	static calcNewAbility (mon, prop, modifier) {
		// at least 1
		const out = Math.max(1,
			((modifier + 5) * 2)
			+ (mon[prop] % 2), // add trailing odd numbers from the original ability, just for fun
		);
		// Avoid breaking 30 unless we really mean to
		return out === 31 ? 30 : out;
	}

	/* -------------------------------------------- */

	static RNG = null;

	static init (mon, crOutNumber) {
		let h = CryptUtil.hashCode(crOutNumber);
		h = 31 * h + CryptUtil.hashCode(mon.source);
		h = 31 * h + CryptUtil.hashCode(mon.name);
		this.RNG = Math.seed(h);
	}
}

/**
 * @abstract
 */
class CrScalerBase {
	constructor (
		{
			mon,
			crInNumber,
			crOutNumber,
			pbIn,
			pbOut,
			state,
		},
	) {
		this._mon = mon;
		this._crInNumber = crInNumber;
		this._crOutNumber = crOutNumber;
		this._pbIn = pbIn;
		this._pbOut = pbOut;
		this._state = state;
	}

	/**
	 * @abstract
	 * @return {void}
	 */
	doAdjust () { throw new Error("Unimplemented!"); }
}

class ConfigSettingsGroup {
	constructor (
		{
			groupId,
			name,
			configSettings,
		},
	) {
		this._groupId = groupId;
		this._name = name;
		this._configSettings = configSettings;

		this._configSettings
			.forEach(configSetting => configSetting.setGroupId(this._groupId));
	}

	get groupId () { return this._groupId; }

	render (rdState, {isLast = false} = {}) {
		const wrpRows = ee`<div></div>`;

		ee`<div class="ve-w-100">
			<h4>${this._name}</h4>
			${wrpRows}
			${isLast ? null : `<hr class="ve-hr-3 ve-mb-1">`}
		</div>`
			.appendTo(rdState.wrp);

		this._configSettings
			.forEach(configSetting => configSetting.render(rdState, wrpRows));
	}

	mutDefaults (config) {
		const group = config[this._groupId] ||= {};
		this._configSettings
			.forEach(configSetting => configSetting.mutDefaults(group));
	}

	mutVerify (config) {
		const group = config[this._groupId] ||= {};
		this._configSettings
			.forEach(configSetting => configSetting.mutVerify(group));
	}
}

class UtilConfigHelpers {
	static packSettingId (groupId, configId) {
		return `${groupId}.${configId}`;
	}

	static unpackSettingId (settingId) {
		const [groupId, configId] = settingId.split(".");
		return {groupId, configId};
	}
}

// TODO rename this file

/** @abstract */
class _ConfigSettingBase {
	_groupId;
	_configId;
	_name;
	_help;

	_isRowLabel = false;
	_isReloadRequired = false;

	constructor (
		{
			configId,
			name,
			help,

			isRowLabel,
			isReloadRequired = false,
		} = {},
	) {
		this._configId = configId;
		this._name = name;
		this._help = help;
		this._isRowLabel = isRowLabel;
		this._isReloadRequired = isReloadRequired;
	}

	setGroupId (groupId) { this._groupId = groupId; }

	/* -------------------------------------------- */

	render (rdState, wrpRows) {
		const tag = this._isRowLabel ? "label" : "div";

		ee`<${tag} class="ve-py-1 ve-w-100 ve-split-v-center" title="${this._help.qq()}">
			${this._renderLabel(rdState)}
			${this._renderUi(rdState)}
		</${tag}>`
			.appendTo(wrpRows);
	}

	_renderLabel (rdState) {
		const ptReload = this._isReloadRequired ? `<span class="ve-ml-2 text-danger ve-small" title="Requires Refresh">‡</span>` : "";
		return `<div class="ve-w-66 ve-no-shrink ve-mr-2 ve-flex-v-center">${this._name}${ptReload}</div>`;
	}

	/**
	 * @abstract
	 * @return {HTMLElementExtended}
	 */
	_renderUi (rdState) { throw new Error("Unimplemented!"); }

	/* -------------------------------------------- */

	/** @abstract */
	mutDefaults (group) {
		throw new Error("Unimplemented!");
	}

	mutVerify (group) { /* Implement as required */ }
}

/** @abstract */
class ConfigSettingExternal extends _ConfigSettingBase {
	_renderUi (rdState) { return this._getEleExternal(); }

	/**
	 * @abstract
	 * @return {HTMLElementExtended}
	 */
	_getEleExternal () { throw new Error("Unimplemented!"); }

	mutDefaults (group) { /* No-op */ }
}

/** @abstract */
class _ConfigSettingStandardBase extends _ConfigSettingBase {
	_default;

	constructor (opts) {
		super(opts);
		this._default = opts.default;
	}

	mutDefaults (group) {
		if (group[this._configId] !== undefined) return;
		group[this._configId] = this._default;
	}
}

class ConfigSettingBoolean extends _ConfigSettingStandardBase {
	_renderUi (rdState) {
		const prop = UtilConfigHelpers.packSettingId(this._groupId, this._configId);
		return ComponentUiUtil.getCbBool(rdState.comp, prop);
	}
}

class ConfigSettingEnum extends _ConfigSettingStandardBase {
	_values;
	_fnDisplay;

	constructor ({values, fnDisplay, ...rest}) {
		super(rest);
		this._values = values;
		this._fnDisplay = fnDisplay;
	}

	_renderUi (rdState) {
		const prop = UtilConfigHelpers.packSettingId(this._groupId, this._configId);

		return ComponentUiUtil.getSelEnum(
			rdState.comp,
			prop,
			{
				values: this._values,
				fnDisplay: this._fnDisplay,
			},
		);
	}

	mutVerify (group) {
		if (this._values.includes(group[this._configId])) return;
		group[this._configId] = this._default;
	}
}

const SITE_STYLE__CLASSIC = "classic";
const SITE_STYLE__ONE = "one";

const SITE_STYLE_DISPLAY = {
	[SITE_STYLE__CLASSIC]: "Classic (5e/2014)",
	[SITE_STYLE__ONE]: "Modern (5.5e/2024)",
};

class StyleSwitcher {
	static _STORAGE_KEY_THEME = "StyleSwitcher_style";
	static _STORAGE_KEY_ROLLBOX = "StyleSwitcher_style-rollbox";
	static _STORAGE_KEY_WIDE = "StyleSwitcher_style-wide";

	static _STORAGE_KEYS = [
		this._STORAGE_KEY_THEME,
		this._STORAGE_KEY_ROLLBOX,
		this._STORAGE_KEY_WIDE,
	];

	static _STYLE_THEME_AUTOMATIC = "auto";
	static STYLE_THEME_DAY = "day";
	static _STYLE_THEME_NIGHT = "night";
	static _STYLE_THEME_NIGHT_ALT = "nightAlt";
	static _STYLE_THEME_NIGHT_CLEAN = "nightClean";

	static _CLASS_THEME_NIGHT = "ve-night-mode";
	static _CLASS_THEME_NIGHT_STANDARD = "ve-night-mode--standard";
	static _CLASS_THEME_NIGHT_ALT = "ve-night-mode--classic";
	static _CLASS_THEME_NIGHT_CLEAN = "ve-night-mode--clean";

	static _STYLE_ROLLBOX_DEFAULT = "default";
	static _STYLE_ROLLBOX_RIGHT = "right";
	static _STYLE_ROLLBOX_LEFT = "left";

	static _CLASS_ROLLBOX_DEFAULT = "ve-rollbox-mode--default";
	static _CLASS_ROLLBOX_RIGHT = "ve-rollbox-mode--right";
	static _CLASS_ROLLBOX_LEFT = "ve-rollbox-mode--left";

	static _WIDE_ID = "style-switch__wide";

	static _STYLE_THEME_TO_DISPLAY_NAME = {
		[this._STYLE_THEME_AUTOMATIC]: "Browser Default",
		[this.STYLE_THEME_DAY]: "Day Mode",
		[this._STYLE_THEME_NIGHT]: "Night Mode",
		[this._STYLE_THEME_NIGHT_ALT]: "Night Mode (Classic)",
		[this._STYLE_THEME_NIGHT_CLEAN]: "Night Mode (Clean)",
	};

	static _STYLE_ROLLBOX_TO_DISPLAY_NAME = {
		[this._STYLE_ROLLBOX_DEFAULT]: "Default",
		[this._STYLE_ROLLBOX_RIGHT]: "Right",
		[this._STYLE_ROLLBOX_LEFT]: "Left",
	};

	static _CLASSES_THEME = [
		this._CLASS_THEME_NIGHT,
		this._CLASS_THEME_NIGHT_STANDARD,
		this._CLASS_THEME_NIGHT_ALT,
		this._CLASS_THEME_NIGHT_CLEAN,
	];

	static _CLASSES_ROLLBOX = [
		this._CLASS_ROLLBOX_DEFAULT,
		this._CLASS_ROLLBOX_RIGHT,
		this._CLASS_ROLLBOX_LEFT,
	];

	/* -------------------------------------------- */

	static getSelStyle () {
		const selStyle = e_({
			tag: "select",
			clazz: "ve-form-control ve-input-xs",
			children: Object.entries(this._STYLE_THEME_TO_DISPLAY_NAME)
				.map(([id, name]) => ee`<option value="${id}">${name}</option>`),
			change: () => {
				styleSwitcher._setActiveStyleTheme(selStyle.val());
			},
		})
			.val(styleSwitcher._styleTheme);

		return selStyle;
	}

	/* -------------------------------------------- */

	static getSelRollboxPosition () {
		const selStyle = e_({
			tag: "select",
			clazz: "ve-form-control ve-input-xs",
			children: Object.entries(this._STYLE_ROLLBOX_TO_DISPLAY_NAME)
				.map(([id, name]) => ee`<option value="${id}">${name}</option>`),
			change: () => {
				styleSwitcher._setActiveStyleRollbox(selStyle.val());
			},
		})
			.val(styleSwitcher._styleRollbox);

		return selStyle;
	}

	/* -------------------------------------------- */

	static getCbWide () {
		const cbWide = e_({
			tag: "input",
			type: "checkbox",
			change: () => {
				styleSwitcher._setActiveWide(cbWide.checked);
			},
		});

		if (StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_WIDE) === "true") cbWide.checked = true;

		return cbWide;
	}

	/* -------------------------------------------- */

	_styleTheme;
	_styleRollbox;

	constructor () {
		if (typeof window === "undefined") return;
		this._setActiveStyleTheme(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_THEME) || StyleSwitcher._STYLE_THEME_AUTOMATIC);
		this._setActiveStyleRollbox(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_ROLLBOX) || StyleSwitcher._STYLE_ROLLBOX_DEFAULT);
		this._setActiveWide(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_WIDE) === "true");
	}

	getSummary () {
		return {isNight: this._getResolvedStyleTheme() !== StyleSwitcher.STYLE_THEME_DAY};
	}

	_fnsOnChangeTheme = [];
	addFnOnChangeTheme (fn) { this._fnsOnChangeTheme.push(fn); }

	// region Night Mode
	setTemporaryTheme (style) {
		if (style) this._setActiveStyleThemeClasses(style);
		else this._setActiveStyleThemeClasses(this._styleTheme);
	}

	_getResolvedStyleTheme () {
		if (this._styleTheme === StyleSwitcher._STYLE_THEME_AUTOMATIC) return this.constructor._getDefaultStyleTheme();
		return this._styleTheme;
	}

	static _getDefaultStyleTheme () {
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) return StyleSwitcher._STYLE_THEME_NIGHT;
		return StyleSwitcher.STYLE_THEME_DAY;
	}

	_setActiveStyleTheme (style) {
		this._styleTheme = style;
		const styleResolved = this._getResolvedStyleTheme();

		this._setActiveStyleThemeClasses(styleResolved);

		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_THEME, this._styleTheme);

		this._fnsOnChangeTheme.forEach(fn => fn());
	}

	_setActiveStyleThemeClasses (styleResolved) {
		this.constructor._CLASSES_THEME
			.forEach(clazzName => document.documentElement.classList.remove(clazzName));

		switch (styleResolved) {
			case StyleSwitcher.STYLE_THEME_DAY: {
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_STANDARD);
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT_ALT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_ALT);
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT_CLEAN: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_CLEAN);
				break;
			}
		}
	}

	getClassNamesStyleTheme () {
		switch (this._getResolvedStyleTheme()) {
			case StyleSwitcher.STYLE_THEME_DAY: return "";
			case StyleSwitcher._STYLE_THEME_NIGHT: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_STANDARD].join(" ");
			case StyleSwitcher._STYLE_THEME_NIGHT_ALT: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_ALT].join(" ");
			case StyleSwitcher._STYLE_THEME_NIGHT_CLEAN: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_CLEAN].join(" ");
		}
	}
	// endregion

	// region Rollbox
	_setActiveStyleRollbox (style) {
		this._styleRollbox = style;

		this.constructor._CLASSES_ROLLBOX
			.forEach(clazzName => document.documentElement.classList.remove(clazzName));

		switch (this._styleRollbox) {
			case StyleSwitcher._STYLE_ROLLBOX_DEFAULT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_DEFAULT);
				break;
			}
			case StyleSwitcher._STYLE_ROLLBOX_RIGHT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_RIGHT);
				break;
			}
			case StyleSwitcher._STYLE_ROLLBOX_LEFT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_LEFT);
				break;
			}
		}

		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_ROLLBOX, this._styleRollbox);
	}
	// endregion

	// region Wide Mode
	_setActiveWide (isActive) {
		const existing = document.getElementById(StyleSwitcher._WIDE_ID);
		if (!isActive) {
			document.documentElement.classList.remove(StyleSwitcher._WIDE_ID);
			if (existing) existing.parentNode.removeChild(existing);
		} else {
			document.documentElement.classList.add(StyleSwitcher._WIDE_ID);
			if (!existing) {
				const eleScript = document.createElement(`style`);
				eleScript.id = StyleSwitcher._WIDE_ID;
				eleScript.innerHTML = `
				/* region Book/Adventure pages */
				@media only screen and (min-width: 1600px) {
					#listcontainer.book-contents {
						position: relative;
					}

					.book-contents .contents {
						position: sticky;
					}
				}
				/* endregion */

				/* region Overwrite Bootstrap containers */
				@media (min-width: 768px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 992px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 1200px) {
					.container {
						width: 100%;
					}
				}
				/* endregion */`;
				document.documentElement.appendChild(eleScript);
			}
		}
		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_WIDE, isActive);
	}
	// endregion

	/* -------------------------------------------- */

	static syncGetStorageDump () {
		return Object.fromEntries(
			this._STORAGE_KEYS
				.map(storageKey => [storageKey, this.storage.getItem(storageKey)]),
		);
	}

	static syncSetFromStorageDump (dump) {
		if (!dump) return;
		this._STORAGE_KEYS
			.filter(storageKey => storageKey in dump)
			.forEach(storageKey => this.storage.setItem(storageKey, dump[storageKey]));
	}
}

try {
	StyleSwitcher.storage = window.localStorage;
} catch (e) { // cookies are disabled
	StyleSwitcher.storage = {
		getItem (k) {
			switch (k) {
				case StyleSwitcher._STORAGE_KEY_THEME: return StyleSwitcher._STYLE_THEME_AUTOMATIC;
				case StyleSwitcher._STORAGE_KEY_ROLLBOX: return StyleSwitcher._STYLE_ROLLBOX_DEFAULT;
				case StyleSwitcher._STORAGE_KEY_WIDE: return false;
			}
			return null;
		},

		setItem (k, v) {},
	};
}

const styleSwitcher = new StyleSwitcher();
globalThis.styleSwitcher = styleSwitcher;

const settingsGroupStyleSwitcher = new ConfigSettingsGroup({
	groupId: "styleSwitcher",
	name: "Appearance",
	configSettings: [
		new (
			class extends ConfigSettingExternal {
				_configId = "theme";
				_name = "Theme";
				_help = "The color theme to be applied.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getSelStyle(); }
			}
		)(),
		new ConfigSettingEnum({
			configId: "style",
			name: `<span>Style <span class="ve-small">(see also: <a href="https://2014.5e.tools" rel="noopener noreferrer" target="_blank">2014.5e.tools</a>)</span></span>`,
			help: `The styling to be applied when rendering specific information (stat blocks, etc.). Does not affect what content is available, only how it is displayed. See also: https://2014.5e.tools.`,
			isRowLabel: true,
			isReloadRequired: true,
			default: SITE_STYLE__ONE,
			values: [
				SITE_STYLE__CLASSIC,
				SITE_STYLE__ONE,
			],
			fnDisplay: it => SITE_STYLE_DISPLAY[it] || it,
		}),
		new (
			class extends ConfigSettingExternal {
				_configId = "styleRollbox";
				_name = "Dice Roller Position";
				_help = "The position of the dice roller.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getSelRollboxPosition(); }
			}
		)(),
		new (
			class extends ConfigSettingExternal {
				_configId = "isWideMode";
				_name = "Wide Mode (Experimental)";
				_help = "This feature is unsupported. Expect bugs.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getCbWide(); }
			}
		)(),
	],
});

const settingsGroupUi = new ConfigSettingsGroup({
	groupId: "ui",
	name: "UI",
	configSettings: [
		new ConfigSettingBoolean({
			configId: "isNotifyUpdates",
			name: `Show Notification on Update`,
			help: `If a notification should be shown when a background content update completes, prompting the user to reload and/or view the changelog.`,
			isRowLabel: true,
			default: true,
		}),
	],
});

const _MARKDOWN_TAG_RENDER_MODES = {
	"convertMarkdown": "Convert to Markdown",
	"ignore": "Leave As-Is",
	"convertText": "Convert to Text",
};

const settingsGroupMarkdown = new ConfigSettingsGroup({
	groupId: "markdown",
	name: "Markdown",
	configSettings: [
		new ConfigSettingEnum({
			configId: "tagRenderMode",
			name: `Tag Handling (<code>@tag</code>)`,
			help: `The output to produce when rendering a 5etools "@tag".`,
			isRowLabel: true,
			default: "convertMarkdown",
			values: [
				"convertMarkdown",
				"ignore",
				"convertText",
			],
			fnDisplay: it => _MARKDOWN_TAG_RENDER_MODES[it] || it,
		}),
		new ConfigSettingBoolean({
			configId: "isAddColumnBreaks",
			name: `Add GM Binder Column Breaks (<code>\\\\columnbreak</code>)`,
			help: `If "\\\\columnbreak"s should be added to exported Markdown, at an approximate column breakpoint.`,
			isRowLabel: true,
			default: false,
		}),
		new ConfigSettingBoolean({
			configId: "isAddPageBreaks",
			name: `Add GM Binder Page Breaks (<code>\\\\pagebreak</code>)`,
			help: `If "\\\\pagebreak"s should be added to exported Markdown, at an approximate page breakpoint.`,
			isRowLabel: true,
			default: false,
		}),
	],
});

const SETTINGS_GROUPS = [
	settingsGroupStyleSwitcher,
	settingsGroupUi,
	settingsGroupMarkdown,
];

class VetoolsConfig {
	static _STORAGE_KEY = "config";

	static _STORAGE = StorageUtil;

	static _CONFIG = null;

	static _init () {
		if (this._CONFIG) return;

		this._CONFIG = this._STORAGE.syncGet(this._STORAGE_KEY) || {};

		SETTINGS_GROUPS
			.forEach(settingsGroup => settingsGroup.mutDefaults(this._CONFIG));

		SETTINGS_GROUPS
			.forEach(settingsGroup => settingsGroup.mutVerify(this._CONFIG));
	}

	/* -------------------------------------------- */

	static get (groupId, configId) {
		this._init();
		return this._CONFIG[groupId]?.[configId];
	}

	static set (groupId, configId, val) {
		this._init();
		((this._CONFIG ||= {})[groupId] ||= {})[configId] = val;
		this._save();
	}

	/* -------------------------------------------- */

	static _save () {
		this._STORAGE.syncSet(this._STORAGE_KEY, this._CONFIG);
	}

	static _saveThrottled = MiscUtil.throttle(this._save.bind(this), 50);

	/* -------------------------------------------- */

	static getConfigComp () {
		this._init();

		const state = {};
		Object.entries(this._CONFIG)
			.forEach(([groupId, groupTo]) => {
				Object.entries(groupTo)
					.forEach(([configId, val]) => {
						state[UtilConfigHelpers.packSettingId(groupId, configId)]	= MiscUtil.copyFast(val);
					});
			});

		const comp = BaseComponent.fromObject(state, "*");
		comp._addHookAllBase(() => {
			Object.entries(comp._state)
				.forEach(([settingId, v]) => {
					const {groupId, configId} = UtilConfigHelpers.unpackSettingId(settingId);
					MiscUtil.set(this._CONFIG, groupId, configId, v);
				});

			this._saveThrottled();
		});

		return comp;
	}
}

class CrScalerArmorClass extends CrScalerBase {
	static _AC_CR_RANGES = {
		"13": [-1, 3],
		"14": [4, 4],
		"15": [5, 7],
		"16": [8, 9],
		"17": [10, 12],
		"18": [13, 16],
		"19": [17, 30],
	};

	static _crToAc (cr) {
		return Number(CrScalerUtils.crRangeToVal(cr, this._AC_CR_RANGES));
	}

	/* -------------------------------------------- */

	constructor (opts) {
		super(opts);

		this._idealAcIn = CrScalerArmorClass._crToAc(this._crInNumber);
		this._idealAcOut = CrScalerArmorClass._crToAc(this._crOutNumber);
	}

	/* -------------------------------------------- */

	_getEnchanted (item, baseMod) {
		const out = [];
		for (let i = 0; i < 3; ++i) {
			out.push({
				tag: `+${i + 1} ${item}|dmg`,
				mod: baseMod + i + 1,
			});
			out.push({
				tag: `${item} +${i + 1}|dmg`,
				mod: baseMod + i + 1,
			});
		}
		return out;
	}

	_getAllVariants (obj) {
		return Object.keys(obj).map(armor => {
			const mod = obj[armor];
			return [{
				tag: `${armor}|phb`,
				mod,
			}].concat(this._getEnchanted(armor, mod));
		}).reduce((a, b) => a.concat(b), []);
	}

	_getAcBaseAndMod (all, tag) {
		const tagBaseType = tag.replace(/( \+\d)?\|.*$/, "");
		const tagBase = all[tagBaseType];
		const tagModM = /^.*? (\+\d)\|.*$/.exec(tag);
		const tagMod = tagModM ? Number(tagModM[1]) : 0;
		return [tagBase, tagMod];
	}

	_isStringContainsTag (tagSet, str) {
		return tagSet.find(it => str.includes(`@item ${it}`));
	}

	_replaceTag (str, oldTag, nuTag) {
		const out = str.replace(`@item ${oldTag}`, `@item ${nuTag}`);
		const spl = out.split("|");
		if (spl.length > 2) {
			return `${spl.slice(0, 2).join("|")}}`;
		}
		return out;
	}

	_canDropShield () {
		return this._mon._shieldRequired === false && this._mon._shieldDropped === false;
	}

	_dropShield (acItem) {
		const idxShield = acItem.from.findIndex(f => this._ALL_SHIELD_VARIANTS.find(s => f._.includes(s.tag)));
		if (idxShield === -1) throw new Error("Should never occur!");
		acItem.from.splice(idxShield, 1);
	}

	// normalises results as "value above 10"
	_getAcVal (name) {
		name = name.trim().toLowerCase();
		const toCheck = [this._HEAVY, this._MEDIUM, this._LIGHT, {shield: 2}];
		for (const tc of toCheck) {
			const armorKey = Object.keys(tc).find(k => name === k);
			if (armorKey) {
				const acBonus = tc[armorKey];
				if (acBonus > 10) return acBonus - 10;
			}
		}
	}

	_getDexCapVal (name) {
		name = name.trim().toLowerCase();
		const ix = [this._HEAVY, this._MEDIUM, this._LIGHT].findIndex(tc => !!Object.keys(tc).find(k => name === k));
		return ix === 0 ? 0 : ix === 1 ? 2 : ix === 3 ? 999 : null;
	}

	// dual-wield shields is 3 AC, according to VGM's Fire Giant Dreadnought
	// Therefore we assume "two shields = +1 AC"
	_DUAL_SHIELD_BONUS = 1;

	_HEAVY = {
		"ring mail": 14,
		"chain mail": 16,
		"splint armor": 17,
		"plate armor": 18,
	};
	_MEDIUM = {
		"hide armor": 12,
		"chain shirt": 13,
		"scale mail": 14,
		"breastplate": 14,
		"half plate armor": 15,
	};
	_LIGHT = {
		"padded armor": 11,
		"leather armor": 11,
		"studded leather armor": 12,
	};
	_MAGE_ARMOR = "@spell mage armor";

	_ALL_SHIELD_VARIANTS = null;
	_ALL_HEAVY_VARIANTS = null;
	_ALL_MEDIUM_VARIANTS = null;
	_ALL_LIGHT_VARIANTS = null;
	_initAllVariants () {
		this._ALL_SHIELD_VARIANTS = this._ALL_SHIELD_VARIANTS || [
			{
				tag: "shield|phb",
				mod: 2,
			},
			...this._getEnchanted("shield", 2),
		];

		this._ALL_HEAVY_VARIANTS = this._ALL_HEAVY_VARIANTS || this._getAllVariants(this._HEAVY);
		this._ALL_MEDIUM_VARIANTS = this._ALL_MEDIUM_VARIANTS || this._getAllVariants(this._MEDIUM);
		this._ALL_LIGHT_VARIANTS = this._ALL_LIGHT_VARIANTS || this._getAllVariants(this._LIGHT);
	}

	doAdjust () {
		this._initAllVariants();

		// if the DPR calculations didn't already adjust DEX, we can adjust it here
		// otherwise, respect the changes made in the DPR calculations, and find a combination of AC factors to meet the desired number
		this._mon.ac = this._mon.ac.map(acItem => this._getAdjustedAcItem({acItem}));
	}

	/** Update an existing AC to use our new DEX score, if we have one. */
	_doPreAdjustAcs ({acItem}) {
		if (!this._state.getHasModifiedAbilityScore("dex") || this._mon.dex === this._state.getOriginalScore("dex")) return;
		if (!acItem.from) return;

		const originalDexMod = Parser.getAbilityModNumber(this._state.getOriginalScore("dex"));
		const currentDexMod = Parser.getAbilityModNumber(this._mon.dex);

		if (originalDexMod === currentDexMod) return;

		// Handle mage armor, light armor, and medium armor.
		//   Note that natural armor and "unarmored" also include DEX, but these are handled in the main loop.

		if (this._isMageArmor(acItem)) {
			acItem._acBeforePreAdjustment = acItem.ac;
			acItem.ac = 13 + Parser.getAbilityModNumber(this._mon.dex);
			return;
		}

		const lightTags = this._ALL_LIGHT_VARIANTS.map(it => it.tag);
		const mediumTags = this._ALL_MEDIUM_VARIANTS.map(it => it.tag);

		for (let i = 0; i < acItem.from.length; ++i) {
			const from = acItem.from[i];

			const lightTag = this._isStringContainsTag(lightTags, from);
			if (lightTag) {
				acItem._acBeforePreAdjustment = acItem.ac;

				acItem.ac = acItem.ac - originalDexMod + currentDexMod;

				return;
			}

			const mediumTag = this._isStringContainsTag(mediumTags, from);
			if (mediumTag) {
				const originalDexModMedium = Math.min(2, originalDexMod);
				const currentDexModMedium = Math.min(2, currentDexMod);

				const curAc = acItem.ac;
				acItem.ac = acItem.ac - originalDexModMedium + currentDexModMedium;
				if (curAc !== acItem.ac) acItem._acBeforePreAdjustment = curAc;

				return;
			}
		}
	}

	_getAdjustedAcItem ({acItem}) {
		// Pre-adjust ACs to match our new DEX score, if we have one
		this._doPreAdjustAcs({acItem});

		// region Attempt to adjust this item until we find some output that works
		let iter = 0;
		let out = null;
		while (out == null) {
			if (iter > 100) throw new Error(`Failed to calculate new AC! Input was:\n${JSON.stringify(acItem, null, "\t")}`);
			out = this._getAdjustedAcItem_getAdjusted({acItem, iter});
			iter++;
		}
		// endregion

		// region Finalisation/cleanup
		// finalise "from"
		let handledEnchBonus = !acItem._enchTotal;
		if (acItem.from) {
			if (acItem._enchTotal) {
				acItem.from.forEach(f => {
					if (handledEnchBonus) return;

					if (f.ench && f.ench < 3) {
						const enchToGive = Math.min(3 - f.ench, acItem._enchTotal);
						acItem._enchTotal -= enchToGive;
						f.ench += enchToGive;
						acItem.ac += enchToGive;
						f._ = `{@item +${f.ench} ${f.name}}`;
						if (acItem._enchTotal <= 0) handledEnchBonus = true;
					} else if (out._gearBonus) {
						const enchToGive = Math.min(3, acItem._enchTotal);
						acItem._enchTotal -= enchToGive;
						f._ = `{@item +${enchToGive} ${f.name}}`;
						if (acItem._enchTotal <= 0) handledEnchBonus = true;
					}
				});
			}
			acItem.from = acItem.from.map(it => it._);
		}

		// if there's an unhandled enchantment, give the creature enchanted leather. This implies an extra point of AC, but this is an acceptable workaround
		if (!handledEnchBonus) {
			const enchToGive = Math.min(3, acItem._enchTotal);
			acItem._enchTotal -= enchToGive;
			acItem.ac += enchToGive + 1;
			(acItem.from = acItem.from || []).unshift(`{@item +${enchToGive} leather armor}`);

			if (acItem._enchTotal > 0) acItem.ac += acItem._enchTotal; // as a fallback, add any remaining enchantment AC to the total
		}

		if (acItem._miscOffset != null) acItem.ac += acItem._miscOffset;

		// cleanup
		[
			"_enchTotal",
			"_gearBonus",
			"_dexCap",
			"_miscOffset",
			"_isShield",
			"_isDualShields",
		].forEach(it => delete acItem[it]);
		// endregion

		return out;
	}

	_isMageArmor (acItem) {
		return acItem.condition && acItem.condition.toLowerCase().includes(this._MAGE_ARMOR);
	}

	_getAdjustedAcItem_getAdjusted ({acItem, iter}) {
		const getEnchTotal = () => acItem._enchTotal || 0;
		const getBaseGearBonus = () => acItem._gearBonus || 0;
		const getDexCap = () => acItem._dexCap || 999;

		// strip enchantments and total bonuses
		if (typeof acItem !== "number") {
			acItem._enchTotal = acItem._enchTotal || 0; // maintain this between loops, in case we throw away the enchanted gear
			acItem._gearBonus = 0; // recalculate this each time
			acItem._dexCap = 999; // recalculate this each time
		}

		if (acItem.from) {
			acItem.from = acItem.from.map(f => {
				if (f._) f = f._; // if a previous loop modified it

				const m = /@item (\+\d+) ([^+\d]+)\|([^|}]+)/gi.exec(f); // e.g. {@item +1 chain mail}
				if (m) {
					const [_, name, bonus, source] = m;

					const acVal = this._getAcVal(name);
					if (acVal) acItem._gearBonus += acVal;

					const dexCap = this._getDexCapVal(name);
					if (dexCap != null) acItem._dexCap = Math.min(acItem._dexCap, dexCap);

					const ench = Number(bonus);
					acItem._enchTotal += ench;
					return {
						_: f,
						name: name.trim(),
						ench: ench,
						source: source,
					};
				} else {
					const m = /@item ([^|}]+)(\|[^|}]+)?(\|[^|}]+)?/gi.exec(f);
					if (m) {
						const [_, name, source, display] = m;
						const out = {_: f, name};
						if (source) out.source = source;
						if (display) out.display = display;

						const acVal = this._getAcVal(name);
						if (acVal) {
							acItem._gearBonus += acVal;
							out._gearBonus = acVal;
						}

						const dexCap = this._getDexCapVal(name);
						if (dexCap != null) acItem._dexCap = Math.min(acItem._dexCap, dexCap);

						return out;
					} else return {_: f, name: f};
				}
			});
		}

		// for armored creatures, try to calculate the expected AC, and use this as a starting point for scaling
		const expectedBaseScore = this._state.getHasModifiedAbilityScore("dex")
			? (getBaseGearBonus() + Math.min(Parser.getAbilityModNumber(this._state.getOriginalScore("dex")), getDexCap()) + (this._isMageArmor(acItem) ? 13 : 10))
			: null;

		let canAdjustDex = !this._state.getHasModifiedAbilityScore("dex");
		const dexGain = Parser.getAbilityModNumber(this._mon.dex) - Parser.getAbilityModNumber(this._state.getOriginalScore("dex") || this._mon.dex);

		const curr = acItem._acBeforePreAdjustment != null
			? acItem._acBeforePreAdjustment
			: (acItem.ac || acItem);
		// don't include enchantments in AC-CR calculations
		const currWithoutEnchants = curr - (iter === 0 ? getEnchTotal() : 0); // only take it off on the first iteration, as it gets saved

		// ignore any other misc modifications from abilities, enchanted items, etc
		if (typeof acItem !== "number") {
			// maintain this between loops, keep the original "pure" version
			acItem._miscOffset = acItem._miscOffset != null
				? acItem._miscOffset
				: (expectedBaseScore != null ? currWithoutEnchants - expectedBaseScore : null);
		}

		const effectiveCurrent = expectedBaseScore == null ? currWithoutEnchants : expectedBaseScore;
		const target = ScaleCreatureUtils.getScaledToRatio(effectiveCurrent, this._idealAcIn, this._idealAcOut);
		let targetNoShield = target;
		const acGain = target - effectiveCurrent;

		const dexMismatch = acGain - dexGain;

		const adjustDex = ({dexMismatch}) => {
			this._state.setHasModifiedAbilityScore("dex");
			this._mon.dex = CrScalerUtils.calcNewAbility(this._mon, "dex", Parser.getAbilityModNumber(this._mon.dex) + dexMismatch);
			canAdjustDex = false;
			return true;
		};

		const handleNoArmor = () => {
			const target_noArmor = ScaleCreatureUtils.getScaledToRatio(acItem, this._idealAcIn, this._idealAcOut);
			const acGain_noArmor = target_noArmor - acItem;
			const dexMismatch_noArmor = acGain_noArmor - dexGain;

			if (dexMismatch_noArmor > 0) {
				if (canAdjustDex) {
					adjustDex({dexMismatch: dexMismatch_noArmor});
					return target_noArmor;
				}

				// fill the gap with natural armor
				if (VetoolsConfig.get("styleSwitcher", "style") === "classic") {
					return {
						ac: target_noArmor,
						from: ["natural armor"],
					};
				}
				return target_noArmor;
			}

			if (dexMismatch_noArmor < 0 && canAdjustDex) { // increase/reduce DEX to move the AC up/down
				adjustDex({dexMismatch: dexMismatch_noArmor});
				return target_noArmor;
			}

			// AC adjustment perfectly matches DEX adjustment; or there's nothing we can do because of a previous DEX adjustment
			return target_noArmor;
		};

		// "FROM" ADJUSTERS ========================================================================================

		const handleMageArmor = () => {
			// if there's mage armor, try adjusting dex
			if (this._isMageArmor(acItem)) {
				if (canAdjustDex) {
					acItem.ac = target;
					delete acItem._acBeforePreAdjustment;
					return adjustDex({dexMismatch});
				} else {
					// We have already set the AC in the pre-adjustment step.
					//   Mage armor means there was no other armor, so stop here.
					return true;
				}
			}
			return false;
		};

		const handleShield = () => {
			// if there's a shield, try dropping it
			if (acItem.from) {
				const fromShields = acItem.from.filter(f => this._ALL_SHIELD_VARIANTS.find(s => f._.includes(`@item ${s.tag}`)));
				if (fromShields.length) {
					if (fromShields.length > 1) throw new Error("AC contained multiple shields!"); // should be impossible

					// check if shields are an important part of this creature
					// if they have abilities/etc which refer to the shield, don't remove the shield
					const shieldRequired = this._mon._shieldRequired != null ? this._mon._shieldRequired : (() => {
						const checkShields = (prop) => {
							if (!this._mon[prop]) return false;
							for (const it of this._mon[prop]) {
								if (it.name && it.name.toLowerCase().includes("shield")) return true;
								if (it.entries && JSON.stringify(it.entries).match(/shield/i)) return true;
							}
						};
						return this._mon._shieldRequired = checkShields("trait")
							|| checkShields("action")
							|| checkShields("bonus")
							|| checkShields("reaction")
							|| checkShields("legendary")
							|| checkShields("mythic");
					})();
					this._mon._shieldDropped = false;

					const fromShield = fromShields[0];
					const fromShieldStr = fromShield._;
					fromShield._isShield = true;
					const idx = acItem.from.findIndex(it => it === fromShieldStr);

					if (fromShieldStr.endsWith("|shields}")) {
						fromShield._isDualShields = true;

						const shieldVal = this._ALL_SHIELD_VARIANTS.find(s => fromShieldStr.includes(s.tag));
						const shieldValModDual = shieldVal.mod + this._DUAL_SHIELD_BONUS;
						targetNoShield -= shieldValModDual;

						if (!shieldRequired && (acGain <= -shieldValModDual)) {
							acItem.from.splice(idx, 1);
							acItem.ac -= shieldValModDual;
							this._mon._shieldDropped = true;
							if (acItem.ac === target) return true;
						}
					} else {
						const shieldVal = this._ALL_SHIELD_VARIANTS.find(s => fromShieldStr.includes(s.tag));
						targetNoShield -= shieldVal.mod;

						if (!shieldRequired && (acGain <= -shieldVal.mod)) {
							acItem.from.splice(idx, 1);
							acItem.ac -= shieldVal.mod;
							this._mon._shieldDropped = true;
							if (acItem.ac === target) return true;
						}
					}
				}
			}
			return false;
		};

		// FIXME this can result in armor with strength requirements greater than the user can manage
		const handleHeavyArmor = () => {
			// if there's heavy armor, try adjusting it
			const PL3_PLATE = 21;

			const heavyTags = this._ALL_HEAVY_VARIANTS.map(it => it.tag);

			const isHeavy = (ac) => {
				return ac >= 14 && ac <= PL3_PLATE; // ring mail (14) to +3 Plate (21)
			};

			const isBeyondHeavy = (ac) => {
				return ac > PL3_PLATE; // more than +3 plate
			};

			const getHeavy = (ac) => {
				const nonEnch = Object.keys(this._HEAVY).find(armor => this._HEAVY[armor] === ac);
				if (nonEnch) return `${nonEnch}|phb`;
				switch (ac) {
					case 19: return [`+1 plate armor|dmg`, `+2 splint armor|dmg`][RollerUtil.roll(1, CrScalerUtils.RNG)];
					case 20: return `+2 plate armor|dmg`;
					case PL3_PLATE: return `+3 plate armor|dmg`;
				}
			};

			const applyPl3Plate = ({ixFrom, heavyTag}) => {
				acItem.from[ixFrom]._ = this._replaceTag(acItem.from[ixFrom]._, heavyTag, getHeavy(PL3_PLATE));
				acItem.ac = PL3_PLATE;
				delete acItem._acBeforePreAdjustment;
			};

			// For e.g. "Helmed Horror". Note that this should only ever *increase* shield AC.
			const applyBeyondHeavyShieldUpgrade = ({idealShieldAc}) => {
				const fromShield = acItem.from.find(it => it._isShield);
				const shieldVal = this._ALL_SHIELD_VARIANTS.find(s => fromShield._.includes(s.tag));
				const adjustmentDualShields = (fromShield._isDualShields ? this._DUAL_SHIELD_BONUS : 0);
				const shieldValMod = shieldVal.mod + adjustmentDualShields;
				const deltaShieldRequired = idealShieldAc - shieldValMod;
				if (deltaShieldRequired <= 0) return acItem.ac += shieldValMod;

				const deltaShieldMax = (5 + adjustmentDualShields) - shieldValMod;
				const deltaShield = Math.min(deltaShieldRequired, deltaShieldMax);
				const shieldValOut = this._ALL_SHIELD_VARIANTS.find(s => s.mod === (shieldVal.mod + deltaShield));

				fromShield._ = this._replaceTag(fromShield._, shieldVal.tag, shieldValOut.tag);

				acItem.ac += shieldValOut.mod + adjustmentDualShields;
			};

			if (acItem.from) {
				for (let i = 0; i < acItem.from.length; ++i) {
					const heavyTag = this._isStringContainsTag(heavyTags, acItem.from[i]._);
					if (heavyTag) {
						if (
							targetNoShield !== target
							&& isBeyondHeavy(targetNoShield)
							&& isBeyondHeavy(target)
						) {
							const deltaHeavy = (PL3_PLATE - 10) - acItem.from[i]._gearBonus;
							const idealShieldAc = target - (targetNoShield - deltaHeavy);

							applyPl3Plate({ixFrom: i, heavyTag}); // cap it at +3 plate
							applyBeyondHeavyShieldUpgrade({idealShieldAc}); // try to upgrade the shield
							return true;
						} if (isHeavy(targetNoShield)) {
							const bumpOne = targetNoShield === 15; // there's no heavy armor with 15 AC
							if (bumpOne) targetNoShield++;
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, heavyTag, getHeavy(targetNoShield));
							acItem.ac = target + (bumpOne ? 1 : 0);
							delete acItem._acBeforePreAdjustment;
							return true;
						} else if (this._canDropShield() && isHeavy(target)) {
							const targetWithBump = target + (target === 15 ? 1 : 0); // there's no heavy armor with 15 AC
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, heavyTag, getHeavy(targetWithBump));
							acItem.ac = targetWithBump;
							delete acItem._acBeforePreAdjustment;
							this._dropShield(acItem);
							return true;
						} else if (isBeyondHeavy(targetNoShield)) {
							applyPl3Plate({ixFrom: i, heavyTag}); // cap it at +3 plate and call it a day
							return true;
						} else { // drop to medium
							const [tagBase, tagMod] = this._getAcBaseAndMod(this._LIGHT, heavyTag);
							const tagAc = tagBase + tagMod;
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, heavyTag, `half plate armor|phb`);
							acItem.ac = (acItem.ac - tagAc) + 15 + Math.min(2, Parser.getAbilityModNumber(this._mon.dex));
							delete acItem._acBeforePreAdjustment;
							return false;
						}
					}
				}
			}
			return false;
		};

		const handleMediumArmor = () => {
			// if there's medium armor, try adjusting dex, then try adjusting it
			const mediumTags = this._ALL_MEDIUM_VARIANTS.map(it => it.tag);

			const isMedium = (ac, asPos) => {
				const min = 12 + (canAdjustDex ? -5 : Parser.getAbilityModNumber(this._mon.dex)); // hide; 12
				const max = 18 + (canAdjustDex ? 2 : Math.min(2, Parser.getAbilityModNumber(this._mon.dex))); // half-plate +3; 18
				if (asPos) return ac < min ? -1 : ac > max ? 1 : 0;
				return ac >= min && ac <= max;
			};

			const getMedium = (ac, curArmor) => {
				const getByBase = (base) => {
					switch (base) {
						case 14:
							return [`scale mail|phb`, `breastplate|phb`][RollerUtil.roll(1, CrScalerUtils.RNG)];
						case 16:
							return [`+1 half plate armor|dmg`, `+2 breastplate|dmg`, `+2 scale mail|dmg`][RollerUtil.roll(2, CrScalerUtils.RNG)];
						case 17:
							return `+2 half plate armor|dmg`;
						case 18:
							return `+3 half plate armor|dmg`;
						default: {
							const nonEnch = Object.keys(this._MEDIUM).find(it => this._MEDIUM[it] === base);
							return `${nonEnch}|phb`;
						}
					}
				};

				if (canAdjustDex) {
					let fromArmor = curArmor.ac;
					let maxFromArmor = fromArmor + 2;
					let minFromArmor = fromArmor - 5;

					const withinDexRange = () => {
						return ac >= minFromArmor && ac <= maxFromArmor;
					};

					const getTotalAc = () => {
						return fromArmor + Math.min(2, Parser.getAbilityModNumber(this._mon.dex));
					};

					let loops = 0;
					while (1) {
						if (loops > 1000) throw new Error(`Failed to find valid light armor!`);

						if (withinDexRange()) {
							canAdjustDex = false;
							this._state.setHasModifiedAbilityScore("dex");

							if (ac > getTotalAc()) this._mon.dex += 2;
							else this._mon.dex -= 2;
						} else {
							if (ac < minFromArmor) fromArmor -= 1;
							else fromArmor += 1;
							if (fromArmor < 12 || fromArmor > 18) throw Error("Should never occur!"); // sanity check
							maxFromArmor = fromArmor + 2;
							minFromArmor = fromArmor - 5;
						}

						if (getTotalAc() === ac) break;
						loops++;
					}

					return getByBase(fromArmor);
				} else {
					const dexOffset = Math.min(Parser.getAbilityModNumber(this._mon.dex), 2);
					return getByBase(ac - dexOffset);
				}
			};

			if (acItem.from) {
				for (let i = 0; i < acItem.from.length; ++i) {
					const mediumTag = this._isStringContainsTag(mediumTags, acItem.from[i]._);
					if (mediumTag) {
						const [tagBase, tagMod] = this._getAcBaseAndMod(this._MEDIUM, mediumTag);
						const tagAc = tagBase + tagMod;
						if (isMedium(targetNoShield)) {
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, mediumTag, getMedium(targetNoShield, {tag: mediumTag, ac: tagAc}));
							acItem.ac = target;
							delete acItem._acBeforePreAdjustment;
							return true;
						} else if (this._canDropShield() && isMedium(target)) {
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, mediumTag, getMedium(target, {tag: mediumTag, ac: tagAc}));
							acItem.ac = target;
							delete acItem._acBeforePreAdjustment;
							this._dropShield(acItem);
							return true;
						} else if (canAdjustDex && isMedium(targetNoShield, true) === -1) { // drop to light
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, mediumTag, `studded leather armor|phb`);
							acItem.ac = (acItem.ac - tagAc - Math.min(2, Parser.getAbilityModNumber(this._mon.dex))) + 12 + Parser.getAbilityModNumber(this._mon.dex);
							delete acItem._acBeforePreAdjustment;
							return false;
						} else {
							// if we need more AC, switch to heavy, and restart the conversion
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, mediumTag, `ring mail|phb`);
							acItem.ac = 14;
							delete acItem._acBeforePreAdjustment;
							return -1;
						}
					}
				}
			}
			return false;
		};

		const handleLightArmor = () => {
			// if there's light armor, try adjusting dex, then try adjusting it
			const lightTags = this._ALL_LIGHT_VARIANTS.map(it => it.tag);

			const isLight = (ac, asPos) => {
				const min = 11 + (canAdjustDex ? -5 : Parser.getAbilityModNumber(this._mon.dex)); // padded/leather; 11
				const max = 15 + (canAdjustDex ? 100 : Parser.getAbilityModNumber(this._mon.dex)); // studded leather +3; 15
				if (asPos) return ac < min ? -1 : ac > max ? 1 : 0;
				return ac >= min && ac <= max;
			};

			const getLight = (ac, curArmor) => {
				const getByBase = (base) => {
					switch (base) {
						case 11:
							return [`padded armor|phb`, `leather armor|phb`][RollerUtil.roll(1, CrScalerUtils.RNG)];
						case 12:
							return `studded leather armor|phb`;
						case 13:
							return [`+1 padded armor|dmg`, `+1 leather armor|dmg`][RollerUtil.roll(1, CrScalerUtils.RNG)];
						case 14:
							return [`+2 padded armor|dmg`, `+2 leather armor|dmg`, `+1 studded leather armor|dmg`][RollerUtil.roll(2, CrScalerUtils.RNG)];
						case 15:
							return `+2 studded leather armor|dmg`;
					}
				};

				if (canAdjustDex) {
					let fromArmor = curArmor.ac;
					let minFromArmor = fromArmor - 5;

					const withinDexRange = () => {
						return ac >= minFromArmor;
					};

					const getTotalAc = () => {
						return fromArmor + Parser.getAbilityModNumber(this._mon.dex);
					};

					let loops = 0;
					while (1) {
						if (loops > 1000) throw new Error(`Failed to find valid light armor!`);

						if (withinDexRange()) {
							canAdjustDex = false;
							this._state.setHasModifiedAbilityScore("dex");

							if (ac > getTotalAc()) this._mon.dex += 2;
							else this._mon.dex -= 2;
						} else {
							if (ac < minFromArmor) fromArmor -= 1;
							else fromArmor += 1;
							if (fromArmor < 11 || fromArmor > 15) throw Error("Should never occur!"); // sanity check
							minFromArmor = fromArmor - 5;
						}

						if (getTotalAc() === ac) break;
						loops++;
					}

					return getByBase(fromArmor);
				} else {
					const dexOffset = Parser.getAbilityModNumber(this._mon.dex);
					return getByBase(ac - dexOffset);
				}
			};

			if (acItem.from) {
				for (let i = 0; i < acItem.from.length; ++i) {
					const lightTag = this._isStringContainsTag(lightTags, acItem.from[i]._);
					if (lightTag) {
						const [tagBase, tagMod] = this._getAcBaseAndMod(this._LIGHT, lightTag);
						const tagAc = tagBase + tagMod;
						if (isLight(targetNoShield)) {
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, lightTag, getLight(targetNoShield, {tag: lightTag, ac: tagAc}));
							acItem.ac = target;
							delete acItem._acBeforePreAdjustment;
							return true;
						} else if (this._canDropShield() && isLight(target)) {
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, lightTag, getLight(target, {tag: lightTag, ac: tagAc}));
							acItem.ac = target;
							delete acItem._acBeforePreAdjustment;
							this._dropShield(acItem);
							return true;
						} else if (!canAdjustDex && isLight(targetNoShield, true) === -1) { // drop armor
							if (acItem.from.length === 1) { // revert to pure numerical
								acItem._droppedArmor = true;
								return -1;
							} else { // revert to base 10
								acItem.from.splice(i, 1);
								acItem.ac = (acItem.ac - tagAc) + 10;
								delete acItem._acBeforePreAdjustment;
								return -1;
							}
						} else {
							// if we need more, switch to medium, and restart the conversion
							acItem.from[i]._ = this._replaceTag(acItem.from[i]._, lightTag, `chain shirt|phb`);
							acItem.ac = (acItem.ac - tagAc - Parser.getAbilityModNumber(this._mon.dex)) + 13 + Math.min(2, Parser.getAbilityModNumber(this._mon.dex));
							delete acItem._acBeforePreAdjustment;
							return -1;
						}
					}
				}
			}
			return false;
		};

		const handleNaturalArmor = () => {
			// if there's natural armor, try adjusting dex, then try adjusting it

			if (acItem.from && acItem.from.map(it => it._).includes("natural armor")) {
				if (canAdjustDex) {
					acItem.ac = target;
					delete acItem._acBeforePreAdjustment;
					return adjustDex({dexMismatch});
				} else {
					acItem.ac = target; // natural armor of all modifiers is still just "natural armor," so this works
					delete acItem._acBeforePreAdjustment;
					return true;
				}
			}
			return false;
		};

		if (acItem.ac && !acItem._droppedArmor) {
			const toRun = [
				handleMageArmor,
				handleShield,
				handleHeavyArmor,
				handleMediumArmor,
				handleLightArmor,
				handleNaturalArmor,
			];
			let lastVal = 0;
			for (let i = 0; i < toRun.length; ++i) {
				lastVal = toRun[i]();
				if (lastVal === -1) return null;
				else if (lastVal) break;
			}

			// if there was no reasonable way to adjust the AC, forcibly set it here as a fallback
			if (!lastVal) {
				acItem.ac = target;
				delete acItem._acBeforePreAdjustment;
			}
			return acItem;
		} else {
			return handleNoArmor();
		}
	}
}

class CrScalerUtilsAttack {
	static getEnchantmentBonus (str) {
		const m = /\+(\d+)/.exec(str);
		if (m) return Number(m[1]);
		else return 0;
	}

	/* -------------------------------------------- */

	static _WEP_THROWN_FINESSE = ["dagger", "dart"];
	static _WEP_FINESSE = ["dagger", "dart", "rapier", "scimitar", "shortsword", "whip"];
	static _WEP_THROWN = ["handaxe", "javelin", "light hammer", "spear", "trident", "net"];

	static getAbilBeingScaled ({strMod, dexMod, modFromAbil, name, content}) {
		if (name == null || modFromAbil == null) return null;

		const guessMod = () => {
			name = name.toLowerCase();

			let isMeleeOrRangedWeapon = false;
			let isMeleeWeapon = false;
			let isRangedWeapon = false;

			const mutTypeFlags = (tags) => {
				if (tags.includes("m") && tags.includes("r")) return isMeleeOrRangedWeapon = true;
				if (tags.includes("m")) return isMeleeWeapon = true;
				if (tags.includes("r")) return isRangedWeapon = true;
			};

			content
				.replace(/{@atk (?<tags>[^}]+)}/g, (...m) => {
					const {tags} = m.at(-1);
					if (!tags.includes("w")) return;

					mutTypeFlags(tags);
				})
				.replace(/{@atkr (?<tags>[^}]+)}/g, (...m) => {
					const {tags} = m.at(-1);
					// Note that for `@atkr` tags, "Weapon" is not generally included, so treat everything as a weapon
					//   during this initial pass.
					mutTypeFlags(tags);
				})
			;

			content = content.toLowerCase();

			if (isMeleeOrRangedWeapon) {
				const wtf = this._WEP_THROWN_FINESSE.find(it => content.includes(it));
				if (wtf) return "dex";

				const wf = this._WEP_FINESSE.find(it => content.includes(it));
				if (wf) return "dex";

				const wt = this._WEP_THROWN.find(it => content.includes(it));
				if (wt) return "str";

				return null;
			}

			if (isMeleeWeapon) {
				const wf = this._WEP_FINESSE.find(it => content.includes(it));
				if (wf) return "dex";
				return "str";
			}

			if (isRangedWeapon) {
				const wt = this._WEP_THROWN.find(it => content.includes(it));
				if (wt) return "str"; // this should realistically only catch Nets
				return "dex";
			}
		};

		if (strMod === dexMod && strMod === modFromAbil) return guessMod();
		return strMod === modFromAbil ? "str" : dexMod === modFromAbil ? "dex" : null;
	}
}

class CrScalerHitSave extends CrScalerBase {
	static _ATK_CR_RANGES = {
		"3": [-1, 2],
		"4": [3, 3],
		"5": [4, 4],
		"6": [5, 7],
		"7": [8, 10],
		"8": [11, 15],
		"9": [16, 16],
		"10": [17, 20],
		"11": [21, 23],
		"12": [24, 26],
		"13": [27, 29],
		"14": [30, 30],
	};

	static _crToAtk (cr) {
		return CrScalerUtils.crRangeToVal(cr, this._ATK_CR_RANGES);
	}

	/* -------------------------------------------- */

	static _DC_RANGES = {
		"13": [-1, 3],
		"14": [4, 4],
		"15": [5, 7],
		"16": [8, 10],
		"17": [11, 12],
		"18": [13, 16],
		"19": [17, 20],
		"20": [21, 23],
		"21": [24, 26],
		"22": [27, 29],
		"23": [30, 30],
	};

	static _crToDc (cr) {
		return CrScalerUtils.crRangeToVal(cr, this._DC_RANGES);
	}

	/* -------------------------------------------- */

	constructor (opts) {
		super(opts);

		this._idealHitIn = Number(this.constructor._crToAtk(this._crInNumber));
		this._idealHitOut = Number(this.constructor._crToAtk(this._crOutNumber));

		this._strMod = Parser.getAbilityModNumber(this._mon.str);
		this._dexMod = Parser.getAbilityModNumber(this._mon.dex);

		this._idealDcIn = this.constructor._crToDc(this._crInNumber);
		this._idealDcOut = this.constructor._crToDc(this._crOutNumber);
	}

	/* -------------------------------------------- */

	_getAdjustedHitFlat ({toHitIn}) {
		// For low CR -> high CR,
		// prefer scaling to-hits by a flat difference, rather than using a ratio
		// this keeps ability scores more sane, and better maintains bounded accuracy.
		if (this._crInNumber < this._crOutNumber) return toHitIn + (this._idealHitOut - this._idealHitIn);

		// Otherwise, for high CR -> low CR
		return ScaleCreatureUtils.getScaledToRatio(toHitIn, this._idealHitIn, this._idealHitOut);
	}

	_handleHit (
		{
			str,
			name = null,
		},
	) {
		const offsetEnchant = name != null ? CrScalerUtilsAttack.getEnchantmentBonus(name) : 0;

		return str.replace(/{@hit ([-+]?\d+)}/g, (m0, m1) => {
			const curToHit = Number(m1);

			const modFromAbil = curToHit - (offsetEnchant + this._pbOut);
			// Handle e.g. "Hobgoblin Warlord" expertise on attacks
			const modFromAbilExpertise = curToHit - (offsetEnchant + (this._pbOut * 2));
			// Handle e.g. "Ghast" lack of proficiency on attacks
			const modFromAbilNoProf = curToHit - offsetEnchant;

			// ignore spell attacks here, as they'll be scaled using DCs later
			const abilBeingScaled = CrScalerUtilsAttack.getAbilBeingScaled({
				strMod: this._strMod,
				dexMod: this._dexMod,
				modFromAbil,
				name,
				content: str,
			});
			const abilBeingScaledExpertise = CrScalerUtilsAttack.getAbilBeingScaled({
				strMod: this._strMod,
				dexMod: this._dexMod,
				modFromAbil: modFromAbilExpertise,
				name,
				content: str,
			});
			const abilBeingScaledNoProf = CrScalerUtilsAttack.getAbilBeingScaled({
				strMod: this._strMod,
				dexMod: this._dexMod,
				modFromAbil: modFromAbilNoProf,
				name,
				content: str,
			});

			const {abil, profMult} = [
				abilBeingScaled ? {abil: abilBeingScaled, profMult: 1} : null,
				abilBeingScaledExpertise ? {abil: abilBeingScaledExpertise, profMult: 2} : null,
				abilBeingScaledNoProf ? {abil: abilBeingScaledNoProf, profMult: 0} : null,
			].filter(Boolean)[0] || {abil: null, profMult: 1};

			const pbInMult = profMult * this._pbIn;
			const pbOutMult = profMult * this._pbOut;

			const origToHitNoEnch = curToHit + (pbInMult - pbOutMult) - offsetEnchant;
			const targetToHitNoEnch = this._getAdjustedHitFlat({toHitIn: origToHitNoEnch});

			if (origToHitNoEnch === targetToHitNoEnch) return m0; // this includes updated PB, so just return it

			if (abil != null) {
				const modDiff = (targetToHitNoEnch - pbOutMult) - (origToHitNoEnch - pbInMult);
				const modFromAbilOut = modFromAbil + modDiff;

				this._state.addCandidateAbilityMod(abil, modFromAbilOut);
			}

			return `{@hit ${targetToHitNoEnch + offsetEnchant}}`;
		});
	}

	/* -------------------------------------------- */

	_handleDc_getAdjustedDcFlat ({dcIn}) {
		return dcIn + (this._idealDcOut - this._idealDcIn);
	}

	_handleDc (
		{
			str,
			castingAbility = null,
		},
	) {
		return str
			.replace(/DC (\d+)/g, (m0, m1) => `{@dc ${m1}}`)
			.replace(/{@dc (\d+)(?:\|[^}]+)?}/g, (m0, m1) => {
				const curDc = Number(m1);
				const origDc = curDc + this._pbIn - this._pbOut;
				const outDc = Math.max(10, this._handleDc_getAdjustedDcFlat({dcIn: origDc}));
				if (curDc === outDc) return m0;

				if (
					castingAbility
					&& ["int", "wis", "cha"].includes(castingAbility)
				) {
					if (!this._state.getHasModifiedAbilityScore(castingAbility)) {
						const dcDiff = outDc - origDc;
						const curMod = Parser.getAbilityModNumber(this._mon[castingAbility]);
						this._mon[castingAbility] = CrScalerUtils.calcNewAbility(this._mon, castingAbility, curMod + dcDiff + this._pbIn - this._pbOut);
						this._state.setHasModifiedAbilityScore(castingAbility);
					}
				}

				return `{@dc ${outDc}}`;
			});
	}

	/* -------------------------------------------- */

	_doHandleSpellcastingEntries ({walker}) {
		if (!this._mon.spellcasting?.length) return;

		this._mon.spellcasting.forEach(sc => {
			if (!sc.headerEntries?.length) return;

			sc.headerEntries = walker.walk(sc.headerEntries, {string: str => {
				const strMutDcs = this._handleDc({
					str: str,
					castingAbility: sc.ability,
				});

				return this._handleHit({
					str: strMutDcs,
				});
			}});
		});
	}

	_doHandleGenericEntries ({walker, prop}) {
		if (!this._mon[prop]?.length) return;

		this._mon[prop].forEach(entSub => {
			if (!entSub.entries?.length) return;

			entSub.entries = walker.walk(entSub.entries, {string: str => {
				const strMutHit = this._handleHit({
					str: str,
					name: entSub.name,
				});

				return this._handleDc({
					str: strMutHit,
				});
			}});
		});
	}

	/* -------------------------------------------- */

	_doFinalize_checkSetTempMod ({abil}) {
		if (!this._state.hasCandidateAbilityMods(abil)) return;

		const candidateAbilityMods = this._state.getCandidateAbilityMods(abil);
		this._state.clearCandidateAbilityMods();

		if (candidateAbilityMods.length === 1) {
			this._state.setTempAbilityMod(abil, candidateAbilityMods[0]);
			return;
		}

		const cntEachMod = {};
		candidateAbilityMods.forEach(mod => cntEachMod[mod] = (cntEachMod[mod] || 0) + 1);

		// If all changes are equal, apply the first
		if (Object.keys(cntEachMod).length === 1) {
			this._state.setTempAbilityMod(abil, candidateAbilityMods[0]);
			return;
		}

		// Otherwise, apply the one we found the most. Failing that, apply the first one.
		const maxCount = Math.max(...Object.values(cntEachMod));
		const mostPopularMods = Object.entries(cntEachMod)
			.filter(([, cnt]) => cnt === maxCount)
			.map(([mod]) => Number(mod));
		this._state.setTempAbilityMod(abil, mostPopularMods[0]);
	}

	// Apply any changes required by the to-hit adjustment to our ability scores
	_doFinalize () {
		this._doFinalize_checkSetTempMod({abil: "str"});
		this._doFinalize_checkSetTempMod({abil: "dex"});
	}

	/* -------------------------------------------- */

	doAdjust () {
		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});

		this._doHandleSpellcastingEntries({walker});

		this._doHandleGenericEntries({walker, prop: "trait"});
		this._doHandleGenericEntries({walker, prop: "action"});
		this._doHandleGenericEntries({walker, prop: "bonus"});
		this._doHandleGenericEntries({walker, prop: "reaction"});
		this._doHandleGenericEntries({walker, prop: "legendary"});
		this._doHandleGenericEntries({walker, prop: "mythic"});
		this._doHandleGenericEntries({walker, prop: "variant"});

		this._doFinalize();
	}
}

class ScaleCreatureConsts {
	// DMG p274
	static CR_DPR_RANGES = {
		"0": [0, 1],
		"0.125": [2, 3],
		"0.25": [4, 5],
		"0.5": [6, 8],
		"1": [9, 14],
		"2": [15, 20],
		"3": [21, 26],
		"4": [27, 32],
		"5": [33, 38],
		"6": [39, 44],
		"7": [45, 50],
		"8": [51, 56],
		"9": [57, 62],
		"10": [63, 68],
		"11": [69, 74],
		"12": [75, 80],
		"13": [81, 86],
		"14": [87, 92],
		"15": [93, 98],
		"16": [99, 104],
		"17": [105, 110],
		"18": [111, 116],
		"19": [117, 122],
		"20": [123, 140],
		"21": [141, 158],
		"22": [159, 176],
		"23": [177, 194],
		"24": [195, 212],
		"25": [213, 230],
		"26": [231, 248],
		"27": [249, 266],
		"28": [267, 284],
		"29": [285, 302],
		"30": [303, 320],
	};

	// DMG p274
	static CR_HP_RANGES = {
		"0": [1, 6],
		"0.125": [7, 35],
		"0.25": [36, 49],
		"0.5": [50, 70],
		"1": [71, 85],
		"2": [86, 100],
		"3": [101, 115],
		"4": [116, 130],
		"5": [131, 145],
		"6": [146, 160],
		"7": [161, 175],
		"8": [176, 190],
		"9": [191, 205],
		"10": [206, 220],
		"11": [221, 235],
		"12": [236, 250],
		"13": [251, 265],
		"14": [266, 280],
		"15": [281, 295],
		"16": [296, 310],
		"17": [311, 325],
		"18": [326, 340],
		"19": [341, 355],
		"20": [356, 400],
		"21": [401, 445],
		"22": [446, 490],
		"23": [491, 535],
		"24": [536, 580],
		"25": [581, 625],
		"26": [626, 670],
		"27": [671, 715],
		"28": [716, 760],
		"29": [761, 805],
		"30": [806, 850],
	};

	// Manual smoothing applied to ensure e.g. going down a CR doesn't increase the mod
	static CR_TO_ESTIMATED_DAMAGE_MOD = {
		"0": [-1, 2],
		"0.125": [0, 2],
		"0.25": [0, 3],
		"0.5": [0, 3],
		"1": [0, 3],
		"2": [1, 4],
		"3": [1, 4],
		"4": [2, 4],
		"5": [2, 5],
		"6": [2, 5],
		"7": [2, 5],
		"8": [2, 5],
		"9": [2, 6],
		"10": [3, 6],
		"11": [3, 6],
		"12": [3, 6],
		"13": [3, 7],
		"14": [3, 7],
		"15": [3, 7],
		"16": [4, 8],
		"17": [4, 8],
		"18": [4, 8],
		"19": [5, 8],
		"20": [6, 9],
		"21": [6, 9],
		"22": [6, 10],
		"23": [6, 10],
		"24": [6, 11],
		"25": [7, 11],
		"26": [7, 11],
		// region No creatures for these CRs; use 26 with modifications
		"27": [7, 11],
		"28": [8, 11],
		"29": [8, 11],
		// endregion
		"30": [9, 11],
	};
}

class ScaleCreatureDamageExpression {
	static _State = class {
		constructor (
			{
				dprTargetRange,
				prefix,
				suffix,

				numDice,
				dprAdjusted,
				diceFaces,
				offsetEnchant = 0,

				modOut,

				isAllowAdjustingMod = true,
			},
		) {
			// region Inputs
			this.dprTargetRange = dprTargetRange;
			this.prefix = prefix;
			this.suffix = suffix;
			this.numDice = numDice;
			this.dprAdjusted = dprAdjusted;
			this.diceFaces = diceFaces;
			this.offsetEnchant = offsetEnchant;
			this.isAllowAdjustingMod = isAllowAdjustingMod;
			// endregion

			// region Outputs
			this.numDiceOut = numDice;
			this.diceFacesOut = diceFaces;
			this.modOut = modOut;
			// endregion
		}

		get dprTargetMin () { return this.dprTargetRange[0]; }
		get dprTargetMax () { return this.dprTargetRange[1]; }

		isInRange (num) {
			return num >= this.dprTargetRange[0] && num <= this.dprTargetRange[1];
		}

		getDiceExpression ({numDice, diceFaces, mod} = {}) {
			numDice ??= this.numDiceOut;
			diceFaces ??= this.diceFacesOut;
			mod ??= this.modOut;

			const ptDice = diceFaces === 1
				? ((numDice || 1) * diceFaces)
				: `${numDice}d${diceFaces}`;
			const ptMod = mod !== 0
				? ` ${mod > 0 ? "+" : ""} ${mod}`
				: "";
			return `${ptDice}${ptMod}`;
		}

		toString () {
			return [
				`Original expression (approx): ${this.numDice}d${this.diceFaces} + ${this.modOut}`,
				`Current formula: ${this.getDiceExpression()}`,
				`Current average: ${ScaleCreatureUtils.getDiceExpressionAverage(this.getDiceExpression())}`,
				`Target range: ${this.dprTargetMin}-${this.dprTargetMax}`,
			]
				.join("\n");
		}
	};

	static _MAX_ATTEMPTS = 100;

	static getScaled (
		{
			dprTargetRange,

			prefix,
			suffix,

			numDice,
			dprAdjusted,
			diceFaces,

			modOut,

			isAllowAdjustingMod = true,
		},
	) {
		const state = new this._State({
			dprTargetRange,
			prefix,
			suffix,
			numDice,
			dprAdjusted,
			diceFaces,
			modOut,
			isAllowAdjustingMod,
		});

		for (let ixAttempt = 0; ixAttempt < this._MAX_ATTEMPTS; ++ixAttempt) {
			if (state.isInRange(ScaleCreatureUtils.getDiceExpressionAverage(state.getDiceExpression()))) return this._getScaled_getOutput(state);

			// order of preference for scaling:
			// - adjusting number of dice
			// - adjusting number of faces
			// - adjusting modifier
			if (this._getScaled_tryAdjustNumDice(state)) continue;
			if (this._getScaled_tryAdjustDiceFaces(state)) continue;
			this._getScaled_tryAdjustMod(state, {ixAttempt});
		}

		throw new Error(`Failed to find new DPR!\n${state}`);
	}

	static _DIR_INCREASE = 1;
	static _DIR_DECREASE = -1;

	static _getScaled_tryAdjustNumDice (state, {diceFacesTemp = null} = {}) {
		diceFacesTemp ??= state.diceFacesOut;
		let numDiceTemp = state.numDice;

		let tempAvgDpr = ScaleCreatureUtils.getDiceExpressionAverage(
			state.getDiceExpression({
				numDice: numDiceTemp,
				diceFaces: diceFacesTemp,
			}),
		);

		const dir = state.dprAdjusted < tempAvgDpr ? this._DIR_DECREASE : this._DIR_INCREASE;

		while (
			(dir === this._DIR_INCREASE || numDiceTemp > 1)
			&& (dir === this._DIR_INCREASE ? tempAvgDpr <= state.dprTargetMax : tempAvgDpr >= state.dprTargetMin)
		) {
			numDiceTemp += dir;
			tempAvgDpr += dir * ((diceFacesTemp + 1) / 2);

			if (
				state.isInRange(
					ScaleCreatureUtils.getDiceExpressionAverage(
						state.getDiceExpression({
							numDice: numDiceTemp,
							diceFaces: diceFacesTemp,
						}),
					),
				)
			) {
				state.numDiceOut = numDiceTemp;
				return true;
			}
		}

		return false;
	}

	static _getNextDice (diceFaces) {
		return Renderer.dice.getNextDice(diceFaces);
	}

	static _getPreviousDice (diceFaces) {
		return diceFaces === 4 ? 1 : Renderer.dice.getPreviousDice(diceFaces);
	}

	static _getScaled_tryAdjustDiceFaces (state) {
		// can't be scaled
		if (state.diceFaces === 1 || state.diceFaces === 20) return false;

		// Pick an initial scaling direction for the dice faces
		const dirs = state.dprAdjusted < ScaleCreatureUtils.getDiceExpressionAverage(
			state.getDiceExpression({
				diceFaces: state.diceFaces,
			}),
		)
			? [this._DIR_DECREASE, this._DIR_INCREASE]
			: [this._DIR_INCREASE, this._DIR_DECREASE];

		for (const dir of dirs) {
			let diceFacesTemp = state.diceFaces;

			ScaleCreatureUtils.getDiceExpressionAverage(
				state.getDiceExpression({
					diceFaces: diceFacesTemp,
				}),
			);

			while (
				(dir === this._DIR_INCREASE ? diceFacesTemp < 20 : diceFacesTemp > 1)
			) {
				diceFacesTemp = dir === this._DIR_INCREASE ? this._getNextDice(diceFacesTemp) : this._getPreviousDice(diceFacesTemp);
				ScaleCreatureUtils.getDiceExpressionAverage(state.getDiceExpression({diceFaces: diceFacesTemp}));

				if (
					state.isInRange(
						ScaleCreatureUtils.getDiceExpressionAverage(
							state.getDiceExpression({diceFaces: diceFacesTemp}),
						),
					)
				) {
					state.diceFacesOut = diceFacesTemp;
					return true;
				}

				if (this._getScaled_tryAdjustNumDice(state, {diceFacesTemp})) {
					state.diceFacesOut = diceFacesTemp;
					return true;
				}
			}
		}

		return false;
	}

	static _getScaled_tryAdjustMod (state, {ixAttempt}) {
		if (!state.isAllowAdjustingMod) return false;

		// alternating sequence, going further from origin each time.
		// E.g. original modOut == 0 => 1, -1, 2, -2, 3, -3, ... modOut+n, modOut-n
		state.modOut += (1 - ((ixAttempt % 2) * 2)) * (ixAttempt + 1);
	}

	/** Alternate implementation which prevents dec/increasing AS when inc/decreasing CR */
	static _getScaled_tryAdjustMod_alt (state, {crIn, crOut}) {
		if (!state.isAllowAdjustingMod) return false;

		state.modOut += Math.sign(crOut - crIn);
		state.modOut = Math.max(-5, Math.min(state.modOut, 10)); // Cap at -5 (0) and at +10 (30)
	}

	static _getScaled_getOutput (state) {
		const diceExpOut = state.getDiceExpression({
			numDice: state.numDiceOut,
			diceFaces: state.diceFacesOut,
			mod: state.modOut + state.offsetEnchant,
		});

		const avgDamOut = Math.floor(ScaleCreatureUtils.getDiceExpressionAverage(diceExpOut));
		if (avgDamOut <= 0 || diceExpOut === "1") {
			return {
				expression: `1 ${state.suffix.replace(/^\W+/, " ").replace(/ +/, " ")}`,
				modOut: state.modOut,
			};
		}

		const expression = [
			Math.floor(ScaleCreatureUtils.getDiceExpressionAverage(diceExpOut)),
			state.prefix,
			diceExpOut,
			state.suffix,
		]
			.filter(Boolean)
			.join("");

		return {
			expression,
			modOut: state.modOut,
		};
	}

	/* -------------------------------------------- */

	static getCreatureDamageScaleMeta ({crInNumber, crOutNumber}) {
		const dprRangeIn = ScaleCreatureConsts.CR_DPR_RANGES[crInNumber];
		if (!dprRangeIn) return null;
		const dprRangeOut = ScaleCreatureConsts.CR_DPR_RANGES[crOutNumber];
		if (!dprRangeOut) return null;

		const dprAverageIn = dprRangeIn.mean();
		const dprAverageOut = dprRangeOut.mean();

		const crOutDprVariance = (dprRangeOut[1] - dprRangeOut[0]) / 2;

		return {
			dprAverageIn,
			dprAverageOut,
			crOutDprVariance,
		};
	}

	static getExpressionDamageScaleMeta (
		{
			diceExp,

			crInNumber,
			crOutNumber,

			dprAverageIn,
			dprAverageOut,
			crOutDprVariance,

			offsetEnchant = 0,
		},
	) {
		diceExp = diceExp.replace(/\s+/g, "");
		const avgDpr = ScaleCreatureUtils.getDiceExpressionAverage(diceExp);
		const dprAdjusted = ScaleCreatureUtils.getScaledDpr({dprIn: avgDpr, crInNumber, dprTargetIn: dprAverageIn, dprTargetOut: dprAverageOut});

		const dprTargetRange = [
			Math.max(0, Math.floor(dprAdjusted - crOutDprVariance)),
			Math.ceil(Math.max(1, dprAdjusted + crOutDprVariance)),
		];

		// in official data, there are no dice expressions with more than one type of dice
		const [dice, modifier] = diceExp.split(/[-+]/);
		const [numDice, diceFaces] = dice.split("d").map(it => Number(it));
		const modFromAbil = modifier ? Number(modifier) - offsetEnchant : null;

		return {
			dprTargetRange,
			numDice,
			dprAdjusted,
			diceFaces,
			modFromAbil,
		};
	}

	static getAdjustedDamageMod (
		{
			crInNumber,
			crOutNumber,

			abilBeingScaled = null,
			strTmpMod = null,
			dexTmpMod = null,

			modFromAbil,

			offsetEnchant = 0,
		},
	) {
		if (abilBeingScaled === "str" && strTmpMod != null) return strTmpMod;
		if (abilBeingScaled === "dex" && dexTmpMod != null) return dexTmpMod;

		if (modFromAbil == null) return 0 - offsetEnchant; // ensure enchanted equipment is ignored even with +0 base damage mod

		// calculate this without enchanted equipment; ignore them and add them back at the end
		return ScaleCreatureUtils.interpAndTranslateToSpace(
			modFromAbil,
			ScaleCreatureConsts.CR_TO_ESTIMATED_DAMAGE_MOD[crInNumber],
			ScaleCreatureConsts.CR_TO_ESTIMATED_DAMAGE_MOD[crOutNumber],
		);
	}
}

class _CrScalerDprState {
	constructor () {
		this.dprMax = 0;
	}
}

class CrScalerDpr extends CrScalerBase {
	constructor (opts) {
		super(opts);

		const {dprAverageIn, dprAverageOut, crOutDprVariance} = ScaleCreatureDamageExpression.getCreatureDamageScaleMeta({crInNumber: this._crInNumber, crOutNumber: this._crOutNumber});
		this._dprAverageIn = dprAverageIn;
		this._dprAverageOut = dprAverageOut;
		this._crOutDprVariance = crOutDprVariance;

		this._originalStrMod = Parser.getAbilityModNumber(this._mon.str);
		this._originalDexMod = Parser.getAbilityModNumber(this._mon.dex);
	}

	/* -------------------------------------------- */

	_getCandidateScaledEntries_doPostCalc (
		{
			modOutScaled,
			abilBeingScaled,
			diceExp,
			strMod,
			dexMod,
			stateDpr,
			dprAdjusted,
			reqAbilAdjust,
		},
	) {
		// prevent ability scores going below zero
		// should be mathematically impossible, if the recalculation is working correctly as:
		// - minimum damage dice is a d4
		// - minimum number of dice is 1
		// - minimum DPR range is 0-1, which can be achieved with e.g. 1d4-1 (avg 1) or 1d4-2 (avg 0)
		// therefore, this provides a sanity check: this should only occur when something's broken
		if (modOutScaled < -5) throw new Error(`Ability modifier ${abilBeingScaled != null ? `(${abilBeingScaled})` : ""} was below -5 (${modOutScaled})! Original dice expression was ${diceExp}.`);

		if (abilBeingScaled == null) return true;

		const originalAbilMod = abilBeingScaled === "str" ? strMod : abilBeingScaled === "dex" ? dexMod : null;

		if (originalAbilMod != null) {
			if (this._state.getTempAbilityMod(abilBeingScaled) != null && this._state.getTempAbilityMod(abilBeingScaled) !== modOutScaled) {
				if (stateDpr.dprMax < dprAdjusted) {
					// TODO test this -- none of the official monsters require attribute re-calculation but homebrew might. The story so far:
					//   - A previous damage roll required an adjusted ability modifier to make the numbers line up
					//   - This damage roll requires a _different_ adjustment to the same modifier to make the numbers line up
					//   - This damage roll has a bigger average DPR, so should be prioritised. Update the modifier using this roll's requirements.
					//   - Since this will effectively invalidate the previous roll adjustments, break out of whatever we're doing here, and restart the entire adjustment process
					//   - As we've set our new attribute modifier on the creature, the next loop will respect it, and use it by default
					//   - Additionally, track the largest DPR, so we don't get stuck in a loop doing this on the next DPR adjustment iteration
					this._state.setTempAbilityMod(abilBeingScaled, modOutScaled);
					stateDpr.dprMax = dprAdjusted;
					return false;
				}
			}

			// Always update the ability score key if one was used, to avoid later rolls clobbering our
			//   values. We do this for e.g. Young White Dragon's "Bite" attack being scaled from CR6 to 7,
			//   which would otherwise cause the 1d8 (mod 0) to calculate a new Strength value.
			stateDpr.dprMax = Math.max((stateDpr.dprMax || 0), dprAdjusted);
			this._state.setTempAbilityMod(abilBeingScaled, modOutScaled);
		}

		// Track dbg data
		reqAbilAdjust.push({
			ability: abilBeingScaled,
			mod: modOutScaled,
			dprAdjusted,
		});

		return true;
	}

	_getCandidateScaledEntries_doProp (
		{
			stateDpr,
			scaledEntries,
			strMod,
			dexMod,
			prop,
		},
	) {
		if (!this._mon[prop]) return true; // if there was nothing to do, the operation was a success

		let allSucceeded = true;

		this._mon[prop].forEach((it, idxProp) => {
			const toUpdate = JSON.stringify(it.entries);

			// handle flat values first, as we may convert dice values to flats
			let out = toUpdate.replace(RollerUtil.REGEX_DAMAGE_FLAT, (m0, prefix, flatVal, suffix) => {
				const adjDpr = ScaleCreatureUtils.getScaledDpr({dprIn: flatVal, crInNumber: this._crInNumber, dprTargetIn: this._dprAverageIn, dprTargetOut: this._dprAverageOut});
				return `${prefix}${adjDpr}${suffix}`;
			});

			// track attribute adjustment requirements (unused except for dbgging)
			const reqAbilAdjust = [];

			// pre-calculate enchanted weapon offsets
			const offsetEnchant = CrScalerUtilsAttack.getEnchantmentBonus(it.name);

			out = out.replace(RollerUtil.REGEX_DAMAGE_DICE, (m0, average, prefix, diceExp, suffix) => {
				const {
					dprTargetRange,
					numDice,
					dprAdjusted,
					diceFaces,
					modFromAbil,
				} = ScaleCreatureDamageExpression.getExpressionDamageScaleMeta({
					diceExp,

					crInNumber: this._crInNumber,
					crOutNumber: this._crOutNumber,

					dprAverageIn: this._dprAverageIn,
					dprAverageOut: this._dprAverageOut,
					crOutDprVariance: this._crOutDprVariance,
				});

				// try to figure out which mod we're going to be scaling
				const abilBeingScaled = CrScalerUtilsAttack.getAbilBeingScaled({
					strMod: this._originalStrMod,
					dexMod: this._originalDexMod,
					modFromAbil,
					name: it.name,
					content: toUpdate,
				});

				const modOut = ScaleCreatureDamageExpression.getAdjustedDamageMod({
					crInNumber: this._crInNumber,
					crOutNumber: this._crOutNumber,

					abilBeingScaled,
					strTmpMod: this._state.getTempAbilityMod("str"),
					dexTmpMod: this._state.getTempAbilityMod("dex"),

					modFromAbil,

					offsetEnchant,
				});

				const {expression, modOut: modOutScaled} = ScaleCreatureDamageExpression.getScaled({
					dprTargetRange,
					prefix,
					suffix,

					numDice,
					dprAdjusted,
					diceFaces,
					offsetEnchant,

					modOut,

					isAllowAdjustingMod: modFromAbil != null,
				});

				allSucceeded = allSucceeded && this._getCandidateScaledEntries_doPostCalc({
					modOutScaled,
					abilBeingScaled,
					diceExp,
					strMod,
					dexMod,
					stateDpr,
					dprAdjusted,
					reqAbilAdjust,
				});

				return expression;
			});

			// skip remaining entries, to let the outer loop continue
			if (!allSucceeded) return false;

			if (toUpdate !== out) {
				scaledEntries.push({
					prop,
					idxProp,
					entriesStrOriginal: toUpdate, // unused/debug
					entriesStr: out,
					reqAbilAdjust, // unused/debug
				});
			}
		});

		return allSucceeded;
	}

	_getCandidateScaledEntries (
		{
			stateDpr,
		},
	) {
		const scaledEntries = [];

		const argsShared = {
			stateDpr,
			scaledEntries,
			strMod: this._state.getTempAbilityMod("str") || this._originalStrMod,
			dexMod: this._state.getTempAbilityMod("dex") || this._originalDexMod,
		};

		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "trait"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "action"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "bonus"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "reaction"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "legendary"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "mythic"})) return null;
		if (!this._getCandidateScaledEntries_doProp({...argsShared, prop: "variant"})) return null;

		return scaledEntries;
	}

	_doAdjustDpr ({stateDpr}) {
		let scaledEntries;
		for (let i = 0; i < 99; ++i) {
			scaledEntries = this._getCandidateScaledEntries({stateDpr});
			if (scaledEntries) break;
		}

		// overwrite originals with scaled versions
		scaledEntries.forEach(it => {
			this._mon[it.prop][it.idxProp].entries = JSON.parse(it.entriesStr);
		});
	}

	/* -------------------------------------------- */

	_doFinalize_updateAbility ({prop}) {
		if (this._state.getTempAbilityMod(prop) == null) return;

		this._state.setHasModifiedAbilityScore(prop);
		this._mon[prop] = CrScalerUtils.calcNewAbility(this._mon, prop, this._state.getTempAbilityMod(prop));
	}

	_doFinalize () {
		this._doFinalize_updateAbility({prop: "str"});
		this._doFinalize_updateAbility({prop: "dex"});
	}

	/* -------------------------------------------- */

	doAdjust () {
		const stateDpr = new _CrScalerDprState();
		this._doAdjustDpr({stateDpr});
		this._doFinalize();
	}
}

// calculated as the mean modifier for each CR,
// -/+ the mean absolute deviation,
// rounded to the nearest integer
const _CR_TO_ESTIMATED_CON_MOD_RANGE = {
	"0": [-1, 2],
	"0.125": [-1, 1],
	"0.25": [0, 2],
	"0.5": [0, 2],
	"1": [0, 2],
	"2": [0, 3],
	"3": [1, 3],
	"4": [1, 4],
	"5": [2, 4],
	"6": [2, 5],
	"7": [1, 5],
	"8": [1, 5],
	"9": [2, 5],
	"10": [2, 5],
	"11": [2, 6],
	"12": [1, 5],
	"13": [3, 6],
	"14": [3, 6],
	"15": [3, 6],
	"16": [4, 7],
	"17": [3, 7],
	"18": [1, 7],
	"19": [4, 6],
	"20": [5, 9],
	"21": [3, 8],
	"22": [4, 9],
	"23": [5, 9],
	"24": [5, 9],
	"25": [7, 9],
	"26": [7, 9],
	// no creatures for these CRs; use 26
	"27": [7, 9],
	"28": [7, 9],
	"29": [7, 9],
	// end
	"30": [10, 10],
};

class _CrScalerHpState {
	constructor (
		{
			mon,
			crInNumber,
			crOutNumber,
		},
	) {
		this._mon = mon;
		this._crInNumber = crInNumber;
		this._crOutNumber = crOutNumber;

		// Derived data
		this._hpInAvg = ScaleCreatureConsts.CR_HP_RANGES[crInNumber].mean();
		this._hpOutRange = ScaleCreatureConsts.CR_HP_RANGES[crOutNumber];
		this._targetHpOut = ScaleCreatureUtils.getScaledToRatio(mon.hp.average, this._hpInAvg, this._hpOutRange.mean());
		this._targetHpDeviation = (this._hpOutRange[1] - this._hpOutRange[0]) / 2;
		this._targetHpRange = [Math.floor(this._targetHpOut - this._targetHpDeviation), Math.ceil(this._targetHpOut + this._targetHpDeviation)];

		// Dice state
		this._hdFaces = null;
		this._hdAvg = null;
		this._modPerHd = null;
		this._hpModTarget = null;

		this._numHdOut = null;
		this._hpModOut = null;
	}

	/* -------------------------------------------- */

	isInRange (val) { return val >= this._targetHpRange[0] && val <= this._targetHpRange[1]; }
	isAboveRange (val) { return val > this._targetHpRange[1]; }
	isBelowRange (val) { return val < this._targetHpRange[0]; }

	/* -------------------------------------------- */

	getAsSpecialHp () {
		const cpyHp = MiscUtil.copyFast(this._mon.hp);
		delete cpyHp.average;
		delete cpyHp.formula;

		return {
			...cpyHp,
			special: Math.floor(Math.max(1, this._targetHpOut)),
		};
	}

	/* -------------------------------------------- */

	getAvg ({numHd = null, hpMod = null} = {}) {
		numHd ??= this._numHdOut;
		hpMod ??= this._hpModOut;
		return (numHd * this._hdAvg) + (numHd * hpMod);
	}

	/* -------------------------------------------- */

	initDiceState () {
		const origFormula = this._mon.hp.formula.replace(/\s*/g, "");

		// if it's not a well-known formula, convert our scaled "average" to a "special" and bail out
		if (!/^\d+d\d+(?:[-+]\d+)?$/.test(origFormula)) {
			return false;
		}

		const fSplit = origFormula.split(/([-+])/);
		const mDice = /(\d+)d(\d+)/i.exec(fSplit[0]);
		const hdFaces = Number(mDice[2]);
		const hdAvg = (hdFaces + 1) / 2;
		const numHd = Number(mDice[1]);
		const modTotal = fSplit.length === 3 ? Number(`${fSplit[1]}${fSplit[2]}`) : 0;
		const modPerHd = Math.floor(modTotal / numHd);

		const hpModTargetRange = _CR_TO_ESTIMATED_CON_MOD_RANGE[this._crOutNumber];
		const hpModTarget = hpModTargetRange[0] === hpModTargetRange[1] // handle CR 30, which is always 10
			? hpModTargetRange[0]
			: ScaleCreatureUtils.interpAndTranslateToSpace(modPerHd, _CR_TO_ESTIMATED_CON_MOD_RANGE[this._crInNumber], hpModTargetRange);

		this._hdFaces = hdFaces;
		this._hdAvg = hdAvg;
		this._modPerHd = modPerHd;
		this._hpModTarget = hpModTarget;

		this._numHdOut = numHd;
		this._hpModOut = hpModTarget;

		return true;
	}

	/* -------------------------------------------- */

	getHdAvg () { return this._hdAvg; }
	getHdModTarget () { return this._hpModTarget; }
	getNumHdOut () { return this._numHdOut; }

	setHpModOut (val) { this._hpModOut = val; }
	setNumHdOut (val) { this._numHdOut = val; }

	/* -------------------------------------------- */

	mutOutput () {
		this._mon.hp.average = Math.floor(this.getAvg());
		const outModTotal = this._numHdOut * this._hpModOut;
		this._mon.hp.formula = `${this._numHdOut}d${this._hdFaces}${outModTotal === 0 ? "" : `${outModTotal >= 0 ? "+" : ""}${outModTotal}`}`
			.replace(/([-+])\s*(\d+)$/g, " $1 $2"); // add spaces around the operator

		if (this._hpModOut === this._modPerHd) return false;

		const conOut = CrScalerUtils.calcNewAbility(this._mon, "con", this._hpModOut);
		const isConChange = conOut !== this._mon.con;

		if (isConChange && this._mon.save?.con) {
			const conDelta = Parser.getAbilityModifier(conOut) - Parser.getAbilityModifier(this._mon.con);
			const conSaveOut = Number(this._mon.save.con) + conDelta;
			this._mon.save.con = `${conSaveOut >= 0 ? "+" : ""}${conSaveOut}`;
		}

		this._mon.con = conOut;

		return isConChange;
	}

	/* -------------------------------------------- */

	getLoggableState () { return `${this._numHdOut}d${this._hpModOut}`; }
}

class CrScalerHp extends CrScalerBase {
	_doAdjust_tryAdjustNumDice ({hpState}) {
		let numDiceTemp = hpState.getNumHdOut();
		let tempTotalHp = hpState.getAvg();
		let found = false;

		if (hpState.isAboveRange(tempTotalHp)) {
			while (numDiceTemp > 1) {
				numDiceTemp -= 1;
				tempTotalHp -= hpState.getHdAvg();

				if (hpState.isInRange(hpState.getAvg({numHd: numDiceTemp}))) {
					found = true;
					break;
				}
			}
		} else { // too low
			while (hpState.isBelowRange(tempTotalHp)) {
				numDiceTemp += 1;
				tempTotalHp += hpState.getHdAvg();

				if (hpState.isInRange(hpState.getAvg({numHd: numDiceTemp}))) {
					found = true;
					break;
				}
			}
		}

		if (found) {
			hpState.setNumHdOut(numDiceTemp);
			return true;
		}
		return false;
	}

	_doAdjust_tryAdjustMod ({hpState, iter}) {
		const ptAlternatePlusMinus = (1 - ((iter % 2) * 2));

		const hpModOutNxt = hpState.getHdModTarget()
			// alternating sequence, going further from origin each time.
			// E.g. original modOut == 0 => 1, -1, 2, -2, 3, -3, ... modOut+n, modOut-n
			+ Math.ceil((iter + 1) / 2) * ptAlternatePlusMinus;

		// Avoid negative ability scores
		if (hpModOutNxt < -5) return;

		hpState.setHpModOut(hpModOutNxt);
	}

	doAdjust () {
		if (this._mon.hp == null || this._mon.hp.special != null) return; // could be anything; best to just leave it

		const hpState = new _CrScalerHpState({
			mon: this._mon,
			crInNumber: this._crInNumber,
			crOutNumber: this._crOutNumber,
		});

		const hasDiceState = hpState.initDiceState();

		if (!hasDiceState) {
			this._mon.hp = hpState.getAsSpecialHp();
			return;
		}

		for (let iter = 0; iter < 100; ++iter) {
			if (hpState.isInRange(hpState.getAvg())) break;

			if (iter === 99) throw new Error(`Failed to find new HP! Current formula is: ${hpState.getLoggableState()}`);

			// order of preference for scaling:
			// - adjusting number of dice
			// - adjusting modifier
			if (this._doAdjust_tryAdjustNumDice({hpState})) break;
			this._doAdjust_tryAdjustMod({hpState, iter});
		}

		const isConChange = hpState.mutOutput();
		if (isConChange) this._state.setHasModifiedAbilityScore("con");
	}
}

/**
 * Scale a creature based on the "Creating Quick Monster Stats" "Monster Statistics by Challenge Rating" table
 *   in the 2014 DMG.
 */
class ScaleCreature {
	static isCrInScaleRange (mon) {
		if ([VeCt.CR_UNKNOWN, VeCt.CR_CUSTOM].includes(Parser.crToNumber(mon.cr))) return false;
		// Only allow scaling for creatures in the 0-30 CR range (homebrew may specify e.g. >30)
		const xpVal = Parser.XP_CHART_ALT[mon.cr?.cr ?? mon.cr];
		return xpVal != null;
	}

	static _CASTER_LEVEL_AND_CLASS_CANTRIPS = {
		artificer: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
		bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
		druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
		warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
	};

	static _casterLevelAndClassToCantrips (level, clazz) {
		clazz = (clazz || "cleric").toLowerCase(); // Cleric/Wizard have middle-ground scaling
		return this._CASTER_LEVEL_AND_CLASS_CANTRIPS[clazz][level];
	}

	// cantrips that should be preserved when lowering the number of cantrips known, to ensure caster effectiveness
	static _PROTECTED_CANTRIPS = ["acid splash", "chill touch", "eldritch blast", "fire bolt", "poison spray", "produce flame", "ray of frost", "sacred flame", "shocking grasp", "thorn whip", "vicious mockery"];

	// analysis of official data + some manual smoothing
	static _CR_TO_CASTER_LEVEL_AVG = {
		"0": 2,
		"0.125": 2,
		"0.25": 2,
		"0.5": 2,
		"1": 3.5,
		"2": 4.25,
		"3": 5.75,
		"4": 6.75,
		"5": 8,
		"6": 9.75,
		"7": 10.5,
		"8": 10.75,
		"9": 11.5,
		"10": 11.75,
		"11": 12,
		"12": 13,
		"13": 14,
		"14": 15,
		"15": 16,
		"16": 17,
		"17": 18,
		"18": 19,
		"19": 20, // (no samples; manually added)
	};

	static _crToCasterLevel (cr) {
		if (cr === 0) return 2;
		if (cr >= 19) return 20;
		return this._CR_TO_CASTER_LEVEL_AVG[cr];
	}

	/**
	 * @async
	 * @param mon Creature data.
	 * @param crOutNumber target CR, as a number.
	 * @return {Promise<creature>} the scaled creature.
	 */
	static async scale (mon, crOutNumber) {
		await this._pInitSpellCache();

		if (crOutNumber == null || crOutNumber === "Unknown") throw new Error("Attempting to scale unknown CR!");

		CrScalerUtils.init(mon, crOutNumber);

		const state = new ScaleCreatureState(mon);

		mon = MiscUtil.copyFast(mon);

		const crIn = mon.cr.cr || mon.cr;
		const crInNumber = Parser.crToNumber(crIn);
		if (crInNumber === crOutNumber) throw new Error("Attempting to scale creature to own CR!");
		if (crInNumber > 30) throw new Error("Attempting to scale a creature beyond 30 CR!");
		if (crInNumber < 0) throw new Error("Attempting to scale a creature below 0 CR!");

		const pbIn = Parser.crToPb(crIn);
		const pbOut = Parser.crToPb(String(crOutNumber));

		if (pbIn !== pbOut) this._applyPb(mon, pbIn, pbOut);

		new CrScalerHp({mon, crInNumber, crOutNumber, pbIn, pbOut, state}).doAdjust();
		new CrScalerHitSave({mon, crInNumber, crOutNumber, pbIn, pbOut, state}).doAdjust();
		new CrScalerDpr({mon, crInNumber, crOutNumber, pbIn, pbOut, state}).doAdjust();
		this._adjustSpellcasting(mon, crInNumber, crOutNumber);

		// adjust AC after DPR/etc, as DPR takes priority for adjusting DEX
		new CrScalerArmorClass({mon, crInNumber, crOutNumber, pbIn, pbOut, state}).doAdjust();

		// TODO update not-yet-scaled abilities

		this._handleUpdateAbilityScoresSkillsSaves({mon, state});

		const crOutStr = Parser.numberToCr(crOutNumber);
		if (mon.cr.cr) mon.cr.cr = crOutStr;
		else mon.cr = crOutStr;

		Renderer.monster.updateParsed(mon);

		mon._displayName = `${mon.name} (CR ${crOutStr})`;
		mon._scaledCr = crOutNumber;
		mon._isScaledCr = true;
		mon._originalCr = mon._originalCr || crIn;

		return mon;
	}

	static _applyPb (mon, pbIn, pbOut) {
		if (mon.save) {
			Object.keys(mon.save).forEach(k => {
				const bonus = mon.save[k];

				const fromAbility = Parser.getAbilityModNumber(mon[k]);
				if (fromAbility === Number(bonus)) return; // handle the case where no-PB saves are listed

				const actualPb = bonus - fromAbility;
				const expert = actualPb === pbIn * 2;

				mon.save[k] = this._applyPb_getNewSkillSaveMod(pbIn, pbOut, bonus, expert);
			});
		}

		this._applyPb_skills(mon, pbIn, pbOut, mon.skill);

		const pbDelta = pbOut - pbIn;

		if (mon.spellcasting) {
			mon.spellcasting.forEach(sc => {
				if (sc.headerEntries) {
					const toUpdate = JSON.stringify(sc.headerEntries);
					const out = ScaleCreatureUtils.applyPbDeltaDc(
						ScaleCreatureUtils.applyPbDeltaToHit(toUpdate, pbDelta),
						pbDelta,
					);
					sc.headerEntries = JSON.parse(out);
				}
			});
		}

		const handleGenericEntries = (prop) => {
			if (mon[prop]) {
				mon[prop].forEach(it => {
					const toUpdate = JSON.stringify(it.entries);
					const out = ScaleCreatureUtils.applyPbDeltaDc(
						ScaleCreatureUtils.applyPbDeltaToHit(toUpdate, pbDelta),
						pbDelta,
					);
					it.entries = JSON.parse(out);
				});
			}
		};

		handleGenericEntries("trait");
		handleGenericEntries("action");
		handleGenericEntries("bonus");
		handleGenericEntries("reaction");
		handleGenericEntries("legendary");
		handleGenericEntries("mythic");
		handleGenericEntries("variant");
	}

	static _applyPb_getNewSkillSaveMod (pbIn, pbOut, oldMod, expert) {
		const mod = Number(oldMod) - (expert ? 2 * pbIn : pbIn) + (expert ? 2 * pbOut : pbOut);
		return UiUtil.intToBonus(mod);
	}

	static _applyPb_skills (mon, pbIn, pbOut, monSkill) {
		if (!monSkill) return;

		Object.keys(monSkill).forEach(skill => {
			if (skill === "other") {
				monSkill[skill].forEach(block => {
					if (block.oneOf) {
						this._applyPb_skills(mon, pbIn, pbOut, block.oneOf);
					} else throw new Error(`Unhandled "other" skill keys: ${Object.keys(block)}`);
				});
				return;
			}

			const bonus = monSkill[skill];

			const fromAbility = Parser.getAbilityModNumber(mon[Parser.skillToAbilityAbv(skill)]);
			if (fromAbility === Number(bonus)) return; // handle the case where no-PB skills are listed

			const actualPb = bonus - fromAbility;
			const expert = actualPb === pbIn * 2;

			monSkill[skill] = this._applyPb_getNewSkillSaveMod(pbIn, pbOut, bonus, expert);

			if (skill === "perception" && mon.passive != null) mon.passive = 10 + Number(monSkill[skill]);
		});
	}

	static _handleUpdateAbilityScoresSkillsSaves ({mon, state}) {
		const TO_HANDLE = ["str", "dex", "int", "wis", "cha"];

		TO_HANDLE.forEach(abil => {
			if (!state.getHasModifiedAbilityScore(abil)) return;

			const diff = Parser.getAbilityModNumber(mon[abil]) - Parser.getAbilityModNumber(state.getOriginalScore(abil));

			if (mon.save && mon.save[abil] != null) {
				const out = Number(mon.save[abil]) + diff;
				mon.save[abil] = UiUtil.intToBonus(out);
			}

			this._handleUpdateAbilityScoresSkillsSaves_handleSkills(mon.skill, abil, diff);

			if (abil === "wis" && mon.passive != null) {
				if (typeof mon.passive === "number") {
					mon.passive = mon.passive + diff;
				} else {
					// Passive perception can be a string in e.g. the case of Artificer Steel Defender
					delete mon.passive;
				}
			}
		});
	}

	static _handleUpdateAbilityScoresSkillsSaves_handleSkills (monSkill, abil, diff) {
		if (!monSkill) return;

		Object.keys(monSkill).forEach(skill => {
			if (skill === "other") {
				monSkill[skill].forEach(block => {
					if (block.oneOf) {
						this._handleUpdateAbilityScoresSkillsSaves_handleSkills(block.oneOf.oneOf, abil, diff);
					} else throw new Error(`Unhandled "other" skill keys: ${Object.keys(block)}`);
				});
				return;
			}

			const skillAbil = Parser.skillToAbilityAbv(skill);
			if (skillAbil !== abil) return;
			const out = Number(monSkill[skill]) + diff;
			monSkill[skill] = UiUtil.intToBonus(out);
		});
	}

	static _spells = null;
	static async _pInitSpellCache () {
		if (this._spells) return Promise.resolve();

		this._spells = {};

		this.__initSpellCache({
			spell: (await DataUtil.spell.loadJSON()).spell.filter(sp => sp.source === Parser.SRC_PHB),
		});
	}

	static __initSpellCache (data) {
		data.spell.forEach(s => {
			Renderer.spell.getCombinedClasses(s, "fromClassList")
				.forEach(c => {
					let it = (this._spells[c.source] = this._spells[c.source] || {});
					const lowName = c.name.toLowerCase();
					it = (it[lowName] = it[lowName] || {});
					it = (it[s.level] = it[s.level] || {});
					it[s.name] = 1;
				});
		});
	}

	static _adjustSpellcasting (mon, crIn, crOut) {
		const getSlotsAtLevel = (casterLvl, slotLvl) => {
			// there's probably a nice equation for this somewhere
			if (casterLvl < (slotLvl * 2) - 1) return 0;
			switch (slotLvl) {
				case 1: return casterLvl === 1 ? 2 : casterLvl === 2 ? 3 : 4;
				case 2: return casterLvl === 3 ? 2 : 3;
				case 3: return casterLvl === 5 ? 2 : 3;
				case 4: return casterLvl === 7 ? 1 : casterLvl === 8 ? 2 : 3;
				case 5: return casterLvl === 9 ? 1 : casterLvl < 18 ? 2 : 3;
				case 6: return casterLvl >= 19 ? 2 : 1;
				case 7: return casterLvl === 20 ? 2 : 1;
				case 8: return 1;
				case 9: return 1;
			}
		};

		if (!mon.spellcasting) return;

		const idealClvlIn = this._crToCasterLevel(crIn);
		const idealClvlOut = this._crToCasterLevel(crOut);

		const isWarlock = this._adjustSpellcasting_isWarlock(mon);
		// favor the first result as primary
		let primaryInLevel = null;
		let primaryOutLevel = null;

		mon.spellcasting.forEach(sc => {
			// attempt to ascertain class spells
			let spellsFromClass = null;

			if (sc.headerEntries) {
				const inStr = JSON.stringify(sc.headerEntries);

				let anyChange = false;
				const outStr = inStr.replace(/(an?) (\d+)[A-Za-z]+-level/i, (...m) => {
					const level = Number(m[2]);
					const outLevel = Math.max(1, Math.min(20, ScaleCreatureUtils.getScaledToRatio(level, idealClvlIn, idealClvlOut)));
					anyChange = level !== outLevel;
					if (anyChange) {
						if (primaryInLevel == null) primaryInLevel = level;
						if (primaryOutLevel == null) primaryOutLevel = outLevel;
						return `${Parser.getArticle(outLevel)} ${Parser.spLevelToFull(outLevel)}-level`;
					} else return m[0];
				});

				const mClasses = /(artificer|bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard) spells?/i.exec(outStr);
				if (mClasses) spellsFromClass = mClasses[1];
				else {
					const mClasses2 = /(artificer|bard|cleric|druid|paladin|ranger|sorcerer|warlock|wizard)(?:'s)? spell list/i.exec(outStr);
					if (mClasses2) spellsFromClass = mClasses2[1];
				}

				if (anyChange) sc.headerEntries = JSON.parse(outStr);
			}

			// calculate spell level from caster levels
			let maxSpellLevel = null;
			if (primaryOutLevel) {
				maxSpellLevel = Math.min(9, Math.ceil(primaryOutLevel / 2));

				// cap half-caster slots at 5
				if (/paladin|ranger|warlock/i.exec(spellsFromClass)) {
					maxSpellLevel = Math.min(5, primaryOutLevel);
				}
			}

			if (sc.spells && primaryOutLevel != null) {
				const spells = sc.spells;

				// "lower" is the property defining a set of spell slots as having a lower bound, e.g. "1st-5th level"
				const isWarlockCasting = /warlock/i.exec(spellsFromClass) && Object.values(spells).filter(it => it.slots && it.lower).length === 1;

				// cantrips
				if (spells[0]) {
					const curCantrips = spells[0].spells.length;
					const idealCantripsIn = this._casterLevelAndClassToCantrips(primaryInLevel, spellsFromClass);
					const idealCantripsOut = this._casterLevelAndClassToCantrips(primaryOutLevel, spellsFromClass);
					const targetCantripCount = ScaleCreatureUtils.getScaledToRatio(curCantrips, idealCantripsIn, idealCantripsOut);

					if (curCantrips < targetCantripCount && spellsFromClass) {
						const cantrips = Object.keys((this._spells[Parser.SRC_PHB][spellsFromClass.toLowerCase()] || {})[0]).map(it => it.toLowerCase());
						if (cantrips.length) {
							const extraCantrips = [];
							const numNew = Math.min(targetCantripCount - curCantrips, cantrips.length);
							for (let n = 0; n < numNew; ++n) {
								const ix = RollerUtil.roll(cantrips.length, CrScalerUtils.RNG);
								extraCantrips.push(cantrips[ix]);
								cantrips.splice(ix, 1);
							}
							spells[0].spells = spells[0].spells.concat(extraCantrips.map(it => `{@spell ${it}}`));
						}
					} else {
						const keepThese = this._PROTECTED_CANTRIPS.map(it => `@spell ${it}`);
						while (spells[0].spells.length > targetCantripCount) {
							const ixs = spells[0].spells.filterIndex(it => !~keepThese.findIndex(x => it.includes(x)));
							if (ixs.length) {
								const ix = RollerUtil.roll(ixs.length, CrScalerUtils.RNG);
								spells[0].spells.splice(ix, 1);
							} else spells[0].spells.pop();
						}
					}
				}

				// spells
				if (isWarlockCasting) {
					const curCastingLevel = Object.keys(spells).find(k => spells[k].lower);
					if (maxSpellLevel === Number(curCastingLevel)) return;
					if (maxSpellLevel === 0) {
						Object.keys(spells).filter(lvl => lvl !== "0").forEach(lvl => delete spells[lvl]);
						return;
					}

					const numSpellsKnown = this._adjustSpellcasting_getWarlockNumSpellsKnown(primaryOutLevel);
					const warlockSpells = this._spells[Parser.SRC_PHB].warlock;
					let spellList = [];
					for (let i = 1; i < maxSpellLevel + 1; ++i) {
						spellList = spellList.concat(Object.keys(warlockSpells[i]).map(sp => sp.toSpellCase()));
					}
					const spellsKnown = []; // TODO maintain original spell list if possible -- add them to this list, and remove them from the list being rolled against
					for (let i = 0; i < numSpellsKnown; ++i) {
						const ix = RollerUtil.roll(spellList.length, CrScalerUtils.RNG);
						spellsKnown.push(spellList[ix]);
						spellList.splice(ix, 1);
					}
					Object.keys(spells).filter(lvl => lvl !== "0").forEach(lvl => delete spells[lvl]);
					const slots = this._adjustSpellcasting_getWarlockNumSpellSlots(maxSpellLevel);
					spells[maxSpellLevel] = {
						slots,
						lower: 1,
						spells: [
							`A selection of ${maxSpellLevel === 1 ? `{@filter 1st-level warlock spells|spells|level=${1}|class=warlock}.` : `{@filter 1st- to ${Parser.spLevelToFull(maxSpellLevel)}-level warlock spells|spells|level=${[...new Array(maxSpellLevel)].map((_, i) => i + 1).join(";")}|class=warlock}.`}  Examples include: ${spellsKnown.sort(SortUtil.ascSortLower).map(it => `{@spell ${it}}`).joinConjunct(", ", " and ")}`,
						],
					};
				} else {
					let lastRatio = 1; // adjust for higher/lower than regular spell slot counts
					for (let i = 1; i < 10; ++i) {
						const atLevel = spells[i];
						const idealSlotsIn = getSlotsAtLevel(primaryInLevel, i);
						const idealSlotsOut = getSlotsAtLevel(primaryOutLevel, i);

						if (atLevel) {
							// TODO grow/shrink the spell list at this level as required
							if (atLevel.slots) { // no "slots" signifies at-wills
								const adjustedSlotsOut = ScaleCreatureUtils.getScaledToRatio(atLevel.slots, idealSlotsIn, idealSlotsOut);
								lastRatio = adjustedSlotsOut / idealSlotsOut;

								atLevel.slots = adjustedSlotsOut;
								if (adjustedSlotsOut <= 0) {
									delete spells[i];
								}
							}
						} else if (i <= maxSpellLevel) {
							const slots = Math.max(1, Math.round(idealSlotsOut * lastRatio));
							if (spellsFromClass && (this._spells[Parser.SRC_PHB][spellsFromClass.toLowerCase()] || {})[i]) {
								const examples = [];
								const levelSpells = Object.keys(this._spells[Parser.SRC_PHB][spellsFromClass.toLowerCase()][i]).map(it => it.toSpellCase());
								const numExamples = Math.min(5, levelSpells.length);
								for (let n = 0; n < numExamples; ++n) {
									const ix = RollerUtil.roll(levelSpells.length, CrScalerUtils.RNG);
									examples.push(levelSpells[ix]);
									levelSpells.splice(ix, 1);
								}
								spells[i] = {
									slots,
									spells: [
										`A selection of {@filter ${Parser.spLevelToFull(i)}-level ${spellsFromClass} spells|spells|level=${i}|class=${spellsFromClass}}. Examples include: ${examples.sort(SortUtil.ascSortLower).map(it => `{@spell ${it}}`).joinConjunct(", ", " and ")}`,
									],
								};
							} else {
								spells[i] = {
									slots,
									spells: [
										`A selection of {@filter ${Parser.spLevelToFull(i)}-level spells|spells|level=${i}}`,
									],
								};
							}
						} else {
							delete spells[i];
						}
					}
				}
			}
		});

		mon.spellcasting.forEach(sc => {
			// adjust Mystic Arcanum spells
			if (isWarlock && sc.daily && sc.daily["1e"]) {
				const numArcanum = this._adjustSpellcasting_getWarlockNumArcanum(primaryOutLevel);

				const curNumSpells = sc.daily["1e"].length;

				if (sc.daily["1e"].length === numArcanum) return;
				if (numArcanum === 0) return delete sc.daily["1e"];

				if (curNumSpells > numArcanum) {
					// map each existing spell e.g. `{@spell gate}` to an object of the form `{original: "{@spell gate}", level: 9}`
					const curSpells = sc.daily["1e"].map(it => {
						const m = /{@spell ([^|}]+)(?:\|([^|}]+))?[|}]/.exec(it);
						if (m) {
							const nameTag = m[1].toLowerCase();
							const srcTag = (m[2] || Parser.SRC_PHB).toLowerCase();

							const src = Object.keys(this._spells).find(it => it.toLowerCase() === srcTag);
							if (src) {
								const levelStr = Object.keys(this._spells[src].warlock || {}).find(lvl => Object.keys((this._spells[src].warlock || {})[lvl]).some(nm => nm.toLowerCase() === nameTag));

								if (levelStr) return {original: it, level: Number(levelStr)};
							}
						}
						return {original: it, level: null};
					});

					for (let i = 9; i > 5; --i) {
						const ixToRemove = curSpells.map(it => it.level === i ? curSpells.indexOf(it) : -1).filter(it => ~it);
						while (ixToRemove.length && curSpells.length > numArcanum) {
							curSpells.splice(ixToRemove.pop(), 1);
						}
						if (curSpells.length === numArcanum) break;
					}

					sc.daily["1e"] = curSpells.map(it => it.original);
				} else {
					for (let i = 5 + curNumSpells; i < 5 + numArcanum; ++i) {
						const rollOn = Object.keys(this._spells[Parser.SRC_PHB].warlock[i]);
						const ix = RollerUtil.roll(rollOn.length, CrScalerUtils.RNG);
						sc.daily["1e"].push(`{@spell ${rollOn[ix].toSpellCase()}}`);
					}

					sc.daily["1e"].sort(SortUtil.ascSortLower);
				}
			}
		});
	}

	static _adjustSpellcasting_isWarlock (mon) {
		if (mon.spellcasting) {
			return mon.spellcasting.some(sc => sc.headerEntries && /warlock spells?|warlock('s)? spell list/i.test(JSON.stringify(sc.headerEntries)));
		}
	}

	static _adjustSpellcasting_getWarlockNumSpellsKnown (level) {
		return level <= 9 ? level + 1 : 10 + Math.ceil((level - 10) / 2);
	}

	static _adjustSpellcasting_getWarlockNumSpellSlots (level) {
		return level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
	}

	static _adjustSpellcasting_getWarlockNumArcanum (level) {
		return level < 11 ? 0 : level < 13 ? 1 : level < 15 ? 2 : level < 17 ? 3 : 4;
	}
}

globalThis.ScaleCreature = ScaleCreature;
globalThis.ScaleSpellSummonedCreature = ScaleSpellSummonedCreature;
globalThis.ScaleClassSummonedCreature = ScaleClassSummonedCreature;
