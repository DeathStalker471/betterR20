/**
 * BetterActions roll templates — HTML and Roll20 macro strings for attacks, saves,
 * skills, and spells displayed in the BA panel.
 * Originally in: js/base/base-ba-rolltemplates.js
 */

function baseBARollTemplates () {
	d20plus.ba = d20plus.ba || {};

	const targetTag = `@{target|token_id}`;
	const targetName = `@{target|token_name}`;
	const normalizeStyle = `color: inherit;text-decoration: none;cursor: auto;`;

	const getRollMode = () => {
		const adv = d20plus.ba.$dom.menu.find(".ba-list .mods:visible .advantage input").prop("checked");
		const dis = d20plus.ba.$dom.menu.find(".ba-list .mods:visible .disadvantage input").prop("checked");
		return adv ? "advantage" : dis ? "disadvantage" : "normal";
	}

	const getWMode = () => {
		const togm = d20plus.ba.$dom.menu.find(".ba-list .mods:visible .togm input").prop("checked");
		return togm ? "/w gm " : "";
	}

	const getTemplatePart = ([tag, val, props], subtree) => {
		if ((!tag && !subtree) || props === false || props?.q === false) return "";
		if (Array.isArray(val)) val = val.reduce((s, v) => s + getTemplatePart([null].concat(v), true), "");
		else val = props?.css ? `[${val || " "}]("style="${normalizeStyle}${props.css}")` : val;
		const left = props?.left || (props?.lcss ? `[ ]("style="${props?.lcss}")` : "");
		const right = props?.right || (props?.rcss ? `[ ]("style="${props?.rcss}")` : "");
		return `${tag ? `${tag}=` : ""}${left}${val}${right}`;
	}

	const getTemplateVar = (v) => {
		if (v.q === false || (!v.tag && !v.isSubStr) || (!v.val && v.q === undefined)) return "";
		if (Array.isArray(v.val)) {
			const getSubVal = (s, v) => s + getTemplateVar(Object.assign(v, {isSubStr: true}));
			const subVal = v.val.reduce(getSubVal, "");
			v.val = v.css ? `[${subVal}]("style="${normalizeStyle}${v.css}")` : subVal;
		} else {
			if (v.css) v.val = (v.val || " ").replaceAll("]", "&#93;");
			v.val = v.css ? `[${v.val}]("style="${normalizeStyle}${v.css}")` : v.val;
		}
		return `${v.tag ? `${v.tag}=` : ""}${v.val}`;
	}

	/* eslint-disable object-property-newline */
	const buildAbilityTemplate = (v) => {
		const tmplModel = [
			{tag: v.rMode,	val: `1`},
			{tag: `rname`,	val: v.title, css: `color:${v._isNpc ? "#9a384f" : "#607429"};`},
			{tag: `name`,	val: `${v.subTitle || ""} (${v.mod || 0})`},
			{tag: `type`,	val: v.attrName, css: `display:inline-block;width:50%;font-style: normal;margin: 2px 0px;vertical-align: middle;text-align: right;padding-right: 5px;line-height: 14px;letter-spacing: -1px;`},
			{tag: `r1`,	val: [
				{val: ` `, css: `display: inline-block;margin-left:-8px;`},
				{val: `[[${v.r1}${v.dc ? `[chk${v.dc}]` : ""}]]`},
			]},
			{tag: `r2`,	val: [
				{val: `[[${v.r2 || v.r1}${v.dc ? `[chk${v.dc}]` : ""}]]`},
				{val: ` `, css: `display: inline-block;margin-right:-10px;`},
			], q: v.rMode !== "normal"},
		].map(getTemplateVar).filter(s => !!s).join("}} {{");
		return `&{template:npc} ${v.hidden} {{${tmplModel}}}`;
	}

	const buildAttackTemplate = (v) => {
		v.targetId = v._onSelf ? v._this.id : v.targetId;
		const tmplModel = [
			{tag: `attack`,	 val: "1"},
			{tag: `crit`,	 val: "1"},
			{tag: `damage`,	 val: "1"},
			{tag: v.rMode,	 val: "1", q: !!v.atk1},
			{tag: `range`,	 val: v.charName, css: `color:${v._isNpc ? "#9a384f" : "#607429"};${!v.atk1 || v.rMode === "" ? "margin-top: 12px;" : ""}font-weight:bold;display: inline-block;font-family: 'Times New Roman', Times;font-style: normal;font-variant: small-caps;font-size: 14px;`},
			{tag: `rname`,	 val: v.title, css: `font-size: 13px;line-height: 16px;`},
			{tag: `charname`, val: [
				{val: v.subTitle, q: !!v.subTitle},
				{val: ` `, q: !!v.targetName || !!v.saveAttr, css: `display: block;padding-bottom: 3px;`},
				{val: [
					{val: `^{on-hit:-u}`, css: `font-style: normal;display: block;`},
					{val: `^{save} **^{difficulty-class-abv}${v.dc} ^{${v.saveAttr?.slice(0, 3)}-u}**`, css: `font-style: normal;display: block;`},
				], q: !!v.saveAttr},
				{val: [
					{val: `^{target:} ${v.targetName}`},
					{val: ` (${v.distance})`, q: !!v.distance},
				], q: !!v.targetName},
				{val: ` `, css: `display: block;padding-bottom: 8px;`},
			]},
			{tag: `mod`, val: [
				{val: v.atkMod, q: v.rMode !== "" && !!v.atkMod},
				{val: v.mod, q: !!v.mod},
				{val: "⚕", q: !!v._isSpell, css: `color:#3737ff;font-weight:bold;`},
			]},
			{tag: `dmg1flag`, val: "1"},
			{tag: `dmg1type`, val: v.dmg1type},
			{tag: `dmg1`,	val: `[[${v.dmg1roll || 0}[${v.dmg1tag}${v.targetId}]]]`},
			{tag: `crit1`,	val: `[[${v.crit1roll || 0}[${v.dmg1tag}${v.targetId}]]]`},
			{tag: `dmg2flag`, val: "1", q: !!v.dmg2on},
			{tag: `dmg2type`, val: v.dmg2type},
			{tag: `dmg2`,	val: `[[${v.dmg2roll || 0}[${v.dmg2tag}${v.targetId}]]]`, q: !!v.dmg2on},
			{tag: `crit2`,	val: `[[${v.crit2roll || 0}[${v.dmg2tag}${v.targetId}]]]`, q: !!v.dmg2on},
			{tag: `r1`,		val: `[[${v.atk1}[atk${btoa(v.targetAc || "")}]]]`, q: !!v.atk1},
			{tag: `r2`,		val: `[[${v.atk2 || v.atk1}[atk${btoa(v.targetAc || "")}]]]`, q: v.rMode !== "normal"},
		].map(getTemplateVar).filter(s => !!s).join("}} {{");
		return `&{template:atkdmg} ${v.hidden || ""} {{${tmplModel}}}`;
	}

	const buildCastTemplate = (v) => {
		const tmplModel = [
			{tag: `attack`,	 val: "1"},
			{tag: `damage`,	 val: "1"},
			{tag: `mod`,	 val: "⚕", css: `color:#3737ff;font-weight:bold;`},
			{tag: `range`,	 val: v.charName, css: `color:${v._isNpc ? "#9a384f" : "#607429"};margin-top: 12px;font-weight:bold;display: inline-block;font-family: 'Times New Roman', Times;font-style: normal;font-variant: small-caps;font-size: 14px;`},
			{tag: `rname`,	 val: v.title, css: `font-size: 13px;line-height: 16px;`},
			{tag: `charname`, val: [
				{val: v.subTitle, css: `display:inline-block;`},
				{val: [
					{val: ` `, css: `display: block;padding-bottom: 7px;`},
					{val: `^{difficulty-class-abv}${v.dc} ^{${v.saveAttr?.slice(0, 3)}-u}`, css: `display: block;font-weight:bold;font-size:13px;`},
					{val: [
						{val: `^{target:} ${v.targetName}`},
						{val: ` (${v.distance})`, q: !!v.distance},
					], q: !!v.targetName, css: `display: block;`},
					{val: `^{save}`, css: `display: block;`},
					{val: ` `, css: `display: block;padding-bottom: 7px;`},
				]},
			]},
			// {tag: `mod`,	 val: v.atkMod},
			{tag: `dmg1type`,	val: [
				{val: `^{damage:-u}%NEWLINE%^{failures-u}`, css: "font-size:8px;line-height:8px;display:block;padding:4px 0px;"},
				{val: v.dmg1type ? `${v.dmg1type || ""} ${v.dmg2type || ""}` : "", q: !!v.dmg1type || !!v.dmg2type, css: `display: block;padding-bottom: 7px;width: 180px;font-style: normal;`},
			]},
			{tag: `dmg2type`,	val: `^{damage:-u}%NEWLINE%^{successes-u}`, css: "font-size:8px;line-height:8px;display:block;padding:4px 0px;"},
			{tag: `dmg1flag`,	val: "1"},
			{tag: `dmg2flag`,	val: "1"},
			{tag: "dmg1", val: v.dmgOnFail},
			{tag: "dmg2", val: v.dmgOnSuccess},
		].map(getTemplateVar).filter(s => !!s).join("}} {{");
		v.hidden = v.hidden || `[[ floor([[${v.dmg1roll}${v.dmg1type ? `[${v.dmg1type}]` : ""} ${v.dmg2roll ? `+ ${v.dmg2roll}${v.dmg2type ? `[${v.dmg2type}]` : ""}` : ""}[dmg${v.targetId}]]]/2) [dmg${v.targetId}] ]]`;
		return `&{template:atkdmg} ${v.hidden || ""} {{${tmplModel}}}`;
	}

	const buildActionTemplate = (v) => {
		const tmplModel = [
			// {tag: v.rMode,	val: "1", q: !!v.dmg1on},
			// {tag: `attack`,	val: "1", q: !!v.dmg1on},
			{tag: `mod`,	 val: "⚕", css: `color:#3737ff;font-weight:bold;`},
			{tag: `rname`,	 val: [
				{val: v.charName, css: `color:${v._isNpc ? "#9a384f" : "#607429"};margin-top: 12px;font-weight:bold;display:block;font-family: 'Times New Roman', Times;font-style: normal;font-variant: small-caps;font-size: 14px;`},
				{val: v.title, css: `font-size: 13px;line-height: 16px;`},
			]},
			{tag: `charname`, val: [
				{val: v.subTitle, css: `display:inline-block;`},
				{val: [
					{val: ` `, css: `display: block;padding-bottom: 7px;`},
					{val: `^{difficulty-class-abv}${v.dc} ^{${v.saveAttr?.slice(0, 3)}-u}`, q: !!v.saveAttr, css: `display: block;font-weight:bold;font-size:13px;`},
					{val: [
						{val: `^{target:} ${v.targetName}`},
						{val: ` (${v.distance})`, q: !!v.distance},
					], q: !!v.targetName, css: `display: block;`},
					{val: `^{save}`, q: !!v.saveAttr, css: `display: block;`},
					{val: ` `, css: `display: block;padding-bottom: 7px;`},
				]},
			]},
		].map(getTemplateVar).filter(s => !!s).join("}} {{");
		return `&{template:simple} ${v.hidden || ""} {{${tmplModel}}}`;
	}

	const buildDescriptionTemplate = (v) => {
		const tmplModel = [
			{tag: `name`,	val: v.title},
			{tag: `source`,	val: [
				{val: v.charName},
				{val: v.subTitle},
			]},
			{tag: `description`, val: v.description, css: `display:block; overflow-y:auto; max-height:250px`},
		].map(getTemplateVar).filter(s => !!s).join("}} {{");
		return `&{template:traits} {{${tmplModel}}}`;
	}

	const getDescriptionTemplate = (token, id, type) => {
		const char = d20plus.ba.getSingleChar(token);
		const cat = char[type] || [];
		const obj = cat[id];
		if (!obj) return;
		if (type === "spells") d20.textchat.doChatInput(`&{template:traits} {{name=${obj.spellname}}} {{source=${obj.spellschool || ""}}} {{description=${obj.spelldescription}}}`);
		else if (type === "attacks") d20.textchat.doChatInput(`&{template:traits} {{name=${obj.atkname}}} {{source=${obj.spellschool || ""}}} {{description=${obj.atkdamagetype || ""}}}`);
	}
	/* eslint-enable object-property-newline */

	const outputTemplate = (values) => {
		const templateModel = {
			ability: buildAbilityTemplate,
			attack: buildAttackTemplate,
			cast: buildCastTemplate,
			action: buildActionTemplate,
			description: buildDescriptionTemplate,
		}[values?._modelType];

		const template = templateModel && templateModel(values);
		if (!template) return d20plus.ba.rollError(); d20plus.ut.log(values);

		d20.textchat.doChatInput(`${getWMode()}${template}`);
		if (values._expend) d20plus.engine.expendResources(values._expend);
	}

	const buildRollModel = (r) => {
		const critrange = r.critrange && Number(r.critrange) !== 20 ? `cs>${r.critrange}` : "";
		const base = !r.base ? ""
			: r.base.toLowerCase().includes("d") ? r.base : `1d${r.base}${critrange}`;
		const mods = r.mods?.reduce((s, m) => {
			if (!m) return s;
			const attr = m[1] ? `[${m[1]}]` : "";
			const raw = String(m[0] || "0").split("+").map(d => {
				if (!d) return "";
				d = d.trim();
				if (d[0] === "-" || (s === "" && !r.base) || d === "") return `${d}`;
				else return `+${d}`;
			}).join("");
			return `${s} ${raw}${attr}`;
		}, "")
		const dmg = r.type ? `[${r.type}${r.target || "@{target|token_id"}]` : "";
		return `${base}${mods}${dmg}`;
	}

	const buildDisplayMod = (r) => {
		const base = !r.base || r.base === "20" ? ""
			: r.base.toLowerCase().includes("d") ? "" : `D${r.base} `;
		const mods = r.mods?.reduce((s, m) => {
			if (!m) return s;
			return s + (Number(m[0]) || 0);
		}, 0) || 0; d20plus.ut.log("Building modifier", mods, r)
		const sign = mods < 0 || !r.base ? "" : "+";
		return `${base}${sign}${mods}`;
	}

	const getAbilityVals = (q) => { // spec, attr, dc
		const [attr, dcTmp] = String(q.flags).split("|");
		const dc = q.dc || dcTmp;
		const spec = q.id;

		const abbr = attr.slice(0, 3).toUpperCase();
		const attrBase = attr.replaceAll(" ", "_").replaceAll("-", "_");
		const attrId = spec === "save" ? `${attrBase}_save` : `${attrBase}_mod`;
		const attrMod = q.token.get(attrId);

		const roll = {
			base: attr !== "hit dice" ? `20` : `${q.token.get("hitdietype")}`,
			// type: spec === "hit dice" ? `heal` : null,
			// target: spec === "hit dice" ? token.id : null,
			mods: [
				[attrMod, abbr],
				attr === "initiative" ? [` `, `init${q.token.id}`] : null,
				spec === "ability" && !q.token.get("npc") ? [`${q.token.get("jack_bonus")}`, "JACK"] : null,
			],
		}

		if (attr === "hit dice") roll.mods[0] = [q.token.get("constitution_mod"), "CON"];
		if (attr === "concentration") roll.mods[0] = [q.token.get("constitution_save"), "CON"];

		const tmplVals = {
			_this: q.token,
			_thisId: q.token.character.id,
			_isNpc: q.token.get("npc"),
			_modelType: !["hit dice", "fall"].includes(attr) ? "ability" : "attack",
			_onSelf: true,
			dc,
			rMode: getRollMode(),
			title: attr !== "hit dice" ? q.token.get("name") : `^{hit-dice-u}`,
			subTitle: `^{${spec === "ability" ? "abilities" : ["skill", "save", "roll"].includes(spec) ? spec : attr}}`,
			attrName: `^{${spec === "save" ? `${attrBase}-save` : (["death save", "hit dice"].includes(attr) ? attr.split(" ").concat("u").join("-") : attrBase)}}`,
			mod: buildDisplayMod(roll),
			r1: buildRollModel(roll), // +$[[0]]`,
			// r2: `[[${buildRollModel(roll)}]]`, // +$[[0]]`,

			dmg1on: true,
			dmg1tag: "heal",
			dmg1type: `^{hp}`,
			dmg1roll: buildRollModel(roll),
			charName: q.token.get("name"),
			targetId: q.token.id,
		}

		return tmplVals;
	};

	const getAttackVals = (q) => {
		const atk = q.token.get(q.id);
		const dmg = atk._get("rollbase_crit")?.match(/{{dmg1=\[\[(?<dmg1>[^}]*)\]\]}}(?:.*?){{dmg2=\[\[(?<dmg2>[^}]*)\]\]}}(?:.*?){{crit1=\[\[(?<crit1>[^}]*)\]\]}}(?:.*?){{crit2=\[\[(?<crit2>[^}]*)\]\]}}/)?.groups || {};
		const atkattr = atk._get("attr");
		const isNpc = q.token.get("npc");

		const atkRoll = {
			base: `20`,
			critrange: atk._get("atkcritrange") || q.token.get("default_critical_range") || "20",
			mods: [
				isNpc ? [atk._get("attack_tohit"), "MOD"] : undefined,
				!isNpc ? [atk._get("atkmod"), "MOD"] : undefined,
				!isNpc ? [atk._get("atkmagic"), "MB"] : undefined,
				atkattr ? [q.token.get(atkattr), atkattr?.slice(0, 3).toUpperCase()] : undefined,
				atk._has("pb") && !isNpc ? [q.token.get("pb"), "PB"] : undefined,
			],
		}

		const tmplVals = {
			_this: q.token,
			_thisId: q.token.character.id,
			_isNpc: isNpc,
			_onSelf: atk._get("range")?.includes("[S]"),
			_targeted: atk._has("atk") || atk._has("dmg1") || atk._has("dmg2") || atk._has("save"),
			_modelType: atk._has("atk") ? "attack" : atk._has("save") && atk._has("dmg1") ? "cast" : "action",
			_expend: atk._get("ammo") ? {type: "item", name: atk._get("ammo"), charID: q.token.character.id} : undefined,

			title: atk._get("name") || "^{attack-u}",
			subTitle: [atk._get("range")?.replace(/\[\w\]/g, "").replaceAll("]", "&#93;"), i18n(atk._get("attack_type")?.toLowerCase(), "")]
				.reduce((t, v) => v && (!t || `${t}, ${v}`.length < 27) ? `${t}${v && t ? ", " : ""}${v}` : t, ""),
			charName: q.token.get("name"),
			description: atk._get("description"),

			dmg2on:	atk._has("dmg2"),
			dmg1tag:	atk._get("dmg1type")?.includes("Healing") ? "heal" : "dmg",
			dmg2tag:	atk._get("dmg2type")?.includes("Healing") ? "heal" : "dmg",
			dmg1type:	atk._get("dmg1type") || "",
			dmg2type:	atk._get("dmg2type") || "",
			dmg1roll:	atk._get("attack_damage") || dmg.dmg1 || 0,
			dmg2roll:	atk._get("attack_damage2") || dmg.dmg2 || 0,
			rMode: getRollMode(),
			crit1roll:	atk._get("attack_crit") || dmg.crit1 || 0,
			crit2roll:	atk._get("attack_crit2") || dmg.crit2 || 0,
			atk1: buildRollModel(atkRoll),
			atkMod:	buildDisplayMod(atkRoll),
			saveAttr: atk._get("saveattr")?.toLowerCase() || "",
			dc: q.token.character.sheet.getRollModifier(atk._get("savedc")),
		}
		return tmplVals;
	}

	const getSpellVals = (q) => { // id, flags
		const expendCfg = d20plus.cfg.getOrDefault("chat", "autoExpend");
		const lvls = String(q.flags).split(",");
		const spell = q.token.get(q.id);
		const spell_ability = spell._get("spell_ability");
		const spellAbility = spell_ability && spell_ability?.length > 2
			? (spell_ability !== "spell" ? spell_ability : q.token.get("spellcasting_ability"))?.replace(/@{(.*?)(_mod|)}(\+|)/, "$1") || ""
			: "";
		const subTitle = [spell.spellrange, spell.spellduration, spell.spelltarget, i18n(spell.spellattack?.toLowerCase(), "")]
			.reduce((t, v) => v && (!t || `${t}, ${v}`.length < 27) ? `${t}${v && t ? ", " : ""}${v}` : t, "");
		const onSelf = spell.spellrange?.includes("[S]") || spell.spelltarget?.includes("Self");
		const spelldmgmod = spell._get("spelldmgmod") === "Yes" ? q.token.get(`${spellAbility}_mod`) || 0 : "";

		const expend = (spell.lvl === undefined || !!spell._get("innate"))
			? (spell._has("uses") ? {type: spell._resource.type, res: spell._resource.side, name: spell._resource.name, charID: q.token.character.id} : undefined)
			: (spell.lvl !== "cantrip" ? {type: "spell", lvl: spell.lvl, charID: q.token.character.id} : undefined);

		const atkRoll = {
			base: `20`,
			// type: `atk`,
			// target: targetTag,
			critrange: q.token.get("default_critical_range") || "20",
			mods: [
				spell_ability === "spell" && [q.token.get("spell_attack_bonus"), "SPELL"], // `@{${char.id}|spell_attack_mod}[MOD]+${spellAbility}@{${char.id}|pb}[PB]`
				spell_ability !== "spell" && [q.token.get("spell_attack_mod"), "MOD"],
				spell_ability !== "spell" && [q.token.get(`${spellAbility}_mod`), spellAbility.slice(0, 3).toUpperCase()],
				spell_ability !== "spell" && [q.token.get("pb"), "PB"],
			],
		}

		const upcast = lvls.reduce((vars, lvl) => {
			lvl = Number(lvl);
			if (!lvl) return vars;
			const splvl = spell.lvl !== "cantrip" ? Number(spell.lvl) : 0;
			const base = spell._get("spelldamage") ? spell._get("spelldamage") : (spell._get("spellhealing") && !spell._get("spellsave") ? spell._get("spellhealing") : "");
			const diff = lvl - splvl;
			const mult = diff * (spell._get("spellhldie") || 1);
			const addBonus = spell._get("spellhlbonus") && !isNaN(spell._get("spellhlbonus")) ? `+${Number(spell._get("spellhlbonus"))}` : "";
			const addDice = spell._get("spellhldietype") ? `${mult}${spell._get("spellhldietype")}${addBonus}` : "";

			vars[lvl] = {
				dmg1roll: base ? buildRollModel({base, mods: [[spelldmgmod], [addDice, `LVL${lvl}`]]}) : "",
				crit1roll: base ? buildRollModel({base, mods: [[`${mult}${spell._get("spellhldietype")}`, `LVL${lvl}`]]}) : "",
			}
			return vars;
		}, []);

		const tmplVals = {
			_this: q.token,
			_thisId: q.token.character.id,
			_isNpc: q.token.get("npc"),
			_isSpell: spell._get("spell_ability") === "spell",
			_upcast: upcast,
			_save: spell._get("spellsave")?.toLowerCase() || false,
			_expend: expend,
			_onSelf: spell._get("spellrange")?.includes("[S]") || spell._get("spelltarget") === "self",
			_targeted: !!spell._has("atk") || !!spell._has("dmgorheal") || !!spell._has("save"),
			_modelType: spell._has("atk") || (!spell._has("save") && spell._has("dmgorheal")) ? "attack" : (spell._has("save") && spell._has("dmg") ? "cast" : "action"),

			rMode: spell._has("atk") ? getRollMode() : /* spell._getVar("hassave") || !!spell.spelldamage2 ? "always" : */ "",
			charName: q.token.get("name"),
			title:	spell._get("name"),
			subTitle,

			dmg1on: !!spell._get("spelldamage") || !!spell._get("spellhealing"),
			dmg2on: !!spell._get("spelldamage2"),
			dmg1tag:	spell._get("spelldamage") || spell._get("spelldamage2") ? "dmg" : spell._get("spellhealing") ? "heal" : "",
			dmg2tag:	spell._get("spelldamage2") ? "dmg" : spell._get("spelldamage") && spell._get("spellhealing") ? "heal" : "",
			dmg1type:	spell._get("spelldamagetype") || (spell._get("spellhealing") ? "healing" : ""),
			dmg2type:	spell._get("spelldamagetype2") || (spell._get("spelldamage") && spell._get("spellhealing") ? "healing" : ""),
			dmg1roll:	spell._get("spelldamage") ? buildRollModel({base: spell._get("spelldamage"), mods: [[spelldmgmod]]})
				: spell._get("spellhealing") && !spell._get("spellsave") ? buildRollModel({base: spell._get("spellhealing"), mods: [[spelldmgmod]]}) : "",
			dmg2roll:	spell._get("spelldamage2") ? buildRollModel({base: spell._get("spelldamage2"), mods: [[spelldmgmod]]})
				: spell._get("spelldamage") && spell._get("spellhealing") && !spell._get("spellsave") ? buildRollModel({base: spell._get("spellhealing"), mods: [[spelldmgmod]]}) : "",

			crit1roll:	spell._get("spelldamage"),
			crit2roll:	spell._get("spelldamage2"),
			atk1: buildRollModel(atkRoll),
			atkMod:	buildDisplayMod(atkRoll),
			description: spell._get("description"),
			hldescription: spell._get("spellathigherlevels"),

			dc: spell._get("spell_ability") !== "spell"
				? buildDisplayMod({mods: [[8], [q.token.get("spell_dc_mod")], [q.token.get(`${spellAbility}_mod`)], [q.token.get("pb")]]})
				: (q.token.get("spell_save_dc") || "10"),
			saveAttr: spell._get("spellsave")?.toLowerCase() || "",
			dmgOnFail: `$[[0]]`,
			dmgOnSuccess: spell.lvl === "cantrip" ? "[[0]]" : `$[[1]]`,
		}
		return tmplVals;
	}

	const switchTargeting = (mode) => {
		const on = mode === "on";
		d20plus.mod.setMode(on ? "targeting" : "select");
		d20.engine.canvas.hoverCursor = on ? "crosshair" : "move";
		d20plus.ba.$dom.r20targetingNote[on ? "show" : "hide"]();
		$("#babylonCanvas")[on ? "addClass" : "removeClass"]("targeting");
	}

	d20plus.ba.getTarget = async (vals, target) => {
		if (target === false) { // user Closed targeting dialog
			switchTargeting("off");
			return d20.engine.nextTargetCallback = false;
		} else if (!target) {
			// d20plus.ut.log("START TARGETING", vals);
			switchTargeting("on");
			d20.engine.nextTargetCallback = (t) => { d20plus.ba.getTarget(vals, t); };
		} else if (vals._aoe) {
			// console.log(target);
		} else {
			if (!target._model?.character) return d20plus.ut.sendHackerChat("Target the token that represents a PC or NPC", true);
			const targetToken = d20plus.ba.tokens.ready(target);
			const distance = d20plus.ut.getTokensDistanceText(target._model, vals._this._ref);
			await targetToken.ready();
			await targetToken.character.sheet.fetch();

			// const targetChar = await d20plus.ba.fetchChar(target._model);
			// const thisToken = d20plus.ut.getTokenById(d20plus.ba.chars[vals._thisId].lastTokenId);

			d20plus.ut.log("Getting target", vals);
			switchTargeting("off");
			d20.engine.nextTargetCallback = false;

			if (vals._save) {
				// d20plus.ba.currentToken = target._model;
				// d20plus.ba.singleSelected = target._model;
				outputTemplate(getAbilityVals({ // "save", vals._save, vals.dc
					id: "save",					// spec, attr, dc
					flags: vals._save,
					dc: vals.dc,
					token: targetToken,
				}));
			}

			vals.targetId = target._model.id;
			vals.targetName = target._model.attributes.name;
			vals.targetAc = targetToken.get("ac"); // targetChar.isNpc ? targetChar.npcStats.ac : targetChar.stats.ac;
			vals.distance = distance;
			setTimeout(i => { outputTemplate(vals) }, 500);
			// d20plus.ut.log("END TARGETING", vals);
		}
	}

	d20plus.ba.getConcentrationDC = (vals) => {
		const $dc = $(`
			<div>
				Enter incoming damage
				<input type="number" style="width:45px;">
			</div>
		`).dialog({
			title: "Concentration roll",
			autoopen: true,
			close: () => { $dc.off(); $dc.dialog("destroy").remove() },
			buttons: {
				"Cancel": () => { $dc.off(); $dc.dialog("destroy").remove() },
				"Roll": () => {
					const $input = $dc.find("input");
					const dmg = $input.val();
					if (!isNaN(dmg)) {
						vals.dc = Math.max(10, Math.floor(dmg / 2));
						outputTemplate(vals);
					}
					$dc.off(); $dc.dialog("destroy").remove();
				},
			},
		})
	}

	d20plus.ba.getFallHeight = (vals) => {
		const $fd = $(`
			<div>
				Enter fall height, ft.
				<input type="number" style="width:45px;">
			</div>
		`).dialog({
			title: "Fall damage",
			autoopen: true,
			close: () => { $fd.off(); $fd.dialog("destroy").remove() },
			buttons: {
				"Cancel": () => { $fd.off(); $fd.dialog("destroy").remove() },
				"Roll": () => {
					const $input = $fd.find("input");
					const height = $input.val();
					if (!isNaN(height)) {
						const dmgRoll = Math.min(Math.abs(Math.floor(height / 10)), 20);
						vals.dmg1roll = `${dmgRoll}d6[dmg${vals._thisId}]`;
						vals.title = "Fall";
						vals.subTitle = "Fall damage";
						vals.dmg1tag = "dmg";
						vals.dmg1type = `bludgeoning`;
						vals.mod = `${height} ft.`;
						outputTemplate(vals);
					}
					$fd.off(); $fd.dialog("destroy").remove();
				},
			},
		})
	}

	d20plus.ba.getUpcastSpell = (vals, flags) => {
		const lvls = String(flags).split(",");
		const options = lvls.reduce((html, lvl) => {
			const name = lvl === "0" ? "As ritual" : `Level ${lvl}`;
			return `${html}<option value="${lvl}">${name}</option>`;
		}, "")
		const $uc = $(`
			<div>
				<h3>${vals.title}</h3>
				${vals.hldescription ? `<p>${vals.hldescription}</p>` : ""}
				Select spell slot to expend:
				<select style="width:90px;">${options}</select>
			</div>
		`).dialog({
			title: "Upcast spell",
			autoopen: true,
			close: () => { $fd.off(); $uc.dialog("destroy").remove() },
			buttons: {
				"Cancel": () => { $uc.off(); $uc.dialog("destroy").remove() },
				"Roll": () => {
					const $input = $uc.find("select");
					const level = $input.val();
					if (level === "0") {
						vals._expend = false;
					} else {
						vals._expend.lvl = level;
						if (vals._upcast && vals._upcast[level]?.dmg1roll) {
							vals.dmg1roll = vals._upcast[level]?.dmg1roll;
							if (vals._upcast[level]?.crit1roll) vals.crit1roll = vals._upcast[level]?.crit1roll;
						}
					}
					if (vals._targeted && !vals._onSelf) d20plus.ba.getTarget(vals);
					else outputTemplate(vals);
					$uc.off(); $uc.dialog("destroy").remove();
				},
			},
		})
	}

	d20plus.ba.makeRoll = (q) => { // action, spec, flags
		const getTmplVals = {
			roll: getAbilityVals,
			attack: getAttackVals,
			cast: getSpellVals,
			upcast: getSpellVals,
		}[q.action];

		const tmplVals = getTmplVals && getTmplVals(q); // spec, flags
		if (!tmplVals) return d20plus.ba.rollError();
		else if (q.flags === "concentration") d20plus.ba.getConcentrationDC(tmplVals);
		else if (q.flags === "fall") d20plus.ba.getFallHeight(tmplVals);
		else if (q.action === "upcast") d20plus.ba.getUpcastSpell(tmplVals, q.flags);
		else if (tmplVals._targeted && !tmplVals._onSelf) d20plus.ba.getTarget(tmplVals);
		else outputTemplate(tmplVals);
	}

	d20plus.ba.makeInfo = (q) => {
		const getTmplVals = {
			spell: getSpellVals,
			attack: getAttackVals,
		}[q.action];

		const tmplVals = getTmplVals && getTmplVals(q);
		if (!tmplVals) return d20plus.ba.rollError();
		tmplVals._modelType = "description";
		tmplVals._expend = false; d20plus.ut.log("Outputting template", tmplVals);
		outputTemplate(tmplVals);
	}
}

SCRIPT_EXTENSIONS.push(baseBARollTemplates);
