function baseToolDLImport () {
	const UniversalMapDLImporter = function () {
		// Some constants

		const defaultGridSize = 70;
		const scriptName = `Universal DL Importer`;
		const lightURL = "/images/editor/torch.svg";

		const icon = {
			"DA": "https://yt3.googleusercontent.com/qTpLXBxCdfX6x20z7Yifc-61rhFua6ixhxyRd4-j-j_p4AmZSn_GQPRRM1p9sT_NgZOiw_V4tA=s900-c-k-c0x00ffffff-no-rj",
			"UVTT": "https://user-images.githubusercontent.com/2023640/142776957-46e7ea40-9809-4558-a5f7-c65de050ba40.png",
			"default": "/images/character.png",
		}

		// Imitate API functions
		const sendChat = (input) => {
			d20.textchat.incoming(false, {
				id: d20plus.ut.generateRowId(),
				who: "DL Importer",
				type: "general",
				content: input,
				playerid: window.currentPlayer.id,
				avatar: icon[this.format] || icon.default,
				inlinerolls: [],
			});
		};

		const getObj = (type, id) => {
			if (type === "player") return currentPlayer;
			else if (type === "page") return d20.Campaign.activePage();
			else if (type === "graphic") return d20plus.ut.getTokenById(id);
		};

		const findObjs = () => {
			const graphics = d20.Campaign.activePage().thegraphics;
			return graphics.filter((it) => it.get("layer") === "map");
		};

		const createObj = (objType, obj, ...others) => {
			if (objType === "door" || objType === "window") {
				const conf = this[`config${objType.toSentenceCase()}s`];
				if (conf === "o") obj.isOpen = true;
				else if (conf === "l") obj.isLocked = true;
				else if (conf === "s") obj.isSecret = true;
				else if (conf === "sl") { obj.isLocked = true; obj.isSecret = true; }
				else if (conf === "so") { obj.isOpen = true; obj.isSecret = true; }
			}
			switch (objType) {
				case "path": {
					const page = d20.Campaign.activePage();
					obj.scaleX = obj.scaleX || 1;
					obj.scaleY = obj.scaleY || 1;
					obj.path = obj.path || obj._path;
					return page.thepaths.create(obj);
				}
				case "door": {
					const page = d20.Campaign.activePage();
					obj.path = obj.path || obj._path;
					if (this.configDoors === "X") return;
					return page.doors.create(obj);
				}
				case "window": {
					const page = d20.Campaign.activePage();
					obj.path = obj.path || obj._path;
					if (this.configWindows === "X") return;
					return page.windows.create(obj);
				}
				case "graphic": {
					const page = d20.Campaign.activePage();
					obj.path = obj.path || obj._path;
					if (this.configLights === "X") return;
					return page.thegraphics.create(obj);
				}
				default:
					// eslint-disable-next-line no-console
					console.error("Unhandled object type: ", objType, "with args", obj, others)
					break;
			}
		};

		// HTML for dialog
		const dialog = `
		  <div style="width: 350px;">
		  <p>The ${scriptName} allows you to import map data (walls, portals and lights) from some mapmaking software into Roll20 Dynamic Lighting (DL) system.</p>
		  <h4>What can be imported?</h4>
		  <p>⦁ The UVTT (universal VTT format, .dd2tt) files from DungeonDraft<br>
		  ⦁ Text data files (roll20 export, .txt) from DungeonAlchemist</p>
		  <button type="button" class="btn load-file">Load from file</button>
		  <a class="showtip pictos" original-title="Select file and it will be loaded to text editor below. The import format is determined automatically">?</a>
		  <textarea
			style="width:100%;height:100px;box-sizing:border-box;margin-top: 7px;"
			placeholder="You can either\n- Paste map data here and press Import,\n- OR just press Load from file and select the data"
			></textarea>
		  <p style="height: 28px;">How to handle doors:
		  <select class="doors-config" style="width:160px;float:right">${[
		["d", "Default"],
		["X", "Don't import"],
		["o", "As opened doors"],
		["l", "As locked doors"],
		["s", "As secret doors"],
		["sl", "As locked secret doors"],
		["so", "As open secret doors"],
		["LS", "As solid lines"],
		["LT", "As transparent lines"],
	].reduce((html, [v, o]) => {
		return `${html}<option value="${v}">${o}</option>`
	}, "")}
		  </select></p>
		  <p style="height: 28px;">How to handle windows:
		  <select class="windows-config" style="width:160px;float:right">${[
		["d", "Default"],
		["X", "Don't import"],
		["o", "As opened windows"],
		["l", "As locked windows"],
		["LS", "As solid lines"],
		["LT", "As transparent lines"],
	].reduce((html, [v, o]) => {
		return `${html}<option value="${v}">${o}</option>`
	}, "")}
		  </select></p>
		  <p style="height: 28px;">How to handle light sources:
		  <select class="lights-config" style="width:160px;float:right">${[
		["d", "Default"],
		["X", "Don't import"],
	].reduce((html, [v, o]) => {
		return `${html}<option value="${v}">${o}</option>`
	}, "")}
		  </select></p>
		  <p style="height: 28px;">Attempt to resize and fit the map
		  <span style="width:160px;float:right;display: inline-block;">
			<input type="checkbox" checked="true" class="resize-config" style="float:left">
		  </span></p>
		  <input class="vtt-export" style="display:none" type="file" name="file" accept=".txt, .dd2vtt"/>
		  </div>
		`;

		// Service functions
		const getMap = () => {
			// simplest case - get the ONLY map graphic and use that one
			const mapGraphics = findObjs();

			// filter them all so we only consider the layer=map graphics
			if (mapGraphics.length === 1) {
				return mapGraphics[0];
			}

			// no map
			if (mapGraphics.length === 0) {
				sendChat(
					"You need to upload your map image and put it in the Map Layer before importing the line-of-sight data. Make sure that your map is in the background layer by right clicking on it, selecting \"Layer\" and choosing \"Map Layer\".",
				);
				return null;
			}

			// otherwise, see if we selected one
			const selected = d20.engine.selected();
			if (selected === undefined
				|| selected.length === 0
				|| selected[0]?._model.get("layer") !== "map"
			) {
				sendChat(
					"If you have more than one image in the map layer, you need to select the one that contains the Dungeon Alchemist map image before running the command.",
				);
				return null;
			} else {
				return selected[0]._model;
			}
		};

		const resizeMap = (gridSize, grid, map) => {
			if (!this.configResize) return;

			if (grid.x === undefined) {
				const fromString = grid.split(" ");
				grid = {
					x: parseInt(fromString[0]),
					y: parseInt(fromString[1]),
				}
			}

			const mapWidth = grid.x * gridSize;
			const mapHeight = grid.y * gridSize;

			grid.x && grid.y && this.page.set({
				width: (grid.x * gridSize) / defaultGridSize,
				height: (grid.y * gridSize) / defaultGridSize,
			});

			map.save({
				width: mapWidth,
				height: mapHeight,
				top: mapHeight / 2,
				left: mapWidth / 2,
				layer: "map",
			});
		};

		const prepareUVTT = (data, mapUnit) => {
			data.walls = [];
			data.line_of_sight
				.concat(data.objects_line_of_sight)
				.forEach(el => {
					el.forEach((w, i) => {
						if (el[i + 1]) { data.walls.push({
							wallSection: "",
							type: 0,
							open: false,
							wall3D: {
								p1: {
									top: {
										x: w.x * mapUnit,
										y: w.y * mapUnit,
									},
								},
								p2: {
									top: {
										x: el[i + 1].x * mapUnit,
										y: el[i + 1].y * mapUnit,
									},
								},
							},
						}); }
					})
				});
			data.portals.forEach(el => {
				data.walls.push({
					wallSection: "",
					type: el.closed ? 1 : 2,
					open: false,
					wall3D: {
						p1: {
							top: {
								x: el.bounds[0].x * mapUnit,
								y: el.bounds[0].y * mapUnit,
							},
						},
						p2: {
							top: {
								x: el.bounds[1].x * mapUnit,
								y: el.bounds[1].y * mapUnit,
							},
						},
					},
				});
			});
			data.lights.forEach(el => {
				el.position.x = el.position.x * mapUnit;
				el.position.y = el.position.y * mapUnit;
				el.color = `#${el.color.toUpperCase()}`;
				el.range = el.range * mapUnit;
			})
		};

		const createWall = (wall, originalGridSize, gridSize) => {
			// BEGIN MOD
			if ((wall.type === 1 && this.configDoors === "LS")
				|| (wall.type === 2 && this.configWindows === "LS")) {
				wall.type = 0;
			} else if ((wall.type === 1 && this.configDoors === "LT")
				|| (wall.type === 2 && this.configWindows === "LT")) {
				wall.type = 4;
			}
			// END MOD

			let x1 = wall.wall3D.p1.top.x * gridSize / originalGridSize;
			let y1 = wall.wall3D.p1.top.y * gridSize / originalGridSize;
			let x2 = wall.wall3D.p2.top.x * gridSize / originalGridSize;
			let y2 = wall.wall3D.p2.top.y * gridSize / originalGridSize;

			const xCenter = (x1 + x2) * 0.5;
			const yCenter = (y1 + y2) * 0.5;

			const xMin = Math.min(x1, x2);
			const yMin = Math.min(y1, y2);
			const xMax = Math.max(x1, x2);
			const yMax = Math.max(y1, y2);

			const width = xMax - xMin;
			const height = yMax - yMin;

			// log("Center: ", wall, x1, y1, x2, y2, originalGridSize);

			// because partial walls used to be exported as windows, we can't support them for older exports
			const generateWindows = this.format === "UVTT" || this.version >= 2;

			// new door/window API
			if (wall.type === 1 || (wall.type === 2 && generateWindows)) {
				const type = (wall.type === 1) ? "door" : "window";
				const color = (wall.type === 1) ? "#00ff00" : "#00ffff";

				x1 -= xCenter;
				x2 -= xCenter;
				y1 -= yCenter;
				y2 -= yCenter;

				let open = wall.open;
				if (typeof (open) === "undefined") open = false;

				let doorObj = {
					pageid: this.page.get("_id"),
					color: color,
					x: xCenter,
					y: -yCenter,
					isOpen: open,
					isLocked: false,
					isSecret: false,
					path: {
						handle0: { x: x1, y: y1 },
						handle1: { x: x2, y: y2 },
					},
				};
				createObj(type, doorObj);
				// log(doorObj);
			}

			// default
			else if (wall.type === 0 || wall.type === 4 || (wall.type === 2 && !generateWindows)) {
				x1 -= xMin;
				x2 -= xMin;
				y1 -= yMin;
				y2 -= yMin;

				const path = [
					["M", x1, y1],
					["L", x2, y2],
				];

				// different wall types have different colors - we use a color scheme compatible with WOTC modules and DoorKnocker
				let color = "#0000ff";
				let barrierType = "wall";
				if (wall.type === 4) {
					color = "#5555ff";
					barrierType = "transparent";
				}

				// backwards compatibility
				else if (wall.type === 2) {
					color = "#00ffff"; // window (light blue)
					barrierType = "transparent";
				}

				createObj("path", {
					pageid: this.page.get("_id"),
					stroke: color,
					fill: "transparent",
					left: xCenter,
					top: yCenter,
					width: width,
					height: height,
					rotation: 0,
					scaleX: 1,
					scaleY: 1,
					stroke_width: 5,
					layer: "walls",
					path: JSON.stringify(path),
					barrierType: barrierType,
				});
			}
		};

		const createLight = (light, originalGridSize, gridSize) => {
			const x = light.position.x * gridSize / originalGridSize;
			const y = light.position.y * gridSize / originalGridSize;

			const range = light.range * 1.0;
			let dim_radius = range;
			let bright_radius = range / 2;

			// convert to the local scale value
			const scale_number = this.page.get("scale_number");
			// log("Go from dim_radius " + dim_radius + " which has range " + range + " to per tile " + (dim_radius/originalGridSize) + " from original grid size " + originalGridSize + " and scale_number is " + scale_number);
			dim_radius *= scale_number / originalGridSize;
			bright_radius *= scale_number / originalGridSize;

			const newObj = createObj("graphic", {
				imgsrc: lightURL,
				subtype: "token",
				name: "", /* BEGIN MOD we don't need auras since we got original "torch" image
				aura1_radius: 0.5,
				aura1_color: "#" + light.color.substring(0, 6), */

				// UDL
				emits_bright_light: true,
				emits_low_light: true,
				bright_light_distance: bright_radius,
				low_light_distance: dim_radius,

				width: 70,
				height: 70,
				top: y,
				left: x,
				layer: "walls",
				pageid: this.page.get("_id"),
			});

			// log("New obj light distance: " + newObj.get("bright_light_distance") + " / " + newObj.get("low_light_distance"));
		};

		// Main import function
		const handleInput = (txt) => {
			d20plus.ut.log("Handle VTT data input");
			// log(txt);
			if (!is_gm) return;

			const endOfHeader = txt.indexOf("dungeonalchemist") !== -1 ? txt.indexOf(" ") : 0;

			try {
				const json = txt.substring(endOfHeader);
				const data = JSON.parse(json);

				// determine the version
				this.format = data.version ? "DA" : "UVTT";
				this.version = data.version || data.format || 1;

				this.page = getObj("page");

				// calculate the REAL grid size
				const gridSize = defaultGridSize * this.page.get("snapping_increment");
				const mapSize = data.grid || data?.resolution.map_size;
				const mapUnit = data.pixelsPerTile || data?.resolution.pixels_per_grid;

				// load and resize the map
				const map = getMap();
				if (map === null) return;
				resizeMap(gridSize, mapSize, map);

				// prepare data from UVTT format
				if (this.format === "UVTT") {
					prepareUVTT(data, mapUnit);
				}

				// spawn the walls & lights
				for (const wall of data.walls) {
					createWall(wall, mapUnit, gridSize);
				}

				for (const light of data.lights) {
					createLight(light, mapUnit, gridSize);
				}

				sendChat(
					"Succesfully imported map data!",
				);
			} catch (err) {
				d20plus.ut.log(err, true);
				sendChat(
					`Failed to import Dungeon Alchemist map data: ${err}`,
				);
			}
		};

		const process = ($editor) => {
			const txt = $editor.find("textarea").val();

			this.configDoors = $editor.find(".doors-config").val();
			this.configWindows = $editor.find(".windows-config").val();
			this.configLights = $editor.find(".lights-config").val();
			this.configResize = $editor.find(".resize-config").prop("checked");

			handleInput(txt);
			$editor.off();
			$editor.dialog("destroy").remove();
		};

		const init = () => {
			const $editor = $(dialog);
			$editor.dialog({
				autoopen: true,
				title: scriptName,
				width: 450,
				open: () => {
					const loadBtn = $editor.find(".load-file");
					loadBtn.on("click", () => {
						const fileSelect = $editor.find("input.vtt-export");
						fileSelect.off("change");
						fileSelect.on("change", () => {
							const file = fileSelect[0].files[0];
							const reader = new FileReader();
							reader.addEventListener("load", (event) => {
								const txt = event.target.result;
								$editor.find("textarea").val(txt);
							});
							reader.readAsText(file);
						});
						fileSelect.click();
					});
				},
				buttons: {
					"Cancel": () => {
						$editor.off();
						$editor.dialog("destroy").remove();
					},
					"Import": () => {
						process($editor);
					},
				},
				close: () => { $editor.off(); $editor.dialog("destroy").remove() },
			})
		};

		init();
	};

	d20plus.tool.tools.push({
		toolId: "DLIMPORT",
		name: "Universal DL Importer",
		desc: "Import map data from DungeonDraft (UVTT) and Dungeon Alchemist",
		html: ``,
		dialogFn: () => {},
		openFn: () => {
			const importer = new UniversalMapDLImporter();
		},
	})
}

SCRIPT_EXTENSIONS.push(baseToolDLImport);
