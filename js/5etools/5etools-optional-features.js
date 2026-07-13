function d20plusOptionalFeatures () {
	d20plus.optionalfeatures = {};

	d20plus.optionalfeatures.button = function (forcePlayer) {
		const playerMode = forcePlayer || !window.is_gm;
		const url = playerMode ? $("#import-optionalfeatures-url-player").val() : $("#import-optionalfeatures-url").val();

		if (url && url.trim()) {
			const handoutBuilder = playerMode ? d20plus.optionalfeatures.playerImportBuilder : d20plus.optionalfeatures.handoutBuilder;

			DataUtil.loadJSON(url).then(async (data) => {
				await d20plus.importer.pAddBrew(url);
				await d20plus.importer.showImportList(
                    "optionalfeature",
                    data.optionalfeature,
                    handoutBuilder,
                    {
                        forcePlayer,
                    },
                );
			});
		}
	};

	d20plus.optionalfeatures.handoutBuilder = function (data, overwrite, inJournals, folderName, saveIdsTo, options) {
		// make dir
		const folder = d20plus.journal.makeDirTree(`Optional Features`, folderName);
		const path = ["Optional Features", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = data.name;
		d20.Campaign.handouts.create({
			name: name,
			tags: d20plus.importer.getTagString([
				Parser.sourceJsonToFull(data.source),
			], "optionalfeature"),
		}, {
			success: function (handout) {
				if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](data)] = {name: data.name, source: data.source, type: "handout", roll20Id: handout.id};

				const [noteContents, gmNotes] = d20plus.optionalfeatures._getHandoutData(data);

				handout.updateBlobs({notes: noteContents, gmnotes: gmNotes});
				handout.save({notes: (new Date()).getTime(), inplayerjournals: inJournals});
				d20.journal.addItemToFolderStructure(handout.id, folder.id);
			},
		});
	};

	d20plus.optionalfeatures.playerImportBuilder = function (data) {
		const [, gmnotes] = d20plus.optionalfeatures._getHandoutData(data);

		const importId = d20plus.ut.generateRowId();
		d20plus.importer.storePlayerImport(importId, JSON.parse(gmnotes));
		d20plus.importer.makePlayerDraggable(importId, data.name);
	};

	d20plus.optionalfeatures._getHandoutData = function (data) {
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);

		const renderStack = [];

		renderer.recursiveRender({entries: data.entries}, renderStack, {depth: 1});

		const rendered = renderStack.join("");
		const prereqs = Renderer.utils.prerequisite.getHtml(data.prerequisite);

		const r20json = {
			"name": data.name,
			"Vetoolscontent": data,
			"data": {
				"Category": "Optional Features",
			},
		};
		const gmNotes = JSON.stringify(r20json);
		const noteContents = `${prereqs ? `<p><i>Prerequisite: ${prereqs}.</i></p>` : ""}${rendered}\n\n<del class="hidden">${gmNotes}</del>`;

		return [noteContents, gmNotes];
	};

	d20plus.optionalfeatures.importOptionalFeature = function (character, data) {
		const optionalFeature = data.Vetoolscontent;
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);
		const rendered = renderer.render({entries: optionalFeature.entries});
		const optionalFeatureText = d20plus.importer.getCleanText(rendered);

		const attrs = new d20plus.importer.CharacterAttributesProxy(character);
		const fRowId = d20plus.ut.generateRowId();

		if (d20plus.sheet === "ogl") {
			attrs.add(`repeating_traits_${fRowId}_name`, optionalFeature.name);
			attrs.add(`repeating_traits_${fRowId}_source`, Parser.optFeatureTypeToFull(optionalFeature.featureType));
			attrs.add(`repeating_traits_${fRowId}_source_type`, optionalFeature.name);
			attrs.add(`repeating_traits_${fRowId}_description`, optionalFeatureText);
			attrs.add(`repeating_traits_${fRowId}_options-flag`, "0");
		} else if (d20plus.sheet === "shaped") {
			attrs.add(`repeating_classfeature_${fRowId}_name`, optionalFeature.name);
			attrs.add(`repeating_classfeature_${fRowId}_content`, optionalFeatureText);
			attrs.add(`repeating_classfeature_${fRowId}_content_toggle`, "1");
		} else {
			// eslint-disable-next-line no-console
			console.warn(`Optional feature (invocation, maneuver, or metamagic) import is not supported for ${d20plus.sheet} character sheet`);
		}

		attrs.notifySheetWorkers();
	};
}

SCRIPT_EXTENSIONS.push(d20plusOptionalFeatures);
