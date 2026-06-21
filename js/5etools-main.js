const betteR205etoolsMain = function () {
	IMG_URL = `${BASE_SITE_URL}img/`;
	IMG_URL_REPO = `${DATA_URL_IMG_REPO}`;

	SPELL_DATA_DIR = `${DATA_URL}spells/`;
	SPELL_META_URL = `https://5e.tools/data/spells/roll20.json`;
	MONSTER_DATA_DIR = `${DATA_URL}bestiary/`;
	ADVENTURE_DATA_DIR = `${DATA_URL}adventure/`;
	CLASS_DATA_DIR = `${DATA_URL}class/`;

	ITEM_DATA_URL = `${DATA_URL}items.json`;
	FEAT_DATA_URL = `${DATA_URL}feats.json`;
	PSIONIC_DATA_URL = `${DATA_URL}psionics.json`;
	OBJECT_DATA_URL = `${DATA_URL}objects.json`;
	VEHICLE_DATA_URL = `${DATA_URL}vehicles.json`;
	BACKGROUND_DATA_URL = `${DATA_URL}backgrounds.json`;
	OPT_FEATURE_DATA_URL = `${DATA_URL}optionalfeatures.json`;
	RACE_DATA_URL = `${DATA_URL}races.json`;
	DEITY_DATA_URL = `${DATA_URL}deities.json`;

	// the GitHub API has a 60 requests/hour limit per IP which we quickly hit if the user refreshes their Roll20 a couple of times
	// embed shitty OAth2 details here to enable 5k/hour requests per IP (sending them with requests to the API relaxes the limit)
	// naturally these are client-visible and should not be used to secure anything
	const HOMEBREW_CLIENT_ID = `67e57877469da38a85a7`;
	const HOMEBREW_CLIENT_SECRET = `c00dede21ca63a855abcd9a113415e840aca3f92`;

	const REQUIRED_PROPS = {
		"monster": [
			"ac",
			"alignment",
			"cha",
			"con",
			"cr",
			"dex",
			"hp",
			"int",
			"name",
			"passive",
			"size",
			"source",
			"speed",
			"str",
			"type",
			"wis",
		],
		"spell": [
			"name",
			"level",
			"school",
			"time",
			"range",
			"components",
			"duration",
			"classes",
			"entries",
			"source",
		],
		"item": [
			"name",
			"rarity",
			"source",
		],
		"psionic": [
			"name",
			"source",
			"type",
		],
		"feat": [
			"name",
			"source",
			"entries",
		],
		"object": [
			"name",
			"source",
			"size",
			"type",
			"ac",
			"hp",
			"immune",
			"entries",
		],
		"vehicle": [
			"name",
			"source",
			"vehicleType",
		],
		"class": [
			"name",
			"source",
			"hd",
			"proficiency",
			"classTableGroups",
			"startingProficiencies",
			"startingEquipment",
			"classFeatures",
			"subclassTitle",
			"subclasses",
		],
		"subclass": [

		],
		"background": [
			"name",
			"source",
			"skillProficiencies",
			"entries",
		],
		"race": [
			"name",
			"source",
		],
		"optionalfeature": [
			"name",
			"source",
			"entries",
		],
		"deity": [
			"name",
			"source",
			"pantheon",
		],
	};

	/**
	 * This is the main variable that should be modified when adding a new importable category (eg. spells, monsters, feats)
	 * Each category is represented with the following fields:
	 *
	 * name: the category name (singular)
	 * plural: the category name (plural)
	 * playerImport: if the category is player importable
	 * allImport: if the category has an import from all sources option
	 * fileImport: if the category has an import from file option
	 * uniqueImport: if the category has a unique import and not able to be handled by the showImportList function
	 * baseUrl: the url of the official JSON or directory of JSONs
	 * defaultSource: if there are multiple sources, the one to be shown by default
	 * finalText: any text to be shown after the buttons
	 */
	const IMPORT_CATEGORIES = [
		{
			name: "adventure",
			plural: "adventures",
			baseUrl: ADVENTURE_DATA_DIR,
			uniqueImport: true,
		},
		{
			name: "background",
			plural: "backgrounds",
			playerImport: true,
			baseUrl: BACKGROUND_DATA_URL,
		},
		{
			name: "class",
			plural: "classes",
			playerImport: true,
			baseUrl: CLASS_DATA_DIR,
		},
		{
			name: "deity",
			plural: "deities",
			baseUrl: DEITY_DATA_URL,
		},
		{
			name: "feat",
			plural: "feats",
			playerImport: true,
			baseUrl: FEAT_DATA_URL,
		},
		{
			name: "item",
			plural: "items",
			playerImport: true,
			baseUrl: ITEM_DATA_URL,
		},
		{
			name: "monster",
			plural: "monsters",
			allImport: true,
			fileImport: true,
			baseUrl: MONSTER_DATA_DIR,
			defaultSource: "MM",
			finalText: ` WARNING: Importing huge numbers of character sheets slows the game down. We recommend you import them as needed.<br>The "Import Monsters From All Sources" button presents a list containing monsters from official sources only.<br>To import from third-party sources, either individually select one available in the list, enter a custom URL, or upload a custom file, and "Import Monsters."`,
		},
		{
			name: "object",
			plural: "objects",
			baseUrl: OBJECT_DATA_URL,
		},
		{
			name: "optionalfeature",
			plural: "optionalfeatures",
			titleSing: "Optional Feature (Invocations, etc.)",
			titlePl: "Optional Features (Invocations, etc.)",
			playerImport: true,
			baseUrl: OPT_FEATURE_DATA_URL,
		},
		{
			name: "psionic",
			plural: "psionics",
			playerImport: true,
			baseUrl: PSIONIC_DATA_URL,
		},
		{
			name: "race",
			plural: "races",
			playerImport: true,
			baseUrl: RACE_DATA_URL,
		},
		{
			name: "spell",
			plural: "spells",
			playerImport: true,
			baseUrl: SPELL_DATA_DIR,
		},
		{
			name: "subclass",
			plural: "subclasses",
			playerImport: true,
			baseUrl: "",
		},
		{
			name: "vehicle",
			plural: "vehicles",
			baseUrl: VEHICLE_DATA_URL,
		},
	]

	let spellDataUrls = {};
	let spellMetaData = {};
	let monsterDataUrls = {};
	let monsterFluffDataUrls = {};
	let monsterFluffData = {};
	let monsterMetadata = {};
	let adventureMetadata = {};
	let itemMetadata = {};
	let classDataUrls = {};
	let brewIndex = {};

	// build a big dictionary of sheet properties to be used as reference throughout // TODO use these as reference throughout
	function SheetAttribute (name, ogl, shaped) {
		this.name = name;
		this.ogl = ogl;
		this.shaped = shaped;
	}

	NPC_SHEET_ATTRIBUTES = {};
	// these (other than the name, which is for display only) are all lowercased; any comparison should be lowercased
	NPC_SHEET_ATTRIBUTES["empty"] = new SheetAttribute("--Empty--", "", "");
	// TODO: implement custom entry (enable textarea)
	// NPC_SHEET_ATTRIBUTES["custom"] = new SheetAttribute("-Custom-", "-Custom-", "-Custom-");
	NPC_SHEET_ATTRIBUTES["npc_hpbase"] = new SheetAttribute("HP", "npc_hpbase", "npc_hpbase");
	NPC_SHEET_ATTRIBUTES["npc_ac"] = new SheetAttribute("AC", "npc_ac", "ac");
	NPC_SHEET_ATTRIBUTES["passive"] = new SheetAttribute("Passive Perception", "passive", "passive");
	NPC_SHEET_ATTRIBUTES["npc_hpformula"] = new SheetAttribute("HP Formula", "npc_hpformula", "npc_hpformula");
	NPC_SHEET_ATTRIBUTES["npc_speed"] = new SheetAttribute("Speed", "npc_speed", "npc_speed");
	NPC_SHEET_ATTRIBUTES["spell_save_dc"] = new SheetAttribute("Spell Save DC", "spell_save_dc", "spell_save_DC");
	NPC_SHEET_ATTRIBUTES["npc_legendary_actions"] = new SheetAttribute("Legendary Actions", "npc_legendary_actions", "npc_legendary_actions");
	NPC_SHEET_ATTRIBUTES["npc_challenge"] = new SheetAttribute("CR", "npc_challenge", "challenge");

	PC_SHEET_ATTRIBUTES = {};
	PC_SHEET_ATTRIBUTES["empty"] = new SheetAttribute("--Default--", "", "");
	PC_SHEET_ATTRIBUTES["hp"] = new SheetAttribute("Current HP", "hp", "HP");
	PC_SHEET_ATTRIBUTES["ac"] = new SheetAttribute("AC", "ac", "ac"); // TODO check shaped
	PC_SHEET_ATTRIBUTES["passive_wisdom"] = new SheetAttribute("Passive Perception", "passive_wisdom", "passive_wisdom"); // TODO check shaped
	PC_SHEET_ATTRIBUTES["speed"] = new SheetAttribute("Speed", "speed", "speed"); // TODO check shaped
	PC_SHEET_ATTRIBUTES["spell_save_dc"] = new SheetAttribute("Spell Save DC", "spell_save_dc", "spell_save_dc"); // TODO check shaped

	d20plus.sheet = "ogl";

	d20plus.advantageModes = ["Toggle (Default Advantage)", "Toggle", "Toggle (Default Disadvantage)", "Always", "Query", "Never"];
	d20plus.whisperModes = ["Toggle (Default GM)", "Toggle (Default Public)", "Always", "Query", "Never"];
	d20plus.damageModes = ["Auto Roll", "Don't Auto Roll"];

	d20plus.formulas = {
		_options: ["--Empty--", "AC", "HP", "Passive Perception", "Spell DC"],
		"ogl": {
			"cr": "@{npc_challenge}",
			"ac": "@{ac}",
			"npcac": "@{npc_ac}",
			"hp": "@{hp}",
			"pp": "@{passive_wisdom}",
			"macro": "",
			"spellDc": "@{spell_save_dc}",
		},
		"community": {
			"cr": "@{npc_challenge}",
			"ac": "@{AC}",
			"npcac": "@{AC}",
			"hp": "@{HP}",
			"pp": "10 + @{perception}",
			"macro": "",
			"spellDc": "@{spell_save_dc}",
		},
		"shaped": {
			"cr": "@{challenge}",
			"ac": "@{AC}",
			"npcac": "@{AC}",
			"hp": "@{HP}",
			"pp": "@{repeating_skill_$11_passive}",
			"macro": "shaped_statblock",
			"spellDc": "@{spell_save_dc}",
		},
	};

	if (!d20plus.ut.isUseSharedJs()) {
		// d20plus.js.scripts.push({name: "5etoolsRender", url: `${SITE_JS_URL}render.js`});
		// d20plus.js.scripts.push({name: "5etoolsScalecreature", url: `${SITE_JS_URL}scalecreature.js`});
	}

	d20plus.json = [
		{name: "class index", url: `${CLASS_DATA_DIR}index.json`},
		{name: "spell index", url: `${SPELL_DATA_DIR}index.json`},
		{name: "spell metadata", url: SPELL_META_URL},
		{name: "bestiary index", url: `${MONSTER_DATA_DIR}index.json`},
		{name: "bestiary fluff index", url: `${MONSTER_DATA_DIR}fluff-index.json`},
		{name: "bestiary metadata", url: `${MONSTER_DATA_DIR}legendarygroups.json`},
		{name: "adventures index", url: `${DATA_URL}adventures.json`},
		{name: "base items", url: `${DATA_URL}items-base.json`},
		{name: "item modifiers", url: `https://5e.tools/data/roll20-items.json`},
	];

	// add JSON index/metadata
	d20plus.pAddJson = async function () {
		d20plus.ut.log("Load JSON");

		try {
			await Promise.all(d20plus.json.map(async it => {
				const data = await DataUtil.loadJSON(it.url);

				if (it.name === "class index") classDataUrls = data;
				else if (it.name === "spell index") spellDataUrls = data;
				else if (it.name === "spell metadata") spellMetaData = data;
				else if (it.name === "bestiary index") monsterDataUrls = data;
				else if (it.name === "bestiary fluff index") monsterFluffDataUrls = data;
				else if (it.name === "bestiary metadata") monsterMetadata = data;
				else if (it.name === "adventures index") adventureMetadata = data;
				else if (it.name === "base items") {
					data.itemProperty.forEach(p => Renderer.item._addProperty(p));
					data.itemType.forEach(t => Renderer.item._addType(t));
				} else if (it.name === "item modifiers") itemMetadata = data;
				else throw new Error(`Unhandled data from JSON ${it.name} (${it.url})`);

				d20plus.ut.log(`JSON [${it.name}] loading...`);
			}));
		} catch (e) {
			d20plus.ut.log("Unhandled JSON load error", e);
		}
	};

	// Bind Graphics Add on page
	d20plus.bindGraphics = function (page) {
		d20plus.ut.log("Bind Graphics");
		try {
			if (page.get("archived") === false) {
				// Roll20 creates thegraphics and similar variables on page load, not page creation
				if (!page.thegraphics) {
					page.fullyLoadPage();
				}
				// #TODO Convert callback to async and load attribs if absent
				// Otherwise it won't add HP etc stats to new tokens, if sheet wasn't opened
				page.thegraphics.on("add", function (e) {
					let character = e.character;
					if (character) {
						let npc = character.attribs.find(function (a) {
							return a.get("name").toLowerCase() === "npc";
						});
						let isNPC = npc ? parseInt(npc.get("current")) : 0;
						// Set bars if configured to do so
						let barsList = ["bar1", "bar2", "bar3"];
						$.each(barsList, (i, barName) => {
							// PC config keys are suffixed "_pc"
							const confVal = d20plus.cfg.get("token", `${barName}${isNPC ? "" : "_pc"}`);
							if (confVal) {
								const charAttr = character.attribs.find(a => a.get("name").toLowerCase() === confVal);
								if (charAttr) {
									e.attributes[`${barName}_value`] = charAttr.get("current");
									if (d20plus.cfg.has("token", `${barName}_max`)) {
										if (d20plus.cfg.get("token", `${barName}_max`) && !isNPC && confVal === "hp") { // player HP is current; need to set max to max
											e.attributes[`${barName}_max`] = charAttr.get("max");
										} else {
											if (isNPC) {
												// TODO: Setting a value to empty/null does not overwrite existing values on the token.
												// setting a specific value does. Must figure this out.
												e.attributes[`${barName}_max`] = d20plus.cfg.get("token", `${barName}_max`) ? charAttr.get("current") : "";
											} else {
												// preserve default token for player tokens
												if (d20plus.cfg.get("token", `${barName}_max`)) {
													e.attributes[`${barName}_max`] = charAttr.get("current");
												}
											}
										}
									}
									if (d20plus.cfg.has("token", `${barName}_reveal`)) {
										e.attributes[`showplayers_${barName}`] = d20plus.cfg.get("token", `${barName}_reveal`);
									}
								}
							}
						});

						// NPC-only settings
						if (isNPC) {
							// Set Nametag
							if (d20plus.cfg.has("token", "name")) {
								e.attributes["showname"] = d20plus.cfg.get("token", "name");
								if (d20plus.cfg.has("token", "name_reveal")) {
									e.attributes["showplayers_name"] = d20plus.cfg.get("token", "name_reveal");
								}
							}

							// Roll HP
							// TODO: npc_hpbase appears to be hardcoded here? Refactor for NPC_SHEET_ATTRIBUTES?
							if ((d20plus.cfg.get("token", "rollHP") || d20plus.cfg.get("token", "maximiseHp")) && d20plus.cfg.getCfgKey("token", "npc_hpbase")) {
								let hpf = character.attribs.find(function (a) {
									return a.get("name").toLowerCase() === NPC_SHEET_ATTRIBUTES["npc_hpformula"][d20plus.sheet];
								});
								let barName = d20plus.cfg.getCfgKey("token", "npc_hpbase");

								if (hpf && hpf.get("current")) {
									let hpformula = hpf.get("current");
									if (d20plus.cfg.get("token", "maximiseHp")) {
										const maxSum = hpformula.replace("d", "*");
										try {
											// eslint-disable-next-line no-eval
											const max = eval(maxSum);
											if (!isNaN(max)) {
												e.attributes[`${barName}_value`] = max;
												e.attributes[`${barName}_max`] = max;
											}
										} catch (error) {
											d20plus.ut.log("Error Maximising HP");
											// eslint-disable-next-line no-console
											console.log(error);
										}
									} else {
										d20plus.ut.randomRoll(hpformula, function (result) {
											e.attributes[`${barName}_value`] = result.total;
											e.attributes[`${barName}_max`] = result.total;
											d20plus.ut.log(`Rolled HP for [${character.get("name")}]`);
										}, function (error) {
											d20plus.ut.log("Error Rolling HP Dice");
											// eslint-disable-next-line no-console
											console.log(error);
										});
									}
								}
							}
						}
					}
				});
			}
		} catch (e) {
			// eslint-disable-next-line no-console
			console.log("D20Plus bindGraphics Exception", e);
			// eslint-disable-next-line no-console
			console.log("PAGE", page);
		}
	};

	// bind token HP to initiative tracker window HP field
	d20plus.bindToken = function (token) {
		function getInitTrackerToken () {
			const $window = $("#initiativewindow");
			if (!$window.length) return [];
			return $window.find(`li.token`).filter((i, e) => {
				return $(e).data("tokenid") === token.id;
			});
		}

		const $initToken = getInitTrackerToken();
		if (!$initToken.length) return;
		const $iptHp = $initToken.find(`.hp.editable`);
		const npcFlag = token.character ? token.character.attribs.find((a) => {
			return a.get("name").toLowerCase() === "npc";
		}) : null;
		// if there's a HP column enabled
		if ($iptHp.length) {
			let toBind;
			if (!token.character || (npcFlag && `${npcFlag.get("current")}` === "1")) {
				const hpBar = d20plus.cfg5e.getCfgHpBarNumber();
				// and a HP bar chosen
				if (hpBar) {
					$iptHp.text(token.attributes[`bar${hpBar}_value`])
				}

				toBind = (token, changes) => {
					const $initToken = getInitTrackerToken();
					if (!$initToken.length) return;
					const $iptHp = $initToken.find(`.hp.editable`);
					const hpBar = d20plus.cfg5e.getCfgHpBarNumber();

					if ($iptHp && hpBar) {
						if (changes.changes[`bar${hpBar}_value`]) {
							$iptHp.text(token.changed[`bar${hpBar}_value`]);
						}
					}
				};
			} else {
				toBind = (token, changes) => {
					const $initToken = getInitTrackerToken();
					if (!$initToken.length) return;
					const $iptHp = $initToken.find(`.hp.editable`);
					if ($iptHp) {
						$iptHp.text(token.character.autoCalcFormula(d20plus.formulas[d20plus.sheet].hp));
					}
				}
			}
			// clean up old handler
			if (d20plus.tokenBindings[token.id]) token.off("change", d20plus.tokenBindings[token.id]);
			// add new handler
			d20plus.tokenBindings[token.id] = toBind;
			token.on("change", toBind);
		}
	};
	d20plus.tokenBindings = {};

	// Determine difficulty of current encounter (iniativewindow)
	d20plus.getDifficulty = function () {
		let difficulty = "Unknown";
		let partyXPThreshold = [0, 0, 0, 0];
		let players = [];
		let npcs = [];
		try {
			$.each(d20.Campaign.initiativewindow.cleanList(), function (i, v) {
				let page = d20.Campaign.pages.get(v._pageid);
				if (page) {
					let token = page.thegraphics.get(v.id);
					if (token) {
						let char = token.character;
						if (char) {
							let npc = char.attribs.find(function (a) {
								return a.get("name").toLowerCase() === "npc";
							});
							if (npc && (npc.get("current") === 1 || npc.get("current") === "1")) { // just in casies
								npcs.push(char);
							} else {
								let level = char.attribs.find(function (a) {
									return a.get("name").toLowerCase() === "level";
								});
								// Can't determine difficulty without level
								if (!level || partyXPThreshold === null) {
									partyXPThreshold = null;
									return;
								}
								// Total party threshold
								for (i = 0; i < partyXPThreshold.length; i++) partyXPThreshold[i] += Parser.levelToXpThreshold(level.get("current"))[i];
								players.push(players.length + 1);
							}
						}
					}
				}
			});
			if (!players.length) return difficulty;
			// If a player doesn't have level set, fail out.
			if (partyXPThreshold !== null) {
				const multipliers = [1, 1.5, 2, 2.5, 3, 4, 5];
				let len = npcs.length;
				let multiplier = 0;
				let adjustedxp = 0;
				let xp = 0;
				let index = 0;
				// Adjust for number of monsters
				if (len < 2) index = 0;
				else if (len < 3) index = 1;
				else if (len < 7) index = 2;
				else if (len < 11) index = 3;
				else if (len < 15) index = 4;
				else { index = 5; }
				// Adjust for smaller parties
				if (players.length < 3) index++;
				// Set multiplier
				multiplier = multipliers[index];
				// Total monster xp
				$.each(npcs, function (i, v) {
					let cr = v.attribs.find(function (a) {
						return a.get("name").toLowerCase() === "npc_challenge";
					});
					if (cr && cr.get("current")) xp += parseInt(Parser.crToXpNumber(cr.get("current")));
				});
				// Encounter's adjusted xp
				adjustedxp = xp * multiplier;
				// eslint-disable-next-line no-console
				console.log("Party XP Threshold", partyXPThreshold);
				// eslint-disable-next-line no-console
				console.log("Adjusted XP", adjustedxp);
				// Determine difficulty
				if (adjustedxp < partyXPThreshold[0]) difficulty = "Trivial";
				else if (adjustedxp < partyXPThreshold[1]) difficulty = "Easy";
				else if (adjustedxp < partyXPThreshold[2]) difficulty = "Medium";
				else if (adjustedxp < partyXPThreshold[3]) difficulty = "Hard";
				else difficulty = "Deadly";
			}
		} catch (e) {
			// eslint-disable-next-line no-console
			console.log("D20Plus getDifficulty Exception", e);
		}
		return difficulty;
	};

	d20plus.formSrcUrl = function (dataDir, fileName) {
		return dataDir + fileName;
	};

	d20plus.updateDifficulty = function () {
		const $initWindow = $("div#initiativewindow");
		if (!$initWindow.parent().is("body")) {
			const $btnPane = $initWindow.parent().find(".ui-dialog-buttonpane");

			let $span = $btnPane.find("span.difficulty");

			if (!$span.length) {
				$btnPane.prepend(d20plus.template5e.difficultyHtml);
				$span = $btnPane.find("span.difficulty");
			}

			if (d20plus.cfg.get("interface", "showDifficulty")) {
				$span.text(`Difficulty: ${d20plus.getDifficulty()}`);
				$span.show();
			} else {
				$span.hide();
			}
		}
	};

	// bind tokens to the initiative tracker
	d20plus.bindTokens = function () {
		// Gets a list of all the tokens on the current page:
		const curTokens = d20.Campaign.pages.get(d20.Campaign.activePage()).thegraphics.toArray();
		curTokens.forEach(t => {
			d20plus.bindToken(t);
		});
	};

	// bind drop locations on sheet to accept custom handouts
	d20plus.bindDropLocations = function () {
		if (window.is_gm) {
			// Bind Spells and Items, add compendium-item to each of them
			let journalFolder = d20.Campaign.get("journalfolder");
			if (journalFolder === "") {
				d20.journal.addFolderToFolderStructure("Spells");
				d20.journal.addFolderToFolderStructure("Psionics");
				d20.journal.addFolderToFolderStructure("Items");
				d20.journal.addFolderToFolderStructure("Feats");
				d20.journal.addFolderToFolderStructure("Classes");
				d20.journal.addFolderToFolderStructure("Subclasses");
				d20.journal.addFolderToFolderStructure("Backgrounds");
				d20.journal.addFolderToFolderStructure("Races");
				d20.journal.addFolderToFolderStructure("Optional Features");
				d20.journal.addFolderToFolderStructure("Deities");
				d20.journal.refreshJournalList();
				journalFolder = d20.Campaign.get("journalfolder");
			}
		}

		function addClasses (folderName) {
			$(`#journalfolderroot > ol.dd-list > li.dd-folder > div.dd-content:contains(${folderName})`).parent().find("ol li[data-itemid]").addClass("compendium-item").addClass("ui-draggable").addClass("Vetools-draggable");
		}

		addClasses("Spells");
		addClasses("Psionics");
		addClasses("Items");
		addClasses("Feats");
		addClasses("Classes");
		addClasses("Subclasses");
		addClasses("Backgrounds");
		addClasses("Races");
		addClasses("Optional Features");

		// ~~if player,~~ force-enable dragging
		$(`.Vetools-draggable`).each((i, e) => {
			d20plus.importer.bindFakeCompendiumDraggable($(e));
		});

		function importDataOGL (character, data, event) {
			// TODO remove feature import workarounds below when roll20 and sheets supports their drag-n-drop properly
			if (data.data.Category === "Feats") {
				d20plus.feats.importFeat(character, data);
			} else if (data.data.Category === "Backgrounds") {
				d20plus.backgrounds.importBackground(character, data);
			} else if (data.data.Category === "Races") {
				d20plus.races.importRace(character, data);
			} else if (data.data.Category === "Optional Features") {
				d20plus.optionalfeatures.importOptionalFeature(character, data);
			} else if (data.data.Category === "Classes") {
				d20plus.classes.importClass(character, data);
			} else if (data.data.Category === "Subclasses") {
				d20plus.subclasses.importSubclass(character, data);
			} else if (data.data.Category === "Psionics") {
				d20plus.psionics.importPsionicAbility(character, data);
			} else if (data.data.Category === "Items") {
				d20plus.items.importItem(character, data, event);
			} else if (data.data.Category === "Spells") {
				d20plus.spells.importSpells(character, data, event);
			} else {
				d20plus.importer.doFakeDrop(event, character, data);
			}
		}

		function importData (character, data, event) {
			const charModel = character.model || character;
			const sheetName = charModel.get ? charModel.get("charactersheetname")
				: charModel?.attributes?.charactersheetname;
			if (typeof d20plus.importer?.is2024Sheet === "function" && d20plus.importer.is2024Sheet(sheetName)) {
				if (typeof d20plus.importer?.import2024Data === "function") {
					d20plus.importer.import2024Data(character, data, event, importDataOGL);
					return;
				}
			}
			importDataOGL(character, data, event);
		}

		d20.Campaign.characters.models.each(function (v, i) {
			/* eslint-disable */

			// region BEGIN ROLL20 CODE
			v.view.compendiumDragOver = function (e, t) {
				if (this.popoutWindow) return
				this.$currentDropTarget = this.childWindow.d20.compendiumDragOver(e, t)

				// Cache the last drop target, since it has a habit of disappearing every other loop.
				// This probably breaks other things, but, who cares!
				if (this.$currentDropTarget) this._b20_$prevDropTarget = this.$currentDropTarget;
				if (!this.$currentDropTarget) this.$currentDropTarget = this._b20_$prevDropTarget;
			};
			// endregion END ROLL20 CODE

			v.view.bindCompendiumDropTarget = function () {
				if (this.popoutWindow) return;
				if (!this.$compendiumDropTarget) return; // 2024 sheet doesn't have this
				const e = this;

				this.$compendiumDropTarget.droppable({
					accept: ".compendium-item",
					tolerance: "pointer",
					over() {
						e.dragOver = !0
					},
					out() {
						e.dragOver = !1,
						e.childWindow.d20.deactivateDrop()
					},
					drop(t, i) {
						const characterid = $(".characterdialog").has(t.target).attr("data-characterid");
						const character = d20.Campaign.characters.get(characterid).view;
						const $hlpr = $(i.helper[0]);

						if ($hlpr.hasClass("handout")) {
							console.log("Handout item dropped onto target!");
							t.originalEvent.dropHandled = !0;
							if (e.activeDrop) {
								e.dragOver = !1;
                            	e.childWindow.d20.deactivateDrop();
							}

							if ($hlpr.hasClass(`player-imported`)) {
								const data = d20plus.importer.retrievePlayerImport($hlpr.attr("data-playerimportid"));
								importData(character, data, t);
							} else {
								var id = $hlpr.attr("data-itemid");
								var handout = d20.Campaign.handouts.get(id);
								var data = "";

								// Take a JSON that may be a URI encoded string and return it in non URI format
								function decodeIfURI (notes) {
									if (!notes) return "";

									if (notes.charAt(0) == "%") return decodeURIComponent(notes);

									return notes;
								}

								if (window.is_gm) {
									handout._getLatestBlob("gmnotes", function (gmnotes) {
										data = decodeIfURI(gmnotes);
										handout.updateBlobs({gmnotes: gmnotes});
										importData(character, JSON.parse(data), t);
									});
								} else {
									handout._getLatestBlob("notes", function (notes) {
										data = $(decodeIfURI(notes)).filter("del").html();
										importData(character, JSON.parse(data), t);
									});
								}
							}
							return;
						}

						console.log("Compendium item dropped onto target!");
						// region BEGIN ROLL20 CODE
						t.originalEvent.dropHandled = !0,
						e.activeDrop && (e.dragOver = !1,
						e.childWindow.d20.deactivateDrop(),
						e.$currentDropTarget && window.wantsToReceiveDrop(this, t, ()=>{
								const t = $(i.helper[0]).attr("data-pagename"),
								n = $(i.helper[0]).attr("data-subhead"),
								v = $(i.helper[0]).attr('data-expansionid');
								$.ajax({
									url: "/compendium/compendium/getPages",
									data: {
										bookName: d20.compendium.shortName,
										pages: [t],
										sharedCompendium: campaign_id,
										expansionId: v,
										dragDropRequest: !0
									},
									cache: !1,
									dataType: "JSON"
								}).done(i=>{
										const o = JSON.parse(i[0]),
										r = _.clone(o.data);
										r.Name = o.name,
										r.data = o.data,
										r.data = JSON.stringify(r.data),
										r.uniqueName = t,
										r.Content = o.content,
										r.dropSubhead = n,
										e.$currentDropTarget.find("*[accept]").each(function() {
											const t = $(this),
											i = t.attr("accept");
											r[i] && ("input" === t[0].tagName.toLowerCase() && "checkbox" === t.attr("type") || "input" === t[0].tagName.toLowerCase() && "radio" === t.attr("type") ? t.val() === r[i] ? t.prop("checked", !0) : t.prop("checked", !1) : "select" === t[0].tagName.toLowerCase() ? t.find("option").each(function() {
												const e = $(this);
												e.val() !== r[i] && e.text() !== r[i] || e.prop("selected", !0)
											}) : $(this).val(r[i]),
												e.saveSheetValues(this, "compendium"))
										})
									}
								)
							}
						))
						// endregion END ROLL20 CODE
					}
				})
			}

			/* eslint-enable */
		});

		// region 2024 Jumpgate sheet drag-drop support
		// The 2024 sheet is an iframe with id="advanced-charsheet-dialog__charsheet"
		// and name="iframe_<characterId>" - we make the parent droppable
		function bind2024SheetDropTarget ($iframe) {
			const $dropTarget = $iframe.closest(".characterdialog[data-characterid]");
			if (!$dropTarget.length) return;
			if ($dropTarget.data("b20-droppable-2024")) return;
			$dropTarget.data("b20-droppable-2024", true);

			$dropTarget.droppable({
				accept: ".compendium-item",
				tolerance: "pointer",
				drop (t, i) {
					t.originalEvent.dropHandled = true;

					// Extract character ID from iframe name: "iframe_-OmXOQN5oXtFp-BQBa0A" -> "-OmXOQN5oXtFp-BQBa0A"
					const charId = $iframe.attr("name").replace("iframe_", "");
					const charModel = d20.Campaign.characters.get(charId);
					if (!charModel) {
						console.warn("betterR20: Could not find character for 2024 sheet drop, ID:", charId);
						return;
					}
					const charView = charModel.view;
					const $hlpr = $(i.helper[0]);

					function decodeIfURI (notes) {
						if (!notes) return "";
						return notes.charAt(0) === "%" ? decodeURIComponent(notes) : notes;
					}

					if ($hlpr.hasClass("player-imported")) {
						const data = d20plus.importer.retrievePlayerImport($hlpr.attr("data-playerimportid"));
						if (data) importData(charView, data, t);
						else console.warn("betterR20: Player import data not found. Please re-import.");
						return;
					}

					if (!$hlpr.hasClass("handout")) return;

					const handout = d20.Campaign.handouts.get($hlpr.attr("data-itemid"));
					if (!handout) return;
					if (window.is_gm) {
						handout._getLatestBlob("gmnotes", function (gmnotes) {
							importData(charView, JSON.parse(decodeIfURI(gmnotes)), t);
						});
					} else {
						handout._getLatestBlob("notes", function (notes) {
							importData(charView, JSON.parse($(decodeIfURI(notes)).filter("del").html()), t);
						});
					}
				},
			});
		}

		function bindOGLSheetDropTarget ($iframe) {
			const $dropTarget = $iframe.closest(".characterdialog[data-characterid]");
			if (!$dropTarget.length) return;
			if ($dropTarget.data("b20-droppable-ogl")) return;
			$dropTarget.data("b20-droppable-ogl", true);

			$dropTarget.droppable({
				accept: ".compendium-item",
				tolerance: "pointer",
				drop (t, i) {
					if (t.originalEvent.dropHandled) return;
					t.originalEvent.dropHandled = true;
					const characterid = $dropTarget.attr("data-characterid");
					const charModel = d20.Campaign.characters.get(characterid);
					if (!charModel) return;
					const charView = charModel.view;
					const $hlpr = $(i.helper[0]);

					function decodeIfURI (notes) {
						if (!notes) return "";
						return notes.charAt(0) === "%" ? decodeURIComponent(notes) : notes;
					}

					if ($hlpr.hasClass("player-imported")) {
						const data = d20plus.importer.retrievePlayerImport($hlpr.attr("data-playerimportid"));
						if (data) importData(charView, data, t);
						else console.warn("betterR20: Player import data not found. Please re-import.");
						return;
					}

					if (!$hlpr.hasClass("handout")) return;

					const handout = d20.Campaign.handouts.get($hlpr.attr("data-itemid"));
					if (!handout) return;
					if (window.is_gm) {
						handout._getLatestBlob("gmnotes", function (gmnotes) {
							importData(charView, JSON.parse(decodeIfURI(gmnotes)), t);
						});
					} else {
						handout._getLatestBlob("notes", function (notes) {
							importData(charView, JSON.parse($(decodeIfURI(notes)).filter("del").html()), t);
						});
					}
				},
			});
		}
		d20plus._bindOGLSheetDropTarget = bindOGLSheetDropTarget;

		// Store so MutationObserver always calls the latest (captures importData closure)
		d20plus._bind2024SheetDropTarget = bind2024SheetDropTarget;

		// Bind any already-open 2024 sheets
		$("iframe[id='advanced-charsheet-dialog__charsheet']").each(function () {
			bind2024SheetDropTarget($(this));
		});

		// Watch for new 2024 sheet iframes being added to the DOM
		if (!d20plus._observer2024) {
			d20plus._observer2024 = new MutationObserver(function (mutations) {
				mutations.forEach(function (m) {
					m.addedNodes.forEach(function (node) {
						if (node.nodeType !== 1) return;
						const $n = $(node);
						if ($n.is("iframe[id='advanced-charsheet-dialog__charsheet']")) {
							d20plus._bind2024SheetDropTarget($n);
						}
						$n.find("iframe[id='advanced-charsheet-dialog__charsheet']").each(function () {
							d20plus._bind2024SheetDropTarget($(this));
						});

						// OGL iframes in mixed games (any iframe inside a characterdialog that isn't the 2024 sheet)
						if ($n.is("iframe:not([id='advanced-charsheet-dialog__charsheet'])")) {
							const $dialog = $n.closest(".characterdialog[data-characterid]");
							if ($dialog.length) d20plus._bindOGLSheetDropTarget($n);
						}
						$n.find("iframe:not([id='advanced-charsheet-dialog__charsheet'])").each(function () {
							const $dialog = $(this).closest(".characterdialog[data-characterid]");
							if ($dialog.length) d20plus._bindOGLSheetDropTarget($(this));
						});
					});
				});
			});
			d20plus._observer2024.observe(document.body, {childList: true, subtree: true});
		}
		// endregion
	};

	// Create editable HP variable and autocalculate + or -
	d20plus.hpAllowEdit = function () {
		$("#initiativewindow").on(window.mousedowntype, ".hp.editable", function () {
			if ($(this).find("input").length > 0) return void $(this).find("input").focus();
			let val = $.trim($(this).text());
			const $span = $(this);
			$span.html(`<input type='text' value='${val}'/>`);
			const $ipt = $(this).find("input");
			$ipt[0].focus();
		});
		$("#initiativewindow").on("keydown", ".hp.editable", function (event) {
			if (event.which === 13) {
				const $span = $(this);
				const $ipt = $span.find("input");
				if (!$ipt.length) return;

				let el; let token; let id; let char; let hp;
				let val = $.trim($ipt.val());

				// roll20 token modification supports plus/minus for a single integer; mimic this
				const m = /^((\d+)?([+-]))?(\d+)$/.exec(val);
				if (m) {
					let op = null;
					if (m[3]) {
						op = m[3] === "+" ? "ADD" : "SUB";
					}
					// eslint-disable-next-line no-eval
					const base = m[2] ? eval(m[0]) : null;
					const mod = Number(m[4]);

					el = $(this).parents("li.token");
					id = el.data("tokenid");
					token = d20.Campaign.pages.get(d20.Campaign.activePage()).thegraphics.get(id);
					char = token.character;

					npc = char.attribs ? char.attribs.find(function (a) {
						return a.get("name").toLowerCase() === "npc";
					}) : null;
					let total;
					// char.attribs doesn't exist for generico tokens, in this case stick stuff in an appropriate bar
					if (!char.attribs || (npc && `${npc.get("current")}` === "1")) {
						const hpBar = d20plus.cfg5e.getCfgHpBarNumber();
						if (hpBar) {
							if (base !== null) {
								total = base;
							} else if (op) {
								const curr = token.attributes[`bar${hpBar}_value`];
								if (op === "ADD") total = curr + mod;
								else total = curr - mod;
							} else {
								total = mod;
							}
							token.attributes[`bar${hpBar}_value`] = total;
						}
					} else {
						hp = char.attribs.find(function (a) {
							return a.get("name").toLowerCase() === "hp";
						});
						if (hp) {
							if (base !== null) {
								total = base;
							} else if (op) {
								if (op === "ADD") total = hp.attributes.current + mod;
								else total = hp.attributes.current - mod;
							} else {
								total = mod;
							}
							hp.syncedSave({current: total});
						} else {
							if (base !== null) {
								total = base;
							} else if (op) {
								if (op === "ADD") total = mod;
								else total = 0 - mod;
							} else {
								total = mod;
							}
							char.attribs.create({name: "hp", current: total});
						}
					}
					// convert the field back to text
					$span.html(total);
				}
				d20.Campaign.initiativewindow.rebuildInitiativeList();
			}
		});
	};

	// Change character sheet formulas
	d20plus.setSheet = function () {
		d20plus.ut.log("Switched Character Sheet Template");
		d20plus.sheet = "ogl";
		const sheets = d20.journal.characterSheetsManager.getAllSheets();
		const noSheetsFound = !Array.isArray(sheets) && sheets.length < 1;
		if (window.is_gm && noSheetsFound) {
			d20plus.ut.showFullScreenWarning({
				title: "NO CHARACTER SHEET",
				message: "Your game does not have a character sheet template selected",
				instructions: "Please either disable betteR20, or visit the settings page for your game to choose one. We recommend the OGL sheet, which is listed as &quot;D&D 5E by Roll20.&quot;",
			});
			throw new Error("No character sheet selected!");
		}
		const firstSheet = d20.journal.customSheets ?? sheets.first();
		if (d20.journal.characterSheetsManager.sheets.shaped_d20) d20plus.sheet = "shaped";
		if (d20.journal.characterSheetsManager.sheets.DnD5e_Character_Sheet) d20plus.sheet = "community";
		d20plus.ut.log(`Switched Character Sheet Template to ${d20plus.sheet}`);
	};
	// Build the standard initiative tracker, then decorate it with extra columns.
	//
	// NOTE: Earlier versions swapped Roll20's compiled `#tmpl_initiativecharacter`
	// template and installed a global `error` listener that re-ran the (legacy)
	// rebuild with the wrong `this` binding. On Jumpgate this corrupted the turn
	// order, so it was disabled ("Temp Fix turn order issue"). We now leave
	// Roll20's own rendering completely untouched and only add columns to the
	// already-rendered DOM, in a best-effort/try-catch fashion. This means the
	// turn order can never be broken by this feature, even if Roll20 changes.

	// Resolve the token model for a rendered `li.token` row.
	d20plus.getTrackerToken = function ($li, tokenId) {
		tokenId = tokenId || $li.data("tokenid");
		if (!tokenId) return null;

		let pageId = d20.Campaign.activePage();
		try {
			const order = d20.Campaign.currentOrderArray || [];
			const idx = $li.data("currentindex");
			let entry = (idx != null && order[idx] && order[idx].id === tokenId) ? order[idx] : null;
			if (!entry) entry = order.find(it => it && it.id === tokenId);
			if (entry && entry._pageid) pageId = entry._pageid;
		} catch (e) { /* ignore */ }

		const page = d20.Campaign.pages.get(pageId);
		let token = (page && page.thegraphics) ? page.thegraphics.get(tokenId) : null;
		if (!token) {
			// the turn order may reference a token on a non-active page
			try {
				d20.Campaign.pages.each(p => {
					if (!token && p.thegraphics) token = p.thegraphics.get(tokenId);
				});
			} catch (e) { /* ignore */ }
		}
		return token || null;
	};

	d20plus.trackerColHeader = function (col) {
		switch (col) {
			case "HP": return "HP";
			case "AC": return "AC";
			case "Passive Perception": return "PP";
			case "Spell DC": return "DC";
			default: return "";
		}
	};

	// Build a single column <span> (as an HTML string) for a given row.
	d20plus.getTrackerColSpan = function (col, token, char, npc, pending) {
		// `pending` === the character's attributes haven't loaded yet (fresh page
		// load). Show an empty column rather than a misleading "\u2014", and let the
		// deferred redraw (fired when the fetch completes) fill in the real value.
		if (pending) {
			switch (col) {
				case "HP": return `<span class='hp editable tracker-col' alt='HP' title='HP'></span>`;
				case "AC": return `<span class='ac tracker-col' alt='AC' title='AC'></span>`;
				case "Passive Perception": return `<span class='pp tracker-col' alt='Passive Perception' title='Passive Perception'></span>`;
				case "Spell DC": return `<span class='dc tracker-col' alt='Spell DC' title='Spell DC'></span>`;
				default: return `<span class="tracker-col"></span>`;
			}
		}

		const EMDASH = "\u2014";
		const formulas = (d20plus.formulas && d20plus.formulas[d20plus.sheet]) || {};
		const hasCalc = !!(char && typeof char.autoCalcFormula === "function");
		const isNpc = !!(npc && `${npc.get("current")}` === "1");

		const calc = (formula) => {
			if (!hasCalc || !formula) return null;
			try {
				const v = char.autoCalcFormula(formula);
				return (v === undefined || v === null || v === "") ? null : v;
			} catch (e) { return null; }
		};
		const esc = (v) => $("<div>").text(v == null ? "" : v).html();

		switch (col) {
			case "HP": {
				let val;
				const hpBar = d20plus.cfg5e.getCfgHpBarNumber();
				if (isNpc || !hasCalc) {
					val = (hpBar && token && token.attributes) ? token.attributes[`bar${hpBar}_value`] : "";
					if (val === undefined || val === null) val = isNpc ? "" : EMDASH;
				} else {
					val = calc(formulas.hp);
					if (val == null) val = EMDASH;
				}
				return `<span class='hp editable tracker-col' alt='HP' title='HP'>${esc(val)}</span>`;
			}
			case "AC": {
				let val;
				if (isNpc && hasCalc) val = calc(formulas.npcac);
				else if (hasCalc) val = calc(formulas.ac);
				if (val == null) val = EMDASH;
				return `<span class='ac tracker-col' alt='AC' title='AC'>${esc(val)}</span>`;
			}
			case "Passive Perception": {
				let val = EMDASH;
				if (hasCalc) {
					val = calc("@{passive}");
					if (val == null) val = calc(formulas.pp);
					if (val == null) val = EMDASH;
				}
				return `<span class='pp tracker-col' alt='Passive Perception' title='Passive Perception'>${esc(val)}</span>`;
			}
			case "Spell DC": {
				let val = EMDASH;
				if (hasCalc) {
					val = calc(formulas.spellDc);
					if (val == null) val = EMDASH;
				}
				return `<span class='dc tracker-col' alt='Spell DC' title='Spell DC'>${esc(val)}</span>`;
			}
			default:
				return `<span class="tracker-col"></span>`;
		}
	};

	// Hidden CR span, kept for parity with the original markup/CSS.
	d20plus.getTrackerCrSpan = function (char, npc) {
		let cr = "";
		try {
			if (npc && `${npc.get("current")}` === "1" && char && char.attribs) {
				const crAttr = char.attribs.find(a => a.get("name").toLowerCase() === "npc_challenge");
				if (crAttr) cr = crAttr.get("current");
			}
		} catch (e) { /* ignore */ }
		return `<span class='cr' alt='CR' title='CR'>${$("<div>").text(cr == null ? "" : cr).html()}</span>`;
	};

	// Ensure the header row exists above the character list.
	d20plus.ensureTrackerHeader = function () {
		const $window = $("#initiativewindow");
		if (!$window.length) return;
		if ($window.find(".init-header").length) return;
		const $list = $window.find(".characterlist");
		if ($list.length) $list.before(d20plus.template5e.initiativeHeaders);
		else $window.prepend(d20plus.template5e.initiativeHeaders);
	};

	// Decorate one rendered token row with the configured columns.
	d20plus.decorateTrackerRow = function ($li, cols) {
		// clean up anything we may have added on a previous pass
		$li.find(".tracker-extra-columns").remove();
		$li.children(".initmacro.b20-init-macro").remove();

		const tokenId = $li.data("tokenid");
		const token = d20plus.getTrackerToken($li, tokenId);
		const char = token ? token.character : null;

		// On a fresh page load Roll20 hasn't loaded a character's attributes until
		// something (e.g. opening its sheet) forces it, so autoCalcFormula returns
		// nothing and every column would read "\u2014". Detect that here, kick off a
		// background fetch, and render the columns blank for now; the fetch's
		// completion schedules a redraw that fills in the real values. NPC detection
		// itself needs the attributes, so when they're missing we treat the whole
		// row as pending.
		const attribsLoaded = !!(char && char.attribs && char.attribs.length);
		let pending = false;
		if (char && char.attribs && !char.attribs.length) {
			const cid = char.id || (char.attributes && char.attributes.id);
			if (d20plus._trackerAttribState[cid] !== "failed") {
				pending = true;
				d20plus.requestTrackerAttribs(char);
			}
		}

		const npc = attribsLoaded
			? char.attribs.find(a => a.get("name").toLowerCase() === "npc")
			: null;

		// optional sheet-macro button (prepended so it floats furthest right)
		if (d20plus.cfg.get("interface", "trackerSheetButton")) {
			const $macro = $(`<span alt='Sheet Macro' title='Sheet Macro' class='initmacro b20-init-macro'><button type='button' class='initmacrobutton ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only pictos' role='button' aria-disabled='false'><span class='ui-button-text'>N</span></button></span>`);
			$macro.find(".initmacrobutton").on("click", function () {
				const $row = $(this).closest("li.token");
				const tk = d20plus.getTrackerToken($row, $row.data("tokenid"));
				const ch = tk ? tk.character : null;
				if (ch && ch.view && ch.view.showDialog) ch.view.showDialog();
			});
			$li.prepend($macro);
		}

		// build column spans; cr first, then the configured columns, then reverse
		// (float:right means later DOM elements appear further left, so this keeps
		// the visual order matching the header)
		const colSpans = [d20plus.getTrackerCrSpan(char, npc)];
		cols.forEach(c => colSpans.push(d20plus.getTrackerColSpan(c, token, char, npc, pending)));
		const inner = colSpans.reverse().join("\n");

		const $extra = $(`<div class="tracker-extra-columns">${inner}</div>`);
		const $init = $li.children(".initiative").first();
		if ($init.length) $extra.insertAfter($init);
		else $li.prepend($extra);
	};

	// Add the extra columns + headers to the (already rendered) initiative window.
	d20plus.addTrackerInfo = function () {
		const $window = $("#initiativewindow");
		if (!$window.length) return;

		d20plus.ensureTrackerHeader();

		const useCustom = d20plus.cfg.get("interface", "customTracker");
		if (!useCustom) {
			$(".init-header").hide();
			$window.find(".tracker-extra-columns").remove();
			$window.find("li.token > .initmacro.b20-init-macro").remove();
			return;
		}

		$(".init-header").show();
		if (d20plus.cfg.get("interface", "trackerSheetButton")) $(".init-sheet-header").show();
		else $(".init-sheet-header").hide();
		$(".init-init-header").show();

		const cols = [
			d20plus.cfg.get("interface", "trackerCol1"),
			d20plus.cfg.get("interface", "trackerCol2"),
			d20plus.cfg.get("interface", "trackerCol3"),
		];

		// (re)populate header labels
		const $header = $(".tracker-header-extra-columns");
		$header.empty();
		cols.forEach(c => $header.prepend(`<span class='tracker-col'>${d20plus.trackerColHeader(c)}</span>`));

		// decorate every token row
		$window.find("li.token").each((i, el) => {
			try { d20plus.decorateTrackerRow($(el), cols); } catch (e) { /* per-row safety */ }
		});
	};

	// Tracks per-character attribute loading so we never fetch the same character
	// twice and never loop: "pending" while fetching, "done" once loaded, "failed"
	// if the fetch times out (a character genuinely without attributes).
	d20plus._trackerAttribState = {};
	d20plus.requestTrackerAttribs = function (char) {
		const id = char && (char.id || (char.attributes && char.attributes.id));
		if (!id) return;
		const st = d20plus._trackerAttribState[id];
		if (st === "pending" || st === "failed") return;
		d20plus._trackerAttribState[id] = "pending";
		Promise.resolve(d20plus.ut.fetchCharAttribs(char))
			.then((res) => {
				d20plus._trackerAttribState[id] = res ? "done" : "failed";
				// redraw so the freshly-loaded values replace the blank placeholders
				d20plus.scheduleTrackerRedraw();
			})
			.catch(() => {
				d20plus._trackerAttribState[id] = "failed";
				d20plus.scheduleTrackerRedraw();
			});
	};

	// A debounced, deferred re-render. Adding/removing a creature re-renders the
	// turn order before its data has settled, so the first render shows blank
	// columns and an initiative of 0; Roll20 only fixes itself on the next
	// interaction (going to the next/previous turn re-runs rebuildInitiativeList
	// once the data is ready). We reproduce that automatically here: after the
	// turn order changes we wait for it to settle, then re-run the (overridden)
	// rebuild exactly once. rebuildInitiativeList only reads the model and paints
	// the DOM -- it never writes the turn order -- so this cannot loop.
	d20plus._trackerRedrawTimer = null;
	d20plus.scheduleTrackerRedraw = function (delay) {
		if (d20plus._trackerRedrawTimer) clearTimeout(d20plus._trackerRedrawTimer);
		d20plus._trackerRedrawTimer = setTimeout(function () {
			d20plus._trackerRedrawTimer = null;
			try {
				if (d20.Campaign && d20.Campaign.initiativewindow) {
					d20.Campaign.initiativewindow.rebuildInitiativeList();
				}
			} catch (e) { /* ignore */ }
		}, delay == null ? 150 : delay);
	};

	d20plus.setTurnOrderTemplate = function () {
		// cache Roll20's own render function once
		if (!d20plus.turnOrderCachedFunction) {
			d20plus.turnOrderCachedFunction = d20.Campaign.initiativewindow.rebuildInitiativeList;
		}

		d20.Campaign.initiativewindow.rebuildInitiativeList = function (...args) {
			// Always let Roll20 render its list first; never touch its template.
			const results = d20plus.turnOrderCachedFunction.apply(this, args);

			// Then add our columns. Wrapped so a failure here can't break the tracker.
			try {
				d20plus.addTrackerInfo();
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error("betteR20: failed to add tracker info", e);
			}

			// (re)bind token HP fields once the rows exist
			setTimeout(function () {
				try { d20plus.bindTokens(); } catch (e) { /* ignore */ }
			}, 100);

			return results;
		};

		// Heal the "added/removed creature blanks the tracker" case: re-render once
		// the turn order has settled. Guard so we only ever bind this handler once.
		if (!d20plus._trackerRedrawBound) {
			d20plus._trackerRedrawBound = true;
			d20.Campaign.initiativewindow.model.on("change:turnorder", function () {
				d20plus.scheduleTrackerRedraw();
			});
			// A token leaving/joining the active page can change the tracker without
			// a turnorder edit (e.g. deleting a token that has a turn); cover that too.
			try {
				const page = d20.Campaign.pages.get(d20.Campaign.activePage());
				if (page && page.thegraphics) {
					page.thegraphics.on("add remove", function () {
						if (d20.Campaign.initiativewindow.model.attributes.initiativepage) {
							d20plus.scheduleTrackerRedraw();
						}
					});
				}
			} catch (e) { /* ignore */ }
		}

		const getTargetWidth = () => d20plus.cfg.get("interface", "minifyTracker") ? 250 : 350;
		// wider tracker
		const cachedDialog = d20.Campaign.initiativewindow.$el.dialog;
		d20.Campaign.initiativewindow.$el.dialog = (...args) => {
			const widen = d20plus.cfg.get("interface", "customTracker");
			if (widen && args[0] && args[0].width) {
				args[0].width = getTargetWidth();
			}
			cachedDialog.bind(d20.Campaign.initiativewindow.$el)(...args);
		};

		// if the tracker is already open, widen it
		if (d20.Campaign.initiativewindow.model.attributes.initiativepage) d20.Campaign.initiativewindow.$el.dialog("option", "width", getTargetWidth());
	};
};

SCRIPT_EXTENSIONS.push(betteR205etoolsMain);
