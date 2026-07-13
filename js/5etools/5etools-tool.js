function tools5eTool () {
	// Add the array of tools that are 5e only to the tools array
	d20plus.tool.tools = d20plus.tool.tools.concat([
		{
			toolId: "JSON",
			name: "JSON Importer",
			desc: "Import 5etools JSON files from url or file upload",
			html: `
					<div id="d20plus-json-importer" title="Better20 - JSON Importer">
					<p style="margin-bottom: 4px;">
						<b style="font-size: 110%;">Importer:</b>
						<button class="btn readme" style="float: right;">Help/README</button>
						<div style="clear: both;"></div>
					</p>
					<div style="border-bottom: 1px solid #ccc; margin-bottom: 3px; padding-bottom: 3px;">
						<input type="text" id="import-json-url">
						<p><a class="btn" href="#" id="button-json-load-url">Load From URL</a></p>
						<p><a class="btn" href="#" id="button-json-load-file">Load From File</a></p>
					</div>
					<div>
						<div name="data-loading-message"></div>
						<select name="data-type" disabled style="margin-bottom: 0;">
						<!-- populate with JS-->
						</select>
						<button class="btn" name="view-select-entries">View/Select Entries</button>
					</div>
					</div>

					<div id="d20plus-json-importer-help" title="Readme">
						<p>First, either enter the url for a JSON in 5etools format, or upload one from a file. Then, choose the category you wish to import, and "View/Select Entries." You'll need to import items in each category separately.</p>
						<p>This tool is mainly meant to allow homebrew files to be uploaded for every category without taking too much space.</p>
						<p>If you're looking for a repository of homebrew files, one can be found <a href="https://github.com/TheGiddyLimit/homebrew" target="_blank">here</a>. To get an importable url, click on the file you want, then click the button that says "Raw" and use that url.</p>
					</div>
					`,
			dialogFn: () => {
				$("#d20plus-json-importer").dialog({
					autoOpen: false,
					resizable: true,
					width: 750,
					height: 360,
				});
				$("#d20plus-json-importer-help").dialog({
					autoOpen: false,
					resizable: true,
					width: 600,
					height: 400,
				});
			},
			openFn: () => {
				const $win = $("#d20plus-json-importer");
				$win.dialog("open");


				const $winHelp = $(`#d20plus-json-importer-help`);

				const $btnViewCat = $win.find(`[name="view-select-entries"]`).off("click").click(handleLoadedData).prop("disabled", true);
				const $btnSelAllContent = $win.find(`[name="select-all-entries"]`).off("click").prop("disabled", true);

				const $selDataType = $win.find(`[name="data-type"]`).prop("disabled", true);
				let lastLoadedData = null;

				// The main function that's called with the import button gets clicked
				async function handleLoadedData () {
					const lastDataType = $selDataType.val();
					const cat = IMPORT_CATEGORIES.find(ic => ic.name === lastDataType);
					const optionsContainer = d20plus[cat.plural];
					let overrideData = null;
					let extraOptions = {};

					// Handle special cases where certain items need extra data
					switch (lastDataType) {
						case "class":
							x = lastLoadedData
							overrideData = await lastLoadedData.class
								.pSerialAwaitMap(cls => DataLoader.pCacheAndGet("class", cls.source, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](cls), {isCopy: true}));
							extraOptions["builderOptions"] = {
								isHomebrew: true,
							}
							break;
						case "subclass":
							overrideData = await lastLoadedData.subclass
								.pSerialAwaitMap(cls => DataLoader.pCacheAndGet("subclass", cls.source, UrlUtil.URL_TO_HASH_BUILDER["subclass"](cls), {isCopy: true}));
							break;
						default:
							break;
					}

					const handoutBuilder = optionsContainer["handoutBuilder"];

					// Similar to the showImportList functions when buttons are pressed
					await d20plus.importer.showImportList(
                        lastDataType,
                        overrideData || lastLoadedData[lastDataType],
                        handoutBuilder,
                        {
                            groupOptions: optionsContainer._groupOptions,
                            listItemBuilder: optionsContainer._listItemBuilder,
                            listIndex: optionsContainer._listCols,
                            listIndexConverter: optionsContainer._listIndexConverter,
                            ...extraOptions,
                        },
                    );
				}

				// Populate the dropdown menu that allows you to choose the category
				function populateDropdown (cats) {
					$selDataType.empty();
					cats.forEach(c => {
						$selDataType.append(`<option value="${c.name}">${c.titlePl || c.plural.toTitleCase()}</option>`)
					});

					// Disable buttons if there are no valid categories to import
					const disable = !cats.length;
					$btnViewCat.prop("disabled", disable);
					$btnSelAllContent.prop("disabled", disable);
					$selDataType.prop("disabled", disable);
				}

				// Load from url
				const $btnLoadUrl = $(`#button-json-load-url`);
				$btnLoadUrl.off("click").click(async () => {
					const url = $("#import-json-url").val();
					if (url && url.trim()) {
						DataUtil.loadJSON(url).then(data => {
							const cats = IMPORT_CATEGORIES.filter(ic => ic.name in data && !ic.uniqueImport);
							populateDropdown(cats);
							lastLoadedData = data;
						});
					}
				});

				// Load from file
				const $btnLoadFile = $(`#button-json-load-file`);
				$btnLoadFile.off("click").click(async () => {
					const allFiles = await InputUiUtil.pGetUserUploadJson();
					// Due to the new util functon, need to account for data being an array
					const data = allFiles.jsons.find(Boolean);
					const cats = IMPORT_CATEGORIES.filter(ic => ic.name in data && !ic.uniqueImport);
					populateDropdown(cats);
					lastLoadedData = data;
				});
			},
		},
		{
			name: "Shapeshifter Token Builder",
			desc: "Build a rollable table and related token to represent a shapeshifting creature.",
			html: `
				<div id="d20plus-shapeshiftbuild" title="Better20 - Shapeshifter Token Builder">
					<div id="shapeshiftbuild-list">
						<input type="search" class="search" placeholder="Search creatures...">
						<input type="search" class="filter" placeholder="Filter...">
						<span title="Filter format example: 'cr:1/4; cr:1/2; type:beast; source:MM'" style="cursor: help;">[?]</span>
						<div class="list" style="transform: translateZ(0); max-height: 490px; overflow-y: auto; overflow-x: hidden;"><i>Loading...</i></div>
					</div>
				<br>
				<input id="shapeshift-name" placeholder="Table name">
				<button class="btn">Create Table</button>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-shapeshiftbuild").dialog({
					autoOpen: false,
					resizable: true,
					width: 800,
					height: 650,
				});
			},
			openFn: async () => {
				const $win = $("#d20plus-shapeshiftbuild");
				$win.dialog("open");

				const toLoad = Object.keys(monsterDataUrls).map(src => d20plus.monsters.formMonsterUrl(monsterDataUrls[src]));

				const $fltr = $win.find(`.filter`);
				$fltr.off("keydown").off("keyup");
				$win.find(`button`).off("click");

				const $lst = $win.find(`.list`);
				let tokenList;

				const dataStack = (await Promise.all(toLoad.map(url => DataUtil.loadJSON(url)))).flat();

				$lst.empty();
				let toShow = [];

				const seen = {};
				await Promise.all(dataStack.map(async d => {
					const toAdd = d.monster.filter(m => {
						const out = !(seen[m.source] && seen[m.source].has(m.name));
						if (!seen[m.source]) seen[m.source] = new Set();
						seen[m.source].add(m.name);
						return out;
					});

					toShow = toShow.concat(toAdd);
				}));

				toShow = toShow.sort((a, b) => SortUtil.ascSort(a.name, b.name));

				let tmp = "";
				toShow.forEach((m, i) => {
					m.__pType = Parser.monTypeToFullObj(m.type).asText;

					tmp += `
								<label class="import-cb-label" data-listid="${i}">
									<input type="checkbox">
									<span class="name col-4">${m.name}</span>
									<span class="type col-4">TYP[${m.__pType.uppercaseFirst()}]</span>
									<span class="cr col-2">${m.cr === undefined ? "CR[Unknown]" : `CR[${(m.cr.cr || m.cr)}]`}</span>
									<span title="${Parser.sourceJsonToFull(m.source)}" class="source">SRC[${Parser.sourceJsonToAbv(m.source)}]</span>
								</label>
							`;
				});
				$lst.html(tmp);
				tmp = null;

				tokenList = new List("shapeshiftbuild-list", {
					valueNames: ["name", "type", "cr", "source"],
				});

				d20plus.importer.addListFilter($fltr, toShow, tokenList, d20plus.monsters._listIndexConverter);

				$win.find(`button`).on("click", () => {
					function getSizeInTiles (size) {
						switch (size) {
							case Parser.SZ_TINY:
								return 0.5;
							case Parser.SZ_SMALL:
							case Parser.SZ_MEDIUM:
								return 1;
							case Parser.SZ_LARGE:
								return 2;
							case Parser.SZ_HUGE:
								return 3;
							case Parser.SZ_GARGANTUAN:
								return 4;
							case Parser.SZ_COLOSSAL:
								return 5;
						}
					}

					if (tokenList) {
						$("a.ui-tabs-anchor[href='#deckstables']").trigger("click");

						const sel = tokenList.items
							.filter(it => $(it.elm).find(`input`).prop("checked"))
							.map(it => toShow[$(it.elm).attr("data-listid")]);

						const id = d20.Campaign.rollabletables.create().id;
						const table = d20.Campaign.rollabletables.get(id);
						table.set("name", $(`#shapeshift-name`).val().trim() || "Shapeshifter");
						table.save();
						sel.forEach(m => {
							const item = table.tableitems.create();
							item.set("name", m.name);
							// encode size info into the URL, which will get baked into the token
							const avatar = m.tokenUrl || `${IMG_URL}bestiary/tokens/${Parser.sourceJsonToAbv(m.source)}/${m.name.replace(/"/g, "")}.webp?roll20_token_size=${getSizeInTiles(m.size)}`;
							item.set("avatar", avatar);
							item.set("token_size", getSizeInTiles(m.size));
							item.save();
						});
						table.save();
						d20.rollabletables.refreshTablesList();
						alert("Created table!")
					}
				});
			},
		},
		{
			name: "Wild Shape Builder",
			desc: "Build a character sheet to represent a character in Wild Shape.",
			html: `
				<div id="d20plus-wildformbuild" title="Better20 - Wild Shape Character Builder">
					<div id="wildformbuild-list">
						<input type="search" class="search" placeholder="Search creatures...">
						<input type="search" class="filter" placeholder="Filter...">
						<span title="Filter format example: 'cr:1/4; cr:1/2; type:beast; source:MM'" style="cursor: help;">[?]</span>
						<div class="list" style="transform: translateZ(0); max-height: 490px; overflow-y: auto; overflow-x: hidden;"><i>Loading...</i></div>
					</div>
				<br>
				<select id="wildform-character">
					<option value="" disabled selected>Select Character</option>
				</select>
				<button class="btn">Create Character Sheets</button>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-wildformbuild").dialog({
					autoOpen: false,
					resizable: true,
					width: 800,
					height: 650,
				});
			},
			openFn: async () => {
				const $win = $("#d20plus-wildformbuild");
				$win.dialog("open");

				const $selChar = $(`#wildform-character`);
				$selChar.empty();
				$selChar.append(`<option value="" disabled>Select Character</option>`);
				const allChars = d20.Campaign.characters.toJSON().map(it => {
					const out = {id: it.id, name: it.name || ""};
					const npc = d20.Campaign.characters.get(it.id).attribs.toJSON().find(it => it.name === "npc");
					out.npc = !!(npc && npc.current && Number(npc.current));
					return out;
				});
				let hasNpc = false;
				allChars.sort((a, b) => a.npc - b.npc || SortUtil.ascSort(a.name.toLowerCase(), b.name.toLowerCase()))
					.forEach(it => {
						if (it.npc && !hasNpc) {
							$selChar.append(`<option value="" disabled>--NPCs--</option>`);
							hasNpc = true;
						}
						$selChar.append(`<option value="${it.id}">${it.name}</option>`)
					});

				const $fltr = $win.find(`.filter`);
				$fltr.off("keydown").off("keyup");
				$win.find(`button`).off("click");

				const $lst = $win.find(`.list`);

				let tokenList;

				const toLoad = Object.keys(monsterDataUrls).map(src => d20plus.monsters.formMonsterUrl(monsterDataUrls[src]));

				const dataStack = (await Promise.all(toLoad.map(async url => DataUtil.loadJSON(url)))).flat();

				$lst.empty();
				let toShow = [];

				const seen = {};
				await Promise.all(dataStack.map(async d => {
					const toAdd = d.monster.filter(m => {
						const out = !(seen[m.source] && seen[m.source].has(m.name));
						if (!seen[m.source]) seen[m.source] = new Set();
						seen[m.source].add(m.name);
						return out;
					});

					toShow = toShow.concat(toAdd);
				}));

				toShow = toShow.sort((a, b) => SortUtil.ascSort(a.name, b.name));

				let tmp = "";
				toShow.forEach((m, i) => {
					m.__pType = Parser.monTypeToFullObj(m.type).asText;

					tmp += `
								<label class="import-cb-label" data-listid="${i}">
								<input type="checkbox">
								<span class="name col-4">${m.name}</span>
								<span class="type col-4">TYP[${m.__pType.uppercaseFirst()}]</span>
								<span class="cr col-2">${m.cr === undefined ? "CR[Unknown]" : `CR[${(m.cr.cr || m.cr)}]`}</span>
								<span title="${Parser.sourceJsonToFull(m.source)}" class="source">SRC[${Parser.sourceJsonToAbv(m.source)}]</span>
								</label>
								`;
				});
				$lst.html(tmp);
				tmp = null;

				tokenList = new List("wildformbuild-list", {
					valueNames: ["name", "type", "cr", "source"],
				});

				d20plus.importer.addListFilter($fltr, toShow, tokenList, d20plus.monsters._listIndexConverter);

				$win.find(`button`).on("click", () => {
					const allSel = tokenList.items
						.filter(it => $(it.elm).find(`input`).prop("checked"))
						.map(it => toShow[$(it.elm).attr("data-listid")]);

					const character = $selChar.val();
					if (!character) return alert("No character selected!");

					const d20Character = d20.Campaign.characters.get(character);
					if (!d20Character) return alert("Failed to get character data!");

					const attribsJSON = d20Character.attribs.toJSON();
					const getAttrib = (name) => attribsJSON.find(x => x.name === name);

					allSel.filter(it => it).forEach(sel => {
						sel = $.extend(true, {}, sel);

						sel.wis = (getAttrib("wisdom") || {}).current || 10;
						sel.int = (getAttrib("intelligence") || {}).current || 10;
						sel.cha = (getAttrib("charisma") || {}).current || 10;

						const attribsSkills = {
							acrobatics_bonus: "acrobatics",
							animal_handling_bonus: "animal_handling",
							arcana_bonus: "arcana",
							athletics_bonus: "athletics",
							deception_bonus: "deception",
							history_bonus: "history",
							insight_bonus: "insight",
							intimidation_bonus: "intimidation",
							investigation_bonus: "investigation",
							medicine_bonus: "medicine",
							nature_bonus: "nature",
							perception_bonus: "perception",
							performance_bonus: "performance",
							persuasion_bonus: "persuasion",
							religion_bonus: "religion",
							slight_of_hand_bonus: "slight_of_hand",
							stealth_bonus: "stealth",
						};
						const attribsSaves = {
							npc_int_save: "int",
							npc_wis_save: "wis",
							npc_cha_save: "cha",
						};
						sel.skill = sel.skill || {};
						sel.save = sel.save || {};

						for (const a in attribsSkills) {
							const characterValue = getAttrib(a);
							if (characterValue) {
								sel.skill[attribsSkills[a]] = Math.max(sel.skill[attribsSkills[a]] || 0, characterValue.current);
							}
						}

						for (const a in attribsSaves) {
							const characterValue = getAttrib(a);
							if (characterValue) {
								sel.save[attribsSkills[a]] = Math.max(sel.save[attribsSkills[a]] || 0, characterValue.current);
							}
						}

						(() => {
							const attr = d20plus.sheet === "ogl" ? "passive_wisdom" : d20plus.sheet === "shaped" ? "perception" : "";
							if (!attr) return;
							const charAttr = getAttrib(attr);
							if (!charAttr) return;
							const passivePer = Number(charAttr.current || 0) + (d20plus.sheet === "shaped" ? 10 : 0);
							sel.passive = Math.max(passivePer, sel.passive);
						})();

						const doBuild = (result) => {
							const options = {
								charFunction: (character) => {
									character._getLatestBlob("defaulttoken", y => {
										if (y) {
											const token = JSON.parse(y);
											token.name = `${sel.name} (${d20Character.attributes.name})`;
											token.showplayers_aura1 = true;
											token.showplayers_aura2 = true;
											token.showplayers_bar1 = true;
											token.showplayers_bar2 = true;
											token.showplayers_bar3 = true;
											token.showplayers_name = true;
											token.bar3_max = result.total;
											token.bar3_value = result.total;
											character.updateBlobs({defaulttoken: JSON.stringify(token)});
											character.save({defaulttoken: (new Date()).getTime()});
										}
									});

									$("a.ui-tabs-anchor[href='#journal']").trigger("click");
								},
								charOptions: {
									inplayerjournals: d20Character.attributes.inplayerjournals,
									controlledby: d20Character.attributes.controlledby,
								},
							};

							d20plus.monsters.handoutBuilder(sel, true, false, `Wild Forms - ${d20Character.attributes.name}`, {}, options);
						};

						if (sel.hp.formula) d20plus.ut.randomRoll(sel.hp.formula, result => doBuild(result));
						else doBuild({total: 0});
					});
				});
			},
		},
	]);
}

SCRIPT_EXTENSIONS.push(tools5eTool);
