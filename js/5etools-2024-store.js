/**
 * Shared helpers for reading, writing, and manipulating 2024 (Jumpgate) character sheet stores.
 * Used by: 5etools-2024-import.js, 5etools-npc-converter.js, 5etools-npc-level-up.js
 */
function d20plus2024Store () {
	d20plus.store2024 = {};

	// ----------------------------------------
	// Integrant ID and base construction
	// ----------------------------------------

	/** Generate an 8-character alphanumeric ID. Short IDs must equal full IDs — the sheet indexes by shortID. */
	d20plus.store2024.makeId = function () {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let id = "";
		for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
		return id;
	};

	/**
	 * Build the shared base fields for any new integrant.
	 * @param {string} type  - Integrant type string (e.g. "Features", "Hit Points", "Class Level")
	 * @param {number} [arrayPosition] - Explicit position; omit and use getNextArrayPos when batching.
	 * @returns {{ id: string, base: object }}
	 */
	d20plus.store2024.makeIntegrantBase = function (type, arrayPosition) {
		const id = d20plus.store2024.makeId();
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

	/**
	 * Returns the next safe arrayPosition (one above the current max in the store).
	 * All integrants added in the same save must use distinct positions to avoid
	 * Roll20 deduplication when multiple are written at once.
	 */
	d20plus.store2024.getNextArrayPos = function (store) {
		const ints = (store.integrants && store.integrants.integrants) || {};
		let max = 0;
		Object.values(ints).forEach(function (i) {
			if ((i.arrayPosition || 0) > max) max = i.arrayPosition;
		});
		return max + 1;
	};

	// ----------------------------------------
	// Store read / write
	// ----------------------------------------

	/**
	 * Read the store attribute from a character model.
	 * @returns {{ attr: object|null, store: object|null }}
	 */
	d20plus.store2024.getStore = function (charModel) {
		const storeAttr = charModel.attribs.find(a => a.get("name") === "store");
		if (!storeAttr) return {attr: null, store: null};
		let store = storeAttr.get("current");
		if (typeof store === "string") store = JSON.parse(store);
		return {attr: storeAttr, store};
	};

	/**
	 * Write a store back to a character model, destroying the old store attr first.
	 * Triggers a Vue frame refresh when the character sheet is open.
	 */
	d20plus.store2024.saveStore = function (charModel, storeAttr, store) {
		const storeClone = JSON.parse(JSON.stringify(store));
		try {
			if (storeAttr) storeAttr.destroy();
			charModel.attribs.push({name: "store", current: storeClone}).syncedSave();
			if (charModel.view && typeof charModel.view.showNewVueFrame === "function") {
				charModel.view.showNewVueFrame();
			}
		} catch (e) {
			console.error("betterR20 saveStore error:", e);
		}
	};

	/**
	 * Write the store and appState="npc" attrs for a freshly-created 2024 NPC.
	 * Use this instead of saveStore when creating a new character (no existing storeAttr to destroy).
	 */
	d20plus.store2024.saveNewNpcState = function (character, store) {
		const toSave = [
			{name: "appState", current: "npc"},
			{name: "store", current: store},
		].map(a => character.attribs.push(a));
		toSave.forEach(s => s.syncedSave());
	};

	/**
	 * Write the display-name attrs for a freshly-created 2024 NPC.
	 */
	d20plus.store2024.saveNpcNames = function (character, displayName) {
		const toSave = [
			{name: "npc_name", current: displayName},
			{name: "name", current: displayName},
			{name: "character_name", current: displayName},
		].map(a => character.attribs.push(a));
		toSave.forEach(s => s.syncedSave());
	};

	// ----------------------------------------
	// Display-order helpers
	// ----------------------------------------

	/**
	 * Append IDs to a JSON-stringified display-order array in the store.
	 * e.g. push2024DisplayOrder(store, "features", "featsDisplayOrder", [id])
	 */
	d20plus.store2024.pushDisplayOrder = function (store, section, key, ids) {
		if (!store[section]) store[section] = {};
		const current = JSON.parse(store[section][key] || "[]");
		store[section][key] = JSON.stringify([...current, ...ids]);
	};

	// ----------------------------------------
	// Character copy flow helpers
	// ----------------------------------------

	/**
	 * Resolve a character's folder path from the journal structure.
	 * @returns {{ path: string[], folderId: string|null }|null}
	 */
	d20plus.store2024.getCharacterFolderContext = function (character) {
		try {
			const journal = d20plus.journal.getExportableJournal();
			const found = journal.find(it => it.id === character.id);
			if (!found) return null;
			const path = (found.path || []).slice(1);
			const folder = path.length ? d20plus.journal.makeDirTree(...path) : null;
			return {
				path,
				folderId: folder?.id || null,
			};
		} catch (e) {
			console.warn("betterR20 2024-store: Failed to resolve folder path", e);
			return null;
		}
	};

	/**
	 * Copy bio, gmnotes, and defaulttoken blobs from one character to another.
	 * @returns {Promise<void>}
	 */
	d20plus.store2024.copyBioAndNotes = function (sourceCharacter, targetCharacter) {
		const getBlobData = (character, key) =>
			new Promise(resolve => character._getLatestBlob(key, data => resolve(data)));

		return Promise.all([
			getBlobData(sourceCharacter, "bio"),
			getBlobData(sourceCharacter, "gmnotes"),
			getBlobData(sourceCharacter, "defaulttoken"),
		]).then(([bio, gmnotes, defaulttoken]) => {
			const blobs = {
				bio: bio || "",
				gmnotes: gmnotes || "",
			};
			const saveAttrs = {
				bio: Date.now(),
				gmnotes: Date.now(),
			};
			if (defaulttoken) {
				blobs.defaulttoken = defaulttoken;
				saveAttrs.defaulttoken = Date.now();
			}
			targetCharacter.updateBlobs(blobs);
			targetCharacter.save(saveAttrs);
		});
	};

	// ----------------------------------------
	// Debug helpers
	// ----------------------------------------

	d20plus.store2024.cloneForDebug = function (value) {
		try {
			return JSON.parse(JSON.stringify(value));
		} catch (e) {
			return {error: e?.message || String(e)};
		}
	};

	d20plus.store2024.logDebugJson = function (label, value) {
		console.log(`${label}\n${JSON.stringify(value, null, 2)}`);
	};

	// ----------------------------------------
	// 2024 NPC detection
	// ----------------------------------------

	const SHEET_2024_KEYS = new Set(["dnd_2024", "DnD2024_Character_Sheet", "dnd2024", "dnd2024byroll20"]);

	/** Returns true if this character model carries a 2024 NPC store. */
	d20plus.store2024.isNpc2024Sheet = function (character) {
		const attrMap = {};
		(character.attribs?.toJSON?.() || []).forEach(a => { attrMap[a.name] = a.current; });

		const sheetKey = attrMap.rpg_sheet || attrMap.sheet_type || attrMap.charactersheet_type;
		const is2024SheetKey = SHEET_2024_KEYS.has(sheetKey);
		const isLegacyNpcFlag = `${attrMap.npc || ""}` === "1";
		const isNpcAppState = `${attrMap.appState || ""}` === "npc";

		let parsedStore = null;
		if (attrMap.store) {
			try {
				parsedStore = typeof attrMap.store === "string" ? JSON.parse(attrMap.store) : attrMap.store;
			} catch (e) {
				parsedStore = null;
			}
		}

		const isNpcStoreShape = !!(
			parsedStore
			&& parsedStore.npc
			&& parsedStore.hitpoints
			&& parsedStore.integrants
		);

		const result = (is2024SheetKey && (isNpcAppState || isNpcStoreShape || isLegacyNpcFlag))
			|| isNpcStoreShape;

		console.groupCollapsed(
			`%cbetterR20 2024-Store%c isNpc2024Sheet("${character.get?.("name") || "?"}") → ${result}`,
			"color:#88c0d0;font-weight:bold", "color:inherit;font-weight:normal",
		);
		console.log("sheetKey:", sheetKey, "| is2024SheetKey:", is2024SheetKey);
		console.log("appState:", attrMap.appState, "| isNpcAppState:", isNpcAppState);
		console.log("npc flag:", attrMap.npc, "| isLegacyNpcFlag:", isLegacyNpcFlag);
		console.log("store keys:", parsedStore ? Object.keys(parsedStore) : "(none)");
		console.log("isNpcStoreShape:", isNpcStoreShape, "{ npc:", !!(parsedStore?.npc), "hitpoints:", !!(parsedStore?.hitpoints), "integrants:", !!(parsedStore?.integrants), "}");
		console.groupEnd();

		return result;
	};
}

SCRIPT_EXTENSIONS.push(d20plus2024Store);
