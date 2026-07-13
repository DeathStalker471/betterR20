/**
 * Auto-fills token bar values (HP, etc.) when a token is dropped onto any page.
 * Reads bar config from betterR20 settings and character sheet attributes; also
 * rolls or maximises NPC HP if configured.
 * Disabled in 5etools-bootstrap; unknown if page.thegraphics / page.fullyLoadPage()
 * still exist in Jumpgate.
 * TODO: Check those two APIs in a Jumpgate session before restoring.
 * Originally in: js/5etools/5etools-main.js
 */

function initBindGraphics () {

d20plus.bindGraphics = function (page) {
	d20plus.ut.log("Bind Graphics");
	try {
		if (page.get("archived") === false) {
			// Roll20 creates thegraphics and similar variables on page load, not page creation
			if (!page.thegraphics) {
				page.fullyLoadPage();
			}
			// #TODO Convert callback to async and load attribs if absent
			// Otherwise it won't add HP etc stats to new tokens, if sheet wasn't opened
			page.thegraphics.on("add", function (e) {
				let character = e.character;
				if (character) {
					let npc = character.attribs.find(function (a) {
						return a.get("name").toLowerCase() === "npc";
					});
					let isNPC = npc ? parseInt(npc.get("current")) : 0;
					// Set bars if configured to do so
					let barsList = ["bar1", "bar2", "bar3"];
					$.each(barsList, (i, barName) => {
						// PC config keys are suffixed "_pc"
						const confVal = d20plus.cfg.get("token", `${barName}${isNPC ? "" : "_pc"}`);
						if (confVal) {
							const charAttr = character.attribs.find(a => a.get("name").toLowerCase() === confVal);
							if (charAttr) {
								e.attributes[`${barName}_value`] = charAttr.get("current");
								if (d20plus.cfg.has("token", `${barName}_max`)) {
									if (d20plus.cfg.get("token", `${barName}_max`) && !isNPC && confVal === "hp") { // player HP is current; need to set max to max
										e.attributes[`${barName}_max`] = charAttr.get("max");
									} else {
										if (isNPC) {
											// TODO: Setting a value to empty/null does not overwrite existing values on the token.
											// setting a specific value does. Must figure this out.
											e.attributes[`${barName}_max`] = d20plus.cfg.get("token", `${barName}_max`) ? charAttr.get("current") : "";
										} else {
											// preserve default token for player tokens
											if (d20plus.cfg.get("token", `${barName}_max`)) {
												e.attributes[`${barName}_max`] = charAttr.get("current");
											}
										}
									}
								}
								if (d20plus.cfg.has("token", `${barName}_reveal`)) {
									e.attributes[`showplayers_${barName}`] = d20plus.cfg.get("token", `${barName}_reveal`);
								}
							}
						}
					});

					// NPC-only settings
					if (isNPC) {
						// Set Nametag
						if (d20plus.cfg.has("token", "name")) {
							e.attributes["showname"] = d20plus.cfg.get("token", "name");
							if (d20plus.cfg.has("token", "name_reveal")) {
								e.attributes["showplayers_name"] = d20plus.cfg.get("token", "name_reveal");
							}
						}

						// Roll HP
						// TODO: npc_hpbase appears to be hardcoded here? Refactor for NPC_SHEET_ATTRIBUTES?
						if ((d20plus.cfg.get("token", "rollHP") || d20plus.cfg.get("token", "maximiseHp")) && d20plus.cfg.getCfgKey("token", "npc_hpbase")) {
							let hpf = character.attribs.find(function (a) {
								return a.get("name").toLowerCase() === NPC_SHEET_ATTRIBUTES["npc_hpformula"][d20plus.sheet];
							});
							let barName = d20plus.cfg.getCfgKey("token", "npc_hpbase");

							if (hpf && hpf.get("current")) {
								let hpformula = hpf.get("current");
								if (d20plus.cfg.get("token", "maximiseHp")) {
									const maxSum = hpformula.replace("d", "*");
									try {
										// eslint-disable-next-line no-eval
										const max = eval(maxSum);
										if (!isNaN(max)) {
											e.attributes[`${barName}_value`] = max;
											e.attributes[`${barName}_max`] = max;
										}
									} catch (error) {
										d20plus.ut.log("Error Maximising HP");
										// eslint-disable-next-line no-console
										console.log(error);
									}
								} else {
									d20plus.ut.randomRoll(hpformula, function (result) {
										e.attributes[`${barName}_value`] = result.total;
										e.attributes[`${barName}_max`] = result.total;
										d20plus.ut.log(`Rolled HP for [${character.get("name")}]`);
									}, function (error) {
										d20plus.ut.log("Error Rolling HP Dice");
										// eslint-disable-next-line no-console
										console.log(error);
									});
								}
							}
						}
					}
				}
			});
		}
	} catch (e) {
		// eslint-disable-next-line no-console
		console.log("D20Plus bindGraphics Exception", e);
		// eslint-disable-next-line no-console
		console.log("PAGE", page);
	}
};

} // end initBindGraphics

SCRIPT_EXTENSIONS.push(initBindGraphics);
