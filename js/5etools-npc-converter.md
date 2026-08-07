# 5etools NPC Converter

## Purpose

This feature adds a focused conversion path for existing **D&D 5e 2014 NPC/Creature sheets** in Roll20 into new **D&D 5e 2024 NPC sheet** journal entries.

The converter is intended to:

- reuse as much existing NPC data as possible;
- create a **new** Journal character rather than overwriting the original;
- stay isolated from the rest of the codebase as much as possible;
- depend on existing betteR20 core + 5e functionality instead of introducing a second import pipeline.

The current implementation lives in:

- `js/5etools-npc-converter.js`

It is built into the `5etools` and `5et2014` userscripts by:

- `node/build-scripts.js`

## High-Level Design

The converter is intentionally lightweight.

Instead of building a brand-new 2024 NPC writer from scratch, it reuses the existing 2024 translation layer already present in:

- `js/5etools-2024-import.js`

The core flow is:

1. The user opens an existing Roll20 character which is expected to be a **2014 NPC sheet**.
2. The user clicks **Convert 2014 NPC to 2024 Copy**.
3. The converter reads the source character attributes and validates that it looks like a 2014 NPC.
4. The existing `d20plus.importer.translateOGLTo2024Store(...)` helper is used to produce a 2024-style `store` blob.
5. A **new** Roll20 Journal character is created.
6. The new character is given the attributes needed for a 2024 NPC-style setup.
7. The translated `store` blob is written to the new character.
8. Bio / GM notes / avatar / default token / permissions are copied where possible.
9. The new character is placed in the same Journal folder when that can be resolved.

## Why This Approach Was Chosen

This approach keeps the change surface small.

Benefits:

- most new logic lives in a new dedicated file;
- existing import and 2024 data model logic is reused instead of duplicated;
- original NPC sheets are preserved for safety and comparison;
- the feature remains easy to remove, refactor, or move later.

This also reduces the risk of breaking existing 2014 or 2024 import behavior, because the converter is mostly an orchestration layer around code that already knows how to build 2024 `store` data.

## Roll20 User Workflow

### Prerequisites

Expected environment:

- Roll20 game with betteR20 userscripts enabled;
- the target game has the **D&D 5e 2024 sheet** available for use;
- the source character is an existing **2014 NPC** character in the Journal.

### How to Use

1. Open the source NPC character in Roll20.
2. In the character editor, find the converter button near the JSON import/export controls.
3. Click **Convert 2014 NPC to 2024 Copy**.
4. Confirm the prompt.
5. A new Journal character is created with the name:
   - `Original Name (2024)`
6. Open the new character and review the converted data.

### Expected Result

The new character should:

- remain separate from the original 2014 NPC;
- contain a 2024-compatible `store` payload;
- keep copied ownership/journal visibility where available;
- keep copied bio and GM notes;
- reuse avatar/default token data where available.

## What Data Is Intended to Carry Over

The converter currently aims to preserve or translate these categories:

- NPC name
- creature type / size / alignment
- armor class
- hit points
- challenge rating
- speeds
- senses
- languages
- damage vulnerabilities / resistances / immunities
- condition immunities
- traits
- actions
- reactions
- legendary actions
- mythic actions
- repeating spell data already present on the source NPC sheet
- avatar / token representation where possible
- bio / GM notes
- journal permissions / visibility fields

## Current Detection Rules

The converter currently treats a character as a valid source when it appears to be:

- an NPC (`npc = 1`), and
- a sheet with the expected 2014/OGL NPC attribute shape.

It refuses conversion when the source already appears to be:

- a 2024 NPC sheet, or
- a character that does not look like a supported 2014 NPC.

## Expected Limitations

This feature is intentionally conservative and currently has a number of expected limits.

### 1. It is not a universal character-sheet converter

This is for **NPC/Creature sheets** only.

It is not intended to convert:

- player characters,
- arbitrary homebrew sheet layouts,
- non-5e sheets,
- Shaped/community sheet variants that do not expose the expected 2014 NPC attribute pattern.

### 2. Conversion quality depends on source attribute quality

The converter does not reconstruct missing meaning that was never stored in the original Roll20 sheet.

If a source NPC has incomplete or unusual attribute data, the 2024 result may also be incomplete.

### 3. The 2024 result is based on attribute translation, not a compendium re-import

The feature translates the existing Roll20 NPC state into the 2024 `store` format.

It does **not** currently:

- look up the creature fresh from 5etools source JSON by name;
- reconcile differences between 2014 and 2024 monster rules;
- upgrade monster design to modern 2024 rules text;
- guarantee parity with native Roll20 2024 sheet authoring output.

### 4. Some fields map approximately rather than perfectly

Some data in the 2014 NPC sheet and the 2024 `store` model do not align exactly.

Examples include:

- action modeling details;
- richer attack metadata;
- nuanced spell relationships;
- presentation and ordering details;
- any fields the 2024 sheet derives internally rather than storing 1:1 from OGL attributes.

### 5. Folder placement is best-effort

The converter attempts to place the new Journal item into the same folder as the source.

If that folder cannot be resolved, the conversion should still succeed, but the new character may not land in the exact same place.

### 6. Default token behavior depends on what Roll20 exposes

Avatar/default token reuse is best-effort and depends on the character data available through Roll20 at conversion time.

### 7. Review is still expected after conversion

The feature is intended to save time, not eliminate review.

Users should still manually inspect:

- actions,
- spell blocks,
- defenses,
- token settings,
- descriptive text,
- any important custom NPC behavior.

## Integration Footprint

The implementation was kept intentionally small.

Direct integration points are:

- `js/5etools-npc-converter.js` — feature implementation
- `js/5etools-bootstrap.js` — button handler initialization
- `js/templates/template-roll20-editors-misc.js` — UI button placement
- `node/build-scripts.js` — userscript build inclusion

The goal is that future maintainers can:

- review the feature in isolation;
- move it elsewhere later if desired;
- replace the internals without affecting unrelated systems.

## Future Improvement Ideas

Possible future work:

- clearer user-facing error messaging for unsupported source sheets;
- explicit logging/reporting of which fields could not be mapped;
- stronger detection for mixed/custom 2014 sheet variants;
- better spell/action fidelity in the translated 2024 `store`;
- support for richer token/bar migration behavior;
- optional post-conversion validation helpers.

## Session Learnings

The following points were learned or confirmed while building and testing the converter against live Roll20 data.

### 1. The safest architecture is to reuse the existing 2024 store translator

The converter works best as a thin orchestration layer around:

- `d20plus.importer.translateOGLTo2024Store(...)`

Trying to build a separate 2024 NPC writer would have duplicated logic and made it harder to keep behavior aligned with the rest of the 2024 import path.

### 2. A valid 2024 NPC must be created as a 2024 sheet from the start

It is not enough to create a new character and then copy 2014 NPC attributes onto it.

The working path is:

- create the new character with `charactersheetname` set to the selected 2024 sheet;
- write `appState = "npc"`;
- write the translated `store` object;
- avoid restoring conflicting 2014 NPC sheet state onto the new character.

When this was not done, Roll20 rendered the new character as the wrong sheet type or opened an incorrect builder flow.

### 3. The 2024 sheet is much more dependent on hidden store structure than the 2014 sheet

Many fields only appear correctly when the generated integrants match the exact shape the 2024 sheet expects.

Important examples from this work:

- traits needed to be added as `Features` integrants and also listed in `speciesTraitsDisplayOrder`;
- OGL NPC skills needed to use actual skill names like `Perception`, not ability names like `Wisdom`;
- defenses needed to use the same field names as native 2024 imports (`damage`, `condition`, etc.), not approximate field names like `damageType` or `conditionType`.

### 4. OGL NPC skill flags should not be treated as expertise

For Roll20 2014 NPCs, values like `npc_perception_flag = "2"` are not reliable evidence of expertise.

Treating those flags as expertise caused incorrect doubled skill bonuses on converted NPCs.

The safer behavior for this converter is:

- if the 2014 NPC skill exists and is flagged, import it as `Proficient`.

### 5. Passive Perception is best handled by making the Perception skill import correctly

Trying to treat passive perception as a standalone override helped only partially.

The more correct fix was:

- import the Perception skill in a form the 2024 sheet actually understands;
- let the 2024 sheet derive Passive Perception from that imported skill where possible;
- keep explicit passive overrides only as fallback behavior.

### 6. The 2024 sheet uses short movement labels

The 2024 sheet expects short speed labels such as:

- `Walk`
- `Fly`
- `Climb`
- `Swim`
- `Burrow`

and a special case for:

- `Fly (Hover)`

Using longer labels like `Walking`, `Flying`, or `Climbing` produced incorrect or awkward speed rows.

### 7. Roll20 2024 appears to force several name attributes back to the journal name

Live testing showed that setting these attributes on converted 2024 NPCs:

- `name`
- `character_name`
- `npc_name`

did not preserve an independent on-sheet creature name. Roll20 rewrote them to match the journal character name.

This means the split behavior familiar from 2014 NPCs:

- journal/token name separate from the visible NPC statblock name

does not currently behave the same way on the 2024 sheet, at least through the tested attribute-writing path.

### 8. The Species field is a practical fallback for preserving the original 2014 in-sheet NPC name

Because the 2024 sheet appears to collapse multiple name fields back to the journal name, a useful fallback is:

- keep the journal character name as the copied journal/token name;
- write the original 2014 `npc_name` into the 2024 `Species` field.

This does not recreate the old split-name behavior exactly, but it preserves the original displayed creature identity somewhere visible on the converted sheet.

### 9. Same-folder placement is possible, but sibling ordering remains unresolved

Folder placement turned out to be achievable by resolving the source path through:

- `d20plus.journal.getExportableJournal()`

and then using:

- `d20plus.journal.makeDirTree(...)`
- `d20.journal.addItemToFolderStructure(...)`

However:

- placing the converted character immediately next to the original in the folder list was not solved reliably in this session;
- experimental attempts to rewrite the journal tree ordering caused regressions and were removed.

So the current state is:

- same folder: working;
- same relative position in that folder: not yet solved.

### 10. Some UI surfaces are easy to support, others are fragile

The existing edit-character modal integration is stable.

The journal context menu integration also works and is a practical extra entry point.

By contrast, attempts to inject the converter into:

- the top title bar;
- the VTTES Export & Overwrite tab

were unreliable and caused performance or usability regressions. Those injections were removed.

The practical conclusion is:

- keep working UI entry points that are stable and discoverable;
- avoid fragile late-mount UI injections unless there is a very strong reason to support them.

### 11. The build concatenation model makes name collisions easy to introduce

Because the project build concatenates many source files into large userscript bundles, top-level helper names can collide across files.

This happened during early iterations and was solved by:

- using converter-specific helper names;
- keeping converter internals isolated in a closure.

Future additions to this feature should continue to assume bundle-scope collision risk.

### 12. Temporary debug hooks were very useful for reverse engineering the 2024 sheet

The most effective debugging path was to log and inspect:

- source 2014 attribs;
- translated 2024 `store`;
- created character metadata.

This made it possible to compare converter output against live working 2024 sheets and identify mistakes in hidden store structure that were not obvious from static code inspection alone.
