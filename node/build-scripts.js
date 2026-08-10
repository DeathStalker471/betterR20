const fs = require("fs");

const SCRIPT_VERSION = "1.36.1.1kf-theoctonaut-test";
const SCRIPT_REPO = "https://raw.githubusercontent.com/TheOctonaut/betterR20/theoctonaut-fix-requested-change/dist/";
const SCRIPT_NAME_PREFIX = "betteR20-theoctonaut-test";

const SCRIPT_BETA_DESCRIPTION = `This version contains following changes
1.36.1.1jj - Weather Configuration
- Added a working "Weather" tab to the Page Settings dialog, with live slider readouts
- Re-enabled the Weather rendering engine (rain/snow/fog/lightning/tint), updated to work with Roll20's current canvas engine
1.36.1.1ji - 2024 Sheet Support (First Release)
- Added drag & drop import for Spells, Items, Feats, Species/Races, and Classes directly into the new 2024 (Jumpgate) character sheet
- Convert existing OGL 2014 character sheets to the 2024 sheet format
- 2024-compatible Monster/NPC import, including monster spellcasting
- Monster fluff/bio text is now appended instead of overwritten
- Reworked token image and portrait handling for character imports
- Numerous spell mapping fixes (scaling, repeating attacks, healing, Toll the Dead, etc.)
1.36.1.1jh - Page Settings?
- Added Map Thumbnail tools (Upload / Reload Default) to Page Settings
1.36.1.1jd - Macros?
- add bulk macro button.
1.36.1.1je - Commits are real
- Merge PRs, and imporve Module Importer
1.36.1.1jg - Commits are real
- Fix drag and Drop.
1.36.1.1jga - Macros?
- add bulk macro button again.
`;

const AUTHORS_CORE = `TheGiddyLimit/Redweller`;
const AUTHORS_5ETOOLS = `5egmegaanon/astranauta/MrLabRat/TheGiddyLimit/DBAWiseMan/BDeveau/Remuz/Callador Julaan/Erogroth/Stormy/FlayedOne/Cucucc/Cee/oldewyrm/darthbeep/Mertang/Redweller/DeathStalker`;

const matchString = `
// @match        https://app.roll20.net/editor
// @match        https://app.roll20.net/editor#*
// @match        https://app.roll20.net/editor?*
// @match        https://app.roll20.net/editor/
// @match        https://app.roll20.net/editor/#*
// @match        https://app.roll20.net/editor/?*
`;

// We have to block certain analytics scripts from running. Whenever they and betteR20 are
// running, the analytics scripts manage to somehow crash the entire website.
const analyticsBlocking = `
// @grant        GM_webRequest
// @webRequest   [{"selector": { "include": "*://www.google-analytics.com/analytics.js" },  "action": "cancel"}]
// @webRequest   [{"selector": { "include": "*://cdn.userleap.com/shim.js?*" },  "action": "cancel"}]
// @webRequest   [{"selector": { "include": "*://analytics.tiktok.com/*" },  "action": "cancel"}]
`;

function getHeader (name, info) {
	return `// ==UserScript==
// @name         ${SCRIPT_NAME_PREFIX}-${name}
// @namespace    https://5e.tools/
// @license      MIT (https://opensource.org/licenses/MIT)
// @version      ${SCRIPT_VERSION}
// @homepageURL  https://github.com/TheOctonaut/betterR20/tree/theoctonaut-fix-requested-change
// @supportURL   https://github.com/TheOctonaut/betterR20/pull/2
// @updateURL    ${SCRIPT_REPO}betteR20-${name}.meta.js
// @downloadURL  ${SCRIPT_REPO}betteR20-${name}.user.js
// @description  Enhance your Roll20 experience
// @author       ${info.authors}
${matchString}
// @grant        unsafeWindow
// @run-at       document-start
${analyticsBlocking}
// ==/UserScript==
`;
}

const JS_DIR = "./js/";
const LIB_DIR = "./lib/";
const BUILD_DIR = "./dist";

function joinParts (...parts) {
	return parts.join("\n\n");
}

function getDataDirPaths (dir) {
	const walkSync = (dir, filelist = []) => {
		fs.readdirSync(dir).forEach(file => {
			filelist = fs.statSync(`${dir}/${file}`).isDirectory()
				? walkSync(`${dir}/${file}`, filelist)
				: filelist.concat(`${dir}/${file}`);
		});
		return filelist;
	}
	return walkSync(dir).filter(it => it.toLowerCase().endsWith("json"));
}

function wrapLibData (filePath, data) {
	data = JSON.stringify(JSON.parse(data));
	return `
JSON_DATA[\`${filePath}\`] = JSON.parse(${JSON.stringify(data)});
`
}

let ixLibApiScript = 0;
function wrapLibScript (script, isApiScript) {
	const name = `lib_script_${ixLibApiScript++}`;
	return `
${isApiScript ? "EXT_LIB_API_SCRIPTS" : "EXT_LIB_SCRIPTS"}.push((function ${name} () {
${script}
}).toString());
`;
}

if (!fs.existsSync(BUILD_DIR)) {
	fs.mkdirSync(BUILD_DIR);
}

const LIB_SCRIPTS = {
	core: [
		"list.min.js",
		"jszip.min.js",
		"localforage.min.js",

		"parser.js",
		"utils.js",
		"utils-ui.js",
		"hist-port.js",
	],
	"5etools": [
		"list.min.js",
		"jszip.min.js",
		"localforage.min.js",
		"pdf.worker.min.js",
		"pdf.min.js",

		"parser.js",
		"utils.js",
		"utils-config.js",
		"utils-ui.js",
		"filter.js",
		"utils-brew.js",
		"utils-dataloader.js",
		"hist-port.js",
		"render.js",
		"render-dice.js",
		"scalecreature.js",
	],
};

const LIB_SCRIPTS_API = {
	core: [
		"VecMath.js",
		"matrixMath.js",
		"PathMath.js",
	],
	"5etools": [
		"VecMath.js",
		"matrixMath.js",
		"PathMath.js",
	],
};

const SCRIPTS = {
	core: [
		"base-util",
		"base-jsload",
		"base-qpi",
		"base-jukebox",
		"base-math",
		"base-config",
		"base-tool",
		"base-tool-module",
		"base-tool-autobackup",
		"base-tool-unlock",
		"base-tool-animator",
		"base-tool-dlimport",
		"base-tool-urlfix",
		"base-art",
		"base-art-browse",
		"overwrites/base",
		"overwrites/canvas-handler",
		"templates/template-roll20-token-editor",
		"templates/template-roll20-page-settings",
		"templates/template-roll20-actions-menu",
		"templates/template-roll20-editors-misc",
		"templates/template-base-misc",
		"templates/template-page-weather",
		"templates/template-roll20-page-lighting",
		"base-engine",
		"base-menu",
		"base-weather",
		"base-journal",
		"base-css",
		"base-ui",
		"base-mod",
		"base-macro",
		"base-chat-languages",
		"base-chat-emoji",
		"base-chat",
		"base-ba-character",
		"base-ba-rolltemplates",
		"base-character-io",
		"base-ba",
		"base-remote-libre",
		"base-jukebox-widget",

		"core-bootstrap",

		"base",
	],
	"5etools": [
		"base-util",
		"base-jsload",
		"base-qpi",
		"base-jukebox",
		"base-math",
		"base-config",
		"base-tool",
		"base-tool-module",
		"base-tool-autobackup",
		"base-tool-unlock",
		"base-tool-animator",
		"base-tool-table",
		"base-tool-dlimport",
		"base-tool-urlfix",
		"base-art",
		"base-art-browse",
		"overwrites/base",
		"overwrites/canvas-handler",
		"templates/template-roll20-token-editor",
		"templates/template-roll20-page-settings",
		"templates/template-roll20-actions-menu",
		"templates/template-roll20-editors-misc",
		"templates/template-base-misc",
		"templates/template-page-weather",
		"templates/template-roll20-page-lighting",
		"base-engine",
		"base-menu",
		"base-weather",
		"base-journal",
		"base-css",
		"base-ui",
		"base-mod",
		"base-macro",
		"base-chat-languages",
		"base-chat-emoji",
		"base-chat",
		"base-ba-character",
		"base-ba-rolltemplates",
		"base-character-io",
		"base-ba",
		"base-remote-libre",
		"base-jukebox-widget",

		"5etools-bootstrap",
		"5etools-config",
		"5etools-main",
		"5etools-importer",
		"5etools-monsters",
		"5etools-2024-store",
		"5etools-2024-import",
		"5etools-npc-converter",
		"5etools-npc-sidekick-data",
		"5etools-npc-level-up",
		"5etools-spells",
		"5etools-backgrounds",
		"5etools-classes",
		"5etools-items",
		"5etools-feats",
		"5etools-objects",
		"5etools-tool",
		"5etools-races",
		"5etools-psionics",
		"5etools-optional-features",
		"5etools-adventures",
		"5etools-deities",
		"5etools-vehicles",
		"5etools-template",
		"5etools-css",

		"base",
	],
	"5et2014": [
		"base-util",
		"base-jsload",
		"base-qpi",
		"base-jukebox",
		"base-math",
		"base-config",
		"base-tool",
		"base-tool-module",
		"base-tool-autobackup",
		"base-tool-unlock",
		"base-tool-animator",
		"base-tool-table",
		"base-tool-dlimport",
		"base-tool-urlfix",
		"base-art",
		"base-art-browse",
		"overwrites/base",
		"overwrites/canvas-handler",
		"templates/template-roll20-token-editor",
		"templates/template-roll20-page-settings",
		"templates/template-roll20-actions-menu",
		"templates/template-roll20-editors-misc",
		"templates/template-base-misc",
		"templates/template-page-weather",
		"templates/template-roll20-page-lighting",
		"base-engine",
		"base-menu",
		"base-weather",
		"base-journal",
		"base-css",
		"base-ui",
		"base-mod",
		"base-macro",
		"base-chat-languages",
		"base-chat-emoji",
		"base-chat",
		"base-ba-character",
		"base-ba-rolltemplates",
		"base-ba",
		"base-remote-libre",
		"base-jukebox-widget",

		"5etools-bootstrap",
		"5etools-config",
		"5etools-main",
		"5etools-importer",
		"5etools-monsters",
		"5etools-2024-store",
		"5etools-2024-import",
		"5etools-npc-converter",
		"5etools-npc-sidekick-data",
		"5etools-npc-level-up",
		"5etools-spells",
		"5etools-backgrounds",
		"5etools-classes",
		"5etools-items",
		"5etools-feats",
		"5etools-objects",
		"5etools-tool",
		"5etools-races",
		"5etools-psionics",
		"5etools-optional-features",
		"5etools-adventures",
		"5etools-deities",
		"5etools-vehicles",
		"5etools-template",
		"5etools-css",

		"base",
	],
};

const BUILDS = {
	core: {
		authors: AUTHORS_CORE,
		baseURL: "https://5e.tools/",
		imgURL: "",
		libs: LIB_SCRIPTS.core,
		libsAPI: LIB_SCRIPTS_API.core,
		scripts: SCRIPTS.core,
		dataJSON: [],
	},
	"5etools": {
		authors: AUTHORS_5ETOOLS,
		baseURL: "https://cdn.5e.tools/2024/",
		imgURL: "https://cdn.5e.tools/2024/img/",
		libs: LIB_SCRIPTS["5etools"],
		libsAPI: LIB_SCRIPTS_API["5etools"],
		scripts: SCRIPTS["5etools"],
		dataJSON: getDataDirPaths("data"),
	},
	"5et2014": {
		authors: AUTHORS_5ETOOLS,
		baseURL: "https://cdn.5e.tools/2014/",
		imgURL: "https://cdn.5e.tools/2014/img/",
		libs: LIB_SCRIPTS["5etools"],
		libsAPI: LIB_SCRIPTS_API["5etools"],
		scripts: SCRIPTS["5et2014"],
		dataJSON: getDataDirPaths("data2014"),
	},
}

Object.entries(BUILDS).forEach(([name, data]) => {
	const libScripts = data.libs;
	const libScriptsApi = data.libsAPI;
	const libJson = data.dataJSON;
	const header = getHeader(name, data);

	const filename = `${BUILD_DIR}/betteR20-${name}.user.js`;
	const metaFilename = `${BUILD_DIR}/betteR20-${name}.meta.js`;
	const fullScript = joinParts(
		header,
		fs.readFileSync(`${JS_DIR}header.js`, "utf-8").toString()
			.replace("%B20_NAME%", name)
			.replace("%B20_VERSION%", SCRIPT_VERSION)
			.replace("%B20_BASE_URL%", data.baseURL)
			.replace("%B20_IMG_URL%", data.imgURL)
			.replace("%B20_REPO_URL%", SCRIPT_REPO),
		...libJson.map(filePath => wrapLibData(filePath.replace("data2014", "data"), fs.readFileSync(filePath, "utf-8"))),
		...data.scripts.map(filename => filename === "base-util"
			? fs.readFileSync(`${JS_DIR}${filename}.js`, "utf-8").toString().replace("}, 6000);", `
			d20plus.ut.sendHackerChat(\`
				<div class="userscript-b20intro">
					<h1 style="display: inline-block;line-height: 25px;margin-top: 5px; font-size: 22px;">
						Notes on b20 beta
						<p style="font-size: 11px;line-height: 15px;color: rgb(32, 194, 14);">
							<span style="color: rgb(194, 32, 14)">You are using preview version of betteR20</span><br>
							Please read this carefully and give feedback in official betteR20 Discord server,
							in<span style="color: orange; font-family: monospace"> 5etools &gt; better20 &gt; #testing </span>thread
						</p>
					</h1>
					<p>${SCRIPT_BETA_DESCRIPTION.replaceAll("\n", "<br>").replace(/--([^<^>^-]*?)<br>/g, "<code>--$1</code><br>")}</p>
				</div>
			\`);
			}, 6000);`)
			: fs.readFileSync(`${JS_DIR}${filename}.js`, "utf-8").toString()),
		...libScripts.map(filename => wrapLibScript(fs.readFileSync(`${LIB_DIR}${filename}`, "utf-8").toString())),
		...libScriptsApi.map(filename => wrapLibScript(fs.readFileSync(`${LIB_DIR}${filename}`, "utf-8").toString(), true)),
	);
	fs.writeFileSync(filename, fullScript);
	fs.writeFileSync(metaFilename, header);
});

fs.writeFileSync(`${BUILD_DIR}/betteR20-version`, `${SCRIPT_VERSION}`);

// eslint-disable-next-line no-console
console.log(`v${SCRIPT_VERSION}: Build completed at ${(new Date()).toJSON().slice(11, 19)}`);
