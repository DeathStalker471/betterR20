# 5etools NPC Sidekick Level Up

## Purpose

This feature adds a full sidekick workflow for Roll20 2024 NPC sheets:

- create sidekick copies from existing NPCs;
- level up existing sidekicks in place;
- automate sidekick progression features where possible;
- enforce guided choices for features that require player input.

The implementation lives primarily in:

- `js/5etools-npc-level-up.js`
- `js/5etools-npc-sidekick-data.js`
- `js/5etools-2024-store.js`

## High-Level Design

The level-up system is built as a 2024 `store` mutation pipeline:

1. Resolve target character and read its 2024 `store`.
2. Determine whether this is:
   - "Make Sidekick" (create copy), or
   - "Level Up Sidekick" (in-place upgrade).
3. Collect user choices from dialog sections (proficiencies, ASI/feat, spells, etc.).
4. Apply deterministic store/integrant mutations via `upgrade2024NpcStore(...)`.
5. Persist updated sheet state with `saveNewNpcState(...)`.
6. Write sheet-visible PB/CR fields with `writeSidekickStats(...)`.
7. Preserve routing metadata in `b20_sidekick` for reliability across sheet re-init.

## Why This Approach Was Chosen

The 2024 sheet is renderer- and integrant-driven. Reliable behavior comes from mutating the same store structures the sheet uses internally, then forcing Vue refresh through the existing store writer.

Benefits:

- one centralized upgrade function for create and in-place level-up;
- idempotent re-apply behavior for repeated level-up operations;
- explicit separation between:
  - durable metadata (`b20_sidekick` attr), and
  - volatile store custom keys.

## Roll20 User Workflow

### Make Sidekick

1. Right-click a 2024 NPC journal entry.
2. Choose **Make Sidekick** flow.
3. Pick sidekick type and target level.
4. Resolve required choices in dialog sections.
5. New character copy is created and initialized as a sidekick.

### Level Up Sidekick

1. Right-click an existing sidekick.
2. Choose **Level Up Sidekick**.
3. Confirm choices for the gained level.
4. Existing character is upgraded in place.

## Sidekick Features Implemented

### Type tracks

- Expert
- Warrior (Attacker)
- Warrior (Defender)
- Mage
- Healer
- Prodigy

### Automated or guided features

- PB/CR progression and sheet-visible updates
- HP increase and hit-dice progression
- Bonus Proficiencies (guided at required levels)
- Ability Score Improvement
- Feat instead of ASI (text trait writeback)
- Spellcasting setup for spellcaster sidekicks
- Spellcasting Advancement picks/imports
- Spell slot progression
- Potent Cantrips
- Empowered Spells (school choice + re-apply)
- Expertise
- Sharp Mind
- Martial Role (Attacker/Defender split; attacker +2 automation)

## Data Model and Persistence

### Main state

- 2024 sheet store: `store` attr (`appState = "npc"`)
- Sidekick routing metadata: `b20_sidekick` attr

### Sidekick metadata strategy

The feature uses both:

- store keys for immediate in-memory flow (`_npcSidekickType`, `_npcLevelUpLevel`, `_npcEmpoweredSchool`)
- dedicated `b20_sidekick` attr for durable persistence (`type`, `level`, `school`)

On read, meta from `b20_sidekick` is restored into store if store keys were stripped.

## Sheet Rendering Findings (Critical)

### 1. Persisted attr values are not enough for UI correctness

PB/CR can be written successfully to attrs but still render stale on sheet UI unless the renderer-bound store/integrant fields are also aligned.

### 2. CR display path

`store.npc.challengeRating` is the important 2024 path for display behavior; compatibility attrs are still written.

### 3. PB display path

PB display is tied to 2024 config/integrant paths (not only flat `pb` attr). Sidekick writes update the relevant paths and attrs.

### 4. Store volatility during sheet init

Roll20 can re-serialize and strip unknown custom keys from `store.npc`. Custom sidekick metadata must not rely only on store keys.

### 5. Dedicated meta attr is required for stability

`b20_sidekick` survives sheet init and is used as canonical fallback for routing and post-init restore.

## Integrant Learnings

### 1. Integrant graph traversal is reliable for spell feature automation

Damage/Healing rolls can be updated by walking `parentID` chains to ancestor Spell integrants.

### 2. Spell school is available for filtering

Imported spells carry full school names on Spell integrants, enabling school-scoped automation (Empowered Spells).

### 3. Idempotent mutation markers are workable

Targeted markers (for example attacker bonus application) support safe re-application on later level-ups.

### 4. Update existing attrs/integrants, avoid duplicates

When applying PB/CR and related values, mutating existing entries avoids duplicate-field ambiguity in sheet reads.

## Dialog and TODO Behavior

Feature previews now treat dialog-resolved features as AUTO rather than manual TODO when:

- required choices are collected in the dialog, and
- writeback is handled by the level-up pipeline.

This keeps UI expectations aligned with actual automation.

## Expected Limitations

### 1. Feat mode is currently text-first

Choosing a feat instead of ASI writes feat text to a trait. Mechanical feat effects are not auto-applied yet.

### 2. Empowered Spells rule approximation

The "only when expending a spell slot" condition is not represented as a runtime gate in current sheet behavior.

### 3. Roll20 init timing remains a moving target

The system includes re-save/meta restore safeguards, but third-party sheet lifecycle behavior can still require iterative hardening.

## Integration Footprint

Main touchpoints:

- `js/5etools-npc-level-up.js` - dialogs, upgrade pipeline, feature application
- `js/5etools-npc-sidekick-data.js` - sidekick progression tables, spell/feat data helpers
- `js/5etools-2024-store.js` - store/meta persistence helpers and PB/CR writes
- `node/build-scripts.js` - bundling/versioning

## Future Improvement Ideas

- mechanized feat effects for a curated subset
- improved limited-use/action modeling for remaining sidekick features
- additional post-init reconciliation hooks if Roll20 init behavior changes
- expanded validation/reporting for partial spell import failures

## Session Learnings

1. The 2024 sheet should be treated as store/integrant-first, not attr-first.
2. Renderer correctness and persistence correctness are separate concerns; both must be handled.
3. Unknown store custom keys are fragile across sheet re-serialization.
4. Durable workflow metadata belongs in dedicated attrs (like `b20_sidekick`).
5. Feature automation is most reliable when expressed as idempotent integrant mutations.
6. Dialog-guided choices significantly reduce unresolved TODO noise while preserving user control.
