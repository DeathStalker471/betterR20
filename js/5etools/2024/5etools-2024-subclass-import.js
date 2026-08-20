function d20plus2024SubclassImport() {
	const subclassCtx = d20plus.import2024;

	// Subclass data sometimes wraps the actual named feature a level deep
	// (e.g. {type:"entries", entries:[{name:"...", entries:[...]}]}) - unwrap until
	// we find something with a name, same as the classic-sheet subclass importer does.
	function unwrapFeature(feature) {
		const original = feature;
		try {
			while (feature && !feature.name) {
				if (feature.entries && feature.entries.name) feature = feature.entries;
				else if (feature.entries && feature.entries[0] && feature.entries[0].name) feature = feature.entries[0];
				else if (feature.entries) feature = feature.entries;
				else return null;
			}
			return feature || null;
		} catch (e) {
			return original.name ? original : null;
		}
	}

	// forcedLevel skips the prompt below - used when import2024ClassLevelUp chains straight
	// from leveling up the class to bringing its subclass up to the same new level, since
	// asking the player to re-enter a level they already just gave would be redundant.
	// _batchStore: when provided, mutates the caller's own in-progress store directly instead of
	// doing its own lock/read/save cycle - see the comment on import2024Class for why (avoids
	// two saves racing each other's async Roll20-side sync of the same "store" attribute).
	d20plus.importer.import2024Subclass = async function (charModel, data, forcedLevel, _batchStore) {
		const sc = data.Vetoolscontent;
		if (!sc || !sc.subclassFeatures) return;

		const displayName = sc.shortName || sc.name;
		let maxLevel;
		if (forcedLevel) {
			maxLevel = Math.min(20, Math.max(1, forcedLevel));
		} else {
			const levelInput = prompt(`Import ${displayName} (${sc.className}) at what level? (1-20)`, "1");
			if (levelInput === null) return;
			maxLevel = Math.min(20, Math.max(1, parseInt(levelInput, 10) || 1));
		}

		const releaseLock = _batchStore ? null : await subclassCtx.pAcquireStoreLock(charModel);
		try {
			let storeAttr, store;
			if (_batchStore) {
				storeAttr = null;
				store = _batchStore;
			} else {
				await d20plus.ut.fetchCharAttribs(charModel);
				({attr: storeAttr, store} = subclassCtx.getStore(charModel));
				if (!store) return;
			}

			const ints = store.integrants.integrants;
			// A Charactermancer-built class integrant may be named e.g. "Monk (XPHB)" while
			// sc.className (real subclass data) is always the bare "Monk" - strip the suffix
			// back off before comparing (see splitDisplayName), or this false-negatives and
			// tells the player to import a class that's already on the character.
			const classEntry = Object.entries(ints).find(([, i]) => i.type === "Class" && subclassCtx.splitDisplayName(i.name).bareName === (sc.className || "").toLowerCase());
			if (!classEntry) {
				alert(`Import the ${sc.className} class onto this character before adding ${displayName}.`);
				return;
			}
			const [classKey, classInt] = classEntry;

			let pos = subclassCtx.getNextArrayPos(store);
			const renderer = Renderer.get().setBaseUrl(LINK_BASE_URL);

			// Re-importing the same subclass (e.g. after leveling the class up, to pick up
			// newly-unlocked features) adds only what's missing to the existing Subclass block
			// instead of creating a duplicate one, same as import2024Class does for the class
			// itself. A different-named subclass already present is left alone rather than
			// silently merged into - flag it instead.
			// Ground-truthed against a real Charactermancer-built character (see import2024Class):
			// a native integrant's parentID/sourceID references its parent's dictionary key, not
			// its shortID - those only coincide for integrants we build ourselves. classKey/
			// subclassKey below are dictionary keys, used for every parentID/sourceID write;
			// classInt.shortID/subclassInt.shortID are never used for linking purposes here.
			let subclassKey, subclassInt;
			const existingSubclassEntry = Object.entries(ints).find(([, i]) => i.type === "Subclass" && i.parentID === classKey);
			if (existingSubclassEntry) [subclassKey, subclassInt] = existingSubclassEntry;
			if (subclassInt && subclassInt.name.toLowerCase() !== displayName.toLowerCase()) {
				alert(`${classInt.name} already has a different subclass ("${subclassInt.name}") on this character - remove it before adding ${displayName}.`);
				return;
			}

			let subclassChildren;
			if (subclassInt) {
				subclassChildren = JSON.parse(subclassInt.childIDs || "[]");
			} else {
				const {id: newSubclassId, base: subclassBase} = subclassCtx.makeIntegrantBase("Subclass", pos++);
				subclassBase.source = "Class";
				ints[newSubclassId] = {
					...subclassBase,
					name: displayName,
					recordName: displayName,
					parentID: classKey,
					sourceID: classKey,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};
				subclassInt = ints[newSubclassId];
				subclassKey = newSubclassId; // dict key === shortID for integrants we build ourselves

				const classChildren = JSON.parse(classInt.childIDs || "[]");
				classChildren.push(newSubclassId);
				classInt.childIDs = JSON.stringify(classChildren);

				subclassChildren = [];
			}

			// Feature names already attached, so a re-import doesn't duplicate features
			// already granted from an earlier, lower-level import.
			const existingNames = new Set(subclassChildren.map(id => ints[id] && ints[id].name).filter(Boolean));

			// Subclass features are flat children of the Subclass itself, not nested per
			// Class Level the way class features are - confirmed against a real Roll20-built
			// character. subclassFeatures isn't densely array-indexed by level like a class's
			// classFeatures is, so flatten it and only use each feature's own `.level` as a
			// cutoff filter against what the user requested.
			const allRawFeatures = [];
			(sc.subclassFeatures || []).forEach(lvlList => (lvlList || []).forEach(f => allRawFeatures.push(f)));

			const subclassFeatureIds = [];

			for (const rawFeature of allRawFeatures) {
				const feature = unwrapFeature(rawFeature);
				if (!feature || !feature.name) continue;
				if (/subclass feature/i.test(feature.name)) continue;
				if (existingNames.has(feature.name)) continue;

				const featureLevel = rawFeature.level || feature.level || 1;
				if (featureLevel > maxLevel) continue;

				const renderStack = [];
				if (feature.entries) renderer.recursiveRender({entries: feature.entries}, renderStack);
				const description = d20plus.importer.getCleanText(renderStack.join(""));

				const {id: featId, base: featBase} = subclassCtx.makeIntegrantBase("Features", pos++);
				featBase.source = "Subclass";
				ints[featId] = {
					...featBase,
					name: feature.name,
					recordName: feature.name,
					description,
					parentID: subclassKey,
					sourceID: subclassKey,
					childIDs: "[]",
					cascades: {},
					relations: {},
				};

				subclassFeatureIds.push(featId);
				subclassChildren.push(featId);
				existingNames.add(feature.name);
			}

			subclassInt.childIDs = JSON.stringify(subclassChildren);

			if (subclassFeatureIds.length) {
				subclassCtx.pushDisplayOrder(store, "features", "classFeatureDisplayOrder", subclassFeatureIds);
			}

			// Cache the raw subclass JSON, keyed by the class's own id, so import2024ClassLevelUp
			// can bring it up to the class's new level automatically after a level-up - same
			// reasoning and same separate-attribute approach as the class cache (the `store`
			// attribute is actively reprocessed by Roll20's own client and strips unrecognized
			// fields from it almost immediately).
			const cacheAttr = charModel.attribs.find(a => a.get("name") === "_betterR20SubclassData");
			let cacheData = {};
			if (cacheAttr) {
				try { cacheData = JSON.parse(cacheAttr.get("current") || "{}"); } catch (e) { cacheData = {}; }
			}
			cacheData[classInt.shortID] = sc;
			if (cacheAttr) {
				cacheAttr.set("current", JSON.stringify(cacheData));
				cacheAttr.save();
			} else {
				charModel.attribs.push({name: "_betterR20SubclassData", current: JSON.stringify(cacheData)}).syncedSave();
			}

			if (!_batchStore) subclassCtx.saveStore(charModel, storeAttr, store);
		} finally {
			if (!_batchStore) releaseLock();
		}
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024SubclassImport);
