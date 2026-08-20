function d20plusNpcConverter () {
	d20plus.npcConverter = {};

	(() => {
		const ATTRIBUTES_2014_CORE = ["npc"];
		const ATTRIBUTES_2014_EXPECTED = ["npc_name", "npc_type", "npc_ac", "npc_hpbase", "npc_challenge"];
		const CONVERTER_META_ATTR = "b20_converter_meta";
		const CONVERTER_RECONCILE_DELAY_MS = 2500;

		// "Convert to 2024 Copy" means 2024, unconditionally - it must NOT defer to the global
		// Import Sheet Format config the way Overwrite JSON does, since that config might be
		// sitting on a 2014 sheet for an unrelated reason (e.g. someone was just testing a 2014
		// import) and silently converting "to 2024" into a 2014 copy would be exactly backwards
		// from what the button promises. Prefer whatever 2024 sheet key is actually available in
		// this campaign; only fall back to the config value if it already happens to be a 2024 key.
		function getForced2024SheetKey () {
			try {
				const sheetsObj = d20.journal.characterSheetsManager?.sheets || {};
				const found = Object.keys(sheetsObj).find(k => d20plus.import2024.IS_2024_SHEET.has(k));
				if (found) return found;
			} catch (e) { /* fall through to config */ }
			const configured = d20plus.cfg.getOrDefault("import", "importSheetFormat");
			return d20plus.import2024.IS_2024_SHEET.has(configured) ? configured : null;
		}

		function getConverterCharacterFromEvent (event) {
			const $target = $(event.target);
			const $characterRoot = $target.closest(`[data-characterid]`);
			const $fallbackRoot = $characterRoot.length ? $characterRoot : $(event.currentTarget).closest(`[data-characterid]`);
			const cId = $fallbackRoot.attr("data-characterid");
			if (!cId && d20plus.journal?.lastClickedJournalItemId) return d20.Campaign.characters.get(d20plus.journal.lastClickedJournalItemId);
			if (!cId) return null;
			return d20.Campaign.characters.get(cId);
		}

		function getConverterCharacterFromJournalContext () {
			const cId = d20plus.journal?.lastClickedJournalItemId;
			if (!cId) return null;
			return d20.Campaign.characters.get(cId);
		}

		function canConvertCharacter (character) {
			if (!character) {
				console.log("betterR20 NPC converter canConvertCharacter: false (no character)");
				return false;
			}
			const isNpc = isNpc2014Sheet(character);
			const isPc = !isNpc && isPc2014Sheet(character);
			const is2024 = d20plus.import2024.isNpc2024Sheet(character);
			const hasNpcTranslator = !!d20plus.importer?.translateOGLTo2024Store;
			const hasPcTranslator = !!d20plus.importer?.translatePcOGLTo2024Store;
			const ok = (isNpc || isPc) && !is2024 && (isNpc ? hasNpcTranslator : hasPcTranslator);
			console.log(`betterR20 NPC converter canConvertCharacter("${character.get("name") || "?"}"): isNpc=${isNpc}, isPc=${isPc}, is2024=${is2024}, result=${ok}`);
			return ok;
		}

		// A PC sheet has no npc="1" flag, but does have flat ability scores plus a class/race/level
		// field - distinctive enough to tell it apart from a blank or unrelated character sheet.
		function isPc2014Sheet (character) {
			const attrMap = getConverterAttrMap(character);
			if (`${attrMap.npc || ""}` === "1") return false;
			const hasAbilityScores = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
				.every(name => attrMap[name] !== undefined);
			const hasClassOrRace = attrMap.class !== undefined || attrMap.race !== undefined || attrMap.level !== undefined;
			return hasAbilityScores && hasClassOrRace;
		}

		function getConverterAttrMap (character) {
			const map = {};
			(character.attribs?.toJSON?.() || []).forEach(attr => {
				map[attr.name] = attr.current;
			});
			return map;
		}

		function isNpc2014Sheet (character) {
			const attrMap = getConverterAttrMap(character);
			const hasCoreNpcFlag = ATTRIBUTES_2014_CORE.every(name => `${attrMap[name] || ""}` === "1");
			if (!hasCoreNpcFlag) {
				console.log(`betterR20 NPC converter isNpc2014Sheet("${character?.get?.("name") || "?"}"): false (npc flag missing)`, { npc: attrMap.npc });
				return false;
			}

			const expectedCount = ATTRIBUTES_2014_EXPECTED
				.map(name => attrMap[name] !== undefined)
				.filter(Boolean)
				.length;

			const hasNpcRepeatingContent = Object.keys(attrMap).some(name =>
				name.startsWith("repeating_npcaction_")
				|| name.startsWith("repeating_npctrait_")
				|| name.startsWith("repeating_npcreaction_")
				|| name.startsWith("repeating_npcaction-l_")
				|| name.startsWith("repeating_npcaction-m_"),
			);

			// Accept sparse legacy NPCs (e.g. simple/commoner-like sheets) as long as
			// they carry the legacy NPC flag and at least minimal NPC identity fields.
			const hasMinimalLegacyNpcShape = attrMap.npc_name !== undefined
				|| attrMap.npc_challenge !== undefined
				|| attrMap.npc_type !== undefined;

			const result = expectedCount >= 3 || hasNpcRepeatingContent || hasMinimalLegacyNpcShape;
			console.log(`betterR20 NPC converter isNpc2014Sheet("${character?.get?.("name") || "?"}"): expectedCount=${expectedCount}, repeating=${hasNpcRepeatingContent}, minimal=${hasMinimalLegacyNpcShape}, result=${result}`);
			return result;
		}

		function getCharacterFolderContext (character) {
			return d20plus.import2024.getCharacterFolderContext(character);
		}

		function copyBioAndNotes (sourceCharacter, targetCharacter) {
			return d20plus.import2024.copyBioAndNotes(sourceCharacter, targetCharacter);
		}

		function getConvertedName (character) {
			const name = character.get("name") || "Unnamed character";
			return `${name} (2024)`;
		}

		function buildConverterTags (sourceAttrMap) {
			const tags = [
				"converted 2014 to 2024",
				"sheet 2024 npc",
				"legacy 2014 npc source",
			];
			const cr = sourceAttrMap?.npc_challenge;
			if (cr != null && `${cr}`.trim() !== "") tags.push(`cr ${`${cr}`.trim().replace(/\//g, " over ")}`);
			return d20plus.importer.getTagString(tags, "creature");
		}

		function persistConverterTags (character, tags) {
			const run = (label) => {
				character.save({tags, tags_string: tags});
				const live = character.get("tags");
				console.log(`betterR20 NPC converter tags persist [${label}]: requested="${tags}", live="${live || ""}"`);
			};
			run("immediate");
			setTimeout(() => run("500ms"), 500);
			setTimeout(() => run("1500ms"), 1500);
		}

		function cloneForDebug (value) { return d20plus.import2024.cloneForDebug(value); }
		function logDebugJson (label, value) { return d20plus.import2024.logDebugJson(label, value); }

		function save2024NpcState (character, store) {
			return d20plus.import2024.saveNewNpcState(character, store);
		}

		function saveConverterMeta (character, sourceCharacter) {
			const toDestroy = character.attribs.filter(a => a.get("name") === CONVERTER_META_ATTR);
			toDestroy.forEach(a => a.destroy());
			const meta = {
				sourceCharacterId: sourceCharacter?.id || null,
				sourceCharacterName: sourceCharacter?.get?.("name") || null,
				convertedAt: Date.now(),
				feature: "npc-converter-2014-to-2024",
			};
			character.attribs.push({name: CONVERTER_META_ATTR, current: JSON.stringify(meta)}).syncedSave();
		}

		function normalizeConverterStoreFields (store, sourceAttrMap) {
			if (!store || !store.npc) return;
			if (!store.npc.challengeRating) {
				const cr = sourceAttrMap?.npc_challenge;
				if (cr != null && `${cr}`.trim()) store.npc.challengeRating = `${cr}`.trim();
			}
		}

		function getConverterPbFromStore (store) {
			const ints = store?.integrants?.integrants;
			if (!ints) return null;
			for (const int of Object.values(ints)) {
				if (!int || int.type !== "Proficiency Bonus Modifier") continue;
				if (int.calculation !== "Set Value") continue;
				const v = int?.valueFormula?.flatValue;
				if (v == null || v === "") continue;
				return v;
			}
			return null;
		}

		function writeConverterDisplayStats (character, store, sourceAttrMap) {
			const pb = getConverterPbFromStore(store);
			const cr = store?.npc?.challengeRating || sourceAttrMap?.npc_challenge || null;
			d20plus.import2024.writeSidekickStats(character, pb, cr);
		}

		async function waitAndReconcileConvertedState (character, store, sourceAttrMap) {
			await new Promise(resolve => setTimeout(resolve, CONVERTER_RECONCILE_DELAY_MS));
			await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
			const {store: currentStore} = d20plus.import2024.getStore(character) || {};
			if (!currentStore || !currentStore.npc || !currentStore.npc.challengeRating) {
				console.log("betterR20 NPC converter: reconciling store after init race");
				save2024NpcState(character, store);
			}
			writeConverterDisplayStats(character, store, sourceAttrMap);
		}

		function save2024NpcNames (character, sourceAttrMap) {
			const npcDisplayName = sourceAttrMap.npc_name || character.get("name") || "Unnamed character";
			return d20plus.import2024.saveNpcNames(character, npcDisplayName);
		}

		async function convertCharacter (character) {
			character.attribs.fetch(character.attribs);

			const isNpc = isNpc2014Sheet(character);
			const isPc = !isNpc && isPc2014Sheet(character);
			if (!isNpc && !isPc) throw new Error("The selected character is not a compatible 2014 character sheet.");
			if (d20plus.import2024.isNpc2024Sheet(character)) throw new Error("The selected character already appears to be a 2024 sheet.");
			if (isNpc && !d20plus.importer?.translateOGLTo2024Store) throw new Error("2024 NPC import support is not available.");
			if (isPc && !d20plus.importer?.translatePcOGLTo2024Store) throw new Error("2024 PC import support is not available.");
			const targetSheetKey = getForced2024SheetKey();
			if (!targetSheetKey) throw new Error("No 2024 sheet is available in this campaign to convert to.");

			const sourceAttribs = character.attribs.toJSON();
			const sourceAttrMap = getConverterAttrMap(character);
			window.__npcConverterLastSourceAttribs = cloneForDebug(sourceAttribs);
			logDebugJson("betterR20 NPC converter source attribs", window.__npcConverterLastSourceAttribs);

			// NPCs: translateOGLTo2024Store builds the whole store synchronously up front (no
			// character needed yet), then we write it onto the freshly-created character below.
			// PCs: translatePcOGLTo2024Store instead needs a real, already-created character to
			// write into directly (it interleaves several import2024* store round-trips), so it
			// runs inside the create() success callback instead.
			let npcStore = null;
			if (isNpc) {
				npcStore = d20plus.importer.translateOGLTo2024Store(sourceAttribs);
				normalizeConverterStoreFields(npcStore, sourceAttrMap);
				window.__npcConverterLastStore = cloneForDebug(npcStore);
				logDebugJson("betterR20 NPC converter translated 2024 store", window.__npcConverterLastStore);
			}

			const sourceAttributes = {...character.attributes};
			delete sourceAttributes.id;
			const converterTags = buildConverterTags(sourceAttrMap);

			return new Promise((resolve, reject) => {
				d20.Campaign.characters.create({
					...sourceAttributes,
					name: getConvertedName(character),
					charactersheetname: targetSheetKey,
					inplayerjournals: sourceAttributes.inplayerjournals || "",
					controlledby: sourceAttributes.controlledby || "",
					tags: converterTags,
					tags_string: converterTags,
				}, {
					success: async (newCharacter) => {
						try {
							if (isNpc && d20plus.importer._setDefaultTokenImage) {
								await d20plus.importer._setDefaultTokenImage(
									newCharacter,
									{
										id: newCharacter.id,
										name: newCharacter.get("name"),
										senses: sourceAttrMap.npc_senses || "",
									},
									sourceAttributes.avatar || "",
								);
							}

							if (isNpc) {
								save2024NpcState(newCharacter, npcStore);
								save2024NpcNames(newCharacter, sourceAttrMap);
								writeConverterDisplayStats(newCharacter, npcStore, sourceAttrMap);
							} else {
								const pcSummary = await d20plus.importer.translatePcOGLTo2024Store(newCharacter, sourceAttribs);
								logDebugJson("betterR20 NPC converter PC conversion summary", pcSummary);
							}
							persistConverterTags(newCharacter, converterTags);
							saveConverterMeta(newCharacter, character);
							window.__npcConverterLastCharacter = cloneForDebug(newCharacter?.attributes || newCharacter);
							logDebugJson("betterR20 NPC converter created character", window.__npcConverterLastCharacter);

							await copyBioAndNotes(character, newCharacter);

							const folderContext = getCharacterFolderContext(character);
							if (folderContext?.folderId) d20.journal.addItemToFolderStructure(newCharacter.id, folderContext.folderId);

							if (newCharacter.view && typeof newCharacter.view.showNewVueFrame === "function") newCharacter.view.showNewVueFrame();
							if (isNpc) {
								await waitAndReconcileConvertedState(newCharacter, npcStore, sourceAttrMap);
								persistConverterTags(newCharacter, converterTags);
							}
							resolve(newCharacter);
						} catch (e) {
							reject(e);
						}
					},
					error: reject,
				});
			});
		}

		d20plus.npcConverter.convertSelectedCharacter = async (event) => {
			const character = getConverterCharacterFromEvent(event);
			if (!character) return alert("No character found.");

			const charName = character.get("name") || "Unnamed character";
			if (!window.confirm(`Create a new 2024 copy of "${charName}"?`)) return;

			try {
				const converted = await convertCharacter(character);
				alert(`Created "${converted.get("name")}" as a new 2024 character.`);
			} catch (e) {
				console.error("betterR20 NPC converter error:", e);
				alert(`Failed to convert "${charName}" to 2024. See the console for details.`);
			}
		};

		d20plus.npcConverter.initCharacterConverterButtons = () => {
			$(document)
				.off("click", ".character-npc-convert-2024")
				.on("click", ".character-npc-convert-2024", d20plus.npcConverter.convertSelectedCharacter);

			const injectJournalContextButton = () => {
				const $menu = $("#journalitemmenu ul");
				if (!$menu.length) return;
				$menu.find(".Vetools-convert-npc-2024").remove();

				const $duplicate = $menu.find(`li:contains("Duplicate File")`).first();
				const $entry = $(`<li class="Vetools-convert-npc-2024" data-action-type="convertnpc2024">Convert to 2024 Copy</li>`);
				if ($duplicate.length) $duplicate.after($entry);
				else $menu.append($entry);
			};

			// Same show/hide-on-right-click pattern base-journal.js already uses for
			// .Vetools-make-tokenactions / .b20-change-avatar - toggles the menu entry based on
			// whichever journal item was actually right-clicked, before the menu is shown. Only
			// checks charactersheetname (a plain top-level model field, always available - no
			// attribs fetch needed) - the full NPC-vs-PC-vs-incompatible check still runs for real
			// at click time via canConvertCharacter, this is just "is it already 2024 or not".
			$("#journalfolderroot").on("contextmenu", ".dd-content", function () {
				const $itemHandle = $(this).parent();
				const $entry = $(".Vetools-convert-npc-2024");
				if (!$itemHandle.hasClass("character")) return $entry.hide();
				const character = d20.Campaign.characters.get($itemHandle.data("itemid"));
				const already2024 = character && d20plus.import2024.IS_2024_SHEET.has(character.get("charactersheetname"));
				if (already2024) $entry.hide();
				else $entry.show();
			});

			$("#journalitemmenu ul")
				.off(window.mousedowntype, "li[data-action-type=convertnpc2024]")
				.on(window.mousedowntype, "li[data-action-type=convertnpc2024]", async function () {
					$("#journalitemmenu").hide();
					const character = getConverterCharacterFromJournalContext();
					if (!character) return alert("No character found.");
					await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
					if (!canConvertCharacter(character)) return alert("The selected character is not a compatible 2014 character sheet (NPC or PC).");

					const charName = character.get("name") || "Unnamed character";
					if (!window.confirm(`Create a new 2024 copy of "${charName}"?`)) return;

					try {
						const converted = await convertCharacter(character);
						alert(`Created "${converted.get("name")}" as a new 2024 character.`);
					} catch (e) {
						console.error("betterR20 NPC converter error:", e);
						alert(`Failed to convert "${charName}" to 2024. See the console for details.`);
					}
				});

			injectJournalContextButton();
		};
	})();
}

SCRIPT_EXTENSIONS.push(d20plusNpcConverter);
