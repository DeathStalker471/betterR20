/**
 * WHAT THIS DOES:
 * Adds custom layer-switcher buttons to the Roll20 toolbar for the extra layers
 * (Floor, Roof, Weather mask). A secondary panel expands
 * from an "extras" button, showing one button per enabled extra layer. Each button
 * switches the editing layer and has a toggle (eye icon) to hide/show that layer's
 * tokens. The active layer icon is mirrored on the main toolbar button.
 *
 * Some duplicated stuff with engine layers that can be merged together.
 *
 * TODO: Verify the toolbar button selectors still exist in the Jumpgate DOM.
 * The logic itself is self-contained jQuery UI code — if the selectors are right
 * it should work. Check also that d20plus.html.layerSecondaryPanel and
 * d20plus.html.layerExtrasButton templates still render correctly.
 *
 * Originally in: js/base/base-ui.js
 */

function initUiLayers () {

// Local helpers — only usable from addQuickUiGm's event handlers.

// Switches the active editing layer to a betterR20 extra layer and updates toolbar state.
const switchToB20Layer = (evt) => {
	const $selected = $(evt.currentTarget);
	const $icon = $selected.find(".icon-slot");
	const icon = $icon.find("span").text();
	const $roll20LayersButton = $("#layers-menu-button").find(".grimoire__roll20-icon");

	currentEditingLayer = $selected.data("layer");
	d20.Campaign.activePage().onLayerChange();
	d20plus.ui.b20LayersActive = true;

	d20plus.ui.secondaryPanel.buttons.removeClass("b20-selected");
	d20plus.ui.secondaryPanel.iconSlots.removeClass("icon-selected");

	$selected.addClass("b20-selected");
	$icon.addClass("icon-selected icon-circle");
	d20plus.ui.$r20Buttons.removeClass("icon-selected").attr("style", "");
	d20plus.ui.extraButton.icon.text(icon);
	$roll20LayersButton.css({"font-family": "Pictos", "font-size": "1.5em"});
	$roll20LayersButton.text(icon);
};

// Toggles the secondary panel open/closed from either the extras button or the main layers button.
const switchLayersToolbar = (evt) => {
	if (evt.delegateTarget.id === "extra-layer-button") {
		d20plus.ui.$secondaryPanel
			.css({left: "60px"})
			.toggle();
		if (d20plus.ui.$secondaryPanel.css("display") === "none"
			&& d20plus.ui.b20LayersActive) {
			d20plus.ui.extraButton.button.addClass("b20-selected");
			d20plus.ui.extraButton.iconSlot.addClass("icon-selected");
		} else {
			d20plus.ui.extraButton.button.removeClass("b20-selected");
		}
	} else {
		const roll20ToolbarVisible = $("#tokens-layer-button").parent().is(":visible");
		d20plus.ui.$secondaryPanel
			.css({left: "110px"})
			.toggle(roll20ToolbarVisible);
	}
};

// Resets toolbar state when switching back to a native Roll20 layer.
d20plus.ui.switchToR20Layer = (evt) => {
	d20plus.ui.secondaryPanel.buttons.removeClass("b20-selected");
	d20plus.ui.secondaryPanel.iconSlots.removeClass("icon-selected").addClass("icon-circle");
	d20plus.ui.extraButton.button.removeClass("b20-selected");
	d20plus.ui.extraButton.icon.text("|");
	d20plus.ui.b20LayersActive = false;

	// the following check with setTimeout is required to properly process native r20 buttons.
	// Without it the previously active layer won't be activated again
	const $triggeredBy = $(evt?.target || "#tokens-layer-button .icon-slot");
	const $pressed = $triggeredBy.closest(".toolbar-button-outer");
	const $pressedIcon = $triggeredBy.closest(".icon-slot");
	const $pressedButton = $triggeredBy.closest(".toolbar-button-inner");
	const isFirstButton = $pressed.attr("id") === d20plus.ui.r20Buttons[0].id;
	const $roll20LayersButton = $("#layers-menu-button").find(".grimoire__roll20-icon");
	const secondaryPanelHidden = d20plus.ui.$secondaryPanel.css("display") === "none";

	if (secondaryPanelHidden) d20plus.ui.extraButton.iconSlot.addClass("icon-circle").removeClass("icon-selected");
	$roll20LayersButton.css({"font-family": "Roll20Icons", "font-size": "1.3em"});

	setTimeout(() => {
		if ($pressedIcon.attr("style")) return;
		const layer = d20plus.ui.r20Buttons.find(b => b.DOMid === $pressed.attr("id"));
		if (!layer?.color) return;
		$pressedIcon
			.addClass("icon-selected")
			.attr("style", `background-color: var(${layer.color});`);
		currentEditingLayer = layer.id;
		d20.Campaign.activePage().onLayerChange();
	}, 100);
};

// Entry point: builds the extra layer button and secondary panel, appends them to the toolbar.
d20plus.ui.addQuickUiGm = () => {
	if (!d20plus.cfg.getOrDefault("canvas", "extraLayerButtons")) return;
	const buttonsHmtl = d20plus.ui.b20Buttons.reduce((html, l) => {
		l.enabled = d20plus.cfg.getOrDefault("canvas", l.cfg);
		return `${html}${(l.enabled ? d20plus.html.layerSecondaryPanel(l) : "")}`;
	}, "");
	if (!d20plus.ui.b20Buttons.some(b => b.enabled)) return;

	d20plus.ui.$extraButton = $(d20plus.html.layerExtrasButton);
	d20plus.ui.$secondaryPanel = $(`
		<div class="drawer-outer b20" style="left: 111px;display:none">
		${buttonsHmtl}</div>
	`);

	d20plus.ui.extraButton = {
		icon: d20plus.ui.$extraButton.find(".icon-slot span"),
		iconSlot: d20plus.ui.$extraButton.find(".icon-slot"),
		button: d20plus.ui.$extraButton.find(".toolbar-button-inner"),
	};

	d20plus.ui.secondaryPanel = {
		iconSlots: d20plus.ui.$secondaryPanel.find(".icon-slot"),
		buttons: d20plus.ui.$secondaryPanel.find(".toolbar-button-inner"),
	};

	d20plus.ui.$r20Buttons = $("#tokens-layer-button")
		.parent()
		.find(".toolbar-button-outer:not(.b20) .icon-slot");

	$("body").append(d20plus.ui.$secondaryPanel);
	$("#map-layer-button").after(d20plus.ui.$extraButton);

	d20plus.ui.$extraButton.on("mouseenter", ".toolbar-button-inner", (evt) => {
		$(evt.currentTarget).find(".icon-slot").addClass("icon-selected").removeClass("icon-circle");
	}).on("mouseleave", ".toolbar-button-inner", (evt) => {
		if (d20plus.ui.b20LayersActive || d20plus.ui.$secondaryPanel.css("display") !== "none") return;
		$(evt.currentTarget).find(".icon-slot").removeClass("icon-selected").addClass("icon-circle");
	}).on(clicktype, ".toolbar-button-inner", switchLayersToolbar);

	d20plus.ui.$secondaryPanel.on("mouseenter", ".toolbar-button-inner", (evt) => {
		$(evt.currentTarget).find(".icon-slot").addClass("icon-selected").removeClass("icon-circle");
	}).on("mouseleave", ".toolbar-button-inner", (evt) => {
		if ($(evt.currentTarget).hasClass("b20-selected")) return;
		$(evt.currentTarget).find(".icon-slot").removeClass("icon-selected").addClass("icon-circle");
	}).on(clicktype, ".layer-toggle", (evt) => {
		evt.stopPropagation();
		const $layerIcon = $(evt.currentTarget).prev(".toolbar-button-inner");
		const state = d20plus.engine.layersToggle($layerIcon.data("layer"));
	}).on(clicktype, ".toolbar-button-inner", switchToB20Layer);

	$(document.body)
		.on("mouseup", d20plus.ui.r20Buttons.reduce((css, b) => {
			return `${css}${css ? ", " : ""}#${b.DOMid}  .icon-slot`;
		}, ""), d20plus.ui.switchToR20Layer)
		.on(clicktype, "#layers-menu-button .toolbar-button-inner", switchLayersToolbar);

	$("#playerzone").css({"z-index": 10100}); // otherwise it has the same z-index as native buttons
};

// Updates the visibility icon on the extra layer button for a given layer.
// Called from engine-layers.js (layerVisibilityOff / layersVisibilityCheck).
d20plus.ui.layerVisibilityIcon = (layer, state) => {
	const $layerIcon = d20plus.ui.$secondaryPanel?.find(`[data-layer=${layer}]`);
	$layerIcon?.toggleClass("layer-off", !state);
}

} // end initUiLayers

SCRIPT_EXTENSIONS.push(initUiLayers);
