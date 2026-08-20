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

	// The Charactermancer bakes a " (SOURCE)" suffix into a page's own name whenever more than
	// one source offers something with that name (see the `inject()` dedup logic in
	// 5etools-2024-charactermancer.js) - real 5etools data has no such suffix, so anything
	// matching a Charactermancer-built integrant's name against real data (by class/subclass
	// name) needs this split back out first, on both the class and subclass import paths.
	// Returns lower-cased parts for direct use in case-insensitive comparisons.
	ctx2024.splitDisplayName = function (name) {
		const m = /^(.*?)\s*\(([^()]+)\)$/.exec(name || "");
		return m
			? {bareName: m[1].toLowerCase(), sourceHint: m[2].toLowerCase()}
			: {bareName: (name || "").toLowerCase(), sourceHint: null};
	};

	// ----------------------------------------
	// NPC converter / sidekick support
	// ----------------------------------------

	/** Generate an RFC-4122-style UUID (used as integrant map key + _id by the sheet). */
	ctx2024.makeUuid = function () {
		if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
			const r = Math.random() * 16 | 0;
			return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
		});
	};

	/**
	 * Write the store and appState="npc" attrs for a freshly-created 2024 NPC.
	 * Destroys any pre-existing store/appState attrs first so there is exactly one
	 * of each — prevents the sheet from finding a stale blank copy first.
	 *
	 * Also writes a dedicated "b20_sidekick" attribute that survives Roll20's sheet
	 * async init (which can blank "store"). Routing reads this attr first so that
	 * sidekick detection is robust even when the store gets overwritten.
	 */
	ctx2024.saveNewNpcState = function (character, store) {
		const toDestroy = character.attribs.filter(a =>
			a.get("name") === "store" || a.get("name") === "appState"
		);
		const sidekickType = store?.npc?._npcSidekickType;
		const sidekickLevel = store?.npc?._npcLevelUpLevel;
		const empoweredSchool = store?.npc?._npcEmpoweredSchool;
		toDestroy.forEach(a => a.destroy());

		const toSave = [
			{name: "appState", current: "npc"},
			{name: "store", current: store},
		].map(a => character.attribs.push(a));
		toSave.forEach(s => s.syncedSave());

		if (character.view && typeof character.view.showNewVueFrame === "function") {
			character.view.showNewVueFrame();
		}

		if (sidekickType || sidekickLevel) {
			ctx2024.saveSidekickMeta(character, sidekickType, sidekickLevel, empoweredSchool);
		}
	};

	/**
	 * Write (or overwrite) the dedicated b20_sidekick attribute.
	 * This attribute is never written by Roll20's sheet init so it is the reliable
	 * source of truth for detecting existing sidekicks.
	 */
	ctx2024.saveSidekickMeta = function (character, sidekickType, sidekickLevel, empoweredSchool) {
		const toDestroy = character.attribs.filter(a => a.get("name") === "b20_sidekick");
		toDestroy.forEach(a => a.destroy());
		const meta = {type: sidekickType || null, level: sidekickLevel || null, school: empoweredSchool || null};
		character.attribs.push({name: "b20_sidekick", current: JSON.stringify(meta)}).syncedSave();
	};

	/** Read the b20_sidekick attribute, returning {type, level, school} or null. */
	ctx2024.getSidekickMeta = function (character) {
		const attr = character.attribs.find(a => a.get("name") === "b20_sidekick");
		if (!attr) return null;
		try {
			const val = attr.get("current");
			return typeof val === "string" ? JSON.parse(val) : val;
		} catch (e) {
			return null;
		}
	};

	/** Write the display-name attrs for a freshly-created 2024 NPC. */
	ctx2024.saveNpcNames = function (character, displayName) {
		const toSave = [
			{name: "npc_name", current: displayName},
			{name: "name", current: displayName},
			{name: "character_name", current: displayName},
		].map(a => character.attribs.push(a));
		toSave.forEach(s => s.syncedSave());
	};

	/**
	 * Write flat character attributes for PB and CR that the Jumpgate sheet reads directly.
	 * These bypass the store and ensure the sheet UI reflects the values immediately.
	 */
	ctx2024.writeSidekickStats = function (character, pb, cr) {
		const setAttr = (name, value) => {
			const existing = character.attribs.find(a => a.get("name") === name);
			if (existing) {
				existing.set({current: String(value)});
				existing.save();
				return;
			}
			character.attribs.create({name, current: String(value)});
		};
		if (pb != null) setAttr("pb", pb);
		if (cr != null) {
			// CR can be a fraction like "1/2" or an integer like "3"
			setAttr("challenge_rating", cr);
			setAttr("npc_challenge", cr);
		}
	};

	/**
	 * Resolve a character's folder path from the journal structure.
	 * @returns {{ path: string[], folderId: string|null }|null}
	 */
	ctx2024.getCharacterFolderContext = function (character) {
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
			console.warn("betterR20 import2024: Failed to resolve folder path", e);
			return null;
		}
	};

	/** Copy bio, gmnotes, and defaulttoken blobs from one character to another. */
	ctx2024.copyBioAndNotes = function (sourceCharacter, targetCharacter) {
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

	ctx2024.cloneForDebug = function (value) {
		try {
			return JSON.parse(JSON.stringify(value));
		} catch (e) {
			return {error: e?.message || String(e)};
		}
	};

	ctx2024.logDebugJson = function (label, value) {
		d20plus.ut.log(`${label}\n${JSON.stringify(value, null, 2)}`);
	};

	/** Returns true if this character model carries a 2024 NPC store. */
	ctx2024.isNpc2024Sheet = function (character) {
		const attrMap = {};
		(character.attribs?.toJSON?.() || []).forEach(a => { attrMap[a.name] = a.current; });

		const sheetKey = attrMap.rpg_sheet || attrMap.sheet_type || attrMap.charactersheet_type;
		const is2024SheetKey = ctx2024.IS_2024_SHEET.has(sheetKey);
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

		return (is2024SheetKey && (isNpcAppState || isNpcStoreShape || isLegacyNpcFlag)) || isNpcStoreShape;
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024Utils);
