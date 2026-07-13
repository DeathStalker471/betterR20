/**
 * All the modified minified based on parts of Roll20's `app.js`
 */
function d20plusMod () {
	d20plus.mod = {};

	d20plus.mod.preserveDrawingColor = (() => {
		const drawingTools = ["rect", "ellipse", "text", "path", "polygon"];
		const drawingProps = [{nm: "fill", el: "fillcolor"}, {nm: "color", el: "strokecolor"}];
		return (t) => {
			if (!drawingTools.includes(t)) return;
			drawingProps.forEach(prop => {
				if (!prop.stashed) {
					prop.stashed = true;
					prop.value = d20.engine.canvas.freeDrawingBrush[prop.nm];
				} else {
					prop.stashed = false;
					if (drawingProps[1].value === "rgb(0, 0, 0)" || !drawingProps[1].value) return;
					$(`#path_${prop.el}`).val(prop.value).trigger("change");
				}
			});
		}
	})();

	d20plus.mod.setMode = function (t) {
		d20plus.ut.log(`Setting mode ${t}`);
		try {
			d20plus.mod.preserveDrawingColor(t);
			d20.Campaign.activePage().setModeRef(t);
			d20plus.mod.preserveDrawingColor(t);
		} catch (e) {
			d20plus.ut.log(`Switching using legacy because ${e.message}`);
			d20plus.mod.setModeLegacy(t);
		}
	}

	// modified to allow players to use the FX tool, and to keep current colour selections when switching tool
	/* eslint-disable */
	// BEGIN ROLL20 CODE
	d20plus.mod.setModeLegacy = function (e) {
		// BEGIN MOD
		// "text" === e || "rect" === e || "ellipse" === e || "polygon" === e || "path" === e || "pan" === e || "select" === e || "targeting" === e || "measure" === e || window.is_gm || (e = "select"),
		// END MOD
		"text" === e ? $("#editor").addClass("texteditmode") : $("#editor").removeClass("texteditmode"),
			$("#floatingtoolbar li").removeClass("activebutton"),
			$("#" + e).addClass("activebutton"),
		"fog" === e.substring(0, 3) && $("#fogcontrols").addClass("activebutton");

		const drawingTools = ["rect", "ellipse", "text", "path", "polygon", "line_splitter"];
		if (drawingTools.includes(e)) {
			if ("ellipse" === e) $('#drawingtools span.subicon').addClass('fas fa-circle');
			else $('#drawingtools span.subicon').removeClass('fas fa-circle');
			$("#drawingtools").addClass("activebutton").removeClass("text rect ellipse path polygon line_splitter");
			"rect" === e && $("#drawingtools").addClass("rect");
			"ellipse" === e && $("#drawingtools").addClass("ellipse");
			"text" === e && $("#drawingtools").addClass("activebutton").removeClass("rect ellipse path polygon line_splitter").addClass("text");
			"path" === e && $("#drawingtools").addClass("path");
			"polygon" === e && $("#drawingtools").addClass("polygon");
			// BEGIN MOD (also line_splitter added to above removeClass calls
			"line_splitter" === e && $("#drawingtools").addClass("line_splitter");
			// END MOD
		}
		"polygon" !== e && d20.engine.finishCurrentPolygon();

		"pan" !== e && "select" !== e && d20.engine.unselect(),
			"pan" === e ? ($("#select").addClass("pan").removeClass("select").addClass("activebutton"),
				d20.token_editor.removeRadialMenu(),
				$("#editor-wrapper").addClass("panning")) : $("#editor-wrapper").removeClass("panning"),
		"select" === e && $("#select").addClass("select").removeClass("pan").addClass("activebutton"),
			$("#floatingtoolbar .mode").hide(),
		("text" === e || "select" === e) && $("#floatingtoolbar ." + e).show(),
			"gridalign" === e ? $("#gridaligninstructions").show() : "gridalign" === d20.engine.mode && $("#gridaligninstructions").hide(),
			"targeting" === e ? ($("#targetinginstructions").show(),
				$("#finalcanvas").addClass("targeting"),
				d20.engine.canvas.hoverCursor = "crosshair") : "targeting" === d20.engine.mode && ($("#targetinginstructions").hide(),
				$("#finalcanvas").removeClass("targeting"),
			d20.engine.nextTargetCallback && _.defer(function () {
				d20.engine.nextTargetCallback && d20.engine.nextTargetCallback(!1)
			}),
				d20.engine.canvas.hoverCursor = "move"),
			// BEGIN MOD
			d20.engine.mode = e,
		"measure" !== e && window.currentPlayer && d20.engine.measurements[window.currentPlayer.id] && !d20.engine.measurements[window.currentPlayer.id].sticky && (d20.engine.announceEndMeasure({
			player: window.currentPlayer.id
		}),
			d20.engine.endMeasure()),
			d20.engine.canvas.isDrawingMode = "path" === e ? !0 : !1;
		if ("text" === e || "path" === e || "rect" === e || "ellipse" === e || "polygon" === e || "fxtools" === e) {
			$("#secondary-toolbar").show();
			$("#secondary-toolbar .mode").hide();
			$("#secondary-toolbar ." + e).show();
			("path" === e || "rect" === e || "ellipse" === e || "polygon" === e) && ("" === $("#path_strokecolor").val() && ($("#path_strokecolor").val("#000000").trigger("change-silent"),
				$("#path_fillcolor").val("transparent").trigger("change-silent")),
				d20.engine.canvas.freeDrawingBrush.color = $("#path_strokecolor").val(),
				d20.engine.canvas.freeDrawingBrush.fill = $("#path_fillcolor").val() || "transparent",
				$("#path_width").trigger("change")),
			"fxtools" === e && "" === $("#fxtools_color").val() && $("#fxtools_color").val("#a61c00").trigger("change-silent"),
				$("#floatingtoolbar").trigger("blur")
		} else {
			$("#secondary-toolbar").hide();
			$("#floatingtoolbar").trigger("blur");
		}
		// END MOD
		'placelight' === e ? ($('#placelight').addClass('activebutton'), $('#babylonCanvas').addClass('torch-cursor')) : $('#babylonCanvas').removeClass('torch-cursor'),
		'placeWindow' === e ? ($('#placeWindow').addClass('activebutton'), $('#babylonCanvas').addClass('window-cursor')) : $('#babylonCanvas').removeClass('window-cursor'),
		'placeDoor' === e ? ($('#placeDoor').addClass('activebutton'), $('#babylonCanvas').addClass('door-cursor')) : $('#babylonCanvas').removeClass('door-cursor'),
		d20.engine.redrawScreenNextTick()
	};
	// END ROLL20 CODE

	// BEGIN ROLL20 CODE
	d20plus.mod.handleURL = function(e) {
		if (!($(this).hasClass("lightly") || $(this).parents(".note-editable").length > 0)) {
            let t = $(this).attr("href");
            if (void 0 === t)
				return !1;
			if (-1 !== t.indexOf("journal.roll20.net") || -1 !== t.indexOf("wiki.roll20.net")) {
                const n = t.split("/")[3]
                    , i = t.split("/")[4]
                    , o = d20.Campaign[n + "s"].get(i);
                if (o) {
                    const r = o.get("inplayerjournals").split(",");
                    (window.is_gm || -1 !== _.indexOf(r, "all") || window.currentPlayer && -1 !== _.indexOf(r, window.currentPlayer.id)) && o.view.showDialog()
				}
				return $("#existing" + n + "s").find("tr[data-" + n + "id=" + i + "]").trigger("click"),
					!1
			}
            const a = /(?:https?:\/\/(?:app\.)?roll20(?:staging)?\.(?:net|local:5000)\/|^\/?)compendium\/([^\/]+)\/([^\/#?]+)/i
                , s = t.match(a);
            if (s)
				return d20.utils.openCompendiumPage(s[1], s[2]),
					e.stopPropagation(),
					void e.preventDefault();
			if (-1 !== t.indexOf("javascript:"))
				return !1;
			if ("`" === t.substring(0, 1))
				return d20.textchat.doChatInput(t.substring(1)),
					!1;
			if ("!" === t.substring(0, 1))
				return d20.textchat.doChatInput(t),
					!1;
			if ("~" === t.substring(0, 1))
				return d20.textchat.doChatInput("%{" + t.substring(1, t.length) + "}"),
					!1;
			if (("external" === $(this).attr("rel") || -1 === t.indexOf("javascript:") && -1 !== t.indexOf("://"))) {
				// BEGIN MOD
				e.stopPropagation();
				e.preventDefault();
				window.open(t);
				// END MOD
			}
		}
	};
	// END ROLL20 CODE

	// BEGIN ROLL20 CODE
	d20plus.mod.renderAll = function(v) {
		const p = v && v.context || this.contextContainer
		  , e = this.getActiveGroup()
		  , u = this.sortTokens();
		e && !window.is_gm && (e.hideResizers = !0),
		this.clipTo ? fabric.util.clipContext(this, p) : p.save(),
		v.tokens = u.map,
		this.drawMapLayer(p, v),
		// BEGIN MOD
		v.tokens = u.floors,
		this.drawAnyLayer(p, v, "floors");
		// END MOD
		const n = v && v.grid_before_afow
		  , y = !d20.Campaign.activePage().get("adv_fow_enabled") || v && v.disable_afow
		  , d = !d20.Campaign.activePage().get("showgrid") || v && v.disable_grid;
		return n && !d && d20.canvas_overlay.drawGrid(p),
		!y && window.largefeats && d20.canvas_overlay.drawAFoW(d20.engine.advfowctx, d20.engine.work_canvases.floater.context),
		!n && !d && d20.canvas_overlay.drawGrid(p),
		// BEGIN MOD
		["background", "objects", "roofs", "foreground"].forEach(layer => {
			v.tokens = u[layer],
			this.drawAnyLayer(p, v, layer);
		}),
		window.is_gm && (v.tokens = u.gmlayer,
		this.drawAnyLayer(p, v, "gmlayer")),
		window.is_gm && window.currentEditingLayer === "walls" && (v.tokens = u.walls,
		this.drawDynamicLightingLayer(p, v)),
		window.currentEditingLayer === "weather" && (v.tokens = u.weather,
		this.drawAnyLayer(p, v, "weather")),
		// END MOD
		p.restore(),
		this
	}
	// END ROLL20 CODE

	// BEGIN ROLL20 CODE
	d20plus.mod.sortTokens = function() {
		const v = {
			map: [],
			// BEGIN MOD
			floors: [],
			background: [],
			objects: [],
			roofs: [],
			foreground: [],
			gmlayer: [],
			weather: [],
			// END MOD
			walls: []
		};
		for (const p of this._objects) {
			const e = v[p.model.get("layer")];
			e && e.push(p)
		}
		return v
	}
	// END ROLL20 CODE

	d20plus.mod.setAlpha = function (layer) {
		const l = ["map", "floors", "walls", "weather", "background", "objects", "roofs", "foreground", "gmlayer"];
		const o = ["background", "objects", "foreground"];
		return !window.is_gm 
			|| (o.includes(layer) && o.includes(window.currentEditingLayer))
			|| (l.indexOf(window.currentEditingLayer) >= l.indexOf(layer)
				&& !((layer === "roofs" || o.includes(layer)) && window.currentEditingLayer === "gmlayer"))
			? 1 : (layer === "gmlayer" ? d20.engine.gm_layer_opacity : .5);
	}

	// BEGIN ROLL20 CODE
	d20plus.mod.drawAnyLayer = function(v, p={}, layer) {
		const e = p.tokens || this._objects.filter(u=>{
			const n = u.model;
			// BEGIN MOD
			return n && n.get("layer") === layer
			// END MOD
		});
		v.save(),
		// BEGIN MOD
		v.globalAlpha = d20plus.mod.setAlpha(layer),
		// END MOD
		this.drawTokenList(v, e, p),
		v.restore()
	},
	// END ROLL20 CODE

	// BEGIN ROLL20 CODE
	d20plus.mod.drawTokensWithoutAuras = function (v, p) {
		const e = this.getActiveGroup();
		v.save(),
		p.forEach(u=>{
			e && u && e.contains(u) ? (u.renderingInGroup = e,
			u.hasControls = !1) : (u.renderingInGroup = null,
			u.hasControls = !0,
			u.hideResizers = !window.is_gm);
			// BEGIN MOD
			v.globalAlpha = d20plus.mod.setAlpha(u.model.get("layer")),
			// END MOD
			u.renderPre(v, {
				noAuras: !0,
				should_update: !0
			}),
			this._draw(v, u)
		}
		),
		v.restore()
	}
	// END ROLL20 CODE

	/* eslint-enable */
}

SCRIPT_EXTENSIONS.push(d20plusMod);
