function d20plusFeats () {
	d20plus.feats = {};

	// Import Feats button was clicked
	d20plus.feats.button = function (forcePlayer) {
		const playerMode = forcePlayer || !window.is_gm;
		const url = playerMode ? $("#import-feats-url-player").val() : $("#import-feats-url").val();
		if (url && url.trim()) {
			const handoutBuilder = playerMode ? d20plus.feats.playerImportBuilder : d20plus.feats.handoutBuilder;

			DataUtil.loadJSON(url).then(async (data) => {
				await d20plus.importer.pAddBrew(url);
				await d20plus.importer.showImportList(
                    "feat",
                    data.feat,
                    handoutBuilder,
                    {
                        forcePlayer,
                    },
                );
			});
		}
	};

	d20plus.feats.handoutBuilder = function (data, overwrite, inJournals, folderName, saveIdsTo, options) {
		// make dir
		const folder = d20plus.journal.makeDirTree(`Feats`, folderName);
		const path = ["Feats", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = data.name;
		d20.Campaign.handouts.create({
			name: name,
			tags: d20plus.importer.getTagString([
				Parser.sourceJsonToFull(data.source),
			], "feat"),
		}, {
			success: function (handout) {
				if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS](data)] = {name: data.name, source: data.source, type: "handout", roll20Id: handout.id};

				const [noteContents, gmNotes] = d20plus.feats._getHandoutData(data);

				handout.updateBlobs({notes: noteContents, gmnotes: gmNotes});
				handout.save({notes: (new Date()).getTime(), inplayerjournals: inJournals});
				d20.journal.addItemToFolderStructure(handout.id, folder.id);
			},
		});
	};

	d20plus.feats.playerImportBuilder = function (data) {
		const [, gmnotes] = d20plus.feats._getHandoutData(data);

		const importId = d20plus.ut.generateRowId();
		d20plus.importer.storePlayerImport(importId, JSON.parse(gmnotes));
		d20plus.importer.makePlayerDraggable(importId, data.name);
	};

	d20plus.feats._getHandoutData = function (data) {
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);
		const prerequisite = Renderer.utils.prerequisite.getHtml(data.prerequisite);
		Renderer.feat.initFullEntries(data);

		const renderStack = [];
		renderer.recursiveRender({entries: data.entries}, renderStack, {depth: 2});
		const rendered = renderStack.join("");

		const r20json = {
			"name": data.name,
			"content": `${prerequisite ? `**Prerequisite**: ${prerequisite}\n\n` : ""}${$(rendered).text()}`,
			"Vetoolscontent": d20plus.importer.getCleanText(rendered),
			"htmlcontent": "",
			"data": {
				"Category": "Feats",
			},
		};
		const gmNotes = JSON.stringify(r20json);

		const baseNoteContents = `${prerequisite ? `<p><i>Prerequisite: ${prerequisite}.</i></p> ` : ""}${rendered}`;
		const noteContents = `${baseNoteContents}<del class="hidden">${gmNotes}</del>`;

		return [noteContents, gmNotes];
	};

	d20plus.feats.importFeat = function (character, data) {
		const featName = data.name;
		const featText = data.Vetoolscontent;
		const attrs = new d20plus.importer.CharacterAttributesProxy(character);
		const rowId = d20plus.ut.generateRowId();

		if (d20plus.sheet === "ogl") {
			attrs.add(`repeating_traits_${rowId}_options-flag`, "0");
			attrs.add(`repeating_traits_${rowId}_name`, featName);
			attrs.add(`repeating_traits_${rowId}_description`, featText);
			attrs.add(`repeating_traits_${rowId}_source`, "Feat");
		} else if (d20plus.sheet === "shaped") {
			attrs.add(`repeating_feat_${rowId}_name`, featName);
			attrs.add(`repeating_feat_${rowId}_content`, featText);
			attrs.add(`repeating_feat_${rowId}_content_toggle`, "1");
		} else {
			// eslint-disable-next-line no-console
			console.warn(`Feat import is not supported for ${d20plus.sheet} character sheet`);
		}

		attrs.notifySheetWorkers();
	};
}

SCRIPT_EXTENSIONS.push(d20plusFeats);
