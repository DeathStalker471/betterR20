function d20plus2024SpellImport() {
	const spellCtx = d20plus.import2024;
	const sp = d20plus.spellParsers;

	// Returns sorted character-level thresholds for cantrip scaling, e.g. [5, 11, 17]. Stays local
	// (not shared) - the classic/OGL sheet has no per-level-threshold concept to consume this
	// (see js/5etools-spell-parsers.js's parseCantripScalingFlag, which only tracks the boolean
	// "does this cantrip scale at all" for that sheet's simpler dropdown).
	function parseSpell2024CantripLevels (vc) {
		const sld = Array.isArray(vc.scalingLevelDice) ? vc.scalingLevelDice[0] : vc.scalingLevelDice;
		if (sld && sld.scaling) {
			const levels = Object.keys(sld.scaling)
				.map(Number)
				.filter(l => l > 1)
				.sort((a, b) => a - b);
			if (levels.length) return levels;
		}
		const levels = [];
		for (const entry of (vc.entries || [])) {
			if (typeof entry !== "string") continue;
			const re = /at (\d+)(?:st|nd|rd|th) level/gi;
			let m;
			while ((m = re.exec(entry)) !== null) levels.push(parseInt(m[1], 10));
		}
		const unique = [...new Set(levels)].sort((a, b) => a - b);
		return unique.length ? unique : [5, 11, 17];
	}

	// Returns {value, startingLevel, stepLevels, targetBonus} for damage upcasting, or null. Tries
	// dice-based scaling first, then flat per-level bonus (Armor of Agathys-style: "the damage
	// increases by 5 for each slot level above 1st", no {@scaledamage}/{@scaledice} tag at all).
	// targetBonus:true -> "$._bonus" (flat amount per slot); false -> "$.diceCount" (dice per slot).
	// Confirmed against Roll20's own compendium output for Armor of Agathys via the browser console
	// (dumped the character's "store" attribute): its damage Upcasting integrant has
	// `target: "$._bonus", value: 5, startingLevel: 2` - the +1 below (2014 text says "above 1st",
	// the bonus first actually applies at 2nd level) matches that exactly.
	function getDamageUpcastData (entriesHigherLevel) {
		const scaled = sp.parseUpcastDice(entriesHigherLevel);
		if (scaled) return {value: scaled.diceCount, startingLevel: scaled.startingLevel, stepLevels: scaled.stepLevels, targetBonus: false};
		const flatTag = sp.parseFlatUpcastTag(entriesHigherLevel);
		if (flatTag) return {value: flatTag.value, startingLevel: flatTag.startingLevel, stepLevels: flatTag.stepLevels, targetBonus: true};
		const flat = sp.parseFlatUpcastBonus(entriesHigherLevel);
		if (flat) return {value: parseInt(flat.value, 10), startingLevel: parseInt(flat.startingLevel, 10) + 1, stepLevels: 1, targetBonus: true};
		return null;
	}

	// Same idea as getDamageUpcastData, for the Healing/Temporary-HP chain. The middle tier
	// (parseFlatUpcastTag) is needed for Heal's 2024/XPHB rewrite: "{@scaledice 70|6-9|10}" is a
	// tagged scaling expression, but its value ("10") is a flat number, not "NdM" dice notation, so
	// parseUpcastDice correctly doesn't match it and parseFlatUpcastBonus (plain untagged prose)
	// doesn't either since the amount sits inside a tag rather than bare text - confirmed against
	// two independent Roll20 compendium dumps for Heal (2014 PHB and 2024 Basic Rules) that both
	// show `target: "$._bonus", value: 10, startingLevel: 7`.
	function getHealUpcastData (entriesHigherLevel) {
		const scaled = sp.parseUpcastDice(entriesHigherLevel);
		if (scaled) return {value: scaled.diceCount, startingLevel: scaled.startingLevel, stepLevels: scaled.stepLevels, targetBonus: false};
		const flatTag = sp.parseFlatUpcastTag(entriesHigherLevel);
		if (flatTag) return {value: flatTag.value, startingLevel: flatTag.startingLevel, stepLevels: flatTag.stepLevels, targetBonus: true};
		const flat = sp.parseFlatUpcastBonus(entriesHigherLevel);
		if (flat) return {value: parseInt(flat.value, 10), startingLevel: parseInt(flat.startingLevel, 10) + 1, stepLevels: 1, targetBonus: true};
		return null;
	}

	// Returns {diceCount, diceSize, flatBonus} for spell damage, or null. Tries the tagged
	// {@damage} dice parser first, then falls back to a flat untagged number in prose (Armor of
	// Agathys: "takes 5 cold damage", no {@damage} tag at all). In the flat case diceCount/diceSize
	// are omitted (not set to null/"") - confirmed against Roll20's own compendium output for Armor
	// of Agathys (browser console dump of the character's "store" attribute) that a no-dice Damage
	// integrant entirely omits the diceCount key rather than nulling it.
	function getDamageDiceOrFlat (entries) {
		const diced = sp.parseFirstDamage(entries);
		if (diced) return diced;
		const flat = sp.parseFlatDamageFallback(entries);
		if (flat) return {flatBonus: parseInt(flat.amount, 10)};
		return null;
	}

	// Same idea as getDamageDiceOrFlat, for the Healing/Temporary-HP chain. Applies to both "HL"
	// and "THP" spells - an earlier version of this restricted the flat-prose fallback to THP-only
	// after a ground-truth dump for Heal showed zero mechanical automation, but that dump turned
	// out to be a false negative (no compendiumPageID field - it wasn't actually sourced from
	// Roll20's compendium). A second, genuine compendium dump for Heal confirmed Roll20 *does*
	// mechanize plain "regains N hit points" prose into a real Healing integrant, matching what
	// this fallback already produced field-for-field (_bonus: 70, isTemp: false, upcast
	// startingLevel: 7 from "above 6th" + 1).
	function getHealDiceOrFlat (entries) {
		const diced = sp.parseHealDice(entries);
		if (diced) return diced;
		const flat = sp.parseFlatHealFallback(entries);
		if (flat) return {bonus: parseInt(flat, 10)};
		return null;
	}

	// _batchStore: if provided, mutate it in place and skip the read/save (batch mode for monster import).
	d20plus.importer.import2024Spell = function (charModel, spellData, _batchStore) {
		const d = spellData.data;
		const vc = spellData.Vetoolscontent || null;

		let storeAttr, store;
		if (_batchStore) {
			storeAttr = null;
			store = _batchStore;
		} else {
			const s = spellCtx.getStore(charModel);
			storeAttr = s.attr;
			store = s.store ? JSON.parse(JSON.stringify(s.store)) : {
				integrants: {integrants: {}},
				spells: {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]},
			};
		}
		if (!store.integrants) store.integrants = {integrants: {}};
		if (!store.integrants.integrants) store.integrants.integrants = {};
		if (!store.spells) store.spells = {displayOrder: ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"]};
		if (!store.spells.displayOrder) store.spells.displayOrder = ["[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]", "[]"];

		const levelStr = d["Level"] || "0";
		let levelIdx = levelStr === "cantrip" ? 0 : (parseInt(levelStr, 10) || 0);
		if (levelIdx > 9) levelIdx = 9;

		const cap = str => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

		// Components
		const compStr = (d["Components"] || "").toUpperCase();
		const components = {};
		if (compStr.includes("V")) components.verbal = true;
		if (compStr.includes("S")) components.somatic = true;
		if (compStr.includes("M")) {
			components.material = true;
			if (vc && vc.components && vc.components.m) {
				components.materialDescription = typeof vc.components.m === "string"
					? vc.components.m : (vc.components.m.text || "");
			}
		}

		// Range and duration as full strings
		const range = vc ? Parser.spRangeToFull(vc.range) : (d["Range"] || "");

		function parseDuration2024 (durArr) {
			if (!durArr || !durArr.length) return "Instantaneous";
			const du = durArr[0];
			if (du.type === "instantaneous") return "Instantaneous";
			if (du.type === "permanent") return "Until Dispelled";
			if (du.type === "special") return "Special";
			if (du.type === "timed" && du.duration) {
				const amt = du.duration.amount;
				const unit = du.duration.type;
				const plural = amt !== 1 ? "s" : "";
				if (du.concentration) return `Concentration, up to ${amt} ${unit}${plural}`;
				return `${amt} ${unit}${plural}`;
			}
			return "Instantaneous";
		}
		const duration = vc ? parseDuration2024(vc.duration) : (d["Duration"] || "");

		function parseCastingTime2024 (timeArr) {
			if (!timeArr || !timeArr.length) return "Action";
			const t = timeArr[0];
			if (t.unit === "action") return "Action";
			if (t.unit === "bonus") return "Bonus Action";
			if (t.unit === "reaction") return "Reaction";
			if (t.unit === "minute") return t.number === 1 ? "1 Minute" : `${t.number} Minutes`;
			if (t.unit === "hour") return t.number === 1 ? "1 Hour" : `${t.number} Hours`;
			if (t.unit === "day") return t.number === 1 ? "1 Day" : `${t.number} Days`;
			return "Action";
		}
		const castingTimeBase = vc ? parseCastingTime2024(vc.time) : (d["Casting Time"] || "Action");
		const isRitual = vc ? !!(vc.meta && vc.meta.ritual) : (d["Ritual"] || "") === "Yes";
		const castingTime = isRitual ? `${castingTimeBase} or Ritual` : castingTimeBase;

		// AoE
		const aoeShape = vc && vc.areaTags && vc.areaTags.length ? sp.areaTagToShape(vc.areaTags[0]) : "";
		const aoeSize = vc ? sp.parseAoeSize(vc.entries) : "";
		const aoe = {shape: aoeShape, size: aoeSize};

		// Determine whether to build the Attack/Damage chain
		const hasSave = vc && vc.savingThrow && vc.savingThrow.length;
		const hasSpellAtk = vc && vc.spellAttack && vc.spellAttack.length;
		const hasDamage = vc && vc.damageInflict && vc.damageInflict.length;
		const isCantripScaling = vc && vc.level === 0 && (vc.miscTags || []).includes("SCL");

		// autoHit means "no save/attack roll" - true for both projectile spells (Magic Missile) and
		// reactive/automatic damage spells (Armor of Agathys), not just ones with a projectile word
		// in their text. Confirmed against Roll20's own compendium output: Armor of Agathys' Attack
		// integrant has autoHit:true despite never mentioning darts/rays/beams.
		const isAutoHit = !!(hasDamage && !hasSave && !hasSpellAtk);
		const rawRepeat = isAutoHit ? sp.parseRepeatCount(vc.entries) : null;
		const repeatCount = rawRepeat || 1;

		const rayRepeat = (!isCantripScaling && hasSpellAtk) ? sp.parseRepeatCount(vc.entries) : null;
		const isMultiRay = rayRepeat !== null;

		const buildChain = hasSave || hasSpellAtk || isAutoHit;

		const parsed = (buildChain && hasDamage) ? getDamageDiceOrFlat(vc.entries) : null;
		const isRepeatUpcast = !isCantripScaling && (isAutoHit || isMultiRay) && sp.parseRepeatUpcast(vc.entriesHigherLevel);
		const upcast = (!isCantripScaling && buildChain && !isRepeatUpcast) ? getDamageUpcastData(vc.entriesHigherLevel) : null;
		const scalingLevelDice = vc ? vc.scalingLevelDice : undefined;
		const isDiceScaling = isCantripScaling && !!scalingLevelDice;
		const isMultiDamage = isDiceScaling && Array.isArray(scalingLevelDice) && scalingLevelDice.length > 1;
		const cantripLevels = (isCantripScaling && buildChain) ? parseSpell2024CantripLevels(vc) : [];
		const onSucceedHalf = hasSave && vc && vc.entries && vc.entries.some(e => typeof e === "string" && /\bhalf\b/i.test(e));

		const hasTHP = vc && (vc.miscTags || []).includes("THP");
		const hasHeal = vc && (vc.miscTags || []).includes("HL");
		const healParsed = (hasTHP || hasHeal) ? getHealDiceOrFlat(vc.entries) : null;
		const healUpcastData = healParsed ? getHealUpcastData(vc.entriesHigherLevel) : null;

		// Generate all IDs + arrayPositions upfront so parents can reference children
		let pos = spellCtx.getNextArrayPos(store);
		const {id: spellId, base: spellBase} = spellCtx.makeIntegrantBase("Spell", pos++);
		let attackId, attackBase, dmgId, dmgBase, upcastId, upcastBase;
		let cantripUpcastEntries = [];
		const multiDmgTypes = (!isCantripScaling && !isMultiDamage && hasDamage && vc.damageInflict && vc.damageInflict.length > 1)
			? sp.parseAllTypedDamages(vc.entries, vc.damageInflict)
			: [];
		const isMultiDmgType = multiDmgTypes.length > 1;
		let extraDmgEntries = [];
		if (buildChain && !isMultiDamage) {
			({id: attackId, base: attackBase} = spellCtx.makeIntegrantBase("Attack", pos++));
			if (hasDamage) {
				({id: dmgId, base: dmgBase} = spellCtx.makeIntegrantBase("Damage", pos++));
				if (isMultiDmgType) {
					extraDmgEntries = multiDmgTypes.slice(1).map(p => {
						const {id, base} = spellCtx.makeIntegrantBase("Damage", pos++);
						return {id, base, parsed: p};
					});
				}
				if (isCantripScaling) {
					cantripUpcastEntries = cantripLevels.map(lvl => {
						const {id, base} = spellCtx.makeIntegrantBase("Upcasting", pos++);
						return {id, base, level: lvl};
					});
				} else if (upcast || isRepeatUpcast) {
					({id: upcastId, base: upcastBase} = spellCtx.makeIntegrantBase("Upcasting", pos++));
				}
			}
		}
		let healId, healBase, healUpcastId, healUpcastBase;
		if (healParsed) {
			({id: healId, base: healBase} = spellCtx.makeIntegrantBase("Healing", pos++));
			if (healUpcastData) ({id: healUpcastId, base: healUpcastBase} = spellCtx.makeIntegrantBase("Upcasting", pos++));
		}

		// Write integrants bottom-up so childIDs can reference already-known IDs
		if (upcastId) {
			const isRepeat = isRepeatUpcast;
			store.integrants.integrants[upcastId] = {
				...upcastBase,
				name: `${spellData.name} Upcast`,
				recordName: `${spellData.name} Upcast`,
				startingLevel: isRepeat ? levelIdx + 1 : upcast.startingLevel,
				level: isRepeat ? 1 : (upcast.stepLevels || 1),
				mode: "Per X Spell Level",
				target: isRepeat ? "$.repeat" : (upcast.targetBonus ? "$._bonus" : "$._diceCount"),
				value: isRepeat ? 1 : upcast.value,
				changeMode: "Add",
				parentID: isRepeat ? attackId : dmgId,
				childIDs: "[]",
				cascades: {},
				relations: {},
			};
		}

		if (dmgId) {
			const firstParsed = isMultiDmgType ? multiDmgTypes[0] : parsed;
			const isFlatOnly = !!firstParsed && firstParsed.diceCount === undefined;
			const diceSize  = isFlatOnly ? "" : (firstParsed ? firstParsed.diceSize : "d6");
			const dmgType   = isMultiDmgType ? multiDmgTypes[0].damageType : cap(vc.damageInflict[0]);
			const dmgName   = isMultiDmgType ? `${spellData.name} ${dmgType} Damage` : `${spellData.name} Damage`;
			const dmgUpcastChildIds = isDiceScaling ? cantripUpcastEntries.map(e => e.id) : [];
			const dmgChildIds = upcastId && !isRepeatUpcast
				? JSON.stringify([upcastId])
				: dmgUpcastChildIds.length ? JSON.stringify(dmgUpcastChildIds) : "[]";

			const dmgIntegrant = {
				...dmgBase,
				name: dmgName,
				recordName: dmgName,
				ability: "none",
				diceSize,
				damageType: dmgType,
				overrideCrit: false,
				critDiceSize: "",
				parentID: attackId,
				childIDs: dmgChildIds,
				cascades: {},
				relations: {},
			};
			// "_diceCount" (underscore-prefixed), not "diceCount" - confirmed against Roll20's own
			// Magic Missile compendium output, the first ground-truth dump this session with a real
			// (non-flat) dice-based Damage integrant to check the field name against.
			if (!isFlatOnly) dmgIntegrant._diceCount = firstParsed ? firstParsed.diceCount : 1;
			if (firstParsed && firstParsed.flatBonus) dmgIntegrant._bonus = firstParsed.flatBonus;
			store.integrants.integrants[dmgId] = dmgIntegrant;

			for (const {id, base, parsed: ep} of extraDmgEntries) {
				const eName = `${spellData.name} ${ep.damageType} Damage`;
				store.integrants.integrants[id] = {
					...base,
					name: eName,
					recordName: eName,
					ability: "none",
					_diceCount: ep.diceCount,
					diceSize: ep.diceSize,
					damageType: ep.damageType,
					overrideCrit: false,
					critDiceSize: "",
					parentID: attackId,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
				if (ep.flatBonus) store.integrants.integrants[id]._bonus = ep.flatBonus;
			}
		}

		// Write cantrip scaling Upcasting integrants
		for (const {id, base, level} of cantripUpcastEntries) {
			const isDice = isDiceScaling;
			store.integrants.integrants[id] = {
				...base,
				name: isDice ? `${spellData.name} Damage Upcast ${level}` : `${spellData.name} Upcast ${level}`,
				recordName: isDice ? `${spellData.name} Damage Upcast ${level}` : `${spellData.name} Upcast ${level}`,
				mode: "Specific Character Level",
				level,
				startingLevel: 0,
				target: isDice ? "$._diceCount" : "$.repeat",
				value: 1,
				changeMode: "Add",
				parentID: isDice ? dmgId : attackId,
				childIDs: "[]",
				cascades: {},
				relations: {},
			};
		}

		if (attackId) {
			const diceCount = parsed ? parsed.diceCount : 1;
			const diceSize = parsed ? parsed.diceSize : "d6";
			const diceLabel = (parsed && parsed.diceCount === undefined) ? `${parsed.flatBonus}` : `${diceCount}${diceSize}`;
			const damageType = hasDamage ? cap(vc.damageInflict[0]) : "";

			let atkIntegrant;
			if (isAutoHit) {
				// upcastId is only a direct child of Attack when it's parented there (the repeat-count
				// upcast case, e.g. Magic Missile gaining darts) - a dice/bonus upcast on the Damage
				// value itself is parented to Damage instead (see the upcastId integrant above), so it
				// must not also be listed here or it'd appear as a child of both. Confirmed via Roll20's
				// own compendium output for both Armor of Agathys and Magic Missile: Attack's childIDs
				// only ever includes 2 entries when isRepeatUpcast is the active upcast mode.
				const childIds = (upcastId && isRepeatUpcast) ? [dmgId, upcastId] : [dmgId];
				// Two ground-truth compendium dumps disagree on name/recordName/range, and the
				// distinguishing factor is whether this is a real projectile attack (a repeat count
				// word was found in the text, e.g. Magic Missile's "three darts") vs a reactive/
				// passive proc with no such word (Armor of Agathys). Projectile case: name is just the
				// plain spell name, recordName is "... Free Attack", range is included (e.g. "120
				// feet" - it's meaningfully attacking at range). Reactive case: name includes the
				// damage type ("Armor of Agathys Cold Damage"), recordName is "... Attack" (no
				// "Free"), and range is omitted entirely (the spell's own range is "Self" - "attacking
				// yourself at range Self" isn't meaningful attack-range info).
				const isProjectile = rawRepeat !== null;
				atkIntegrant = {
					...attackBase,
					name: isProjectile ? spellData.name : (damageType ? `${spellData.name} ${damageType} Damage` : spellData.name),
					recordName: isProjectile ? `${spellData.name} Free Attack` : `${spellData.name} Attack`,
					actionType: castingTime,
					...(isProjectile ? {range} : {}),
					autoHit: true,
					parentID: spellId,
					childIDs: JSON.stringify(childIds),
					cascades: {},
					relations: {},
				};
				if (repeatCount > 1) atkIntegrant.repeat = repeatCount;
			} else {
				let atkType;
				if (hasSave) atkType = "Spell Save";
				else if (hasSpellAtk) atkType = "Spell Attack";
				else atkType = "Spell Attack";

				const repeatChildIds = (!isDiceScaling && isCantripScaling) ? cantripUpcastEntries.map(e => e.id) : [];
				const allDmgIds = dmgId ? [dmgId, ...extraDmgEntries.map(e => e.id)] : [];
				const childIDs = allDmgIds.length ? JSON.stringify([...allDmgIds, ...repeatChildIds]) : "[]";

				atkIntegrant = {
					...attackBase,
					name: spellData.name,
					recordName: `${spellData.name} Attack`,
					actionType: castingTime,
					...(aoe.shape ? {aoe} : {}),
					attack: {type: atkType},
					parentID: spellId,
					childIDs,
					cascades: {},
					relations: {},
				};
				if (isCantripScaling && !isDiceScaling) atkIntegrant.repeat = 1;
				if (isMultiRay) atkIntegrant.repeat = rayRepeat;
				if (isRepeatUpcast && upcastId) atkIntegrant.childIDs = JSON.stringify([dmgId, upcastId]);
				if (hasSave) {
					let onFailText = "";
					if (hasDamage) {
						if (isMultiDmgType) {
							const allDmgParts = multiDmgTypes.map(p => `${p.diceCount}${p.diceSize} ${p.damageType}`);
							onFailText = `Takes ${allDmgParts.join(" damage and ")} damage.`;
						} else {
							onFailText = `Takes ${diceLabel} ${damageType} damage.`;
						}
					}
					atkIntegrant.save = {
						saveAbility: cap(vc.savingThrow[0]),
						onFail: onFailText,
					};
					if (hasDamage && onSucceedHalf) atkIntegrant.save.onSucceed = "Half as much damage.";
				}
			}
			store.integrants.integrants[attackId] = atkIntegrant;
		}

		// Multi-damage cantrip chains (e.g. Toll the Dead)
		const multiDamageAtkIds = [];
		if (isMultiDamage) {
			const damageType = cap(vc.damageInflict[0]);

			for (const sldEntry of scalingLevelDice) {
				const baseDiceStr = sldEntry.scaling["1"] || "1d8";
				const baseDiceM = baseDiceStr.match(/(\d+)d(\d+)/i);
				const baseDiceCount = baseDiceM ? parseInt(baseDiceM[1], 10) : 1;
				const baseDiceSize = baseDiceM ? "d" + baseDiceM[2] : "d8";

				const suffix = `(${baseDiceStr})`;
				const dmgName = `${spellData.name} ${suffix} Damage`;
				const atkName = `${spellData.name} ${suffix}`;
				const atkRecordName = `${spellData.name} ${suffix} Attack`;

				const {id: mAtkId, base: mAtkBase} = spellCtx.makeIntegrantBase("Attack", pos++);
				const {id: mDmgId, base: mDmgBase} = spellCtx.makeIntegrantBase("Damage", pos++);
				const mUpcastEntries = cantripLevels.map(lvl => {
					const {id, base} = spellCtx.makeIntegrantBase("Upcasting", pos++);
					return {id, base, level: lvl};
				});

				for (const {id, base, level} of mUpcastEntries) {
					store.integrants.integrants[id] = {
						...base,
						name: `${dmgName} Upcast ${level}`,
						recordName: `${dmgName} Upcast ${level}`,
						mode: "Specific Character Level",
						level,
						startingLevel: 0,
						target: "$._diceCount",
						value: 1,
						changeMode: "Add",
						parentID: mDmgId,
						childIDs: "[]",
						relations: {},
					};
				}

				store.integrants.integrants[mDmgId] = {
					...mDmgBase,
					name: dmgName,
					recordName: dmgName,
					ability: "none",
					_diceCount: baseDiceCount,
					diceSize: baseDiceSize,
					damageType,
					overrideCrit: false,
					critDiceSize: "",
					parentID: mAtkId,
					childIDs: JSON.stringify(mUpcastEntries.map(e => e.id)),
					relations: {},
				};

				const mAtkIntegrant = {
					...mAtkBase,
					name: atkName,
					recordName: atkRecordName,
					actionType: castingTime,
					...(aoe.shape ? {aoe} : {}),
					attack: {type: hasSave ? "Spell Save" : "Spell Attack"},
					parentID: spellId,
					childIDs: JSON.stringify([mDmgId]),
					cascades: {},
					relations: {},
				};
				if (hasSave) {
					mAtkIntegrant.save = {
						saveAbility: cap(vc.savingThrow[0]),
						onFail: `Takes ${baseDiceStr} ${damageType} damage.`,
					};
					if (onSucceedHalf) mAtkIntegrant.save.onSucceed = "Half as much damage.";
				}
				store.integrants.integrants[mAtkId] = mAtkIntegrant;
				multiDamageAtkIds.push(mAtkId);
			}
		}

		// Healing chain (False Life, Cure Wounds, etc.). Labels/suffixes below match Roll20's own
		// compendium naming exactly, confirmed against two separate ground-truth dumps: Armor of
		// Agathys ("Armor of Agathys Temporary HP" / "... Temporary HP Upcasting" - THP, "Upcasting"
		// suffix) and Heal ("Heal Healing" / "Heal Healing Upcast" - non-THP, "Upcast" suffix, no
		// "Hit Points" anywhere in the name despite the field itself being about hit points).
		if (healParsed) {
			const healLabel = hasTHP ? "Temporary HP" : "Healing";
			const healUpcastSuffix = hasTHP ? "Upcasting" : "Upcast";
			if (healUpcastId) {
				store.integrants.integrants[healUpcastId] = {
					...healUpcastBase,
					name: `${spellData.name} ${healLabel} ${healUpcastSuffix}`,
					recordName: `${spellData.name} ${healLabel} ${healUpcastSuffix}`,
					startingLevel: healUpcastData.startingLevel,
					level: healUpcastData.stepLevels || 1,
					mode: "Per X Spell Level",
					target: healUpcastData.targetBonus ? "$._bonus" : "$._diceCount",
					value: healUpcastData.value,
					changeMode: "Add",
					parentID: healId,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
			}
			const healIsFlatOnly = healParsed.diceCount === undefined;
			const healIntegrant = {
				...healBase,
				name: `${spellData.name} ${healLabel}`,
				recordName: `${spellData.name} ${healLabel}`,
				_bonus: healParsed.bonus || 0,
				ability: "none",
				diceSize: healIsFlatOnly ? "" : healParsed.diceSize,
				overrideCrit: false,
				critDiceSize: "",
				isTemp: !!hasTHP,
				parentID: spellId,
				childIDs: healUpcastId ? JSON.stringify([healUpcastId]) : "[]",
				cascades: {},
				relations: {},
			};
			if (!healIsFlatOnly) healIntegrant._diceCount = healParsed.diceCount;
			store.integrants.integrants[healId] = healIntegrant;
		}

		// Spell integrant (always created)
		const spellChildIDs = isMultiDamage
			? JSON.stringify(multiDamageAtkIds)
			: attackId ? JSON.stringify([attackId])
			: healId ? JSON.stringify([healId])
			: "[]";

		const schoolMap = {A:"Abjuration",C:"Conjuration",D:"Divination",E:"Enchantment",I:"Illusion",N:"Necromancy",T:"Transmutation",V:"Evocation"};
		const spellIntegrant = {
			...spellBase,
			_prepared: !_batchStore,
			alwaysPrepared: false,
			...(aoe.shape ? {aoe} : {}),
			concentration: vc ? !!(vc.duration && vc.duration[0] && vc.duration[0].concentration) : (d["Concentration"] || "") === "Yes",
			name: spellData.name,
			recordName: spellData.name,
			level: levelIdx,
			school: (vc && schoolMap[vc.school]) || d["School"] || "Evocation",
			castingTime,
			range,
			components,
			duration,
			description: d["data-description"] || "",
			relations: {},
			ritual: isRitual,
			childIDs: spellChildIDs,
		};
		if (isDiceScaling) spellIntegrant.cantripScale = "Dice";
		store.integrants.integrants[spellId] = spellIntegrant;

		const order = JSON.parse(store.spells.displayOrder[levelIdx] || "[]");
		order.push(spellId);
		store.spells.displayOrder[levelIdx] = JSON.stringify(order);

		if (!_batchStore) spellCtx.saveStore(charModel, storeAttr, store);
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024SpellImport);
