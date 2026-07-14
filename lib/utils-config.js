class ConfigSettingsGroup {
	constructor (
		{
			groupId,
			name,
			configSettings,
		},
	) {
		this._groupId = groupId;
		this._name = name;
		this._configSettings = configSettings;

		this._configSettings
			.forEach(configSetting => configSetting.setGroupId(this._groupId));
	}

	get groupId () { return this._groupId; }

	render (rdState, {isLast = false} = {}) {
		const wrpRows = ee`<div></div>`;

		ee`<div class="ve-w-100">
			<h4>${this._name}</h4>
			${wrpRows}
			${isLast ? null : `<hr class="ve-hr-3 ve-mb-1">`}
		</div>`
			.appendTo(rdState.wrp);

		this._configSettings
			.forEach(configSetting => configSetting.render(rdState, wrpRows));
	}

	mutDefaults (config) {
		const group = config[this._groupId] ||= {};
		this._configSettings
			.forEach(configSetting => configSetting.mutDefaults(group));
	}

	mutVerify (config) {
		const group = config[this._groupId] ||= {};
		this._configSettings
			.forEach(configSetting => configSetting.mutVerify(group));
	}
}

class UtilConfigHelpers {
	static packSettingId (groupId, configId) {
		return `${groupId}.${configId}`;
	}

	static unpackSettingId (settingId) {
		const [groupId, configId] = settingId.split(".");
		return {groupId, configId};
	}
}

// TODO rename this file

/** @abstract */
class _ConfigSettingBase {
	_groupId;
	_configId;
	_name;
	_help;

	_isRowLabel = false;
	_isReloadRequired = false;

	constructor (
		{
			configId,
			name,
			help,

			isRowLabel,
			isReloadRequired = false,
		} = {},
	) {
		this._configId = configId;
		this._name = name;
		this._help = help;
		this._isRowLabel = isRowLabel;
		this._isReloadRequired = isReloadRequired;
	}

	setGroupId (groupId) { this._groupId = groupId; }

	/* -------------------------------------------- */

	render (rdState, wrpRows) {
		const tag = this._isRowLabel ? "label" : "div";

		ee`<${tag} class="ve-py-1 ve-w-100 ve-split-v-center" title="${this._help.qq()}">
			${this._renderLabel(rdState)}
			${this._renderUi(rdState)}
		</${tag}>`
			.appendTo(wrpRows);
	}

	_renderLabel (rdState) {
		const ptReload = this._isReloadRequired ? `<span class="ve-ml-2 text-danger ve-small" title="Requires Refresh">‡</span>` : "";
		return `<div class="ve-w-66 ve-no-shrink ve-mr-2 ve-flex-v-center">${this._name}${ptReload}</div>`;
	}

	/**
	 * @abstract
	 * @return {HTMLElementExtended}
	 */
	_renderUi (rdState) { throw new Error("Unimplemented!"); }

	/* -------------------------------------------- */

	/** @abstract */
	mutDefaults (group) {
		throw new Error("Unimplemented!");
	}

	mutVerify (group) { /* Implement as required */ }
}

/** @abstract */
class ConfigSettingExternal extends _ConfigSettingBase {
	_renderUi (rdState) { return this._getEleExternal(); }

	/**
	 * @abstract
	 * @return {HTMLElementExtended}
	 */
	_getEleExternal () { throw new Error("Unimplemented!"); }

	mutDefaults (group) { /* No-op */ }
}

/** @abstract */
class _ConfigSettingStandardBase extends _ConfigSettingBase {
	_default;

	constructor (opts) {
		super(opts);
		this._default = opts.default;
	}

	mutDefaults (group) {
		if (group[this._configId] !== undefined) return;
		group[this._configId] = this._default;
	}
}

class ConfigSettingBoolean extends _ConfigSettingStandardBase {
	_renderUi (rdState) {
		const prop = UtilConfigHelpers.packSettingId(this._groupId, this._configId);
		return ComponentUiUtil.getCbBool(rdState.comp, prop);
	}
}

class ConfigSettingEnum extends _ConfigSettingStandardBase {
	_values;
	_fnDisplay;

	constructor ({values, fnDisplay, ...rest}) {
		super(rest);
		this._values = values;
		this._fnDisplay = fnDisplay;
	}

	_renderUi (rdState) {
		const prop = UtilConfigHelpers.packSettingId(this._groupId, this._configId);

		return ComponentUiUtil.getSelEnum(
			rdState.comp,
			prop,
			{
				values: this._values,
				fnDisplay: this._fnDisplay,
			},
		);
	}

	mutVerify (group) {
		if (this._values.includes(group[this._configId])) return;
		group[this._configId] = this._default;
	}
}

const SITE_STYLE__CLASSIC = "classic";
const SITE_STYLE__ONE = "one";

const SITE_STYLE_DISPLAY = {
	[SITE_STYLE__CLASSIC]: "Classic (5e/2014)",
	[SITE_STYLE__ONE]: "Modern (5.5e/2024)",
};

class StyleSwitcher {
	static _STORAGE_KEY_THEME = "StyleSwitcher_style";
	static _STORAGE_KEY_ROLLBOX = "StyleSwitcher_style-rollbox";
	static _STORAGE_KEY_WIDE = "StyleSwitcher_style-wide";

	static _STORAGE_KEYS = [
		this._STORAGE_KEY_THEME,
		this._STORAGE_KEY_ROLLBOX,
		this._STORAGE_KEY_WIDE,
	];

	static _STYLE_THEME_AUTOMATIC = "auto";
	static STYLE_THEME_DAY = "day";
	static _STYLE_THEME_NIGHT = "night";
	static _STYLE_THEME_NIGHT_ALT = "nightAlt";
	static _STYLE_THEME_NIGHT_CLEAN = "nightClean";

	static _CLASS_THEME_NIGHT = "ve-night-mode";
	static _CLASS_THEME_NIGHT_STANDARD = "ve-night-mode--standard";
	static _CLASS_THEME_NIGHT_ALT = "ve-night-mode--classic";
	static _CLASS_THEME_NIGHT_CLEAN = "ve-night-mode--clean";

	static _STYLE_ROLLBOX_DEFAULT = "default";
	static _STYLE_ROLLBOX_RIGHT = "right";
	static _STYLE_ROLLBOX_LEFT = "left";

	static _CLASS_ROLLBOX_DEFAULT = "ve-rollbox-mode--default";
	static _CLASS_ROLLBOX_RIGHT = "ve-rollbox-mode--right";
	static _CLASS_ROLLBOX_LEFT = "ve-rollbox-mode--left";

	static _WIDE_ID = "style-switch__wide";

	static _STYLE_THEME_TO_DISPLAY_NAME = {
		[this._STYLE_THEME_AUTOMATIC]: "Browser Default",
		[this.STYLE_THEME_DAY]: "Day Mode",
		[this._STYLE_THEME_NIGHT]: "Night Mode",
		[this._STYLE_THEME_NIGHT_ALT]: "Night Mode (Classic)",
		[this._STYLE_THEME_NIGHT_CLEAN]: "Night Mode (Clean)",
	};

	static _STYLE_ROLLBOX_TO_DISPLAY_NAME = {
		[this._STYLE_ROLLBOX_DEFAULT]: "Default",
		[this._STYLE_ROLLBOX_RIGHT]: "Right",
		[this._STYLE_ROLLBOX_LEFT]: "Left",
	};

	static _CLASSES_THEME = [
		this._CLASS_THEME_NIGHT,
		this._CLASS_THEME_NIGHT_STANDARD,
		this._CLASS_THEME_NIGHT_ALT,
		this._CLASS_THEME_NIGHT_CLEAN,
	];

	static _CLASSES_ROLLBOX = [
		this._CLASS_ROLLBOX_DEFAULT,
		this._CLASS_ROLLBOX_RIGHT,
		this._CLASS_ROLLBOX_LEFT,
	];

	/* -------------------------------------------- */

	static getSelStyle () {
		const selStyle = e_({
			tag: "select",
			clazz: "ve-form-control ve-input-xs",
			children: Object.entries(this._STYLE_THEME_TO_DISPLAY_NAME)
				.map(([id, name]) => ee`<option value="${id}">${name}</option>`),
			change: () => {
				styleSwitcher._setActiveStyleTheme(selStyle.val());
			},
		})
			.val(styleSwitcher._styleTheme);

		return selStyle;
	}

	/* -------------------------------------------- */

	static getSelRollboxPosition () {
		const selStyle = e_({
			tag: "select",
			clazz: "ve-form-control ve-input-xs",
			children: Object.entries(this._STYLE_ROLLBOX_TO_DISPLAY_NAME)
				.map(([id, name]) => ee`<option value="${id}">${name}</option>`),
			change: () => {
				styleSwitcher._setActiveStyleRollbox(selStyle.val());
			},
		})
			.val(styleSwitcher._styleRollbox);

		return selStyle;
	}

	/* -------------------------------------------- */

	static getCbWide () {
		const cbWide = e_({
			tag: "input",
			type: "checkbox",
			change: () => {
				styleSwitcher._setActiveWide(cbWide.checked);
			},
		});

		if (StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_WIDE) === "true") cbWide.checked = true;

		return cbWide;
	}

	/* -------------------------------------------- */

	_styleTheme;
	_styleRollbox;

	constructor () {
		if (typeof window === "undefined") return;
		this._setActiveStyleTheme(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_THEME) || StyleSwitcher._STYLE_THEME_AUTOMATIC);
		this._setActiveStyleRollbox(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_ROLLBOX) || StyleSwitcher._STYLE_ROLLBOX_DEFAULT);
		this._setActiveWide(StyleSwitcher.storage.getItem(StyleSwitcher._STORAGE_KEY_WIDE) === "true");
	}

	getSummary () {
		return {isNight: this._getResolvedStyleTheme() !== StyleSwitcher.STYLE_THEME_DAY};
	}

	_fnsOnChangeTheme = [];
	addFnOnChangeTheme (fn) { this._fnsOnChangeTheme.push(fn); }

	// region Night Mode
	setTemporaryTheme (style) {
		if (style) this._setActiveStyleThemeClasses(style);
		else this._setActiveStyleThemeClasses(this._styleTheme);
	}

	_getResolvedStyleTheme () {
		if (this._styleTheme === StyleSwitcher._STYLE_THEME_AUTOMATIC) return this.constructor._getDefaultStyleTheme();
		return this._styleTheme;
	}

	static _getDefaultStyleTheme () {
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) return StyleSwitcher._STYLE_THEME_NIGHT;
		return StyleSwitcher.STYLE_THEME_DAY;
	}

	_setActiveStyleTheme (style) {
		this._styleTheme = style;
		const styleResolved = this._getResolvedStyleTheme();

		this._setActiveStyleThemeClasses(styleResolved);

		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_THEME, this._styleTheme);

		this._fnsOnChangeTheme.forEach(fn => fn());
	}

	_setActiveStyleThemeClasses (styleResolved) {
		this.constructor._CLASSES_THEME
			.forEach(clazzName => document.documentElement.classList.remove(clazzName));

		switch (styleResolved) {
			case StyleSwitcher.STYLE_THEME_DAY: {
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_STANDARD);
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT_ALT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_ALT);
				break;
			}
			case StyleSwitcher._STYLE_THEME_NIGHT_CLEAN: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT);
				document.documentElement.classList.add(StyleSwitcher._CLASS_THEME_NIGHT_CLEAN);
				break;
			}
		}
	}

	getClassNamesStyleTheme () {
		switch (this._getResolvedStyleTheme()) {
			case StyleSwitcher.STYLE_THEME_DAY: return "";
			case StyleSwitcher._STYLE_THEME_NIGHT: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_STANDARD].join(" ");
			case StyleSwitcher._STYLE_THEME_NIGHT_ALT: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_ALT].join(" ");
			case StyleSwitcher._STYLE_THEME_NIGHT_CLEAN: return [StyleSwitcher._CLASS_THEME_NIGHT, StyleSwitcher._CLASS_THEME_NIGHT_CLEAN].join(" ");
		}
	}
	// endregion

	// region Rollbox
	_setActiveStyleRollbox (style) {
		this._styleRollbox = style;

		this.constructor._CLASSES_ROLLBOX
			.forEach(clazzName => document.documentElement.classList.remove(clazzName));

		switch (this._styleRollbox) {
			case StyleSwitcher._STYLE_ROLLBOX_DEFAULT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_DEFAULT);
				break;
			}
			case StyleSwitcher._STYLE_ROLLBOX_RIGHT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_RIGHT);
				break;
			}
			case StyleSwitcher._STYLE_ROLLBOX_LEFT: {
				document.documentElement.classList.add(StyleSwitcher._CLASS_ROLLBOX_LEFT);
				break;
			}
		}

		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_ROLLBOX, this._styleRollbox);
	}
	// endregion

	// region Wide Mode
	_setActiveWide (isActive) {
		const existing = document.getElementById(StyleSwitcher._WIDE_ID);
		if (!isActive) {
			document.documentElement.classList.remove(StyleSwitcher._WIDE_ID);
			if (existing) existing.parentNode.removeChild(existing);
		} else {
			document.documentElement.classList.add(StyleSwitcher._WIDE_ID);
			if (!existing) {
				const eleScript = document.createElement(`style`);
				eleScript.id = StyleSwitcher._WIDE_ID;
				eleScript.innerHTML = `
				/* region Book/Adventure pages */
				@media only screen and (min-width: 1600px) {
					#listcontainer.book-contents {
						position: relative;
					}

					.book-contents .contents {
						position: sticky;
					}
				}
				/* endregion */

				/* region Overwrite Bootstrap containers */
				@media (min-width: 768px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 992px) {
					.container {
						width: 100%;
					}
				}

				@media (min-width: 1200px) {
					.container {
						width: 100%;
					}
				}
				/* endregion */`;
				document.documentElement.appendChild(eleScript);
			}
		}
		StyleSwitcher.storage.setItem(StyleSwitcher._STORAGE_KEY_WIDE, isActive);
	}
	// endregion

	/* -------------------------------------------- */

	static syncGetStorageDump () {
		return Object.fromEntries(
			this._STORAGE_KEYS
				.map(storageKey => [storageKey, this.storage.getItem(storageKey)]),
		);
	}

	static syncSetFromStorageDump (dump) {
		if (!dump) return;
		this._STORAGE_KEYS
			.filter(storageKey => storageKey in dump)
			.forEach(storageKey => this.storage.setItem(storageKey, dump[storageKey]));
	}
}

try {
	StyleSwitcher.storage = window.localStorage;
} catch (e) { // cookies are disabled
	StyleSwitcher.storage = {
		getItem (k) {
			switch (k) {
				case StyleSwitcher._STORAGE_KEY_THEME: return StyleSwitcher._STYLE_THEME_AUTOMATIC;
				case StyleSwitcher._STORAGE_KEY_ROLLBOX: return StyleSwitcher._STYLE_ROLLBOX_DEFAULT;
				case StyleSwitcher._STORAGE_KEY_WIDE: return false;
			}
			return null;
		},

		setItem (k, v) {},
	};
}

const styleSwitcher = new StyleSwitcher();
globalThis.styleSwitcher = styleSwitcher;

const settingsGroupStyleSwitcher = new ConfigSettingsGroup({
	groupId: "styleSwitcher",
	name: "Appearance",
	configSettings: [
		new (
			class extends ConfigSettingExternal {
				_configId = "theme";
				_name = "Theme";
				_help = "The color theme to be applied.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getSelStyle(); }
			}
		)(),
		new ConfigSettingEnum({
			configId: "style",
			name: `<span>Style <span class="ve-small">(see also: <a href="https://2014.5e.tools" rel="noopener noreferrer" target="_blank">2014.5e.tools</a>)</span></span>`,
			help: `The styling to be applied when rendering specific information (stat blocks, etc.). Does not affect what content is available, only how it is displayed. See also: https://2014.5e.tools.`,
			isRowLabel: true,
			isReloadRequired: true,
			default: SITE_STYLE__ONE,
			values: [
				SITE_STYLE__CLASSIC,
				SITE_STYLE__ONE,
			],
			fnDisplay: it => SITE_STYLE_DISPLAY[it] || it,
		}),
		new (
			class extends ConfigSettingExternal {
				_configId = "styleRollbox";
				_name = "Dice Roller Position";
				_help = "The position of the dice roller.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getSelRollboxPosition(); }
			}
		)(),
		new (
			class extends ConfigSettingExternal {
				_configId = "isWideMode";
				_name = "Wide Mode (Experimental)";
				_help = "This feature is unsupported. Expect bugs.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getCbWide(); }
			}
		)(),
	],
});

const settingsGroupUi = new ConfigSettingsGroup({
	groupId: "ui",
	name: "UI",
	configSettings: [
		new ConfigSettingBoolean({
			configId: "isNotifyUpdates",
			name: `Show Notification on Update`,
			help: `If a notification should be shown when a background content update completes, prompting the user to reload and/or view the changelog.`,
			isRowLabel: true,
			default: true,
		}),
	],
});

const _MARKDOWN_TAG_RENDER_MODES = {
	"convertMarkdown": "Convert to Markdown",
	"ignore": "Leave As-Is",
	"convertText": "Convert to Text",
};

const settingsGroupMarkdown = new ConfigSettingsGroup({
	groupId: "markdown",
	name: "Markdown",
	configSettings: [
		new ConfigSettingEnum({
			configId: "tagRenderMode",
			name: `Tag Handling (<code>@tag</code>)`,
			help: `The output to produce when rendering a 5etools "@tag".`,
			isRowLabel: true,
			default: "convertMarkdown",
			values: [
				"convertMarkdown",
				"ignore",
				"convertText",
			],
			fnDisplay: it => _MARKDOWN_TAG_RENDER_MODES[it] || it,
		}),
		new ConfigSettingBoolean({
			configId: "isAddColumnBreaks",
			name: `Add GM Binder Column Breaks (<code>\\\\columnbreak</code>)`,
			help: `If "\\\\columnbreak"s should be added to exported Markdown, at an approximate column breakpoint.`,
			isRowLabel: true,
			default: false,
		}),
		new ConfigSettingBoolean({
			configId: "isAddPageBreaks",
			name: `Add GM Binder Page Breaks (<code>\\\\pagebreak</code>)`,
			help: `If "\\\\pagebreak"s should be added to exported Markdown, at an approximate page breakpoint.`,
			isRowLabel: true,
			default: false,
		}),
	],
});

const SETTINGS_GROUPS = [
	settingsGroupStyleSwitcher,
	settingsGroupUi,
	settingsGroupMarkdown,
];

class VetoolsConfig {
	static _STORAGE_KEY = "config";

	static _STORAGE = StorageUtil;

	static _CONFIG = null;

	static _init () {
		if (this._CONFIG) return;

		this._CONFIG = this._STORAGE.syncGet(this._STORAGE_KEY) || {};

		SETTINGS_GROUPS
			.forEach(settingsGroup => settingsGroup.mutDefaults(this._CONFIG));

		SETTINGS_GROUPS
			.forEach(settingsGroup => settingsGroup.mutVerify(this._CONFIG));
	}

	/* -------------------------------------------- */

	static get (groupId, configId) {
		this._init();
		return this._CONFIG[groupId]?.[configId];
	}

	static set (groupId, configId, val) {
		this._init();
		((this._CONFIG ||= {})[groupId] ||= {})[configId] = val;
		this._save();
	}

	/* -------------------------------------------- */

	static _save () {
		this._STORAGE.syncSet(this._STORAGE_KEY, this._CONFIG);
	}

	static _saveThrottled = MiscUtil.throttle(this._save.bind(this), 50);

	/* -------------------------------------------- */

	static getConfigComp () {
		this._init();

		const state = {};
		Object.entries(this._CONFIG)
			.forEach(([groupId, groupTo]) => {
				Object.entries(groupTo)
					.forEach(([configId, val]) => {
						state[UtilConfigHelpers.packSettingId(groupId, configId)]	= MiscUtil.copyFast(val);
					});
			});

		const comp = BaseComponent.fromObject(state, "*");
		comp._addHookAllBase(() => {
			Object.entries(comp._state)
				.forEach(([settingId, v]) => {
					const {groupId, configId} = UtilConfigHelpers.unpackSettingId(settingId);
					MiscUtil.set(this._CONFIG, groupId, configId, v);
				});

			this._saveThrottled();
		});

		return comp;
	}
}

class _ConfigRenderState {
	wrp;
	comp;

	constructor (
		{
			wrp,
			comp,
		},
	) {
		this.wrp = wrp;
		this.comp = comp;
	}
}

class ConfigUi {
	constructor (
		{
			settingsGroups,
		},
	) {
		this._settingsGroups = settingsGroups;
	}

	render (wrp) {
		const rdState = new _ConfigRenderState({
			wrp,
			comp: VetoolsConfig.getConfigComp(),
		});

		this._settingsGroups
			.forEach((configSection, i, arr) => {
				configSection.render(rdState, {isLast: i === arr.length - 1});
			});
	}

	/* -------------------------------------------- */

	/**
	 * @param {?string[]} settingsGroupIds Subset of group IDs to display
	 */
	static show (
		{
			settingsGroupIds = null,
		} = {},
	) {
		const settingsGroups = settingsGroupIds
			? SETTINGS_GROUPS
				.filter(group => settingsGroupIds.includes(group.groupId))
			: SETTINGS_GROUPS;

		const ui = new this({
			settingsGroups,
		});

		const {eleModalInner, eleModalFooter, doClose} = UiUtil.getShowModal({
			isUncappedWidth: true,
			isUncappedHeight: true,
			title: "Preferences",
			headerType: 3,
			isHeaderBorder: true,
			overlayColor: "transparent",
			hasFooter: true,
		});

		ui.render(eleModalInner);

		const btnClose = ee`<button class="ve-btn ve-btn-default ve-btn-sm ve-ml-auto">Close</button>`
			.onn("click", () => doClose());

		ee`<div class="ve-py-1 ve-w-100 ve-flex-v-center">
			${btnClose}
		</div>`
			.appendTo(eleModalFooter);
	}
}

globalThis.VetoolsConfig = VetoolsConfig;
globalThis.ConfigUi = ConfigUi;
