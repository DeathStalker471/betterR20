function baseCharacterIo () {
	d20plus.characterIo = {};

	const getCharacterFromEvent = (event) => {
		const $target = $(event.target);
		const $characterRoot = $target.closest(`[data-characterid]`);
		const $fallbackRoot = $characterRoot.length ? $characterRoot : $(event.currentTarget).closest(`[data-characterid]`);
		const cId = $fallbackRoot.attr(`data-characterid`);
		if (!cId) return null;
		return d20.Campaign.characters.get(cId);
	};

	const getBlobData = (character, key) => new Promise((resolve) => {
		character._getLatestBlob(key, (data) => resolve(data));
	});

	const sanitizeFilename = (name) => (name || "character").trim().replace(/[^-\w]/g, "_");

	const getImportEntry = (payload) => {
		if (payload && payload.character) return payload.character;
		if (payload && Array.isArray(payload.characters) && payload.characters.length) {
			if (payload.characters.length === 1) return payload.characters[0];
			const options = payload.characters
				.map((entry, i) => `${i + 1}: ${(entry.attributes && entry.attributes.name) || "Unnamed character"}`)
				.join("\n");
			const selection = window.prompt(`Multiple characters found. Enter a number to import:\n${options}`, "1");
			const index = Number(selection) - 1;
			if (!Number.isInteger(index) || index < 0 || index >= payload.characters.length) return null;
			return payload.characters[index];
		}
		return null;
	};

	const applyCharacterImport = async (character, entry) => {
		// entry.attribs is already 2024-format (a "store" attrib) if it was exported from a
		// 2024-sheet character — only flat (2014-style) attribs can be converted, and only
		// forward (2014 -> 2024). The target sheet is whatever the Import Sheet Format config
		// says, same as the Module Importer, not whatever the character happens to be on already.
		const attribs = Array.isArray(entry.attribs) ? entry.attribs : [];
		const hasStoreAttr = attribs.some(a => a.name === "store");
		const targetIs2024 = typeof d20plus.importer?.shouldUse2024 === "function" && d20plus.importer.shouldUse2024();
		const needsConversion = targetIs2024 && !hasStoreAttr;
		const isNpc = attribs.some(a => a.name === "npc" && String(a.current) === "1");

		if (needsConversion) {
			if (isNpc && typeof d20plus.importer?.translateOGLTo2024Store !== "function") return alert(`2024 sheet conversion isn't available.`);
			if (!isNpc && typeof d20plus.importer?.translatePcOGLTo2024Store !== "function") return alert(`2024 sheet conversion isn't available.`);
		} else if (!targetIs2024 && hasStoreAttr) {
			return alert(`This JSON is a 2024-sheet export (store format) — converting that down to a 2014 sheet isn't supported yet. Import Sheet Format is currently set to a 2014 sheet.`);
		}

		const safeAttributes = {...(entry.attributes || {})};
		const oldCharId = safeAttributes.id;
		delete safeAttributes.id;
		delete safeAttributes.inplayerjournals;
		delete safeAttributes.controlledby;
		if (typeof d20plus.cfg?.getOrDefault === "function") safeAttributes.charactersheetname = d20plus.cfg.getOrDefault("import", "importSheetFormat");
		character.set(safeAttributes);
		character.save();

		character.attribs.reset();
		let pcConversionSummary = null;
		if (needsConversion && isNpc) {
			const store2024 = d20plus.importer.translateOGLTo2024Store(attribs);
			const toSave = [
				{name: "appState", current: "npc"},
				{name: "store", current: store2024},
			].map(a => character.attribs.push(a));
			toSave.forEach(s => (s.syncedSave ? s.syncedSave() : s.save()));
		} else if (needsConversion) {
			// translatePcOGLTo2024Store manages its own character.attribs writes internally (it
			// interleaves several import2024* store round-trips), so there's nothing more to push here.
			pcConversionSummary = await d20plus.importer.translatePcOGLTo2024Store(character, attribs);
		} else if (attribs.length) {
			const toSave = attribs.map(a => character.attribs.push(a));
			toSave.forEach(s => (s.syncedSave ? s.syncedSave() : s.save()));
		}

		character.abilities.reset();
		if (Array.isArray(entry.abilities)) {
			entry.abilities.map(a => character.abilities.push(a)).forEach(s => s.save());
		}

		// Rebase the token blob so `represents` etc. point at the target character, not the exported one
		let tokenBlob = entry.blobDefaultToken;
		if (tokenBlob && oldCharId) tokenBlob = tokenBlob.split(oldCharId).join(character.id);

		const blobs = {};
		if (entry.blobBio != null) blobs.bio = entry.blobBio;
		if (entry.blobGmNotes != null) blobs.gmnotes = entry.blobGmNotes;
		if (tokenBlob != null) blobs.defaulttoken = tokenBlob;

		if (Object.keys(blobs).length) {
			Object.entries(blobs).forEach(([key, data]) => { character._blobcache[key] = data; });
			character.updateBlobs(blobs);
			// Explicit blob timestamps tell Roll20 to use the uploaded blobs (see base-art.js)
			const now = (new Date()).getTime();
			character.save(Object.keys(blobs).reduce((stamps, key) => {
				stamps[key] = now;
				return stamps;
			}, {}));
		}

		if (character.view && character.view.updateSheetValues) character.view.updateSheetValues();

		if (pcConversionSummary) {
			const failMsg = [
				pcConversionSummary.itemsFailed.length ? `Items not found: ${pcConversionSummary.itemsFailed.join(", ")}` : "",
				pcConversionSummary.spellsFailed.length ? `Spells not found: ${pcConversionSummary.spellsFailed.join(", ")}` : "",
			].filter(Boolean).join("\n");
			if (failMsg) alert(`2024 conversion finished, but some content couldn't be matched to compendium data:\n\n${failMsg}`);
		}
	};

	const importCharacterFromEntry = (entry) => {
		const safeAttributes = {...(entry.attributes || {})};
		delete safeAttributes.id;
		d20.Campaign.characters.create(safeAttributes, {
			success: async (character) => {
				await applyCharacterImport(character, entry);
				alert(`Imported character "${character.get("name")}".`);
			},
		});
	};

	d20plus.characterIo.importCharacterFromJson = () => {
		const $input = $(`<input type="file" accept="application/json">`).appendTo("body");
		$input.on("change", () => {
			const fileList = $input[0] && $input[0].files;
			const file = fileList && fileList[0];
			if (!file) return $input.remove();

			const reader = new FileReader();
			reader.onload = () => {
				let payload = null;
				try {
					payload = JSON.parse(reader.result);
				} catch (err) {
					alert("Invalid JSON file.");
					$input.remove();
					return;
				}

				const entry = getImportEntry(payload);
				if (!entry || !entry.attribs) {
					alert("No character data found in this JSON file.");
					$input.remove();
					return;
				}

				const name = (entry.attributes && entry.attributes.name) || "Unnamed character";
				if (!confirm(`Import character "${name}" from JSON?`)) {
					$input.remove();
					return;
				}

				importCharacterFromEntry(entry);
				$input.remove();
			};
			reader.readAsText(file);
		});
		$input.trigger("click");
	};

	d20plus.characterIo.initCharacterJsonButtons = () => {
		$(document)
			.off("click", ".character-json-export")
			.on("click", ".character-json-export", async (event) => {
				const character = getCharacterFromEvent(event);
				if (!character) return alert("No character found.");

				character.attribs.fetch(character.attribs);
				const abilities = (character.abilities || {models: []}).models.map(ability => ability.attributes);

				const [bio, gmnotes, defaulttoken] = await Promise.all([
					getBlobData(character, "bio"),
					window.is_gm ? getBlobData(character, "gmnotes") : Promise.resolve(null),
					getBlobData(character, "defaulttoken"),
				]);

				const entry = {
					attributes: character.attributes,
					attribs: character.attribs.toJSON(),
					abilities,
					blobBio: bio,
					blobGmNotes: gmnotes,
					blobDefaultToken: defaulttoken,
				};

				const payload = {
					schema_version: 1,
					character: entry,
				};

				const filename = sanitizeFilename(character.get("name"));
				const data = JSON.stringify(payload, null, "\t");
				const blob = new Blob([data], {type: "application/json"});
				d20plus.ut.saveAs(blob, `${filename}.json`);
			});

		$(document)
			.off("click", ".character-json-import")
			.on("click", ".character-json-import", (event) => {
				const character = getCharacterFromEvent(event);
				if (!character) return alert("No character found.");

				const $input = $(`<input type="file" accept="application/json">`).appendTo("body");
				$input.on("change", () => {
					const fileList = $input[0] && $input[0].files;
					const file = fileList && fileList[0];
					if (!file) return $input.remove();

					const reader = new FileReader();
					reader.onload = async () => {
						let payload = null;
						try {
							payload = JSON.parse(reader.result);
						} catch (err) {
							alert("Invalid JSON file.");
							$input.remove();
							return;
						}

						const entry = getImportEntry(payload);
						if (!entry || !entry.attribs) {
							alert("No character data found in this JSON file.");
							$input.remove();
							return;
						}

						const name = (entry.attributes && entry.attributes.name) || character.get("name");
						if (!confirm(`Overwrite "${character.get("name")}" with JSON data for "${name}"?`)) {
							$input.remove();
							return;
						}

						await applyCharacterImport(character, entry);
						alert(`Overwrote "${character.get("name")}" with JSON data.`);

						$input.remove();
					};
					reader.readAsText(file);
				});
				$input.trigger("click");
			});
	};
}

SCRIPT_EXTENSIONS.push(baseCharacterIo);
