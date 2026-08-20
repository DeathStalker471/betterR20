function d20plus2024LevelUpHijack() {
	// Test harness loads this file's body in a plain Node VM with no DOM at all - everything
	// here is browser-only setup, so no-op there instead of throwing.
	if (typeof document === "undefined") return;

	// The native "Level Up" button lives inside the 2024 sheet's cross-origin iframe
	// (advanced-sheets*.roll20preflight.net), which this top-frame script has zero DOM access
	// to (browser Same-Origin Policy) - js/base/base.js's non-top-frame branch runs directly in
	// that iframe's own origin instead (this same userscript also matches that URL), unlocking
	// the button there and posting the character ID back here, since that context has no
	// access to d20plus/d20.Campaign/character data of its own.
	const ALLOWED_ORIGIN_RE = /^https:\/\/[\w-]+(\.[\w-]+)*\.roll20(preflight)?\.net$/;
	window.addEventListener("message", event => {
		if (!ALLOWED_ORIGIN_RE.test(event.origin)) return;
		if (!event.data || event.data.source !== "betterR20-levelup-bridge" || !event.data.characterId) return;

		const charModel = d20.Campaign.characters.get(event.data.characterId);
		if (!charModel) return;

		// Leave characters we never touched alone - import2024ClassLevelUp itself already
		// checks for cached class data and alerts if there's nothing to work from.
		d20plus.importer.import2024ClassLevelUp(charModel);
	});
}
SCRIPT_EXTENSIONS.push(d20plus2024LevelUpHijack);
