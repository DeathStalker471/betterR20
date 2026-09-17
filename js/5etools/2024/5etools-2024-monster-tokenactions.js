function d20plus2024MonsterTokenActions() {
	d20plus.monsters = d20plus.monsters || {};

	// Bare macro token — resolved live by Roll20 against the selected token's
	// character, same as every other @{selected|...} reference in this file.
	const CHAR_NAME_REF = "@{selected|character_name}";

	// 2024 ability names cannot contain spaces or the special characters
	// "()?/\" (all confirmed live to silently fail to save, unlike 2014 where
	// names like "Saving Throw" or "DR/Immunities" work fine) — strip those,
	// collapse whitespace into hyphens, then tidy up any resulting duplicate
	// or edge hyphens (e.g. "Legendary Resistance (3/Day)" would otherwise
	// leave a dangling "Legendary-Resistance-").
	const sanitizeName = (name) => (name || "")
		.replace(/[()?/\\]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");

	// Roll20's repeating_npcaction/-bonusaction/-reaction/-l/-m accessor family only
	// indexes true "Attack"-type integrants - never plain "Action"-type ones like
	// Multiattack or a monster's own Spellcasting summary - sorted ALPHABETICALLY BY
	// NAME (confirmed live against a real Bone Knight import). Critically, a prepared
	// spell with an attack roll or forced save generates its own Attack integrant
	// (via import2024Spell, run by import2024Spells) alongside any weapon attacks, and
	// competes for the same position sequence - so positions can only be computed here,
	// from the live store, after spells have actually been imported (see
	// 5etools-monsters.js, which now awaits import2024Spells before calling this).
	function getLiveIntegrants (character) {
		const storeAttr = character.attribs && character.attribs.find(a => a.get("name") === "store");
		if (!storeAttr) return [];
		let store = storeAttr.get("current");
		if (typeof store === "string") {
			try { store = JSON.parse(store); } catch (e) { return []; }
		}
		return Object.values((store && store.integrants && store.integrants.integrants) || {});
	}

	// Returns a Map of integrant name -> 0-based position among same-actionType Attacks.
	function getAttackPositions (character, actionType) {
		const names = getLiveIntegrants(character)
			.filter(i => i.type === "Attack" && i.actionType === actionType)
			.map(i => i.name)
			.sort((a, b) => a.localeCompare(b));
		const map = new Map();
		names.forEach((name, i) => { if (!map.has(name)) map.set(name, i); });
		return map;
	}

	// A prepared spell with an attack roll or forced save gets its own Attack integrant
	// alongside its Spell integrant (both sharing the spell's name) - neither
	// build2024Store/translateOGLTo2024Store nor import2024Spell record these anywhere
	// tokenActionMeta can see, since they only exist once import2024Spells has actually
	// run. Identified here by name-matching against the store's Spell integrants, so
	// each one can get its own quick token action too (gated by tokenactionsSpells).
	function getSpellDerivedAttacks (character) {
		const ints = getLiveIntegrants(character);
		const spellNames = new Set(ints.filter(i => i.type === "Spell").map(i => i.name));
		return ints
			.filter(i => i.type === "Attack" && spellNames.has(i.name))
			.map(i => ({ name: i.name, actionType: i.actionType }));
	}

	/**
	 * Create Token Action custom abilities for a 2024-store NPC, gated by the
	 * same `tokenactions*` config flags as the 2014 (OGL) importer.
	 *
	 * @param character   Roll20 character model to attach abilities to.
	 * @param tokenActionMeta  { traits, actions, bonusActions, reactions,
	 *   legendaryActions, mythicActions, spellcasting } — each an array of
	 *   {id (shortID), name, isAttack, desc?}, as produced by build2024Store /
	 *   translateOGLTo2024Store. `isAttack` says whether this integrant has a
	 *   real attack-roll/damage chain (and is therefore positionally
	 *   addressable at all - see getAttackPositions above) or is a plain
	 *   descriptive Action/Bonus Action/Reaction/Legendary/Mythic entry (baked
	 *   as name+description text instead, same as a Trait). `id`/shortID is
	 *   kept only for reference/debugging.
	 * @param extra  { legendaryActionCount, sensesText, languagesText,
	 *   vulnerabilitiesText } — the handful of values with no live 2024-sheet
	 *   attribute, computed once by the caller from whatever source data it has
	 *   (raw 5etools JSON on the main import path, flat OGL attributes on the
	 *   module-import path).
	 */
	d20plus.monsters.import2024TokenActions = function (character, tokenActionMeta, extra) {
		if (!tokenActionMeta) return;
		extra = extra || {};

		const cfg = (key) => d20plus.cfg.getOrDefault("import", key);
		const makeAbility = (name, action) => character.abilities.create({ name, istokenaction: true, action });
		const bake = (name, desc) => d20plus.macro.actionMacroTrait2024(CHAR_NAME_REF, name, desc || "");

		// Traits — no live roll accessor exists for repeating_npctrait (its
		// "name"/"description" sub-fields both error on the 2024 sheet), so
		// bake the already-rendered name/desc text.
		if (cfg("tokenactionsTraits")) {
			(tokenActionMeta.traits || []).forEach(t => {
				makeAbility(sanitizeName(t.name), bake(t.name, t.desc));
			});
		}

		// Actions / Bonus Actions / Reactions — Attack-type entries are live,
		// addressed by their position among same-actionType Attack integrants;
		// plain Action-type entries (e.g. Multiattack) have no live roll and
		// get baked instead.
		if (cfg("tokenactions")) {
			const actionPos = getAttackPositions(character, "Action");
			(tokenActionMeta.actions || []).forEach((a, i) => {
				const label = `${i}-${sanitizeName(a.name)}`;
				if (a.isAttack && actionPos.has(a.name)) {
					makeAbility(label, d20plus.macro.actionMacroAction2024("repeating_npcaction", actionPos.get(a.name)));
				} else {
					makeAbility(label, bake(a.name, a.desc));
				}
			});

			const bonusPos = getAttackPositions(character, "Bonus Action");
			(tokenActionMeta.bonusActions || []).forEach((a, i) => {
				const label = `Bonus${i}-${sanitizeName(a.name)}`;
				if (a.isAttack && bonusPos.has(a.name)) {
					makeAbility(label, d20plus.macro.actionMacroAction2024("repeating_npcbonusaction", bonusPos.get(a.name)));
				} else {
					makeAbility(label, bake(a.name, a.desc));
				}
			});

			const reactionPos = getAttackPositions(character, "Reaction");
			(tokenActionMeta.reactions || []).forEach(a => {
				const label = `Reaction-${sanitizeName(a.name)}`;
				if (a.isAttack && reactionPos.has(a.name)) {
					makeAbility(label, d20plus.macro.actionMacroAction2024("repeating_npcreaction", reactionPos.get(a.name)));
				} else {
					makeAbility(label, bake(a.name, a.desc));
				}
			});
		}

		// Legendary / Mythic Actions
		const expanded = cfg("tokenactionsExpanded");
		const legendaryActions = tokenActionMeta.legendaryActions || [];
		const mythicActions = tokenActionMeta.mythicActions || [];

		// Non-attack entries (e.g. a legendary action that's just a skill check) have no
		// live position to reference - shown as inline described text instead of a roll link.
		const describeOrLink = (a, posMap, baseAction) => (a.isAttack && posMap.has(a.name))
			? `[${a.name}](~selected|${baseAction}_$${posMap.get(a.name)}_action)`
			: `**${a.name}.** ${a.desc || ""}`;

		if (cfg("tokenactions") && legendaryActions.length) {
			const legPos = getAttackPositions(character, "Legendary");
			if (expanded) {
				legendaryActions.forEach((a, i) => {
					const label = `Legendary${i}-${sanitizeName(a.name)}`;
					if (a.isAttack && legPos.has(a.name)) {
						makeAbility(label, d20plus.macro.actionMacroAction2024("repeating_npcaction-l", legPos.get(a.name)));
					} else {
						makeAbility(label, bake(a.name, a.desc));
					}
				});
			} else {
				const count = extra.legendaryActionCount || 3;
				const tokenactiontext = legendaryActions
					.map(a => describeOrLink(a, legPos, "repeating_npcaction-l"))
					.join("\n\r");
				makeAbility("Legendary-Actions", d20plus.macro.actionMacroLegendary2024(CHAR_NAME_REF, count, tokenactiontext));
			}
		}

		if (cfg("tokenactions") && mythicActions.length) {
			const mythPos = getAttackPositions(character, "Mythic");
			if (expanded) {
				mythicActions.forEach((a, i) => {
					const label = `Mythic${i}-${sanitizeName(a.name)}`;
					if (a.isAttack && mythPos.has(a.name)) {
						makeAbility(label, d20plus.macro.actionMacroAction2024("repeating_npcaction-m", mythPos.get(a.name)));
					} else {
						makeAbility(label, bake(a.name, a.desc));
					}
				});
			} else {
				const tokenactiontext = mythicActions
					.map(a => describeOrLink(a, mythPos, "repeating_npcaction-m"))
					.join("\n\r");
				makeAbility("Mythic-Actions", d20plus.macro.actionMacroMythic2024(CHAR_NAME_REF, tokenactiontext));
			}
		}

		// Spellcasting — always a plain Action/Bonus Action/Reaction summary (never a
		// real attack/save itself), so it's always baked as name+description text.
		if (cfg("tokenactionsSpells")) {
			(tokenActionMeta.spellcasting || []).forEach(sc => {
				makeAbility(sanitizeName(sc.name), bake(sc.name, sc.desc));
			});

			// Individual prepared spells with their own attack roll or forced save (e.g.
			// Command, Crown of Madness) - unlike the summary above, these ARE real Attack
			// integrants, so they're addressed positionally like any weapon attack.
			const attackTypeToBase = {
				"Action": "repeating_npcaction",
				"Bonus Action": "repeating_npcbonusaction",
				"Reaction": "repeating_npcreaction",
			};
			getSpellDerivedAttacks(character).forEach(sa => {
				const baseAction = attackTypeToBase[sa.actionType];
				if (!baseAction) return;
				const pos = getAttackPositions(character, sa.actionType).get(sa.name);
				if (pos == null) return;
				makeAbility(`Spell-${sanitizeName(sa.name)}`, d20plus.macro.actionMacroAction2024(baseAction, pos));
			});
		}

		// Skills / Saves / Ability Checks / Initiative — fully live, no
		// per-monster computation needed.
		if (cfg("tokenactionsSkills")) makeAbility("Skill-Check", d20plus.macro.actionMacroSkillCheck2024);
		if (cfg("tokenactionsSaves")) makeAbility("Saving-Throw", d20plus.macro.actionMacroSaves2024);
		if (cfg("tokenactionsChecks")) makeAbility("Ability-Check", d20plus.macro.actionMacroAbilityCheck2024);
		if (cfg("tokenactionsInitiative")) makeAbility("Initiative", d20plus.macro.actionMacroInit2024);

		// Perception — live roll (npc_perception), senses text baked (no live
		// npc_senses attribute exists on the 2024 sheet).
		if (cfg("tokenactionsPerception")) {
			makeAbility("Perception", d20plus.macro.actionMacroPerception2024(extra.sensesText || ""));
		}

		// DR/Immunities + Stats — mostly live; vulnerabilities/languages baked
		// (no live npc_vulnerabilities/npc_languages attributes exist).
		if (cfg("tokenactionsOther")) {
			makeAbility("DR/Immunities", d20plus.macro.actionMacroDrImmunities2024(extra.vulnerabilitiesText || ""));
			makeAbility("Stats", d20plus.macro.actionMacroStats2024(extra.languagesText || ""));
		}
	};
}
SCRIPT_EXTENSIONS.push(d20plus2024MonsterTokenActions);
