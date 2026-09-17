const baseMacro = function () {
	d20plus.macro = {};

	d20plus.macro.actionMacroTrait = function (index) {
		return `@{selected|wtype} &{template:npcaction} {{name=@{selected|npc_name}}} {{rname=@{selected|repeating_npctrait_$${index}_name}}} {{description=@{selected|repeating_npctrait_$${index}_desc} }}`;
	};

	d20plus.macro.actionMacroAction = function (baseAction, index) {
		return `%{selected|${baseAction}_$${index}_npc_action}`;
	};

	d20plus.macro.actionMacroReaction = function (index) {
		return `@{selected|wtype} &{template:npcaction} {{name=@{selected|npc_name}}} {{rname=@{selected|repeating_npcreaction_$${index}_name}}} {{description=@{selected|repeating_npcreaction_$${index}_desc} }} `;
	};

	d20plus.macro.actionMacroLegendary = function (tokenactiontext) {
		return `@{selected|wtype} @{selected|wtype}&{template:npcaction} {{name=@{selected|npc_name}}} {{rname=Legendary Actions}} {{description=The @{selected|npc_name} can take @{selected|npc_legendary_actions} legendary actions, choosing from the options below. Only one legendary option can be used at a time and only at the end of another creature's turn. The @{selected|npc_name} regains spent legendary actions at the start of its turn.\n\r${tokenactiontext}}} `;
	}

	d20plus.macro.actionMacroMythic = function (tokenactiontext) {
		return `@{selected|wtype} @{selected|wtype}&{template:npcaction} {{name=@{selected|npc_name}}} {{rname=Mythic Actions}} {{description=The @{selected|npc_name} can take @{selected|npc_legendary_actions} mythic actions, choosing from the options below. Only one mythic option can be used at a time and only at the end of another creature's turn. The @{selected|npc_name} regains spent mythic actions at the start of its turn.\n\r${tokenactiontext}}} `;
	}

	d20plus.macro.actionMacroPerception = "%{Selected|npc_perception} @{selected|wtype} &{template:default} {{name=Senses}}  @{selected|wtype} @{Selected|npc_senses} ";
	d20plus.macro.actionMacroInit = "%{selected|npc_init}";
	d20plus.macro.actionMacroDrImmunities = "@{selected|wtype} &{template:default} {{name=DR/Immunities}} {{Damage Resistance= @{selected|npc_resistances}}} {{Damage Vulnerability= @{selected|npc_vulnerabilities}}} {{Damage Immunity= @{selected|npc_immunities}}} {{Condition Immunity= @{selected|npc_condition_immunities}}} ";
	d20plus.macro.actionMacroStats = "@{selected|wtype} &{template:default} {{name=Stats}} {{Armor Class= @{selected|npc_AC}}} {{Hit Dice= @{selected|npc_hpformula}}} {{Speed= @{selected|npc_speed}}} {{Senses= @{selected|npc_senses}}} {{Languages= @{selected|npc_languages}}} {{Challenge= @{selected|npc_challenge}(@{selected|npc_xp}xp)}}";
	d20plus.macro.actionMacroSaves = "@{selected|wtype} &{template:simple}{{always=1}}?{Saving Throw?|STR,{{rname=Strength Save&#125;&#125;{{mod=@{npc_str_save}&#125;&#125; {{r1=[[1d20+@{npc_str_save}]]&#125;&#125;{{r2=[[1d20+@{npc_str_save}]]&#125;&#125;|DEX,{{rname=Dexterity Save&#125;&#125;{{mod=@{npc_dex_save}&#125;&#125; {{r1=[[1d20+@{npc_dex_save}]]&#125;&#125;{{r2=[[1d20+@{npc_dex_save}]]&#125;&#125;|CON,{{rname=Constitution Save&#125;&#125;{{mod=@{npc_con_save}&#125;&#125; {{r1=[[1d20+@{npc_con_save}]]&#125;&#125;{{r2=[[1d20+@{npc_con_save}]]&#125;&#125;|INT,{{rname=Intelligence Save&#125;&#125;{{mod=@{npc_int_save}&#125;&#125; {{r1=[[1d20+@{npc_int_save}]]&#125;&#125;{{r2=[[1d20+@{npc_int_save}]]&#125;&#125;|WIS,{{rname=Wisdom Save&#125;&#125;{{mod=@{npc_wis_save}&#125;&#125; {{r1=[[1d20+@{npc_wis_save}]]&#125;&#125;{{r2=[[1d20+@{npc_wis_save}]]&#125;&#125;|CHA,{{rname=Charisma Save&#125;&#125;{{mod=@{npc_cha_save}&#125;&#125; {{r1=[[1d20+@{npc_cha_save}]]&#125;&#125;{{r2=[[1d20+@{npc_cha_save}]]&#125;&#125;}{{charname=@{character_name}}} ";
	d20plus.macro.actionMacroSkillCheck = "@{selected|wtype} &{template:simple}{{always=1}}?{Ability?|Acrobatics,{{rname=Acrobatics&#125;&#125;{{mod=@{npc_acrobatics}&#125;&#125; {{r1=[[1d20+@{npc_acrobatics}]]&#125;&#125;{{r2=[[1d20+@{npc_acrobatics}]]&#125;&#125;|Animal Handling,{{rname=Animal Handling&#125;&#125;{{mod=@{npc_animal_handling}&#125;&#125; {{r1=[[1d20+@{npc_animal_handling}]]&#125;&#125;{{r2=[[1d20+@{npc_animal_handling}]]&#125;&#125;|Arcana,{{rname=Arcana&#125;&#125;{{mod=@{npc_arcana}&#125;&#125; {{r1=[[1d20+@{npc_arcana}]]&#125;&#125;{{r2=[[1d20+@{npc_arcana}]]&#125;&#125;|Athletics,{{rname=Athletics&#125;&#125;{{mod=@{npc_athletics}&#125;&#125; {{r1=[[1d20+@{npc_athletics}]]&#125;&#125;{{r2=[[1d20+@{npc_athletics}]]&#125;&#125;|Deception,{{rname=Deception&#125;&#125;{{mod=@{npc_deception}&#125;&#125; {{r1=[[1d20+@{npc_deception}]]&#125;&#125;{{r2=[[1d20+@{npc_deception}]]&#125;&#125;|History,{{rname=History&#125;&#125;{{mod=@{npc_history}&#125;&#125; {{r1=[[1d20+@{npc_history}]]&#125;&#125;{{r2=[[1d20+@{npc_history}]]&#125;&#125;|Insight,{{rname=Insight&#125;&#125;{{mod=@{npc_insight}&#125;&#125; {{r1=[[1d20+@{npc_insight}]]&#125;&#125;{{r2=[[1d20+@{npc_insight}]]&#125;&#125;|Intimidation,{{rname=Intimidation&#125;&#125;{{mod=@{npc_intimidation}&#125;&#125; {{r1=[[1d20+@{npc_intimidation}]]&#125;&#125;{{r2=[[1d20+@{npc_intimidation}]]&#125;&#125;|Investigation,{{rname=Investigation&#125;&#125;{{mod=@{npc_investigation}&#125;&#125; {{r1=[[1d20+@{npc_investigation}]]&#125;&#125;{{r2=[[1d20+@{npc_investigation}]]&#125;&#125;|Medicine,{{rname=Medicine&#125;&#125;{{mod=@{npc_medicine}&#125;&#125; {{r1=[[1d20+@{npc_medicine}]]&#125;&#125;{{r2=[[1d20+@{npc_medicine}]]&#125;&#125;|Nature,{{rname=Nature&#125;&#125;{{mod=@{npc_nature}&#125;&#125; {{r1=[[1d20+@{npc_nature}]]&#125;&#125;{{r2=[[1d20+@{npc_nature}]]&#125;&#125;|Perception,{{rname=Perception&#125;&#125;{{mod=@{npc_perception}&#125;&#125; {{r1=[[1d20+@{npc_perception}]]&#125;&#125;{{r2=[[1d20+@{npc_perception}]]&#125;&#125;|Performance,{{rname=Performance&#125;&#125;{{mod=@{npc_performance}&#125;&#125; {{r1=[[1d20+@{npc_performance}]]&#125;&#125;{{r2=[[1d20+@{npc_performance}]]&#125;&#125;|Persuasion,{{rname=Persuasion&#125;&#125;{{mod=@{npc_persuasion}&#125;&#125; {{r1=[[1d20+@{npc_persuasion}]]&#125;&#125;{{r2=[[1d20+@{npc_persuasion}]]&#125;&#125;|Religion,{{rname=Religion&#125;&#125;{{mod=@{npc_religion}&#125;&#125; {{r1=[[1d20+@{npc_religion}]]&#125;&#125;{{r2=[[1d20+@{npc_religion}]]&#125;&#125;|Sleight of Hand,{{rname=Sleight of Hand&#125;&#125;{{mod=@{npc_sleight_of_hand}&#125;&#125; {{r1=[[1d20+@{npc_sleight_of_hand}]]&#125;&#125;{{r2=[[1d20+@{npc_sleight_of_hand}]]&#125;&#125;|Stealth,{{rname=Stealth&#125;&#125;{{mod=@{npc_stealth}&#125;&#125; {{r1=[[1d20+@{npc_stealth}]]&#125;&#125;{{r2=[[1d20+@{npc_stealth}]]&#125;&#125;|Survival,{{rname=Survival&#125;&#125;{{mod=@{npc_survival}&#125;&#125; {{r1=[[1d20+@{npc_survival}]]&#125;&#125;{{r2=[[1d20+@{npc_survival}]]&#125;&#125;}{{charname=@{character_name}}} ";
	d20plus.macro.actionMacroAbilityCheck = "@{selected|wtype} &{template:simple}{{always=1}}?{Ability?|STR,{{rname=Strength&#125;&#125;{{mod=@{strength_mod}&#125;&#125; {{r1=[[1d20+@{strength_mod}]]&#125;&#125;{{r2=[[1d20+@{strength_mod}]]&#125;&#125;|DEX,{{rname=Dexterity&#125;&#125;{{mod=@{dexterity_mod}&#125;&#125; {{r1=[[1d20+@{dexterity_mod}]]&#125;&#125;{{r2=[[1d20+@{dexterity_mod}]]&#125;&#125;|CON,{{rname=Constitution&#125;&#125;{{mod=@{constitution_mod}&#125;&#125; {{r1=[[1d20+@{constitution_mod}]]&#125;&#125;{{r2=[[1d20+@{constitution_mod}]]&#125;&#125;|INT,{{rname=Intelligence&#125;&#125;{{mod=@{intelligence_mod}&#125;&#125; {{r1=[[1d20+@{intelligence_mod}]]&#125;&#125;{{r2=[[1d20+@{intelligence_mod}]]&#125;&#125;|WIS,{{rname=Wisdom&#125;&#125;{{mod=@{wisdom_mod}&#125;&#125; {{r1=[[1d20+@{wisdom_mod}]]&#125;&#125;{{r2=[[1d20+@{wisdom_mod}]]&#125;&#125;|CHA,{{rname=Charisma&#125;&#125;{{mod=@{charisma_mod}&#125;&#125; {{r1=[[1d20+@{charisma_mod}]]&#125;&#125;{{r2=[[1d20+@{charisma_mod}]]&#125;&#125;}{{charname=@{character_name}}} ";

	// ------------------------------------------------------------------
	// 2024 (Jumpgate) NPC sheet variants.
	//
	// The 2024 sheet stores monster data in one opaque "store" JSON attribute
	// with no flat attributes of its own, BUT the sheet itself computes and
	// exposes a family of classic-style flat attributes from that store purely
	// for macro/API backward compatibility (confirmed live against a real
	// Roll20 2024 NPC character). Repeating rows (actions/bonus actions/
	// reactions/legendary/mythic actions) are addressed via a "legacy
	// repeating" accessor, and support exactly two sub-fields: "name" and
	// "action" (NOT "npc_action", "roll", or "description" as on the 2014
	// sheet). Despite its own tooltip claiming positional-index-or-shortID
	// addressing, the "action" sub-field only actually resolves via a
	// positional index in "$N" form (confirmed live — a real shortID
	// produces "Action N not supported"; likely because actionDisplayOrder
	// is deliberately left empty, see build2024Store, and "action" — unlike
	// "name" — needs that ordering to compute its compound roll). "$N" here
	// mirrors the exact convention the 2014 macros already use for their own
	// repeating rows (see actionMacroAction above).
	// ------------------------------------------------------------------

	d20plus.macro.actionMacroAction2024 = function (baseAction, pos) {
		// baseAction: "repeating_npcaction" | "repeating_npcbonusaction" |
		//             "repeating_npcreaction" | "repeating_npcaction-l" |
		//             "repeating_npcaction-m"
		return `/w gm %{selected|${baseAction}_$${pos}_action}`;
	};

	d20plus.macro.actionMacroTrait2024 = function (charName, traitName, traitDesc) {
		return `/w gm &{template:default} {{name=${charName}}} {{${traitName}=${traitDesc}}}`;
	};

	d20plus.macro.actionMacroLegendary2024 = function (charName, count, tokenactiontext) {
		return `/w gm &{template:default} {{name=${charName}}} {{rname=Legendary Actions}} {{description=The ${charName} can take ${count} legendary actions, choosing from the options below. Only one legendary option can be used at a time and only at the end of another creature's turn. The ${charName} regains spent legendary actions at the start of its turn.\n\r${tokenactiontext}}}`;
	};

	d20plus.macro.actionMacroMythic2024 = function (charName, tokenactiontext) {
		return `/w gm &{template:default} {{name=${charName}}} {{rname=Mythic Actions}} {{description=${tokenactiontext}}}`;
	};

	d20plus.macro.actionMacroPerception2024 = function (sensesText) {
		return `/w gm %{selected|npc_perception} &{template:default} {{name=Senses}} {{Senses=${sensesText}}}`;
	};

	d20plus.macro.actionMacroInit2024 = "/w gm [[1d20+@{selected|initiative_bonus}]]";

	d20plus.macro.actionMacroDrImmunities2024 = function (vulnerabilitiesText) {
		return `/w gm &{template:default} {{name=DR/Immunities}} {{Resistance=@{selected|npc_resistances}}} {{Vulnerability=${vulnerabilitiesText}}} {{Immunity=@{selected|npc_immunities}}} {{Condition Immunity=@{selected|npc_condition_immunities}}}`;
	};

	d20plus.macro.actionMacroStats2024 = function (languagesText) {
		return `/w gm &{template:default} {{name=Stats}} {{Armor Class=@{selected|npc_ac}}} {{Hit Dice=@{selected|npc_hpformula}}} {{Speed=@{selected|npc_speed}}} {{Languages=${languagesText}}} {{Challenge=@{selected|npc_challenge} (@{selected|npc_xp} xp)}}`;
	};

	d20plus.macro.actionMacroSaves2024 = "&{template:default}?{Saving Throw?|STR,{{rname=Strength Save&#125;&#125;{{mod=@{selected|npc_str_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_str_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_str_save}]]&#125;&#125;|DEX,{{rname=Dexterity Save&#125;&#125;{{mod=@{selected|npc_dex_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_dex_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_dex_save}]]&#125;&#125;|CON,{{rname=Constitution Save&#125;&#125;{{mod=@{selected|npc_con_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_con_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_con_save}]]&#125;&#125;|INT,{{rname=Intelligence Save&#125;&#125;{{mod=@{selected|npc_int_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_int_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_int_save}]]&#125;&#125;|WIS,{{rname=Wisdom Save&#125;&#125;{{mod=@{selected|npc_wis_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_wis_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_wis_save}]]&#125;&#125;|CHA,{{rname=Charisma Save&#125;&#125;{{mod=@{selected|npc_cha_save}&#125;&#125; {{r1=[[1d20+@{selected|npc_cha_save}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_cha_save}]]&#125;&#125;}{{charname=@{selected|character_name}}} ";

	d20plus.macro.actionMacroSkillCheck2024 = "&{template:default}?{Skill?|Acrobatics,{{rname=Acrobatics&#125;&#125;{{mod=@{selected|npc_acrobatics}&#125;&#125; {{r1=[[1d20+@{selected|npc_acrobatics}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_acrobatics}]]&#125;&#125;|Animal Handling,{{rname=Animal Handling&#125;&#125;{{mod=@{selected|npc_animal_handling}&#125;&#125; {{r1=[[1d20+@{selected|npc_animal_handling}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_animal_handling}]]&#125;&#125;|Arcana,{{rname=Arcana&#125;&#125;{{mod=@{selected|npc_arcana}&#125;&#125; {{r1=[[1d20+@{selected|npc_arcana}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_arcana}]]&#125;&#125;|Athletics,{{rname=Athletics&#125;&#125;{{mod=@{selected|npc_athletics}&#125;&#125; {{r1=[[1d20+@{selected|npc_athletics}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_athletics}]]&#125;&#125;|Deception,{{rname=Deception&#125;&#125;{{mod=@{selected|npc_deception}&#125;&#125; {{r1=[[1d20+@{selected|npc_deception}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_deception}]]&#125;&#125;|History,{{rname=History&#125;&#125;{{mod=@{selected|npc_history}&#125;&#125; {{r1=[[1d20+@{selected|npc_history}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_history}]]&#125;&#125;|Insight,{{rname=Insight&#125;&#125;{{mod=@{selected|npc_insight}&#125;&#125; {{r1=[[1d20+@{selected|npc_insight}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_insight}]]&#125;&#125;|Intimidation,{{rname=Intimidation&#125;&#125;{{mod=@{selected|npc_intimidation}&#125;&#125; {{r1=[[1d20+@{selected|npc_intimidation}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_intimidation}]]&#125;&#125;|Investigation,{{rname=Investigation&#125;&#125;{{mod=@{selected|npc_investigation}&#125;&#125; {{r1=[[1d20+@{selected|npc_investigation}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_investigation}]]&#125;&#125;|Medicine,{{rname=Medicine&#125;&#125;{{mod=@{selected|npc_medicine}&#125;&#125; {{r1=[[1d20+@{selected|npc_medicine}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_medicine}]]&#125;&#125;|Nature,{{rname=Nature&#125;&#125;{{mod=@{selected|npc_nature}&#125;&#125; {{r1=[[1d20+@{selected|npc_nature}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_nature}]]&#125;&#125;|Perception,{{rname=Perception&#125;&#125;{{mod=@{selected|npc_perception}&#125;&#125; {{r1=[[1d20+@{selected|npc_perception}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_perception}]]&#125;&#125;|Performance,{{rname=Performance&#125;&#125;{{mod=@{selected|npc_performance}&#125;&#125; {{r1=[[1d20+@{selected|npc_performance}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_performance}]]&#125;&#125;|Persuasion,{{rname=Persuasion&#125;&#125;{{mod=@{selected|npc_persuasion}&#125;&#125; {{r1=[[1d20+@{selected|npc_persuasion}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_persuasion}]]&#125;&#125;|Religion,{{rname=Religion&#125;&#125;{{mod=@{selected|npc_religion}&#125;&#125; {{r1=[[1d20+@{selected|npc_religion}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_religion}]]&#125;&#125;|Sleight of Hand,{{rname=Sleight of Hand&#125;&#125;{{mod=@{selected|npc_sleight_of_hand}&#125;&#125; {{r1=[[1d20+@{selected|npc_sleight_of_hand}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_sleight_of_hand}]]&#125;&#125;|Stealth,{{rname=Stealth&#125;&#125;{{mod=@{selected|npc_stealth}&#125;&#125; {{r1=[[1d20+@{selected|npc_stealth}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_stealth}]]&#125;&#125;|Survival,{{rname=Survival&#125;&#125;{{mod=@{selected|npc_survival}&#125;&#125; {{r1=[[1d20+@{selected|npc_survival}]]&#125;&#125;{{r2=[[1d20+@{selected|npc_survival}]]&#125;&#125;}{{charname=@{selected|character_name}}} ";

	// Reused verbatim — already uses the generic strength_mod..charisma_mod
	// attributes, confirmed present on the 2024 sheet too (via charisma_mod).
	d20plus.macro.actionMacroAbilityCheck2024 = d20plus.macro.actionMacroAbilityCheck;
};

SCRIPT_EXTENSIONS.push(baseMacro);
