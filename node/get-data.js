// SPECIFYING PATH TO 5eTOOLS:
// Console: node get-data.js <path_to_5etools_root> <path_to_5e2014_root>
// OR create /node/path.js with the following contents:
// module.exports = {mirror5e: "<path_to_5etools_root>", mirror5e2014: "<path_to_5e2014_root>"}
// Omit second console argument / path.js.mirror5e2014 if you only want 2024+ updates

const process = require("process");
const fs = require("fs");
const path = require("path");
const msg = console;

const pathFromFile = fs.existsSync("node/path.js") && require("./path.js");
const pathFromArg = process.argv[2];
const path2014FromArg = process.argv[3];
const SRC_PATH = pathFromFile.mirror5e || pathFromArg;
const SRC_2014_PATH = pathFromFile.mirror5e2014 || path2014FromArg;

if (!SRC_PATH) {
	msg.error(`We need the path to 5etools data to work`);
	process.exit(1);
}

const _BLOCKLIST_FILENAMES_JSON = new Set([
	"changelog.json",
	"roll20-items.json",
	"roll20-tables.json",
	"roll20.json",
]);

// region https://stackoverflow.com/a/55566081

const recursiveReadDir = (p, a = []) => {
	if (fs.statSync(p).isDirectory()) fs.readdirSync(p).map(f => recursiveReadDir(a[a.push(path.join(p, f)) - 1], a))
	return a
}
// endregion

async function main () {
	const curListing = recursiveReadDir("data");

	for (const pth of curListing) {
		if (!pth.endsWith(".json")) continue;
		if (_BLOCKLIST_FILENAMES_JSON.has(path.basename(pth))) continue;
		const pathSiteDir = path.join(SRC_PATH, pth);
		if (!fs.existsSync(pathSiteDir)) {
			msg.warn(`File ${pth} does not exist in 5etools data! Skipping.`);
			continue;
		}
		fs.copyFileSync(pathSiteDir, pth);
	}

	if (!SRC_2014_PATH) return;
	const oldListing = recursiveReadDir("data2014");

	for (const pth of oldListing) {
		if (!pth.endsWith(".json")) continue;
		if (_BLOCKLIST_FILENAMES_JSON.has(path.basename(pth))) continue;
		const pathSiteDir = path.join(SRC_2014_PATH, pth.replace("data2014", "data"));
		if (!fs.existsSync(pathSiteDir)) {
			msg.warn(`File ${pth} does not exist in 5etools data! Skipping.`);
			continue;
		}
		fs.copyFileSync(pathSiteDir, pth);
	}

	msg.log("Successfully processed data");
}

require.main === module && main().then(() => msg.log("Done!"));
module.exports = main;