function baseTool () {
	d20plus.tool = {};

	/**
	 * Each tool should have:
	 *  - `name` List display name.
	 *  - `desc` List display description.
	 *  - `html` The html created when the button is clicked
	 *  - `dialogFn` Function called to initialize dialog.
	 *  - `openFn` Function called when tool is opened.
	 */
	d20plus.tool.tools = [
		{
			name: "Journal Cleaner",
			desc: "Quickly select and delete journal items, especially useful for cleaning up loose items after deleting a folder.",
			html: `
				<div id="d20plus-quickdelete" title="BetteR20 - Journal Root Cleaner">
				<p>A list of characters and handouts in the journal folder root, which allows them to be quickly deleted.</p>
				<label class="bold">Root Only <input type="radio" name="cb-mode" class="cb-shallow cb-mode"></label>
				<label class="bold">All Items <input type="radio" name="cb-mode" class="cb-deep cb-mode"></label>
				<label class="bold">All Items and Folders<input type="radio" name="cb-mode" class="cb-folder cb-mode"></label>
				<label class="bold">Rollable Tables <input type="radio" name="cb-mode" class="cb-tables cb-mode"></label>
				<hr>
				<p style="display: flex; justify-content: space-between"><label><input type="checkbox" title="Select all" id="deletelist-selectall"> Select All</label> <a class="btn" href="#" id="quickdelete-btn-submit">Delete Selected</a></p>
				<div id="delete-list-container">
					<input class="search" autocomplete="off" placeholder="Search list..." style="width: 100%;">
					<br><br>
					<ul class="list deletelist" style="max-height: 420px; overflow-y: scroll; display: block; margin: 0;"></ul>
				</div>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-quickdelete").dialog({
					autoOpen: false,
					resizable: true,
					width: 800,
					height: 700,
				});
			},
			openFn: () => {
				const $win = $("#d20plus-quickdelete");
				$win.dialog("open");

				// Create a variable for each box
				const $cbMode = $win.find(".cb-mode");
				const $cbShallow = $win.find(`.cb-shallow`);
				const $cbDeep = $win.find(`.cb-deep`);
				const $cbTables = $win.find(`.cb-tables`);
				const $cbFolder = $win.find(`.cb-folder`);

				const $cbAll = $("#deletelist-selectall").unbind("click");

				const $btnDel = $(`#quickdelete-btn-submit`).off("click");

				// When a a different box gets checked, populate the list
				$cbMode.off("change").on("change", () => populateList());

				// Don't even ask why populateList needs to be called twice
				$cbShallow.prop("checked", true);
				populateList();

				function populateList () {
					// collect a list of all journal items
					function getAllJournalItems () {
						const out = [];

						function recurse (entry, pos, isRoot) {
							if (entry.i) {
								if (!isRoot) pos.push(entry.n);
								entry.i.forEach(nxt => recurse(nxt, pos));
								pos.pop();
							} else out.push({id: entry, path: MiscUtil.copy(pos)});
						}

						const root = {i: d20plus.ut.getJournalFolderObj()};
						recurse(root, [], true);
						return out.map(it => getItemFromId(it.id, it.path.join(" / ")));
					}

					function getFolderJournalItems () {
						// Similar to get all Journal Items, but lists folders as well
						const out = [];

						// Go through the directory structure recursively
						function recurse (entry, pos, isRoot) {
							// I property is list of children, only folders have it
							if (entry.i) {
								// Add the folder name to the path
								if (!isRoot) pos.push(entry.n);

								// This adds directory names to out
								if (!isRoot) out.push({id: entry, path: MiscUtil.copy(pos)});

								// Run through the directory on each of the children
								entry.i.forEach(nxt => recurse(nxt, pos));

								// Remove the folder from the path when done
								pos.pop();
							}
							// Only triggers for non-folders, adds non-folders to list
							else out.push({id: entry, path: MiscUtil.copy(pos)});
						}

						// Get the directory structure and start traversal through it
						const root = {i: d20plus.ut.getJournalFolderObj()};
						recurse(root, [], true);
						return out.map(it => getItemFromId(it.id, it.path.join(" / ")));
					}

					function getRootJournalItems () {
						const rootItems = [];
						const journal = d20plus.ut.getJournalFolderObj();
						journal.forEach(it => {
							if (it.i) return; // skip folders
							rootItems.push(getItemFromId(it));
						});
						return rootItems;
					}

					function getItemFromId (itId, path = "") {
						// Get handout object, undefined if item is not a handout
						const handout = d20.Campaign.handouts.get(itId);
						if (handout && (handout.get("name") === CONFIG_HANDOUT || handout.get("name") === ART_HANDOUT)) return null; // skip 5etools handouts

						// Get character object, undefined if item is not a character
						const character = d20.Campaign.characters.get(itId);

						// Return based on which object isn't empty
						if (handout) return {type: "handouts", id: itId, name: handout.get("name"), path: path, archived: handout.attributes.archived};
						if (character) return {type: "characters", id: itId, name: character.get("name"), path: path, archived: character.attributes.archived};

						// If both are empty, check if item is a folder and return a folder type
						if (d20plus.journal.checkDirExistsByPath(path.split(" / "))) return {type: "folder", id: itId, name: "", path: path, archived: false, folder: true}
					}

					function getJournalItems () {
						// For the root only option
						if ($cbShallow.prop("checked")) return getRootJournalItems().filter(Boolean);

						// For the all files option
						if ($cbDeep.prop("checked")) return getAllJournalItems().filter(Boolean);

						// For the all files and folder option
						if ($cbFolder.prop("checked")) return getFolderJournalItems().filter(Boolean);

						// For the get rollable tables option
						if ($cbTables.prop("checked")) return getRollableTables().filter(Boolean);
					}

					// Allow for deleting tables as well
					function getRollableTables () {
						let tItems = [];
						if ($cbTables.prop("checked")) {
							// Get a tableobject from the d20 thing and loop through it
							const tableObject = d20.Campaign.rollabletables;
							for (i = 0; i < tableObject.length; i++) {
								// If it looks confusing, it is. Just trust that I got the objects properly
								const tAttr = tableObject.at(i).attributes;
								const tObj = {
									name: tAttr.name,
									id: tAttr.id,
									type: "rollabletables",
									table: true,
								};
								tItems.push(tObj);
							}
						}
						return tItems;
					}

					// Populate different lists based on which box is checked
					const journalItems = getJournalItems();

					// Display found items
					const $delList = $win.find(`.list`);
					$delList.empty();

					journalItems.forEach((it, i) => {
						$delList.append(`
							<label class="import-cb-label" data-listid="${i}">
								<input type="checkbox">
								<span class="name readable">${it.path ? `${it.path} / ` : ""}${it.name}</span>
								${it.archived ? `<span class="name readable">(archived)</span>` : ""}
								${it.table ? `<span class="name readable">(table)</span>` : ""}
								${it.folder ? `<span class="name readable">(folder)</span>` : ""}
							</label>
						`);
					});

					// init list library
					const delList = new List("delete-list-container", {
						valueNames: ["name"],
						listClass: "deletelist",
					});

					$cbAll.prop("checked", false);
					$cbAll.off("click").click(() => d20plus.importer._importToggleSelectAll(delList, $cbAll));

					$btnDel.off("click").on("click", () => {
						const sel = delList.items
							.filter(it => $(it.elm).find(`input`).prop("checked"))
							.map(it => journalItems[$(it.elm).attr("data-listid")])
							.reverse();

						if (!sel.length) {
							alert("No items selected!");
						} else if (confirm(`Are you sure you want to delete the ${sel.length} selected item${sel.length > 1 ? "s" : ""}?`)) {
							$win.dialog("close");
							$("a.ui-tabs-anchor[href='#journal']").trigger("click");
							sel.forEach(toDel => {
								// If the item is a folder, use the folder deletion functon
								if (toDel.folder) d20plus.journal.removeDirByPath(toDel.path.split(" / "));

								// Otherwise delete through d20 object
								else d20.Campaign[toDel.type].get(toDel.id).destroy();
							});
							$("#journalfolderroot").trigger("change");
						}
					});
				}
			},
		},
		{
			name: "SVG Draw",
			desc: "Paste SVG data as text to automatically draw the paths.",
			html: `
				<div id="d20plus-svgdraw" title="Better20 - SVG Drawing Tool">
				<p>Paste SVG data as text to automatically draw any included &lt;path&gt;s. Draws to the current layer, in the top-left corner, with no scaling. Takes colour information from &quot;stroke&quot; attributes.</p>
				<p>Line width (px; default values are 1, 3, 5, 8, 14): <input name="stroke-width" placeholder="5" value="5" type="number"></p>
				<textarea rows="10" cols="100" placeholder="Paste SVG data here"></textarea>
				<br>
				<button class="btn">Draw</button>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-svgdraw").dialog({
					autoOpen: false,
					resizable: true,
					width: 800,
					height: 650,
				});
			},
			openFn: () => {
				// adapted from `d20.engine.finishCurrentPolygon`
				function addShape (path, pathStroke, strokeWidth) {
					let i = d20.engine.convertAbsolutePathStringtoFabric(path);
					i = _.extend(i, {
						strokeWidth: strokeWidth,
						fill: "transparent",
						stroke: pathStroke,
						path: JSON.parse(i.path),
					});
					d20.Campaign.activePage().addPath(i);
					d20.engine.redrawScreenNextTick();
				}

				const $win = $("#d20plus-svgdraw");
				$win.dialog("open");

				$win.find(`button`).off("click").on("click", () => {
					d20plus.ut.log("Drawing paths");
					const input = $win.find(`textarea`).val();
					const svg = $.parseXML(input);

					const toDraw = $(svg).find("path").map((i, e) => {
						const $e = $(e);
						return {stroke: $e.attr("stroke") || "black", d: $e.attr("d")}
					}).get();

					const strokeWidth = Math.max(1, Number($win.find(`input[name="stroke-width"]`).val()));

					toDraw.forEach(it => {
						addShape(it.d, it.stroke, strokeWidth)
					});
				});
			},
		},
		{
			name: "Multi-Whisper",
			desc: "Send whispers to multiple players ",
			html: `
				<div id="d20plus-whispers" title="Better20 - Multi-Whisper Tool">
				<div>
					<button class="btn toggle-dc">Show Disconnected Players</button>
					<button class="btn send-all">Send All Messages</button>
					<button class="btn clear-all">Clear All Messages</button>
				</div>
				<hr>
				<div class="messages" style="max-height: 600px; overflow-y: auto; overflow-x: hidden; transform: translateZ(0)">
					<!-- populate with JS -->
				</div>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-whispers").dialog({
					autoOpen: false,
					resizable: true,
					width: 1000,
					height: 760,
				});
			},
			openFn: () => {
				$("a.ui-tabs-anchor[href='#textchat']").trigger("click");

				const $win = $("#d20plus-whispers");
				$win.dialog("open");

				const $btnToggleDc = $win.find(`.toggle-dc`).off("click").text("Show Disconnected Players");
				const $btnSendAll = $win.find(`.send-all`).off("click");
				const $btnClearAll = $win.find(`.clear-all`).off("click");

				const $pnlMessages = $win.find(`.messages`).empty();
				const players = d20.Campaign.players.toJSON();
				players.forEach((p, i) => {
					const $btnSend = $(`<button class="btn send" style="margin-right: 5px;">Send</button>`).on("click", function () {
						const $btn = $(this);
						const $wrp = $btn.closest(`.wrp-message`);
						const toMsg = $wrp.find(`input[data-player-id]:checked`).filter(":visible").map((ii, e) => $(e).attr("data-player-id")).get();
						const content = $wrp.find(`.message`).val().trim();
						toMsg.forEach(targetId => {
							d20.textchat.doChatInput(`/w ${d20.Campaign.players.get(targetId).get("displayname").split(" ")[0]} ${content}`);

							// This only posts to local player's chat, sadly
							// d20.textchat.incoming(
							// 	false,
							// 	{
							// 		avatar: `/users/avatar/${window.currentPlayer.get("d20userid")}/30`,
							// 		who: d20.textchat.$speakingas.find("option:first-child").text(),
							// 		type: "whisper",
							// 		content: content,
							// 		playerid: window.currentPlayer.id,
							// 		id: d20plus.ut.generateRowId(),
							// 		target: targetId,
							// 		target_name: d20.Campaign.players.get(targetId).get("displayname") || ""
							// 	}
							// );
						})
					});

					const $btnClear = $(`<button class="btn msg-clear">Clear</button>`).on("click", function () {
						$(this).closest(`.wrp-message`).find(`.message`).val("");
					});

					$pnlMessages.append($(`
							<div ${p.online || `style="display: none;"`} data-online="${p.online}" class="wrp-message">
								<div>
									${players.map((pp, ii) => `<label style="margin-right: 10px; ${pp.online || ` display: none;`}" data-online="${pp.online}" class="display-inline-block">${pp.displayname} <input data-player-id="${pp.id}" type="checkbox" ${i === ii ? `checked="true"` : ""}></label>`).join("")}
								</div>
								<textarea style="display: block; width: 95%;" placeholder="Enter whisper" class="message"></textarea>
							</div>
						`).append($btnSend).append($btnClear).append(`<hr>`));
				});

				$btnToggleDc.on("click", () => {
					$btnToggleDc.text($btnToggleDc.text().startsWith("Show") ? "Hide Disconnected Players" : "Show Disconnected Players");
					$pnlMessages.find(`[data-online="false"]`).toggle();
				});

				$btnSendAll.on("click", () => {
					$pnlMessages.find(`button.send`).click();
				});

				$btnClearAll.on("click", () => $pnlMessages.find(`button.msg-clear`).click());
			},
		},
		{
			name: "Mass-Delete Pages",
			desc: "Quickly delete multiple pages.",
			html: `
				<div id="d20plus-mass-page-delete" title="Better20 - Mass-Delete Pages">
					<div id="del-pages-list">
						<div class="list" style="transform: translateZ(0); max-height: 490px; overflow-y: scroll; overflow-x: hidden; margin-bottom: 10px;"><i>Loading...</i></div>
					</div>
					<hr>
					<p><label class="ib"><input type="checkbox" class="select-all"> Select All</label> | <button class="btn btn-danger deleter">Delete</button></p>
					<p><i>This tool will delete neither your active page, nor a page active for players.</i></p>
				</div>
				`,
			dialogFn: () => {
				$("#d20plus-mass-page-delete").dialog({
					autoOpen: false,
					resizable: true,
					width: 600,
					height: 800,
				});
			},
			openFn: () => {
				function deletePage (model, pageList) {
					if ($(`#page-toolbar .availablepage[data-pageid=${model.id}]`).remove()) {
						let n = d20.Campaign.getPageIndex(model.id);
						if (model.thegraphics) {
							model.thegraphics.massdelete = true;
							model.thegraphics.backboneFirebase.reference.set(null);
						}
						if (model.thetexts) {
							model.thetexts.massdelete = true;
							model.thetexts.backboneFirebase.reference.set(null);
						}
						if (model.thepaths) {
							model.thepaths.backboneFirebase.reference.set(null);
							model.thepaths.massdelete = true;
						}
						let i = d20.Campaign.get("playerspecificpages");
						let o = false;
						_.each(i, function (e, n) {
							if (e === model.id) {
								delete i[n];
								o = true;
							}
						});
						o && d20.Campaign.save({
							playerspecificpages: i,
						});
						model.destroy();
						d20.Campaign.activePageIndex > n && (d20.Campaign.activePageIndex -= 1);

						pageList.remove("page-id", model.id);
					}
				}

				const $win = $("#d20plus-mass-page-delete");
				$win.dialog("open");

				const $lst = $win.find(`.list`).empty();

				d20.Campaign.pages.models.forEach(m => {
					$lst.append(`
							<label class="import-cb-label import-cb-label--img" data-listid="${m.id}">
								<input type="checkbox">
								<img class="import-label__img" src="${m.attributes.thumbnail}">
								<span class="name col-9">${m.attributes.name}</span>
								<span style="display: none;" class="page-id">${m.id}</span>
							</label>
						`);
				});

				const pageList = new List("del-pages-list", {
					valueNames: ["name", "page-id"],
				});

				const $cbAll = $win.find(`.select-all`).off("click").click(() => {
					pageList.items.forEach(it => {
						$(it.elm).find(`input[type="checkbox"]`).prop("checked", $cbAll.prop("checked"));
					});
				});

				const $btnDel = $win.find(`.deleter`).off("click").click(() => {
					const sel = pageList.items
						.filter(it => $(it.elm).find(`input`).prop("checked"))
						.map(it => $(it.elm).attr("data-listid"))
						.map(pId => d20.Campaign.pages.models.find(it => it.id === pId))
						.filter(it => it);

					sel.forEach(m => {
						if (m.id !== d20.Campaign.get("playerpageid") && m.id !== d20.Campaign.activePage().id) {
							deletePage(m, pageList);
						}
					});
					$cbAll.prop("checked", false);
				});
			},
		},
		{
			name: "Quantum Token Entangler",
			desc: "Connect tokens between pages, linking their positions.",
			html: `
				<div id="d20plus-token-entangle" title="Better20 - Quantum Token Entangler">
					<p><i>Please note that this feature is highly experimental.
					<br>
					You can learn Token IDs by rightclicking a token -> "Advanced" -> "View Token ID."</i></p>
					<hr>
					<input id="token-entangle-id-1" placeholder="Master ID">
					Type:
					<select id="token-entangle-type-1">
						<option value="0">Token</option>
						<option value="1">Path</option>
					</select>
					<br>
					<input id="token-entangle-id-2" placeholder="Slave ID">
					Type:
					<select id="token-entangle-type-2">
						<option value="0">Token</option>
						<option value="1">Path</option>
					</select>
					<br>
					<button class="btn btn-default" id="token-entangle-go">Entangle</button>
					<hr>
					<input id="token-clear-entangles" placeholder="ID to Clear">
					Type:
					<select id="token-clear-type">
						<option value="0">Token</option>
						<option value="1">Path</option>
					</select>
					<button class="btn btn-default" id="token-entangle-clear">Clear Entangles</button>
				</div>
				`,
			dialogFn: () => {
				const $win = $("#d20plus-token-entangle");

				const entangleTracker = {};
				const ALLOWED_TYPES = ["path", "image"];
				const SYNCABLE_ATTRS_IMAGE = [
					"rotation",
					"width",
					"height",
					"top",
					"left",
					"scaleX",
					"scaleY",
					"fliph",
					"flipv",
				];
				const SYNCABLE_ATTRS_PATH = [
					"rotation",
					"top",
					"left",
					"scaleX",
					"scaleY",
				];

				$win.data("VE_DO_ENTANGLE", (master) => {
					if (!ALLOWED_TYPES.includes(master.attributes.type)) return;

					// prevent double-binding
					if (entangleTracker[master.id]) return;

					const TO_SYNC = master.attributes.type === "image" ? SYNCABLE_ATTRS_IMAGE : SYNCABLE_ATTRS_PATH;

					master.on("change", (it) => {
						let anyUpdates = false;

						if (master.attributes.entangledImages && master.attributes.entangledImages.length) {
							if (TO_SYNC.filter(attr => it.changed[attr] !== undefined).length) {
								master.attributes.entangledImages = master.attributes.entangledImages.filter(id => {
									const slave = d20plus.ut.getTokenById(id);
									const SLAVE_ATTRS = slave.attributes.type === "image" ? SYNCABLE_ATTRS_IMAGE : SYNCABLE_ATTRS_PATH;
									if (slave) {
										TO_SYNC
											.filter(attr => SLAVE_ATTRS.includes(attr))
											.filter(attr => master.attributes[attr] != null)
											.forEach(attr => slave.attributes[attr] = master.attributes[attr]);
										slave.save();
										return true;
									} else {
										// eslint-disable-next-line no-console
										console.warn(`Could not find entangled token with ID "${id}", removing...`);
										anyUpdates = true;
									}
								});
							}
						}

						if (master.attributes.entangledPaths && master.attributes.entangledPaths.length) {
							if (TO_SYNC.filter(attr => it.changed[attr] !== undefined).length) {
								master.attributes.entangledPaths = master.attributes.entangledPaths.filter(id => {
									const slave = d20plus.ut.getPathById(id);
									const SLAVE_ATTRS = slave.attributes.type === "image" ? SYNCABLE_ATTRS_IMAGE : SYNCABLE_ATTRS_PATH;
									if (slave) {
										TO_SYNC
											.filter(attr => SLAVE_ATTRS.includes(attr))
											.filter(attr => master.attributes[attr] != null)
											.forEach(attr => slave.attributes[attr] = master.attributes[attr]);
										slave.save();
										return true;
									} else {
										// eslint-disable-next-line no-console
										console.warn(`Could not find entangled path with ID "${id}", removing...`);
										anyUpdates = true;
									}
								});
							}
						}

						if (anyUpdates) master.save();
					})
				});

				// do initial entangles
				const runInitial = () => {
					const pages = d20.Campaign.pages;
					if (pages && pages.models) {
						d20plus.ut.log("Initialisng existing entangles...");
						d20.Campaign.pages.models
							.forEach(model => {
								const PROPS = {
									thegraphics: "entangledImages",
									thepaths: "entangledPaths",
								};
								Object.keys(PROPS).forEach(prop => {
									Object.values(PROPS).forEach(attrK => {
										if (model[prop] && model[prop].models) {
											model[prop].models.filter(it => it.attributes[attrK] && it.attributes[attrK].length).forEach(it => {
												$win.data("VE_DO_ENTANGLE")(it);
											})
										}
									});
								});
							});
					} else {
						// eslint-disable-next-line no-console
						console.log("Pages uninitialised, waiting...");
						setTimeout(runInitial, 1000);
					}
				};

				runInitial();

				$win.dialog({
					autoOpen: false,
					resizable: true,
					width: 800,
					height: 400,
				});
			},
			openFn: () => {
				const ATTR_PROPS = ["entangledImages", "entangledPaths"];

				const notFound = (id, type) => alert(`${type === "image" ? "Token" : "Path"} with ID ${id} didn't exist!`);

				const $win = $("#d20plus-token-entangle");
				$win.dialog("open");

				const $ipt1 = $(`#token-entangle-id-1`);
				const $ipt2 = $(`#token-entangle-id-2`);
				const $selType1 = $(`#token-entangle-type-1`);
				const $selType2 = $(`#token-entangle-type-2`);

				const $btnGo = $(`#token-entangle-go`)
					.off("click")
					.click(() => {
						const id1 = $ipt1.val();
						const id2 = $ipt2.val();
						const checkExisting = (a, b) => {
							const _check = (p, q) => ATTR_PROPS.some(prop => p.attributes[prop] && a.attributes[prop].includes(q.id));

							if (_check(a, b)) return `"${a.id}" is already entangled to "${b.id}"!`;
							if (_check(b, a)) return `"${b.id}" is already entangled to "${a.id}"!`;
							return false;
						};

						const entity1 = $selType1.val() === "0" ? d20plus.ut.getTokenById(id1) : d20plus.ut.getPathById(id1);
						const entity2 = $selType2.val() === "0" ? d20plus.ut.getTokenById(id2) : d20plus.ut.getPathById(id2);

						if (!entity1) return notFound(id1, $selType1.val() === "0" ? "image" : "path");
						if (!entity2) return notFound(id2, $selType2.val() === "0" ? "image" : "path");

						const existing = checkExisting(entity1, entity2);
						if (existing) return alert(existing);

						const prop1 = entity2.attributes.type === "image" ? "entangledImages" : "entangledPaths";
						const prop2 = entity1.attributes.type === "image" ? "entangledImages" : "entangledPaths";

						(entity1.attributes[prop1] = entity1.attributes[prop1] || []).push(id2);
						entity1.save();
						(entity2.attributes[prop2] = entity2.attributes[prop2] || []).push(id1);
						entity2.save();

						$win.data("VE_DO_ENTANGLE")(entity1);
						$win.data("VE_DO_ENTANGLE")(entity2);
						alert("Entangled!");
					});

				const $iptClear = $(`#token-clear-entangles`);

				const $selTypeClear = $(`#token-clear-type`);

				const $btnClear = $(`#token-entangle-clear`)
					.off("click")
					.click(() => {
						const id = $iptClear.val();
						const entity = $selTypeClear.val() === "0" ? d20plus.ut.getTokenById(id) : d20plus.ut.getPathById(id);
						if (!entity) return notFound(id, $selTypeClear.val() === "0" ? "image" : "path");

						const count = (entity.attributes.entangledImages ? entity.attributes.entangledImages.length : 0) + (entity.attributes.entangledPaths ? entity.attributes.entangledPaths.length : 0);

						(entity.attributes.entangledImages || []).forEach(eId => {
							const ent = d20plus.ut.getTokenById(eId);
							if (ent && ent.attributes.entangledImages && ent.attributes.entangledImages.includes(id)) {
								ent.attributes.entangledImages.splice(ent.attributes.entangledImages.indexOf(id), 1);
								ent.save();
							}
						});

						(entity.attributes.entangledPaths || []).forEach(eId => {
							const ent = d20plus.ut.getPathById(eId);
							if (ent && ent.attributes.entangledPaths && ent.attributes.entangledPaths.includes(id)) {
								ent.attributes.entangledPaths.splice(ent.attributes.entangledPaths.indexOf(id), 1);
								ent.save();
							}
						});

						entity.attributes.entangledImages = [];
						entity.attributes.entangledPaths = [];
						entity.save();
						alert(`${count} entangle${count === 1 ? "" : "s"} cleared.`);
					});
			},
		},
		{
			name: "Upload D&D Beyond Character",
			desc: "Import a D&D Beyond character sheet from a PDF export.",
			html: `
				<div id="d20plus-dndbeyond-import" title="BetteR20 - D&D Beyond Importer">
					<p>Upload a PDF export from D&D Beyond to import a character sheet.</p>
					<p style="margin-top: 10px;">
						<input type="file" id="dndb-pdf-upload" accept=".pdf" style="width: 100%;"/>
					</p>
					<hr>
					<div id="dndb-import-status" style="margin-top: 10px; min-height: 100px;">
						<p>Select a PDF file to begin import.</p>
					</div>
					<hr>
					<p style="margin-top: 10px;">
						<button id="dndb-btn-import" class="btn" disabled>Import Character</button>
					</p>
				</div>
			`,
			dialogFn: () => {
				$("#d20plus-dndbeyond-import").dialog({
					autoOpen: false,
					resizable: true,
					width: 600,
					height: 500,
				});
			},
			openFn: async function() {
				const $win = $("#d20plus-dndbeyond-import");
				$win.dialog("open");

				const $fileInput = $("#dndb-pdf-upload");
				const $status = $("#dndb-import-status");
				const $btnImport = $("#dndb-btn-import");

				let characterData = null;

				// Initialize PDF.js (bundled in build)
				try {
					await d20plus.importer.loadPdfJs();
				} catch (error) {
					console.error("Error initializing PDF.js:", error);
					$status.html(`<p style="color: red;">PDF library not available: ${error.message}</p>`);
					return;
				}

				// Handle file selection
				$fileInput.off("change").on("change", async function(e) {
					const file = e.target.files[0];
					if (!file) return;

					$status.html("<p>Reading PDF...</p>");
					$btnImport.prop("disabled", true);

					try {
						// Read the PDF file
						const arrayBuffer = await file.arrayBuffer();

						// Parse the PDF and extract character data
						characterData = await d20plus.importer.parseDnDBeyondPDF(arrayBuffer);

						// Display extracted data
						$status.html(`
							<p><strong>Character Found:</strong></p>
							<ul style="margin-left: 20px;">
								<li><strong>Name:</strong> ${characterData.name || "Unknown"}</li>
								<li><strong>Class:</strong> ${characterData.class || "Unknown"}</li>
								<li><strong>Level:</strong> ${characterData.level || "1"}</li>
								<li><strong>Species:</strong> ${characterData.species || "Unknown"}</li>
							</ul>
							<p style="margin-top: 10px; color: green;">Ready to import!</p>
						`);

						$btnImport.prop("disabled", false);
					} catch (error) {
						console.error("Error parsing PDF:", error);
						$status.html(`<p style="color: red;">Error reading PDF: ${error.message}</p>`);
						$btnImport.prop("disabled", true);
					}
				});

				// Handle import button
				$btnImport.off("click").on("click", async function() {
					if (!characterData) {
						alert("No character data loaded!");
						return;
					}

					$btnImport.prop("disabled", true);
					$status.html("<p>Creating character in Roll20...</p>");

					try {
						await d20plus.importer.importDnDBeyondCharacter(characterData);
						$status.html("<p style='color: green;'>Character imported successfully!</p>");
						alert("Character imported successfully!");
					} catch (error) {
						console.error("Error importing character:", error);
						$status.html(`<p style="color: red;">Error importing: ${error.message}</p>`);
						alert(`Error importing character: ${error.message}`);
						$btnImport.prop("disabled", false);
					}
				});
			},
		},
	];

	d20plus.tool.get = (toolId) => {
		return d20plus.tool.tools.find(it => it.toolId === toolId);
	};

	d20plus.tool.addTools = () => {
		const $body = $(`body`);
		const $tools = $(`#d20-tools-list`);
		const $toolsList = $tools.find(`.tools-list`);
		d20plus.tool.tools.sort((a, b) => SortUtil.ascSortLower(a.name || "", b.name || "")).forEach(t => {
			$body.append(t.html); // add HTML
			try {
				t.dialogFn(); // init window
				// add tool row
				const $wrp = $(`<div class="tool-row"/>`);
				$wrp.append(`<span style="width: 20%; padding: 4px;">${t.name}</span>`);
				$wrp.append(`<span style="width: calc(60% - 8px); padding: 4px;">${t.desc}</span>`);
				$(`<a style="width: 15%;" class="btn" href="#">Open</a>`).on(mousedowntype, () => {
					t.openFn.bind(t)();
					$tools.dialog("close");
				}).appendTo($wrp);
				$toolsList.append($wrp);
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(`Failed to initialise tool "${t.name}"`, e);
			}
		});

		$tools.dialog({
			autoOpen: false,
			resizable: true,
			width: 800,
			height: 660,
		});
		$(`#button-view-tools`).on(mousedowntype, () => {
			$tools.dialog("open");
		});
	};
}

SCRIPT_EXTENSIONS.push(baseTool);
