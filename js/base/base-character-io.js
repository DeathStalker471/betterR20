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

	const applyCharacterImport = (character, entry) => {
		const safeAttributes = {...(entry.attributes || {})};
		delete safeAttributes.id;
		delete safeAttributes.inplayerjournals;
		delete safeAttributes.controlledby;
		character.set(safeAttributes);
		character.save();

		character.attribs.reset();
		if (Array.isArray(entry.attribs)) {
			const toSave = entry.attribs.map(a => character.attribs.push(a));
			toSave.forEach(s => (s.syncedSave ? s.syncedSave() : s.save()));
		}

		character.abilities.reset();
		if (Array.isArray(entry.abilities)) {
			entry.abilities.map(a => character.abilities.push(a)).forEach(s => s.save());
		}

		character.updateBlobs({
			bio: entry.blobBio,
			gmnotes: entry.blobGmNotes,
			defaulttoken: entry.blobDefaultToken,
		});

		if (character.view && character.view.updateSheetValues) character.view.updateSheetValues();
	};

	const importCharacterFromEntry = (entry) => {
		const safeAttributes = {...(entry.attributes || {})};
		delete safeAttributes.id;
		d20.Campaign.characters.create(safeAttributes, {
			success: (character) => {
				applyCharacterImport(character, entry);
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

						const name = (entry.attributes && entry.attributes.name) || character.get("name");
						if (!confirm(`Overwrite "${character.get("name")}" with JSON data for "${name}"?`)) {
							$input.remove();
							return;
						}

						applyCharacterImport(character, entry);
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
