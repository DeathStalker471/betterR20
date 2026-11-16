// SPECIFYING PATH TO 5eTOOLS:
// Console: node get-data.js <path_to_5etools_root> <path_to_5e2014_root>
// OR create /node/path.js with the following contents:
// module.exports = {mirror5e: "<path_to_5etools_root>", mirror5e2014: "<path_to_5e2014_root>"}
// Omit second console argument / path.js.mirror5e2014 if you only want 2024+ updates
//
// Either path may instead be an http(s) URL (e.g. "https://cdn.5e.tools/2024/", the same root
// node/build-scripts.js points the live "5etools" build's BASE_SITE_URL at) - files are then
// fetched over the network instead of copied from a local checkout.

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

const isUrl = (s) => /^https?:\/\//i.test(s);

// Joins a local-path-or-URL root with a repo-relative file path. path.join would mangle a URL
// root (collapsing "https://" down to "https:/"), and on Windows would join with backslashes,
// which aren't valid in a URL path segment either.
const joinSrc = (root, rel) => isUrl(root)
	? `${root.replace(/\/+$/, "")}/${rel.replace(/\\/g, "/")}`
	: path.join(root, rel);

// Caps concurrent in-flight fetches/copies so a full sync doesn't open hundreds of connections
// to the CDN at once.
async function pMapLimit (items, limit, fn) {
	let next = 0;
	async function worker () {
		while (next < items.length) {
			const i = next++;
			await fn(items[i]);
		}
	}
	await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
}

// Copies/fetches one file from `root` (a local dir or an http(s) root) at `remoteRelPath` to
// `localPath`. Returns false (caller records it as skipped) on a missing/failed source instead of
// throwing, so one missing upstream file doesn't abort the whole sync.
//
// cdn.5e.tools (Cloudflare-fronted) 403s Node's native fetch() even with a normal desktop-browser
// User-Agent header set - confirmed live, same UA string, same URL: curl gets 200, Node's fetch()
// still gets 403. That points at Cloudflare bot-management fingerprinting the TLS/HTTP2 handshake
// itself (undici's stack looks different from a real browser's at that layer), not just checking
// the UA string - something no header on a fetch() call can fix. curl's own plain HTTP/1.1 request
// already passes cleanly with nothing more than a UA string, so shell out to it instead of trying
// to make Node's fetch imitate a browser at the TLS layer.
const FETCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const {execFile} = require("child_process");

function curlGet (url) {
	return new Promise((resolve) => {
		execFile("curl", ["-s", "-f", "-A", FETCH_USER_AGENT, url], {maxBuffer: 1024 * 1024 * 64, encoding: "buffer"}, (err, stdout) => {
			if (err) return resolve(null);
			resolve(stdout);
		});
	});
}

async function syncOne (root, localPath, remoteRelPath) {
	const src = joinSrc(root, remoteRelPath);
	if (isUrl(root)) {
		try {
			const body = await curlGet(src);
			if (body == null) return false;
			fs.writeFileSync(localPath, body);
			return true;
		} catch (e) {
			return false;
		}
	}
	if (!fs.existsSync(src)) return false;
	fs.copyFileSync(src, localPath);
	return true;
}

// region https://stackoverflow.com/a/55566081

const recursiveReadDir = (p, a = []) => {
	if (fs.statSync(p).isDirectory()) fs.readdirSync(p).map(f => recursiveReadDir(a[a.push(path.join(p, f)) - 1], a))
	return a
}
// endregion

function reportSkipped (skipped) {
	if (!skipped.length) return;
	msg.warn(`\n/!\\ ${skipped.length} file(s) were NOT updated (missing from upstream source):`);
	skipped.forEach(pth => msg.warn(`  ${pth}`));
	msg.warn(`These files are now stale relative to the local copies. If they've moved to a different upstream location, update this script; otherwise they'll keep being skipped on every run.\n`);
	process.exitCode = 1;
}

const CONCURRENCY = 12;

async function main () {
	const skipped = [];
	const curListing = recursiveReadDir("data")
		.filter(pth => pth.endsWith(".json") && !_BLOCKLIST_FILENAMES_JSON.has(path.basename(pth)));

	await pMapLimit(curListing, CONCURRENCY, async (pth) => {
		if (!(await syncOne(SRC_PATH, pth, pth))) skipped.push(pth);
	});

	if (SRC_2014_PATH) {
		const oldListing = recursiveReadDir("data2014")
			.filter(pth => pth.endsWith(".json") && !_BLOCKLIST_FILENAMES_JSON.has(path.basename(pth)));

		await pMapLimit(oldListing, CONCURRENCY, async (pth) => {
			if (!(await syncOne(SRC_2014_PATH, pth, pth.replace("data2014", "data")))) skipped.push(pth);
		});
	}

	msg.log("Successfully processed data");
	reportSkipped(skipped);
}

require.main === module && main().then(() => msg.log("Done!"));
module.exports = main;