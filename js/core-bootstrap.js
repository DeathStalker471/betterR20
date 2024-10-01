const betteR20Core = function () {
	// Page fully loaded and visible
	d20plus.Init = async () => {
		d20plus.scriptName = `betteR20-${B20_NAME} v${d20plus.version}`;
		try {
			d20plus.ut.log(`Init (v${d20plus.version})`);
			d20plus.ut.log(`Userscript (v${d20plus.version_user})`);
			d20plus.settingsHtmlHeader = `<hr><h3>betteR20-${B20_NAME} v${d20plus.version}</h3>`;

			d20plus.engine.swapTemplates();

			d20plus.ut.addAllCss();
			if (window.is_gm) d20plus.engine.enhancePageSelector();
			await d20plus.js.pAddScripts();
			await d20plus.qpi.pInitMockApi();
			await d20plus.js.pAddApiScripts();

			JqueryUtil.initEnhancements();

			if (window.is_gm) await d20plus.cfg.pLoadConfig();
			else await d20plus.cfg.pLoadPlayerConfig();

			d20plus.ut.showLoadingMessage();

			if (window.is_gm) await d20plus.art.pLoadArt();

			d20plus.engine.enhanceMarkdown();
			d20plus.engine.addProFeatures();
			d20plus.engine.enhanceMouseDown();
			d20plus.engine.enhanceMouseMove();
			d20plus.engine.enhanceStatusEffects();
			// It doesn't work with current version of roll20
			// d20plus.engine.addLineCutterTool();
			d20plus.ui.addHtmlHeader();
			d20plus.ui.addHtmlFooter();
			d20plus.art.initArtFromUrlButtons();
			if (window.is_gm) {
				d20plus.journal.addJournalCommands();
				d20plus.menu.addSelectedTokenCommands();
				d20plus.art.addCustomArtSearch();
				if (d20.engine?.canvas)
					{	
				d20plus.engine.addTokenHover();
					}
				d20plus.engine.enhanceTransmogrifier();
				d20plus.engine.removeLinkConfirmation();
				d20plus.artBrowse.initRepoBrowser();
				d20plus.ui.addQuickUiGm();
				d20plus.anim.animatorTool.init();
				// Better20 jukebox tab
				d20plus.remoteLibre.init();
				d20plus.jukeboxWidget.init();
			}
			d20plus.engine.enhancePathWidths();
			// d20plus.ut.fix3dDice(); // FIXME(165) re-enable when we have a better solution
			if (d20.engine?.canvas)
				{	
			d20plus.engine.addLayers();
				}
			d20plus.weather.addWeather();
			d20plus.engine.repairPrototypeMethods();
			d20plus.engine.disableFrameRecorder();
			d20plus.engine.fixPolygonTool();
			// d20plus.ut.fixSidebarLayout();
			d20plus.chat.enhanceChat();
			d20plus.ba.initBetterActions();

			// apply config
			if (window.is_gm) {
				d20plus.cfg.baseHandleConfigChange();
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
};

SCRIPT_EXTENSIONS.push(betteR20Core);
