function d20plusImporter () {
	d20plus.importer = {};
	d20plus.debug = {};

	d20plus.importer._playerImports = {};

	// Setting this variable to true will grab data from the site, rather than the script's storage
	d20plus.debug.forceExternalRequests = false;

	d20plus.importer.storePlayerImport = function (id, data) {
		d20plus.importer._playerImports[id] = data;
	};

	d20plus.importer.retrievePlayerImport = function (id) {
		return d20plus.importer._playerImports[id];
	};

	d20plus.importer.clearPlayerImport = function () {
		d20plus.importer._playerImports = {};
	};

	d20plus.importer.pAddBrew = async function (url) {
		if (!url) return;
		await BrewUtil2.pAddBrewFromUrl(url);
	};

	d20plus.importer.getCleanText = function (str) {
		if (!str || !str.trim()) return "";

		const check = jQuery.parseHTML(str);
		if (check.length === 1 && check[0].constructor === Text) {
			return str;
		}
		const $ele = $(str);
		$ele.find("td, th").append(" | ");
		$ele.find("tr").append("\n");
		$ele.find("p, li, br").append("\n\n");
		$ele.find("li").prepend(" - ");

		return $ele.text()
			.trim()
			.replace(/\n/g, "<<N>>")
			.replace(/\s+/g, " ")
			.replace(/<<N>>(<<N>>)+/g, "\n\n")
			.replace(/<<N>>/g, "\n")
			.replace(/\n +/g, "\n");

	};


	d20plus.importer.doFakeDrop = function (event, characterView, fakeRoll20Json) {
		const e = characterView; // AKA character.view
		const o = (Array.isArray(fakeRoll20Json)) ? fakeRoll20Json[0] : fakeRoll20Json;

		// The page/subheading area always undefined, since we're not coming from the compendium. Pass in some junk.
		const t = d20plus.ut.generateRowId(); // `$(i.helper[0]).attr("data-pagename")` e.g. "Spells%3AFire%20Bolt"

		// Clean out any lingering values
		if (e.$currentDropTarget) {
			e.$currentDropTarget.find("*[accept]").each(function () {
				$(this).val(undefined);
			});
		} else {
			// eslint-disable-next-line no-console
			console.error(`Could not find current drop target!`);
			return;
		}

		/* eslint-disable */

		// BEGIN ROLL20 CODE
		let d;
		if (!!o.data) {
			d = o;
		} else {
			// Validate JSON before parsing
			if (typeof o === 'string' && o.trim()) {
				try {
					d = JSON.parse(o);
				} catch (e) {
					console.error('Failed to parse drop data:', e);
					return;
				}
			} else {
				console.warn('Invalid drop data received, skipping import');
				return;
			}
		}

		// Validate that the parsed data has the required structure
		if (!d || !d.data) {
			console.warn('Drop data missing required "data" property, skipping import');
			return;
		}

		const g = _.clone(d.data);
		g.Name = d.name;
		g.data = JSON.stringify(d.data);
		g.uniqueName = t;
		if (d.content) g.Content = d.content;


		// Set values AND trigger sheet worker for each field (like original Roll20 code)
		e.$currentDropTarget.find("*[accept]").each(function() {
			const v = $(this), C = v.attr("accept");
			if (g[C]) {
				if (v[0].tagName.toLowerCase() === "input" && v.attr("type") === "checkbox" || v[0].tagName.toLowerCase() === "input" && v.attr("type") === "radio") {
					v.prop("checked", v.val() === g[C]);
				} else if (v[0].tagName.toLowerCase() === "select") {
					v.find("option").each(function() {
						const E = $(this);
						if (E.val() === g[C] || E.text() === g[C]) E.prop("selected", !0);
					});
				} else {
					v.val(g[C]);
				}
				// Trigger sheet worker for each field like original Roll20 code
				e.saveSheetValues(this, "compendium");
			}
		});
		// END ROLL20 CODE

		/* eslint-enable */

		// reset the drag UI
		characterView.activeDrop = false;
		characterView.compendiumDragOver();
	};

	// caller should run `$iptFilter.off("keydown").off("keyup");` before calling this
	d20plus.importer.addListFilter = function ($iptFilter, dataList, listObj, listIndexConverter) {
		$iptFilter.val("");
		const TYPE_TIMEOUT_MS = 100;
		let typeTimer;
		$iptFilter.on("keyup", () => {
			clearTimeout(typeTimer);
			typeTimer = setTimeout(() => {
				const exps = $iptFilter.val().split(";");
				const filters = exps.map(it => it.trim())
					.filter(it => it)
					.map(it => it.toLowerCase().split(":"))
					.filter(it => it.length === 2)
					.map(it => ({field: it[0], value: it[1]}));
				const grouped = [];
				filters.forEach(f => {
					const existing = grouped.find(it => it.field === f.field);
					if (existing) existing.values.push(f.value);
					else grouped.push({field: f.field, values: [f.value]})
				});

				listObj.filter((item) => {
					const it = dataList[$(item.elm).attr("data-listid")];
					it._filterVs = it._filterVs || listIndexConverter(it);
					return !grouped.find(f => {
						if (it._filterVs[f.field]) {
							if (it._filterVs[f.field] instanceof Array) {
								return !(it._filterVs[f.field].find(v => f.values.includes(v)));
							} else {
								return !f.values.includes(it._filterVs[f.field])
							}
						}
						return false;
					});
				});
			}, TYPE_TIMEOUT_MS);
		});
		$iptFilter.on("keydown", () => {
			clearTimeout(typeTimer);
		});
	};

	d20plus.importer.getSetAvatarImage = async function (character, avatar, portraitUrl) {
		let tokensize = 1;
		if (character.size[0] === "T") tokensize = 0.5;  // Tiny: half-square
		// Small intentionally 1 — Small creatures occupy a full 1x1 square
		else if (character.size[0] === "L") tokensize = 2;
		else if (character.size[0] === "H") tokensize = 3;
		else if (character.size[0] === "G") tokensize = 4;
		let lightradius = null;
		if (character.senses && character.senses.toLowerCase().match(/(darkvision|blindsight|tremorsense|truesight)/)) lightradius = Math.max(...character.senses.match(/\d+/g));
		let lightmin = 0;
		if (character.senses && character.senses.toLowerCase().match(/(blindsight|tremorsense|truesight)/)) lightmin = lightradius;
		const nameSuffix = d20plus.cfg.get("import", "namesuffix");
		let defaulttoken = {
			represents: character.id,
			name: `${character.name}${nameSuffix ? ` ${nameSuffix}` : ""}`,
			imgsrc: avatar,
			width: Math.floor(70 * tokensize),
			height: Math.floor(70 * tokensize),
			compact_bar: d20plus.cfg.getOrDefault("token", "isCompactBars") ? "compact" : "standard",
		};
		if (!d20plus.cfg.get("import", "skipSenses")) {
			defaulttoken.light_hassight = true;
			if (lightradius != null) {
				defaulttoken.light_radius = `${lightradius}`;
				defaulttoken.light_dimradius = `${lightmin}`;
			}
		}
		const barLocation = d20plus.cfg.getOrDefault("token", "barLocation");
		switch (barLocation) {
			case "Above": defaulttoken.bar_location = "above"; break;
			case "Top Overlapping": defaulttoken.bar_location = "overlap_top"; break;
			case "Bottom Overlapping": defaulttoken.bar_location = "overlap_bottom"; break;
			case "Below": defaulttoken.bar_location = "below"; break;
		}

		// Token bars — Jumpgate 2024 stores HP/AC in the store blob, not individual attribs.
		// Use static values from the store; OGL path links bars to attributes as before.
		const storeAttr = character.attribs?.find(a => a.get("name") === "store");
		if (storeAttr) {
			const store = storeAttr.get("current");
			if (store && typeof store === "object") {
				const hp = store.hitpoints?.currentHP;
				if (hp != null) {
					defaulttoken.bar1_value = String(hp);
					defaulttoken.bar1_max = String(hp);
				}
				const acInt = Object.values(store.integrants?.integrants || {})
					.find(i => i.type === "Armor Class");
				if (acInt?.valueFormula?.flatValue != null) {
					defaulttoken.bar2_value = String(acInt.valueFormula.flatValue);
				}
			}
		} else if (character.attribs) {
			// OGL: link bars to attributes by name/id
			const bar1AttrName = d20plus.cfg.getOrDefault("token", "bar1");
			if (bar1AttrName) {
				const bar1Attr = character.attribs.find(a => a.get("name").toLowerCase() === bar1AttrName.toLowerCase());
				if (bar1Attr) {
					defaulttoken.bar1_link = bar1Attr.id;
					defaulttoken.bar1_value = bar1Attr.get("current");
					if (d20plus.cfg.getOrDefault("token", "bar1_max")) {
						defaulttoken.bar1_max = bar1Attr.get("max") || bar1Attr.get("current");
					}
				}
			}
			const bar2AttrName = d20plus.cfg.getOrDefault("token", "bar2");
			if (bar2AttrName) {
				const bar2Attr = character.attribs.find(a => a.get("name").toLowerCase() === bar2AttrName.toLowerCase());
				if (bar2Attr) {
					defaulttoken.bar2_link = bar2Attr.id;
					defaulttoken.bar2_value = bar2Attr.get("current");
					if (d20plus.cfg.getOrDefault("token", "bar2_max")) {
						defaulttoken.bar2_max = bar2Attr.get("max") || bar2Attr.get("current");
					}
				}
			}
			const bar3AttrName = d20plus.cfg.getOrDefault("token", "bar3");
			if (bar3AttrName) {
				const bar3Attr = character.attribs.find(a => a.get("name").toLowerCase() === bar3AttrName.toLowerCase());
				if (bar3Attr) {
					defaulttoken.bar3_link = bar3Attr.id;
					defaulttoken.bar3_value = bar3Attr.get("current");
					if (d20plus.cfg.getOrDefault("token", "bar3_max")) {
						defaulttoken.bar3_max = bar3Attr.get("max") || bar3Attr.get("current");
					}
				}
			}
		}

		// ensure any portrait URL exists
		let outPortraitUrl = portraitUrl || avatar;
		if (portraitUrl) {
			await new Promise(resolve => {
				$.ajax({
					url: portraitUrl,
					type: "HEAD",
					error: function () {
						d20plus.ut.error(`Could not access portrait URL "${portraitUrl}"`);
						outPortraitUrl = avatar;
						resolve()
					},
					success: () => resolve(),
				});
			});
		}

		// Avatar = token image so the journal shows the token art
		character.attributes.avatar = avatar;
		character.updateBlobs({avatar: avatar, defaulttoken: JSON.stringify(defaulttoken)});
		// Explicit defaulttoken timestamp tells Roll20 to use the blob on drag-to-map.
		// Without it, Roll20 ignores the blob and creates a 1x1 avatar token instead.
		character.save({defaulttoken: (new Date()).getTime()});

		// Portrait/fluff image → Bio & Info page (written first; renderFluff will append after)
		if (outPortraitUrl && outPortraitUrl !== avatar) {
			character.updateBlobs({bio: `<p><img src="${outPortraitUrl}" style="max-width:100%;" alt=""></p>`});
			character.save({bio: (new Date()).getTime()});
		}
	};

	d20plus.importer._baseAddAction = function (character, baseAction, name, actionText, prefix, index, expand) {
		if (d20plus.cfg.getOrDefault("import", "tokenactions") && expand) {
			character.abilities.create({
				name: `${prefix + index}: ${name}`,
				istokenaction: true,
				action: d20plus.macro.actionMacroAction(baseAction, index),
			}).save();
		}

		const newRowId = d20plus.ut.generateRowId();

		function handleAttack() {
            console.log("[IMPORT] Parsing attack action");
            const rollBase = d20plus.importer.rollbase();

            let attackType = "";
            let attackType2 = "";

            const atkMatch = actionText.match(/\{@atk (\w+)}/i);
            if (atkMatch) {
                const atkCode = atkMatch[1].toLowerCase();
                switch (atkCode) {
                    case "m": attackType = "Melee"; break;
                    case "r": attackType = "Ranged"; break;
                    case "mw": attackType = "Melee"; break;
                    case "rw": attackType = "Ranged"; break;
                    case "ms": attackType = "Melee Spell"; break;
                    case "rs": attackType = "Ranged Spell"; break;
                    default: attackType = "Unknown"; break;
                }
                attackType2 = " Attack:";
            } else if (actionText.includes(" Weapon Attack:")) {
                const match = actionText.match(/(Melee|Ranged) Weapon Attack:/);
                if (match) {
                    attackType = match[1];
                    attackType2 = " Weapon Attack:";
                }
            } else if (actionText.includes(" Spell Attack:")) {
                attackType = "Spell";
                attackType2 = " Spell Attack:";
            }

            // Range / Reach handling
            let attackRange = "";
            let rangeType = "";

            const reachMatch = actionText.match(/reach\s+([\d\/\s]+ft)(?:[,.]|$)/i);
            const rangeMatch = actionText.match(/range\s+([\d\/\s]+ft)(?:[,.]|$)/i);

            if (attackType.includes("Melee") && reachMatch) {
                attackRange = reachMatch[1];
                rangeType = "Reach";
            } else if (rangeMatch) {
                attackRange = rangeMatch[1];
                rangeType = "Range";
            }

            // --- Parse toHit
            const toHitMatch = actionText.match(/\{@hit (\d+)}/) || actionText.match(/\+(\d+)(?:\s*to hit)?/i);
            const toHit = (toHitMatch || ["", ""])[1];

            // Damage parsing
            let damage = "";
            let damageType = "";
            let damage2 = "";
            let damageType2 = "";
            let onHit = "";
            const damageRegex = /\d+ \((\d+d\d+\s?[+\-]?\s?\d*)\) (\S+ )?damage/g;

            let damageSearches = damageRegex.exec(actionText);
            if (damageSearches) {
                onHit = damageSearches[0];
                damage = damageSearches[1];
                damageType = (damageSearches[2] || "").trim();
                damageSearches = damageRegex.exec(actionText);
                if (damageSearches) {
                    onHit += ` plus ${damageSearches[0]}`;
                    damage2 = damageSearches[1];
                    damageType2 = (damageSearches[2] || "").trim();
                }
            }
            onHit = onHit.trim();

            const attackTarget = ((actionText.match(/\.,(?!.*\.,)(.*)\. Hit:/) || ["", ""])[1] || "").trim();

            // Action Description
            const atkDescSimpleRegex = /Hit: \d+ \((\d+d\d+\s?[+\-]?\s?\d*)\) (\S+ )?damage\.([\s\S]*)/gm;
            const atkDescComplexRegex = /(Hit:[\s\S]*)/g;
            let actionDesc = "";

            const match_simple_atk = atkDescSimpleRegex.exec(actionText);
            if (match_simple_atk != null) {
                actionDesc = match_simple_atk[3].trim();
            } else {
                const matchCompleteAtk = atkDescComplexRegex.exec(actionText);
                if (matchCompleteAtk != null) actionDesc = matchCompleteAtk[1].trim();
            }

            const toHitRange = `+${toHit}, ${rangeType} ${attackRange}, ${attackTarget}.`;
            const damageFlags = `{{damage=1}} {{dmg1flag=1}}${damage2 ? ` {{dmg2flag=1}}` : ""}`;

            // Debug logs
            console.log("[DEBUG] attackType:", attackType);
            console.log("[DEBUG] attackType2:", attackType2);
            console.log("[DEBUG] toHit:", toHit);
            console.log("[DEBUG] attackRange:", attackRange);
            console.log("[DEBUG] rangeType:", rangeType);
            console.log("[DEBUG] damage:", damage);
            console.log("[DEBUG] damage2:", damage2);
            console.log("[DEBUG] attackTarget:", attackTarget);
            console.log("[DEBUG] toHitRange:", toHitRange);
            console.log("[DEBUG] onHit:", onHit);

            // Roll20 attribs
            character.attribs.create({name: `${baseAction}_${newRowId}_name`, current: name}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_flag`, current: "on"}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_npc_options-flag`, current: "0"}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_display_flag`, current: "{{attack=1}}"}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_options`, current: "{{attack=1}}"}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_tohit`, current: toHit}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_damage`, current: damage}).save();

            const critDamage = (damage || "").trim().replace(/[-+]\s*\d+$/, "").trim();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_crit`, current: critDamage}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_damagetype`, current: damageType}).save();
            if (damage2) {
                character.attribs.create({name: `${baseAction}_${newRowId}_attack_damage2`, current: damage2}).save();
                character.attribs.create({name: `${baseAction}_${newRowId}_attack_crit2`, current: damage2}).save();
                character.attribs.create({name: `${baseAction}_${newRowId}_attack_damagetype2`, current: damageType2}).save();
            }

            character.attribs.create({name: `${baseAction}_${newRowId}_name_display`, current: name}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_rollbase`, current: rollBase}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_type`, current: attackType}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_type_display`, current: attackType + attackType2}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_tohitrange`, current: toHitRange}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_range`, current: attackRange}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_target`, current: attackTarget}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_damage_flag`, current: damageFlags}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_attack_onhit`, current: onHit}).save();

            const descriptionFlag = Math.max(Math.ceil(actionText.length / 57), 1);
            character.attribs.create({name: `${baseAction}_${newRowId}_description`, current: actionDesc}).save();
            character.attribs.create({name: `${baseAction}_${newRowId}_description_flag`, current: descriptionFlag}).save();

            const descVisFlag = d20plus.cfg.getOrDefault("import", "hideActionDescs") ? " " : "@{description}";
            character.attribs.create({name: `${baseAction}_${newRowId}_show_desc`, current: descVisFlag}).save();
        }

		function parseInlineDamage(text) {
			let result = text.replace(/\{@damage ([^}]+)}/gi, (_, dice) => `[[${dice.trim()}]]`);

			result = result.replace(/(\d+)?\s*\((\d+d\d+(?:\s?[+-]\s?\d+)?)\)/g, (match, fixed, dice) => {
				return fixed ? `${fixed} ([[${dice}]])` : `([[${dice}]])`;
			});

			return result;
		}


		function handleOtherAction () {
			const rollBase = d20plus.importer.rollbase(false); // macro
			character.attribs.create({name: `${baseAction}_${newRowId}_name`, current: name}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_npc_options-flag`, current: "0"}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_attack_tohitrange`, current: "+0"}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_attack_onhit`, current: ""}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_damage_flag`, current: ""}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_attack_crit`, current: ""}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_attack_crit2`, current: ""}).save();
			character.attribs.create({name: `${baseAction}_${newRowId}_rollbase`, current: rollBase}).save();

			const macroText = parseInlineDamage(actionText);

			character.attribs.create({name: `${baseAction}_${newRowId}_description`, current: macroText}).save();


		}
		if (
			actionText.includes(" Attack:") ||
			actionText.includes(" Attack Roll:") ||
			/\{@atkr? [msr]+}/i.test(actionText) ||
			actionText.toLowerCase().includes("to hit")
		) {
			console.log("[IMPORT] Detected attack format → Calling handleAttack()");
			handleAttack();
		} else {
			console.log("[IMPORT] Not an attack → Calling handleOtherAction()");
			handleOtherAction();
		}
	};

	d20plus.importer.addAction = function (character, name, actionText, index) {
		d20plus.importer._baseAddAction(character, "repeating_npcaction", name, actionText, "", index, true);
	};

	d20plus.importer.addBonusAction = function (character, name, actionText, index) {
		d20plus.importer._baseAddAction(character, "repeating_npcbonusaction", name, actionText, "Bonus", index, true);
	};

	d20plus.importer.addLegendaryAction = function (character, name, actionText, index) {
		const expand = d20plus.cfg.getOrDefault("import", "tokenactionsExpanded");
		d20plus.importer._baseAddAction(character, "repeating_npcaction-l", name, actionText, "Legendary", index, expand);
	};

	d20plus.importer.addMythicAction = function (character, name, actionText, index) {
		const expand = d20plus.cfg.getOrDefault("import", "tokenactionsExpanded");
		d20plus.importer._baseAddAction(character, "repeating_npcaction-m", name, actionText, "Mythic", index, expand);
	};

	d20plus.importer.addVehicleAction = function (character, name, actionText, index) {
		const expand = d20plus.cfg.getOrDefault("import", "tokenactionsExpanded");
		d20plus.importer._baseAddAction(character, "repeating_vehicleactions", name, actionText, "Vehicle", index, expand);
	};

	// Create token actions from an already-imported character's attributes
	// Used by module importer to generate token actions after character import
	d20plus.importer._createTokenActionsFromCharacter = function (character) {
		// Get all attributes
		const attribs = character.attribs.toJSON();

		// Helper to extract repeating section entries
		const getRepeatingSections = (prefix) => {
			const entries = {};
			attribs.forEach(attr => {
				const match = attr.name.match(new RegExp(`^${prefix}_([-\\w]+)_(\\w+)$`));
				if (match) {
					const rowId = match[1];
					const field = match[2];
					if (!entries[rowId]) entries[rowId] = {};
					entries[rowId][field] = attr.current;
				}
			});
			return Object.values(entries);
		};

		// Create token actions for regular actions (including attacks)
		const actions = getRepeatingSections("repeating_npcaction").filter(a => a.name);
		if (actions.length > 0) {
			actions.forEach((action, i) => {
				character.abilities.create({
					name: `${i}: ${action.name}`,
					istokenaction: true,
					action: d20plus.macro.actionMacroAction("repeating_npcaction", i),
				});
			});
		}

		// Create token actions for bonus actions
		const bonusActions = getRepeatingSections("repeating_npcbonusaction").filter(a => a.name);
		if (bonusActions.length > 0) {
			bonusActions.forEach((action, i) => {
				character.abilities.create({
					name: `Bonus${i}: ${action.name}`,
					istokenaction: true,
					action: d20plus.macro.actionMacroAction("repeating_npcbonusaction", i),
				});
			});
		}

		// Create token actions for reactions
		const reactions = getRepeatingSections("repeating_npcreaction").filter(r => r.name);
		if (reactions.length > 0) {
			reactions.forEach((reaction, i) => {
				character.abilities.create({
					name: `Reaction: ${reaction.name}`,
					istokenaction: true,
					action: d20plus.macro.actionMacroReaction(i),
				});
			});
		}

		// Create token actions for traits
		const traits = getRepeatingSections("repeating_npctrait").filter(t => t.name);
		if (traits.length > 0 && d20plus.cfg.getOrDefault("import", "tokenactionsTraits")) {
			traits.forEach((trait, i) => {
				character.abilities.create({
					name: `Trait: ${trait.name}`,
					istokenaction: true,
					action: d20plus.macro.actionMacroTrait(i),
				});
			});
		}

		// Create token actions for legendary actions
		const legendaryActions = getRepeatingSections("repeating_npcaction-l").filter(a => a.name);
		if (legendaryActions.length > 0) {
			const expand = d20plus.cfg.getOrDefault("import", "tokenactionsExpanded");

			if (expand) {
				// Create individual token actions for each legendary action
				legendaryActions.forEach((action, i) => {
					character.abilities.create({
						name: `Legendary${i}: ${action.name}`,
						istokenaction: true,
						action: d20plus.macro.actionMacroAction("repeating_npcaction-l", i),
					});
				});
			} else {
				// Create single token action with all legendary actions
				const tokenactiontext = legendaryActions
					.map((action, i) => {
						return `[${action.name}](~selected|repeating_npcaction-l_$${i}_npc_action)`;
					}).join("\n\r");

				character.abilities.create({
					name: "Legendary Actions",
					istokenaction: true,
					action: d20plus.macro.actionMacroLegendary(tokenactiontext),
				});
			}
		}

		// Create token actions for mythic actions
		const mythicActions = getRepeatingSections("repeating_npcaction-m").filter(a => a.name);
		if (mythicActions.length > 0) {
			const expand = d20plus.cfg.getOrDefault("import", "tokenactionsExpanded");

			if (expand) {
				// Create individual token actions for each mythic action
				mythicActions.forEach((action, i) => {
					character.abilities.create({
						name: `Mythic${i}: ${action.name}`,
						istokenaction: true,
						action: d20plus.macro.actionMacroAction("repeating_npcaction-m", i),
					});
				});
			} else {
				// Create single token action with all mythic actions
				const tokenactiontext = mythicActions
					.map((action, i) => {
						return `[${action.name}](~selected|repeating_npcaction-m_$${i}_npc_action)`;
					}).join("\n\r");

				character.abilities.create({
					name: "Mythic Actions",
					istokenaction: true,
					action: d20plus.macro.actionMacroMythic(tokenactiontext),
				});
			}
		}

		// Create common token actions (skills, perception, saves, initiative, ability checks)
		if (d20plus.cfg.getOrDefault("import", "tokenactionsSkills")) {
			character.abilities.create({
				name: "Skill Check",
				istokenaction: true,
				action: d20plus.macro.actionMacroSkillCheck,
			});
		}

		if (d20plus.cfg.getOrDefault("import", "tokenactionsPerception")) {
			character.abilities.create({
				name: "Perception",
				istokenaction: true,
				action: d20plus.macro.actionMacroPerception,
			});
		}

		if (d20plus.cfg.getOrDefault("import", "tokenactionsSaves")) {
			character.abilities.create({
				name: "Saving Throw",
				istokenaction: true,
				action: d20plus.macro.actionMacroSaves,
			});
		}

		if (d20plus.cfg.getOrDefault("import", "tokenactionsInitiative")) {
			character.abilities.create({
				name: "Initiative",
				istokenaction: true,
				action: d20plus.macro.actionMacroInit,
			});
		}

		if (d20plus.cfg.getOrDefault("import", "tokenactionsChecks")) {
			character.abilities.create({
				name: "Ability Check",
				istokenaction: true,
				action: d20plus.macro.actionMacroAbilityCheck,
			});
		}

		if (d20plus.cfg.getOrDefault("import", "tokenactionsOther")) {
			character.abilities.create({
				name: "DR/Immunities",
				istokenaction: true,
				action: d20plus.macro.actionMacroDrImmunities,
			});
			character.abilities.create({
				name: "Stats",
				istokenaction: true,
				action: d20plus.macro.actionMacroStats,
			});
		}
	};

	// Add individual weapons to the npc ship stat block
	d20plus.importer._addVehicleWeapon = function (character, weapon, renderer, prefix) {
		const newRowId = d20plus.ut.generateRowId();
		let desc = "";

		// Locomotion mostly occurs in the movement section of UAOfShipsAndSea ships
		if (weapon.locomotion) {
			const locEntries = Renderer.vehicle.ship.getLocomotionEntries(weapon.locomotion[0]);
			desc = d20plus.importer.getCleanText(renderer.render(locEntries));
		}
		// Speed mostly occurs in the movement section of GoS ships
		else if (weapon.speed) {
			const speedEntries = Renderer.vehicle.ship.getSpeedEntries(weapon.speed[0]);
			desc = d20plus.importer.getCleanText(renderer.render(speedEntries));
		}
		// This sets the description of non-movement weapons
		else if (weapon.entries) {
			desc = d20plus.importer.getCleanText(renderer.render({entries: weapon.entries}));
		}

		// Cost code stolen from Giddy
		const cost = weapon.costs ? weapon.costs.map(cost => {
			return `${Parser.vehicleCostToFull(cost) || "\u2014"}${cost.note ? `  (${renderer.render(cost.note)})` : ""}`;
		}).join(", ") : weapon.hpNote || "\u2014";

		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_name`, current: `${prefix}${weapon.name}`});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_quantity`, current: weapon.count || 1});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_crew`, current: weapon.crew || ""});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_actions`, current: "10"});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_ac`, current: weapon.ac || ""});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_hp`, current: weapon.hp || ""});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_hp--silent`, current: weapon.hp || ""});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_cost`, current: cost});
		character.attribs.create({name: `repeating_vehicleweapon_${newRowId}_description`, current: desc});
	};

	d20plus.importer.addVehicleWeapons = function (character, wArray, renderer, prefix = null) {
		wArray.forEach(w => {
			d20plus.importer._addVehicleWeapon(character, w, renderer, prefix ? `${prefix}: ` : "");
		});
	}

	d20plus.importer.findAttrId = function (character, attrName) {
		const found = character.attribs.toJSON().find(a => a.name === attrName);
		return found ? found.id : undefined;
	};

	d20plus.importer.findOrGenerateRepeatingRowId = function (character, namePattern, current) {
		const [namePrefix, nameSuffix] = namePattern.split(/\$\d?/);
		const attr = character.attribs.toJSON()
			.find(a => a.name.startsWith(namePrefix) && a.name.endsWith(nameSuffix) && a.current === current);
		return attr
			? attr.name.replace(RegExp(`^${namePrefix}(.*)${nameSuffix}$`), "$1")
			: d20plus.ut.generateRowId();
	}

	d20plus.importer.addOrUpdateAttr = function (character, attrName, value) {
		const id = d20plus.importer.findAttrId(character, attrName);
		if (id) {
			const it = character.attribs.get(id).set("current", value);
			it.save();
		} else {
			const it = character.attribs.create({
				"name": attrName,
				"current": value,
			});
			it.save();
		}
	};

	d20plus.importer.makePlayerDraggable = function (importId, name) {
		const $appTo = $(`#d20plus-playerimport`).find(`.Vetools-player-imported`);
		const $li = $(`
		<li class="journalitem dd-item handout ui-draggable compendium-item Vetools-draggable player-imported" data-playerimportid="${importId}">
			<div class="dd-handle dd-sortablehandle">Drag</div>
			<div class="dd-content">
				<div class="token"><img src="/images/handout.png" draggable="false" alt=""></div>
				<div class="name">
					<div class="namecontainer">${name}</div>
				</div>
			</div>
		</li>
	`);
		d20plus.importer.bindFakeCompendiumDraggable($li);
		$appTo.prepend($li);
	};

	d20plus.importer.bindFakeCompendiumDraggable = function ($ele) {
		/* eslint-disable */
		$ele.draggable({
			// region BEGIN ROLL20 CODE
			revert: !0,
			distance: 10,
			revertDuration: 0,
			helper: "clone",
			appendTo: "body",
			scroll: !1,
			iframeFix: !0,
			start () {
				$(".characterdialog iframe").css("pointer-events", "none"),
				$(".characterdialog .charsheet-compendium-drop-target").show(),
				$("iframe[id='advanced-charsheet-dialog__charsheet']").css("pointer-events", "none")
			},
			drag (e) {
				let t; let i = 0;
				const n = [];
				$(".characterdialog[data-characterid]").each((e, o) => {
					const r = d20.Campaign.characters.get($(o).data("characterid"));
					if (r && r.view.dragOver) {
						const e = parseInt(r.view.$el.parent().css("z-index"));
						n.push(r),
						e > i && (t = r.id,
						i = e)
					}
				},
				);
				n.forEach(i => {
					if (i.id === t) {
						const t = i.view.$el.offset();
						i.view.compendiumDragOver(e.pageX - t.left, e.pageY - t.top),
						i.view.activeDrop = !0
					} else {
						i.view.activeDrop = !1,
						i.view.compendiumDragOver()
					}
				},
				)
			},
			stop () {
				$(".characterdialog iframe").css("pointer-events", "auto"),
				$(".characterdialog .charsheet-compendium-drop-target").hide(),
				$("iframe[id='advanced-charsheet-dialog__charsheet']").css("pointer-events", "auto")
			},
			// endregion END ROLL20 CODE
		});
		/* eslint-enable */
	};

	d20plus.importer.getTagString = function (data, prefix) {
		return JSON.stringify(data.filter(it => it).map(d => `${prefix}-${Parser.stringToSlug(d.toString())}`).concat([prefix]));
	};

	// from OGL sheet, Aug 2018
	d20plus.importer.rollbase = (isAttack = true) => {
		const dtype = d20plus.importer.getDesiredDamageType();
		if (dtype === "full") {
			return `@{wtype}&{template:npcaction} ${isAttack ? `{{attack=1}}` : ""} @{damage_flag} @{npc_name_flag} {{rname=@{name}}} {{r1=[[@{d20}+(@{attack_tohit}+0)]]}} @{rtype}+(@{attack_tohit}+0)]]}} {{dmg1=[[@{attack_damage}+0]]}} {{dmg1type=@{attack_damagetype}}} {{dmg2=[[@{attack_damage2}+0]]}} {{dmg2type=@{attack_damagetype2}}} {{crit1=[[@{attack_crit}+0]]}} {{crit2=[[@{attack_crit2}+0]]}} {{description=@{show_desc}}} @{charname_output}`;
		} else {
			return `@{wtype}&{template:npcatk} ${isAttack ? `{{attack=1}}` : ""} @{damage_flag} @{npc_name_flag} {{rname=[@{name}](~repeating_npcaction_npc_dmg)}} {{rnamec=[@{name}](~repeating_npcaction_npc_crit)}} {{type=[Attack](~repeating_npcaction_npc_dmg)}} {{typec=[Attack](~repeating_npcaction_npc_crit)}} {{r1=[[@{d20}+(@{attack_tohit}+0)]]}} @{rtype}+(@{attack_tohit}+0)]]}} {{description=@{show_desc}}} @{charname_output}`;
		}
	};

	d20plus.importer.getDesiredRollType = function () {
		// rtype
		const toggle = "@{advantagetoggle}";
		const never = "{{normal=1}} {{r2=[[0d20";
		const always = "{{always=1}} {{r2=[[@{d20}";
		const query = "{{query=1}} ?{Advantage?|Normal Roll,&#123&#123normal=1&#125&#125 &#123&#123r2=[[0d20|Advantage,&#123&#123advantage=1&#125&#125 &#123&#123r2=[[@{d20}|Disadvantage,&#123&#123disadvantage=1&#125&#125 &#123&#123r2=[[@{d20}}";
		const desired = d20plus.cfg.get("import", "advantagemode");
		if (desired) {
			switch (desired) {
				case "Toggle (Default Advantage)":
				case "Toggle":
				case "Toggle (Default Disadvantage)":
					return toggle;
				case "Always":
					return always;
				case "Query":
					return query;
				case "Never":
					return never;
			}
		} else {
			return toggle;
		}
	};

	d20plus.importer.getDesiredAdvantageToggle = function () {
		// advantagetoggle
		const advantage = "{{query=1}} {{advantage=1}} {{r2=[[@{d20}";
		const desired = d20plus.cfg.get("import", "advantagemode");
		const neither = "";
		if (desired) {
			switch (desired) {
				case "Toggle (Default Advantage)":
					return advantage;
				case "Toggle (Default Disadvantage)":
					return desired;
				case "Toggle":
				case "Always":
				case "Query":
				case "Never":
					return neither;
			}
		} else {
			return neither;
		}
	};

	d20plus.importer.getDesiredWhisperType = function () {
		// wtype
		const toggle = "@{whispertoggle}";
		const never = " ";
		const always = "/w gm ";
		const query = "?{Whisper?|Public Roll,|Whisper Roll,/w gm }";
		const desired = d20plus.cfg.get("import", "whispermode");
		if (desired) {
			switch (desired) {
				case "Toggle (Default GM)":
				case "Toggle (Default Public)":
					return toggle;
				case "Always":
					return always;
				case "Query":
					return query;
				case "Never":
					return never;
			}
		} else {
			return toggle;
		}
	};

	d20plus.importer.getDesiredWhisperToggle = function () {
		// whispertoggle
		const gm = "/w gm ";
		const pblic = " ";
		const desired = d20plus.cfg.get("import", "whispermode");
		if (desired) {
			switch (desired) {
				case "Toggle (Default GM)":
					return gm;
				case "Toggle (Default Public)":
					return pblic;
				case "Always":
					return "";
				case "Query":
					return "";
				case "Never":
					return "";
			}
		} else {
			return gm;
		}
	};

	d20plus.importer.getDesiredDamageType = function () {
		// dtype
		const on = "full";
		const off = "pick";
		const desired = d20plus.cfg.get("import", "damagemode");
		if (desired) {
			switch (desired) {
				case "Auto Roll":
					return on;
				case "Don't Auto Roll":
					return off;
			}
		} else {
			return on;
		}
	};

	d20plus.importer.importModeSwitch = function () {
		d20plus.importer.clearPlayerImport();
		$(`#d20plus-playerimport`).find(`.append-list-journal`).empty();

		$(`.importer-section`).hide();
		const toShow = $(`#import-mode-select`).val();
		$(`#betteR20-settings`).find(`.importer-section[data-import-group="${toShow}"]`).show();
		const toShowPlayer = $(`#import-mode-select-player`).val();
		$(`#d20plus-playerimport`).find(`.importer-section[data-import-group="${toShowPlayer}"]`).show();
	};

	d20plus.importer.showImportList = async function (dataType, dataArray, handoutBuilder, options) {
		if (!options) options = {};
		/*
		options = {
			groupOptions: ["Source", "CR", "Alphabetical", "Type"],
			forcePlayer: true,
			callback: () => console.log("hello world"),
			saveIdsTo: {}, // object to receive IDs of created handouts/creatures
			// these three generally used together
			listItemBuilder: (it) => `<span class="name col-8">${it.name}</span><span title="${Parser.sourceJsonToFull(it.source)}" class="source col-4">${it.cr ? `(CR ${it.cr.cr || it.cr}) ` : ""}(${Parser.sourceJsonToAbv(it.source)})</span>`,
			listIndex: ["name", "source"],
			listIndexConverter: (mon) => {
				name: mon.name.toLowerCase(),
				source: Parser.sourceJsonToAbv(m.source).toLowerCase() // everything is assumed to be lowercase
			},
			nextStep: (doImport, originalImportQueue) {
				const modifiedImportQueue = originalImportQueue.map(it => JSON.stringify(JSON.parse(it));
				doImport(modifiedImportQueue);
			},
			builderOptions: {
				(...passed to handoutBuilder depending on requirements...)
			}
		}
		 */
		$("a.ui-tabs-anchor[href='#journal']").trigger("click");

		if (!window.is_gm || options.forcePlayer) {
			d20plus.importer.clearPlayerImport();
			const $winPlayer = $(`#d20plus-playerimport`);
			const $appPlayer = $winPlayer.find(`.append-list-journal`);
			$appPlayer.empty();
			$appPlayer.append(`<ol class="dd-list Vetools-player-imported" style="max-width: 95%;"/>`);
		}

		// sort data
		dataArray.sort((a, b) => SortUtil.ascSort(a.name, b.name));

		// collect available properties
		const propSet = {}; // represent this as an object instead of a set, to maintain some semblance of ordering
		dataArray.map(it => Object.keys(it)).forEach(keys => keys.forEach(k => propSet[k] = true));

		// build checkbox list
		const $list = $("#import-list .list");
		$list.html("");
		dataArray.forEach((it, i) => {
			if (it.noDisplay) return;

			const inner = options.listItemBuilder
				? options.listItemBuilder(it)
				: `<span class="name col-10">${it.name}</span><span class="source" title="${Parser.sourceJsonToFull(it.source)}">${Parser.sourceJsonToAbv(it.source)}</span>`;

			$list.append(`
			<label class="import-cb-label" data-listid="${i}">
				<input type="checkbox">
				${inner}
			</label>
		`);
		});

		// init list library
		const importList = new List("import-list", {
			valueNames: options.listIndex || ["name", "source"],
		});

		// reset the UI and add handlers
		$(`#import-list > .search`).val("");
		importList.search("");
		$("#import-options label").hide();
		$("#import-overwrite").parent().show();
		$("#import-showplayers").parent().show();
		$("#organize-by").parent().show();
		$("#d20plus-importlist").dialog("open");

		$("#d20plus-importlist button").unbind("click");

		$("#importlist-selectvis").bind("click", () => {
			d20plus.importer._importSelectVisible(importList);
		});
		$("#importlist-deselectvis").bind("click", () => {
			d20plus.importer._importDeselectVisible(importList);
		});

		$("#importlist-selectall-published").bind("click", () => {
			d20plus.importer._importSelectPublished(importList);
		});

		$("#importlist-filter").bind("click", () => {
			d20plus.importer._importFilterList(importList);
		});
		$("#importlist-reset").bind("click", () => {
			d20plus.importer._importResetList(importList);
		});

		if (options.listIndexConverter) {
			const $iptFilter = $(`#import-list-filter`).show();
			$(`#import-list-filter-help`).show();
			$iptFilter.off("keydown").off("keyup");
			d20plus.importer.addListFilter($iptFilter, dataArray, importList, options.listIndexConverter);
		} else {
			$(`#import-list-filter`).hide();
			$(`#import-list-filter-help`).hide();
		}

		const excludedProps = new Set();
		const $winProps = $("#d20plus-import-props");
		$winProps.find(`button`).bind("click", () => {
			excludedProps.clear();
			$winProps.find(`.prop-row`).each((i, ele) => {
				if (!$(ele).find(`input`).prop("checked")) excludedProps.add($(ele).find(`span`).text());
			});
		});
		const $btnProps = $(`#save-import-props`);
		$btnProps.bind("click", () => {
			$winProps.dialog("close");
		});
		const $props = $winProps.find(`.select-props`);
		$props.empty();
		$(`#import-open-props`).bind("click", () => {
			Object.keys(propSet).forEach(p => {
				const req = REQUIRED_PROPS[dataType] && REQUIRED_PROPS[dataType].includes(p);
				$props.append(`
					<label style="display: block; ${req ? "color: red;" : ""}" class="prop-row">
						<input type="checkbox" checked="checked">
						<span>${p}</span>
					</label>
				`)
			});
			$winProps.dialog("open");
		});

		const $selGroupBy = $(`#organize-by`);
		$selGroupBy.html("");
		options.groupOptions = (options.groupOptions || ["Alphabetical", "Source"]).concat(["None"]);
		options.groupOptions.forEach(g => {
			$selGroupBy.append(`<option value="${g}">${g}</option>`);
		});
		const storageKeyGroupBy = `Veconfig-importer-groupby-${dataType}`;
		$selGroupBy.on("change", () => {
			StorageUtil.pSet(storageKeyGroupBy, $selGroupBy.val())
		})
		try {
			const savedSelection = await StorageUtil.pGet(storageKeyGroupBy);
			if (savedSelection) {
				$selGroupBy.val(savedSelection);
			}
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error("Failed to set group from saved!");
		}

		const $cbShowPlayers = $("#import-showplayers");
		$cbShowPlayers.prop("checked", dataType !== "monster");

		const $btnImport = $("#d20plus-importlist button#importstart");
		$btnImport.text(options.nextStep ? "Next" : "Import");
		$btnImport.bind("click", function () {
			$("#d20plus-importlist").dialog("close");
			const overwrite = $("#import-overwrite").prop("checked");
			const inJournals = $cbShowPlayers.prop("checked") ? "all" : "";
			const groupBy = $(`#organize-by`).val();

			// build list of items to process
			const importQueue = [];
			importList.items.forEach((e) => {
				if ($(e.elm).find("input").prop("checked")) {
					const dataIndex = parseInt($(e.elm).data("listid"));
					const it = dataArray[dataIndex];
					importQueue.push(it);
				}
			});

			if (!importQueue.length) return;

			const doImport = (importQueue) => {
				const $stsName = $("#import-name");
				const $stsRemain = $("#import-remaining");
				const $title = $stsName.parent().parent().find("span.ui-dialog-title");
				$title.text("Importing");

				let remaining = importQueue.length;

				let interval;
				if (dataType === "monster" || dataType === "object" || dataType === "vehicle") {
					interval = d20plus.cfg.get("import", "importIntervalCharacter") || d20plus.cfg.getDefault("import", "importIntervalCharacter");
				} else {
					interval = d20plus.cfg.get("import", "importIntervalHandout") || d20plus.cfg.getDefault("import", "importIntervalHandout");
				}

				let cancelWorker = false;
				const $btnCancel = $(`#importcancel`);

				$btnCancel.off();
				$btnCancel.on("click", () => {
					cancelWorker = true;
					handleWorkerComplete();
				});

				const $remainingText = $("#import-remaining-text");
				$btnCancel.removeClass("btn-success");
				$btnCancel.text("Cancel");

				$remainingText.text("remaining");

				// start worker to process list
				$("#d20plus-import").dialog("open");

				// run one immediately
				let worker;
				workerFn();
				worker = setInterval(() => {
					workerFn();
				}, interval);

				function workerFn () {
					if (!importQueue.length) {
						handleWorkerComplete();
						return;
					}
					if (cancelWorker) {
						return;
					}

					// pull items out the queue in LIFO order, for journal ordering (last created will be at the top)
					let it = importQueue.pop();
					it.name = it.name || "(Unknown)";

					$stsName.text(it.name);
					$stsRemain.text(remaining--);

					if (excludedProps.size) {
						it = JSON.parse(JSON.stringify(it));
						[...excludedProps].forEach(k => delete it[k]);
					}

					if (!window.is_gm || options.forcePlayer) {
						handoutBuilder(it, undefined, undefined, undefined, undefined, options.builderOptions);
					} else {
						const folderName = groupBy === "None" ? "" : d20plus.importer._getHandoutPath(dataType, it, groupBy);
						const builderOptions = Object.assign({}, options.builderOptions || {});
						if (dataType === "spell" && groupBy === "Spell Points") builderOptions.isSpellPoints = true;
						handoutBuilder(it, overwrite, inJournals, folderName, options.saveIdsTo, builderOptions);
					}
				}

				function handleWorkerComplete () {
					if (worker) clearInterval(worker);

					if (cancelWorker) {
						$title.text("Import cancelled");
						$stsName.text("");
						if (~$stsRemain.text().indexOf("(cancelled)")) $stsRemain.text(`${$stsRemain.text()} (cancelled)`);
						d20plus.ut.log(`Import cancelled`);
						setTimeout(() => {
							d20plus.bindDropLocations();
						}, 250);
					} else {
						$title.text("Import complete");
						$stsName.text("");
						$btnCancel.addClass("btn-success");
						$btnCancel.prop("title", "");

						$stsRemain.text("0");
						d20plus.ut.log(`Import complete`);
						setTimeout(() => {
							d20plus.bindDropLocations();
						}, 250);
						if (options.callback) options.callback();
					}

					$btnCancel.off();
					$btnCancel.on("click", () => $btnCancel.closest(".ui-dialog-content").dialog("close"));

					$btnCancel.first().text("OK");
					$remainingText.empty();
					$stsRemain.empty();
				}
			};

			if (options.nextStep) {
				if (importQueue.length) {
					options.nextStep(doImport, importQueue)
				}
			} else {
				doImport(importQueue);
			}
		});
	};

	// Import dialog showing names of monsters failed to import
	d20plus.importer.addImportError = function (name) {
		let $span = $("#import-errors");
		if ($span.text() === "0") {
			$span.text(name);
		} else {
			$span.text(`${$span.text()}, ${name}`);
		}
	};

	d20plus.importer._getHandoutPath = function (dataType, it, groupBy) {
		switch (dataType) {
			case "monster": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "CR":
						folderName = it.cr ? (it.cr.cr || it.cr) : "Unknown";
						break;
					case "Alphabetical":
						folderName = d20plus.deities._getFullName(it)[0].uppercaseFirst();
						break;
					case "Type (with tags)":
						folderName = Parser.monTypeToFullObj(it.type).asText.uppercaseFirst();
						break;
					case "CR → Type":
						folderName = [it.cr ? (it.cr.cr || it.cr) : "Unknown", Parser.monTypeToFullObj(it.type).types.map(t => t.uppercaseFirst()).join("/")];
						break;
					case "Type":
					default:
						folderName = Parser.monTypeToFullObj(it.type).types.map(t => t.uppercaseFirst()).join("/");
						break;
				}
				return folderName;
			}
			case "spell": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
						folderName = it.name[0].uppercaseFirst();
						break;
					case "Spell Points":
						folderName = `${d20plus.spells.spLevelToSpellPoints(it.level)} spell points`;
						break;
					case "Level":
					default:
						folderName = `${Parser.spLevelToFull(it.level)}${it.level ? " level" : ""}`;
						break;
				}
				return folderName;
			}
			case "item": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Rarity":
						folderName = it.rarity;
						break;
					case "Alphabetical":
						folderName = it.name[0].uppercaseFirst();
						break;
					case "Type":
					default:
						if (it.type) {
							folderName = Renderer.item.getItemTypeName(it.type);
						} else if (it._textTypes) {
							folderName = it._textTypes.join(", ");
						} else {
							folderName = "Unknown";
						}
						break;
				}
				return folderName;
			}
			case "psionic": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Order":
						folderName = Parser.psiOrderToFull(it.order);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "feat": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "object": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "vehicle": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "class": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "subclass": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
						folderName = it.name[0].uppercaseFirst();
						break;
					case "Class":
					default:
						folderName = it.className;
				}
				return folderName;
			}
			case "background": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "optionalfeature": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "race": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			case "deity": {
				let folderName;
				switch (groupBy) {
					case "Source":
						folderName = Parser.sourceJsonToFull(it.source);
						break;
					case "Alphabetical":
					default:
						folderName = it.name[0].uppercaseFirst();
						break;
				}
				return folderName;
			}
			default:
				throw new Error(`Unknown import type '${dataType}'`);
		}
	};

	d20plus.importer._checkHandleDuplicate = function (path, overwrite) {
		const dupe = d20plus.journal.checkFileExistsByPath(path);
		if (dupe && !overwrite) return false;
		else if (dupe) d20plus.journal.removeFileByPath(path);
		return true;
	};

	d20plus.importer._importToggleSelectAll = function (importList, selectAllCb) {
		const $sa = $(selectAllCb);
		const val = $sa.prop("checked");
		importList.items.forEach(i => Array.prototype.forEach.call(i.elm.children, (e) => {
			if (e.tagName === "INPUT") {
				$(e).prop("checked", val);
			}
		}));
	};

	d20plus.importer._importSelectVisible = function (importList) {
		importList.visibleItems.forEach(i => Array.prototype.forEach.call(i.elm.children, (e) => {
			if (e.tagName === "INPUT") {
				$(e).prop("checked", true);
			}
		}));
	};

	d20plus.importer._importDeselectVisible = function (importList) {
		importList.visibleItems.forEach(i => Array.prototype.forEach.call(i.elm.children, (e) => {
			if (e.tagName === "INPUT") {
				$(e).prop("checked", false);
			}
		}));
	};

	d20plus.importer._importSelectPublished = function (importList) {
		function setSelection (i, setTo) {
			Array.prototype.forEach.call(i.elm.children, (e) => {
				if (e.tagName === "INPUT") {
					$(e).prop("checked", setTo);
				}
			})
		}

		importList.items.forEach(i => {
			if (SourceUtil.isNonstandardSource(i.values().source)) {
				setSelection(i, false);
			} else {
				setSelection(i, true);
			}
		});
	};

	d20plus.importer._importFilterList = function (importList) {
		const $winFilterList = $("#d20plus-import-filter-list");
		$winFilterList.dialog("open");
		const $btnImport = $winFilterList.find(".btn");
		const $winText = $winFilterList.find(".table-import-textarea");

		$btnImport.on("click", () => {
			function filterList () {
				const toSearch = $winText.val().toLowerCase().replaceAll(`"`, "").split("\n");
				const firstLine = toSearch[0];

				// If no search terms are entered, reset the filter
				if (toSearch.length === 1 && firstLine === "") {
					importList.filter();
					return;
				}

				const searchDict = {};
				toSearch.forEach(it => {
					const items = it.split(",");
					// If additional filters are added, they can go here
					searchDict[items[0].trim()] = {
						"name": items[0].trim(),
						"source": items.length > 1 ? items[1].trim() : null,
						// Some categories list their source in this format
						"altsource": items.length > 1 ? `src[${items[1].trim()}]` : null,
					}
				})

				// Filters to match names and sources on the list
				x = importList
				importList.filter(it => {
					const name = it._values.name.toLowerCase();
					const source = it._values.source.toLowerCase();

					if (!(name in searchDict)) return false;
					if (!searchDict[name].source) return true;
					return searchDict[name].source === source || searchDict[name].altsource === source;

				});
			}

			filterList();

			$winFilterList.dialog("close");
		}).appendTo($winFilterList);
	};

	d20plus.importer._importResetList = function (importList) {
		importList.filter();
	};

	d20plus.importer.CharacterAttributesProxy = class {
		constructor (character) {
			this.character = character;
			this._changedAttrs = [];
			this._attribsCache = null;
		}

		_getAttribs () {
			if (!this._attribsCache) this._attribsCache = this.character.model.attribs.toJSON();
			return this._attribsCache;
		}

		findByName (attrName) {
			return this._getAttribs().find(a => a.name === attrName) || {};
		}

		findOrGenerateRepeatingRowId (namePattern, current) {
			const [namePrefix, nameSuffix] = namePattern.split(/\$\d?/);
			const attr = this._getAttribs()
				.find(a => a.name.startsWith(namePrefix) && a.name.endsWith(nameSuffix) && a.current === current);
			return attr
				? attr.name.replace(RegExp(`^${namePrefix}(.*)${nameSuffix}$`), "$1")
				: d20plus.ut.generateRowId();
		}

		add (name, current, max) {
			this.character.model.attribs.create({
				name: name,
				current: current,
				...(max == null ? {} : {max: max}),
			}).save();
			this._changedAttrs.push(name);
			this._attribsCache = null;
		}

		addOrUpdate (name, current, max) {
			const id = this.findByName(name).id;
			if (id) {
				this.character.model.attribs.get(id).set({
					current: current,
					...(max == null ? {} : {max: max}),
				}).save();
				this._changedAttrs.push(name);
			} else {
				this.add(name, current, max);
			}
		}

		notifySheetWorkers () {
			d20.journal.notifyWorkersOfAttrChanges(this.character.model.id, this._changedAttrs);
			this._changedAttrs = [];
		}
	};

	// D&D Beyond PDF Importer
	// PDF.js is bundled in the build, no need to load it
	d20plus.importer.loadPdfJs = async function() {
		if (typeof pdfjsLib !== 'undefined') {
			// Configure PDF.js to disable workers (since we're in a userscript environment)
			pdfjsLib.GlobalWorkerOptions.workerSrc = false;
			return; // Already loaded
		}
		throw new Error("PDF.js library not available in build");
	};

	d20plus.importer.parseDnDBeyondPDF = async function(arrayBuffer) {
		if (typeof pdfjsLib === 'undefined') {
			throw new Error("PDF.js library not loaded.");
		}

		try {
			// Disable worker for userscript environment
			pdfjsLib.GlobalWorkerOptions.workerSrc = false;

			const pdf = await pdfjsLib.getDocument({
				data: arrayBuffer,
				useWorkerFetch: false,
				isEvalSupported: false,
				useSystemFonts: true
			}).promise;

			console.log(`PDF has ${pdf.numPages} pages`);

			// Build a map of field names to values from ALL pages
			const fields = {};

			// Read all pages
			for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
				const page = await pdf.getPage(pageNum);
				const annotations = await page.getAnnotations();

				annotations.forEach(annot => {
					if (annot.subtype === 'Widget' && annot.fieldName) {
						fields[annot.fieldName] = annot.fieldValue || annot.buttonValue || '';
					}
				});
			}

			console.log("PDF Form Fields extracted:", Object.keys(fields).length);
			console.log("Fields:", fields);

			// Parse the D&D Beyond character sheet format
			return d20plus.importer._parseDnDBeyondFields(fields);
		} catch (error) {
			console.error("PDF parsing error:", error);
			throw new Error(`Failed to parse PDF: ${error.message}`);
		}
	};

	d20plus.importer._parseDnDBeyondFields = function(fields) {
		const characterData = {
			abilities: {},
			savingThrows: {},
			skills: {},
			weapons: [],
			equipment: [],
			currency: {},
			spells: [],
			personality: {}
		};

		// Extract character name
		characterData.name = fields['CharacterName'] || 'Imported Character';

		// Extract class and level from "CLASS  LEVEL" field (note: two spaces in field name)
		const classLevel = fields['CLASS  LEVEL'] || '';
		const classMatch = classLevel.match(/^(.+?)\s+(\d+)$/);
		if (classMatch) {
			characterData.class = classMatch[1].trim();
			characterData.level = classMatch[2];
		} else {
			characterData.class = classLevel || '';
			characterData.level = '1';
		}

		// Extract race/species
		characterData.species = fields['RACE'] || '';

		// Extract background
		characterData.background = fields['BACKGROUND'] || '';

		// Extract experience points
		characterData.experience = fields['EXPERIENCE POINTS'] || '0';

		// Extract ability scores
		characterData.abilities.strength = parseInt(fields['STR']) || 10;
		characterData.abilities.dexterity = parseInt(fields['DEX']) || 10;
		characterData.abilities.constitution = parseInt(fields['CON']) || 10;
		characterData.abilities.intelligence = parseInt(fields['INT']) || 10;
		characterData.abilities.wisdom = parseInt(fields['WIS']) || 10;
		characterData.abilities.charisma = parseInt(fields['CHA']) || 10;

		// Extract combat stats
		characterData.ac = fields['AC'] || '10';
		characterData.initiative = fields['Init'] || '0';

		// Extract speed and clean it up (remove " ft. (Walking)")
		const speedRaw = fields['Speed'] || '30';
		const speedMatch = speedRaw.match(/(\d+)/);
		characterData.speed = speedMatch ? speedMatch[1] : '30';

		// Extract HP
		characterData.maxHP = fields['MaxHP'] || '1';
		characterData.currentHP = fields['CurrentHP'] || fields['MaxHP'] || '1';

		// Extract proficiency bonus and clean it up (remove "+")
		const profRaw = fields['ProfBonus'] || '2';
		characterData.proficiencyBonus = profRaw.replace('+', '');

		// Extract hit dice
		characterData.hitDice = fields['Total'] || '1d6';

		// Extract saving throw bonuses directly from the calculated values
		const savingThrowBonusMap = {
			'ST Strength': 'strength',
			'ST Dexterity': 'dexterity',
			'ST Constitution': 'constitution',
			'ST Intelligence': 'intelligence',
			'ST Wisdom': 'wisdom',
			'ST Charisma': 'charisma'
		};
		characterData.savingThrowBonuses = {};
		Object.entries(savingThrowBonusMap).forEach(([fieldName, abilityName]) => {
			const bonusStr = fields[fieldName] || '+0';
			// Convert "+3" to 3, "-1" to -1, etc.
			characterData.savingThrowBonuses[abilityName] = parseInt(bonusStr) || 0;
		});

		// Also track proficiency flags (marked with "•") for reference
		const savingThrowProfMap = {
			'StrProf': 'strength',
			'DexProf': 'dexterity',
			'ConProf': 'constitution',
			'IntProf': 'intelligence',
			'WisProf': 'wisdom',
			'ChaProf': 'charisma'
		};
		Object.entries(savingThrowProfMap).forEach(([fieldName, abilityName]) => {
			const value = (fields[fieldName] || '').trim();
            characterData.savingThrows[abilityName] = value === '•' || value.includes('•') || value === 'P';
		});

		// Extract skill bonuses directly from the calculated values
		const skillBonusMap = {
			'Acrobatics': 'acrobatics',
			'Animal': 'animal_handling',
			'Arcana': 'arcana',
			'Athletics': 'athletics',
			'Deception': 'deception',
			'History': 'history',
			'Insight': 'insight',
			'Intimidation': 'intimidation',
			'Investigation': 'investigation',
			'Medicine': 'medicine',
			'Nature': 'nature',
			'Perception': 'perception',
			'Performance': 'performance',
			'Persuasion': 'persuasion',
			'Religion': 'religion',
			'SleightofHand': 'sleight_of_hand',
			'Stealth ': 'stealth',  // Note: has trailing space in PDF
			'Survival': 'survival'
		};
		characterData.skillBonuses = {};
		Object.entries(skillBonusMap).forEach(([fieldName, skillName]) => {
			const bonusStr = fields[fieldName] || '+0';
			// Convert "+5" to 5, "-1" to -1, etc.
			characterData.skillBonuses[skillName] = parseInt(bonusStr) || 0;
		});

		// Also track proficiency flags (marked with "P") for reference
		const skillProfMap = {
			'AcrobaticsProf': 'acrobatics',
			'AnimalHandlingProf': 'animal_handling',
			'ArcanaProf': 'arcana',
			'AthleticsProf': 'athletics',
			'DeceptionProf': 'deception',
			'HistoryProf': 'history',
			'InsightProf': 'insight',
			'IntimidationProf': 'intimidation',
			'InvestigationProf': 'investigation',
			'MedicineProf': 'medicine',
			'NatureProf': 'nature',
			'PerceptionProf': 'perception',
			'PerformanceProf': 'performance',
			'PersuasionProf': 'persuasion',
			'ReligionProf': 'religion',
			'SleightOfHandProf': 'sleight_of_hand',
			'StealthProf': 'stealth',
			'SurvivalProf': 'survival'
		};
		Object.entries(skillProfMap).forEach(([fieldName, skillName]) => {
			const value = (fields[fieldName] || '').trim();
			characterData.skills[skillName] = value === 'P' || value.includes('P');
		});

		// Extract proficiencies and languages
		// The PDF uses structured sections like "=== ARMOR ===", "=== WEAPONS ===", "=== TOOLS ===", "=== LANGUAGES ==="
		const proficienciesLang = fields['ProficienciesLang'] || '';

		// Extract languages section
		const langMatch = proficienciesLang.match(/===\s*LANGUAGES?\s*===\s*\n(.+?)(?:\n===|$)/is);
		if (langMatch) {
			characterData.languages = langMatch[1].trim();
		} else {
			characterData.languages = '';
		}

		// Extract armor, weapons, and tools sections - all go to "TOOL PROFICIENCIES & CUSTOM SKILLS"
		const armorMatch = proficienciesLang.match(/===\s*ARMOR\s*===\s*\n(.+?)(?:\n===|$)/is);
		const armorProfs = armorMatch ? armorMatch[1].trim() : '';

		const weaponsMatch = proficienciesLang.match(/===\s*WEAPONS?\s*===\s*\n(.+?)(?:\n===|$)/is);
		const weaponProfs = weaponsMatch ? weaponsMatch[1].trim() : '';

		const toolsMatch = proficienciesLang.match(/===\s*TOOLS?\s*===\s*\n(.+?)(?:\n===|$)/is);
		const toolProfs = toolsMatch ? toolsMatch[1].trim() : '';

		// Combine all proficiencies (armor, weapons, tools) for repeating_tool section
		characterData.toolProficiencies = [armorProfs, weaponProfs, toolProfs].filter(p => p).join(', ');

		// Extract weapons (up to 6)
		for (let i = 1; i <= 6; i++) {
			const wpnField = i === 1 ? '' : ` ${i}`;
			const name = fields[`Wpn Name${wpnField}`];
			if (name && name.trim()) {
				// Note: weapon 2-6 have trailing spaces in their field names
				const atkBonusField = i === 1 ? 'Wpn1 AtkBonus' : `Wpn${i} AtkBonus `;
				const damageField = i === 1 ? 'Wpn1 Damage' : `Wpn${i} Damage `;

				characterData.weapons.push({
					name: name,
					bonus: fields[atkBonusField] || '+0',
					damage: fields[damageField] || '1d4'
				});
			}
		}

		// Extract player name
		characterData.playerName = fields['PLAYER NAME'] || '';

		// Extract defenses (resistances, immunities, etc.)
		characterData.defenses = fields['Defenses'] || '';

		// Extract additional senses
		characterData.senses = fields['AdditionalSenses'] || '';

		// Extract temp HP
		characterData.tempHP = fields['TempHP'] && fields['TempHP'] !== '--' ? fields['TempHP'] : '';

		// Extract current hit dice
		characterData.currentHD = fields['HD'] || '';

		// Extract inspiration
		characterData.inspiration = fields['Inspiration'] === 'On' ? '1' : '0';

		// Extract actions/features
		characterData.actions1 = fields['Actions1'] || '';
		characterData.actions2 = fields['Actions2'] || '';

		// Extract ability save DC
		characterData.abilitySaveDC = fields['AbilitySaveDC'] || '';

		// Extract currency
		characterData.currency.cp = fields['CP'] || '0';
		characterData.currency.sp = fields['SP'] || '0';
		characterData.currency.ep = fields['EP'] || '0';
		characterData.currency.gp = fields['GP'] || '0';
		characterData.currency.pp = fields['PP'] || '0';

		// Extract equipment (up to 26 items: Eq Name0-25)
		for (let i = 0; i <= 25; i++) {
			const name = fields[`Eq Name${i}`];
			if (name && name.trim()) {
				characterData.equipment.push({
					name: name,
					quantity: fields[`Eq Qty${i}`] || '1',
					weight: fields[`Eq Weight${i}`] || ''
				});
			}
		}

		// Extract spells (up to 50: spellName0-49)
		let currentSpellLevel = 'cantrip';
		let spellSlots = {};

		for (let i = 0; i <= 49; i++) {
			// Process spell at current index FIRST (before header changes the level)
			const spellName = fields[`spellName${i}`];
			if (spellName && spellName.trim()) {
				characterData.spells.push({
					name: spellName,
					level: currentSpellLevel,
					castingTime: fields[`spellCastingTime${i}`] || '',
					range: fields[`spellRange${i}`] || '',
					components: fields[`spellComponents${i}`] || '',
					duration: fields[`spellDuration${i}`] || '',
					saveOrHit: fields[`spellSaveHit${i}`] || '',
					source: fields[`spellSource${i}`] || '',
					page: fields[`spellPage${i}`] || '',
					prepared: fields[`spellPrepared${i}`] === 'O',
					notes: fields[`spellNotes${i}`] || ''
				});
			}

			// NOW check for spell level headers to update level for NEXT spells
			const header = fields[`spellHeader${i}`];
			if (header) {
				if (header.includes('CANTRIPS')) currentSpellLevel = 'cantrip';
				else if (header.includes('1st')) currentSpellLevel = '1';
				else if (header.includes('2nd')) currentSpellLevel = '2';
				else if (header.includes('3rd')) currentSpellLevel = '3';
				else if (header.includes('4th')) currentSpellLevel = '4';
				else if (header.includes('5th')) currentSpellLevel = '5';
				else if (header.includes('6th')) currentSpellLevel = '6';
				else if (header.includes('7th')) currentSpellLevel = '7';
				else if (header.includes('8th')) currentSpellLevel = '8';
				else if (header.includes('9th')) currentSpellLevel = '9';

				// Extract spell slots from header like "3 Slots OOO"
				const slotHeader = fields[`spellSlotHeader${i}`];
				if (slotHeader && currentSpellLevel !== 'cantrip') {
					const slotMatch = slotHeader.match(/(\d+)\s+Slots/);
					if (slotMatch) {
						spellSlots[currentSpellLevel] = slotMatch[1];
					}
				}
			}
		}

		// Store spell slots
		characterData.spellSlots = spellSlots;

		// Extract spellcasting info
		characterData.spellcastingClass = fields['spellCastingClass0'] || '';
		characterData.spellcastingAbility = fields['spellCastingAbility0'] || '';
		characterData.spellAttackBonus = fields['spellAtkBonus0'] || '';
		characterData.spellSaveDC = fields['spellSaveDC0'] || '';

		// Extract personality traits
		characterData.personality.traits = fields['PersonalityTraits '] || '';  // Note: has trailing space
		characterData.personality.ideals = fields['Ideals'] || '';
		characterData.personality.bonds = fields['Bonds'] || '';
		characterData.personality.flaws = fields['Flaws'] || '';
		characterData.personality.backstory = fields['Backstory'] || '';

		// Extract additional bio info
		characterData.age = fields['AGE'] || '';
		characterData.height = fields['HEIGHT'] || '';
		characterData.weight = fields['WEIGHT'] || '';
		characterData.eyes = fields['EYES'] || '';
		characterData.hair = fields['HAIR'] || '';
		characterData.skin = fields['SKIN'] || '';
		characterData.gender = fields['GENDER'] || '';
		characterData.alignment = fields['ALIGNMENT'] || '';

		// Extract class features
        characterData.featuresTraits = [
            fields['FeaturesTraits1'] || '',
            fields['FeaturesTraits2'] || '',
            fields['FeaturesTraits3'] || ''
        ].filter(f => f).join('\n\n');

		return characterData;
	};


	d20plus.importer.importDnDBeyondCharacter = async function(characterData) {
		return new Promise((resolve, reject) => {
			// Create a new character in Roll20 with callback
			d20.Campaign.characters.create(
				{
					name: characterData.name || "Imported Character",
					inplayerjournals: "",
					controlledby: "",
				},
				{
					success: async (character) => {
						try {
							d20plus.importer._populateDnDBeyondCharacter(character, characterData);

							// Import items and weapons with full data from 5etools database
							const itemsToImport = character._dndbEquipmentToImport;
							const weaponsToImport = character._dndbWeaponsToImport;
							const spellsToImport = character._dndbSpellsToImport;

							delete character._dndbEquipmentToImport;
							delete character._dndbWeaponsToImport;
							delete character._dndbSpellsToImport;

							if (itemsToImport || weaponsToImport || spellsToImport) {
								// Wait for character to be fully created, then import
								setTimeout(async () => {
									try {
										if (itemsToImport || weaponsToImport) {
											console.log("Importing items and weapons from 5etools database...");
											await d20plus.importer.importDnDBeyondItems(character, itemsToImport, weaponsToImport);
										}
										if (spellsToImport) {
											console.log("Importing spells from 5etools database...");
											await d20plus.importer.importDnDBeyondSpells(character, spellsToImport);
										}
									} catch (importError) {
										console.error("Error importing items/spells:", importError);
									}
								}, 1500);
							}

							resolve(character);
						} catch (error) {
							reject(error);
						}
					},
					error: (error) => {
						reject(error);
					}
				}
			);
		});
	};

	d20plus.importer._populateDnDBeyondCharacter = function(character, characterData) {
		// Wrap character for the proxy (it expects {model: character})
		const wrappedChar = { model: character };
		const attrs = new d20plus.importer.CharacterAttributesProxy(wrappedChar);

		// Helper to calculate ability modifier
		const calcMod = (score) => Math.floor((Number(score) - 10) / 2);

		// Set ability scores using the 2014 character sheet format
		const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
		abilities.forEach(ability => {
			const score = characterData.abilities?.[ability] || 10;
			const mod = calcMod(score);

			attrs.add(ability, score, score); // Set current and max
			attrs.add(`${ability}_base`, `${score}`);
			attrs.add(`${ability}_mod`, mod);
		});

		// Set basic character info
		attrs.add("character_name", characterData.name || "");
		attrs.add("class", characterData.class || "");
		attrs.add("level", characterData.level || "1");
		attrs.add("base_level", characterData.level || "1");
		attrs.add("race", characterData.species || "");
		attrs.add("background", characterData.background || "");
		attrs.add("experience", characterData.experience || "0");

		// Set combat stats
		attrs.add("ac", characterData.ac || "10");
		attrs.add("hp", characterData.currentHP || characterData.maxHP || "1", characterData.maxHP || "1");
		attrs.add("hp_max", characterData.maxHP || "1");
		attrs.add("speed", characterData.speed || "30");
		attrs.add("initiative_bonus", characterData.initiative || calcMod(characterData.abilities?.dexterity || 10));
		attrs.add("pb", characterData.proficiencyBonus || "2");

		// Set hit dice
		if (characterData.hitDice) {
			attrs.add("hit_dice", characterData.hitDice);
		}

		// Set saving throw bonuses (calculated values from PDF)
		if (characterData.savingThrowBonuses) {
			Object.entries(characterData.savingThrowBonuses).forEach(([ability, bonus]) => {
				attrs.add(`${ability}_save_bonus`, bonus);
			});
		}

		// Set saving throw proficiencies (only for proficient saves)
		if (characterData.savingThrows) {
			Object.entries(characterData.savingThrows).forEach(([ability, proficient]) => {
				if (proficient) {
					// Set save type: 1 = proficient
					attrs.add(`${ability}_save_prof_type`, "1");
					// Set proficiency formula (just proficiency bonus, not multiplied by type)
					attrs.add(`${ability}_save_prof`, `(@{pb})`);
				}
			});
		}

		// Set skill bonuses (calculated values from PDF)
		if (characterData.skillBonuses) {
			Object.entries(characterData.skillBonuses).forEach(([skill, bonus]) => {
				attrs.add(`${skill}_bonus`, bonus);
			});
		}

		// Set skill proficiencies (only for proficient skills)
		if (characterData.skills) {
			Object.entries(characterData.skills).forEach(([skill, proficient]) => {
				if (proficient) {
					// Set skill type: 1 = proficient, 2 = expertise
					attrs.add(`${skill}_type`, "1");
					// Set proficiency formula
					attrs.add(`${skill}_prof`, `(@{pb}*@{${skill}_type})`);
				}
			});
		}

		// Set tool proficiencies in repeating_tool section
		if (characterData.toolProficiencies) {
			// Split by comma or newline and create separate rows
			const tools = characterData.toolProficiencies.split(/[,\n]+/).map(t => t.trim()).filter(t => t);
			tools.forEach(tool => {
				const rowId = d20plus.ut.generateRowId();
				attrs.add(`repeating_tool_${rowId}_toolname`, tool);
				attrs.add(`repeating_tool_${rowId}_toolbonus_base`, "@{pb}");
				attrs.add(`repeating_tool_${rowId}_options-flag`, "0");
			});
		}

		// Set languages in repeating_proficiencies section
		if (characterData.languages) {
			// Split by comma or newline and create separate rows
			const langs = characterData.languages.split(/[,\n]+/).map(l => l.trim()).filter(l => l);
			langs.forEach(lang => {
				const rowId = d20plus.ut.generateRowId();
				attrs.add(`repeating_proficiencies_${rowId}_name`, lang);
				attrs.add(`repeating_proficiencies_${rowId}_options-flag`, "0");
			});
		}

		// Store weapons for later import from 5etools database
		if (characterData.weapons && characterData.weapons.length > 0) {
			character._dndbWeaponsToImport = characterData.weapons;
		}

		// Set currency
		if (characterData.currency) {
			if (characterData.currency.cp) attrs.add("cp", characterData.currency.cp);
			if (characterData.currency.sp) attrs.add("sp", characterData.currency.sp);
			if (characterData.currency.ep) attrs.add("ep", characterData.currency.ep);
			if (characterData.currency.gp) attrs.add("gp", characterData.currency.gp);
			if (characterData.currency.pp) attrs.add("pp", characterData.currency.pp);
		}

		// Store equipment for later import from 5etools database
		if (characterData.equipment && characterData.equipment.length > 0) {
			character._dndbEquipmentToImport = characterData.equipment;
		}

		// Add spells - store for async import after character is created
		// We'll import these after the character is saved using the spell database
		if (characterData.spells && characterData.spells.length > 0) {
			// Store spells for later import
			character._dndbSpellsToImport = characterData.spells;
		}

		// Set spell slots
		if (characterData.spellSlots) {
			Object.entries(characterData.spellSlots).forEach(([level, slots]) => {
				attrs.add(`lvl${level}_slots_total`, slots);
			});
		}

		// Set spellcasting info
		if (characterData.spellcastingClass) {
			attrs.add("spellcasting_class", characterData.spellcastingClass);
		}
		if (characterData.spellcastingAbility) {
			attrs.add("spellcasting_ability", characterData.spellcastingAbility);
		}
		if (characterData.spellAttackBonus) {
			attrs.add("spell_attack_bonus", characterData.spellAttackBonus);
		}
		if (characterData.spellSaveDC) {
			attrs.add("spell_save_dc", characterData.spellSaveDC);
		}

		// Set personality traits
		if (characterData.personality) {
			if (characterData.personality.traits) {
				attrs.add("personality_traits", characterData.personality.traits);
			}
			if (characterData.personality.ideals) {
				attrs.add("ideals", characterData.personality.ideals);
			}
			if (characterData.personality.bonds) {
				attrs.add("bonds", characterData.personality.bonds);
			}
			if (characterData.personality.flaws) {
				attrs.add("flaws", characterData.personality.flaws);
			}
			if (characterData.personality.backstory) {
				attrs.add("character_backstory", characterData.personality.backstory);
			}
		}

		// Set bio info
		if (characterData.age) attrs.add("age", characterData.age);
		if (characterData.height) attrs.add("height", characterData.height);
		if (characterData.weight) attrs.add("weight", characterData.weight);
		if (characterData.eyes) attrs.add("eyes", characterData.eyes);
		if (characterData.hair) attrs.add("hair", characterData.hair);
		if (characterData.skin) attrs.add("skin", characterData.skin);
		if (characterData.gender) attrs.add("gender", characterData.gender);
		if (characterData.alignment) attrs.add("alignment", characterData.alignment);

		// Set features and traits
		if (characterData.featuresTraits) {
			// Add as a single trait entry
			const rowId = d20plus.ut.generateRowId();
			attrs.add(`repeating_traits_${rowId}_name`, "Features & Traits");
			attrs.add(`repeating_traits_${rowId}_description`, characterData.featuresTraits);
			attrs.add(`repeating_traits_${rowId}_source`, "Class");
		}

		// Set player name
		if (characterData.playerName) {
			attrs.add("player_name", characterData.playerName);
		}

		// Set defenses (resistances/immunities)
		if (characterData.defenses) {
			attrs.add("damage_resistances", characterData.defenses);
		}

		// Set senses
		if (characterData.senses) {
			attrs.add("senses", characterData.senses);
		}

		// Set temp HP
		if (characterData.tempHP) {
			attrs.add("hp_temp", characterData.tempHP);
		}

		// Set current hit dice (if different from max)
		if (characterData.currentHD) {
			attrs.add("hit_dice_current", characterData.currentHD);
		}

		// Set inspiration
		if (characterData.inspiration) {
			attrs.add("inspiration", characterData.inspiration);
		}

		// Add class features/actions from Actions1 and Actions2
		if (characterData.actions1 || characterData.actions2) {
			const combinedActions = [characterData.actions1, characterData.actions2]
				.filter(a => a)
				.join('\n\n');

			// Parse actions and add as features
			const actionSections = combinedActions.split(/===\s*([^=]+)\s*===/);
			for (let i = 1; i < actionSections.length; i += 2) {
				const sectionName = actionSections[i].trim();
				const sectionContent = actionSections[i + 1].trim();

				if (sectionName !== 'ACTIONS' && sectionContent) {
					// Split by feature (look for patterns like "Feature Name • Uses")
					const features = sectionContent.split(/\n(?=[A-Z])/);
					features.forEach(feature => {
						if (feature.trim()) {
							const rowId = d20plus.ut.generateRowId();
							const lines = feature.trim().split('\n');
							const name = lines[0].split('•')[0].trim();
							const description = lines.slice(1).join('\n').trim() || feature;

							attrs.add(`repeating_traits_${rowId}_name`, name);
							attrs.add(`repeating_traits_${rowId}_description`, description);
							attrs.add(`repeating_traits_${rowId}_source`, sectionName);
						}
					});
				}
			}
		}

		// Set ability save DC if present
		if (characterData.abilitySaveDC) {
			attrs.add("spell_save_dc", characterData.abilitySaveDC);
		}

		// Notify sheet workers of changes
		attrs.notifySheetWorkers();

		console.log("Character imported successfully:", character);
		return character;
	};

	/**
	 * Import equipment and weapons from D&D Beyond using the 5etools item database
	 */
	d20plus.importer.importDnDBeyondItems = async function(character, itemsToImport, weaponsToImport) {
		if ((!itemsToImport || itemsToImport.length === 0) && (!weaponsToImport || weaponsToImport.length === 0)) {
			return;
		}

		try {
			// Load the item database
			console.log("Loading item database...");
			const itemList = await Renderer.item.pBuildList();

			if (!itemList || itemList.length === 0) {
				console.error("Failed to load item database");
				return;
			}

			console.log(`Loaded ${itemList.length} items from database`);

			// Create a map for quick lookup (case-insensitive)
			const itemMap = new Map();
			itemList.forEach(item => {
				const key = item.name.toLowerCase().trim();
				itemMap.set(key, item);
			});

			let importedCount = 0;
			let fallbackCount = 0;
			const notFoundItems = [];

			// Import weapons first
			if (weaponsToImport && weaponsToImport.length > 0) {
				for (const pdfWeapon of weaponsToImport) {
					const weaponName = pdfWeapon.name.trim();
					const weaponKey = weaponName.toLowerCase();
					const item5e = itemMap.get(weaponKey);

					const rowId = d20plus.ut.generateRowId();

					// Set weapon name and attack bonus from PDF
					character.attribs.create({name: `repeating_attack_${rowId}_atkname`, current: weaponName});
					character.attribs.create({name: `repeating_attack_${rowId}_atkbonus`, current: pdfWeapon.bonus || '+0'});

					// Parse damage: "1d10+3" -> base: "1d10", bonus implicit in ability mod
					// Extract just the dice part (before +/-)
					const damageStr = pdfWeapon.damage || '1d4';
					const diceMatch = damageStr.match(/^(\d+d\d+)/);
					const baseDice = diceMatch ? diceMatch[1] : damageStr;

					character.attribs.create({name: `repeating_attack_${rowId}_dmgbase`, current: baseDice});
					character.attribs.create({name: `repeating_attack_${rowId}_dmgflag`, current: "{{damage=1}} {{dmg1flag=1}}"});

					// Default ability modifier based on weapon name (fallback if not in database)
					let dmgAttr = "0";
					// Extract the bonus from PDF damage string to determine ability
					const bonusMatch = damageStr.match(/([+-]\d+)/);
					if (bonusMatch) {
						const bonus = parseInt(bonusMatch[1]);

						// Get ability scores from character attributes
						const getDexScore = () => {
							const attr = character.attribs.models.find(a => a.get('name') === 'dexterity');
							return attr ? parseInt(attr.get('current')) : 10;
						};
						const getStrScore = () => {
							const attr = character.attribs.models.find(a => a.get('name') === 'strength');
							return attr ? parseInt(attr.get('current')) : 10;
						};

						const dexScore = getDexScore();
						const strScore = getStrScore();

						// Calculate ability modifiers from scores
						const calcMod = (score) => Math.floor((score - 10) / 2);
						const dexMod = calcMod(dexScore);
						const strMod = calcMod(strScore);

						// If bonus matches DEX mod, use DEX; otherwise check STR
						if (bonus === dexMod) {
							dmgAttr = "@{dexterity_mod}";
						} else if (bonus === strMod) {
							dmgAttr = "@{strength_mod}";
						} else {
							// Default to STR if bonus doesn't match either modifier
							dmgAttr = "@{strength_mod}";
						}
					}

					// If found in database, get damage type and other properties
					if (item5e) {
						const [, gmnotes] = d20plus.items._getHandoutData(item5e);
						const r20json = JSON.parse(gmnotes);

						// Set damage type from 5etools
						if (item5e.dmgType) {
							const dmgTypeMap = {
								'P': 'Piercing',
								'S': 'Slashing',
								'B': 'Bludgeoning'
							};
							const dmgType = dmgTypeMap[item5e.dmgType] || item5e.dmgType;
							character.attribs.create({name: `repeating_attack_${rowId}_dmgtype`, current: dmgType});
						}

						// Determine ability modifier for damage from database properties
						// Finesse weapons can use DEX or STR, others usually use STR for melee, DEX for ranged
						if (item5e.property) {
							const hasFinesse = item5e.property.includes("F");
							const isRanged = item5e.property.includes("T") || item5e.property.includes("A");

							if (hasFinesse) {
								dmgAttr = "@{dexterity_mod}"; // Finesse weapons typically use DEX
							} else if (isRanged) {
								dmgAttr = "@{dexterity_mod}";
							} else {
								dmgAttr = "@{strength_mod}";
							}
						}

						// Build description with properties
						let description = r20json.content || '';
						if (item5e.property) {
							const props = item5e.property.map(p => {
								const propData = Renderer.item.getProperty(p);
								return propData ? propData.name : p;
							}).join(", ");
							if (props) {
								description = description ? `${description}\n\nProperties: ${props}` : `Properties: ${props}`;
							}
						}

						if (description) {
							character.attribs.create({name: `repeating_attack_${rowId}_atkdesc`, current: description});
						}
					} else {
						console.warn(`Weapon not found in database, using PDF data only: ${weaponName}`);
						notFoundItems.push(weaponName);
						fallbackCount++;
					}

					// Set damage ability modifier (uses fallback determined above)
					character.attribs.create({name: `repeating_attack_${rowId}_dmgattr`, current: dmgAttr});

					importedCount++;
				}
			}

			// Import equipment
			if (itemsToImport && itemsToImport.length > 0) {
				for (const pdfItem of itemsToImport) {
					const itemName = pdfItem.name.trim();
					const itemKey = itemName.toLowerCase();
					const item5e = itemMap.get(itemKey);

					const rowId = d20plus.ut.generateRowId();

					if (!item5e) {
						// Fall back to PDF data
						console.warn(`Item not found in database, using PDF data: ${itemName}`);
						notFoundItems.push(itemName);
						fallbackCount++;

						character.attribs.create({name: `repeating_inventory_${rowId}_itemname`, current: itemName});
						character.attribs.create({name: `repeating_inventory_${rowId}_itemcount`, current: pdfItem.quantity || '1'});
						if (pdfItem.weight) {
							character.attribs.create({name: `repeating_inventory_${rowId}_itemweight`, current: pdfItem.weight});
						}
					} else {
						// Use 5etools data
						const [, gmnotes] = d20plus.items._getHandoutData(item5e);
						const r20json = JSON.parse(gmnotes);

						character.attribs.create({name: `repeating_inventory_${rowId}_itemname`, current: item5e.name});
						character.attribs.create({name: `repeating_inventory_${rowId}_itemcount`, current: pdfItem.quantity || '1'});
						if (item5e.weight) {
							character.attribs.create({name: `repeating_inventory_${rowId}_itemweight`, current: String(item5e.weight)});
						}
						if (r20json.content) {
							character.attribs.create({name: `repeating_inventory_${rowId}_itemcontent`, current: r20json.content});
						}
					}

					importedCount++;
				}
			}

			console.log(`D&D Beyond item import complete: ${importedCount} imported${fallbackCount > 0 ? ` (${fallbackCount} using PDF data)` : ''}`);
			if (notFoundItems.length > 0) {
				console.log("Items not found in database:", notFoundItems.join(", "));
			}

		} catch (error) {
			console.error("Error importing D&D Beyond items:", error);
		}
	};

	/**
	 * Import spells from D&D Beyond using the 5etools spell database
	 */
	d20plus.importer.importDnDBeyondSpells = async function(character, spellsToImport) {
		if (!spellsToImport || spellsToImport.length === 0) return;

		try {
			// Load the spell database
			console.log("Loading spell database...");
			const spellData = await DataUtil.spell.loadJSON();

			if (!spellData || !spellData.spell) {
				console.error("Failed to load spell database");
				return;
			}

			console.log(`Loaded ${spellData.spell.length} spells from database`);

			// Create a map for quick lookup (case-insensitive)
			const spellMap = new Map();
			spellData.spell.forEach(spell => {
				const key = spell.name.toLowerCase().trim();
				spellMap.set(key, spell);
			});

			// Import each spell
			let importedCount = 0;
			let fallbackCount = 0;
			const notFoundSpells = [];

			for (const pdfSpell of spellsToImport) {
				const spellName = pdfSpell.name.trim();
				const level = pdfSpell.level; // Roll20 uses 'cantrip', '1', '2', etc.

				// Try to find spell in database, stripping common suffixes like [R] for Ritual
				let spellKey = spellName.toLowerCase();
				let spell5e = spellMap.get(spellKey);

				// If not found, try stripping ritual/concentration markers
				if (!spell5e) {
					const cleanedName = spellName.replace(/\s*\[R]\s*$/i, '').replace(/\s*\[C]\s*$/i, '').trim();
					spellKey = cleanedName.toLowerCase();
					spell5e = spellMap.get(spellKey);
				}

				const rowId = d20plus.ut.generateRowId();

				if (!spell5e) {
					// Fall back to PDF data
					console.warn(`Spell not found in database, using PDF data: ${spellName}`);
					notFoundSpells.push(spellName);
					fallbackCount++;

					character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellname`, current: spellName});
					if (pdfSpell.castingTime) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellcastingtime`, current: pdfSpell.castingTime});
					}
					if (pdfSpell.range) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellrange`, current: pdfSpell.range});
					}
					if (pdfSpell.components) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellcomp`, current: pdfSpell.components});
					}
					if (pdfSpell.duration) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellduration`, current: pdfSpell.duration});
					}
					if (pdfSpell.notes) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spelldescription`, current: pdfSpell.notes});
					}
					if (pdfSpell.prepared) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellprepared`, current: "1"});
					}
				} else {
					// Use 5etools data
					const [, gmnotes] = d20plus.spells._getHandoutData(spell5e);
					const r20json = JSON.parse(gmnotes);

					character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellname`, current: spell5e.name});

					if (r20json.data["Casting Time"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellcastingtime`, current: r20json.data["Casting Time"]});
					}
					if (r20json.data["Range"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellrange`, current: r20json.data["Range"]});
					}
					if (r20json.data["Components"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellcomp`, current: r20json.data["Components"]});
					}
					if (r20json.data["Duration"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellduration`, current: r20json.data["Duration"]});
					}
					if (r20json.data["School"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellschool`, current: r20json.data["School"]});
					}
					if (r20json.content) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spelldescription`, current: r20json.content});
					}
					if (r20json.data["Ritual"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellritual`, current: "Yes"});
					}
					if (r20json.data["Concentration"]) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellconcentration`, current: "Yes"});
					}
					if (pdfSpell.prepared) {
						character.attribs.create({name: `repeating_spell-${level}_${rowId}_spellprepared`, current: "1"});
					}
				}

				importedCount++;
			}

			console.log(`D&D Beyond spell import complete: ${importedCount} imported${fallbackCount > 0 ? ` (${fallbackCount} using PDF data)` : ''}`);
			if (notFoundSpells.length > 0) {
				console.log("Spells not found in database:", notFoundSpells.join(", "));
			}

		} catch (error) {
			console.error("Error importing D&D Beyond spells:", error);
		}
	};
}

SCRIPT_EXTENSIONS.push(d20plusImporter);