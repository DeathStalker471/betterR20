function d20plusNpcConverter () {
	d20plus.npcConverter = {};

	(() => {
		const ATTRIBUTES_2014_CORE = ["npc"];
		const ATTRIBUTES_2014_EXPECTED = ["npc_name", "npc_type", "npc_ac", "npc_hpbase", "npc_challenge"];
		const CONVERTER_META_ATTR = "b20_converter_meta";
		const CONVERTER_RECONCILE_DELAY_MS = 2500;

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
			if (!character) return false;
			if (!isNpc2014Sheet(character)) return false;
			if (d20plus.store2024.isNpc2024Sheet(character)) return false;
			return !!d20plus.importer?.translateOGLTo2024Store;
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
			if (!ATTRIBUTES_2014_CORE.every(name => `${attrMap[name] || ""}` === "1")) return false;

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

			return expectedCount >= 3 || hasNpcRepeatingContent || hasMinimalLegacyNpcShape;
		}

		function getCharacterFolderContext (character) {
			return d20plus.store2024.getCharacterFolderContext(character);
		}

		function copyBioAndNotes (sourceCharacter, targetCharacter) {
			return d20plus.store2024.copyBioAndNotes(sourceCharacter, targetCharacter);
		}

		function getConvertedName (character) {
			const name = character.get("name") || "Unnamed character";
			return `${name} (2024)`;
		}

		function cloneForDebug (value) { return d20plus.store2024.cloneForDebug(value); }
		function logDebugJson (label, value) { return d20plus.store2024.logDebugJson(label, value); }

		function save2024NpcState (character, store) {
			return d20plus.store2024.saveNewNpcState(character, store);
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
			d20plus.store2024.writeSidekickStats(character, pb, cr);
		}

		async function waitAndReconcileConvertedState (character, store, sourceAttrMap) {
			await new Promise(resolve => setTimeout(resolve, CONVERTER_RECONCILE_DELAY_MS));
			await new Promise(resolve => character.attribs.fetch({success: resolve, error: resolve}));
			const {store: currentStore} = d20plus.store2024.getStore(character) || {};
			if (!currentStore || !currentStore.npc || !currentStore.npc.challengeRating) {
				console.log("betterR20 NPC converter: reconciling store after init race");
				save2024NpcState(character, store);
			}
			writeConverterDisplayStats(character, store, sourceAttrMap);
		}

		function save2024NpcNames (character, sourceAttrMap) {
			const npcDisplayName = sourceAttrMap.npc_name || character.get("name") || "Unnamed character";
			return d20plus.store2024.saveNpcNames(character, npcDisplayName);
		}

		async function convertCharacter (character) {
			character.attribs.fetch(character.attribs);

			if (!isNpc2014Sheet(character)) throw new Error("The selected character is not a compatible 2014 NPC sheet.");
			if (d20plus.store2024.isNpc2024Sheet(character)) throw new Error("The selected character already appears to be a 2024 NPC sheet.");
			if (!d20plus.importer?.translateOGLTo2024Store) throw new Error("2024 import support is not available.");

			const store = d20plus.importer.translateOGLTo2024Store(character.attribs.toJSON());
			window.__npcConverterLastSourceAttribs = cloneForDebug(character.attribs.toJSON());
			window.__npcConverterLastStore = cloneForDebug(store);
			logDebugJson("betterR20 NPC converter source attribs", window.__npcConverterLastSourceAttribs);
			logDebugJson("betterR20 NPC converter translated 2024 store", window.__npcConverterLastStore);
			const sourceAttrMap = getConverterAttrMap(character);
			normalizeConverterStoreFields(store, sourceAttrMap);
			const sourceAttributes = {...character.attributes};
			delete sourceAttributes.id;

			return new Promise((resolve, reject) => {
				d20.Campaign.characters.create({
					...sourceAttributes,
					name: getConvertedName(character),
					charactersheetname: d20plus.cfg.getOrDefault("import", "importSheetFormat"),
					inplayerjournals: sourceAttributes.inplayerjournals || "",
					controlledby: sourceAttributes.controlledby || "",
					tags: sourceAttributes.tags || "",
				}, {
					success: async (newCharacter) => {
						try {
							if (d20plus.importer._setDefaultTokenImage) {
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

							save2024NpcState(newCharacter, store);
							save2024NpcNames(newCharacter, sourceAttrMap);
							saveConverterMeta(newCharacter, character);
							writeConverterDisplayStats(newCharacter, store, sourceAttrMap);
							window.__npcConverterLastCharacter = cloneForDebug(newCharacter?.attributes || newCharacter);
							logDebugJson("betterR20 NPC converter created character", window.__npcConverterLastCharacter);

							await copyBioAndNotes(character, newCharacter);

							const folderContext = getCharacterFolderContext(character);
							if (folderContext?.folderId) d20.journal.addItemToFolderStructure(newCharacter.id, folderContext.folderId);

							if (newCharacter.view && typeof newCharacter.view.showNewVueFrame === "function") newCharacter.view.showNewVueFrame();
							await waitAndReconcileConvertedState(newCharacter, store, sourceAttrMap);
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
			if (!window.confirm(`Create a new 2024 NPC copy of "${charName}"?`)) return;

			try {
				const converted = await convertCharacter(character);
				alert(`Created "${converted.get("name")}" as a new 2024 NPC.`);
			} catch (e) {
				console.error("betterR20 NPC converter error:", e);
				alert(`Failed to convert "${charName}" to a 2024 NPC. See the console for details.`);
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

			$("#journalitemmenu ul")
				.off(window.mousedowntype, "li[data-action-type=convertnpc2024]")
				.on(window.mousedowntype, "li[data-action-type=convertnpc2024]", async function () {
					$("#journalitemmenu").hide();
					const character = getConverterCharacterFromJournalContext();
					if (!character) return alert("No character found.");
					if (!canConvertCharacter(character)) return alert("The selected character is not a compatible 2014 NPC sheet.");

					const charName = character.get("name") || "Unnamed character";
					if (!window.confirm(`Create a new 2024 NPC copy of "${charName}"?`)) return;

					try {
						const converted = await convertCharacter(character);
						alert(`Created "${converted.get("name")}" as a new 2024 NPC.`);
					} catch (e) {
						console.error("betterR20 NPC converter error:", e);
						alert(`Failed to convert "${charName}" to a 2024 NPC. See the console for details.`);
					}
				});

			injectJournalContextButton();
		};
	})();
}

SCRIPT_EXTENSIONS.push(d20plusNpcConverter);
