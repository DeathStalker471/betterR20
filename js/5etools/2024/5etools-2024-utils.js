function d20plus2024Utils() {
	d20plus.import2024 = d20plus.import2024 || {};
	const ctx2024 = d20plus.import2024;

	ctx2024.IS_2024_SHEET = new Set(["dnd_2024", "DnD2024_Character_Sheet", "dnd2024", "dnd2024byroll20"]);

	ctx2024.makeId = function () {
		// Keep IDs short (8 chars) so shortID === full ID — the 2024 sheet indexes by shortID
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let id = "";
		for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
		return id;
	};

	ctx2024.makeIntegrantBase = function (type, arrayPosition) {
		const id = ctx2024.makeId();
		return {
			id,
			base: {
				_enabled: true,
				_label: "",
				type,
				childIDs: "[]",
				parentID: "",
				parentDisabled: false,
				overwriteDisabled: false,
				builderDisplayName: "",
				createdTime: Date.now(),
				arrayPosition: arrayPosition !== undefined ? arrayPosition : 0,
				shortID: id,
				source: "",
			},
		};
	};

	// Returns next safe arrayPosition — one above the current max in the store.
	// All new integrants in the same save MUST use distinct positions to avoid
	// Roll20 deduplicating them when multiple are written at once.
	ctx2024.getNextArrayPos = function (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		let max = 0;
		Object.values(ints).forEach(function (i) {
			if ((i.arrayPosition || 0) > max) max = i.arrayPosition;
		});
		return max + 1;
	};

	// Per-character mutex: import2024Item/Spell/Class/Race/Feat each do their own
	// getStore -> modify -> saveStore cycle, and saveStore destroys+recreates the whole
	// attribute rather than patching it in place. Two of these overlapping for the same
	// character (e.g. dragging several items in quick succession) means the second one reads
	// a stale snapshot and its save wipes out whatever the first one just added - including
	// unrelated data like ability scores, since it's all one JSON blob. Callers must acquire
	// this before reading the store and release it (via the returned function) after saving.
	ctx2024._storeLocks = new Map();
	ctx2024.pAcquireStoreLock = async function (charModel) {
		const charId = charModel.id;
		const prevRelease = ctx2024._storeLocks.get(charId) || Promise.resolve();
		let releaseThis;
		const thisRelease = new Promise(resolve => { releaseThis = resolve; });
		ctx2024._storeLocks.set(charId, thisRelease);
		await prevRelease;
		return releaseThis;
	};

	ctx2024.getStore = function (charModel) {
		const storeAttr = charModel.attribs.find(a => a.get("name") === "store");
		if (!storeAttr) return {attr: null, store: null};
		let store = storeAttr.get("current");
		if (typeof store === "string") store = JSON.parse(store);
		return {attr: storeAttr, store};
	};

	ctx2024.saveStore = function (charModel, storeAttr, store) {
		const storeClone = JSON.parse(JSON.stringify(store));
		try {
			if (storeAttr) storeAttr.destroy();
			charModel.attribs.push({name: "store", current: storeClone}).syncedSave();
			if (charModel.view && typeof charModel.view.showNewVueFrame === "function") {
				charModel.view.showNewVueFrame();
			}
		} catch (e) {
			console.error("betterR20 save2024Store error:", e);
		}
	};

	ctx2024.pushDisplayOrder = function (store, section, key, ids) {
		if (!store[section]) store[section] = {};
		const current = JSON.parse(store[section][key] || "[]");
		store[section][key] = JSON.stringify([...current, ...ids]);
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024Utils);
