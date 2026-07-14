function d20plusAdventure () {
	d20plus.adventures = {};
	d20plus.books = {};
	d20plus.homebrew = {};

	const ROLL20_PX = 70;
	const GRID_DIVISORS = [100, 140, 72, 80, 60, 50, 90, 120, 150, 70];
	const PLUTONIUM_BASE = "https://raw.githubusercontent.com/TheGiddyLimit/plutonium-scenes/main/data";
	// Roll20 only understands square/hex/hexr/dimetric/isometric; 5etools grid.type is finer-grained (e.g. "hexColsOdd").
	function resolveGridType (rawType) {
		if (!rawType) return "square";
		const lower = rawType.toLowerCase();
		if (lower.startsWith("hexcol")) return "hexr"; // Hex (H)
		if (lower.startsWith("hexrow")) return "hex"; // Hex (V)
		if (lower === "hex" || lower === "hexr" || lower === "isometric" || lower === "dimetric") return lower;
		return "square";
	}

	function makeId () {
		try { return "-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20); } catch (e) {
			return "-" + Math.random().toString(36).slice(2).padEnd(20, "0").slice(0, 20);
		}
	}

	// Walk all entries and detect what content types are present
	function scanContent (entries) {
		const result = {hasMaps: false, hasCreatures: false, hasItems: false};
		function walk (e) {
			if (Array.isArray(e)) { e.forEach(walk); return; }
			if (typeof e === "string") {
				if (!result.hasCreatures && /{@creature/.test(e)) result.hasCreatures = true;
				if (!result.hasItems && /{@item/.test(e)) result.hasItems = true;
				return;
			}
			if (typeof e !== "object" || !e) return;
			if (!result.hasMaps && (e.imageType === "map" || e.imageType === "mapPlayer")) result.hasMaps = true;
			if (!result.hasCreatures && e.type === "statblock" && e.tag === "creature") result.hasCreatures = true;
			for (const v of Object.values(e)) {
				if (v && typeof v === "object") walk(v);
			}
		}
		walk(entries);
		return result;
	}

	// Extract all {@creature Name|Source} references and inline statblocks from content
	function extractCreatureRefs (entries) {
		const CREATURE_RE = /\{@creature ([^|}]+?)(?:\|([^|}]*?))?(?:\|[^}]*)?\}/g;
		const refs = new Map();
		function walk (e) {
			if (typeof e === "string") {
				let m;
				CREATURE_RE.lastIndex = 0;
				while ((m = CREATURE_RE.exec(e))) {
					const name = m[1].trim();
					const source = (m[2] || "MM").trim();
					refs.set(`${name.toLowerCase()}|${source.toUpperCase()}`, {name, source: source.toUpperCase()});
				}
			} else if (Array.isArray(e)) {
				e.forEach(walk);
			} else if (e && typeof e === "object") {
				if (e.type === "statblock" && e.tag === "creature" && e.name) {
					const source = (e.source || "MM").toUpperCase();
					refs.set(`${e.name.toLowerCase()}|${source}`, {name: e.name, source});
				}
				for (const v of Object.values(e)) {
					if (v && typeof v === "object") walk(v);
				}
			}
		}
		walk(entries);
		return [...refs.values()];
	}

	// Extract all {@item Name} references from content
	function extractItemRefs (entries) {
		const ITEM_RE = /\{@item ([^|}]+?)(?:\|[^}]*)?\}/g;
		const names = new Set();
		function walk (e) {
			if (typeof e === "string") {
				let m;
				ITEM_RE.lastIndex = 0;
				while ((m = ITEM_RE.exec(e))) names.add(m[1].trim().toLowerCase());
			} else if (Array.isArray(e)) {
				e.forEach(walk);
			} else if (e && typeof e === "object") {
				for (const v of Object.values(e)) {
					if (v && typeof v === "object") walk(v);
				}
			}
		}
		walk(entries);
		return [...names];
	}

	// Fetch creature data from CDN, grouped by source. `homebrewMonsters`, if given, is checked
	// first (name+source, falling back to name-only) since homebrew-defined creatures won't
	// exist on the official CDN under any source code.
	async function fetchCreatureData (refs, homebrewMonsters) {
		if (!refs.length) return [];
		const result = [];
		const remaining = [];
		if (homebrewMonsters?.length) {
			refs.forEach(ref => {
				const nameLower = ref.name.toLowerCase();
				const match = homebrewMonsters.find(m => m.name.toLowerCase() === nameLower && (m.source || "").toLowerCase() === ref.source.toLowerCase())
					|| homebrewMonsters.find(m => m.name.toLowerCase() === nameLower);
				if (match) result.push(match);
				else remaining.push(ref);
			});
		} else {
			remaining.push(...refs);
		}

		const bySource = {};
		remaining.forEach(({name, source}) => {
			if (!bySource[source]) bySource[source] = new Set();
			bySource[source].add(name.toLowerCase());
		});
		for (const [source, names] of Object.entries(bySource)) {
			const filename = monsterDataUrls[source] || monsterDataUrls[source.toLowerCase()];
			if (!filename) {
				d20plus.ut.log(`Bestiary: no file for source "${source}" — skipping`);
				continue;
			}
			try {
				const data = await DataUtil.loadJSON(`${MONSTER_DATA_DIR}${filename}`);
				(data.monster || []).forEach(m => {
					if (names.has(m.name.toLowerCase())) result.push(m);
				});
			} catch (e) {
				d20plus.ut.log(`Bestiary fetch failed for "${source}": ${e.message || e}`);
			}
		}
		return result;
	}

	// Fetch item data using the same pipeline as the normal item button (loads mastery/property refs).
	// `homebrewItems`, if given, is checked first for names not resolved from the official CDN.
	async function fetchItemData (itemNames, homebrewItems) {
		if (!itemNames.length) return [];
		const nameSet = new Set(itemNames);
		const result = [];
		if (homebrewItems?.length) {
			homebrewItems.forEach(it => {
				const nameLower = it.name.toLowerCase();
				if (nameSet.has(nameLower)) {
					result.push(it);
					nameSet.delete(nameLower);
				}
			});
		}
		if (!nameSet.size) return result;
		try {
			await Renderer.item.pPopulatePropertyAndTypeReference();
			const allItems = await Renderer.item.pBuildList();
			return result.concat(allItems.filter(it => nameSet.has(it.name.toLowerCase())));
		} catch (e) {
			d20plus.ut.log(`Item fetch failed: ${e.message || e}`);
			return result;
		}
	}

	// Strip "Map X.X: " prefix and lowercase for fuzzy Foundry matching
	function normalizeMapName (name) {
		return (name || "").replace(/^Map\s+\d+(?:\.\d+)?:\s*/i, "").toLowerCase().trim();
	}

	// Index Foundry map data by name (exact lowercase + normalized)
	function indexFoundryMaps (foundryData) {
		const byName = {};
		(foundryData?.map || []).forEach(m => {
			const name = m.name || "";
			byName[name.toLowerCase()] = m;
			const norm = normalizeMapName(name);
			if (norm && norm !== name.toLowerCase()) byName[norm] = m;
		});
		return byName;
	}

	// Fetch Plutonium Scenes wall data, trying adventure ID then source code
	async function fetchFoundryMaps (adventureId, adventureSource) {
		const attempts = [
			adventureId ? `${PLUTONIUM_BASE}/foundry-maps-${adventureId.toLowerCase()}.json` : null,
			(adventureSource && adventureSource.toLowerCase() !== adventureId?.toLowerCase())
				? `${PLUTONIUM_BASE}/foundry-maps-${adventureSource.toLowerCase()}.json`
				: null,
		].filter(Boolean);
		for (const url of attempts) {
			try {
				const d = await DataUtil.loadJSON(url);
				if (d?.map?.length) return indexFoundryMaps(d);
			} catch (e) { /* try next */ }
		}
		return null;
	}

	// Convert one plain (non-door) Foundry wall segment to a Roll20 path dict
	function foundryWallToPath (wall, scale) {
		const coords = wall.c;
		if (!coords || coords.length !== 4) return null;
		const [x1, y1, x2, y2] = coords.map(v => v * scale);
		const minX = Math.min(x1, x2), minY = Math.min(y1, y2);
		const maxX = Math.max(x1, x2), maxY = Math.max(y1, y2);
		const w = Math.max(1, Math.round(maxX - minX));
		const h = Math.max(1, Math.round(maxY - minY));
		return {
			path: JSON.stringify([
				["M", Math.round(x1 - minX), Math.round(y1 - minY)],
				["L", Math.round(x2 - minX), Math.round(y2 - minY)],
			]),
			shape: "", points: "",
			barrierType: "wall",
			z_index: 0,
			fill: "transparent",
			stroke: "#0000ff",
			type: "path",
			rotation: 0,
			layer: "walls",
			stroke_width: 5,
			controlledby: "", groupwith: "",
			width: w, height: h,
			top: Math.round(minY + h / 2),
			left: Math.round(minX + w / 2),
			x: 0, y: 0,
			scaleX: 1, scaleY: 1,
			oneWayReversed: false,
			id: makeId(),
		};
	}

	// Convert one Foundry door wall segment to a Roll20 native Door object dict.
	// Roll20's Door/Window objects use an inverted y axis for their own position (confirmed
	// against base-tool-dlimport.js's proven working UVTT/DungeonAlchemist importer, which
	// uses the identical `x: xCenter, y: -yCenter` convention) - the handle offsets themselves
	// are inverted too, since the whole door object shares one y-inverted coordinate frame -
	// confirmed by real diagonal-door testing: leaving handle y un-inverted (matching
	// base-tool-dlimport.js's convention) mirrored diagonal doors' rotation while leaving
	// horizontal/vertical doors unaffected (dy=0 or dx=0 respectively, so the sign flip is a no-op
	// for those two cases specifically, which is exactly the symptom observed).
	function foundryWallToDoor (wall, scale) {
		const coords = wall.c;
		if (!coords || coords.length !== 4) return null;
		const [x1, y1, x2, y2] = coords.map(v => v * scale);
		const xCenter = (x1 + x2) / 2, yCenter = (y1 + y2) / 2;
		return {
			color: "#00ff00",
			x: xCenter, y: -yCenter,
			isOpen: wall.ds === 1,
			isLocked: wall.ds === 2,
			isSecret: wall.door === 2,
			path: {
				handle0: {x: x1 - xCenter, y: yCenter - y1},
				handle1: {x: x2 - xCenter, y: yCenter - y2},
			},
		};
	}

	// Convert all Foundry walls for a map to Roll20 paths/doors. Foundry/Plutonium scene data is
	// sometimes authored against a higher-resolution version of the map image than the one
	// 5etools declares - verified on real LMOP data: Cragmaw Hideout/Redbrand Hideout/Cragmaw
	// Castle have wall coords matching the declared image 1:1 (ratio ~0.96-1.00 on both axes),
	// while Ruins of Thundertree/Wave Echo Cave have wall coords at ~2x the declared image size
	// (ratio ~1.9-1.98 on both axes) - applying imageScale directly to those put every wall
	// ~2x too far out, outside the map. The two groups are cleanly separated (no data anywhere
	// between ~1.0 and ~1.9), and both axes agree closely within each map, so the resolution
	// multiplier can be read off directly: compare the walls' own bounding box to the declared
	// image size and round to the nearest whole multiple, rather than assuming it's always 1:1.
	function convertFoundryWalls (foundryMap, imageScale, imgPixelW, imgPixelH) {
		const walls = foundryMap.walls || [];
		if (!walls.length) return {paths: [], doors: []};
		const xs = walls.flatMap(w => w.c?.length === 4 ? [w.c[0], w.c[2]] : []);
		const ys = walls.flatMap(w => w.c?.length === 4 ? [w.c[1], w.c[3]] : []);
		if (!xs.length) return {paths: [], doors: []};
		const maxX = Math.max(...xs), maxY = Math.max(...ys);
		if (maxX <= 0 || maxY <= 0 || !imgPixelW || !imgPixelH) return {paths: [], doors: []};
		const ratio = ((maxX / imgPixelW) + (maxY / imgPixelH)) / 2;
		const resolutionMultiplier = Math.max(1, Math.round(ratio));
		const scale = imageScale / resolutionMultiplier;
		const wallSegs = walls.filter(w => !w.door);
		const doorSegs = walls.filter(w => w.door);
		return {
			paths: wallSegs.map(w => foundryWallToPath(w, scale)).filter(Boolean),
			doors: doorSegs.map(w => foundryWallToDoor(w, scale)).filter(Boolean),
		};
	}

	// Convert mapRegion polygon to a wall outline path
	function regionToPath (region, scaleX, scaleY) {
		const pts = region.points || [];
		if (pts.length < 2) return null;
		const scaled = pts.map(p => [p[0] * scaleX, p[1] * scaleY]);
		const minX = Math.min(...scaled.map(p => p[0]));
		const minY = Math.min(...scaled.map(p => p[1]));
		const maxX = Math.max(...scaled.map(p => p[0]));
		const maxY = Math.max(...scaled.map(p => p[1]));
		const w = Math.max(1, Math.round(maxX - minX));
		const h = Math.max(1, Math.round(maxY - minY));
		const cmds = scaled.map((p, i) => [i === 0 ? "M" : "L", Math.round(p[0] - minX), Math.round(p[1] - minY)]);
		cmds.push(["L", Math.round(scaled[0][0] - minX), Math.round(scaled[0][1] - minY)]);
		return {
			path: JSON.stringify(cmds),
			shape: "", points: "",
			barrierType: "wall",
			z_index: 0, fill: "transparent", stroke: "#0000ff",
			type: "path", rotation: 0, layer: "walls",
			stroke_width: 5, controlledby: "", groupwith: "",
			width: w, height: h,
			top: Math.round(minY + h / 2), left: Math.round(minX + w / 2),
			x: 0, y: 0, scaleX: 1, scaleY: 1, oneWayReversed: false,
			id: makeId(),
		};
	}

	// Build a map of area ID → [creature names] by walking section entries with .id fields
	function buildAreaCreatures (sections) {
		const CREATURE_RE = /\{@creature ([^|}]+?)(?:\|[^}]*)?\}/g;
		const areaCreatures = {};
		function walk (e, currentArea) {
			if (typeof e === "string") {
				if (!currentArea) return;
				let m;
				CREATURE_RE.lastIndex = 0;
				while ((m = CREATURE_RE.exec(e))) {
					const name = m[1].trim();
					if (!areaCreatures[currentArea]) areaCreatures[currentArea] = [];
					if (!areaCreatures[currentArea].includes(name)) areaCreatures[currentArea].push(name);
				}
			} else if (Array.isArray(e)) {
				e.forEach(item => walk(item, currentArea));
			} else if (e && typeof e === "object") {
				const area = e.id || currentArea;
				for (const [k, v] of Object.entries(e)) {
					if (v && typeof v === "object") walk(v, area);
					else if (typeof v === "string") walk(v, area);
				}
			}
		}
		walk(sections, null);
		return areaCreatures;
	}

	// Recursively find all map image entries in adventure/book data
	function findMapEntries (entries, result = []) {
		if (!Array.isArray(entries)) entries = [entries];
		for (const e of entries) {
			if (typeof e !== "object" || !e) continue;
			if (e.imageType === "map" || e.imageType === "mapPlayer") result.push(e);
			if (e.entries) findMapEntries(e.entries, result);
			if (e.images) findMapEntries(e.images, result);
			if (Array.isArray(e.data)) findMapEntries(e.data, result);
		}
		return result;
	}

	// Resolve a map entry's image URL the same way buildMapObject does, for fetching purposes.
	function resolveMapImageUrl (entry) {
		const href = entry.href || {};
		if (href.type === "internal" && href.path) {
			return `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/${href.path}`;
		}
		return href.url || href.path || "";
	}

	// Some homebrew map entries omit width/height entirely (just {type:"image", href, title,
	// imageType, id} - no grid, no dimensions at all). buildMapObject's `entry.width || 1750`
	// fallback then guesses a square 1750x1750 for whatever the real image size is - verified
	// against a real case (declared: none, actual: 960x480) this produces a completely wrong
	// size/aspect ratio, not just a coarse grid. Separately, some adventure maps declare
	// `grid.size` as a whole multiple of the grid actually painted on the artwork (schema
	// requires `grid.size >= 50`, so on maps with a finer painted grid the author declares a
	// multiple and bumps `grid.scale` to compensate), causing Roll20's grid to come out 2-4x too
	// coarse. Both cases require inspecting the real image, so do it once per map: fetch+decode
	// only when needed, and reuse the same decoded bitmap for whichever check applies.
	async function analyzeMapImage (entry) {
		const result = {realWidth: null, realHeight: null, paintedGridSize: null};
		const grid = entry.grid || {};
		const needsDimensions = !entry.width || !entry.height;

		const candidates = [];
		if (grid.type === "square" && grid.size && Number.isInteger(grid.scale) && grid.scale >= 2) {
			for (let m = 2; m <= 8; m++) {
				const ft = (grid.scale * 5) / m;
				if (![5, 10, 15, 20].includes(ft)) continue;
				const pitch = grid.size / m;
				if (pitch >= 8) candidates.push(pitch);
			}
		}
		const needsGridCheck = candidates.length > 0;

		if (!needsDimensions && !needsGridCheck) return result;

		const imgUrl = resolveMapImageUrl(entry);
		if (!imgUrl) return result;

		let bitmap;
		try {
			const resp = await fetch(imgUrl, {mode: "cors"});
			if (!resp.ok) return result;
			const blob = await resp.blob();
			bitmap = await createImageBitmap(blob);
		} catch (e) { return result; }

		if (needsDimensions) {
			result.realWidth = bitmap.width;
			result.realHeight = bitmap.height;
		}

		if (needsGridCheck) {
			const canvas = document.createElement("canvas");
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const ctx = canvas.getContext("2d", {willReadFrequently: true});
			ctx.drawImage(bitmap, 0, 0);
			let imgData;
			try {
				imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			} catch (e) { imgData = null; } // e.g. tainted canvas

			if (imgData) {
				const {width: w, height: h, data} = imgData;
				const gray = new Float64Array(w * h);
				for (let i = 0; i < w * h; i++) {
					gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
				}

				const profX = new Float64Array(w);
				for (let y = 0; y < h; y++) {
					const row = y * w;
					for (let x = 1; x < w; x++) profX[x] += Math.abs(gray[row + x] - gray[row + x - 1]);
				}
				const profY = new Float64Array(h);
				for (let y = 1; y < h; y++) {
					const row = y * w, prev = (y - 1) * w;
					for (let x = 0; x < w; x++) profY[y] += Math.abs(gray[row + x] - gray[prev + x]);
				}
				const meanSubtract = arr => {
					const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
					for (let i = 0; i < arr.length; i++) arr[i] -= mean;
				};
				meanSubtract(profX);
				meanSubtract(profY);

				const autocorrAt = (prof, lag) => {
					const n = prof.length;
					const L = Math.floor(lag), frac = lag - L;
					let num = 0, d1 = 0, d2 = 0;
					for (let i = 0; i + L + 1 < n; i++) {
						const shifted = prof[i + L] * (1 - frac) + prof[i + L + 1] * frac;
						num += prof[i] * shifted;
						d1 += prof[i] * prof[i];
						d2 += shifted * shifted;
					}
					return d1 && d2 ? num / Math.sqrt(d1 * d2) : 0;
				};

				// Empirically-derived thresholds (measured against 15 real adventure maps: 5
				// known-broken, 10 known-good). Broken maps scored >=0.44 mean / >=0.35 min; good
				// maps scored <=0.30 mean / <=0.19 min. Accept the finest candidate pitch that
				// clears both bars on both axes.
				for (const pitch of candidates.sort((a, b) => a - b)) {
					const corrX = autocorrAt(profX, pitch);
					const corrY = autocorrAt(profY, pitch);
					if (Math.min(corrX, corrY) >= 0.3 && (corrX + corrY) / 2 >= 0.4) {
						result.paintedGridSize = pitch;
						break;
					}
				}
			}
		}

		bitmap.close?.();
		return result;
	}

	// Build a Roll20 map object from a 5etools map image entry.
	// `paintedGridSize`, if given, is a directly-measured pixel pitch of the grid actually
	// painted on the artwork (see `analyzeMapImage`) - used when the declared
	// `grid.size` is a multiple of the painted grid rather than the painted grid itself.
	// `wallLookupTitle`, if given, is used instead of the entry's own title to key into
	// `foundryMaps` - needed for "mapPlayer" entries, whose own title is often a generic
	// literal like "Player Version" and would otherwise never match Foundry's map names.
	function buildMapObject (entry, foundryMaps, paintedGridSize, wallLookupTitle) {
		const title = entry.title || entry.name || "Map";
		const grid = entry.grid || {};
		const imgPixelW = entry.width || 1750;
		const imgPixelH = entry.height || 1750;
		const offsetX = (grid.offsetX || 0) * -1;
		const offsetY = (grid.offsetY || 0) * -1;
		let gridSizePx = grid.size || 0;
		if (!gridSizePx && grid.type) {
			gridSizePx = GRID_DIVISORS.find(d => imgPixelW % d === 0 && imgPixelH % d === 0) || 0;
		}
		if (!gridSizePx) gridSizePx = 70;

		// Subdivision factor for when `grid.size` is a multiple of the painted grid pitch
		// (e.g. declared 50px but the art has a 16.7px grid painted on it, 3x finer).
		const subdivision = (paintedGridSize && gridSizePx > paintedGridSize)
			? gridSizePx / paintedGridSize
			: 1;
		if (subdivision > 1) {
			d20plus.ut.log(`Map "${title}": painted grid detected at ${paintedGridSize.toFixed(1)}px (declared ${gridSizePx}px); subdividing by ${subdivision.toFixed(2)}`);
			gridSizePx = paintedGridSize;
		}

		const roll20MapW = imgPixelW * ROLL20_PX / gridSizePx;
		const roll20MapH = imgPixelH * ROLL20_PX / gridSizePx;
		const mapW = Math.max(1, Math.ceil((imgPixelW + offsetX) / gridSizePx));
		const mapH = Math.max(1, Math.ceil((imgPixelH + offsetY) / gridSizePx));
		const roll20W = mapW * ROLL20_PX;
		const roll20H = mapH * ROLL20_PX;
		const scaleX = roll20W / imgPixelW;
		const scaleY = roll20H / imgPixelH;
		const imageScale = ROLL20_PX / gridSizePx;
		const gridScale = grid.scale || 1;
		const distanceScale = gridScale / subdivision;
		const gridType = resolveGridType(grid.type);

		// Resolve image URL
		const href = entry.href || {};
		let imgUrl;
		if (href.type === "internal" && href.path) {
			imgUrl = `https://5e.tools/img/${href.path}`;
		} else {
			imgUrl = href.url || href.path || "";
			if (imgUrl.includes("raw.githubusercontent.com") && !imgUrl.includes("?")) {
				imgUrl = imgUrl.replace(
					"githubusercontent.com/TheGiddyLimit/homebrew-img/main/",
					"githubusercontent.com/TheGiddyLimit/homebrew-img/refs/heads/main/",
				);
			}
		}

		// Collect area centroids from mapRegions for future token placement
		const areaCentroids = {};
		(entry.mapRegions || []).forEach(r => {
			if (r.area && r.points?.length) {
				const xs = r.points.map(p => p[0]);
				const ys = r.points.map(p => p[1]);
				areaCentroids[r.area] = [
					((xs.reduce((a, b) => a + b, 0) / xs.length) + offsetX / gridScale) * imageScale,
					((ys.reduce((a, b) => a + b, 0) / ys.length) + offsetY / gridScale) * imageScale,
				];
			}
		});

		// Look up Foundry wall data by title
		const lookupTitle = wallLookupTitle || title;
		const foundryMap = foundryMaps && (foundryMaps[lookupTitle.toLowerCase()] || foundryMaps[normalizeMapName(lookupTitle)]);
		let paths = [], doors = [];
		if (foundryMap) {
			({paths, doors} = convertFoundryWalls(foundryMap, imageScale, imgPixelW, imgPixelH));
			d20plus.ut.log(`Map "${title}": ${paths.length} wall paths, ${doors.length} doors from Foundry data`);
		} else {
			(entry.mapRegions || []).forEach(r => {
				const p = regionToPath(r, imageScale, imageScale);
				if (p) paths.push(p);
			});
			if (paths.length) d20plus.ut.log(`Map "${title}": ${paths.length} mapRegion outlines (no Foundry data)`);
		}

		const mapId = makeId();
		paths.forEach(p => { p.page_id = mapId; });
		doors.forEach(d => { d.pageid = mapId; });

		return {
			mapId,
			title,
			areaCentroids,
			pageAttrs: {
				name: title,
				version: 0,
				showgrid: true,
				showdarkness: false,
				width: mapW,
				height: mapH,
				snapping_increment: 1,
				grid_opacity: 0.5,
				fog_opacity: 0.35,
				background_color: "#FFFFFF",
				gridcolor: "#C0C0C0",
				grid_type: gridType,
				scale_number: (grid.distance && subdivision === 1) ? grid.distance : distanceScale * 5,
				scale_units: grid.units || "ft",
				archived: false,
				thumbnail: imgUrl,
				dynamic_lighting_enabled: (paths.length + doors.length) > 0,
				id: mapId,
			},
			backgroundGraphic: {
				left: (imgPixelW / 2 + offsetX / gridScale) * imageScale, top: (imgPixelH / 2 + offsetY / gridScale) * imageScale,
				width: imgPixelW * imageScale, height: imgPixelH * imageScale,
				z_index: 0, imgsrc: imgUrl,
				rotation: 0, type: "image",
				page_id: mapId, layer: "map",
				locked: true, name: title,
				id: makeId(),
			},
			paths,
			doors,
		};
	}

	// Create Roll20 pages from map objects (mirrors base-tool-module.js pattern)
	// Returns [{roll20PageId, areaCentroids, title}] for token placement
	async function importMaps (mapObjects) {
		d20plus.ut.log(`Creating ${mapObjects.length} map page(s)...`);
		const savedMaps = [];
		for (const mo of mapObjects) {
			const page = d20.Campaign.pages.create(mo.pageAttrs);
			page.save();
			const roll20PageId = page.id;
			await new Promise(resolve => {
				setTimeout(async () => {
					const savedPage = d20.Campaign.pages.get(roll20PageId);
					if (!savedPage) { resolve(); return; }
					if (!savedPage.thegraphics) await savedPage.fullyLoadPage();
					const fixUrl = url => (d20plus.ut.fixS3Url ? d20plus.ut.fixS3Url(url, false) : url);
					const bg = {...mo.backgroundGraphic, page_id: savedPage.id};
					bg.imgsrc = fixUrl(bg.imgsrc);
					savedPage.thegraphics?.create(bg);
					mo.paths.forEach(p => {
						savedPage.thepaths?.create({...p, page_id: savedPage.id});
					});
					mo.doors.forEach(d => {
						savedPage.doors?.create({...d, pageid: savedPage.id});
					});
					savedMaps.push({roll20PageId, areaCentroids: mo.areaCentroids, title: mo.title});
					d20plus.ut.log(`Map page created: ${mo.title}`);
					resolve();
				}, 150);
			});
		}
		d20plus.ut.log(`All map pages created.`);
		return savedMaps;
	}

	// Place NPC tokens on the GM layer at map area centroids
	function placeTokensOnMaps (savedMaps, areaCreatures, monsters) {
		const CREATURE_SIZE_SQUARES = {T: 1, S: 1, M: 1, L: 2, H: 3, G: 4};
		let placed = 0;
		savedMaps.forEach(({roll20PageId, areaCentroids}) => {
			const savedPage = d20.Campaign.pages.get(roll20PageId);
			if (!savedPage?.thegraphics) return;
			Object.entries(areaCentroids).forEach(([areaId, [cx, cy]]) => {
				const names = areaCreatures[areaId] || [];
				names.forEach((name, idx) => {
					const monster = monsters.find(m => m.name.toLowerCase() === name.toLowerCase());
					const char = d20.Campaign.characters.find(c => c.get("name").toLowerCase() === name.toLowerCase());
					if (!char) return;
					const sizeKey = (Array.isArray(monster?.size) ? monster.size[0] : monster?.size) || "M";
					const squares = CREATURE_SIZE_SQUARES[sizeKey] || 1;
					const tokenPx = squares * ROLL20_PX;
					const avatar = char.get("avatar") || "";
					const imgUrl = avatar && d20plus.ut.fixS3Url ? d20plus.ut.fixS3Url(avatar, false) : avatar;
					const hp = monster?.hp?.average ?? "";
					const ac = Array.isArray(monster?.ac)
						? (monster.ac[0]?.ac ?? monster.ac[0])
						: (monster?.ac ?? "");
					savedPage.thegraphics.create({
						type: "image",
						layer: "gmlayer",
						page_id: roll20PageId,
						left: Math.round(cx + idx * tokenPx),
						top: Math.round(cy),
						width: tokenPx,
						height: tokenPx,
						represents: char.id,
						name: name,
						imgsrc: imgUrl,
						bar1_value: hp,
						bar1_max: hp,
						bar2_value: ac,
						id: makeId(),
					});
					placed++;
				});
			});
		});
		d20plus.ut.log(`Placed ${placed} token(s) on maps.`);
	}

	// Shared import pipeline for adventures and books
	async function loadContent (url, opts) {
		const getData = opts.getData || (json => json.adventureData ? json.adventureData[0].data : json.data);
		const getMeta = opts.getMeta || ((json, id) =>
			json.adventure?.[0] || adventureMetadata.adventure?.find(a => a.id?.toLowerCase() === id?.toLowerCase()));
		const contentId = opts.contentId || null;
		const contentSource = opts.contentSource || null;

		$("a.ui-tabs-anchor[href='#journal']").trigger("click");
		const data = opts.data || await DataUtil.loadJSON(url);
		const meta = getMeta(data, contentId) || {name: contentId || "Unknown", contents: []};
		const sections = getData(data);

		if (!sections?.length) {
			d20plus.ut.log(`No content found for ${meta.name}`);
			return;
		}

		// Detect what content types are present
		const {hasMaps, hasCreatures, hasItems} = scanContent(sections);
		d20plus.ut.log(`Content scan [${meta.name}]: maps=${hasMaps} creatures=${hasCreatures} items=${hasItems}`);

		// Fetch Foundry wall data upfront if maps exist
		let foundryMaps = null;
		if (hasMaps) {
			foundryMaps = await fetchFoundryMaps(contentId, contentSource || meta.source);
			d20plus.ut.log(foundryMaps ? "Foundry wall data loaded." : "No Foundry wall data; maps will be wall-free.");
		}

		// Build handout queue from sections
		function isPart (e) {
			return typeof e === "string" || (typeof e === "object" && e.type !== "entries");
		}
		const addQueue = [];
		const sectionsCopy = JSON.parse(JSON.stringify(sections));
		const adDir = meta.name || contentId || "Import";
		sectionsCopy.forEach((s, i) => {
			if (meta.contents && i >= meta.contents.length) return;
			const chapterName = meta.contents?.[i]?.name || s.name || `Section ${i + 1}`;
			const chapterDir = [adDir, chapterName];
			const introEntries = [];
			if (s.entries?.length && isPart(s.entries[0])) {
				while (s.entries.length && isPart(s.entries[0])) introEntries.push(s.entries.shift());
			}
			addQueue.push({dir: chapterDir, type: "entries", name: s.name, entries: introEntries});
			let textIndex = 1;
			const tempStack = [];
			let front;
			while ((front = s.entries?.shift())) {
				if (isPart(front)) {
					tempStack.push(front);
				} else {
					if (tempStack.length) {
						addQueue.push({dir: chapterDir, type: "entries", name: `Text ${textIndex++}`, entries: [...tempStack]});
						tempStack.length = 0;
					}
					front.dir = chapterDir;
					addQueue.push(front);
				}
			}
			if (tempStack.length) addQueue.push({dir: chapterDir, type: "entries", name: `Text ${textIndex++}`, entries: tempStack});
		});

		// Renderer pass builds handout HTML and captures tag→id linkage for cross-references
		const renderer = new Renderer();
		renderer.setBaseUrl(LINK_BASE_URL);
		Renderer.get().setBaseUrl(LINK_BASE_URL);
		const tags = {};
		renderer.doExportTags(tags);
		addQueue.forEach(entry => renderer.recursiveRender(entry, []));

		// Dynamic checkbox options based on detected content
		const checkboxOptions = ["Handouts"];
		if (hasMaps) checkboxOptions.push("Maps");
		if (hasMaps && hasCreatures) checkboxOptions.push("Place Tokens");
		if (hasCreatures) checkboxOptions.push("Creatures");
		if (hasItems) checkboxOptions.push("Items");

		$("#d20plus-import").dialog("open");
		$("#import-remaining").text("Initialising...");

		const toImport = await d20plus.ui.chooseCheckboxList(checkboxOptions, `What to import for ${meta.name}?`);

		// Import maps first (sequential, awaited); save page IDs for token placement
		let savedMaps = [];
		if (toImport.includes("Maps") && hasMaps) {
			const mapEntries = findMapEntries(sections);
			// "mapPlayer" entries carry their own title as the generic literal "Player Version"
			// (5etools schema), so they can't be keyed into `foundryMaps` directly - resolve
			// via `mapParent.id`, which points back at the sibling "map" entry's real title.
			const idToTitle = {};
			mapEntries.forEach(e => {
				if (e.imageType === "map" && e.id) idToTitle[e.id] = e.title || e.name;
			});
			const mapObjects = [];
			for (const e of mapEntries) {
				let paintedGridSize = null;
				try {
					const analysis = await analyzeMapImage(e);
					paintedGridSize = analysis.paintedGridSize;
					if (analysis.realWidth && !e.width) e.width = analysis.realWidth;
					if (analysis.realHeight && !e.height) e.height = analysis.realHeight;
				} catch (err) { paintedGridSize = null; }
				const wallLookupTitle = e.imageType === "mapPlayer" && e.mapParent?.id
					? idToTitle[e.mapParent.id]
					: null;
				mapObjects.push(buildMapObject(e, foundryMaps, paintedGridSize, wallLookupTitle));
			}
			if (mapObjects.length) savedMaps = await importMaps(mapObjects);
		}

		// Build area→creature name mapping for token placement
		const areaCreatures = (toImport.includes("Place Tokens") && savedMaps.length)
			? buildAreaCreatures(sections)
			: {};

		// Pre-fetch all creature and item data from CDN before opening selection dialogs,
		// so the subsequent dialog callbacks are synchronous (no async inside setInterval).
		// For homebrew, opts.homebrewData carries the monster/item arrays bundled in the SAME
		// uploaded/fetched file, since those won't exist on the official CDN by source code.
		d20plus.ut.log("Fetching referenced creature/item data...");
		const [monsters, items] = await Promise.all([
			(toImport.includes("Creatures") && hasCreatures)
				? fetchCreatureData(extractCreatureRefs(sections), opts.homebrewData?.monster)
					.catch(e => { d20plus.ut.log("Creature fetch error: " + e); return []; })
				: Promise.resolve([]),
			(toImport.includes("Items") && hasItems)
				? fetchItemData(extractItemRefs(sections), opts.homebrewData?.item)
					.catch(e => { d20plus.ut.log("Item fetch error: " + e); return []; })
				: Promise.resolve([]),
		]);
		if (monsters.length) d20plus.ut.log(`Found ${monsters.length} creature(s) to import.`);
		if (items.length) d20plus.ut.log(`Found ${items.length} item(s) to import.`);

		const RETURNED_IDS = {};
		const interval = d20plus.cfg.get("import", "importIntervalHandout") || d20plus.cfg.getDefault("import", "importIntervalHandout");
		const $stsName = $("#import-name");
		const $stsRemain = $("#import-remaining");

		// Sequential dialog chain: monsters → [place tokens] → items → handouts
		if (monsters.length) {
			d20plus.importer.showImportList(
				"monster",
				monsters,
				d20plus.monsters.handoutBuilder,
				{
					groupOptions: d20plus.monsters._groupOptions,
					saveIdsTo: RETURNED_IDS,
					callback: doAfterMonsters,
					listItemBuilder: d20plus.monsters._listItemBuilder,
					listIndex: d20plus.monsters._listCols,
					listIndexConverter: d20plus.monsters._listIndexConverter,
				},
			);
		} else {
			doAfterMonsters();
		}

		function doAfterMonsters () {
			if (toImport.includes("Place Tokens") && savedMaps.length) {
				placeTokensOnMaps(savedMaps, areaCreatures, monsters);
			}
			doItemImport();
		}

		function doItemImport () {
			if (items.length) {
				d20plus.importer.showImportList(
					"item",
					items,
					d20plus.items.handoutBuilder,
					{
						groupOptions: d20plus.items._groupOptions,
						saveIdsTo: RETURNED_IDS,
						callback: doMainImport,
						listItemBuilder: d20plus.items._listItemBuilder,
						listIndex: d20plus.items._listCols,
						listIndexConverter: d20plus.items._listIndexConverter,
					},
				);
			} else {
				doMainImport();
			}
		}

		function doMainImport () {
			if (!toImport.includes("Handouts")) {
				$("#d20plus-import").dialog("close");
				return;
			}
			renderer.setRoll20Ids(RETURNED_IDS);
			let cancelWorker = false;
			const $btnCancel = $("#importcancel");
			$btnCancel.off("click").on("click", () => { cancelWorker = true; });
			let remaining = addQueue.length;
			d20plus.ut.log(`Running import of [${meta.name}] with ${interval}ms delay (${remaining} handouts)`);
			let lastId = null, lastName = null;
			const worker = setInterval(() => {
				if (!addQueue.length || cancelWorker) {
					clearInterval(worker);
					$stsName.text("DONE!");
					$stsRemain.text("0");
					d20plus.ut.log(`Finished import of [${meta.name}]`);
					renderer.resetRoll20Ids();
					return;
				}
				const entry = addQueue.pop();
				entry.name = entry.name || "(Unknown)";
				entry.name = d20plus.importer.getCleanText(renderer.render(entry.name));
				$stsName.text(entry.name);
				$stsRemain.text(remaining--);
				const folder = d20plus.journal.makeDirTree(entry.dir);
				d20.Campaign.handouts.create({name: entry.name}, {
					success: function (handout) {
						const renderStack = [];
						renderer.recursiveRender(entry, renderStack);
						if (lastId && lastName) renderStack.push(`<br><p>Next handout: <a href="http://journal.roll20.net/handout/${lastId}">${lastName}</a></p>`);
						const rendered = renderStack.join("");
						lastId = handout.id;
						lastName = entry.name;
						handout.updateBlobs({notes: rendered});
						handout.save({notes: (new Date()).getTime(), inplayerjournals: ""});
						d20.journal.addItemToFolderStructure(handout.id, folder.id);
					},
				});
			}, interval);
		}
	}

	// Adventure import entry point
	d20plus.adventures.button = function () {
		const $url = $("#import-adventures-url");
		const url = $url.val();
		if (!url) return;
		const id = $url.data("id");
		const adMeta = adventureMetadata.adventure?.find(a => a.id?.toLowerCase() === id?.toLowerCase());
		loadContent(url, {
			contentId: id,
			contentSource: adMeta?.source,
			getData: json => json.adventureData ? json.adventureData[0].data : json.data,
			getMeta: (json, cid) => json.adventure?.[0]
				|| adventureMetadata.adventure?.find(a => a.id?.toLowerCase() === cid?.toLowerCase()),
		});
	};

	// Kept for backwards compatibility
	d20plus.adventures.load = function (url) {
		const $url = $("#import-adventures-url");
		$url.val(url);
		d20plus.adventures.button();
	};

	// Book import entry point
	d20plus.books.button = function () {
		const $url = $("#import-books-url");
		const url = $url.val();
		if (!url) return;
		const id = $url.data("id");
		const bkMeta = (typeof bookMetadata !== "undefined" && bookMetadata.book?.find(b => b.id?.toLowerCase() === id?.toLowerCase())) || null;
		loadContent(url, {
			contentId: id,
			contentSource: bkMeta?.source,
			getData: json => json.bookData ? json.bookData[0].data : json.data,
			getMeta: (json, cid) => json.book?.[0]
				|| (typeof bookMetadata !== "undefined" && bookMetadata.book?.find(b => b.id?.toLowerCase() === cid?.toLowerCase()))
				|| {name: cid || "Book", contents: []},
		});
	};

	// Homebrew import: takes an already-parsed 5etools-format JSON blob (from file upload or a
	// fetched homebrew URL) rather than a URL to fetch. Homebrew "collection" files can bundle
	// adventure AND book content in the same file (5etools-mirror repos confirm this happens),
	// so ask which to import when both are present.
	d20plus.homebrew.importParsed = async function (data, opts = {}) {
		const hasAdventure = !!(data.adventure?.length && data.adventureData?.length);
		const hasBook = !!(data.book?.length && data.bookData?.length);
		if (!hasAdventure && !hasBook) {
			alert("This file doesn't contain adventure or book content to import.");
			return;
		}

		let useType;
		if (hasAdventure && hasBook) {
			try {
				const sel = await d20plus.ui.chooseCheckboxList(["Adventure", "Book"], `${opts.displayName || "This homebrew file"} contains both an Adventure and a Book. Which do you want to import?`, {count: 1});
				useType = sel[0];
			} catch (e) {
				return; // user cancelled
			}
		} else {
			useType = hasAdventure ? "Adventure" : "Book";
		}

		const homebrewData = {monster: data.monster, item: data.item};

		if (useType === "Adventure") {
			await loadContent(null, {
				data,
				contentId: opts.contentId || data.adventure[0].id,
				contentSource: opts.contentSource || data.adventure[0].source,
				getData: json => json.adventureData[0].data,
				getMeta: json => json.adventure[0],
				homebrewData,
			});
		} else {
			await loadContent(null, {
				data,
				contentId: opts.contentId || data.book[0].id,
				contentSource: opts.contentSource || data.book[0].source,
				getData: json => json.bookData[0].data,
				getMeta: json => json.book[0],
				homebrewData,
			});
		}
	};
}

SCRIPT_EXTENSIONS.push(d20plusAdventure);
