function d20plusClass () {
	d20plus.classes = {};
	d20plus.subclasses = {};

	d20plus.classes._pLoadMergedClassJON = async function () {
		let data = await DataUtil.class.loadJSON();
		data = MiscUtil.copy(data);
		d20plus.classes._doAttachChildSubclasses(data);
		return data;
	};

	d20plus.classes._doAttachChildSubclasses = function (data) {
		data.class = data.class || [];
		data.subclass = data.subclass || [];

		for (let i = 0; i < data.subclass.length; ++i) {
			// Attach subclasses to parent classes
			const cls = data.class.find(it => it.name === data.subclass[i].className && it.source === data.subclass[i].classSource);
			if (!cls) continue;
			(cls.subclasses = cls.subclasses || []).push(data.subclass[i]);
		}
	};

	// Import Classes button was clicked
	d20plus.classes.button = async function (forcePlayer) {
		const playerMode = forcePlayer || !window.is_gm;
		const url = playerMode ? $("#import-classes-url-player").val() : $("#import-classes-url").val();

		if (!url || !url.trim()) return;

		const handoutBuilder = playerMode ? d20plus.classes.playerImportBuilder : d20plus.classes.handoutBuilder;

		// If the url is for the official classes, combine them into the correct data structure
		let classesDeref;
		let subclassesDeref;
		if (url === CLASS_DATA_DIR) {
			classesDeref = await DataLoader.pCacheAndGetAllSite("class");
			subclassesDeref = await DataLoader.pCacheAndGetAllSite("subclass");
		}
		else {
			// make sure the homebrew system knows about it
			await BrewUtil2.pAddBrewFromUrl(url);

			// get the semi-processed data (this will merge `_copy` etc., but not dereference `ref*`)
			const data = await DataUtil.loadJSON(url);
			// From the semi-processed data, get the final dereferenced data, by asking the `DataLoader` (which has a pipeline to resolve all refs) for it
			classesDeref = await data.class
				.pSerialAwaitMap(cls => DataLoader.pCacheAndGet("class", cls.source, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](cls), {isCopy: true}));
			subclassesDeref = await data.subclass
				.pSerialAwaitMap(cls => DataLoader.pCacheAndGet("subclass", cls.source, UrlUtil.URL_TO_HASH_BUILDER["subclass"](cls), {isCopy: true}));
		}

		// Make it so you get subclasses as well as classes
		const subclassLoader = {"class": classesDeref, "subclass": subclassesDeref};
		d20plus.classes._doAttachChildSubclasses(subclassLoader);

		if (!classesDeref?.length) return;

		await d20plus.importer.showImportList(
			"class",
			classesDeref,
			handoutBuilder,
			{
				forcePlayer,
				builderOptions: {
					isHomebrew: url !== CLASS_DATA_DIR,
				},
			},
		);
	};

	d20plus.classes.handoutBuilder = function (data, overwrite, inJournals, folderName, saveIdsTo, options) {
		options = options || {};

		// make dir
		const folder = d20plus.journal.makeDirTree(`Classes`, folderName);
		const path = ["Classes", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = data.name;
		d20.Campaign.handouts.create({
			name: name,
			tags: d20plus.importer.getTagString([
				Parser.sourceJsonToFull(data.source),
			], "class"),
		}, {
			success: function (handout) {
				if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](data)] = {name: data.name, source: data.source, type: "handout", roll20Id: handout.id};

				const [noteContents, gmNotes] = d20plus.classes._getHandoutData(data);

				handout.updateBlobs({notes: noteContents, gmnotes: gmNotes});
				handout.save({notes: (new Date()).getTime(), inplayerjournals: inJournals});
				d20.journal.addItemToFolderStructure(handout.id, folder.id);
			},
		});

		d20plus.classes._handleSubclasses(data, overwrite, inJournals, folderName, false, options);
	};

	d20plus.classes._handleSubclasses = async function (data, overwrite, inJournals, outerFolderName, forcePlayer, options) {
		async function chooseSubclassImportStrategy (isUnofficialBaseClass) {
			return new Promise((resolve, reject) => {
				const $dialog = $(`
						<div title="Subclass Import">
							<label class="flex">
								<span>Import ${data.name} ${data.source ? `(${Parser.sourceJsonToAbv(data.source)}) ` : ""}subclasses?</span>
								 <select title="Note: this does not include homebrew. For homebrew subclasses, use the dedicated subclass importer." style="width: 250px;">
								 	${isUnofficialBaseClass ? "" : `<option value="1">Official/Published (excludes UA/etc)</option>`}
								 	<option value="2">All</option>
								 	<option value="3">None</option>
 								</select>
							</label>
						</div>
					`).appendTo($("body"));
				const $selStrat = $dialog.find(`select`);

				$dialog.dialog({
					dialogClass: "no-close",
					buttons: [
						{
							text: "Cancel",
							click: function () {
								$(this).dialog("close");
								$dialog.remove();
								reject(new Error(`User cancelled the prompt`));
							},
						},
						{
							text: "OK",
							click: function () {
								const selected = Number($selStrat.val());
								$(this).dialog("close");
								$dialog.remove();
								if (isNaN(selected)) reject(new Error(`Value was not a number!`));
								resolve(selected);
							},
						},
					],
				})
			});
		}

		const playerMode = forcePlayer || !window.is_gm;
		// import subclasses
		if (data.subclasses) {
			const importStrategy = await chooseSubclassImportStrategy(options.isHomebrew || (data.source && SourceUtil.isNonstandardSource(data.source)));
			if (importStrategy === 3) return;

			data.subclasses.forEach(sc => {
				if (importStrategy === 1 && SourceUtil.isNonstandardSource(sc.source)) return;

				sc.className = data.name;
				sc.classSource = sc.classSource || data.source;
				if (playerMode) {
					d20plus.subclasses.playerImportBuilder(sc, data);
				} else {
					const folderName = d20plus.importer._getHandoutPath("subclass", sc, "Class");
					const path = [folderName];
					if (outerFolderName) path.push(sc.source || data.source); // if it wasn't None, group by source
					d20plus.subclasses.handoutBuilder(sc, overwrite, inJournals, path, {}, {}, data);
				}
			});
		}
	};

	d20plus.classes.playerImportBuilder = function (data, _1, _2, _3, _4, options) {
		options = options || {};

		const [, gmnotes] = d20plus.classes._getHandoutData(data);

		const importId = d20plus.ut.generateRowId();
		d20plus.importer.storePlayerImport(importId, JSON.parse(gmnotes));
		d20plus.importer.makePlayerDraggable(importId, data.name);

		d20plus.classes._handleSubclasses(data, false, false, null, true, options);
	};

	d20plus.classes._getHandoutData = function (data) {
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);

		const renderStack = [];
		// make a copy of the data to modify
		const curClass = JSON.parse(JSON.stringify(data));
		// render the class text
		for (let i = 0; i < 20; i++) {
			const lvlFeatureList = curClass.classFeatures[i];
			for (let j = 0; j < lvlFeatureList.length; j++) {
				const feature = lvlFeatureList[j];
				renderer.recursiveRender(feature, renderStack);
			}
		}
		const rendered = renderStack.join("");

		const r20json = {
			"name": data.name,
			"Vetoolscontent": data,
			"data": {
				"Category": "Classes",
			},
		};
		const gmNotes = JSON.stringify(r20json);
		const noteContents = `${rendered}\n\n<del class="hidden">${gmNotes}</del>`;

		return [noteContents, gmNotes];
	};

	d20plus.classes.getProfBonusFromLevel = function (level) {
		if (level < 5) return "2";
		if (level < 9) return "3";
		if (level < 13) return "4";
		if (level < 17) return "5";
		return "6";
	};

	d20plus.classes.importClass = async function (character, data) {
		let levels = d20plus.ut.getNumberRange("What levels?", 1, 20);
		if (!levels) return;

		const maxLevel = Math.max(...levels);

		const clss = data.Vetoolscontent;
		const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);
		const shapedSheetPreFilledFeaturesByClass = {
			"Artificer": [
				"Magic Item Analysis",
				"Tool Expertise",
				"Wondrous Invention",
				"Infuse Magic",
				"Superior Attunement",
				"Mechanical Servant",
				"Soul of Artifice",
			],
			"Barbarian": [
				"Rage",
				"Unarmored Defense",
				"Reckless Attack",
				"Danger Sense",
				"Extra Attack",
				"Fast Movement",
				"Feral Instinct",
				"Brutal Critical",
				"Relentless Rage",
				"Persistent Rage",
				"Indomitable Might",
				"Primal Champion",
			],
			"Bard": [
				"Bardic Inspiration",
				"Jack of All Trades",
				"Song of Rest",
				"Expertise",
				"Countercharm",
				"Magical Secrets",
				"Superior Inspiration",
			],
			"Cleric": [
				"Channel Divinity",
				"Turn Undead",
				"Divine Intervention",
			],
			"Druid": [
				"Druidic",
				"Wild Shape",
				"Timeless Body",
				"Beast Spells",
				"Archdruid",
			],
			"Fighter": [
				"Fighting Style",
				"Second Wind",
				"Action Surge",
				"Extra Attack",
				"Indomitable",
			],
			"Monk": [
				"Unarmored Defense",
				"Martial Arts",
				"Ki",
				"Flurry of Blows",
				"Patient Defense",
				"Step of the Wind",
				"Unarmored Movement",
				"Deflect Missiles",
				"Slow Fall",
				"Extra Attack",
				"Stunning Strike",
				"Ki-Empowered Strikes",
				"Evasion",
				"Stillness of Mind",
				"Purity of Body",
				"Tongue of the Sun and Moon",
				"Diamond Soul",
				"Timeless Body",
				"Empty Body",
				"Perfect Soul",
			],
			"Paladin": [
				"Divine Sense",
				"Lay on Hands",
				"Fighting Style",
				"Divine Smite",
				"Divine Health",
				"Channel Divinity",
				"Extra Attack",
				"Aura of Protection",
				"Aura of Courage",
				"Improved Divine Smite",
				"Cleansing Touch",
			],
			"Ranger": [
				"Favored Enemy",
				"Natural Explorer",
				"Fighting Style",
				"Primeval Awareness",
				"Land’s Stride",
				"Hide in Plain Sight",
				"Vanish",
				"Feral Senses",
				"Foe Slayer",
			],
			"Ranger (Revised)": [ // "Ranger UA (2016)"
				"Favored Enemy",
				"Natural Explorer",
				"Fighting Style",
				"Primeval Awareness",
				"Greater Favored Enemy",
				"Fleet of Foot",
				"Hide in Plain Sight",
				"Vanish",
				"Feral Senses",
				"Foe Slayer",
			],
			"Rogue": [
				"Expertise",
				"Sneak Attack",
				"Thieves' Cant",
				"Cunning Action",
				"Uncanny Dodge",
				"Evasion",
				"Reliable Talent",
				"Blindsense",
				"Slippery Mind",
				"Elusive",
				"Stroke of Luck",
			],
			"Sorcerer": [
				"Sorcery Points",
				"Flexible Casting",
				"Metamagic",
				"Sorcerous Restoration",
			],
			"Warlock": [
				"Eldritch Invocations",
				"Pact Boon",
				"Mystic Arcanum",
				"Eldritch Master",
			],
			"Wizard": [
				"Arcane Recovery",
				"Spell Mastery",
				"Signature Spells",
			],
		};
		const shapedSheetPreFilledFeatures = shapedSheetPreFilledFeaturesByClass[clss.name] || [];

		const attrs = new d20plus.importer.CharacterAttributesProxy(character);

		importClassGeneral(attrs, clss, maxLevel);

		let featureSourceBlacklist = await d20plus.ui.chooseCheckboxList(
			[Parser.SRC_TCE],
			"Choose Variant/Optional Feature Sources to Exclude",
			{
				note: "Choosing to exclude a source will prevent its features from being added to your sheet.",
				displayFormatter: it => Parser.sourceJsonToFull(it),
			},
		);

		for (let i = 0; i < maxLevel; i++) {
			const level = i + 1;
			if (!levels.has(level)) continue;

			const lvlFeatureList = clss.classFeatures[i];
			for (let j = 0; j < lvlFeatureList.length; j++) {
				const feature = lvlFeatureList[j];
				// don't add "you gain a subclass feature" or ASI's
				if (
					!feature.gainSubclassFeature
					&& feature.name !== "Ability Score Improvement"
					&& (!feature.isClassFeatureVariant || !featureSourceBlacklist.includes(feature.source))
				) {
					const renderStack = [];
					renderer.recursiveRender({entries: feature.entries}, renderStack);
					feature.text = d20plus.importer.getCleanText(renderStack.join(""));
					importClassFeature(attrs, clss, level, feature);
				}
			}
		}

		function importClassGeneral (attrs, clss, maxLevel) {
			if (d20plus.sheet === "ogl") {
				setTimeout(() => {
					attrs.addOrUpdate("pb", d20plus.classes.getProfBonusFromLevel(Number(maxLevel)));
					attrs.addOrUpdate("class", clss.name);
					attrs.addOrUpdate("level", maxLevel);
					attrs.addOrUpdate("base_level", String(maxLevel));
				}, 500);
			} else if (d20plus.sheet === "shaped") {
				const isSupportedClass = clss.source === "PHB" || ["Artificer", "Ranger (Revised)"].includes(clss.name);
				let className = "CUSTOM";
				if (isSupportedClass) {
					className = clss.name.toUpperCase();
					if (clss.name === "Ranger (Revised)") { className = "RANGERUA"; }
				}

				const fRowId = attrs.findOrGenerateRepeatingRowId("repeating_class_$0_name", className);
				attrs.addOrUpdate(`repeating_class_${fRowId}_name`, className);
				attrs.addOrUpdate(`repeating_class_${fRowId}_level`, maxLevel);
				if (!isSupportedClass) {
					attrs.addOrUpdate(`repeating_class_${fRowId}_hd`, `d${clss.hd.faces}`);
					attrs.addOrUpdate(`repeating_class_${fRowId}_custom_class_toggle`, "1");
					attrs.addOrUpdate(`repeating_class_${fRowId}_custom_name`, clss.name);
				}

				if (!isSupportedClass && clss.name === "Mystic") {
					const classResourcesForLevel = clss.classTableGroups[0].rows[maxLevel - 1];
					const [, , psiPoints, psiLimit] = classResourcesForLevel;

					attrs.addOrUpdate("spell_points_name", "PSI");
					attrs.addOrUpdate("show_spells", "1");
					attrs.addOrUpdate("spell_points_toggle", "1");
					attrs.addOrUpdate("spell_ability", "INTELLIGENCE");
					attrs.addOrUpdate("spell_points_limit", psiLimit);
					attrs.addOrUpdate("spell_points", psiPoints, psiPoints);

					for (let i = 1; i <= 7; i++) {
						attrs.addOrUpdate(`spell_level_${i}_cost`, i);
					}
					for (let i = 0; i <= psiLimit; i++) {
						attrs.addOrUpdate(`spell_level_filter_${i}`, "1");
					}
				}

				attrs.notifySheetWorkers();
			} else {
				// eslint-disable-next-line no-console
				console.warn(`Class import is not supported for ${d20plus.sheet} character sheet`);
			}
		}

		function importClassFeature (attrs, clss, level, feature) {
			if (d20plus.sheet === "ogl") {
				const fRowId = d20plus.ut.generateRowId();
				attrs.add(`repeating_traits_${fRowId}_name`, feature.name);
				attrs.add(`repeating_traits_${fRowId}_source`, "Class");
				attrs.add(`repeating_traits_${fRowId}_source_type`, `${clss.name} ${level}`);
				attrs.add(`repeating_traits_${fRowId}_description`, feature.text);
				attrs.add(`repeating_traits_${fRowId}_options-flag`, "0");
			} else if (d20plus.sheet === "shaped") {
				if (shapedSheetPreFilledFeatures.includes(feature.name)) { return; }

				const fRowId = d20plus.ut.generateRowId();
				attrs.add(`repeating_classfeature_${fRowId}_name`, `${feature.name} (${clss.name} ${level})`);
				attrs.add(`repeating_classfeature_${fRowId}_content`, feature.text);
				attrs.add(`repeating_classfeature_${fRowId}_content_toggle`, "1");
			}

			attrs.notifySheetWorkers();
		}
	};

	/// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	d20plus.subclasses._groupOptions = ["Class", "Alphabetical", "Source"];
	d20plus.subclasses._listCols = ["name", "class", "source"];
	d20plus.subclasses._listItemBuilder = (it) => `
		<span class="name col-6">${it.name}</span>
		<span class="class col-4">CLS[${it.className}]</span>
		<span title="${Parser.sourceJsonToFull(it.source)}" class="source col-2">SRC[${Parser.sourceJsonToAbv(it.source)}]</span>`;
	d20plus.subclasses._listIndexConverter = (sc) => {
		return {
			name: sc.name.toLowerCase(),
			class: sc.className.toLowerCase(),
			source: Parser.sourceJsonToAbv(sc.source).toLowerCase(),
		};
	};

	// Import Subclasses button was clicked
	d20plus.subclasses.button = async function (forcePlayer) {
		const playerMode = forcePlayer || !window.is_gm;
		const url = playerMode ? $("#import-subclasses-url-player").val() : $("#import-subclasses-url").val();

		if (!url || !url.trim()) return;

		const handoutBuilder = playerMode ? d20plus.subclasses.playerImportBuilder : d20plus.subclasses.handoutBuilder;

		// make sure the homebrew system knows about it
		await BrewUtil2.pAddBrewFromUrl(url);

		// If the url is for the official classes, combine them into the correct data structure
		let subclassesDeref;
		if (url === CLASS_DATA_DIR) {
			subclassesDeref = await DataLoader.pCacheAndGetAllSite("subclass");
		}
		else {
			// get the semi-processed data (this will merge `_copy` etc., but not dereference `ref*`)
			const data = await DataUtil.loadJSON(url);
			// From the semi-processed data, get the final dereferenced data, by asking the `DataLoader` (which has a pipeline to resolve all refs) for it
			subclassesDeref = await data.subclass
				.pSerialAwaitMap(cls => DataLoader.pCacheAndGet("subclass", cls.source, UrlUtil.URL_TO_HASH_BUILDER["subclass"](cls), {isCopy: true}));
		}

		if (!subclassesDeref?.length) return;

		await d20plus.importer.showImportList(
			"subclass",
			subclassesDeref,
			handoutBuilder,
			{
				groupOptions: d20plus.subclasses._groupOptions,
				forcePlayer,
				listItemBuilder: d20plus.subclasses._listItemBuilder,
				listIndex: d20plus.subclasses._listCols,
				listIndexConverter: d20plus.subclasses._listIndexConverter,
			},
		);
	};

	/**
	 * @param data
	 * @param overwrite
	 * @param inJournals
	 * @param folderName
	 * @param saveIdsTo
	 * @param options
	 * @param baseClass Will be defined if importing as part of a class, undefined otherwise.
	 */
	d20plus.subclasses.handoutBuilder = function (data, overwrite, inJournals, folderName, saveIdsTo, options, baseClass) {
		// make dir
		const folder = d20plus.journal.makeDirTree(`Subclasses`, folderName);
		const path = ["Sublasses", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = `${data.shortName} (${data.className})`;
		d20.Campaign.handouts.create({
			name: name,
			tags: d20plus.importer.getTagString([
				data.className,
				Parser.sourceJsonToFull(data.source),
			], "subclass"),
		}, {
			success: function (handout) {
				if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](data)] = {name: data.name, source: data.source, type: "handout", roll20Id: handout.id};

				const [noteContents, gmNotes] = d20plus.subclasses._getHandoutData(data);

				handout.updateBlobs({notes: noteContents, gmnotes: gmNotes});
				handout.save({notes: (new Date()).getTime(), inplayerjournals: inJournals});
				d20.journal.addItemToFolderStructure(handout.id, folder.id);
			},
		});
	};

	/**
	 * @param data
	 * @param baseClass Will be defined if importing as part of a class, undefined otherwise.
	 */
	d20plus.subclasses.playerImportBuilder = function (data, baseClass) {
		const [, gmnotes] = d20plus.subclasses._getHandoutData(data);

		const importId = d20plus.ut.generateRowId();
		d20plus.importer.storePlayerImport(importId, JSON.parse(gmnotes));
		const name = `${data.className ? `${data.className} \u2014 ` : ""}${data.name}`;
		d20plus.importer.makePlayerDraggable(importId, name);
	};

	d20plus.subclasses._getHandoutData = function (data) {
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);

		const renderStack = [];

		data.subclassFeatures.forEach(lvl => {
			lvl.forEach(f => {
				renderer.recursiveRender(f, renderStack);
			});
		});

		const rendered = renderStack.join("");

		const r20json = {
			"name": data.name,
			"Vetoolscontent": data,
			"data": {
				"Category": "Subclasses",
			},
		};
		const gmNotes = JSON.stringify(r20json);
		const noteContents = `${rendered}\n\n<del class="hidden">${gmNotes}</del>`;

		return [noteContents, gmNotes];
	};

	d20plus.subclasses.importSubclass = function (character, data) {
		if (d20plus.sheet !== "ogl" && d20plus.sheet !== "shaped") {
			// eslint-disable-next-line no-console
			console.warn(`Subclass import is not supported for ${d20plus.sheet} character sheet`);
			return;
		}

		const attrs = new d20plus.importer.CharacterAttributesProxy(character);
		const sc = data.Vetoolscontent;

		const levels = d20plus.ut.getNumberRange("What levels?", 1, 20);
		if (!levels || !levels.size) return;

		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);
		let firstFeatures = true;
		for (let i = 0; i < sc.subclassFeatures.length; i++) {
			const lvlFeatureList = sc.subclassFeatures[i];
			for (let j = 0; j < lvlFeatureList.length; j++) {
				const featureCpy = JSON.parse(JSON.stringify(lvlFeatureList[j]));
				let feature = lvlFeatureList[j];

				if (!levels.has(feature.level)) continue;

				try {
					while (!feature.name || (feature[0] && !feature[0].name)) {
						if (feature.entries && feature.entries.name) {
							feature = feature.entries;
							continue;
						} else if (feature.entries[0] && feature.entries[0].name) {
							feature = feature.entries[0];
							continue;
						} else {
							feature = feature.entries;
						}

						if (!feature) {
							// in case something goes wrong, reset break the loop
							feature = featureCpy;
							break;
						}
					}
				} catch (e) {
					// eslint-disable-next-line no-console
					console.error("Failed to find feature");
					// in case something goes _really_ wrong, reset
					feature = featureCpy;
				}

				// for the first batch of subclass features, try to split them up
				if (firstFeatures && feature.name && feature.entries) {
					const subFeatures = [];
					const baseFeatures = feature.entries.filter(f => {
						if (f.name && f.type === "entries") {
							subFeatures.push(f);
							return false;
						} else return true;
					});
					importSubclassFeature(attrs, sc, feature.level,
						{name: feature.name, type: feature.type, entries: baseFeatures});
					subFeatures.forEach(sf => {
						importSubclassFeature(attrs, sc, feature.level, sf);
					})
				} else {
					importSubclassFeature(attrs, sc, feature.level, feature);
				}

				firstFeatures = false;
			}
		}

		function importSubclassFeature (attrs, sc, level, feature) {
			const renderStack = [];
			renderer.recursiveRender({entries: feature.entries}, renderStack);
			feature.text = d20plus.importer.getCleanText(renderStack.join(""));

			const fRowId = d20plus.ut.generateRowId();

			if (d20plus.sheet === "ogl") {
				attrs.add(`repeating_traits_${fRowId}_name`, feature.name);
				attrs.add(`repeating_traits_${fRowId}_source`, "Class");
				attrs.add(`repeating_traits_${fRowId}_source_type`, `${sc.className} (${sc.name} ${level})`);
				attrs.add(`repeating_traits_${fRowId}_description`, feature.text);
				attrs.add(`repeating_traits_${fRowId}_options-flag`, "0");
			} else if (d20plus.sheet === "shaped") {
				attrs.add(`repeating_classfeature_${fRowId}_name`, `${feature.name} (${sc.name} ${level})`);
				attrs.add(`repeating_classfeature_${fRowId}_content`, feature.text);
				attrs.add(`repeating_classfeature_${fRowId}_content_toggle`, "1");
			}

			attrs.notifySheetWorkers();
		}
	};
}

SCRIPT_EXTENSIONS.push(d20plusClass);
