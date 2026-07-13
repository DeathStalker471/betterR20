/**
 * Makes Array.prototype.filter and .map non-enumerable so 3d dice libraries
 * that iterate arrays with for-in don't pick them up and break.
 *
 * Might be removed. THere's 3d dice in Roll20 and I find it so annoying that I will never enable it.
 * Disabled (FIXME #165) pending a cleaner solution.
 * Originally in: js/base/base-util.js
 */

function initUtilFix3dDice () {

d20plus.ut.fix3dDice = () => {
	Object.defineProperty(Array.prototype, "filter", {
		enumerable: false,
		value: Array.prototype.filter,
	});

	Object.defineProperty(Array.prototype, "map", {
		enumerable: false,
		value: Array.prototype.map,
	});
};

} // end initUtilFix3dDice

SCRIPT_EXTENSIONS.push(initUtilFix3dDice);
