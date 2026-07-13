/**
 * BetterActions — right-click action panel for tokens showing attacks, saves, skills,
 * and spells pulled from the character sheet, with initiative tracker integration.
 * Entry point is initBetterActions(), disabled in both bootstraps.
 *
 * Need to check what is useful to have back and what not.
 * TODO: Test in Jumpgate; sheet attribute access and token model may have changed.
 * Originally in: js/base/base-ba.js
 */

function baseBetterActions () {
	d20plus.ba = d20plus.ba || {};

	const peopleIcon = "https://img.icons8.com/ios-glyphs/30/multicultural-people.png";
	const tabs = ["general", "stats", "skills", "attacks", "traits", "spells", "items", "animations"];
	const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
	let skills = "acrobatics,animal_handling,arcana,athletics,deception,history,insight,intimidation,investigation,medicine,nature,perception,performance,persuasion,religion,sleight_of_hand,stealth,survival";

	const buildAnimations = () => {
		Object.keys(d20plus.anim.animatorTool?._anims || {}).forEach(i => {
			d20plus.ba.tree.anims.push({
				name: d20plus.anim.animatorTool._anims[i].name
					.toSentenceCase()
					.replace("_", " "),
				action: "animation",
				spec: i,
			});
		})
	}

	const buildGroup = (name, subtree) => {
		subtree && d20plus.ba.tree.rolls.push({
			name,
			type: "head",
			items: subtree,
		});
		return subtree;
	}

	const buildAbilities = () => {
		const subtree = abilities.map(ab => {
			const id = ab.replaceAll("-", "_");
			return {
				name: i18n(id, ab.toSentenceCase()),
				type: `selector`,
				items: [{
					name: "Roll plain check",
					icon: "Check",
					action: "roll",
					spec: "ability",
					flags: ab,
				}, {
					name: "Save",
					icon: "Save",
					action: "roll",
					spec: "save",
					flags: ab,
				}],
			}
		});
		return buildGroup("Abilities", subtree);
	}

	const buildSkills = () => {
		const token = d20plus.ba.tokens.getCurrent();
		return buildGroup("Skills", skills.map(sk => {
			const id = sk.replaceAll("-", "_");
			const prof = token
				? (((!token.character.isNpc && token.get(`${id}_prof`) && token.get(`${id}_prof`) !== "0")
					|| (token.character.isNpc && token.get(`${id}_base`)))
					? "active"
					: "inactive")
				: "";
			return {
				name: i18n(id, sk.toSentenceCase().replaceAll("_", " ")),
				action: "roll",
				spec: "skill",
				type: prof,
				flags: sk,
			};
		}));
	}

	const buildSpellVariants = (spell, token) => {
		const items = [];
		const ritual = spell?._has("ritual");
		const lvl = Number(spell.lvl);
		const upcast = !isNaN(spell.lvl);
		ritual && items.push(0);
		upcast && [...Array(9 - lvl)].map((k, i) => {
			const upLvl = i + lvl + 1;
			const hasSlots = token.get("npc") || token.character.sheet.spellSlots.max(upLvl);
			hasSlots && items.push(upLvl);
		});
		return items.length ? items.join(",") : null;
	}

	const buildSpellSlots = (char, lvl) => {
		if (char.spellSlots.max(`${lvl}`)) {
			const has = Number(char.spellSlots.current(`${lvl}`)) || 0;
			const total = Number(char.spellSlots.max(`${lvl}`)) || 0;
			if (char.spellSlots.max(`${lvl}`) <= 4 && has >= 0) {
				return [...Array(total)].reduce((k, s, i) => {
					return i <= has - 1 ? `${k}⬤` : `${k}◎`;
				}, "");
			} else return `${has}/${char.spellSlots.max(`${lvl}`)}`;
		}
	}

	const buildSpells = () => {
		const subtree = [];
		const token = d20plus.ba.tokens.getCurrent();
		const shouldPrepare = ["Cleric", "Druid", "Paladin", "Wizard"].includes(token?.get("class"));
		if (!token) return false;
		for (let i = 0; i <= 9; i++) {
			const lvl = i || "cantrip";
			const spells = token.character?.sheet.getSpells(`${lvl}`);
			const items = spells.map(spell => {
				const isAttack = spell._has("atk");
				const hasVariants = (spell.spellathigherlevels
					|| spell.spellritual)
					&& i !== "cantrip";
				const variants = i !== "cantrip" ? buildSpellVariants(spell, token) : null;
				const unprepared = (!i && " ") || (spell._has("active") ? " active" : " inactive");
				return {
					name: spell._get("name"),
					type: `spellaction selector${unprepared} ${variants ? "variable" : ""}`,
					items: [{
						name: "Show description",
						icon: "🕮",
						action: "spelldescription",
						spec: spell._id,
					}, {
						name: "Cast spell",
						icon: isAttack ? "⚔" : "⚕",
						action: "cast",
						spec: spell._id,
					}].concat(variants ? {
						name: "Cast at different level",
						icon: "↪",
						action: "upcast",
						spec: spell._id,
						flags: variants,
					} : []),
				}
			});
			items.length && subtree.push({
				resource: buildSpellSlots(token.character?.sheet, lvl),
				name: !i ? "Cantrips" : `Level ${lvl}`,
				type: "head",
				items,
			});
			!items.length && token.character?.sheet.spellSlots?.max(`${lvl}`) && subtree.push({
				resource: buildSpellSlots(token.character?.sheet, lvl),
				name: `Level ${lvl}`,
				type: "head",
			})
		}
		return buildGroup("Spells", subtree);
	}

	const buildAttacks = () => {
		const token = d20plus.ba.tokens.getCurrent();

		return buildGroup("Attacks", token?.get("attacks").map(at => {
			const rangeField = at._get("range");
			const isCast = !at._has("atk");
			const isRanged = at._has("range");
			const isVersatile = !isCast && rangeField?.includes("[V]");
			const isOffhandable = !isCast && rangeField?.includes("[O]");
			const types = [
				isCast ? " cast" : "",
				isRanged ? " ranged" : "",
				isOffhandable ? " offhand" : "",
				isVersatile ? " versatile" : "",
			].join("");
			return {
				name: at._get("name"),
				type: `atkaction selector${types}`,
				items: [{
					name: "Show description",
					icon: "🕮",
					action: "attackdescription",
					spec: at._id,
				}, {
					name: "Attack",
					icon: isCast ? "⚕" : isRanged ? "➹" : isVersatile ? "🗡🖑🖑" : "🗡",
					action: "attack",
					spec: at._id,
				}].concat(isOffhandable ? {
					name: "Attack with offhand",
					icon: "⚔",
					action: "attack",
					spec: at._id,
					flags: "O",
				} : []).concat(isVersatile ? {
					name: "Attack with single hand (versatile)",
					icon: `🗡🖑`,
					action: "attack",
					spec: at._id,
					flags: "V",
				} : []),
			}
		}));
	}

	const buildTraits = () => {
		const token = d20plus.ba.tokens.getCurrent();

		return buildGroup("Attacks", token?.get("traits").map(tr => {
			const canBeUsed = tr._has("uses") || tr._has("action") || !isNaN(tr.lvl);
			const usable = canBeUsed ? "active" : "inactive";
			return {
				name: tr._get("name"),
				type: `spellaction selector ${usable}`,
				items: [{
					name: "Show description",
					icon: "🕮",
					action: "spelldescription",
					spec: tr._id,
				}].concat(canBeUsed ? {
					name: "Use trait",
					icon: "⚕",
					action: "cast",
					spec: tr._id,
				} : []),
			};
		}));
	}

	const buildItems = () => {
		const token = d20plus.ba.tokens.getCurrent();

		return buildGroup("Items", token?.get("items").map(it => {
			const equipped = it._has("active") ? "active" : "inactive";
			return {
				name: it._get("name"),
				type: `spellaction selector ${equipped}`,
				items: [{
					name: "Show description",
					icon: "🕮",
					action: "spelldescription",
					spec: it._id,
				}].concat(!it._id ? { // wrong condition
					name: "Use trait",
					icon: "⚕",
					action: "cast",
					spec: it._id,
				} : []),
			};
		}));
	}

	const addCommonRolls = () => {
		d20plus.ba.tree.rolls.push(
			{name: "Initiative", action: "roll", spec: "roll", flags: "initiative"},
			{name: "Concentration", action: "roll", spec: "roll", flags: "concentration"},
			{name: "Fall damage", action: "roll", spec: "roll", flags: "fall"},
		);
		if (!d20plus.ba.current.singleChar
			|| d20plus.ba.tokens.getCurrent()?.get("npc")) return;
		d20plus.ba.tree.rolls = d20plus.ba.tree.rolls.concat([
			{name: "Death save", action: "roll", spec: "roll", flags: "death save|10"},
			{name: "Hit dice", action: "roll", spec: "roll", flags: "hit dice"},
		]);
		return d20plus.ba.tree.rolls.filter(roll => roll.action === "roll");
	}

	const buildTag = (title, txt, close) => {
		if (txt !== undefined && txt !== "") {
			title = title.last() !== ":" && !close ? `${title}:` : title;
			return close ? `<span><b>${title}</b>&nbsp;${txt}&nbsp;<b>${close}</b></span>`
				: `<span><strong>${title}</strong>&nbsp;${txt}</span>`;
		} else return "";
	}

	const buildModsHtml = (tab) => {
		const token = d20plus.ba.tokens.get(d20plus.ba.current.singleChar?.id);
		const mods = [
			{label: "ADV", id: "advantage", title: "Toggle advantage"},
			{label: "DIS", id: "disadvantage", title: "Toggle disadvantage"},
			{label: "GM", id: "togm", title: "Send to GM only"},
			{label: "&lt;l", id: "filter", title: "Filter items", except: ["general", "stats"]},
		];
		if (token?.mods[tab].filter) d20plus.ba.$dom.lists[tab].addClass("filtered");
		else d20plus.ba.$dom.lists[tab].removeClass("filtered");
		return `<li class="mods ${tab}">${mods.reduce((res, mod) => {
			if (mod.except?.includes(tab)) return res;
			const checked = token?.mods[tab][mod.id] ? ` checked="on"` : "";
			return `${res}<label class="${mod.id}" title="${mod.title}">
				<input type="checkbox"${checked}><span>${mod.label}</span>
			</label>`;
		}, "")}</li>`;
	}

	const buildHtml = (tree, mod) => {
		tree = tree || d20plus.ba.tree.rolls;
		return tree.reduce((html, it) => {
			if (it.items) {
				if (!it.items.length) return html;
				return `${html}
				<li class="hasSub ${it.type}">
					<span${it.name?.length > 14 ? ` title="${it.name}"` : ""}>
						${it.resource ? `<i>${it.resource}</i>` : ""}${it.icon || it.name}
					</span>
					<ul class="submenu">
						${buildHtml(it.items)}
					</ul>
				</li>`;
			} else {
				const dataAttribs = `data-action="${it.action}" data-spec="${it.spec}"${it.flags ? ` data-flags="${it.flags}"` : ""}`;
				const typeAttribs = it.type ? `class="${it.type}" ` : "";
				return `${html}<li ${typeAttribs}${dataAttribs}${it.icon || it.name?.length > 15 ? ` title="${it.name || ""}"` : ""}>
					${it.resource ? `<span><i>${it.resource}</i>` : ""}
					${it.icon || it.name}${it.resource ? `</span>` : ""}
				</li>`;
			}
		}, mod ? buildModsHtml(mod) : "");
	}

	const buildStatsHtml = () => {
		const token = d20plus.ba.tokens.getCurrent();
		if (!token || !token.character?.sheet.data.stats) return;

		const baseStats = (token.get("npc") ? [
			buildTag("HP:", `${token.get("hp")}&nbsp;${buildTag("/", token.get("hp_max"), " ")}`),
			buildTag("(", token.get("hpformula"), ")"),
			"<br>",
			buildTag("AC:", token.get("ac")),
			buildTag("", token.get("actype"), ""),
			buildTag("CR:", token.get("challenge")),
			buildTag("Speed", token.get("speed")),
		] : [
			buildTag("HP:", `${token.get("hp")}&nbsp;${buildTag("/", token.get("hp_max"), " ")}`),
			buildTag("AC:", token.get("ac")),
			buildTag("PB", token.get("pb")),
			buildTag("Speed", token.get("speed")),
		]).concat([
			buildTag("Initiative", token.get("initiative_bonus")),
			buildTag("Passive Perception", token.get("passive_perception")),
		]).join(" ");

		const baseAbilities = abilities.map(a => {
			const mod = token.get(`${a}_mod`);
			return buildTag(`${a.slice(0, 3).toUpperCase()}:`, `${token.get(a) || ""}${buildTag(" (", mod, ")")}`);
		}).join(" ");
		const spellStats = token.get("spells").length ? `<li>${[
			buildTag("Caster Level", token.get(`caster_level`)),
			buildTag("Spell Save DC", token.get(`spell_save_dc`)),
			buildTag("Spell Attack Bonus", token.get(`spell_attack_bonus`)),
		].join(" ")}</li>` : "";

		const classDetails = token.get("class_display")
			?.split(" ").map(c => isNaN(c) && c ? i18n(c.toLowerCase(), c) : c)
			.join(" ") || "";

		const charDetails = token.get("npc") ? [
			buildTag("Speaks:", token.get("languages")),
			buildTag("Senses:", token.get("senses")),
			buildTag("Vulnerable to:", token.get("vulnerabilities")),
			buildTag("Resists:", token.get("resistances")),
			buildTag("Immune to:", token.get("condition_immunities")),
			buildTag("Immunities:", token.get("immunities")),
		].join(" ") : ["cp", "sp", "ep", "gp", "pp"].map(c => {
			return buildTag(`${c.toUpperCase()}:`, token.get(c) || "0");
		}).join(" ");

		return `
			<li><span>${token.get("npc") ? token.get("type") : `${token.get("race_display")}, ${classDetails}`}</span></li>
			<li>${baseStats}</li><li>${baseAbilities}</li>${spellStats}
			${charDetails ? `<li>${charDetails}</li>` : ""}
		`;
	}

	const buildBasicRollsHtml = () => {
		const stats = d20plus.ba.current.singleChar ? buildStatsHtml() : `
			<li style="width: 220px;">Group selected:</li>
			${d20plus.ba.current.charTokens?.reduce((list, t) => `${list}<li>${t.attributes.name}</li>`, "")}
		`;
		["general", "stats", "skills"].forEach((tab, i) => {
			d20plus.ba.$dom.tabs[tab].toggle(true);
		});
		d20plus.ba.$dom.infos.all.filter(":not([data-pane=animations])").html(stats);
		d20plus.ba.$dom.lists.general.html(buildHtml(addCommonRolls(), "general"));
		d20plus.ba.$dom.lists.stats.html(buildHtml(buildAbilities(), "stats"));
		d20plus.ba.$dom.lists.skills.html(buildHtml(buildSkills(), "skills"));
	}

	const buildAdvRollsHtml = () => {
		[
			{id: "attacks", callback: buildAttacks},
			{id: "traits", callback: buildTraits},
			{id: "spells", callback: buildSpells},
			{id: "items", callback: buildItems},
		].forEach(tab => {
			const list = tab.callback();
			list?.length && d20plus.ba.$dom.tabs[tab.id].toggle(true);
			d20plus.ba.$dom.lists[tab.id].html(buildHtml(list, tab.id));
			const active = d20plus.ba.$dom.lists[tab.id].find(".active").length;
			const inactive = d20plus.ba.$dom.lists[tab.id].find(".inactive").length;
			if (active && inactive) d20plus.ba.$dom.lists[tab.id].addClass("uneven");
			else d20plus.ba.$dom.lists[tab.id].removeClass("uneven");
		})
	}

	const getAmConfig = () => {
		const cfg = d20plus.cfg.getOrDefault("token", "showTokenMenu");
		d20plus.ba.enabled = cfg !== "none";
		d20plus.ba.enabledCharMenu = cfg.includes("char");
		d20plus.ba.enabledAnimation = cfg.includes("anim");
		return d20plus.ba.enabled;
	}

	const amExecute = async (action, spec, flags) => {
		const appliedTo = action !== "animation"
			? d20plus.ba.current.charTokens
			: d20plus.ba.current.imgTokens;
		appliedTo.forEach(t => {
			const b20Model = d20plus.ba.tokens.get(t.id || t._model.id);
			if (action === "animation") {
				d20plus.anim.animator.startAnimation(b20Model._object, spec);
			} else if (["spelldescription", "attackdescription"].includes(action)) {
				d20plus.ba.makeInfo({
					token: b20Model,
					action: action === "spelldescription" ? "spell" : "attack",
					id: spec,
				});
			} else {
				d20plus.ba.makeRoll({
					token: b20Model,
					action,
					id: spec,
					flags,
				});
			}
		});
	}

	const amDo = (action) => {
		const amCharId = d20plus.ba.tokens.getCurrent()?.character.id;
		if (action === "opensheet") d20plus.ba.tokens.getCurrent().character._ref.view.showDialog();
		else if (action === "openchar") void 0;
		else if (action === "findtoken") d20plus.ba.tokens.focusCurrent();
		else if (action === "close") d20plus.ba.$dom.menu.toggle(false);
		else if (action === "collapsew") d20plus.ba.$dom.menu.toggleClass("wcollapsed");
		else if (action === "expandh") d20plus.ba.$dom.menu.toggleClass("hexpanded");
		else if (action === "speakas") {
			const $speagingas = $("#speakingas");
			const [type, speakAsId] = $speagingas.val().split("|");
			if (speakAsId === amCharId) $speagingas.val(["player", d20_player_id].join("|"));
			else $speagingas.val(["character", amCharId].join("|"));
		}
	}

	const amShow = async () => {
		if (d20plus.ba.executing) return;
		d20plus.ba.tree = {rolls: [], stats: [], anims: []};
		tabs.forEach((tab, i) => {
			d20plus.ba.$dom.tabs[tab].toggle(false);
		});
		d20plus.ba.$dom.title.img.attr("src", peopleIcon);
		d20plus.ba.$dom.title.img.removeAttr("title");
		d20plus.ba.$dom.title.img.css({filter: "contrast(0.1)", cursor: "unset"});
		if (d20plus.ba.current.hasChars) {
			buildBasicRollsHtml();
			if (d20plus.ba.current.singleChar) {
				const token = d20plus.ba.tokens.getCurrent();
				if (token) {
					d20plus.ut.log("Drawing menu for", token.get("name"));
					buildAdvRollsHtml();
					d20plus.ba.$dom.title.name.text(token.get("name") || "Token");
					d20plus.ba.$dom.title.img.attr("src", token.get("image"));
					d20plus.ba.$dom.title.img.attr("title", token.get("name"));
					d20plus.ba.$dom.title.img.css({filter: "unset", cursor: "pointer"});
				}
			} else {
				d20plus.ba.$dom.title.name.text("Group");
			}
		}
		if (d20plus.ba.current.hasImages) {
			buildAnimations();
			d20plus.ba.$dom.lists.animations.html(buildHtml(d20plus.ba.tree.anims));
			if (d20plus.ba.tree.anims.length) d20plus.ba.$dom.tabs.animations.toggle(true);
		}
		d20plus.ba.$dom.menu.find(".ba-tabs li.active:visible").length
			|| d20plus.ba.$dom.menu.find(".ba-tabs li:visible").get(0)?.click();
	}

	const amEnterPortal = () => {
		const actor = d20plus.ba.current.lastSelectedToken;
		const mover = d20.engine.selected()[0]?._model;
		const token = d20plus.ba.tokens.get(actor?.id);

		d20plus.ba.current.lastSelectedToken = false;
		d20.engine.unselect();

		const adjacent = (actor
			&& Math.abs(mover.attributes.top - actor.attributes.top) <= (actor.attributes.height + mover.attributes.height / 2)
			&& Math.abs(mover.attributes.left - actor.attributes.left) <= (actor.attributes.width + mover.attributes.width / 2)
		);

		if (adjacent) {
			const receiver = d20plus.ut.getTokenById(mover.attributes.custom_portal);
			if (receiver) {
				const layer = actor.attributes.layer;
				actor.save({
					top: receiver.attributes.top,
					left: receiver.attributes.left,
					layer: is_gm ? "gmlayer" : "objects",
				});
				d20.engine.centerOnPoint(receiver.attributes.left || 0, receiver.attributes.top || 0);
				setTimeout(() => {
					// d20.engine.unselect();
					actor.save({layer});
					// token?.find();
					setTimeout(() => token?.select(), 600);
				}, 600);
			}
		}

		setTimeout(() => {
			d20.engine.unselect();
		}, 400);
	}

	const amShowPortalConnection = () => {
		const entry = d20.engine.selected()[0]?._model;
		const exit = d20plus.ut.getTokenById(entry.attributes.custom_portal);
		const author = d20.Campaign.players.models.find(p => p.id !== d20_player_id)?.id;

		if (!exit || !author) return;
		d20plus.ba.current.showingPortals = author;

		d20.engine.receiveMeasureUpdate({
			"x": entry.attributes.left,
			"y": entry.attributes.top,
			"to_x": exit.attributes.left,
			"to_y": exit.attributes.top,
			"player": author,
			"pageid": d20.Campaign.activePage()?.id,
			"currentLayer": "gmlayer",
			"waypoints": [],
			"sticky": 0,
			"flags": 0,
			"hide": false,
			"action": "line",
			"color": "#c9c9c9",
			"type": "measuring",
			"time": Number(new Date()),
		});
	};

	const amResetPortalConnection = () => {
		d20.engine.receiveEndMeasure({player: d20plus.ba.current.showingPortals});
		d20plus.ba.current.showingPortals = false;
	}

	d20plus.ba.menu = {
		refresh: () => {
			amShow();
		},
		fetchCharLegacy: (...params) => {
			prepareChar(...params);
		},
	}

	d20plus.ba.rollError = () => {
		d20plus.ut.sendHackerChat("Unrecognized error applying menu command", true);
	}

	d20plus.ba.alterHP = (alter) => {
		const barID = Number(d20plus.cfg.getOrDefault("chat", "dmgTokenBar"));
		const bar = {
			val: `bar${barID}_value`,
			link: `bar${barID}_link`,
			max: `bar${barID}_max`,
		};
		const calcHP = (token) => {
			if (!token?.get) return false;
			const current = token.get(bar.val);
			const max = token.get(bar.max);
			if (isNaN(max) || isNaN(current) || current === "") return false;
			const hp = {old: current, new: current - alter.dmg};
			if (hp.new < 0) hp.new = 0;
			if (max !== "") {
				if (hp.new > max) hp.new = max;
				if (hp.new <= -max) hp.dead = true;
				if (hp.old <= 0 && hp.new > 0) hp.alive = true;
			}
			return hp;
		}
		const playerName = d20plus.ut.getPlayerNameById(d20_player_id);
		const author = `${playerName} applied ${alter.dmg} damage`;
		const transport = {type: "automation", author};
		const targets = alter.targets;
		d20.engine.unselect();
		targets.forEach(async token => {
			if (typeof token === "string") token = d20plus.ut.getTokenById(token);
			else if (token.model) token = token.model;
			const hp = calcHP(token);
			if (!hp) return d20plus.ut.sendHackerChat("You have to select proper token bar in the settings", true);
			if (!token.currentPlayerControls()) return;
			if (alter.restore !== undefined) hp.new = alter.restore;
			const barLinked = token.get(bar.link);
			const tokenName = token.get("name");
			if (barLinked) {
				if (!token.character?.currentPlayerControls()) return;
				const charID = token.character?.id;
				const fetched = await d20plus.ut.fetchCharAttribs(token.character);
				if (fetched && charID) {
					const attrib = token.character.attribs.get(barLinked);
					const charName = token.character.get("name");
					attrib.save({current: hp.new});
					attrib.syncTokenBars();
					hp.msg = `/w "${charName}" ${tokenName} from ${hp.old} to ${hp.new} HP`;
					if (alter.restore !== undefined) hp.msg = `/w "${charName}" ${tokenName} HP back to ${hp.new}`;
				}
			} else {
				token.save({[bar.val]: hp.new});
				hp.msg = `/w gm ${tokenName} from ${hp.old} to ${hp.new} HP`;
				if (alter.restore !== undefined) hp.msg = `/w gm ${tokenName} HP back to ${hp.new}`;
			}
			if (hp.msg) {
				hp.undo = {type: "hp", dmg: alter.dmg, restore: hp.old, targets: [token.id]};
				if (alter.restore === undefined) hp.transport = Object.assign({undo: hp.undo}, transport);
				else transport.author = `${playerName} restored HP to ${alter.restore}`;
				d20.textchat.doChatInput(hp.msg, undefined, hp.transport || transport);
				if (hp.dead) d20.textchat.doChatInput(`${tokenName} is instantly dead`, undefined, transport);
				else if (hp.alive) d20.textchat.doChatInput(`${tokenName} is conscious again`, undefined, transport);
				else if (hp.new === 0) d20.textchat.doChatInput(`${tokenName} falls unconscious`, undefined, transport);
			}
		})
	}

	d20plus.ba.addTurn = (tokenId, init) => {
		const token = d20plus.ut.getTokenById(tokenId);
		const pageId = token?.collection.page.id;
		const tracker = d20.Campaign.initiativewindow;
		const actor = {_pageid: pageId, id: tokenId, pr: init, custom: ""};

		const needsOpening = !tracker.windowopen;
		needsOpening && tracker.openWindow();
		needsOpening && tracker.model.save();
		// for some reason we need to pretend the turn tracker was opened long ago (2s seems enough)
		// otherwise the tokens won't show on the list until the next token is added
		setTimeout(() => {
			let trackerIt = d20.Campaign.currentOrderArray
				.find(it => it._pageid === pageId && it.id === tokenId);
			if (!trackerIt) {
				d20.Campaign.currentOrderArray.push(actor);
				trackerIt = d20.Campaign.currentOrderArray.last();
			}
			trackerIt.pr = init;
			tracker.model.save({turnorder: JSON.stringify(d20.Campaign.currentOrderArray)});
		}, needsOpening ? 2000 : 0);
	}

	d20plus.ba.initBetterActions = () => {
		const $createMenu = $(d20plus.html.bActionsMenu);
		d20plus.ba.initCharacters();
		skills = i18n("skills-list", skills).split(",");

		d20plus.ba.$dom = {
			panel: $createMenu,
			menu: $createMenu.find(".ba-menu"),
			tabs: {all: $createMenu.find(`[data-tab]`)},
			lists: {all: $createMenu.find(`[data-list]`)},
			infos: {all: $createMenu.find(`[data-pane]`)},
			title: {name: $createMenu.find(`.ba-name`), img: $createMenu.find(`.ba-token img`)},
		};

		tabs.forEach((data, i) => {
			d20plus.ba.$dom.tabs[data] = d20plus.ba.$dom.menu.find(`[data-tab=${data}]`);
			d20plus.ba.$dom.lists[data] = d20plus.ba.$dom.menu.find(`[data-list=${data}]`);
			d20plus.ba.$dom.infos[data] = d20plus.ba.$dom.menu.find(`[data-pane=${data}]`);
		});

		d20plus.ba.$dom.r20targetingNote = $("#targetinginstructions");
		d20plus.ba.$dom.r20toolbar = $("#secondary-toolbar");
		d20plus.ba.$dom.r20tokenActions = d20plus.ba.$dom.r20toolbar.find(".mode.tokenactions");
		d20plus.ba.$dom.infos["context"] = d20plus.ba.$dom.menu.find(`[data-pane=context]`);
		$("body").append($createMenu);

		if (getAmConfig()) {
			const controlledChar = d20.Campaign
				.activePage().thegraphics.models
				.find(t => !!t.character && t.character.currentPlayerControls());
			if (controlledChar) {
				d20plus.ba.current = {
					charTokens: [controlledChar],
					imgTokens: [controlledChar],
					id: d20plus.ut.generateRowId(),
					singleChar: controlledChar,
					hasChars: true,
					hasImages: is_gm
						&& d20plus.ba.enabledAnimation
						&& Object.keys(d20plus.anim.animatorTool?._anims || {}).length,
				};
				(async () => {
					d20plus.ba.tokens.ready(controlledChar);
					// amShow();
				})();
			}
		}

		$("body").on("shape_selected", "#editor", async evt => {
			if (!getAmConfig()) return;
			const selected = d20.engine.selected();

			if (d20plus.ba.current?.showingPortals) amResetPortalConnection();

			if (selected.length === 1
				&& selected[0]._model?.attributes.custom_portal
				&& (d20plus.ba.current?.lastSelectedToken || !is_gm)) {
				amEnterPortal();
				return;
			} else if (selected.length === 1
				&& selected[0]._model?.attributes.custom_portal
				&& !d20plus.ba.current?.lastSelectedToken
				&& is_gm) {
				amShowPortalConnection();
				return;
			}

			d20plus.ba.current = {
				charTokens: selected
					.filter(it => it._model?.character)
					.map(it => it._model),
				imgTokens: selected
					.filter(it => it.type === "image"),
				id: d20plus.ut.generateRowId(),
			};
			d20plus.ba.current.singleChar = d20plus.ba.current.charTokens.length > 1
				? false
				: d20plus.ba.current.charTokens[0] || false;
			d20plus.ba.current.hasChars = d20plus.ba.enabledCharMenu
				&& d20plus.ba.current.charTokens.length > 0;
			d20plus.ba.current.hasImages = is_gm
				&& d20plus.ba.enabledAnimation
				&& d20plus.ba.current.imgTokens.length > 0
				&& Object.keys(d20plus.anim.animatorTool?._anims || {}).length;

			if (d20plus.ba.current.hasChars) {
				d20plus.ba.current.charTokens.forEach(async t => {
					const token = d20plus.ba.tokens.ready(t);
				});
			} else if (d20plus.ba.current.hasImages) {
				amShow();
			}

			d20plus.ba.current.lastSelectedToken = d20plus.ba.current.singleChar;
		}).on("nothing_selected", "#editor", evt => {
			amResetPortalConnection();
			d20plus.ba.current.lastSelectedToken = false;
		});

		$createMenu.on("click", "[data-action], [data-spec]", evt => {
			const $clicked = $(evt.currentTarget);
			const action = $clicked.data("action");
			const spec = $clicked.data("spec");
			const flags = $clicked.data("flags");
			if (spec && action) amExecute(action, spec, flags);
			// else if (action && mod) amSet(mod);
			else if (!spec && action) amDo(action);
		}).on("click", "[data-tab]", evt => {
			const $clicked = $(evt.currentTarget);
			const tab = $clicked.data("tab");
			d20plus.ba.$dom.tabs.all.removeClass("active");
			d20plus.ba.$dom.lists.all.removeClass("active");
			d20plus.ba.$dom.infos.all.removeClass("active");
			$clicked.addClass("active");
			d20plus.ba.$dom.lists[tab].addClass("active");
			d20plus.ba.$dom.infos[tab].addClass("active");
		}).on("click", ".mods label span", evt => {
			const type = $(evt.target).closest("label").attr("class");
			const tab = $(evt.target).closest("[data-list]").data("list");
			if (d20plus.ba.current.singleChar) {
				const token = d20plus.ba.tokens.get(d20plus.ba.current.singleChar?.id);
				token.mods[tab][type] = !$(evt.target).prev().prop("checked");
				if (type === "filter") {
					if (token.mods[tab][type]) d20plus.ba.$dom.lists[tab].addClass("filtered");
					else d20plus.ba.$dom.lists[tab].removeClass("filtered");
				}
			}
		}).on("click", ".page-button.large", evt => {
			d20plus.ba.$dom.menu.toggle();
		}).on("mouseover", ".spellaction, .atkaction", (evt) => {
			const $entry = $(evt.currentTarget);
			const id = $entry.find("[data-spec]").data("spec");
			const token = d20plus.ba.tokens.getCurrent();
			const ability = token.get(id);
			const name = ability._get("name");
			const description = ability._get("description")?.replaceAll("\n", "<br>");

			if (!description) {
				const tab = $entry.closest("[data-list]").data("list");
				d20plus.ba.$dom.infos.all.removeClass("active");
				d20plus.ba.$dom.infos[tab]?.addClass("active");
				return;
			}

			const html = `
				<li><strong>${name}</strong></li>
				<li style="font-size:11px;font-family:sans-serif">${description}</li>
			`;

			d20plus.ba.$dom.infos.all.removeClass("active");
			d20plus.ba.$dom.infos.context.addClass("active");
			d20plus.ba.$dom.infos.context.html(html);
		});

		$("#toolbar-collapse-handle").on("click", (evt) => {
			const barCollapsed = $(evt.currentTarget).hasClass("collapse-handle-collapsed");
			d20plus.ba.$dom.panel.toggleClass("master-toolbar-collapsed", barCollapsed);
		})
	}
}

SCRIPT_EXTENSIONS.push(baseBetterActions);
