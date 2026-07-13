function d20plus2024SpellImport() {
	const spellCtx = d20plus.import2024;

	// Returns the first {@damage XdY} (with optional flat bonus) found in a 5etools entries array, or null.
	function parseSpell2024Damage (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\{@damage (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?}/i);
			if (m) return {
				diceCount: parseInt(m[1], 10),
				diceSize: "d" + m[2],
				flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
			};
		}
		return null;
	}

	// For spells with multiple damage types, parse each {@damage XdY} tag alongside the
	// damage type keyword(s) that follow it in the text.
	function parseAllSpell2024DamagesTyped (entries, damageInflict) {
		const capWord = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
		const knownTypes = (damageInflict || []).map(t => t.toLowerCase());
		const tagRe = /\{@damage (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?}/gi;

		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;

			const tags = [];
			let m;
			while ((m = tagRe.exec(entry)) !== null) {
				tags.push({
					diceCount: parseInt(m[1], 10),
					diceSize: "d" + m[2],
					flatBonus: m[3] && m[4] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0,
					tagStart: m.index,
					tagEnd: m.index + m[0].length,
				});
			}
			if (!tags.length) continue;

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
                    damageType = capWord(single || knownTypes[i] || "");
                }
                return {diceCount: tag.diceCount, diceSize: tag.diceSize, flatBonus: tag.flatBonus, damageType};
            });
		}
		return [];
	}

	// Returns {startingLevel, value, stepLevels} from {@scaledamage} tag, or null.
	function parseSpell2024Upcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				const mc = entry.match(/\{@scaledamage [^|]+\|(\d+(?:,\d+)+)\|(\d+)d\d+}/i);
				if (mc) {
					const levels = mc[1].split(",").map(Number);
					const startingLevel = levels[1];
					const stepLevels = levels.length > 1 ? levels[1] - levels[0] : 2;
					return {startingLevel, value: parseInt(mc[2], 10), stepLevels};
				}
				const mr = entry.match(/\{@scaledamage [^|]+\|(\d+)-\d+\|(\d+)d\d+}/i);
				if (mr) {
					const startingLevel = parseInt(mr[1], 10) + 1;
					const wordNums = {one:1, two:2, three:3, four:4, five:5, six:6};
					const sm = entry.match(/every\s+(one|two|three|four|five|six|\d+)\s+(?:spell\s+)?slot\s+levels?/i);
					const stepLevels = sm ? (wordNums[sm[1].toLowerCase()] || parseInt(sm[1], 10) || 1) : 1;
					return {startingLevel, value: parseInt(mr[2], 10), stepLevels};
				}
			}
		}
		return null;
	}

	// Returns {diceCount, diceSize, bonus} from {@heal XdY} or {@dice XdY + N} in spell entries, or null.
	function parseSpell2024HealDice (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const mh = entry.match(/\{@heal (\d+)d(\d+)}/i);
			if (mh) return {diceCount: parseInt(mh[1], 10), diceSize: "d" + mh[2], bonus: 0};
			const md = entry.match(/\{@dice (\d+)d(\d+)(?:\s*([+-])\s*(\d+))?}/i);
			if (md) return {
				diceCount: parseInt(md[1], 10),
				diceSize: "d" + md[2],
				bonus: md[3] && md[4] ? (md[3] === "+" ? 1 : -1) * parseInt(md[4], 10) : 0,
			};
		}
		return null;
	}

	// Returns {value, startingLevel, stepLevels, targetBonus} for heal upcasting, or null.
	function parseSpell2024HealUpcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				const mf = entry.match(/(\d+) additional (?:temporary )?hit points? for each (?:spell )?slot level above (\d+)/i);
				if (mf) return {value: parseInt(mf[1], 10), startingLevel: parseInt(mf[2], 10) + 1, stepLevels: 1, targetBonus: true};
			}
		}
		const scaled = parseSpell2024Upcast(entriesHigherLevel);
		if (scaled) return {...scaled, targetBonus: false};
		return null;
	}

	// Returns number of projectiles for auto-hit spells (e.g. 3 for Magic Missile), or null.
	function parseSpell2024Repeat (entries) {
		const wordNums = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]*\b(?:dart|missile|bolt|beam|ray|orb|needle|lance|streak)s?\b/i);
			if (m) return wordNums[m[1].toLowerCase()] || parseInt(m[1], 10) || 1;
		}
		return null;
	}

	// Returns true if the higher-level text describes adding more projectiles per slot.
	function parseSpell2024RepeatUpcast (entriesHigherLevel) {
		for (const block of (entriesHigherLevel || [])) {
			for (const entry of (block.entries || [])) {
				if (typeof entry !== "string") continue;
				if (/one more|additional|extra/i.test(entry) && /dart|missile|bolt|beam|ray/i.test(entry)) return true;
			}
		}
		return false;
	}

	// Returns sorted character-level thresholds for cantrip scaling, e.g. [5, 11, 17].
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

	// Maps a 5etools areaTags entry to the 2024 sheet shape name.
	function areaTagTo2024Shape (tag) {
		const map = {S: "Sphere", C: "Cone", L: "Line", Q: "Square", Y: "Cylinder", H: "Hemisphere", W: "Wall", R: "Rectangle"};
		return map[tag] || "";
	}

	// Extracts AoE size text from entry strings.
	function parseSpell2024AoeSize (entries) {
		for (const entry of (entries || [])) {
			if (typeof entry !== "string") continue;
			const m = entry.match(/(\d+)[- ]foot[- ](?:radius|wide|long|tall|cone|line|cube)/i);
			if (m) return m[0].replace(/-/g, " ").toLowerCase();
		}
		return "";
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
		const aoeShape = vc && vc.areaTags && vc.areaTags.length ? areaTagTo2024Shape(vc.areaTags[0]) : "";
		const aoeSize = vc ? parseSpell2024AoeSize(vc.entries) : "";
		const aoe = {shape: aoeShape, size: aoeSize};

		// Determine whether to build the Attack/Damage chain
		const hasSave = vc && vc.savingThrow && vc.savingThrow.length;
		const hasSpellAtk = vc && vc.spellAttack && vc.spellAttack.length;
		const hasDamage = vc && vc.damageInflict && vc.damageInflict.length;
		const isCantripScaling = vc && vc.level === 0 && (vc.miscTags || []).includes("SCL");

		const rawRepeat = (hasDamage && !hasSave && !hasSpellAtk) ? parseSpell2024Repeat(vc.entries) : null;
		const isAutoHit = rawRepeat !== null;
		const repeatCount = rawRepeat || 1;

		const rayRepeat = (!isCantripScaling && hasSpellAtk) ? parseSpell2024Repeat(vc.entries) : null;
		const isMultiRay = rayRepeat !== null;

		const buildChain = hasSave || hasSpellAtk || isAutoHit;

		const parsed = buildChain ? parseSpell2024Damage(vc.entries) : null;
		const isRepeatUpcast = !isCantripScaling && (isAutoHit || isMultiRay) && parseSpell2024RepeatUpcast(vc.entriesHigherLevel);
		const upcast = (!isCantripScaling && buildChain && !isRepeatUpcast) ? parseSpell2024Upcast(vc.entriesHigherLevel) : null;
		const scalingLevelDice = vc ? vc.scalingLevelDice : undefined;
		const isDiceScaling = isCantripScaling && !!scalingLevelDice;
		const isMultiDamage = isDiceScaling && Array.isArray(scalingLevelDice) && scalingLevelDice.length > 1;
		const cantripLevels = (isCantripScaling && buildChain) ? parseSpell2024CantripLevels(vc) : [];
		const onSucceedHalf = hasSave && vc && vc.entries && vc.entries.some(e => typeof e === "string" && /\bhalf\b/i.test(e));

		const hasTHP = vc && (vc.miscTags || []).includes("THP");
		const hasHeal = vc && (vc.miscTags || []).includes("HL");
		const healParsed = (hasTHP || hasHeal) ? parseSpell2024HealDice(vc.entries) : null;
		const healUpcastData = healParsed ? parseSpell2024HealUpcast(vc.entriesHigherLevel) : null;

		// Generate all IDs + arrayPositions upfront so parents can reference children
		let pos = spellCtx.getNextArrayPos(store);
		const {id: spellId, base: spellBase} = spellCtx.makeIntegrantBase("Spell", pos++);
		let attackId, attackBase, dmgId, dmgBase, upcastId, upcastBase;
		let cantripUpcastEntries = [];
		const multiDmgTypes = (!isCantripScaling && !isMultiDamage && hasDamage && vc.damageInflict && vc.damageInflict.length > 1)
			? parseAllSpell2024DamagesTyped(vc.entries, vc.damageInflict)
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
				target: isRepeat ? "$.repeat" : "$.diceCount",
				value: isRepeat ? 1 : upcast.value,
				changeMode: "Add",
				parentID: isRepeat ? attackId : dmgId,
				childIDs: "[]",
				relations: {},
			};
		}

		if (dmgId) {
			const firstParsed = isMultiDmgType ? multiDmgTypes[0] : parsed;
			const diceCount = firstParsed ? firstParsed.diceCount : (parsed ? parsed.diceCount : 1);
			const diceSize  = firstParsed ? firstParsed.diceSize  : (parsed ? parsed.diceSize  : "d6");
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
				diceCount,
				diceSize,
				damageType: dmgType,
				overrideCrit: false,
				critDiceSize: "",
				parentID: attackId,
				childIDs: dmgChildIds,
				relations: {},
			};
			if (firstParsed && firstParsed.flatBonus) dmgIntegrant._bonus = firstParsed.flatBonus;
			store.integrants.integrants[dmgId] = dmgIntegrant;

			for (const {id, base, parsed: ep} of extraDmgEntries) {
				const eName = `${spellData.name} ${ep.damageType} Damage`;
				store.integrants.integrants[id] = {
					...base,
					name: eName,
					recordName: eName,
					ability: "none",
					diceCount: ep.diceCount,
					diceSize: ep.diceSize,
					damageType: ep.damageType,
					overrideCrit: false,
					critDiceSize: "",
					parentID: attackId,
					childIDs: "[]",
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
				target: isDice ? "$.diceCount" : "$.repeat",
				value: 1,
				changeMode: "Add",
				parentID: isDice ? dmgId : attackId,
				childIDs: "[]",
				relations: {},
			};
		}

		if (attackId) {
			const diceCount = parsed ? parsed.diceCount : 1;
			const diceSize = parsed ? parsed.diceSize : "d6";
			const damageType = hasDamage ? cap(vc.damageInflict[0]) : "";

			let atkIntegrant;
			if (isAutoHit) {
				const childIds = upcastId ? [dmgId, upcastId] : [dmgId];
				atkIntegrant = {
					...attackBase,
					name: spellData.name,
					recordName: `${spellData.name} Free Attack`,
					actionType: castingTime,
					range,
					autoHit: true,
					repeat: repeatCount,
					parentID: spellId,
					childIDs: JSON.stringify(childIds),
					cascades: {},
					relations: {},
				};
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
							onFailText = `Takes ${diceCount}${diceSize} ${damageType} damage.`;
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
						target: "$.diceCount",
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
					diceCount: baseDiceCount,
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

		// Healing chain (False Life, Cure Wounds, etc.)
		if (healParsed) {
			const healLabel = hasTHP ? "Temporary Hit Points" : "Hit Points";
			if (healUpcastId) {
				store.integrants.integrants[healUpcastId] = {
					...healUpcastBase,
					name: `${spellData.name} ${healLabel} Upcast`,
					recordName: `${spellData.name} ${healLabel} Upcast`,
					startingLevel: healUpcastData.startingLevel,
					level: healUpcastData.stepLevels || 1,
					mode: "Per X Spell Level",
					target: healUpcastData.targetBonus ? "$._bonus" : "$.diceCount",
					value: healUpcastData.value,
					changeMode: "Add",
					parentID: healId,
					childIDs: "[]",
					relations: {},
				};
			}
			store.integrants.integrants[healId] = {
				...healBase,
				name: `${spellData.name} ${healLabel}`,
				recordName: `${spellData.name} ${healLabel}`,
				_bonus: healParsed.bonus,
				ability: "none",
				diceCount: healParsed.diceCount,
				diceSize: healParsed.diceSize,
				overrideCrit: false,
				critDiceSize: "",
				isTemp: !!hasTHP,
				parentID: spellId,
				childIDs: healUpcastId ? JSON.stringify([healUpcastId]) : "[]",
				relations: {},
			};
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
