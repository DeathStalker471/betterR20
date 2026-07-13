function d20plus2024SheetConfig() {
	const sheetCtx = d20plus.import2024;

	// Add import sheet format config option — __values/__texts populated at setSheet time
	addConfigOptions("import", {
		"importSheetFormat": {
			"name": "Import Sheet Format",
			"default": "auto",
			"_type": "_enum",
			"__values": [],
			"__texts": [],
		},
	});

	// Reorder so importSheetFormat appears first among user-configurable options
	// (addConfigOptions uses Object.assign which appends; JS objects preserve insertion order)
	{
		const grp = CONFIG_OPTIONS["import"];
		const reordered = {};
		for (const k of Object.keys(grp)) { if (k.startsWith("_")) reordered[k] = grp[k]; }
		reordered["importSheetFormat"] = grp["importSheetFormat"];
		for (const k of Object.keys(grp)) { if (!k.startsWith("_") && k !== "importSheetFormat") reordered[k] = grp[k]; }
		CONFIG_OPTIONS["import"] = reordered;
	}

	function getSheetDisplayName(sheetKey, sheetObj) {
		if (sheetKey === "ogl5e" || sheetKey === "ogl") return "2014 (OGL)";
		if (sheetCtx.IS_2024_SHEET.has(sheetKey)) return "2024";
		if (sheetKey === "shaped_d20") return "Shaped";
		if (sheetKey === "DnD5e_Character_Sheet") return "Community";
		const name = sheetObj?.attributes?.name || sheetKey;
		return `Other (${name})`;
	}

	// Wrap setSheet to detect available sheets and populate the dropdown
	const originalSetSheet = d20plus.setSheet;
	d20plus.setSheet = function () {
		originalSetSheet.call(this);

		try {
			const sheetsObj = d20.journal.characterSheetsManager?.sheets || {};
			const sheetKeys = Object.keys(sheetsObj);

			// Also check for customSheets
			const customSheet = d20.journal.customSheets;
			if (customSheet && customSheet.attributes?.id && !sheetsObj[customSheet.attributes.id]) {
				sheetKeys.push(customSheet.attributes.id);
				sheetsObj[customSheet.attributes.id] = customSheet;
			}

			const values = [];
			const texts = [];

			for (const key of sheetKeys) {
				values.push(key);
				texts.push(getSheetDisplayName(key, sheetsObj[key]));
			}

			// Fallback: if nothing detected, use current d20plus.sheet
			if (values.length === 0) {
				values.push(d20plus.sheet);
				texts.push(getSheetDisplayName(d20plus.sheet, null));
			}

			CONFIG_OPTIONS["import"]["importSheetFormat"].__values = values;
			CONFIG_OPTIONS["import"]["importSheetFormat"].__texts = texts;

			// Smart default: single option → use it; multiple → prefer 2024 sheet, else first
			if (values.length === 1) {
				CONFIG_OPTIONS["import"]["importSheetFormat"].default = values[0];
			} else {
				const prefer2024 = values.find(v => sheetCtx.IS_2024_SHEET.has(v));
				CONFIG_OPTIONS["import"]["importSheetFormat"].default = prefer2024 || values[0];
			}

			d20plus.ut.log(`Import sheet format options detected: ${values.join(", ")}`);
		} catch (e) {
			console.warn("Import sheet format detection failed:", e);
		}
	};

	d20plus.importer.shouldUse2024 = function () {
		return sheetCtx.IS_2024_SHEET.has(d20plus.cfg.getOrDefault("import", "importSheetFormat"));
	};

	d20plus.importer.is2024Sheet = function (sheetName) {
		return sheetCtx.IS_2024_SHEET.has(sheetName);
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024SheetConfig);
