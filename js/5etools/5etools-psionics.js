function d20plusPsionics () {
	d20plus.psionics = {};

	d20plus.psionics._groupOptions = ["Alphabetical", "Order", "Source"];
	d20plus.psionics._listCols = ["name", "order", "source"];
	d20plus.psionics._listItemBuilder = (it) => `
		<span class="name col-6">${it.name}</span>
		<span class="order col-4">ORD[${it.order || "None"}]</span>
		<span title="${Parser.sourceJsonToFull(it.source)}" class="source col-2">SRC[${Parser.sourceJsonToAbv(it.source)}]</span>`;
	d20plus.psionics._listIndexConverter = (p) => {
		return {
			name: p.name.toLowerCase(),
			order: (p.order || "none").toLowerCase(),
			source: Parser.sourceJsonToAbv(p.source).toLowerCase(),
		};
	};
	// Import Psionics button was clicked
	d20plus.psionics.button = function (forcePlayer) {
		const playerMode = forcePlayer || !window.is_gm;
		const url = playerMode ? $("#import-psionics-url-player").val() : $("#import-psionics-url").val();
		if (url && url.trim()) {
			const handoutBuilder = playerMode ? d20plus.psionics.playerImportBuilder : d20plus.psionics.handoutBuilder;

			DataUtil.loadJSON(url).then(async (data) => {
				await d20plus.importer.pAddBrew(url);
				await d20plus.importer.showImportList(
					"psionic",
					data.psionic,
					handoutBuilder,
					{
						groupOptions: d20plus.psionics._groupOptions,
						forcePlayer,
						listItemBuilder: d20plus.psionics._listItemBuilder,
						listIndex: d20plus.psionics._listCols,
						listIndexConverter: d20plus.psionics._listIndexConverter,
					},
				);
			});
		}
	};

	d20plus.psionics.handoutBuilder = function (data, overwrite, inJournals, folderName, saveIdsTo, options) {
		// make dir
		const folder = d20plus.journal.makeDirTree(`Psionics`, folderName);
		const path = ["Psionics", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = data.name;
		d20.Campaign.handouts.create({
			name: name,
			tags: d20plus.importer.getTagString([
				Parser.psiTypeToFull(data.type),
				data.order || "orderless",
				Parser.sourceJsonToFull(data.source),
			], "psionic"),
		}, {
			success: function (handout) {
				if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_PSIONICS](data)] = {name: data.name, source: data.source, type: "handout", roll20Id: handout.id};

				const [noteContents, gmNotes] = d20plus.psionics._getHandoutData(data);

				handout.updateBlobs({notes: noteContents, gmnotes: gmNotes});
				handout.save({notes: (new Date()).getTime(), inplayerjournals: inJournals});
				d20.journal.addItemToFolderStructure(handout.id, folder.id);
			},
		});
	};

	d20plus.psionics.playerImportBuilder = function (data) {
		const [notecontents, gmnotes] = d20plus.psionics._getHandoutData(data);

		const importId = d20plus.ut.generateRowId();
		d20plus.importer.storePlayerImport(importId, JSON.parse(gmnotes));
		d20plus.importer.makePlayerDraggable(importId, data.name);
	};

	d20plus.psionics._getHandoutData = function (data) {
		function renderTalent () {
			const renderStack = [];
			renderer.recursiveRender(({entries: data.entries, type: "entries"}), renderStack);
			return renderStack.join(" ");
		}

		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);
		const r20json = {
			"name": data.name,
			"Vetoolscontent": data,
			"data": {
				"Category": "Psionics",
			},
		};
		const gmNotes = JSON.stringify(r20json);

		const baseNoteContents = `
			<h3>${data.name}</h3>
			<p><em>${data.type === "D" ? `${data.order} ${Parser.psiTypeToFull(data.type)}` : `${Parser.psiTypeToFull(data.type)}`}</em></p>
			${Renderer.psionic.getBodyHtml(data, renderer)}
			`;

		const noteContents = `${baseNoteContents}<br><del class="hidden">${gmNotes}</del>`;

		return [noteContents, gmNotes];
	};

	d20plus.psionics.importPsionicAbility = function (character, data) {
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);

		const attrs = new d20plus.importer.CharacterAttributesProxy(character);
		data = data.Vetoolscontent;
		if (!data) {
			alert("Missing data. Please re-import Psionics.");
			return;
		}

		function getCostStr (cost) {
			return cost.min === cost.max ? cost.min : `${cost.min}-${cost.max}`;
		}

		function getCleanText (entries) {
			if (typeof entries === "string") {
				return d20plus.importer.getCleanText(renderer.render(entries));
			} else {
				const renderStack = [];
				renderer.recursiveRender({entries: entries}, renderStack, {depth: 2});
				return d20plus.importer.getCleanText(renderStack.join(""));
			}
		}

		if (d20plus.sheet === "ogl") {
			const makeSpellTrait = function (level, rowId, propName, content) {
				const attrName = `repeating_spell-${level}_${rowId}_${propName}`;
				attrs.add(attrName, content);
			}

			// disable all components
			const noComponents = function (level, rowId, hasM) {
				makeSpellTrait(level, rowId, "spellcomp_v", 0);
				makeSpellTrait(level, rowId, "spellcomp_s", 0);
				if (!hasM) {
					makeSpellTrait(level, rowId, "spellcomp_m", 0);
				}
				makeSpellTrait(level, rowId, "options-flag", 0);
			}

			if (data.type === "D") {
				const rowId = d20plus.ut.generateRowId();

				// make focus
				const focusLevel = "cantrip";
				makeSpellTrait(focusLevel, rowId, "spelllevel", "cantrip");
				makeSpellTrait(focusLevel, rowId, "spellname", `${data.name} Focus`);
				makeSpellTrait(focusLevel, rowId, "spelldescription", getCleanText(data.focus));
				makeSpellTrait(focusLevel, rowId, "spellcastingtime", "1 bonus action");
				noComponents(focusLevel, rowId);

				data.modes.forEach(m => {
					if (m.submodes) {
						m.submodes.forEach(sm => {
							const rowId = d20plus.ut.generateRowId();
							const smLevel = sm.cost.min;
							makeSpellTrait(smLevel, rowId, "spelllevel", smLevel);
							makeSpellTrait(smLevel, rowId, "spellname", `${m.name} (${sm.name})`);
							makeSpellTrait(smLevel, rowId, "spelldescription", getCleanText(sm.entries));
							makeSpellTrait(smLevel, rowId, "spellcomp_materials", `${getCostStr(sm.cost)} psi points`);
							noComponents(smLevel, rowId, true);
						});
					} else {
						const rowId = d20plus.ut.generateRowId();
						const mLevel = m.cost.min;
						makeSpellTrait(mLevel, rowId, "spelllevel", mLevel);
						makeSpellTrait(mLevel, rowId, "spellname", `${m.name}`);
						makeSpellTrait(mLevel, rowId, "spelldescription", `Psionic Discipline mode\n\n${getCleanText(m.entries)}`);
						makeSpellTrait(mLevel, rowId, "spellcomp_materials", `${getCostStr(m.cost)} psi points`);
						if (m.concentration) {
							makeSpellTrait(mLevel, rowId, "spellduration", `${m.concentration.duration} ${m.concentration.unit}`);
							makeSpellTrait(mLevel, rowId, "spellconcentration", "Yes");
						}
						noComponents(mLevel, rowId, true);
					}
				});
			} else {
				const rowId = d20plus.ut.generateRowId();
				const level = "cantrip";
				makeSpellTrait(level, rowId, "spelllevel", "cantrip");
				makeSpellTrait(level, rowId, "spellname", data.name);
				makeSpellTrait(level, rowId, "spelldescription", `Psionic Talent\n\n${getCleanText(Renderer.psionic.getBodyHtml(data, renderer))}`);
				noComponents(level, rowId, false);
			}
		} else if (d20plus.sheet === "shaped") {
			const makeSpellTrait = function (level, rowId, propName, content) {
				const attrName = `repeating_spell${level}_${rowId}_${propName}`;
				attrs.add(attrName, content);
			}

			const shapedSpellLevel = function (level) {
				return level ? `${Parser.getOrdinalForm(String(level))}_LEVEL`.toUpperCase() : "CANTRIP";
			}

			const shapedConcentration = function (conc) {
				const CONC_ABV_TO_FULL = {
					rnd: "round",
					min: "minute",
					hr: "hour",
				};
				return `CONCENTRATION_UP_TO_${conc.duration}_${CONC_ABV_TO_FULL[conc.unit]}${conc.duration > 1 ? "S" : ""}`.toUpperCase();
			}

			const inferCastingTime = function (content) {
				if (content.search(/\b(as an action)\b/i) >= 0) {
					return "1_ACTION";
				} else if (content.search(/\b(as a bonus action)\b/i) >= 0) {
					return "1_BONUS_ACTION";
				} else if (content.search(/\b(as a reaction)\b/i) >= 0) {
					return "1_REACTION";
				}
				return "1_ACTION";
			}

			const inferDuration = function (content) {
				let duration, unit, match;
				if ((match = content.match(/\b(?:for the next|for 1) (round|minute|hour)\b/i))) {
					[duration, unit] = [1, match[1]];
				} else if ((match = content.match(/\b(?:for|for the next) (\d+) (minutes|hours|days)\b/i))) {
					[duration, unit] = [match[1], match[2]];
				}

				return (duration && unit) ? `${duration}_${unit}`.toUpperCase() : `INSTANTANEOUS`;
			}

			if (data.type === "D") {
				const typeStr = `**Psionic Discipline:** ${data.name}\n**Psionic Order:** ${data.order}\n`;
				const rowId = d20plus.ut.generateRowId();

				// make focus
				const focusLevel = 0;
				makeSpellTrait(focusLevel, rowId, "spell_level", shapedSpellLevel(focusLevel));
				makeSpellTrait(focusLevel, rowId, "name", `${data.name} Focus`);
				makeSpellTrait(focusLevel, rowId, "content", `${typeStr}\n${getCleanText(data.focus)}`);
				makeSpellTrait(focusLevel, rowId, "content_toggle", "1");
				makeSpellTrait(focusLevel, rowId, "casting_time", "1_BONUS_ACTION");
				makeSpellTrait(focusLevel, rowId, "components", "COMPONENTS_M");
				makeSpellTrait(focusLevel, rowId, "duration", "SPECIAL");

				data.modes.forEach(m => {
					const modeContent = `${typeStr}\n${getCleanText(m.entries)}`;

					if (m.submodes) {
						m.submodes.forEach(sm => {
							const rowId = d20plus.ut.generateRowId();
							const smLevel = sm.cost.min;
							const costStr = getCostStr(sm.cost);
							const content = `${modeContent}\n${getCleanText(sm.entries)}`;
							makeSpellTrait(smLevel, rowId, "spell_level", shapedSpellLevel(smLevel));
							makeSpellTrait(smLevel, rowId, "name", `${m.name} (${sm.name})${sm.cost.min < sm.cost.max ? ` (${costStr} psi)` : ""}`);
							makeSpellTrait(smLevel, rowId, "content", content);
							makeSpellTrait(smLevel, rowId, "content_toggle", "1");
							makeSpellTrait(smLevel, rowId, "casting_time", inferCastingTime(content));
							makeSpellTrait(smLevel, rowId, "materials", `${costStr} psi points`);
							makeSpellTrait(smLevel, rowId, "components", "COMPONENTS_M");
							makeSpellTrait(smLevel, rowId, "duration", inferDuration(content));
						});
					} else {
						const rowId = d20plus.ut.generateRowId();
						const mLevel = m.cost.min;
						const costStr = getCostStr(m.cost);
						makeSpellTrait(mLevel, rowId, "spell_level", shapedSpellLevel(mLevel));
						makeSpellTrait(mLevel, rowId, "name", m.name + (m.cost.min < m.cost.max ? ` (${costStr} psi)` : ""));
						makeSpellTrait(mLevel, rowId, "content", modeContent);
						makeSpellTrait(mLevel, rowId, "content_toggle", "1");
						makeSpellTrait(mLevel, rowId, "casting_time", inferCastingTime(modeContent));
						makeSpellTrait(mLevel, rowId, "materials", `${costStr} psi points`);
						makeSpellTrait(mLevel, rowId, "components", "COMPONENTS_M");
						if (m.concentration) {
							makeSpellTrait(mLevel, rowId, "duration", shapedConcentration(m.concentration));
							makeSpellTrait(mLevel, rowId, "concentration", "Yes");
						} else {
							makeSpellTrait(mLevel, rowId, "duration", inferDuration(modeContent));
						}
					}
				});
			} else {
				const typeStr = `**Psionic Talent**\n`;
				const talentContent = `${typeStr}\n${getCleanText(Renderer.psionic.getBodyHtml(data, renderer))}`;
				const rowId = d20plus.ut.generateRowId();
				const level = 0;
				makeSpellTrait(level, rowId, "spell_level", shapedSpellLevel(level));
				makeSpellTrait(level, rowId, "name", data.name);
				makeSpellTrait(level, rowId, "content", talentContent);
				makeSpellTrait(level, rowId, "content_toggle", "1");
				makeSpellTrait(level, rowId, "casting_time", inferCastingTime(talentContent));
				makeSpellTrait(level, rowId, "components", "COMPONENTS_M");
				makeSpellTrait(level, rowId, "duration", inferDuration(talentContent));
			}
		} else {
			// eslint-disable-next-line no-console
			console.warn(`Psionic ability import is not supported for ${d20plus.sheet} character sheet`);
		}

		attrs.notifySheetWorkers();
	};
}

SCRIPT_EXTENSIONS.push(d20plusPsionics);
