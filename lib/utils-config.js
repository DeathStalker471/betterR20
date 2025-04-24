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

		ee`<div class="w-100">
			<h4>${this._name}</h4>
			${wrpRows}
			${isLast ? null : `<hr class="hr-3 mb-1">`}
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

		ee`<${tag} class="py-1 w-100 split-v-center" title="${this._help.qq()}">
			${this._renderLabel(rdState)}
			${this._renderUi(rdState)}
		</${tag}>`
			.appendTo(wrpRows);
	}

	_renderLabel (rdState) {
		const ptReload = this._isReloadRequired ? `<span class="ml-2 text-danger ve-small" title="Requires Refresh">‡</span>` : "";
		return `<div class="w-66 no-shrink mr-2 ve-flex-v-center">${this._name}${ptReload}</div>`;
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
	[SITE_STYLE__CLASSIC]: "Classic (2014)",
	[SITE_STYLE__ONE]: "Modern (2024)",
};

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
				_configId = "isWideMode";
				_name = "Wide Mode (Experimental)";
				_help = "This feature is unsupported. Expect bugs.";
				_isRowLabel = true;

				_getEleExternal () { return StyleSwitcher.getCbWide(); }
			}
		)(),
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
		return MiscUtil.get(this._CONFIG, groupId, configId);
	}

	static set (groupId, configId, val) {
		this._init();
		MiscUtil.set(this._CONFIG, groupId, configId, val);
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

		const {$modalInner, $modalFooter, doClose} = UiUtil.getShowModal({
			isUncappedWidth: true,
			isUncappedHeight: true,
			title: "Preferences",
			headerType: 3,
			isHeaderBorder: true,
			overlayColor: "transparent",
			hasFooter: true,
		});

		ui.render($modalInner[0]);

		const btnClose = ee`<button class="ve-btn ve-btn-default ve-btn-sm ml-auto">Close</button>`
			.onn("click", () => doClose());

		ee`<div class="py-1 w-100 ve-flex-v-center">
			${btnClose}
		</div>`
			.appendTo($modalFooter[0]);
	}
}

globalThis.VetoolsConfig = VetoolsConfig;
globalThis.ConfigUi = ConfigUi;
