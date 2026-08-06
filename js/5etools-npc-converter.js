function d20plusNpcConverter () {
	d20plus.npcConverter = {};

	(() => {
		const SHEET_2024 = new Set(["dnd_2024", "DnD2024_Character_Sheet", "dnd2024", "dnd2024byroll20"]);
		const ATTRIBUTES_2014_CORE = ["npc"];
		const ATTRIBUTES_2014_EXPECTED = ["npc_name", "npc_type", "npc_ac", "npc_hpbase", "npc_challenge"];

		function getConverterCharacterFromEvent (event) {
			const $target = $(event.target);
			const $characterRoot = $target.closest(`[data-characterid]`);
			const $fallbackRoot = $characterRoot.length ? $characterRoot : $(event.currentTarget).closest(`[data-characterid]`);
			const cId = $fallbackRoot.attr("data-characterid");
			if (!cId) return null;
			return d20.Campaign.characters.get(cId);
		}

		function getConverterBlobData (character, key) {
			return new Promise(resolve => character._getLatestBlob(key, data => resolve(data)));
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

			return expectedCount >= 3 || hasNpcRepeatingContent;
		}

		function isNpc2024Sheet (character) {
			const attrMap = getConverterAttrMap(character);
			if (`${attrMap.npc || ""}` !== "1") return false;
			return SHEET_2024.has(attrMap.rpg_sheet || attrMap.sheet_type || attrMap.charactersheet_type)
				|| !!attrMap.store;
		}

		function getTargetFolderId (character) {
			const root = d20plus.ut.getJournalFolderObj();
			const findFolderPath = (items, path = []) => {
				for (const item of (items || [])) {
					if (item.i === character.id) return path;
					if (item.n && item.i) {
						const found = findFolderPath(item.i, [...path, item.n]);
						if (found) return found;
					}
				}
				return null;
			};

			const path = findFolderPath(root);
			if (!path || !path.length) return null;

			try {
				const folder = d20plus.journal.makeDirTree(path);
				return folder && folder.id ? folder.id : null;
			} catch (e) {
				console.warn("betterR20 NPC converter: Failed to resolve folder path", e);
				return null;
			}
		}

		function copyBioAndNotes (sourceCharacter, targetCharacter) {
			return Promise.all([
				getConverterBlobData(sourceCharacter, "bio"),
				getConverterBlobData(sourceCharacter, "gmnotes"),
			]).then(([bio, gmnotes]) => {
				targetCharacter.updateBlobs({
					bio: bio || "",
					gmnotes: gmnotes || "",
				});
				targetCharacter.save({
					bio: (new Date()).getTime(),
					gmnotes: (new Date()).getTime(),
				});
			});
		}

		function getConvertedName (character) {
			const name = character.get("name") || "Unnamed character";
			return `${name} (2024)`;
		}

		function cloneForDebug (value) {
			try {
				return JSON.parse(JSON.stringify(value));
			} catch (e) {
				return {error: e?.message || String(e)};
			}
		}

		function logDebugJson (label, value) {
			console.log(`${label}\n${JSON.stringify(value, null, 2)}`);
		}

		function save2024NpcState (character, store) {
			const toSave = [
				{ name: "appState", current: "npc" },
				{ name: "store", current: store },
			].map(a => character.attribs.push(a));
			toSave.forEach(s => s.syncedSave());
		}

		async function convertCharacter (character) {
			character.attribs.fetch(character.attribs);

			if (!isNpc2014Sheet(character)) throw new Error("The selected character is not a compatible 2014 NPC sheet.");
			if (isNpc2024Sheet(character)) throw new Error("The selected character already appears to be a 2024 NPC sheet.");
			if (!d20plus.importer?.translateOGLTo2024Store) throw new Error("2024 import support is not available.");

			const store = d20plus.importer.translateOGLTo2024Store(character.attribs.toJSON());
			window.__npcConverterLastSourceAttribs = cloneForDebug(character.attribs.toJSON());
			window.__npcConverterLastStore = cloneForDebug(store);
			logDebugJson("betterR20 NPC converter source attribs", window.__npcConverterLastSourceAttribs);
			logDebugJson("betterR20 NPC converter translated 2024 store", window.__npcConverterLastStore);
			const sourceAttrMap = getConverterAttrMap(character);
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
							window.__npcConverterLastCharacter = cloneForDebug(newCharacter?.attributes || newCharacter);
							logDebugJson("betterR20 NPC converter created character", window.__npcConverterLastCharacter);

							await copyBioAndNotes(character, newCharacter);

							const folderId = getTargetFolderId(character);
							if (folderId) d20.journal.addItemToFolderStructure(newCharacter.id, folderId);

							if (newCharacter.view && typeof newCharacter.view.showNewVueFrame === "function") newCharacter.view.showNewVueFrame();
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

			const injectExportOverwriteButton = () => {
				$(".character-npc-convert-2024-vttes").remove();

				const $overwriteButton = $("button").filter((_, ele) => $(ele).text().trim() === "Overwrite").first();
				if (!$overwriteButton.length) return;

				const $column = $overwriteButton.closest("div");
				if (!$column.length) return;

				const $container = $(`
					<div class="character-npc-convert-2024-vttes" style="margin-top: 16px;">
						<h3>Convert to 2024</h3>
						<p>Create a new 2024 NPC Journal copy from this 2014 NPC sheet.</p>
						<button class="btn character-npc-convert-2024">Convert 2014 NPC to 2024 Copy</button>
					</div>
				`);

				$column.after($container);
			};

			injectExportOverwriteButton();
			setTimeout(injectExportOverwriteButton, 1000);
		};
	})();
}

SCRIPT_EXTENSIONS.push(d20plusNpcConverter);
