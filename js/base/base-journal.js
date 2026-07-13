function d20plusJournal () {
	d20plus.journal = {};

	d20plus.journal.lastClickedFolderId = null;

	d20plus.journal.addJournalCommands = () => {
		// Create new Journal commands
		// stash the folder ID of the last folder clicked
		$("#journalfolderroot").on("contextmenu", ".dd-content", function (e) {
			const isShowCustom = d20plus.cfg.getOrDefault("interface", "journalCommands");
			const $itemHandle = $(this).parent();

			if ($itemHandle.hasClass("dd-folder")) {
				d20plus.journal.lastClickedFolderId = $itemHandle.data("globalfolderid");
			} else if ($itemHandle.hasClass("dd-item")) {
				d20plus.journal.lastClickedJournalItemId = $itemHandle.data("itemid");
			}

			if ($itemHandle.hasClass("character") && isShowCustom) {
				$(`.Vetools-make-tokenactions`).show();
			} else {
				$(`.Vetools-make-tokenactions`).hide();
			}

			if (($itemHandle.hasClass("character") || ($itemHandle.hasClass("handout"))) && isShowCustom) {
				$(`.b20-change-avatar`).show();
			} else {
				$(`.b20-change-avatar`).hide();
			}
		});

		let first = $("#journalitemmenu ul li").first();

		// "Make Tokenactions" option
		first.after(`<li class="Vetools-make-tokenactions" data-action-type="additem">Make Tokenactions</li>`);
		$("#journalitemmenu ul").on(window.mousedowntype, "li[data-action-type=additem]", function () {
			let id = d20plus.journal.lastClickedJournalItemId;
			let character = d20.Campaign.characters.get(id);
			d20plus.ut.log("Making Token Actions..");
			if (character) {
				let npc = character.attribs.find(function (a) {
					return a.get("name").toLowerCase() === "npc";
				});
				let isNPC = npc ? parseInt(npc.get("current")) : 0;
				if (isNPC) {
					// Npc specific tokenactions
					character.abilities.create({
						name: "Perception",
						istokenaction: true,
						action: d20plus.macro.actionMacroPerception,
					});
					character.abilities.create({
						name: "DR/Immunities",
						istokenaction: true,
						action: d20plus.macro.actionMacroDrImmunities,
					});
					character.abilities.create({
						name: "Stats",
						istokenaction: true,
						action: d20plus.macro.actionMacroStats,
					});
					character.abilities.create({
						name: "Saves",
						istokenaction: true,
						action: d20plus.macro.actionMacroSaves,
					});
					character.abilities.create({
						name: "Skill-Check",
						istokenaction: true,
						action: d20plus.macro.actionMacroSkillCheck,
					});
					character.abilities.create({
						name: "Ability-Check",
						istokenaction: true,
						action: d20plus.macro.actionMacroAbilityCheck,
					});
				} else {
					// player specific tokenactions
					// @{selected|repeating_attack_$0_atkname}
					character.abilities.create({
						name: "Attack 1",
						istokenaction: true,
						action: "%{selected|repeating_attack_$0_attack}",
					});
					character.abilities.create({
						name: "Attack 2",
						istokenaction: true,
						action: "%{selected|repeating_attack_$1_attack}",
					});
					character.abilities.create({
						name: "Attack 3",
						istokenaction: true,
						action: "%{selected|repeating_attack_$2_attack}",
					});
					character.abilities.create({
						name: "Tool 1",
						istokenaction: true,
						action: "%{selected|repeating_tool_$0_tool}",
					});
					// " + character.get("name") + "
					character.abilities.create({
						name: "Whisper GM",
						istokenaction: true,
						action: "/w gm ?{Message to whisper the GM?}",
					});
					character.abilities.create({
						name: "Favorite Spells",
						istokenaction: true,
						action: "/w @{character_name} &{template:npcaction} {{rname=Favorite Spells}} {{description=Favorite Spells are the first spells in each level of your spellbook.\n\r[Cantrip](~selected|repeating_spell-cantrip_$0_spell)\n[1st Level](~selected|repeating_spell-1_$0_spell)\n\r[2nd Level](~selected|repeating_spell-2_$0_spell)\n\r[3rd Level](~selected|repeating_spell-3_$0_spell)\n\r[4th Level](~selected|repeating_spell-4_$0_spell)\n\r[5th Level](~selected|repeating_spell-5_$0_spell)}}",
					});
					character.abilities.create({
						name: "Dual Attack",
						istokenaction: false,
						action: "%{selected|repeating_attack_$0_attack}\n\r%{selected|repeating_attack_$0_attack}",
					});
					character.abilities.create({
						name: "Saves",
						istokenaction: true,
						action: "@{selected|wtype}&{template:simple} @{selected|rtype}?{Save|Strength, +@{selected|strength_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Strength Save&#125;&#125 {{mod=@{selected|strength_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|strength_save_bonus}@{selected|pbd_safe}]]&#125;&#125; |Dexterity, +@{selected|dexterity_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Dexterity Save&#125;&#125 {{mod=@{selected|dexterity_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|dexterity_save_bonus}@{selected|pbd_safe}]]&#125;&#125; |Constitution, +@{selected|constitution_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Constitution Save&#125;&#125 {{mod=@{selected|constitution_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|constitution_save_bonus}@{selected|pbd_safe}]]&#125;&#125; |Intelligence, +@{selected|intelligence_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Intelligence Save&#125;&#125 {{mod=@{selected|intelligence_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|intelligence_save_bonus}@{selected|pbd_safe}]]&#125;&#125; |Wisdom, +@{selected|wisdom_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Wisdom Save&#125;&#125 {{mod=@{selected|wisdom_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|wisdom_save_bonus}@{selected|pbd_safe}]]&#125;&#125; |Charisma, +@{selected|charisma_save_bonus}@{selected|pbd_safe}]]&#125;&#125; {{rname=Charisma Save&#125;&#125 {{mod=@{selected|charisma_save_bonus}&#125;&#125; {{r1=[[@{selected|d20}+@{selected|charisma_save_bonus}@{selected|pbd_safe}]]&#125;&#125;}@{selected|global_save_mod}@{selected|charname_output",
					});
					character.abilities.create({
						name: "Skill-Check",
						istokenaction: true,
						action: "@{selected|wtype}&{template:simple} @{selected|rtype}?{Ability|Acrobatics, +@{selected|acrobatics_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Acrobatics&#125;&#125; {{mod=@{selected|acrobatics_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|acrobatics_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Animal Handling, +@{selected|animal_handling_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Animal Handling&#125;&#125; {{mod=@{selected|animal_handling_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|animal_handling_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Arcana, +@{selected|arcana_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Arcana&#125;&#125; {{mod=@{selected|arcana_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|arcana_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Athletics, +@{selected|athletics_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Athletics&#125;&#125; {{mod=@{selected|athletics_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|athletics_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Deception, +@{selected|deception_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Deception&#125;&#125; {{mod=@{selected|deception_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|deception_bonus}@{selected|pbd_safe} ]]&#125;&#125; |History, +@{selected|history_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=History&#125;&#125; {{mod=@{selected|history_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|history_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Insight, +@{selected|insight_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Insight&#125;&#125; {{mod=@{selected|insight_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|insight_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Intimidation, +@{selected|intimidation_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Intimidation&#125;&#125; {{mod=@{selected|intimidation_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|intimidation_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Investigation, +@{selected|investigation_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Investigation&#125;&#125; {{mod=@{selected|investigation_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|investigation_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Medicine, +@{selected|medicine_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Medicine&#125;&#125; {{mod=@{selected|medicine_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|medicine_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Nature, +@{selected|nature_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Nature&#125;&#125; {{mod=@{selected|nature_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|nature_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Perception, +@{selected|perception_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Perception&#125;&#125; {{mod=@{selected|perception_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|perception_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Performance, +@{selected|performance_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Performance&#125;&#125; {{mod=@{selected|performance_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|performance_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Persuasion, +@{selected|persuasion_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Persuasion&#125;&#125; {{mod=@{selected|persuasion_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|persuasion_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Religion, +@{selected|religion_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Religion&#125;&#125; {{mod=@{selected|religion_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|religion_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Sleight of Hand, +@{selected|sleight_of_hand_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Sleight of Hand&#125;&#125; {{mod=@{selected|sleight_of_hand_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|sleight_of_hand_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Stealth, +@{selected|stealth_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Stealth&#125;&#125; {{mod=@{selected|stealth_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|stealth_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Survival, +@{selected|survival_bonus}@{selected|pbd_safe} ]]&#125;&#125; {{rname=Survival&#125;&#125; {{mod=@{selected|survival_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|survival_bonus}@{selected|pbd_safe} ]]&#125;&#125; |Strength, +@{selected|strength_mod}@{selected|jack_attr}[STR]]]&#125;&#125; {{rname=Strength&#125;&#125; {{mod=@{selected|strength_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|strength_mod}@{selected|jack_attr}[STR]]]&#125;&#125; |Dexterity, +@{selected|dexterity_mod}@{selected|jack_attr}[DEX]]]&#125;&#125; {{rname=Dexterity&#125;&#125; {{mod=@{selected|dexterity_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|dexterity_mod}@{selected|jack_attr}[DEX]]]&#125;&#125; |Constitution, +@{selected|constitution_mod}@{selected|jack_attr}[CON]]]&#125;&#125; {{rname=Constitution&#125;&#125; {{mod=@{selected|constitution_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|constitution_mod}@{selected|jack_attr}[CON]]]&#125;&#125; |Intelligence, +@{selected|intelligence_mod}@{selected|jack_attr}[INT]]]&#125;&#125; {{rname=Intelligence&#125;&#125; {{mod=@{selected|intelligence_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|intelligence_mod}@{selected|jack_attr}[INT]]]&#125;&#125; |Wisdom, +@{selected|wisdom_mod}@{selected|jack_attr}[WIS]]]&#125;&#125; {{rname=Wisdom&#125;&#125; {{mod=@{selected|wisdom_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|wisdom_mod}@{selected|jack_attr}[WIS]]]&#125;&#125; |Charisma, +@{selected|charisma_mod}@{selected|jack_attr}[CHA]]]&#125;&#125; {{rname=Charisma&#125;&#125; {{mod=@{selected|charisma_mod}@{selected|jack_bonus}&#125;&#125; {{r1=[[ @{selected|d20} + @{selected|charisma_mod}@{selected|jack_attr}[CHA]]]&#125;&#125; } @{selected|global_skill_mod} @{selected|charname_output}",
					});
				}
				// for everyone
				character.abilities.create({
					name: "Initiative",
					istokenaction: true,
					action: d20plus.macro.actionMacroInit,
				});
			}
		});

		// "Set avatar" option
		first.after(`<li class="b20-change-avatar" data-action-type="changeavatar">Set Avatar</li>`);
		$("#journalitemmenu ul").on(window.mousedowntype, "li[data-action-type=changeavatar]", function () {
			const id = d20plus.journal.lastClickedJournalItemId;
			const item = d20.Campaign.characters.get(id) || d20.Campaign.handouts.get(id);
			const name = item?.attributes.name || "Unnamed";
			if (!item?.attributes.hasOwnProperty("name") || !item?.attributes.hasOwnProperty("avatar")) {
				// TODO user-visible feedback? Toast message?
				return console.error(`Selected journal item does not have a "name" and/or "avatar" field!`);
			}
			d20plus.ut.log(`Setting avatar for ${name}`);
			const $dialog = $(`
				<div class="dialog largedialog journalavatareditor">
					<button class="btn avatar-image-by-url" style="margin-bottom: 10px">Set image from URL...</button>
					<div class="avatar dropbox" style="background: white; min-height:100px;">
						<div class="status"></div>
						<div class="inner"></div>
					</div>
				</div>
			`);
			const avatar = {url: item?.attributes.avatar || ""};
			const $dropbox = $dialog.find(".dropbox");
			const setImagePreview = (img) => {
				const $inner = $dropbox.find(".inner");
				if (img) {
					$dropbox.addClass("filled");
					avatar.url = img;
					$inner.html(`<img src="${img}"><div class="remove"><a href="javascript:void(0);">Remove</a></div>`);
				} else {
					$dropbox.removeClass("filled");
					avatar.url = "";
					$inner.html(`<h4 style="padding-bottom: 0; margin-bottom: 0; color: #777;">Drop a file</h4><br>`);
				}
			};
			$dialog.dialog({
				resizable: true,
				autoopen: true,
				title: "Set avatar from URL",
				open: () => {
					setImagePreview(avatar.url);
					$dropbox.droppable({
						accept: ".resultimage, .library-item",
						greedy: true,
						scope: "default",
						tolerance: "pointer",
						classes: {
							"ui-droppable": "drop-highlight",
						},
						drop: (evt, $d) => {
							evt.originalEvent.dropHandled = !0;
							evt.stopPropagation();
							evt.preventDefault();
							setImagePreview($d.draggable.data("fullsizeurl") || $d.draggable.data("url"));
						},
					}).on("click", ".remove", () => {
						setImagePreview();
					});
					$dialog.find(".avatar-image-by-url").on("click", function () {
						const url = window.prompt("Enter a URL", d20plus.art.getLastImageUrl());
						if (url) {
							d20plus.art.setLastImageUrl(url);
							setImagePreview(url);
						}
					});
				},
				close: () => {
					$dialog.off();
					$dialog.dialog("destroy").remove();
				},
				buttons: {
					OK: () => {
						item.save({avatar: avatar.url});
						$dialog.off();
						$dialog.dialog("destroy").remove();
					},
					Cancel: () => {
						$dialog.off();
						$dialog.dialog("destroy").remove();
					},
				},
			});
		})

		// New command on FOLDERS
		const last = $("#journalmenu ul li").last();
		last.before("<li data-action-type=\"archiveall\">Archive All Contents</li>");

		const $journalUl = $("#journalmenu ul");

		$journalUl.on(window.mousedowntype, "li[data-action-type=archiveall]", function () {
			d20plus.journal.recursiveArchiveDirById(d20plus.journal.lastClickedFolderId, true);
			$("#journalmenu").hide();
		});
	};

	/**
	 * Takes a path made up of strings and arrays of strings, and turns it into one flat array of strings
	 * Note that paths must be of the form ["folder", "subfolder", "subsubfolder", etc]
	 */
	d20plus.journal.getCleanPath = function (...path) {
		const clean = [];
		getStrings(clean, path);
		return clean.map(s => s.trim()).filter(s => s);

		function getStrings (stack, toProc) {
			toProc.forEach(tp => {
				if (typeof tp === "string") {
					stack.push(tp);
				} else if (tp instanceof Array) {
					getStrings(stack, tp);
				} else {
					throw new Error("Object in path was not a string or an array")
				}
			});
		}
	};

	d20plus.journal.makeDirTree = function (...path) {
		const parts = d20plus.journal.getCleanPath(path);
		// path e.g. d20plus.journal.makeDirTree("Spells", "Cantrips", "1")
		// roll20 allows a max directory depth of 4 :joy: (5, but the 5th level is unusable)
		if (parts.length > 4) throw new Error("Max directory depth exceeded! The maximum is 4.")

		const madeSoFar = [];

		const root = {i: d20plus.ut.getJournalFolderObj()};

		// roll20 folder management is dumb, so just pick the first folder with the right name if there's multiple
		let curDir = root;
		parts.forEach(toMake => {
			const existing = curDir.i.find((it) => {
				// n is folder name (only folders have the n property)
				return it.n && it.n === toMake && it.i;
			});
			if (!existing) {
				if (curDir.id) {
					d20.journal.addFolderToFolderStructure(toMake, curDir.id);
				} else {
					// root has no id
					d20.journal.addFolderToFolderStructure(toMake);
				}
			}
			d20.journal.refreshJournalList();
			madeSoFar.push(toMake);

			// we have to save -> reread the entire directory JSON -> walk back to where we were
			let nextDir = {i: JSON.parse(d20.Campaign.get("journalfolder"))};
			madeSoFar.forEach(f => {
				nextDir = nextDir.i.find(dir => dir.n && (dir.n.toLowerCase() === f.toLowerCase()));
			});

			curDir = nextDir;
		});
		return curDir;
	};

	d20plus.journal.recursiveRemoveDirById = function (folderId, withConfirmation) {
		if (!withConfirmation || confirm("Are you sure you want to delete this folder, and everything in it? This cannot be undone.")) {
			const folder = $(`[data-globalfolderid='${folderId}']`);
			if (folder.length) {
				d20plus.ut.log("Nuking directory...");
				const childItems = folder.find("[data-itemid]").each((i, e) => {
					const $e = $(e);
					const itemId = $e.attr("data-itemid");
					let toDel = d20.Campaign.handouts.get(itemId);
					toDel || (toDel = d20.Campaign.characters.get(itemId));
					if (toDel) toDel.destroy();
				});
				const childFolders = folder.find(`[data-globalfolderid]`).remove();
				folder.remove();
				$("#journalfolderroot").trigger("change");
			}
		}
	};

	d20plus.journal.recursiveArchiveDirById = function (folderId, withConfirmation) {
		if (!withConfirmation || confirm("Are you sure you want to archive this folder, and everything in it? This cannot be undone.")) {
			const folder = $(`[data-globalfolderid='${folderId}']`);
			if (folder.length) {
				d20plus.ut.log("Archiving directory...");
				folder.find("[data-itemid]").each((i, e) => {
					const $e = $(e);
					const itemId = $e.attr("data-itemid");
					let toArchive = d20.Campaign.handouts.get(itemId);
					toArchive || (toArchive = d20.Campaign.characters.get(itemId));
					if (toArchive && toArchive.attributes) {
						toArchive.attributes.archived = true;
						toArchive.save()
					}
				});
			}
		}
	};

	d20plus.journal.removeDirByPath = function (...path) {
		path = d20plus.journal.getCleanPath(path);
		return d20plus.journal._checkOrRemoveDirByPath(true, path);
	};

	d20plus.journal.checkDirExistsByPath = function (...path) {
		path = d20plus.journal.getCleanPath(path);
		return d20plus.journal._checkOrRemoveDirByPath(false, path);
	};

	d20plus.journal._checkOrRemoveDirByPath = function (doDelete, path) {
		const parts = d20plus.journal.getCleanPath(path);

		const root = {i: d20plus.ut.getJournalFolderObj()};

		let curDir = root;
		for (let i = 0; i < parts.length; ++i) {
			const p = parts[i];
			let lastId;
			const existing = curDir.i.find((it) => {
				lastId = it.id;
				// n is folder name (only folders have the n property)
				return it.n && it.n === p;
			});
			if (!existing) return false;
			if (!doDelete) return true;
			curDir = existing;
			if (i === parts.length - 1) {
				d20plus.journal.recursiveRemoveDirById(lastId, false);
				return true;
			}
		}
	};

	d20plus.journal.getExportableJournal = () => {
		// build a list of (id, path) pairs
		const out = [];

		function recurse (entry, pos) {
			if (entry.i) {
				// pos.push({name: entry.n, id: entry.id}); // if IDs are required, use this instead?
				pos.push(entry.n);
				entry.i.forEach(nxt => recurse(nxt, pos));
				pos.pop();
			} else {
				out.push({id: entry, path: MiscUtil.copy(pos)});
			}
		}

		const root = {i: d20plus.ut.getJournalFolderObj(), n: "Root", id: "root"};
		recurse(root, []);
		return out;
	};

	d20plus.journal.removeFileByPath = function (...path) {
		path = d20plus.journal.getCleanPath(path);
		return d20plus.journal._checkOrRemoveFileByPath(true, path);
	};

	d20plus.journal.checkFileExistsByPath = function (...path) {
		path = d20plus.journal.getCleanPath(path);
		return d20plus.journal._checkOrRemoveFileByPath(false, path);
	};

	d20plus.journal._checkOrRemoveFileByPath = function (doDelete, path) {
		const parts = d20plus.journal.getCleanPath(path);

		const root = {i: d20plus.ut.getJournalFolderObj()};

		let curDir = root;
		for (let i = 0; i < parts.length; ++i) {
			const p = parts[i];
			let lastId;
			const existing = curDir.i.find((it) => {
				if (i === parts.length - 1) {
					// for the last item, check handouts/characters to see if the match it (which could be a string ID)
					const char = d20.Campaign.characters.get(it);
					const handout = d20.Campaign.handouts.get(it);
					if ((char && char.get("name") === p) || (handout && handout.get("name") === p)) {
						lastId = it;
						return true;
					}
				} else {
					lastId = it.id;
					// n is folder name (only folders have the n property)
					return it.n && it.n === p;
				}
				return false;
			});
			if (!existing) return false;
			curDir = existing;
			if (i === parts.length - 1) {
				if (doDelete) {
					// on the last item, delete
					let toDel = d20.Campaign.handouts.get(lastId);
					toDel || (toDel = d20.Campaign.characters.get(lastId))
					if (toDel) toDel.destroy();
				}
				return true;
			}
		}
		return false;
	};
}

SCRIPT_EXTENSIONS.push(d20plusJournal);
