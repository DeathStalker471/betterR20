function baseWeather () {
	d20plus.weather = {};

	d20plus.weather.props = {
		"weatherType1": "None",
		"weatherTypeCustom1": "",
		"weatherSpeed1": "0.4",
		"weatherDir1": "Northerly",
		"weatherDirCustom1": "180",
		"weatherOpacity1": "0.5",
		"weatherOscillate1": false,
		"weatherOscillateThreshold1": "0.5",
		"weatherIntensity1": "Normal",
		"weatherTint1": false,
		"weatherTintColor1": "#4c566d",
		"weatherTintOpacity1": "0.5",
		"weatherEffect1": "None",
	};

	// Roll20's Page Settings dialog is a Vue component (see enhanceVuePageThumbnail above) with
	// its own internal tab state we can't register a tab into. Instead, clone a native tab button
	// to look the part, and manually show/hide our content vs. whatever Vue is currently rendering.
	d20plus.weather.enhanceVuePageWeather = () => {
		const TAB_TESTID = "pageSettings-tab-weather";
		const CONTENT_CLASS = "b20-weather-tab-content";
		let isActive = false;

		const getTabsRow = () => $(`.section.tabs`).first();
		const getWrapper = ($tabsRow) => $tabsRow.next(`.wrapper`);

		const applyVisibility = ($wrapper) => {
			$wrapper.children().each((i, el) => {
				el.style.display = el.classList.contains(CONTENT_CLASS) === isActive ? "" : "none";
			});
		};

		const deactivate = () => {
			if (!isActive) return;
			isActive = false;
			const $tabsRow = getTabsRow();
			$tabsRow.find(`[data-testid="${TAB_TESTID}"] .grimoire-tab__button`).removeClass("selected");
			applyVisibility(getWrapper($tabsRow));
		};

		const activate = () => {
			isActive = true;
			const $tabsRow = getTabsRow();
			$tabsRow.find(`.grimoire-tab__button`).removeClass("selected");
			$tabsRow.find(`[data-testid="${TAB_TESTID}"] .grimoire-tab__button`).addClass("selected");
			applyVisibility(getWrapper($tabsRow));
		};

		const inject = () => {
			const $tabsRow = getTabsRow();
			if (!$tabsRow.length) return;

			if (!$tabsRow.find(`[data-testid="${TAB_TESTID}"]`).length) {
				const $newTab = $tabsRow.find(`.grimoire-tab`).first().clone();
				$newTab.attr("data-testid", TAB_TESTID);
				$newTab.find(`.grimoire-tab__label`).text("Weather");
				$newTab.find(`.grimoire-tab__button`).removeClass("selected");
				$newTab.on("click", (evt) => {
					evt.stopPropagation();
					activate();
				});
				$tabsRow.append($newTab);
			}
			// clicking a native tab hands control back to Vue
			$tabsRow.find(`.grimoire-tab`).not(`[data-testid="${TAB_TESTID}"]`)
				.off("click.b20weather").on("click.b20weather", deactivate);

			const $wrapper = getWrapper($tabsRow);
			if ($wrapper.length && !$wrapper.children(`.${CONTENT_CLASS}`).length) {
				const page = d20.Campaign.activePage();
				const $content = $(d20plus.html.pageSettingsWeather).addClass(CONTENT_CLASS).appendTo($wrapper);
				d20plus.engine._preservePageCustomOptions(page);
				d20plus.engine._populatePageCustomOptions(page, $content);
				// _populatePageCustomOptions sets a raw onchange on .weather selects for the old
				// dialog, calling _updatePageCustomOptions() with no args; clear it so it doesn't
				// crash trying to resolve a page via the (here, unset) legacy _lastSettingsPageId
				$content.find("select").prop("onchange", null);
				// live-update the numeric readout next to each slider while dragging, rather than
				// only on the old delegated "click" handler (which misses drag-without-click)
				$content.on("input", "input[type=range]", (evt) => {
					const {currentTarget: target} = evt;
					if (target.name) $content.find(`.${target.name}`).val(target.value);
				});
				$content.on("change keyup", "input, select", () => {
					d20plus.engine._updatePageCustomOptions(page, $content);
					d20plus.engine._savePageCustomOptions(page);
					page.save();
				});
			}

			if ($wrapper.length) applyVisibility($wrapper);
		};

		new MutationObserver(inject).observe(document.body, {childList: true, subtree: true});
		inject();
	};
}

SCRIPT_EXTENSIONS.push(baseWeather);
