function d20plusEngine () {
	d20plus.engine = {};

	d20plus.engine.addProFeatures = () => {
		d20plus.ut.log("Add Pro features");

		d20plus.setMode = d20plus.mod.setMode;
		window.setMode = d20plus.mod.setMode;

		// rebind buttons with new setMode
		const $drawTools = $("#drawingtools");
		const $rect = $drawTools.find(".chooserect");
		const $ellipse = $drawTools.find(".choosecircle");
		const $path = $drawTools.find(".choosepath");
		const $poly = $drawTools.find(".choosepolygon");
		$drawTools.unbind(clicktype).bind(clicktype, function () {
			$(this).hasClass("rect") ? setMode("rect") : $(this).hasClass("ellipse") ? setMode("ellipse") : $(this).hasClass("text") ? setMode("text") : $(this).hasClass("path") ? setMode("path") : $(this).hasClass("drawselect") ? setMode("drawselect") : $(this).hasClass("polygon") && setMode("polygon")
		});
		$rect.unbind(clicktype).bind(clicktype, () => {
			setMode("rect");
			return false;
		});
		$ellipse.unbind(clicktype).bind(clicktype, () => {
			setMode("ellipse");
			return false;
		});
		$path.unbind(clicktype).bind(clicktype, () => {
			setMode("path");
			return false;
		});
		$poly.unbind(clicktype).bind(clicktype, () => {
			setMode("polygon");
			return false;
		});
		$("#rect").unbind(clicktype).bind(clicktype, () => setMode("rect"));
		$("#ellipse").unbind(clicktype).bind(clicktype, () => setMode("ellipse"));
		$("#path").unbind(clicktype).bind(clicktype, () => setMode("path"));
		$("#select").unbind(clicktype).bind(clicktype, () => setMode("select"));
		$("#select .chooseselect").unbind(clicktype).bind(clicktype, () => setMode("select"));

		if (!$(`#fxtools`).length) {
			const $fxMode = $(`<li id="fxtools"/>`).append(`<span class="pictos">e</span>`);
			$fxMode.on("click", () => {
				d20plus.setMode("fxtools");
			});
			$(`#drawingtools`).after($fxMode);
		}

		if (window.is_gm) {
			$("#page-toolbar").on("mousedown", ".js__settings-page", function () {
				let e = d20.Campaign.pages.get($(this).parents(".availablepage").attr("data-pageid"));
				e.view._template = $.jqotec("#tmpl_pagesettings");
			});
		}
	};

	d20plus.engine._removeStatusEffectEntries = () => {
		$(`#5etools-status-css`).html("");
		Object.keys(d20.token_editor.statusmarkers).filter(k => k.startsWith("5etools_")).forEach(k => delete d20.token_editor.statusmarkers[k]);
	};

	d20plus.engine.enhanceStatusEffects = () => {
		d20plus.ut.log("Enhance status effects");
		$(`head`).append(`<style id="5etools-status-css"/>`);

		d20plus.mod.overwriteStatusEffects();

		d20.engine.canvas.off("object:added");
		d20.engine.canvas.on("object:added", d20plus.mod.overwriteStatusEffects);

		// the holy trinity
		// d20.engine.canvas.on("object:removed", () => console.log("added"));
		// d20.engine.canvas.on("object:removed", () => console.log("removed"));
		// d20.engine.canvas.on("object:modified", () => console.log("modified"));

		$(document).off("mouseenter", ".markermenu");
		$(document).on("mouseenter", ".markermenu", d20plus.mod.mouseEnterMarkerMenu)
	};

	d20plus.engine.swapTemplates = () => {
		const $betaSwitch = $("#new-toolbar-toggle");
		d20plus.betaFeaturesEnabled = $betaSwitch.prop("checked");

		document.dispatchEvent(new Event(`b20initTemplates`));
		d20plus.ut.log("Swapping templates...");
		$("#tmpl_charactereditor").html($(d20plus.html.characterEditor).html());
		$("#tmpl_handouteditor").html($(d20plus.html.handoutEditor).html());
		$("#tmpl_deckeditor").html($(d20plus.html.deckEditor).html());
		$("#tmpl_cardeditor").html($(d20plus.html.cardEditor).html());
		$("#tmpl_cardupload").html($(d20plus.html.cardUploader).html());
		$("#tmpl_macroeditor").html($(d20plus.html.macroEditor).html());
		// ensure tokens have editable sight
		$("#tmpl_tokeneditor").replaceWith(d20plus.html.tokenEditor);
		// show dynamic lighting/etc page settings
		$("#tmpl_pagesettings").replaceWith(d20plus.engine._makePageSettings());
		// swap templates stashed in page.view.template for each page
		d20.Campaign.pages.models.forEach(page => page.view.template = $.jqotec("#tmpl_pagesettings"));
	};

	d20plus.engine._makePageSettings = () => {
		return `<script id='tmpl_pagesettings' type='text/html'>
			<ul class='nav nav-tabs pagedetails_navigation'>
				${d20plus.html.pageSettingsNavTabs}
			</ul>
			<div class='tab-content'>
				${d20plus.html.pageSettings}
				${d20plus.html.pageSettingsWeather}
				${d20plus.html.pageSettingsViews}
			</div>
		</script>`;
	};

	d20plus.engine.enhancePageSelector = () => {
		d20plus.ut.log("Enhancing page selector");

		let updatePageOrder = function () {
			d20plus.ut.log("Saving page order...");
			let pos = 0;
			$("#page-toolbar .pages .chooseablepage").each(function () {
				let page = d20.Campaign.pages.get($(this).attr("data-pageid"));
				page && page.save({
					placement: pos,
				});
				pos++;
			});
			d20.pagetoolbar.noReload = false;
			d20.pagetoolbar.refreshPageListing();
		};

		function overwriteDraggables () {
			// make them draggable on both axes
			$("#page-toolbar .pages").sortable("destroy");
			$("#page-toolbar .pages").sortable({
				items: "> .chooseablepage",
				start: function () {
					d20.pagetoolbar.noReload = true;
				},
				stop: function () {
					updatePageOrder()
				},
				distance: 15,
			}).addTouch();
			$("#page-toolbar .playerbookmark").draggable("destroy");
			$("#page-toolbar .playerbookmark").draggable({
				revert: "invalid",
				appendTo: "#page-toolbar",
				helper: "original",
			}).addTouch();
			$("#page-toolbar .playerspecificbookmark").draggable("destroy");
			$("#page-toolbar .playerspecificbookmark").draggable({
				revert: "invalid",
				appendTo: "#page-toolbar",
				helper: "original",
			}).addTouch();
		}

		$(`body`).on("mouseup", "li.dl", (evt) => {
			// process Dynamic Lighting tabs
			const $dynLightTab = $(evt.target).closest("li.dl");
			const $isTabAnchor = $(evt.target).closest("a");
			if (!$dynLightTab.hasClass("active")) {
				setTimeout(() => {
					if (!$dynLightTab.hasClass("legacy")) $(`[data-tab=lighting]:visible`).click();
					else $(`[data-tab=legacy-lighting]:visible`).click();
				}, 10);
			}
			if ($isTabAnchor.data("tab") === "lighting") $dynLightTab.removeClass("legacy");
			if ($isTabAnchor.data("tab") === "legacy-lighting") $dynLightTab.addClass("legacy");
		}).on("click", ".weather input[type=range]", (evt) => {
			const {currentTarget: target} = evt;
			if (target.name) $(`.${target.name}`).val(target.value);
		}).on("mouseup", ".chooseablepage .js__settings-page, .page-container .settings-menu-trigger-container", () => {
			setTimeout(() => d20plus.engine.enhancePageSettings(), 50);
		}).on("click", ".pagedetails_navigation .nav-tabs--beta", () => {
			d20plus.engine._populatePageCustomOptions();
		}).on("click keyup", ".weather input, .weather .slider, .views input, .views .slider", () => {
			d20plus.engine._updatePageCustomOptions();
		}).on("click", ".go_to_image_editor", (evt) => {
			const {currentTarget: target} = evt;
			const $modal = $(target).closest(`[data-tokenid]`);
			if (!$modal.find(".btn.go_to_image_editor").length) return;
			const tokenId = $modal.data("tokenid");
			const $tokenEdit = d20plus.menu.editToken(tokenId);
			$modal.find(".modal-tokeneditor-body")
				.empty()
				.append($tokenEdit.parent("div").css({
					display: "block",
					position: "initial",
					width: "auto",
					"box-shadow": "none",
				}).attr("style", (i, css) => css.replace("initial", "initial !important")));
			$modal.parent("div")
				.find(".ui-dialog-buttonset .btn-primary")
				.on("mousedown", $tokenEdit.dialog("option", "buttons").save.click);
		});
	};

	d20plus.engine.enhanceMacros = (openedMacroId) => {
		const $dialog = $(`.dialog[data-macroid=${openedMacroId}]`);
		if (!openedMacroId || !$dialog[0]) return;
		const $macro = $dialog.find(`.macro.tokenizer`);
		const $b20macro = $dialog.find(`.tokenizer.b20`);
		const $name = $dialog.find("input.name");
		const $checkbox = $dialog.find(".isjs")
			.on("change", () => {
				if ($checkbox.prop("checked")) $macro.parent().addClass("jsdialog");
				else $macro.parent().removeClass("jsdialog");
			});
		const macro = currentPlayer.macros._byId[openedMacroId];
		const script = d20plus.engine.decodeScript($macro.val());
		if (script) {
			$macro.parent().addClass("jsdialog");
			$b20macro.val(script);
			$checkbox.prop("checked", true);
		} else {
			$b20macro.val($macro.val());
		}
		$dialog.find(".btn.testmacro").on("click", () => {
			if (!$checkbox.prop("checked")) {
				$macro.val($b20macro.val());
			} else {
				$macro.val(d20plus.engine.runScript($b20macro.val(), macro));
			}
		});
		const $buttons = $dialog.parent()
			.find(".ui-dialog-buttonpane button:not(.active)")
			.addClass("active");
		$buttons.on("mouseup", () => {
			let name = $name.val() || "Untitled";
			const existing = new Set(d20.Campaign.players.map(p => p.macros
				.filter(m => m.id !== openedMacroId && (p.id === d20_player_id || m.visibleToCurrentPlayer()))
				.map(m => m.get("name"))).flat());
			while (existing.has(name)) name = name.replace(/(\d*?)$/, id => Number(id) + 1);
			if ($name.val() !== name) $name.val(name);
			if (!$checkbox.prop("checked")) $macro.val($b20macro.val());
			else $macro.val(d20plus.engine.encodeScript($b20macro.val()));
		});
	}

	d20plus.engine.decodeScript = (macro) => {
		const parts = macro.split("...");
		if (parts.length !== 3
			|| parts[0] !== "bs``<``"
			|| parts[2] !== "``>``") return;
		const script = decodeURIComponent(atob(parts[1]));
		return script;
	}

	d20plus.engine.encodeScript = (script) => {
		const saved = btoa(encodeURIComponent(script));
		return `bs\`\`<\`\`...${saved}...\`\`>\`\``;
	}

	d20plus.engine.runScript = (script, macro) => {
		// b20 fails to load if it has words use and strict separated by space ANYWHERE (right, even in comments)
		const fnBody = `"use\u0020strict";\n${script}`;
		try {
			// eslint-disable-next-line no-new-func
			const fn = new Function(fnBody);
			return fn.call(macro) || "";
		} catch (e) {
			d20plus.ut.sendHackerChat(`Script executed with errors`, true);
			d20plus.ut.error(e);
			return "";
		}
	}

	d20plus.engine.enhancePageSettings = () => {
		const page = d20.Campaign.pages.find(p => $(p.view.el).is(":visible")); // #TODO get rid of _lastsettingsPageId
		d20plus.engine._lastSettingsPageId = page.id;							// it used to capture d20.Campaign.pages.get(d20plus.engine._lastSettingsPageId)
		d20plus.ut.log("Enhancing page", page);
		if (page && page.get) {
			const $dialog = $(`.pagedetails_navigation:visible`).closest(`.ui-dialog`);
			const $saveBtn = $dialog.find(`.btn-primary:visible`);
			// if editing active page then close pages list and add Apply button
			if (d20.Campaign.activePage().id === d20plus.engine._lastSettingsPageId) {
				const $barPage = $(`#page-toolbar`);
				const $overlay = $(`.ui-widget-overlay`);
				const templateApply = `<button type="button" class="btn btn-apply" title="Apply settings for current page">Apply</button>`;
				if (!$barPage.hasClass("closed")) {
					$barPage.find(`.handle`).click();
					$overlay.remove();
				}
				$saveBtn.before(templateApply);
				$(`.btn-apply`).on("click", d20plus.engine.applyPageSettings);
			}
			// process options within open dialog
			if ($dialog[0]) {
				const $pageTitle = $dialog.find(`.ui-dialog-title:visible`);
				d20plus.engine._preservePageCustomOptions(page);
				d20plus.engine._populatePageCustomOptions(page, $dialog.find(`.dialog .tab-content`));
				if ($pageTitle[0] && !$(".ui-dialog-pagename:visible")[0]) {
					$pageTitle.after(`<span class="ui-dialog-pagename">${page.get("name")}</span>`);
					$saveBtn.off("click");
					$saveBtn.on("click", d20plus.engine.applyPageSettings);
					// closed editors behave strangely, so replace Close with Cancel
					$dialog.find(`.ui-dialog-titlebar-close:visible`).on("mousedown", () => {
						$dialog.find(`.ui-dialog-buttonpane .btn:not(.btn-apply):not(.btn-primary)`).click();
					}).off("click");
					// one property for two checkboxes, make sure they're synced
					const $dynlgtCheckbox = $(`.tab-content:visible .dyn_fog_update_on_drop`).parent().parent();
					const $legacyCheckbox = $(`.tab-content:visible .lightingupdate`);
					$dynlgtCheckbox.on("click", (evt) => {
						const $checkTarget = $(evt.target).parent().find(`input`);
						if ($checkTarget.length) {
							$legacyCheckbox.prop("checked", $checkTarget.prop("checked"));
						}
					});
				}
			}
		}
	}

	d20plus.engine.applyPageSettings = (evt) => {
		evt.stopPropagation();
		evt.preventDefault();
		const page = d20.Campaign.pages.get(d20plus.engine._lastSettingsPageId);
		if (!page?.get) return;

		const $dialog = $(`.pagedetails_navigation:visible`).closest(".ui-dialog");
		if (!$dialog[0]) return;

		const activeTab = $(`li.active:visible:not(.dl) > a`).data("tab");
		const activeTabScroll = $dialog.find(`.ui-dialog-content`).scrollTop();
		const $settings = $dialog.find(`.dialog .tab-content`);

		d20plus.engine._savePageCustomOptions(page);
		d20plus.engine._savePageNativeOptions(page, $settings);

		page.save();

		if (!$(evt.currentTarget).hasClass("btn-apply")) {
			// now we should close the dialog (effectively press Cancel)
			$(`.ui-dialog-buttonpane:visible .btn:not(.btn-apply):not(.btn-primary)`).click();
		} else {
			// page.save resets current dialog, so we need to restore status quo
			$(`.nav-tabs:visible [data-tab=${activeTab}]`).click();
			$(`.ui-dialog-content:visible`).scrollTop(activeTabScroll);
			d20plus.engine._populatePageCustomOptions();
		}
	}

	d20plus.engine._ROLL20_PAGE_OPTIONS = {
		width: {id: "page-size-width-input", class: ".width.units.page_setting_item"},
		height: {id: "page-size-height-input", class: ".height.units.page_setting_item"},
		background_color: {class: ".pagebackground"},
		wrapperColor: {class: ".wrappercolor"},
		useAutoWrapper: {id: "page-wrapper-color-from-map-toggle", class: ".useautowrapper"},

		scale_number: {id: "page-size-height-input", class: ".scale_number"},
		scale_units: {id: "page-scale-grid-cell-label-select", class: ".scale_units"},
		gridlabels: {id: "page-grid-hex-label-toggle", class: ".gridlabels"},
		snapping_increment: {id: "page-grid-cell-width-input", class: ".grid-cell-width.snappingincrement.units"},
		gridcolor: {class: ".gridcolor"},
		grid_opacity: {class: ".gridopacity a.ui-slider-handle"},
		lightrestrictmove: {id: "page-dynamic-lighting-line-restrict-movement-toggle", class: ".lightrestrictmove"},
		jukeboxtrigger: {id: "page-audio-play-on-load", class: ".pagejukeboxtrigger"},

		dynamic_lighting_enabled: {class: ".dyn_fog_enabled"},
		explorer_mode: {class: ".dyn_fog_autofog_mode"},
		daylight_mode_enabled: {class: ".dyn_fog_global_illum"},
		daylightModeOpacity: {class: ".dyn_fog_daylight_slider"},
		// lightupdatedrop: {class: ".dyn_fog_update_on_drop"}, // same property
		fog_opacity: {class: ".fogopacity a.ui-slider-handle"},

		showdarkness: {class: ".darknessenabled"},

		adv_fow_enabled: {class: ".advancedfowenabled"},
		adv_fow_show_grid: {class: ".advancedfowshowgrid"},
		adv_fow_dim_reveals: {class: ".dimlightreveals"},
		adv_fow_gm_see_all: {id: "#afow_gm_see_all"},
		adv_fow_grid_size: {class: ".advancedfowgridsize"},
		showlighting: {class: ".lightingenabled"},
		lightenforcelos: {class: ".lightenforcelos"},
		lightupdatedrop: {class: ".lightingupdate"},
		lightglobalillum: {class: ".lightglobalillum"},
	};

	d20plus.engine._savePageNativeOptions = (page, dialog) => {
		if (!page || !page.get) return;
		const getSlider = (el) => {
			if (el.style.left?.search("%") > 0) return el.style.left.slice(0, -1) / 100;
			else {
				// eslint-disable-next-line no-console
				console.warn("%cD20Plus > ", "color: #b93032; font-size: large", "Can't process slider value");
				return undefined;
			}
		}
		const getVal = (el) => {
			if (el.hasClass("dyn_fog_autofog_mode")) return el.prop("checked") ? "basic" : "off";
			else if (el.is(":checkbox")) return !!el.prop("checked");
			else if (el.hasClass("ui-slider-handle")) return getSlider(el.get(0));
			else return el.val();
		}
		Object.entries(d20plus.engine._ROLL20_PAGE_OPTIONS).forEach(([name, option]) => {
			const $e = dialog.find(option.class || option.id);
			// this is needed to properly process custom scale label which is represented by 2 inputs instead of 1
			const isCustomScale = name === "scale_units" && $e.val() === "custom";
			const val = !isCustomScale ? getVal($e) : getVal(dialog.find("#page-scale-grid-cell-custom-label"));
			if (val !== undefined) page.attributes[name] = val;
		});
	}

	d20plus.engine._preservePageCustomOptions = (page) => {
		if (!page || !page.get) return;
		d20plus.engine._customPageOptions = d20plus.engine._customPageOptions || {};
		d20plus.engine._customPageOptions[page.id] = { _defaults: {} };
		[
			"weather",
			"views",
		].forEach(category => Object.entries(d20plus[category].props).forEach(([name, deflt]) => {
			d20plus.engine._customPageOptions[page.id][name] = page.get(`bR20cfg_${name}`) || deflt;
			d20plus.engine._customPageOptions[page.id]._defaults[name] = deflt;
		}));
	}

	d20plus.engine._populatePageCustomOptions = (page, dialog) => {
		dialog = dialog || $(`.pagedetails_navigation:visible`).closest(".ui-dialog");
		page = page || d20.Campaign.pages.get(d20plus.engine._lastSettingsPageId);
		d20plus.engine._customPageOptions = d20plus.engine._customPageOptions || {};
		if (!d20plus.engine._customPageOptions[page?.id]) return;
		Object.entries(d20plus.engine._customPageOptions[page.id]).forEach(([name, val]) => {
			dialog.find(`[name="${name}"]`).each((i, e) => {
				const $e = $(e);
				if ($e.is(":checkbox")) {
					$e.prop("checked", !!val);
				} else if ($e.is("input[type=range]")) {
					dialog.find(`.${name}`).val(val);
					$e.val(val);
				} else {
					$e.val(val);
				}
			});
		});
		// ensure all Select elements will update options on change
		$(".weather select").each((a, b) => { b.onchange = () => d20plus.engine._updatePageCustomOptions() });
	}

	d20plus.engine._updatePageCustomOptions = (page, dialog) => {
		dialog = dialog || $(`.pagedetails_navigation:visible`).closest(".ui-dialog");
		page = page || d20.Campaign.pages.get(d20plus.engine._lastSettingsPageId);
		if (!d20plus.engine._customPageOptions[page.id]) return;
		Object.entries(d20plus.engine._customPageOptions[page.id]).forEach(([name, val]) => {
			dialog.find(`[name="${name}"]`).each((i, e) => {
				const $e = $(e);
				const val = $e.is(":checkbox") ? !!$e.prop("checked") : $e.val();
				d20plus.engine._customPageOptions[page.id][name] = val;
			});
		});
	}

	d20plus.engine._savePageCustomOptions = (page) => {
		const values = d20plus.engine._customPageOptions[page.id];
		Object.entries(values).forEach(([name, val]) => {
			if (name === "_defaults") return;
			if (val && val !== values._defaults[name]) {
				page.attributes[`bR20cfg_${name}`] = val;
			} else {
				if (page.attributes.hasOwnProperty(`bR20cfg_${name}`)) {
					page.attributes[`bR20cfg_${name}`] = null;
				}
			}
		});
	}

	d20plus.engine.initQuickSearch = ($iptSearch, $outSearch) => {
		$iptSearch.on("keyup", () => {
			const searchVal = ($iptSearch.val() || "").trim();
			$outSearch.empty();
			if (searchVal.length <= 2) return; // ignore 2 characters or less, for performance reasons
			const found = $(`#journal .content`).find(`li[data-itemid]`).filter((i, ele) => {
				const $ele = $(ele);
				return $ele.find(`.name`).text().trim().toLowerCase().includes(searchVal.toLowerCase());
			});
			if (found.length) {
				$outSearch.append(`<p><b>Search results:</b></p>`);
				const $outList = $(`<ol class="dd-list Vetools-search-results"/>`);
				$outSearch.append($outList);
				found.clone().addClass("Vetools-draggable").appendTo($outList);
				$outSearch.append(`<hr>`);
				$(`.Vetools-search-results .Vetools-draggable`).draggable({
					revert: true,
					distance: 10,
					revertDuration: 0,
					helper: "clone",
					handle: ".namecontainer",
					appendTo: "body",
					scroll: true,
					start: function () {
						$("#journalfolderroot").addClass("externaldrag")
					},
					stop: function () {
						$("#journalfolderroot").removeClass("externaldrag")
					},
				});
			}
		});
	};

	/* eslint-disable */

	d20plus.engine.getSelectedToMove = () => {
		const n = [];
		for (var l = d20.engine.selected(), c = 0; c < l.length; c++)
			n.push(l[c]);
	};

	d20plus.engine.forwardOneLayer = (n) => {
		d20.engine.canvas.getActiveGroup() && d20.engine.unselect(),
			_.each(n, function (e) {
				d20.engine.canvas.bringForward(e)
			}),
			d20.Campaign.activePage().debounced_recordZIndexes()
	};

	d20plus.engine.backwardOneLayer = (n) => {
		d20.engine.canvas.getActiveGroup() && d20.engine.unselect(),
			_.each(n, function (e) {
				d20.engine.canvas.sendBackwards(e)
			}),
			d20.Campaign.activePage().debounced_recordZIndexes()
	};

	// previously "enhanceSnap"
	d20plus.engine.enhanceMouseDown = () => {
		const R = d20plus.overwrites.canvasHandlerDown

		if (FINAL_CANVAS_MOUSEDOWN_LIST.length) {
			FINAL_CANVAS_MOUSEDOWN = (FINAL_CANVAS_MOUSEDOWN_LIST.find(it => it.on === d20.engine.final_canvas) || {}).listener;
		}

		if (FINAL_CANVAS_MOUSEDOWN) {
			d20plus.ut.log("Enhancing hex snap");
			d20.engine.final_canvas.removeEventListener("mousedown", FINAL_CANVAS_MOUSEDOWN);
			d20.engine.final_canvas.addEventListener("mousedown", R);
		}

		// add sub-grid snap
		d20.engine.snapToIncrement = function(e, t) {
			t *= Number(d20plus.cfg.getOrDefault("canvas", "gridSnap"));
			return t * Math.round(e / t);
		}
	};

	d20plus.engine.enhanceMouseUp = () => { // P

	};

	// needs to be called after `enhanceMeasureTool()`
	d20plus.engine.enhanceMouseMove = () => {
		// add missing vars
		var i = d20.engine.canvas;

		// Roll20 bug (present as of 2019-5-25) workaround
		//   when box-selecting + moving tokens, the "object:moving" event throws an exception
		//   try-catch-ignore this, because it's extremely annoying
		const cachedFire = i.fire.bind(i);
		i.fire = function (namespace, opts) {
			if (namespace === "object:moving") {
				try {
					cachedFire(namespace, opts);
				} catch (e) {}
			} else {
				cachedFire(namespace, opts);
			}
		};

		const I = d20plus.overwrites.canvasHandlerMove

		if (FINAL_CANVAS_MOUSEMOVE_LIST.length) {
			FINAL_CANVAS_MOUSEMOVE = (FINAL_CANVAS_MOUSEMOVE_LIST.find(it => it.on === d20.engine.final_canvas) || {}).listener;
		}

		if (FINAL_CANVAS_MOUSEMOVE) {
			d20plus.ut.log("Enhancing mouse move");
			d20.engine.final_canvas.removeEventListener("mousemove", FINAL_CANVAS_MOUSEMOVE);
			d20.engine.final_canvas.addEventListener("mousemove", I);
		}
	};

	/* eslint-enable */// RB20 EXCLUDE START

	d20plus.engine.tokenRepresentsPc = (token) => {
		if (!token || !token.get) return undefined;
		if (token.get("type") !== "image") return false;
		if (!token.character) return false;
		if (!token.character.attribs.length && !token.character.attribs.fetching) {
			token.character.attribs.fetch(token.character.attribs);
			token.character.attribs.fetching = true;
		} else if (token.character.attribs.length) {
			if (token.character.attribs.fetching) delete token.character.attribs.fetching;
			const attrib = token.character.attribs.models.find(atrib => atrib.attributes.name === "npc");
			if (attrib) {
				if (attrib.attributes.current === "0") return true;
				else return false;
			}
		}
	}

	/* d20plus.engine.updateTokenBars = async (charID, barID) => {
		d20.Campaign.pages.models.forEach(page => {
			page.thegraphics.forEach(item => {
				if (item.model.get("represents") === charID) {
					item.model.pullLinkedBar(barID);
				}
			})
		})
	} */ // RB20 EXCLUDE END

	d20plus.engine.expendResources = async (expend) => {
		const character = d20.Campaign.characters._byId[expend.charID];
		if (!character || !character?.currentPlayerControls()) return;
		const fetched = await d20plus.ut.fetchCharAttribs(character);
		if (!fetched) return;
		const getAttribVal = () => {
			const vals = {
				spell: {cur: "expended", id: `lvl${expend.lvl}_slots`},
				resource: {cur: "current", link: "itemid", id: `${expend.res}_resource`},
				repeated: {cur: "current", link: "itemid", exp: /repeating_resource_(.*?)_resource_(?<pos>right|left)_name/},
				item: {cur: "itemcount", link: "itemresourceid", exp: /repeating_inventory_(.*?)_itemname/},
			}[expend.type];
			vals.id = vals.id || character.attribs?.models
				?.find(prop => prop?.attributes?.current === expend.name && prop?.attributes?.name.match(vals.exp))
				?.attributes.name.replace(/_(name|itemname)$/, "");
			return vals;
		};
		d20plus.ut.log(expend);
		const playerName = d20plus.ut.getPlayerNameById(d20_player_id);
		const characterName = character.get("name");
		const refs = getAttribVal();
		const attrib = d20plus.ut.getCharMetaAttribByName(character, refs.id);
		if (!attrib) return;
		const syncWeight = (ref) => {
			const ignNonequipped = !!d20plus.ut.getCharAttribByName(character, "ingore_non_equipped_weight")?.attributes.current;
			const isAccounted = (!ignNonequipped || ref.equipped !== "0") && ref.itemweight > 0;
			if (!isAccounted) return;
			const totalWeight = d20plus.ut.getCharAttribByName(character, "weighttotal");
			if (!totalWeight?.attributes.current) return;
			const weightDelta = ((expend.restore || attrib._new) - attrib._cur) * ref.itemweight;
			const weightResult = totalWeight.attributes.current + weightDelta;
			totalWeight.save({current: weightResult});
		}
		const syncSheet = () => {
			if (attrib.itemweight) syncWeight(attrib);
			if (!refs.link || !attrib[refs.link]) return;
			const toSync = d20plus.ut.getCharMetaAttribByName(character, attrib[refs.link], true);
			const toSyncRef = toSync?._ref?.current || toSync?._ref?.itemcount;
			toSyncRef?.save({current: expend.restore || attrib._new});
			if (toSync?.itemweight) syncWeight(toSync);
		}
		const getMsgText = () => {
			if (expend.type === "spell") return `lvl${expend.lvl} slots`;
			else if (expend.name) return `of ${expend.name}`;
			else if (attrib.name) return `of ${attrib.name}`;
			else return `class resource`;
		};
		expend.amt = expend.amt || 1;
		attrib._cur = attrib[refs.cur];
		d20plus.ut.log(attrib);
		if (isNaN(attrib._cur)) return;
		if (expend.restore !== undefined) {
			attrib._ref[refs.cur].save({current: String(expend.restore)});
			attrib._msg = `/w "${characterName}" ${characterName} has ${expend.restore} ${getMsgText()} again`;
			syncSheet();
		} else if (attrib._cur - expend.amt >= 0) {
			attrib._new = attrib._cur - expend.amt;
			attrib._ref[refs.cur].save({current: String(attrib._new)});
			attrib._undo = {...expend}; attrib._undo.restore = attrib._cur;
			attrib._msg = `/w "${characterName}" ${characterName} now has ${attrib._new} ${getMsgText()} left`;
			syncSheet();
		} else {
			attrib._msg = `/w "${characterName}" ${characterName} already had zero ${getMsgText()}`;
		}
		const transport = {type: "automation"};
		if (expend.restore) transport.author = `${playerName} restored some ${getMsgText()}`;
		else transport.author = `${playerName} tried using ${expend.amt} ${getMsgText()}`;
		if (attrib._undo) transport.undo = attrib._undo;
		d20.textchat.doChatInput(attrib._msg, undefined, transport);
	}

	d20plus.engine.alterTokensHP = (alter) => {
		const barID = Number(d20plus.cfg.getOrDefault("chat", "dmgTokenBar"));
		const bar = {
			val: `bar${barID}_value`,
			link: `bar${barID}_link`,
			max: `bar${barID}_max`,
		};
		const calcHP = (token) => {
			if (!token?.get) return false;
			const current = token.get(bar.val);
			const max = token.get(bar.max);
			if (isNaN(max) || isNaN(current) || current === "") return false;
			const hp = {old: current, new: current - alter.dmg};
			if (hp.new < 0) hp.new = 0;
			if (max !== "") {
				if (hp.new > max) hp.new = max;
				if (hp.new <= -max) hp.dead = true;
				if (hp.old <= 0 && hp.new > 0) hp.alive = true;
			}
			return hp;
		}
		const playerName = d20plus.ut.getPlayerNameById(d20_player_id);
		const author = `${playerName} applied ${alter.dmg} damage`;
		const transport = {type: "automation", author};
		const targets = alter.targets || d20.engine.selected();
		d20.engine.unselect();
		targets.forEach(async token => {
			if (typeof token === "string") token = d20plus.ut.getTokenById(token);
			else if (token.model) token = token.model;
			const hp = calcHP(token);
			if (!hp) return d20plus.ut.sendHackerChat("You have to select proper token bar in the settings", true);
			if (!token.currentPlayerControls()) return;
			if (alter.restore !== undefined) hp.new = alter.restore;
			const barLinked = token.get(bar.link);
			const tokenName = token.get("name");
			if (barLinked) {
				if (!token.character?.currentPlayerControls()) return;
				const charID = token.character?.id;
				const fetched = await d20plus.ut.fetchCharAttribs(token.character);
				if (fetched && charID) {
					const attrib = token.character.attribs.get(barLinked);
					const charName = token.character.get("name");
					attrib.save({current: hp.new});
					attrib.syncTokenBars();
					hp.msg = `/w "${charName}" ${tokenName} from ${hp.old} to ${hp.new} HP`;
					if (alter.restore !== undefined) hp.msg = `/w "${charName}" ${tokenName} HP back to ${hp.new}`;
				}
			} else {
				token.save({[bar.val]: hp.new});
				hp.msg = `/w gm ${tokenName} from ${hp.old} to ${hp.new} HP`;
				if (alter.restore !== undefined) hp.msg = `/w gm ${tokenName} HP back to ${hp.new}`;
			}
			if (hp.msg) {
				hp.undo = {type: "hp", dmg: alter.dmg, restore: hp.old, targets: [token.id]};
				if (alter.restore === undefined) hp.transport = Object.assign({undo: hp.undo}, transport);
				else transport.author = `${playerName} restored HP to ${alter.restore}`;
				d20.textchat.doChatInput(hp.msg, undefined, hp.transport || transport);
				if (hp.dead) d20.textchat.doChatInput(`${tokenName} is instantly dead`, undefined, transport);
				else if (hp.alive) d20.textchat.doChatInput(`${tokenName} is conscious again`, undefined, transport);
				else if (hp.new === 0) d20.textchat.doChatInput(`${tokenName} falls unconscious`, undefined, transport);
			}
		})
	}

	d20plus.engine.addLineCutterTool = () => {
		// The code in /overwrites/canvas-handler.js doesn't work
		const $btnTextTool = $(`.choosetext`);

		const $btnSplitTool = $(`<li class="choosesplitter">✂️ Line Splitter</li>`).click(() => {
			d20plus.setMode("line_splitter");
		});

		$btnTextTool.after($btnSplitTool);
	};

	d20plus.engine._tokenHover = null;
	d20plus.engine._drawTokenHover = () => {
		$(`.Vetools-token-hover`).remove();
		if (!d20plus.engine._tokenHover || !d20plus.engine._tokenHover.text) return;

		const pt = d20plus.engine._tokenHover.pt;
		const txt = unescape(d20plus.engine._tokenHover.text);

		$(`body`).append(`<div class="Vetools-token-hover" style="top: ${pt.y * d20.engine.canvasZoom}px; left: ${pt.x * d20.engine.canvasZoom}px">${txt}</div>`);
	};
	d20plus.engine.addTokenHover = () => {
		// gm notes on shift-hover
		const cacheRenderLoop = d20.engine.renderLoop;
		d20.engine.renderLoop = () => {
			d20plus.engine._drawTokenHover();
			cacheRenderLoop();
		};

		// store data for the rendering function to access
		d20.engine.canvas.on("mouse:move", (data, ...others) => {
			// enable hover from GM layer -> token layer
			let hoverTarget = data.target;
			if (data.e && window.currentEditingLayer === "gmlayer") {
				const cache = window.currentEditingLayer;
				window.currentEditingLayer = "objects";
				hoverTarget = d20.engine.canvas.findTarget(data.e, null, true);
				window.currentEditingLayer = cache;
			}

			if (data.e.shiftKey && hoverTarget && hoverTarget.model) {
				d20.engine.redrawScreenNextTick();
				const gmNotes = hoverTarget.model.get("gmnotes");
				const pt = d20.engine.canvas.getPointer(data.e);
				pt.x -= d20.engine.currentCanvasOffset[0];
				pt.y -= d20.engine.currentCanvasOffset[1];
				d20plus.engine._tokenHover = {
					pt: pt,
					text: gmNotes,
					id: hoverTarget.model.id,
				};
			} else {
				if (d20plus.engine._tokenHover) d20.engine.redrawScreenNextTick();
				d20plus.engine._tokenHover = null;
			}
		})
	};

	d20plus.engine.enhanceMarkdown = () => {
		const OUT_STRIKE = "<span style='text-decoration: line-through'>$1</span>";

		/* eslint-disable */

		// BEGIN ROLL20 CODE
		window.Markdown.parse = function(x) {
			var g = x, l, t = [], m = [], v = g.indexOf(`\r\n`) != -1 ? `\r\n` : g.indexOf(`\n`) != -1 ? `\n` : "";
			return g = g.replace(/{{{([\s\S]*?)}}}/g, function(h) {
				return t.push(h.substring(3, h.length - 3)),
				"{{{}}}"
			}),
			g = g.replace(new RegExp("<pre>([\\s\\S]*?)</pre>","gi"), function(h) {
				return m.push(h.substring(5, h.length - 6)),
				"<pre></pre>"
			}),
			// BEGIN MOD
			g = g.replace(/~~(.*?)~~/g, OUT_STRIKE),
			// END MOD
			g = g.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
			g = g.replace(/\*(.*?)\*/g, "<em>$1</em>"),
			g = g.replace(/``(.*?)``/g, "<code>$1</code>"),
			g = g.replace(/\[([^\]]+)\]\(([^)]+(\.png|\.gif|\.jpg|\.jpeg))\)/g, '<a href="$2"><img src="$2" alt="$1" /></a>'),
			g = g.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'),
			g = g.replace(new RegExp("<pre></pre>","g"), function(h) {
				return "<pre>" + m.shift() + "</pre>"
			}),
			g = g.replace(/{{{}}}/g, function(h) {
				return t.shift()
			}),
			g
		},
		// END ROLL20 CODE

		/* eslint-enable */

		// after a short delay, replace any old content in the chat
		setTimeout(() => {
			$(`.message.general`).each(function () {
				$(this).html($(this).html().replace(/~~(.*?)~~/g, OUT_STRIKE))
			})
		}, 2500);
	};

	d20plus.engine.enhancePathWidths = () => {
		const $selThicc = $(`#path_width`).css("width", "150px");
		$selThicc.append(`
				<option value="5">Custom 1 (5 px.)</option>
				<option value="5">Custom 2 (5 px.)</option>
				<option value="5">Custom 3 (5 px.)</option>
			`);
		const $iptThicc = $(`<input type="number" style="max-width: 50px;">`).hide();
		const $lblPixels = $(`<label style="display: inline-flex;"> pixels</label>`).hide();
		$selThicc.after($lblPixels).after($iptThicc);

		let $selOpt = null;
		$selThicc.on("change", () => {
			$selOpt = $selThicc.find(`option:selected`);
			const txt = $selOpt.text();
			if (txt.startsWith("Custom")) {
				const thicc = /\((.*?) px\.\)/.exec(txt)[1];
				$lblPixels.show();
				$iptThicc.show().val(Number(thicc));
			} else {
				$lblPixels.hide();
				$iptThicc.hide();
			}
		});

		$iptThicc.on("keyup", () => {
			if (!$selOpt) $selOpt = $selThicc.find(`option:selected`);
			if ($selOpt) {
				const clean = Math.round(Math.max(1, Number($iptThicc.val())));
				$selOpt.val(`${clean}`);
				$selOpt.text($selOpt.text().replace(/\(\d+ px\.\)/, `(${clean} px.)`));
				d20.engine.canvas.freeDrawingBrush.width = clean;
			}
		});
	};

	d20plus.engine.enhanceTransmogrifier = () => {
		JqueryUtil.addSelectors();

		$("#transmogrifier").on("click", () => {
			setTimeout(() => {
				const $btnAlpha = $(`#vetools-transmog-alpha`);
				if (!$btnAlpha.length) {
					const $prependTarget = $(`.ui-dialog-title:textEquals(transmogrifier)`).first().parent().parent().find(`.ui-dialog-content`);
					$(`<button id="#vetools-transmog-alpha" class="btn btn default" style="margin-bottom: 5px;">Sort Items Alphabetically</button>`).on("click", () => {
						// coped from a bookmarklet
						$("iframe").contents().find(".objects").each((c, e) => { let $e = $(e); $e.children().sort((a, b) => { let name1 = $(a).find(".name").text().toLowerCase(); let name2 = $(b).find(".name").text().toLowerCase(); let comp = name1.localeCompare(name2); return comp; }).each((i, c) => $e.append(c)); });
					}).prependTo($prependTarget);
				}
			}, 35);
		})
	};

	d20plus.engine.layersIsMarkedAsHidden = (layer) => {
		const page = d20.Campaign.activePage();
		return page?.get(`bR20cfg_hidden`)?.search(layer) > -1;
	}

	d20plus.engine.layersVisibilityCheck = () => {
		const layers = ["floors", "background", "foreground", "roofs"];
		layers.forEach((layer) => {
			const isHidden = d20.engine.canvas._objects.some((o) => {
				if (o.model) return o.model.get("layer") === `hidden_${layer}`;
			}) || d20plus.engine.layersIsMarkedAsHidden(layer);
			d20plus.engine.layerVisibilityOff(layer, isHidden, true);
		});
	}

	d20plus.engine.layersToggle = (layer) => {
		const page = d20.Campaign.activePage();
		if (!page.get(`bR20cfg_hidden`)) page.set(`bR20cfg_hidden`, "");
		if (d20plus.engine.layersIsMarkedAsHidden(layer)) {
			d20plus.engine.layerVisibilityOff(layer, false);
		} else {
			d20plus.engine.layerVisibilityOff(layer, true);
		}
	};

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

	d20plus.engine._objectsStashProps = (obj, visible) => {
		[
			"emits_bright_light",
			"emits_low_light",
			"has_directional_bright_light",
			"has_directional_dim_light",
			"bar1_value",
			"bar2_value",
			"bar3_value",
			"showname",
		].each((prop) => {
			if (!visible) {
				if (obj.attributes[prop]) {
					obj.attributes[`bR20_${prop}`] = obj.attributes[prop];
					obj.attributes[prop] = false;
				}
			} else {
				if (obj.attributes[`bR20_${prop}`]) {
					obj.attributes[prop] = obj.attributes[`bR20_${prop}`];
					obj.attributes[`bR20_${prop}`] = null;
				}
			}
		});
	}

	d20plus.engine._graphicsStashToRight = (_this, visible) => {
		const xAttr = _this.x !== undefined ? "x" : "left";
		if (typeof _this[xAttr] !== "number") return;
		if (!visible) {
			const page = d20.Campaign.pages.get(_this.page_id) || d20.Campaign.activePage();
			const newLeft = _this[xAttr] + page.get("width") * 70;
			_this.bR20_left = _this[xAttr];
			_this[xAttr] = newLeft;
		} else {
			if (_this.bR20_left) {
				_this[xAttr] = _this.bR20_left;
				_this.bR20_left = null;
			}
		}
	}

	d20plus.engine.objectsHideUnhide = (query, val, prefix, visible) => {
		let some = false;
		for (const o of d20.engine.canvas._objects) {
			if (!o.model) continue;
			if (`${o.model.get(query)}`.search(val) > -1) {
				const _this = o.model.attributes;
				const {layer} = o.model.attributes;
				if (visible) {
					if (_this.bR20_hidden && _this.bR20_hidden.search(prefix) > -1) {
						_this.bR20_hidden = _this.bR20_hidden.replace(`${prefix}_`, "");
						if (_this.type !== "path") {
							_this.layer = layer.replace(`${prefix}_`, "");
							if (!_this.bR20_hidden) {
								d20plus.engine._objectsStashProps(o.model, true);
							}
						} else if (!_this.bR20_hidden) {
							d20plus.engine._graphicsStashToRight(_this, true);
						}
						o.saveState();
						o.model.save();
						some = true;
					}
				} else {
					if (!_this.bR20_hidden || _this.bR20_hidden.search(prefix) === -1) {
						_this.bR20_hidden = `${prefix}_${_this.bR20_hidden || ""}`;
						if (_this.type !== "path") {
							_this.layer = `${prefix}_${layer}`;
							d20plus.engine._objectsStashProps(o.model, false);
						} else {
							d20plus.engine._graphicsStashToRight(_this, false);
						}
						o.saveState();
						o.model.save();
						some = true;
					}
				}
			}
		}
		return some;
	};

	d20plus.engine.portalsHideUnhide = (viewid, prefix, visible) => {
		const page = d20.Campaign.activePage();
		[`doors`, `windows`].forEach(e => page[e].models.forEach(it => {
			const _this = it.attributes;
			if (!it.get(viewid)) return;
			if (visible) {
				if (_this.bR20_hidden && _this.bR20_hidden.search(prefix) > -1) {
					_this.bR20_hidden = _this.bR20_hidden.replace(`${prefix}_`, "");
					if (!_this.bR20_hidden) {
						d20plus.engine._graphicsStashToRight(_this, true);
					}
					it.save();
					it.createView();
				}
			} else {
				if (!_this.bR20_hidden || _this.bR20_hidden.search(prefix) === -1) {
					_this.bR20_hidden = `${prefix}_${_this.bR20_hidden || ""}`;
					d20plus.engine._graphicsStashToRight(_this, false);
					it.save();
					it.createView();
				}
			}
		}))
	};

	d20plus.engine.addLayers = () => {
		d20plus.ut.log("Adding layers");

		d20.engine.canvas._renderAll = _.bind(d20plus.mod.renderAll, d20.engine.canvas);
		d20.engine.canvas.sortTokens = _.bind(d20plus.mod.sortTokens, d20.engine.canvas);
		d20.engine.canvas.drawAnyLayer = _.bind(d20plus.mod.drawAnyLayer, d20.engine.canvas);
		d20.engine.canvas.drawTokensWithoutAuras = _.bind(d20plus.mod.drawTokensWithoutAuras, d20.engine.canvas);// RB20 EXCLUDE START
		// d20.engine.canvas._renderAll = _.bind(d20plus.mod.legacy_renderAll, d20.engine.canvas);
		// d20.engine.canvas._layerIteratorGenerator = d20plus.mod.legacy_layerIteratorGenerator;// RB20 EXCLUDE END

		if (window.is_gm) {
			$(document).on("d20:new_page_fully_loaded", d20plus.engine.checkPageSettings);
			d20plus.engine.checkPageSettings();
		}
	};

	d20plus.engine.checkPageSettings = () => {
		if (!d20plus.cfg.getOrDefault("canvas", "extraLayerButtons")) return;
		if (!d20.Campaign.activePage() || !d20.Campaign.activePage().get) {
			setTimeout(d20plus.engine.checkPageSettings, 50);
		} else {
			d20plus.engine.layersVisibilityCheck();
			d20plus.views.populateMenu();
		}
	}

	d20plus.engine.removeLinkConfirmation = function () {
		d20.utils.handleURL = d20plus.mod.handleURL;
		$(document).off("click", "a").on("click", "a", d20.utils.handleURL);
	};

	d20plus.engine.repairPrototypeMethods = function () {
		d20plus.mod.fixHexMethods();
		d20plus.mod.fixVideoMethods();
	};

	d20plus.engine.disableFrameRecorder = function () {
		if (d20.engine.frame_recorder) {
			d20.engine.frame_recorder.active = false;
			d20.engine.frame_recorder._active = false;
		}
	};

	d20plus.engine.fixPolygonTool = () => {
		if (!d20plus.newUIDisabled) return; // as of January 2024 newUI is always ON, so the below block is not needed
		$("#editor-wrapper").on("pointerdown", x => { d20plus.engine.leftClicked = x.which === 1 });
		$("#editor-wrapper").on("pointerup", x => { d20plus.engine.leftClicked = false });
		d20plus.ut.injectCode(d20.engine, "finishCurrentPolygon", (finishDrawing, params) => {
			if (!d20plus.engine.leftClicked) finishDrawing(...params);
		});
		d20plus.ut.injectCode(d20.engine, "finishPolygonReveal", (finishRevealing, params) => {
			if (!d20plus.engine.leftClicked) finishRevealing(...params);
		});
	};
}

SCRIPT_EXTENSIONS.push(d20plusEngine);
