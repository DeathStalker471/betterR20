function baseTurnOrder () {
	d20plus.turnOrder = {};

	// Must not touch d20.Campaign here - this function body runs as part of the early
	// SCRIPT_EXTENSIONS splice (see base.js), before doBootstrap's waitForD20 has confirmed
	// window.d20 even exists yet. d20plus.turnOrder.init (below) only gets called once d20plus.Init
	// itself runs (5etools-bootstrap.js / core-bootstrap.js), which is guaranteed to be after that.
	d20plus.turnOrder.init = function () {
		// VTTES (the roll20-enhancement-suite extension) ships its own "AutoOpenInitiativeTracker"
		// module that does the exact same thing (listens for the Campaign's turn order to change,
		// then opens the tracker window). Running both at once would fire two toggles for the same
		// change and flip the window straight back closed, so defer to VTTES's own copy when it's
		// present - same detection heuristic d20plus.ut.chatTag already uses for its "VTTES ...
		// detected" banner.
		const isVttesPresent = () => !!window.r20es?.hooks?.welcomeScreen?.config?.previousVersion;

		// Confirmed live: &{tracker} (used by both our own Initiative macros and Roll20's native
		// ones) only writes the Campaign's "turnorder" attribute - it never opens the tracker
		// window itself, so a GM who hasn't already opened it manually sees no feedback at all
		// when Initiative is rolled. d20.Campaign.initiativewindow.toggleWindow() is the real
		// open/close lever (confirmed live against its own "isOpen" flag); only call it when
		// currently closed, since calling it while already open would close it again instead.
		d20.Campaign.on("change:turnorder", () => {
			if (isVttesPresent()) return;
			if (!d20plus.cfg.getOrDefault("interface", "autoOpenInitiativeTracker")) return;
			const initiativeWindow = d20.Campaign.initiativewindow;
			if (!initiativeWindow || initiativeWindow.isOpen) return;
			initiativeWindow.toggleWindow();
		});
	};
}
SCRIPT_EXTENSIONS.push(baseTurnOrder);
