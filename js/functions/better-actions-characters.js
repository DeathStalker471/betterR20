/**
 * BetterActions character/token data — fetches and maps character sheet attributes
 * to the BA panel's token list.
 * Originally in: js/base/base-ba-character.js
 */

function baseBACharacters () {
	d20plus.ba = d20plus.ba || {};

	d20plus.ba.characters = [];
	d20plus.ba.tokens = [];

	d20plus.ba.characters.Connector = function (ref) {
		const abilities = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

		const skills = {
			acrobatics: "dexterity",
			animal_handling: "wisdom",
			arcana: "intelligence",
			athletics: "strength",
			deception: "charisma",
			history: "intelligence",
			insight: "wisdom",
			intimidation: "charisma",
			investigation: "intelligence",
			medicine: "wisdom",
			nature: "intelligence",
			perception: "wisdom",
			performance: "charisma",
			persuasion: "charisma",
			religion: "intelligence",
			sleight_of_hand: "dexterity",
			stealth: "dexterity",
			survival: "wisdom",

			initiative: "dexterity",
		};

		const prepareRawStats = (lvls, attrib, id, val) => {
			if (!Array.isArray(lvls)) lvls = [lvls];
			const max = attrib?.attributes.max;
			let obj = this.sheet.data;
			lvls.forEach(lvl => {
				obj[lvl] = obj[lvl] || {};
				obj = obj[lvl];
			});
			obj._ref = obj._ref || {};
			obj._ref[id] = attrib;
			obj[id] = val || attrib.attributes.current;
			if (max !== undefined && max !== "") obj[`${id}_max`] = max;
			if (lvls.length > 1) obj._id = lvls.last();
		}

		const prepareResources = () => {
			const resources = { _ref: {} };
			["other", "class"].forEach(r => {
				const tag = this.sheet.data.stats[`${r}_resource_name`];
				const num = this.sheet.data.stats[`${r}_resource`];
				const ref = this.sheet.data.stats._ref[`${r}_resource`];
				if (num !== undefined && tag) {
					resources[tag] = num;
					resources._ref[tag] = ref;
				}
			});
			Object.entries(this.sheet.data.resources || {}).forEach(([id, r]) => {
				["left", "right"].forEach(n => {
					const tag = r[`resource_${n}_name`];
					const num = r[`resource_${n}`];
					if (num !== undefined && tag) {
						resources[tag] = num;
						resources._ref[tag] = this.sheet.data.resources[id]?._ref;
					}
				});
			})
			this.sheet.data.resources = resources;
		}

		const fetchAttribs = () => {
			this.isNpc = false;
			this.sheet.data = {
				stats: {},
				npcStats: {},
				spellslots: {},
			};
			this.name = {
				tk: this.refLastToken.attributes.name,
				ch: this._ref.attributes.name,
			};
			this._ref.attribs?.models.forEach(prop => {
				const [tag, type, id, ...attrPath] = prop.attributes.name.split("_");
				const attr = attrPath.join("_");
				const current = prop.attributes.current;
				if (type === undefined) {
					if (tag === "npc" && current === "1") this.isNpc = true;
					else prepareRawStats("stats", prop, tag);
				} else if (type === "slots") {
					const lvl = tag.slice(-1);
					prepareRawStats(["spellslots", lvl], prop, id);
				} else if (tag === "repeating") {
					const [stype, lvl] = type.split("-");
					if (stype === "spell") {
						if (lvl) {
							prepareRawStats(["spells", id], prop, attr);
							this.sheet.data.spells[id].lvl = lvl;
						} else {
							prepareRawStats("stats", prop, [type].concat(id || []).join("_"));
						}
					} else if (stype === "npcaction") {
						prepareRawStats(["actions", id], prop, attr);
						if (lvl) this.sheet.data.actions[id].actionType = lvl;
					} else if (type === "attack") {
						prepareRawStats(["attacks", id], prop, attr);
					} else if (type === "inventory") {
						prepareRawStats(["items", id], prop, attr);
					} else if (["proficiencies", "tool", "resource"].includes(type)) {
						const stype = type.last() === "s" ? type : `${type}s`;
						prepareRawStats([stype, id], prop, attr);
					} else if (["acmod", "damagemod", "savemod", "skillmod", "tohitmod"].includes(type)) {
						const stype = type.split("mod")[0].replace("tohit", "attack");
						prepareRawStats(["mods", stype, id], prop, attr);
					} else if (type === "npctrait" || type === "traits") {
						prepareRawStats(["traits", id], prop, attr);
						prepareRawStats(["traits", id], undefined, "isTrait", true);
					}
				} else if (type === "reporder") {
					prepareRawStats("order", prop, attr, current.split(","));
				} else if (tag === "global" && id === "mod" && attr === "flag") {
					prepareRawStats(["mods", "active"], prop, type);
				} else if (tag === "npc") {
					if (type === "name") this.name.npc = prop.attributes.current;
					prepareRawStats("npcStats", prop, [type].concat(id || [], attr || []).join("_"));
				} else {
					if (prop.attributes.name === "charactersheet_type" && current === "npc") this.isNpc = true;
					prepareRawStats("stats", prop, [tag].concat(type || [], id || [], attr || []).join("_"));
				}
			});
		}

		const getMod = (val) => {
			return val
				? `+${val}`.replace("++", "+").replace("+-", "-")
				: "+0";
		}

		const filterVal = (val) => {
			return val === undefined ? undefined : `${val}`;
		}

		const checkType = function (type) {
			switch (type) {
				case "ability": return abilities.includes(this.val);
				case "ability_mod": return abilities.map(a => `${a}_mod`).includes(this.val);
				case "ability_save": return abilities.map(a => `${a}_save`).includes(this.val);
				case "skill": return Object.keys(skills).includes(this.val);
				case "skill_mod": return Object.keys(skills).map(a => `${a}_mod`).includes(this.val);
				case "skill_pb": return Object.keys(skills).map(a => `${a}_pb`).includes(this.val);
			}
		}

		const getStats = (q) => {
			const char = this.sheet.data.stats._ref;
			const npc = this.sheet.data.npcStats._ref;
			const str = {val: q, is: checkType};
			if (str.is("ability")) return `${char[q]?.attributes.current}` || "10";
			else if (str.is("ability_mod")) return getMod(char[q]?.attributes.current);
			else if (str.is("ability_save")) {
				return getMod(
					(this.isNpc && filterVal(npc[`${q.substr(0, 3)}_save`]?.attributes.current))
					|| char[`${q}_bonus`]?.attributes.current);
			} else if (str.is("skill")) {
				return `${10 + Number(
					(this.isNpc && filterVal(npc[q]?.attributes.current))
					|| char[`${q}_bonus`]?.attributes.current || 0)}`;
			} else if (str.is("skill_mod")) {
				q = q === "concentration_mod" ? "constitution" : q.replace("_mod", "");
				return getMod(
					(this.isNpc && filterVal(npc[q]?.attributes.current))
					|| char[`${q}_bonus`]?.attributes.current);
			} else if (q === "passive_perception") {
				return `${
					(this.isNpc && (10 + Number(filterVal(npc[`passive`]?.attributes.current)
						|| filterVal(npc[`perception`]?.attributes.current)
						|| filterVal(char[`perception_bonus`]?.attributes.current))))
					|| char[`passive_wisdom`]?.attributes.current}`;
			} else return (this.isNpc && filterVal(npc[q]?.attributes.current)) || char[q]?.attributes.current;
		}

		const types = {
			spells: {
				id: "spells",
				utils: {
					_char: () => this,
					_get: function (q) {
						if (q === "name") return this._ref.spellname?.attributes.current;
						else if (q === "description") return this._ref.spelldescription?.attributes.current;
						else if (q === "uses") {
							if (this._resource === undefined) {
								const resourceName = this._ref.innate?.attributes.current;
								const resource = this._char().sheet.getResources(resourceName);
								this._resource = resource || false;
							}
							return this._resource?.current;
						}
						return this._ref[q]?.attributes.current;
					},
					_has: function (q) {
						switch (q) {
							case "atk": return (
								this._ref.spellattack?.attributes.current
								&& this._ref.spellattack?.attributes.current !== "None"
							);
							case "dmg": return (
								this._ref.spelldamage?.attributes.current
								|| this._ref.spelldamage2?.attributes.current
							);
							case "dmgorheal": return (
								this._ref.spelldamage?.attributes.current
								|| this._ref.spelldamage2?.attributes.current
								|| this._ref.spellhealing?.attributes.current
							);
							case "upcast": return (
								!isNaN(this._ref.spellhldie?.attributes.current)
								&& !!this._ref.spellhldietype?.attributes.current
							);
							case "action": return (
								this._ref.spelldamage?.attributes.current
								|| this._ref.spelldamage2?.attributes.current
								|| this._ref.spellhealing?.attributes.current
								|| (this._ref.spellattack?.attributes.current
									&& this._ref.spellattack?.attributes.current !== "None")
								|| this._ref.spellsave?.attributes.current
							);
							case "uses": {
								if (this._resource) return true;
								const resourceName = this._ref.innate?.attributes.current;
								const resource = this._char().sheet.getResources(resourceName);
								if (resource) {
									this._resource = resource;
									return true;
								} else {
									this._resource = false;
									return false;
								}
							}
							case "ritual": return (
								this._ref.spellritual?.attributes.current !== "0"
								&& this._ref.spellritual?.attributes.current
							);
							case "active": return this._ref.spellprepared?.attributes.current === "1"
							case "save": return !!this._ref.spellsave?.attributes.current;
						}
					},
				},
			},
			attacks: {
				id: "attacks",
				utils: {
					_char: () => this,
					_get: function (q) {
						switch (q) {
							case "name": return this._ref.atkname?.attributes.current;
							case "range": return this._ref.atkrange?.attributes.current;
							case "dmg1type": return this._ref.dmgtype?.attributes.current;
							case "dmg2type": return this._ref.dmg2type?.attributes.current;
							case "dmg1": return this._ref.attack_damage?.attributes.current;
							case "dmg2": return this._ref.attack_damage2?.attributes.current;
							case "attr": return this._ref.atkattr_base?.attributes.current.replace(/@{(.*?)}/, "$1");
							default: return this._ref[q]?.attributes.current;
						}
					},
					_has: function (q) {
						switch (q) {
							case "atk": return this._ref.atkflag?.attributes.current !== "0";
							case "save": return !!this._ref.savedc?.attributes.current;
							case "dmg1": return (
								!!this._ref.dmgbase?.attributes.current
								&& this._ref.dmgflag?.attributes.current !== "0");
							case "dmg2": return (
								!!this._ref.dmg2base?.attributes.current
								&& this._ref.dmg2flag?.attributes.current !== "0");
							case "pb": return this._ref.atkprofflag?.attributes.current !== "0"; // idiotic thing (pc only)?
							case "range": return this._ref.atkrange?.attributes.current.includes("/");
							default: return (
								this._ref[q]?.attributes.current
								&& this._ref[q]?.attributes.current !== "0");
						}
					},
				},
			},
			actions: {
				id: "actions", // npc's attack are stored here
				utils: {
					_char: () => this,
					_get: function (q) {
						switch (q) {
							case "name": return this._ref.name?.attributes.current;
							case "range": return this._ref.attack_range?.attributes.current;
							case "dmg1type": return this._ref.attack_damagetype?.attributes.current;
							case "dmg2type": return this._ref.attack_damagetype2?.attributes.current;
							case "dmg1": return this._ref.attack_damage?.attributes.current;
							case "dmg2": return this._ref.attack_damage2?.attributes.current;
							case "attr": return undefined;
							default: return this._ref[q]?.attributes.current;
						}
					},
					_has: function (q) {
						switch (q) {
							case "atk": return this._ref.attack_flag?.attributes.current !== "0";
							case "dmg1": return !!this._ref.attack_damage?.attributes.current;
							case "dmg2": return !!this._ref.attack_damage2?.attributes.current;
							case "pb": return false; // idiotic thing (pc only)?
							case "save": return false;
							case "range": return this._ref.attack_type?.attributes.current === "Ranged";
							default: return (
								this._ref[q]?.attributes.current
								&& this._ref[q]?.attributes.current !== "0");
						}
					},
				},
			},
			traits: {
				id: "traits",
				utils: {
					_char: () => this,
					_get: function (q) {
						switch (q) {
							case "name": return this._ref.name?.attributes.current;
							case "description": return this._ref.description?.attributes.current;
							case "resource": return this._ref.source_type?.attributes.current;
							case "uses": {
								if (this._resource === undefined) {
									const resourceName = this._ref.source_type?.attributes.current;
									const resource = this._char().sheet.getResources(resourceName);
									this._resource = resource || false;
								}
								return this._resource?.current;
							}
							default: return this._ref[q]?.attributes.current;
						}
					},
					_has: function (q) {
						switch (q) {
							case "atk": return false;
							case "dmg1": return false;
							case "dmg2": return false;
							case "pb": return false;
							case "save": return false;
							case "range": return false;
							case "action": return false;
							case "uses": {
								if (this._resource) return true;
								const resourceName = this._ref.source_type?.attributes.current;
								const resource = !!resourceName && this._char().sheet.getResources(resourceName);
								if (resource) {
									this._resource = resource;
									return true;
								} else {
									this._resource = false;
									return false;
								}
							}
							default: return (
								this._ref[q]?.attributes.current
								&& this._ref[q]?.attributes.current !== "0"
							);
						}
					},
				},
			},
			items: {
				id: "items",
				utils: {
					_char: () => this,
					_get: function (q) {
						switch (q) {
							case "name": return this._ref.itemname?.attributes.current;
							case "description": return this._ref.itemcontent?.attributes.current;
							case "equipped": return this._ref.equipped?.attributes.current;
							default: return this._ref[q]?.attributes.current;
						}
					},
					_has: function (q) {
						switch (q) {
							case "atk": return false;
							case "dmg1": return false;
							case "dmg2": return false;
							case "pb": return false;
							case "save": return false;
							case "range": return false;
							case "action": return false;
							case "active": return this._ref.equipped?.attributes.current !== "0"
							default: return (
								this._ref[q]?.attributes.current
								&& this._ref[q]?.attributes.current !== "0"
							);
						}
					},
					_equip: function (toggle) {
						const current = this._ref.equipped?.attributes.current !== "0";
						const changing = toggle === undefined
							? (current ? "0" : "1")
							: (toggle ? "1" : "0");
						this._ref.equipped?.save({current: changing});
					},
				},
			},
			/*
			function (param) {
				const char = d20plus.ba.getSingleChar();
				const attr = {
					name: {pc: "atkname", npc: "name"},
					range: {pc: "atkrange", npc: "attack_range"},
					hasattack: {pc: "atkflag", npc: "attack_flag", q: {false: ["0"]}},
					hasdamage: {get: (at) => char.isNpc ? !!at.attack_damage : !!at.dmgbase && at.dmgflag !== "0"},
					hasdamage2: {get: (at) => char.isNpc ? !!at.attack_damage2 : !!at.dmg2base && at.dmg2flag !== "0"},
					damagetype: {pc: "dmgtype", npc: "attack_damagetype"},
					damagetype2: {pc: "dmg2type", npc: "attack_damagetype2"},
					profbonus: {pc: "atkprofflag", q: {false: ["0"]}},
				}[param];
				const val = char.isNpc ? this[attr?.npc] : this[attr?.pc];
				if (attr.get) return attr.get(this);
				else if (!attr.q) return val;
				else return attr.q.true?.includes(val) || (attr.q.false && !attr.q.false.includes(val));
			},
			function (param) {
				const char = d20plus.ba.getSingleChar();
				const attr = {
					hasattack: {get: (sp) => !!sp.spellattack && sp.spellattack !== "None"},
					hasdamage: {get: (sp) => !!sp.spelldamage || !!sp.spelldamage2},
					hasdamageorhealing: {get: (sp) => !!sp.spelldamage || !!sp.spelldamage2 || !!sp.spellhealing},
					hassave: {get: (sp) => !!sp.spellsave && sp.spellsave !== ""},
				}[param];
				const val = char.isNpc ? this[attr?.npc] : this[attr?.pc];
				if (attr.get) return attr.get(this);
				else if (!attr.q) return val;
				else return attr.q.true?.includes(val) || (attr.q.false && !attr.q.false.includes(val));
			},
			*/
		}

		this.sheet = {
			get: (q) => {
				for (let i = 0; i < Object.keys(types).length; i++) {
					const list = this.sheet.data[types[Object.keys(types)[i]].id];
					if (list && list[q]) return Object.assign({_id: q}, types[Object.keys(types)[i]].utils || {}, list[q]);
				}
				return this.sheet.data.stats?._ref && getStats(q);
			},
			getSpells: (lvl) => {
				const all = this.sheet.data.spells || {};
				return Object.keys(all).reduce((spls, id) => {
					if (
						(lvl && all[id].lvl !== lvl)
						|| all[id]._ref.innate?.attributes.current
					) return spls;
					spls.push(Object.assign({}, types.spells.utils || {}, all[id]));
					return spls;
				}, []);
			},
			getTraits: () => {
				const all = Object.assign({},
					this.sheet.data.traits || {},
					this.sheet.data.spells || {},
					(this.isNpc && this.sheet.data.actions) || {},
				);
				return Object.keys(all).reduce((trts, id) => {
					if (all[id].isTrait) {
						trts.push(Object.assign({}, types.traits.utils || {}, all[id]));
					} else if (all[id]._ref.innate?.attributes.current) {
						trts.push(Object.assign({}, types.spells.utils || {}, all[id]));
					} else if (this.isNpc
							&& all[id]._ref.attack_flag
							&& all[id]._ref.attack_flag.attributes.current !== "on") {
						trts.push(Object.assign({}, types.actions.utils || {}, all[id]));
					}
					return trts;
				}, []);
			},
			getAttacks: () => {
				const all = this.isNpc
					? this.sheet.data.actions || {}
					: this.sheet.data.attacks || {};
				const utils = this.isNpc
					? types.actions.utils || {}
					: types.attacks.utils || {};
				return Object.keys(all).reduce((atks, id) => {
					if (
						(this.isNpc && all[id]._ref.attack_flag?.attributes.current === "on")
						|| (!this.isNpc && !all[id].spellid)
					) atks.push(Object.assign({}, utils || {}, all[id]));
					return atks;
				}, []);
			},
			getItems: () => {
				const all = this.isNpc
					? {}
					: this.sheet.data.items || {};
				const utils = types.items.utils || {};
				return Object.keys(all).reduce((atks, id) => {
					if (
						(this.isNpc && all[id].attack_flag === "on")
						|| (!this.isNpc && !all[id].spellid)
					) atks.push(Object.assign({}, utils || {}, all[id]));
					return atks;
				}, []);
			},
			getResources: (name) => {
				const resources = {};
				[["default", {}]].concat(Object.entries(this.sheet.data.resources || {})).forEach(([id, r]) => {
					const isDefault = id === "default";
					const pair = isDefault ? ["other", "class"] : ["left", "right"];
					pair.forEach(n => {
						const pointer = isDefault ? `${n}_resource` : `resource_${n}`;
						const stack = isDefault ? this.sheet.data.stats._ref : r._ref;
						const name = stack[`${pointer}_name`]?.attributes.current;
						const num = String(stack[pointer]?.attributes.current);
						const pb = !!stack[`${pointer}_use_pb`]?.attributes.current
							&& stack[`${pointer}_use_pb`].attributes.current !== "0";
						if (num !== undefined && name) {
							resources[name] = {
								_ref: {
									name: stack[`${pointer}_name`],
									resource: stack[pointer],
									pb: stack[`${pointer}_use_pb`],
								},
								name: name,
								current: num,
								type: isDefault ? "resource" : "repeated",
								side: n,
								max: pb ? this.sheet.get("pb") : stack[pointer].attributes.max,
							};
						}
					});
				});
				return name ? resources[name] : resources;
			},
			getRollModifier: (r) => {
				const r20q = /.*@{(?<attr>[^}]*)}.*/g;
				return r?.split("+").reduce((res, attr) => {
					return res + (Number(attr.replace(r20q, (...s) => this.sheet.get(s.last().attr))) || 0);
				}, 0) || 0;
			},
			fetch: () => {
				// d20plus.ut.log("Fetching character", this.sheet.fetched, this._ref.attribs.models.length)
				if (this.sheet.fetched !== this._ref.attribs.models.length) {
					this.sheet.fetched = this._ref.attribs.models.length;
					fetchAttribs();
				}
			},
			data: {
				stats: {},
				npcStats: {},
				spellslots: {},
			},
			spellSlots: {
				current: (lvl) => {
					return this.sheet.data.spellslots
					&& (this.sheet.data.spellslots[lvl]?._ref.expended?.attributes.current
					|| this.sheet.data.spellslots[lvl]?._ref.total?.attributes.current
					|| 0);
				},
				expended: (lvl) => {
					const calc = this.sheet.data.spellslots && (
						(this.sheet.data.spellslots[lvl]?._ref.total?.attributes.current || 0)
						- (this.sheet.data.spellslots[lvl]?._ref.expended?.attributes.current || 0));
					return calc >= 0 ? calc : 0;
				},
				max: (lvl) => {
					return this.sheet.data.spellslots
						&& (this.sheet.data.spellslots[lvl]?._ref.total?.attributes.current || 0);
				},
				expend: (lvl) => {
					void 0;
				},
			},
			fetched: 0,
		};

		this.ready = async () => {
			return new Promise(resolve => {
				let inProgress = 0;
				const wait = setInterval(() => {
					const statsFetched = Object.keys(this.sheet.data.stats).length > 1;
					inProgress++;
					if (statsFetched) resolve(true);
					if (statsFetched || inProgress > 120) {
						resolve(false);
						clearInterval(wait);
					}
				}, 30);
			});
		}

		this.refresh = () => {
			if (d20plus.ba.current.singleChar?.character?.id !== this.id) return;
			this.sheet.fetch();
			this.sheet.data.stats?._ref && d20plus.ba.menu.refresh();
		};

		const init = async () => {
			const gotToken = !ref.attribs;
			if (gotToken && !ref.character && !ref._model?.character) return;

			this._ref = ref._model?.character || ref.character || ref;
			this.refLastToken = gotToken && (ref._model || ref);
			this.id = this._ref.id;

			await d20plus.ut.fetchCharAttribs(this._ref, true);
			d20plus.ut.injectCode(
				this._ref.attribs._callbacks.change.next,
				"callback",
				(callback, p) => {
					callback(...p);
					setTimeout(this.refresh, 100);
				},
			);

			d20plus.ba.characters.push(this);
			this.sheet.fetch();
			this.refresh();
		}

		init();
	}

	d20plus.ba.tokens.Connector = function (ref) {
		const getHP = (max) => {
			return !max
				? this._ref.attributes[`bar${this.hp.bar}_value`]
				: this._ref.attributes[`bar${this.hp.bar}_max`];
		};

		this.hp = {
			checkMode: () => {
				this.hp.connected = false;
				this.hp.bar = Number(d20plus.cfg.getOrDefault("chat", "dmgTokenBar"));
				for (let i = 1; i < 4; i++) {
					const attr = this._ref.attributes[`bar${i}_link`];
					if (attr && this.character?.sheet.data.stats?._ref?.hp.id === attr) {
						this.hp.connected = true;
						this.hp.bar = i;
					}
				}
			},
			reduce: () => {
				void 0;
			},
		}

		this.refresh = () => {
			if (!d20plus.ba.current.charTokens?.find(t => this.id === t.id)) return;
			// d20plus.ut.log("Fetching token", this.get("name"), this.character.sheet.fetched, this.character._ref.attribs.models.length)
			this.hp.checkMode();
			d20plus.ba.menu.refresh();
		}

		this.select = () => {
			d20.engine.select(this._object);
		}

		this.find = () => {
			d20.engine.centerOnPoint(this._ref?.attributes?.left || 0, this._ref?.attributes?.top || 0);
			// d20.token_editor.removeRadialMenu();
		}

		this.get = (q) => {
			switch (q) {
				case "image": return this._ref.attributes.imgsrc;
				case "npc": return this.character?.isNpc;
				case "hp": return getHP();
				case "hp_max": return getHP("max");
				case "name": return this._ref.attributes.name || "";
				case "char_name": return this._ref.character.attributes.name || "";
				case "npc_name": return this.character?.sheet.get("name") || "";
				case "spells": return this.character?.sheet.getSpells();
				case "attacks": return this.character?.sheet.getAttacks();
				case "items": return this.character?.sheet.getItems();
				case "traits": return this.character?.sheet.getTraits();
				default: return this.character?.sheet.get(q);
			}
		}

		this.ready = async () => {
			return new Promise(resolve => {
				let inProgress = 0;
				const wait = setInterval(() => {
					const statsFetched = Object.keys(this.character?.sheet?.data.stats || {}).length > 1;
					inProgress++;
					if (statsFetched) resolve(true);
					if (statsFetched || inProgress > 120) {
						resolve(false);
						clearInterval(wait);
					}
				}, 30);
			});
		}

		const init = async () => {
			if ((ref?._model?.attributes || ref?.attributes)?.type !== "image") return;
			if (!(ref?._model?.character || ref?.character)?.id) return;
			this._ref = ref._model || ref;
			this._object = ref._model
				? ref
				: d20.engine.canvas.getObjects()?.find(t => t._model?.id === this._ref.id);
			this.id = this._ref.id;

			const char = d20plus.ba.characters.get(this._ref.character.id);
			this.character = char || await new d20plus.ba.characters.Connector(this._ref);
			this.mods = {
				general: {},
				stats: {},
				skills: {},
				attacks: {},
				spells: {filter: true},
				items: {filter: true},
				traits: {filter: true},
			};

			d20plus.ba.tokens.push(this);
			this.refresh();
		}

		init();
	}

	d20plus.ba.initCharacters = () => {
		const get = function (ref) {
			return Object.isObject(ref)
				? this.find(it => it.id === ref.id
					|| it.id === ref._model?.id
					|| it.id === ref.character?.id
					|| it.id === ref._model?.character?.id)
				: this.find(it => it.id === ref);
		}

		const ready = function (ref) {
			const isToken = !!this.getCurrent;
			if ((isToken && !ref?.id
					&& !ref._model.id
					&& !ref.character
					&& !ref._model?.character)
				|| (!isToken && !ref?.id
					&& !ref.attribs)) return;

			const existing = this.get(ref.id || this._model?.id);
			const created = existing || new this.Connector(ref);

			existing?.refresh();
			return existing || created;
		}

		d20plus.ba.tokens.get = get;
		d20plus.ba.characters.get = get;

		d20plus.ba.tokens.ready = ready;
		d20plus.ba.characters.ready = ready;

		d20plus.ba.tokens.getCurrent = () => {
			return d20plus.ba.tokens.get(d20plus.ba.current.singleChar?.id);
		}

		d20plus.ba.tokens.focusCurrent = () => {
			const token = d20plus.ba.tokens.getCurrent();
			d20.engine.unselect();
			token?.find();
			token?.select();
		}

	}

	window.d20debug = {
		qattr: (q) => {
			d20plus.ba.characters.forEach(ch => d20plus.ut.log(ch.name.tk, ch.sheet.get(q)));
			d20plus.ut.log(`Quering ${q}: ${d20plus
				.ba.characters
				.reduce((r, ch) => `${r}\n${ch.name.ch}:\t ${ch.sheet.get(q)}`, "")
			}`);
		},
	}
}

SCRIPT_EXTENSIONS.push(baseBACharacters);