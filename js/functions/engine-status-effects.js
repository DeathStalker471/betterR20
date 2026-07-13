/**
 * WHAT THIS DOES:
 * Replaces Roll20's token status marker rendering with a custom version that:
 *   - Scales marker icons and token name plates to match the grid snapping increment
 *   - Lets you assign a numeric counter to any status marker by pressing a number key
 *     while hovering over it in the marker menu (backtick clears the counter)
 *   - Supports custom 5etools status markers injected via CSS
 *
 * WHY IT'S BROKEN (probably):
 * overwriteStatusEffects patches it.model.view.updateBackdrops on every canvas object.
 * Roll20 likely renamed or restructured this method, so the patch no longer applies.
 * The bootstrap comment says "It doesn't work with current version of roll20."
 *
 * TODO: Log a canvas object after Roll20 loads and check whether updateBackdrops still
 * exists on token model views. If the method was renamed, update the patch target.
 * If Roll20 moved to a different rendering pipeline entirely, a broader rewrite is needed.
 *
 * Originally in: js/base/base-engine.js (_removeStatusEffectEntries, enhanceStatusEffects)
 *                js/base/base-mod.js (overwriteStatusEffects, mouseEnterMarkerMenu)
 */

// --- from js/base/base-engine.js ---

function initEngineStatusEffects () {

// Clears injected 5etools status CSS and removes all 5etools_ prefixed markers
// from Roll20's token editor marker registry (used when reloading status effects).
d20plus.engine._removeStatusEffectEntries = () => {
	$(`#5etools-status-css`).html("");
	Object.keys(d20.token_editor.statusmarkers).filter(k => k.startsWith("5etools_")).forEach(k => delete d20.token_editor.statusmarkers[k]);
};

// Entry point: injects the status CSS tag, patches all existing tokens via
// overwriteStatusEffects, and wires up object:added and markermenu hover listeners
// so new tokens and the marker UI stay in sync.
d20plus.engine.enhanceStatusEffects = () => {
	d20plus.ut.log("Enhance status effects");
	$(`head`).append(`<style id="5etools-status-css"/>`);

	d20plus.mod.overwriteStatusEffects();

	d20.engine.canvas.off("object:added");
	d20.engine.canvas.on("object:added", d20plus.mod.overwriteStatusEffects);

	$(document).off("mouseenter", ".markermenu");
	$(document).on("mouseenter", ".markermenu", d20plus.mod.mouseEnterMarkerMenu)
};

// --- from js/base/base-mod.js ---

// Iterates every canvas object and monkey-patches updateBackdrops on its model view.
// The patched version scales status icons and name plates to the grid snapping increment,
// renders custom 5etools marker images, and supports numeric counters on markers.
// This is a near-complete copy of Roll20's own rendering code with targeted modifications.
d20plus.mod.overwriteStatusEffects = function () {
	d20.engine.canvasDirty = true;
	d20.engine.canvasTopDirty = true;
	d20.engine.canvas._objects.forEach(it => {
		// avoid adding it to any objects that wouldn't have it to begin with
		if (!it.model || !it.model.view || !it.model.view.updateBackdrops) return;

		// BEGIN ROLL20 CODE
		it.model.view.updateBackdrops = function (e) {
			if (!this.nohud && ("objects" == this.model.get("layer") || "gmlayer" == this.model.get("layer")) && "image" == this.model.get("type") && this.model && this.model.collection && this.graphic) {
				// BEGIN MOD
				const scaleFact = (d20plus.cfg.get("canvas", "scaleNamesStatuses") && d20.Campaign.activePage().get("snapping_increment"))
					? d20.Campaign.activePage().get("snapping_increment")
					: 1;
				// END MOD
				var t = this.model.collection.page
					, n = e || d20.engine.canvas.getContext();
				n.save(),
				(this.graphic.get("flipX") || this.graphic.get("flipY")) && n.scale(this.graphic.get("flipX") ? -1 : 1, this.graphic.get("flipY") ? -1 : 1);
				var i = this
					, r = Math.floor(this.graphic.get("width") / 2)
					, o = Math.floor(this.graphic.get("height") / 2)
					, a = (parseFloat(t.get("scale_number")),
					this.model.get("statusmarkers").split(","));
				-1 !== a.indexOf("dead") && (n.strokeStyle = "rgba(189,13,13,0.60)",
					n.lineWidth = 10,
					n.beginPath(),
					n.moveTo(-r + 7, -o + 15),
					n.lineTo(r - 7, o - 5),
					n.moveTo(r - 7, -o + 15),
					n.lineTo(-r + 7, o - 5),
					n.closePath(),
					n.stroke()),
					n.rotate(-this.graphic.get("angle") * Math.PI / 180),
					n.strokeStyle = "rgba(0,0,0,0.65)",
					n.lineWidth = 1;
				var s = 0
					, l = i.model.get("bar1_value")
					, c = i.model.get("bar1_max");
				if ("" != c && (window.is_gm || this.model.get("showplayers_bar1") || this.model.currentPlayerControls() && this.model.get("playersedit_bar1"))) {
					var u = parseInt(l, 10) / parseInt(c, 10)
						, d = -o - 20 + 0;
					n.fillStyle = "rgba(" + d20.Campaign.tokendisplay.bar1_rgb + ",0.75)",
						n.beginPath(),
						n.rect(-r + 3, d, Math.floor((2 * r - 6) * u), 8),
						n.closePath(),
						n.fill(),
						n.beginPath(),
						n.rect(-r + 3, d, 2 * r - 6, 8),
						n.closePath(),
						n.stroke(),
						s++
				}
				var l = i.model.get("bar2_value")
					, c = i.model.get("bar2_max");
				if ("" != c && (window.is_gm || this.model.get("showplayers_bar2") || this.model.currentPlayerControls() && this.model.get("playersedit_bar2"))) {
					var u = parseInt(l, 10) / parseInt(c, 10)
						, d = -o - 20 + 12;
					n.fillStyle = "rgba(" + d20.Campaign.tokendisplay.bar2_rgb + ",0.75)",
						n.beginPath(),
						n.rect(-r + 3, d, Math.floor((2 * r - 6) * u), 8),
						n.closePath(),
						n.fill(),
						n.beginPath(),
						n.rect(-r + 3, d, 2 * r - 6, 8),
						n.closePath(),
						n.stroke(),
						s++
				}
				var l = i.model.get("bar3_value")
					, c = i.model.get("bar3_max");
				if ("" != c && (window.is_gm || this.model.get("showplayers_bar3") || this.model.currentPlayerControls() && this.model.get("playersedit_bar3"))) {
					var u = parseInt(l, 10) / parseInt(c, 10)
						, d = -o - 20 + 24;
					n.fillStyle = "rgba(" + d20.Campaign.tokendisplay.bar3_rgb + ",0.75)",
						n.beginPath(),
						n.rect(-r + 3, d, Math.floor((2 * r - 6) * u), 8),
						n.closePath(),
						n.fill(),
						n.beginPath(),
						n.rect(-r + 3, d, 2 * r - 6, 8),
						n.closePath(),
						n.stroke()
				}
				var h, p, g = 1, f = !1;
				switch (d20.Campaign.get("markers_position")) {
					case "bottom":
						h = o - 10,
							p = r;
						break;
					case "left":
						h = -o - 10,
							p = -r,
							f = !0;
						break;
					case "right":
						h = -o - 10,
							p = r - 18,
							f = !0;
						break;
					default:
						h = -o + 10,
							p = r
				}
				// BEGIN MOD
				n.strokeStyle = "white";
				n.lineWidth = 3 * scaleFact;
				const scaledFont = 14 * scaleFact;
				n.font = "bold " + scaledFont + "px Arial";
				// END MOD
				_.each(a, function (e) {
					var t = d20.token_editor.statusmarkers[e.split("@")[0]];
					if (!t)
						return !0;
					if ("dead" === e)
						return !0;
					var i = 0;
					if (g--,
					"#" === t.substring(0, 1))
						n.fillStyle = t,
							n.beginPath(),
							f ? h += 16 : p -= 16,
							n.arc(p + 8, f ? h + 4 : h, 6, 0, 2 * Math.PI, !0),
							n.closePath(),
							n.stroke(),
							n.fill(),
							i = f ? 10 : 4;
					else {
						// BEGIN MOD
						if (!d20.token_editor.statussheet_ready) return;
						const scaledWH = 21 * scaleFact;
						const scaledOffset = 22 * scaleFact;
						f ? h += scaledOffset : p -= scaledOffset;

						if (d20.engine.canvasZoom <= 1) {
							n.drawImage(d20.token_editor.statussheet_small, parseInt(t, 10), 0, 21, 21, p, h - 9, scaledWH, scaledWH);
						} else {
							n.drawImage(d20.token_editor.statussheet, parseInt(t, 10), 0, 24, 24, p, h - 9, scaledWH, scaledWH)
						}

						i = f ? 14 : 12;
						i *= scaleFact;
						// END MOD
					}
					if (-1 !== e.indexOf("@")) {
						var r = e.split("@")[1];
						// BEGIN MOD
						// bing backtick to "clear counter"
						if (r === "`") return;
						n.fillStyle = "rgb(222,31,31)";
						var o = f ? 9 : 14;
						o *= scaleFact;
						o -= (14 - (scaleFact * 14));
						n.strokeText(r + "", p + i, h + o);
						n.fillText(r + "", p + i, h + o);
						// END MOD
					}
				});
				var m = i.model.get("name");
				if ("" != m && 1 == this.model.get("showname") && (window.is_gm || this.model.get("showplayers_name") || this.model.currentPlayerControls() && this.model.get("playersedit_name"))) {
					n.textAlign = "center";
					// BEGIN MOD
					const fontSize = 14;
					var scaledFontSize = fontSize * scaleFact;
					const scaledY = 22 * scaleFact;
					const scaled6 = 6 * scaleFact;
					const scaled8 = 8 * scaleFact;
					n.font = "bold " + scaledFontSize + "px Arial";
					var v = n.measureText(m).width;

					/*
						Note(stormy): compatibility with R20ES's ScaleTokenNamesBySize module.
					 */
					if(window.r20es && window.r20es.drawNameplate) {
						window.r20es.drawNameplate(this.model, n, v, o, fontSize, m);
					} else {
						n.fillStyle = "rgba(255,255,255,0.50)";
						n.fillRect(-1 * Math.floor((v + scaled6) / 2), o + scaled8, v + scaled6, scaledFontSize + scaled6);
						n.fillStyle = "rgb(0,0,0)";
						n.fillText(m + "", 0, o + scaledY, v);
					}
					// END MOD
				}
				n.restore()
			}
		}
		// END ROLL20 CODE
	});
};

// Attached to the markermenu mouseenter event. While a status icon is hovered,
// any number key press sets that counter on the selected token's marker. Backtick clears it.
d20plus.mod.mouseEnterMarkerMenu = function () {
	var e = this;
	$(this).on("mouseover.statusiconhover", ".statusicon", function () {
		a = $(this).attr("data-action-type").replace("toggle_status_", "")
	}),
		$(document).on("keypress.statusnum", function (t) {
			// BEGIN MOD // TODO see if this clashes with keyboard shortcuts
			let currentcontexttarget = d20.engine.selected()[0];
			if ("dead" !== a && currentcontexttarget) {
				// END MOD
				var n = String.fromCharCode(t.which)
					,
					i = "" == currentcontexttarget.model.get("statusmarkers") ? [] : currentcontexttarget.model.get("statusmarkers").split(",")
					, r = (_.map(i, function (e) {
						return e.split("@")[0]
					}),
						!1);
				i = _.map(i, function (e) {
					return e.split("@")[0] == a ? (r = !0,
					a + "@" + n) : e
				}),
				r || ($(e).find(".statusicon[data-action-type=toggle_status_" + a + "]").addClass("active"),
					i.push(a + "@" + n)),
					currentcontexttarget.model.save({
						statusmarkers: i.join(",")
					})
			}
		})
};

} // end initEngineStatusEffects

SCRIPT_EXTENSIONS.push(initEngineStatusEffects);
