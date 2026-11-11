const betteR205etools = function () {
	// Page fully loaded and visible
	d20plus.Init = async () => {
		d20plus.scriptName = `betteR20-${B20_NAME} v${d20plus.version}`;
		try {
			d20plus.ut.log(`Init (v${d20plus.version})`);
			d20plus.ut.log(`Userscript (v${d20plus.version_user})`);
			d20plus.settingsHtmlHeader = `<hr><h3>betteR20-${B20_NAME} v${d20plus.version}</h3>`;

			d20plus.engine.swapTemplates();
			d20plus.ut.addAllCss();
			if (window.is_gm) {
				d20plus.ut.log("Is GM");
				// d20plus.engine.enhancePageSelector();
				d20plus.engine.enhanceVuePageThumbnail();
				d20plus.weather.enhanceVuePageWeather();
			} else d20plus.ut.log("Not GM. Some functionality will be unavailable.");

			d20plus.setSheet();
			await d20plus.js.pAddScripts();
			await d20plus.qpi.pInitMockApi();
			await d20plus.js.pAddApiScripts();

			JqueryUtil.initEnhancements();
			d20plus.engine.patchJqote();
			await loadHomebrewMetadata();

			// Load config first so custom base URL is available
			if (window.is_gm) await d20plus.cfg.pLoadConfig();
			else await d20plus.cfg.pLoadPlayerConfig();

			d20plus.ut.showLoadingMessage();

			// Update URLs from config before loading JSON data
			d20plus.cfg5e.updateBaseSiteUrl();
			await monkeyPatch5etoolsCode();

			// Now load JSON using the configured URLs
			await d20plus.pAddJson();

			if (window.is_gm) await d20plus.art.pLoadArt();

			if (window.is_gm) await d20plus.monsters.pLoadLegGroups();

			d20plus.bindDropLocations();
			d20plus.ui.addHtmlHeader();
			d20plus.template5e.addCustomHTML();
			d20plus.ui.addHtmlFooter();
			d20plus.engine.enhanceMarkdown();
			d20plus.engine.addProFeatures();
			d20plus.art.initArtFromUrlButtons();
			if (d20plus.characterIo && d20plus.characterIo.initCharacterJsonButtons) d20plus.characterIo.initCharacterJsonButtons();
			if (window.is_gm) {
				if (d20plus.npcConverter && d20plus.npcConverter.initCharacterConverterButtons) d20plus.npcConverter.initCharacterConverterButtons();
				if (d20plus.npcLevelUp && d20plus.npcLevelUp.initJournalContextButton) d20plus.npcLevelUp.initJournalContextButton();
				d20plus.journal.addJournalCommands();
				d20plus.menu.addSelectedTokenCommands();
				d20plus.art.addCustomArtSearch();
				// d20plus.engine.addTokenHover();
				d20plus.engine.enhanceTransmogrifier();
				d20plus.engine.removeLinkConfirmation();
				d20plus.artBrowse.initRepoBrowser();
				// d20plus.ui.addQuickUiGm();
				d20plus.anim.animatorTool.init();
				// Better20 jukebox tab
				d20plus.remoteLibre.init();
				d20plus.jukeboxWidget.init();
				d20plus.turnOrder.init();
			}
			d20plus.engine.fixHandleHtmlInput();
			// d20.Campaign.pages.each(d20plus.bindGraphics);
			// d20.Campaign.activePage().collection.on("add", d20plus.bindGraphics);
			// d20plus.engine.enhanceStatusEffects();
			d20plus.engine.enhancePathWidths();
			// d20plus.ut.fix3dDice(); // FIXME(165) re-enable when we have a better solution
			// d20plus.engine.addLayers();
			d20plus.weather.addWeather();
			// d20plus.ut.fixSidebarLayout();
			d20plus.chat.enhanceChat();
			// d20plus.ba.initBetterActions();

			// Clear BrewUtil cache
			BrewUtil2._storage = new StorageUtilMemory();

			// apply config
			if (window.is_gm) {
				d20plus.cfg.baseHandleConfigChange();
				d20plus.cfg5e.handleConfigChange();
				// Initialize auto-backup system (GM only)
				d20plus.autoBackup.init();
			} else {
				d20plus.cfg.startPlayerConfigHandler();
			}

			// output welcome msg when the chat is ready
			const welcome = setInterval(() => {
				if (!d20.textchat.chatstartingup) {
					d20plus.ut.checkVersion();
					d20plus.ut.log("All systems operational");
					d20plus.ut.chatTag();
					clearInterval(welcome);
				}
			}, 500);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error(e);
			alert(`${d20plus.scriptName} failed to initialise! See the logs (CTRL-SHIFT-J) for more information.`)
		}
	};

	async function loadHomebrewMetadata () {
		d20plus.ut.log("Loading homebrew metadata");
		try {
			brewIndex = await DataUtil.brew.pLoadPropIndex();
		} catch (e) {
			d20plus.ut.error(`Failed to load homebrew index!`);
		}
	}

	async function monkeyPatch5etoolsCode () {
		IS_VTT = true; // global variable from 5etools' utils.js

		Renderer.get().setBaseUrl(LINK_BASE_URL);

		// Renderer.redirect.pInit() (vendored) fetches from the live 5e.tools site with no
		// try/catch, which is always CORS-blocked - pre-seed it so the request never fires.
		Renderer.redirect._P_LOADING_VERSION_REDIRECT_LOOKUP = Promise.resolve({});
		Renderer.redirect._VERSION_REDIRECT_LOOKUP = {};

		// _DataUtilBrewHelper.getFileUrl() (vendored) builds URLs with no encodeURIComponent,
		// breaking on homebrew filenames with semicolons/apostrophes/spaces.
		const brewHelperProto = Object.getPrototypeOf(DataUtil.brew);
		const origGetFileUrl = brewHelperProto.getFileUrl;
		brewHelperProto.getFileUrl = function (path, urlRoot) {
			const encodedPath = path.split("/").map(encodeURIComponent).join("/");
			return origGetFileUrl.call(this, encodedPath, urlRoot);
		};

		// DataUtil.pDoMetaMerge() (vendored) has no cycle detection: two homebrew sources
		// depending on each other (e.g. two books each listing the other as a dependency)
		// deadlocks it silently - its own `_merging[ident] ||= ...` cache (lib/utils.js) just
		// awaits a promise that can only resolve after itself.
		//
		// IMPORTANT: that same native cache already correctly coalesces concurrent *non*-circular
		// requests for the same ident - e.g. "Import Monsters From All Sources" fetches every
		// official bestiary file in parallel, and many books declare the same `_meta.dependencies`
		// source (confirmed live: ToA declares `dependencies: {monster: ["MM", "VGM"]}`, and GoS/
		// MoT/RoT/BGDiA/PotA/PaBTSO/WBtW/VEoR all transitively need ToA itself, for their own
		// reprinted-via-`_copy` monsters). All of those concurrent requests for the same ident are
		// meant to share the one in-flight merge, not fail. An earlier version of this guard used a
		// plain `Set` of "idents currently merging" and threw as soon as a second request for the
		// same ident came in - which fired constantly for these totally normal concurrent siblings,
		// not just true cycles, and silently dropped entire sourcebooks (ToA, HotDQ, CoS, WDH, GoS,
		// MoT, RoT, BGDiA, PotA, PaBTSO, WBtW, VEoR all confirmed affected) whenever the dependency
		// they shared lost the race. Use a timeout instead: let the native cache coalesce as
		// designed, and only treat it as circular if this specific merge genuinely never finishes
		// (real fetch+merge of one bestiary file is ~150-400ms per network logs, so 20s is already
		// a very generous margin before assuming deadlock rather than "still loading").
		const origPDoMetaMerge = DataUtil.pDoMetaMerge.bind(DataUtil);
		const CYCLE_TIMEOUT_MS = 20000;
		DataUtil.pDoMetaMerge = async function (ident, data, options) {
			const canCycle = !!(data && data._meta && (data._meta.dependencies || data._meta.includes));
			const mergePromise = origPDoMetaMerge(ident, data, options);
			if (!canCycle) return mergePromise;

			// Prevent an eventual rejection of the losing (timed-out) promise from surfacing as an
			// unhandled rejection once nothing else is awaiting it.
			mergePromise.catch(() => {});

			let timer;
			const timeout = new Promise((resolve, reject) => {
				timer = setTimeout(() => {
					const err = new Error(`Circular homebrew dependency: "${ident}" did not resolve within ${CYCLE_TIMEOUT_MS}ms - likely requires itself to already be loaded.`);
					err.isCircularHomebrewDependency = true;
					reject(err);
				}, CYCLE_TIMEOUT_MS);
			});
			try {
				return await Promise.race([mergePromise, timeout]);
			} finally {
				clearTimeout(timer);
			}
		};

		// A circular dependency is usually declared but never actually used via `_copy`, so skip
		// it with a warning instead of failing the whole import - anything that genuinely needed
		// it still surfaces its own "missing copy source" error later.
		const origPLoadByMeta = DataUtil.pLoadByMeta.bind(DataUtil);
		DataUtil.pLoadByMeta = async function (prop, source) {
			try {
				return await origPLoadByMeta(prop, source);
			} catch (e) {
				if (!e.isCircularHomebrewDependency) throw e;
				d20plus.ut.log(`Skipping "${source}" (${prop}): ${e.message}`);
				return {[prop]: []};
			}
		};
	}
};

SCRIPT_EXTENSIONS.push(betteR205etools);
