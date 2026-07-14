// SPECIFYING PATH TO 5eTOOLS:
// Console: node get-libs.js <path_to_5etools_root>
// OR create /node/path.js with the following contents:
// module.exports = {mirror5e: "<path_to_5etools_root>"}

const process = require("process");
const fs = require("fs");
const path = require("path");
const rollup = require("rollup").rollup;
const msg = console;

const pathFromFile = fs.existsSync("node/path.js") && require("./path.js");
const pathFromArg = process.argv[2];
const SRC_PATH = pathFromFile?.mirror5e || pathFromArg;

if (!SRC_PATH) {
	msg.error(`We need the path to 5etools data to work`);
	process.exit(1);
}

const _LIBS = new Set([
	"parser.js",
	"render.js",
	"render-dice.js",
	"scalecreature.js",
	"filter.js",
	"utils.js",
	"utils-ui.js",
	"utils-brew.js",
	"utils-config.js",
	"utils-dataloader.js",
]);

// `Renderer.get().baseUrl` is a singleton shared with rendered-link generation, which our
// importer code repeatedly points at `LINK_BASE_URL` ("https://5e.tools/") so handout links
// open a real page instead of the raw CDN. That leaks into these vendor call sites, which use
// the same property purely to fetch JSON data and need the CDN base (`DATA_URL`) regardless of
// what the link renderer is currently pointed at. Patched here (instead of by hand in the
// generated lib/ file) so it survives re-running this script against a newer 5etools checkout.
const _PATCHES = {
	"utils.js": [
		{
			find: "this._P_INDEX = this._P_INDEX || DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${this._DIR}/${this._isFluff ? `fluff-` : \"\"}index.json`);",
			replace: "this._P_INDEX = this._P_INDEX || DataUtil.loadJSON(`${DATA_URL}${this._DIR}/${this._isFluff ? `fluff-` : \"\"}index.json`);",
		},
		{
			find: "let data = await fnLoad(`${Renderer.get().baseUrl}data/${this._DIR}/${file}`);",
			replace: "let data = await fnLoad(`${DATA_URL}${this._DIR}/${file}`);",
		},
		{
			find: "this._SPELL_SOURCE_LOOKUP = await DataUtil.loadRawJSON(`${Renderer.get().baseUrl}data/generated/gendata-spell-source-lookup.json`);",
			replace: "this._SPELL_SOURCE_LOOKUP = await DataUtil.loadRawJSON(`${DATA_URL}generated/gendata-spell-source-lookup.json`);",
		},
	],
};

function applyPatches (name, code) {
	const patches = _PATCHES[name];
	if (!patches) return code;
	for (const {find, replace} of patches) {
		if (!code.includes(find)) {
			throw new Error(`Patch failed for "${name}": expected text not found. Upstream source has likely changed - review and update the patch in node/get-libs.js.\nExpected:\n${find}`);
		}
		code = code.split(find).join(replace);
	}
	return code;
}

async function build (input, output, name) {
	const bundle = await rollup({
		input,
		onLog: (lvl, log, handler) => log.code !== "EVAL" && handler(lvl, log),
	});

	const {output: [{code}]} = await bundle.generate({
		format: "es",
		inlineDynamicImports: true, // Add this line to fix the error
	});

	fs.writeFileSync(output, applyPatches(name, code));
}

async function main () {
	const siteJsRoot = path.join(SRC_PATH, "js");
	const files = fs.readdirSync(siteJsRoot);

	for (const name of files) {
		if (!_LIBS.has(name)) continue;

		const src = path.join(siteJsRoot, name);
		const bundle = path.join("lib", name);
		await build(src, bundle, name);
	}

	msg.log("Successfully processed libs");
}

require.main === module && main().then(() => msg.log("Done!"));
module.exports = main;
