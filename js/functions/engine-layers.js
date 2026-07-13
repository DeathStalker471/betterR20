/**
 * WHAT THIS DOES:
 * Adds extra named layers
 *   Foreground (now also in Roll20 natively, will need to be removed),
 *   Background, Floor, Roof, and Weather exclusion mask.
 * Replaces Roll20's canvas rendering methods (renderAll, sortTokens, drawAnyLayer,
 * drawTokensWithoutAuras) with custom versions that know about these extra layers.
 * Tokens on extra layers can be hidden/shown per-page via layersToggle, and their
 * visibility state is persisted as a page custom property (bR20cfg_hidden).
 *
 * This is probably a hell of a task to re implement.
 *
 * TODO: Check whether d20.engine.canvas still exposes _renderAll, sortTokens,
 * drawAnyLayer, drawTokensWithoutAuras as replaceable properties. If Roll20 moved
 * these to prototype methods or non-configurable properties the approach needs rethinking.
 * The extra layer data (bR20cfg_hidden page properties) might still be intact.
 *
 * Originally in: js/base/base-engine.js
 */

function initEngineLayers () {

// Checks page settings and syncs visibility icons for the extra layers.
d20plus.engine.layersIsMarkedAsHidden = (layer) => {
	const page = d20.Campaign.activePage();
	return page?.get(`bR20cfg_hidden`)?.search(layer) > -1;
}

// Iterates extra layers and hides/shows tokens on each based on stored page state.
d20plus.engine.layersVisibilityCheck = () => {
	const layers = ["floors", "background", "foreground", "roofs"];
	layers.forEach((layer) => {
		const isHidden = d20.engine.canvas._objects.some((o) => {
			if (o.model) return o.model.get("layer") === `hidden_${layer}`;
		}) || d20plus.engine.layersIsMarkedAsHidden(layer);
		d20plus.engine.layerVisibilityOff(layer, isHidden, true);
	});
}

// Toggles an extra layer's visibility and persists the state to the page.
d20plus.engine.layersToggle = (layer) => {
	const page = d20.Campaign.activePage();
	if (!page.get(`bR20cfg_hidden`)) page.set(`bR20cfg_hidden`, "");
	if (d20plus.engine.layersIsMarkedAsHidden(layer)) {
		d20plus.engine.layerVisibilityOff(layer, false);
	} else {
		d20plus.engine.layerVisibilityOff(layer, true);
	}
};

// Hides or shows all tokens on a given extra layer. Persists the state as a page prop.
// Calls objectsHideUnhide (still in base-engine.js) and layerVisibilityIcon (ui-layers.js).
d20plus.engine.layerVisibilityOff = (layer, off, force) => {
	const page = d20.Campaign.activePage();
	if (off) {
		if (d20plus.engine.objectsHideUnhide("layer", layer, "layeroff", false) || force) {
			if (window.currentEditingLayer === layer) d20plus.ui.switchToR20Layer();
			d20plus.ui.layerVisibilityIcon(layer, false);
			if (!d20plus.engine.layersIsMarkedAsHidden(layer)) {
				page.set(`bR20cfg_hidden`, `${page.get(`bR20cfg_hidden`)} ${layer}`);
				page.save();
			}
		}
	} else {
		d20plus.engine.objectsHideUnhide("layer", layer, "layeroff", true);
		d20plus.ui.layerVisibilityIcon(layer, true);
		if (d20plus.engine.layersIsMarkedAsHidden(layer)) {
			page.set(`bR20cfg_hidden`, page.get(`bR20cfg_hidden`).replace(` ${layer}`, ""));
			page.save();
		}
	}
}

// Entry point: replaces Roll20's canvas render methods and wires up page-change listeners.
d20plus.engine.addLayers = () => {
	d20plus.ut.log("Adding layers");

	d20.engine.canvas._renderAll = _.bind(d20plus.mod.renderAll, d20.engine.canvas);
	d20.engine.canvas.sortTokens = _.bind(d20plus.mod.sortTokens, d20.engine.canvas);
	d20.engine.canvas.drawAnyLayer = _.bind(d20plus.mod.drawAnyLayer, d20.engine.canvas);
	d20.engine.canvas.drawTokensWithoutAuras = _.bind(d20plus.mod.drawTokensWithoutAuras, d20.engine.canvas);

	if (window.is_gm) {
		$(document).on("d20:new_page_fully_loaded", d20plus.engine.checkPageSettings);
		d20plus.engine.checkPageSettings();
	}
};

// Waits for the active page to be ready, then syncs layer visibility icons.
d20plus.engine.checkPageSettings = () => {
	if (!d20plus.cfg.getOrDefault("canvas", "extraLayerButtons")) return;
	if (!d20.Campaign.activePage() || !d20.Campaign.activePage().get) {
		setTimeout(d20plus.engine.checkPageSettings, 50);
	} else {
		d20plus.engine.layersVisibilityCheck();
	}
}

} // end initEngineLayers

SCRIPT_EXTENSIONS.push(initEngineLayers);
