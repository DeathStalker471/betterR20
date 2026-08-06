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
