/**
 * WHAT THIS DOES:
 * When a GM holds Shift and hovers over a token, displays the token's GM Notes field
 * as a floating tooltip positioned over the canvas.
 *
 * TODO: Check if d20.engine.renderLoop still exists and is a plain replaceable function.
 * If Roll20 moved to requestAnimationFrame directly, hook _drawTokenHover via
 * d20.engine.canvas.on("after:render") instead. This feature has no Roll20 API
 * dependencies beyond renderLoop and canvas mouse events — likely easy to restore.
 *
 * Originally in: js/base/base-engine.js
 */

function initEngineTokenHover () {

// Holds the current hover state: { pt, text, id } or null when not hovering.
d20plus.engine._tokenHover = null;

// Called each render frame; removes any existing tooltip and redraws it at the
// current cursor position if _tokenHover is populated.
d20plus.engine._drawTokenHover = () => {
	$(`.Vetools-token-hover`).remove();
	if (!d20plus.engine._tokenHover || !d20plus.engine._tokenHover.text) return;

	const pt = d20plus.engine._tokenHover.pt;
	const txt = unescape(d20plus.engine._tokenHover.text);

	$(`body`).append(`<div class="Vetools-token-hover" style="top: ${pt.y * d20.engine.canvasZoom}px; left: ${pt.x * d20.engine.canvasZoom}px">${txt}</div>`);
};

// Wraps d20.engine.renderLoop to call _drawTokenHover every frame, and hooks
// canvas mouse:move to populate _tokenHover when Shift is held over a token.
d20plus.engine.addTokenHover = () => {
	// gm notes on shift-hover
	const cacheRenderLoop = d20.engine.renderLoop;
	d20.engine.renderLoop = () => {
		d20plus.engine._drawTokenHover();
		cacheRenderLoop();
	};

	// store data for the rendering function to access
	d20.engine.canvas.on("mouse:move", (data, ...others) => {
		// enable hover from GM layer -> token layer
		let hoverTarget = data.target;
		if (data.e && window.currentEditingLayer === "gmlayer") {
			const cache = window.currentEditingLayer;
			window.currentEditingLayer = "objects";
			hoverTarget = d20.engine.canvas.findTarget(data.e, null, true);
			window.currentEditingLayer = cache;
		}

		if (data.e.shiftKey && hoverTarget && hoverTarget.model) {
			d20.engine.redrawScreenNextTick();
			const gmNotes = hoverTarget.model.get("gmnotes");
			const pt = d20.engine.canvas.getPointer(data.e);
			pt.x -= d20.engine.currentCanvasOffset[0];
			pt.y -= d20.engine.currentCanvasOffset[1];
			d20plus.engine._tokenHover = {
				pt: pt,
				text: gmNotes,
				id: hoverTarget.model.id,
			};
		} else {
			if (d20plus.engine._tokenHover) d20.engine.redrawScreenNextTick();
			d20plus.engine._tokenHover = null;
		}
	})
};

} // end initEngineTokenHover

SCRIPT_EXTENSIONS.push(initEngineTokenHover);
