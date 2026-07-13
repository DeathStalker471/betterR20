function d20plus2024Router() {
	d20plus.importer.import2024Data = function (charView, data, event, importDataFallback) {
		const charModel = charView.model;
		const category = data.data && data.data.Category;

		if (category === "Spells") {
			d20plus.importer.import2024Spell(charModel, data);
		} else if (category === "Items") {
			d20plus.importer.import2024Item(charModel, data);
		} else if (category === "Classes") {
			d20plus.importer.import2024Class(charModel, data);
		} else if (category === "Races") {
			d20plus.importer.import2024Race(charModel, data);
		} else if (category === "Feats") {
			d20plus.importer.import2024Feat(charModel, data);
		} else {
			importDataFallback(charView, data, event);
		}
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024Router);
