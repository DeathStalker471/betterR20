const fs = require("fs");

// Loads a browser SCRIPTS file (the `function X () { ...; d20plus.NS = {...}; }
// SCRIPT_EXTENSIONS.push(X);` convention used throughout js/) directly from source - no
// `npm run build` required. In the browser, `SCRIPT_EXTENSIONS.push(X)` only *stores* the function
// reference; js/base/base.js later `.toString()`s it, strips the outer wrapper, and eval's the
// body for real. Here we do the equivalent directly: extract the wrapper function's own body (the
// text between its opening brace and the matching closing brace that appears right before the
// `SCRIPT_EXTENSIONS.push(...)` line), then actually invoke it with a stub `d20plus` bound, since
// nothing else will call it for us outside the browser. Returns the resulting `d20plus[namespace]`.
module.exports = function requireD20Module (absoluteJsPath, namespace) {
	const raw = fs.readFileSync(absoluteJsPath, "utf8");
	// Find the wrapper function's declaration directly (rather than assuming it's the file's
	// first line, which only holds for a function's own `.toString()` output - a real source
	// file has leading header comments first).
	const fnMatch = raw.match(/function \w+\s*\(\)\s*\{/);
	if (!fnMatch) throw new Error(`${absoluteJsPath}: no top-level wrapper function found`);
	const bodyStart = fnMatch.index + fnMatch[0].length;
	// lastIndexOf, not indexOf: the real push call is always the final line in the file, and
	// comments elsewhere in the file may mention the string "SCRIPT_EXTENSIONS.push(" in prose.
	const pushIdx = raw.lastIndexOf("SCRIPT_EXTENSIONS.push(");
	if (pushIdx === -1) throw new Error(`${absoluteJsPath}: no SCRIPT_EXTENSIONS.push(...) found`);
	const wrapperCloseIdx = raw.lastIndexOf("}", pushIdx);
	const body = raw.slice(bodyStart, wrapperCloseIdx);
	const stubD20plus = {};
	const fn = new Function("d20plus", body);
	fn(stubD20plus);
	if (!stubD20plus[namespace]) throw new Error(`${absoluteJsPath}: d20plus.${namespace} was not set`);
	return stubD20plus[namespace];
};
