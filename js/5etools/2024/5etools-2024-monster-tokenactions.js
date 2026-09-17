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

	/**
	 * Create Token Action custom abilities for a 2024-store NPC, gated by the
	 * same `tokenactions*` config flags as the 2014 (OGL) importer.
	 *
	 * @param character   Roll20 character model to attach abilities to.
	 * @param tokenActionMeta  { traits, actions, bonusActions, reactions,
	 *   legendaryActions, mythicActions, spellcasting } — each an array of
	 *   {id (shortID), name, pos, desc?}, as produced by build2024Store /
	 *   translateOGLTo2024Store. `pos` is the 0-based positional index the
	 *   repeating_npc* legacy accessor's "action" sub-field actually needs —
	 *   confirmed live that raw shortID addressing does NOT resolve "action"
	 *   (only "name"), likely because actionDisplayOrder is deliberately left
	 *   empty. `id`/shortID is kept only for reference/debugging.
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

		// Traits — no live roll accessor exists for repeating_npctrait (its
		// "name"/"description" sub-fields both error on the 2024 sheet), so
		// bake the already-rendered name/desc text.
		if (cfg("tokenactionsTraits")) {
			(tokenActionMeta.traits || []).forEach(t => {
				makeAbility(sanitizeName(t.name), d20plus.macro.actionMacroTrait2024(CHAR_NAME_REF, t.name, t.desc || ""));
			});
		}

		// Actions / Bonus Actions / Reactions — live, addressed by position via
		// the repeating_npc* "legacy" accessor's "action" sub-field.
		if (cfg("tokenactions")) {
			(tokenActionMeta.actions || []).forEach((a, i) => {
				makeAbility(`${i}-${sanitizeName(a.name)}`, d20plus.macro.actionMacroAction2024("repeating_npcaction", a.pos));
			});
			(tokenActionMeta.bonusActions || []).forEach((a, i) => {
				makeAbility(`Bonus${i}-${sanitizeName(a.name)}`, d20plus.macro.actionMacroAction2024("repeating_npcbonusaction", a.pos));
			});
			(tokenActionMeta.reactions || []).forEach(a => {
				makeAbility(`Reaction-${sanitizeName(a.name)}`, d20plus.macro.actionMacroAction2024("repeating_npcreaction", a.pos));
			});
		}

		// Legendary / Mythic Actions
		const expanded = cfg("tokenactionsExpanded");
		const legendaryActions = tokenActionMeta.legendaryActions || [];
		const mythicActions = tokenActionMeta.mythicActions || [];

		if (cfg("tokenactions") && legendaryActions.length) {
			if (expanded) {
				legendaryActions.forEach((a, i) => {
					makeAbility(`Legendary${i}-${sanitizeName(a.name)}`, d20plus.macro.actionMacroAction2024("repeating_npcaction-l", a.pos));
				});
			} else {
				const count = extra.legendaryActionCount || 3;
				const tokenactiontext = legendaryActions
					.map(a => `[${a.name}](~selected|repeating_npcaction-l_$${a.pos}_action)`)
					.join("\n\r");
				makeAbility("Legendary-Actions", d20plus.macro.actionMacroLegendary2024(CHAR_NAME_REF, count, tokenactiontext));
			}
		}

		if (cfg("tokenactions") && mythicActions.length) {
			if (expanded) {
				mythicActions.forEach((a, i) => {
					makeAbility(`Mythic${i}-${sanitizeName(a.name)}`, d20plus.macro.actionMacroAction2024("repeating_npcaction-m", a.pos));
				});
			} else {
				const tokenactiontext = mythicActions
					.map(a => `[${a.name}](~selected|repeating_npcaction-m_$${a.pos}_action)`)
					.join("\n\r");
				makeAbility("Mythic-Actions", d20plus.macro.actionMacroMythic2024(CHAR_NAME_REF, tokenactiontext));
			}
		}

		// Spellcasting — a spellcasting trait is stored as a plain Action/Bonus
		// Action/Reaction integrant sharing that category's own position
		// counter (see build2024Store), so it uses whichever accessor prefix
		// was recorded for it, gated by its own flag instead of `tokenactions`.
		if (cfg("tokenactionsSpells")) {
			(tokenActionMeta.spellcasting || []).forEach(sc => {
				makeAbility(sanitizeName(sc.name), d20plus.macro.actionMacroAction2024(sc.baseAction || "repeating_npcaction", sc.pos));
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
