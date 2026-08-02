if (unsafeWindow.d20plus) {
	unsafeWindow.eval(`alert("An instance of betteR20 is already running! You may have two versions of betteR20 installed (e.g core and 5etools). Please only use one.");`);
	unsafeWindow.eval(`alert("Your game may not launch. Please only run one instance of betteR20.");`);
	throw new Error("");
}

unsafeWindow.d20plus = {};

const betteR20Base = function () {
	/* eslint-disable */
	CONSOLE_LOG = console.log;
	console.log = (...args) => {
		if (args.length === 1 && typeof args[0] === "string" && args[0].startsWith("Switch mode to ")) {
			const mode = args[0].replace("Switch mode to ", "");
			if (typeof d20plus !== "undefined" && d20plus.setMode) d20plus.setMode(mode);
		}
		CONSOLE_LOG(...args);
	};
	/* eslint-enable */
};

const D20plus = function (version) {
	d20plus.version_user = version;
	d20plus.version = B20_VERSION;

	// Window loaded
	function doBootstrap () {
		d20plus.ut.log("Waiting for enhancement suite...");

		let timeWaitedForEnhancementSuiteMs = 0;

		(function waitForEnhancementSuite () {
			let hasRunInit = false;
			if (window.d20 || window.enhancementSuiteEnabled || window.currentPlayer?.d20) {
				d20plus.ut.log("Bootstrapping...");

				// r20es will expose the d20 variable if we wait
				// this should always trigger after window.onload has fired, but track init state just in case
				(function waitForD20 () {
					if ($("#textchat").get(0) && !$(".boring-chat").get(0)) d20plus.ut.showInitMessage();
					if ((typeof window.d20 !== "undefined" || window.currentPlayer?.d20) && !$("#loading-overlay").is(":visible") && !hasRunInit) {
						hasRunInit = true;
						if (!window.d20) window.d20 = window.currentPlayer.d20;
						d20plus.Init();
					} else {
						setTimeout(waitForD20, 50);
					}
				})();

				window.d20plus = d20plus;
				d20plus.ut.log("Injection successful...");
			} else {
				if (timeWaitedForEnhancementSuiteMs > 4 * 5000) {
					alert("betteR20 may require the VTTES (R20ES) extension to be installed!\nPlease install it from https://ssstormy.github.io/roll20-enhancement-suite/\nClicking ok will take you there.");
					window.open("https://ssstormy.github.io/roll20-enhancement-suite/", "_blank");
				} else {
					timeWaitedForEnhancementSuiteMs += 100;
					setTimeout(waitForEnhancementSuite, 100);
				}
			}
		})();
	}

	(function doCheckDepsLoaded () {
		if (typeof $ !== "undefined") {
			doBootstrap();
		} else {
			setTimeout(doCheckDepsLoaded, 50);
		}
	})();
};

// if we are the topmost frame, inject
if (window.top === window.self) {
	// Bridge header.js globals into the page window so the eval'd code can access them.
	// Without this, sandboxed userscript managers (Tampermonkey, Violentmonkey) keep these
	// implicit globals in the userscript scope, invisible to unsafeWindow.eval().
	unsafeWindow.ART_HANDOUT = ART_HANDOUT;
	unsafeWindow.CONFIG_HANDOUT = CONFIG_HANDOUT;
	unsafeWindow.B20_NAME = B20_NAME;
	unsafeWindow.B20_VERSION = B20_VERSION;
	unsafeWindow.B20_REPO_URL = B20_REPO_URL;
	unsafeWindow.BASE_SITE_URL = BASE_SITE_URL;
	unsafeWindow.LINK_BASE_URL = LINK_BASE_URL;
	unsafeWindow.SITE_JS_URL = SITE_JS_URL;
	unsafeWindow.DATA_URL = DATA_URL;
	unsafeWindow.DATA_URL_MODULES = DATA_URL_MODULES;
	unsafeWindow.DATA_URL_IMG_REPO = DATA_URL_IMG_REPO;
	unsafeWindow.DATA_URL_ART_REPO = DATA_URL_ART_REPO;
	unsafeWindow.DATA_URL_PLAYLIST = DATA_URL_PLAYLIST;
	unsafeWindow.DATA_URL_COMMUNITY_MODULES = DATA_URL_COMMUNITY_MODULES;
	unsafeWindow.JSON_DATA = JSON_DATA;
	unsafeWindow.CONFIG_OPTIONS = CONFIG_OPTIONS;
	unsafeWindow.addConfigOptions = addConfigOptions;
	unsafeWindow.EXT_LIB_SCRIPTS = EXT_LIB_SCRIPTS;
	unsafeWindow.EXT_LIB_API_SCRIPTS = EXT_LIB_API_SCRIPTS;
	unsafeWindow.OBJECT_DEFINE_PROPERTY = OBJECT_DEFINE_PROPERTY;
	unsafeWindow.ACCOUNT_ORIGINAL_PERMS = ACCOUNT_ORIGINAL_PERMS;

	const strip = (str) => {
		return `${str.replace(/use strict/, "").substring(str.indexOf("\n") + 1, str.lastIndexOf("\n"))}\n`;
	};

	let stack = "function (version) {\n";
	stack += strip(betteR20Base.toString());

	for (let i = 0; i < SCRIPT_EXTENSIONS.length; ++i) {
		stack += strip(SCRIPT_EXTENSIONS[i].toString())
	}
	stack += strip(D20plus.toString());

	stack += "\n}";
	unsafeWindow.eval(`(${stack})('${GM_info.script.version}')`);
} else if (/^https:\/\/[\w-]+(\.[\w-]+)*\.roll20(preflight)?\.net$/.test(window.location.origin)) {
	// Not the top frame, but this IS the 2024 sheet's own cross-origin iframe
	// (advanced-sheets*.roll20preflight.net) - the top frame's script has zero DOM access to
	// it (browser Same-Origin Policy), and this origin has zero access to d20plus/d20.Campaign
	// in return, so this only unlocks/intercepts Roll20's native "Level Up" button (disabled
	// whenever it thinks the class/species was set manually, which is true of anything
	// imported by the top-frame script) and relays clicks back via postMessage - the receiving
	// end lives in 5etools-2024-levelup-hijack.js.
	(function () {
		const BTN_SELECTOR = "button[aria-label=\"Level Up\"]";

		// Roll20 names this iframe "iframe_<characterId>" - readable from inside via
		// window.name, the one piece of character identity this origin has access to at all.
		function getCharacterId () {
			const m = /^iframe_(.+)$/.exec(window.name || "");
			return m ? m[1] : null;
		}

		function unlock (btn) {
			if (btn.hasAttribute("disabled")) btn.removeAttribute("disabled");
		}

		function scan (root) {
			if (root.matches && root.matches(BTN_SELECTOR)) unlock(root);
			if (root.querySelectorAll) root.querySelectorAll(BTN_SELECTOR).forEach(unlock);
		}

		function rewriteTooltip (header) {
			header.textContent = "This class was imported by BetteR20 - click to add more levels to it.";
		}

		function scanTooltips (root) {
			if (root.matches && root.matches(".poly-tooltip__header")) rewriteTooltip(root);
			if (root.querySelectorAll) root.querySelectorAll(".poly-tooltip__header").forEach(rewriteTooltip);
		}

		function init () {
			if (!document.body) {
				document.addEventListener("DOMContentLoaded", init, {once: true});
				return;
			}

			scan(document.body);
			scanTooltips(document.body);

			new MutationObserver(mutations => {
				mutations.forEach(m => {
					if (m.type === "attributes" && m.target.matches && m.target.matches(BTN_SELECTOR)) {
						unlock(m.target);
					}
					(m.addedNodes || []).forEach(node => {
						if (node.nodeType !== 1) return;
						scan(node);
						scanTooltips(node);
					});
				});
			}).observe(document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["disabled"],
			});

			// Capturing-phase so this runs before Roll20's own click handler and can fully
			// suppress it (stopImmediatePropagation during capture blocks the entire
			// remaining dispatch).
			document.addEventListener("click", event => {
				const btn = event.target.closest && event.target.closest(BTN_SELECTOR);
				if (!btn) return;

				const characterId = getCharacterId();
				if (!characterId) return;

				event.preventDefault();
				event.stopImmediatePropagation();
				window.parent.postMessage({source: "betterR20-levelup-bridge", characterId}, "https://app.roll20.net");
			}, true);
		}

		init();
	})();
}
