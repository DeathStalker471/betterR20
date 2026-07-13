function baseToolTable () {
	// Determines if a JSON is of the generated or TableExport format
	function getFormat (t) {
		if (t.colLabels) {
			return "generated";
		}
		if (t.items) {
			return "r20"
		}
	}

	// A function for generating and saving tables from JSONs of the generated format
	function createGeneratedFormat (t) {
		// Creates the table, with data for the full table
		const r20t = d20.Campaign.rollabletables.create({
			name: t.name.replace(/\s+/g, "-"),
			id: d20plus.ut.generateRowId(),
		});

		const labels = t.colLabels;
		// Gets the index of the first column labeled with a dice roll
		// For example, finds the d100 column
		const dplace = labels.findIndex(l => /d[0-9]+/.test(l));

		r20t.tableitems.reset(t.rows.map(i => {
			// Create the return value
			const out = {
				id: d20plus.ut.generateRowId(),
				name: "",
			};

			// Set the name
			for (let col = 0; col < labels.length; col++) {
				// Add a seperator for cases of multiple columns
				if (out.name.length > 0) {
					out.name += " | "
				}
				// Add each column to out.name
				if (col !== dplace) {
					// Get rid of ugly notation
					const clean = Renderer.stripTags(i[col]);
					out.name += clean;
				}
			}

			// Set the weight
			if (~dplace) {
				const weight = i[dplace];
				const dash = weight.indexOf("\u2013"); // Note: – is different from -

				// If the weight is a range
				if (~dash) {
					// Get the two numbers in the range, subtract them, add 1
					const low = parseInt(weight.substring(0, dash));
					let high = parseInt(weight.substring(dash + 1));
					if (high === 0) high = 100;
					out.weight = high - low + 1;
				} else { // If the weight is a single value
					out.weight = 1;
				}
			} else { // If the weight is unlisted
				out.weight = 1;
			}

			if (i.avatar) out.avatar = i.avatar;
			return out;
		}));
		r20t.tableitems.forEach(it => it.save());
	}

	// A function for generating and saving tables from JSONs of the Roll20 format
	function createR20Format (t) {
		const r20t = d20.Campaign.rollabletables.create({
			name: t.name.replace(/\s+/g, "-"),
			showplayers: t.isShown,
			id: d20plus.ut.generateRowId(),
		});

		r20t.tableitems.reset(t.items.map(i => {
			const out = {
				id: d20plus.ut.generateRowId(),
				name: i.row,
			};
			if (i.weight != null) out.weight = i.weight;
			if (i.avatar) out.avatar = i.avatar;
			return out;
		}));
		r20t.tableitems.forEach(it => it.save());
	}

	// Function to create from create your own format
	// Note that due to the simplicity of the format, hiding from players, weight, and avatars can't be configured
	// Returns true on success, false on failure
	function createCreateFormat (t) {
		// Split the input into lines
		const lines = t.split("\n");

		// Ensure there's a table name and at least one element
		if (lines.length < 2) {
			return "Must contain table name and at least one element";
		}

		// Create table object, using lines[0] as the name
		const r20t = d20.Campaign.rollabletables.create({
			name: lines[0].replace(/\s+/g, "-"),
			showplayers: true,
			id: d20plus.ut.generateRowId(),
		});

		// Create a row from each line
		r20t.tableitems.reset(lines.slice(1).map(i => {
			const out = {
				id: d20plus.ut.generateRowId(),
				name: i,
			};
			return out;
		}));

		r20t.tableitems.forEach(it => it.save());

		return null;
	}

	// Simplified version of getFromPaste which checks if the paste is valid
	function validatePaste (paste) {
		let error = null;
		let tbl = false;
		const lines = paste.split("\n");

		// Check for minimum number of rows
		if (lines.length < 2) {
			return "Must contain content";
		}

		for (const line of lines.map(it => it.trim())) {
			error = parseLine(line);
			if (error) break;
		}
		return error;

		function parseLine (line) {
			// Check to see if current line imports an item
			if (line.startsWith("!import-table-item")) {
				if (!tbl) return "No !import-table statement found";
			}
			// Check to see if current line imports a table
			else if (line.startsWith("!import-table")) {
				if (tbl) return "No blank line found between tables";
				tbl = true;
			}
			// Check to ensure against invalid line
			else if (line.trim()) {
				return "Non-empty line which didn't match !import-table or !import-table-item";
			}
			// Allow multiple tables
			else {
				tbl = false;
			}
		}
	}

	function getFromPaste (paste) {
		const tables = [];
		let tbl = null;

		paste.split("\n").forEach(line => parseLine(line.trim()));
		parseLine(""); // ensure trailing newline
		return {"tables": tables};

		function parseLine (line) {
			if (line.startsWith("!import-table-item")) {
				if (!tbl) {
					return {"error": "No !import-table statement found"};
				}
				const [junk, tblName, row, weight, avatar] = line.split("--").map(it => it.trim());
				tbl.items.push({
					row,
					weight,
					avatar,
				})
			} else if (line.startsWith("!import-table")) {
				if (tbl) {
					return {"error": "No blank line found between tables"};
				}
				const [junk, tblName, showHide] = line.split("--").map(it => it.trim());
				tbl = {
					name: tblName,
					isShown: (showHide || "").toLowerCase() === "show",
				};
				tbl.items = [];
			} else if (line.trim()) {
				return {"error": "Non-empty line which didn't match !import-table or !import-table-item"};
			} else {
				if (tbl) {
					tables.push(tbl);
					tbl = null;
				}
			}
		}
	}

	d20plus.tool.tools.push({
		name: "Table Importer",
		desc: "Import rollable tables",
		html: `
		<div id="d20plus-tables" title="Better20 - Table Importer">
		<div>
		<button class="btn paste-te">Paste TableExport Data</button> <i>Accepts <a href="https://app.roll20.net/forum/post/1144568/script-tableexport-a-script-for-exporting-and-importing-rollable-tables-between-accounts">TableExport</a> format.</i>
		</div>
		<div>
		<button class="btn create-table">Create a Table</button> <i>The first line is the table name, the rest are items.</i>
		</div>
		<div>
		<button class="btn load-url">Import Tables from URL</button> <input type="text" id="import-table-url" value="${DATA_URL}generated/gendata-tables.json">
		</div>
		<hr style="margin: 4px;">
		<div id="table-list">
		<input type="search" class="search" placeholder="Search tables...">
		<div class="list table-import-search"><i>Loading...</i></div>
		</div>
		<br>
		<button class="btn start-import">Import</button>
		</div>
		
		<div id="d20plus-tables-clipboard" title="Paste from Clipboard"></div>
		<div id="d20plus-tables-create" title="Create Your Own Table"></div>
		`,
		dialogFn: () => {
			$("#d20plus-tables").dialog({
				autoOpen: false,
				resizable: true,
				width: 650,
				height: 720,
			});
			$(`#d20plus-tables-clipboard`).dialog({
				autoOpen: false,
				resizable: true,
				width: 640,
				height: 480,
			});
			$(`#d20plus-tables-create`).dialog({
				autoOpen: false,
				resizable: true,
				width: 640,
				height: 480,
			});
		},
		openFn: () => {
			const $win = $("#d20plus-tables");
			$win.dialog("open");

			const $btnImport = $win.find(`.start-import`).off("click");
			const $btnClipboard = $win.find(`.paste-te`).off("click");
			const $btnCreate = $win.find(`.create-table`).off("click");
			const $btnURL = $win.find(`.load-url`).off("click");

			let tableList = new List("table-list", {
				valueNames: ["name", "source"],
			});
			let tables = null;

			let url = $("#import-table-url").val();

			DataUtil.loadJSON(url).then((data) => {
				// Allow pasting of custom tables
				$btnClipboard.on("click", () => {
					const $wrpClip = $(`#d20plus-tables-clipboard`);
					const $iptClip = $(`<textarea placeholder=
"!import-table --Table-Name --show
!import-table-item --Table-Name --Item One --1 --
!import-table-item --Table-Name --Item Two --1 --
!import-table-item --Table-Name --Item Three (weighted more heavily) --5 --" 
					class="table-import-textarea">`).appendTo($wrpClip);
					const $btnCheck = $(`<button class="btn" style="margin-right: 5px;">Check if Valid</button>`).on("click", () => {
						const error = validatePaste($iptClip.val());
						if (!error) {
							window.alert("Looking good!");
						} else {
							window.alert(`Invalid table: ${error}`);
						}
					}).appendTo($wrpClip);
					const $btnImport = $(`<button class="btn">Import</button>`).on("click", () => {
						const error = validatePaste($iptClip.val());
						if (!error) {
							$("a.ui-tabs-anchor[href='#deckstables']").trigger("click");
							const ts = getFromPaste($iptClip.val());
							if (ts.tables) {
								ts.tables.forEach(t => createR20Format(t));
								window.alert("Import complete");
							}
						} else {
							window.alert(`Import failed: ${error}`);
						}
					}).appendTo($wrpClip);

					$wrpClip.dialog("open");
				});

				// Allow easy creation of custom tables
				$btnCreate.on("click", () => {
					const $wrpClip = $(`#d20plus-tables-create`);
					const $iptClip = $(`<textarea placeholder="Table-Name\nItem One\nItem Two\nItem Three" class="table-import-textarea"/>`).appendTo($wrpClip);

					const $btnImport = $(`<button class="btn">Import</button>`).on("click", () => {
						$("a.ui-tabs-anchor[href='#deckstables']").trigger("click");
						const error = createCreateFormat($iptClip.val());
						if (!error) {
							window.alert("Import complete");
						} else {
							window.alert(`Import failed: ${error}`);
						}
					}).appendTo($wrpClip);

					$wrpClip.dialog("open");
				});

				// Allows you to import from other urls such as ${DATA_URL}tables.json
				$btnURL.on("click", () => {
					url = $("#import-table-url").val();
					if (!url || !url.trim()) return;

					// Load url from box
					DataUtil.loadJSON(url).then((newdata) => {
						// Overwrite the stored data with new, replaced data
						const $lst = $win.find(`.list`);
						tables = newdata.table.sort((a, b) => SortUtil.ascSort(a.name, b.name));
						let tmp = "";
						tables.forEach((t, i) => {
							tmp += `
							<label class="import-cb-label" data-listid="${i}">
							<input type="checkbox">
							<span class="name col-10">${t.name}</span>
							<span title="${t.source ? Parser.sourceJsonToFull(t.source) : "Unknown Source"}" class="source">SRC[${t.source ? Parser.sourceJsonToAbv(t.source) : "UNK"}]</span>
							</label>
							`;
						});
						$lst.html(tmp);
						tmp = null;

						tableList = new List("table-list", {
							valueNames: ["name", "source"],
						});
					});
				})

				// Official tables
				const $lst = $win.find(`.list`);
				tables = data.table.sort((a, b) => SortUtil.ascSort(a.name, b.name));
				let tmp = "";
				tables.forEach((t, i) => {
					tmp += `
					<label class="import-cb-label" data-listid="${i}">
					<input type="checkbox">
					<span class="name col-10">${t.name}</span>
					<span title="${t.source ? Parser.sourceJsonToFull(t.source) : "Unknown Source"}" class="source">SRC[${t.source ? Parser.sourceJsonToAbv(t.source) : "UNK"}]</span>
					</label>
					`;
				});
				$lst.html(tmp);
				tmp = null;

				tableList = new List("table-list", {
					valueNames: ["name", "source"],
				});

				$btnImport.on("click", () => {
					$("a.ui-tabs-anchor[href='#deckstables']").trigger("click");
					const sel = tableList.items
						.filter(it => $(it.elm).find(`input`).prop("checked"))
						.map(it => tables[$(it.elm).attr("data-listid")]);

					sel.forEach(t => {
						if (getFormat(t) === "generated") {
							createGeneratedFormat(t);
						} else if (getFormat(t) === "r20") {
							createR20Format(t);
						}
					});
				});
			});
		},
	});
}

SCRIPT_EXTENSIONS.push(baseToolTable);
