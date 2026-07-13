function baseToolAutoBackup() {
	d20plus.autoBackup = {};

	const BACKUP_HANDOUT_PREFIX = "BetteR20 Backup - ";
	const BACKUP_PART_SUFFIX = " - Part ";
	const DEFAULT_MAX_BACKUPS = 3;
	const MAX_CHUNK_SIZE = 9 * 1024 * 1024; // 9 MB (leave 1 MB buffer under 10 MB limit)

	// Add config options for auto-backup
	addConfigOptions("autoBackup", {
		"_name": "Auto Backup",
		"maxBackups": {
			"name": "Maximum Backups to Keep",
			"default": DEFAULT_MAX_BACKUPS,
			"_type": "_enum",
			"__values": ["1", "2", "3", "4", "5"],
		},
	});

	// ===========================
	// CORE BACKUP FUNCTIONS
	// ===========================

	/**
	 * Extract full campaign data for backup
	 * @returns {Promise<Object>} Campaign data object
	 */
	d20plus.autoBackup.getBackupData = async () => {
		try {
			d20plus.ut.log("Gathering campaign data for backup...");

			const journal = d20plus.journal.getExportableJournal();

			// Export maps with graphics/paths/text/doors/windows
			d20plus.ut.log("Exporting maps...");
			const maps = await Promise.all(d20.Campaign.pages.models.map(async map => {
				if (!map.thegraphics) {
					await map.fullyLoadPage();
				}

				const getOut = () => {
					return {
						attributes: map.attributes,
						graphics: (map.thegraphics || []).map(g => g.attributes),
						text: (map.thetexts || []).map(t => t.attributes),
						paths: (map.thepaths || []).map(p => p.attributes),
						doors: (map.doors || []).map(d => d.attributes),
						windows: (map.windows || []).map(w => w.attributes),
					};
				};

				if (map.get("archived")) {
					map.set({archived: false});
					await d20plus.ut.promiseDelay(d20plus.cfg.getOrDefault("import", "importIntervalHandout") * 2);
					const out = getOut();
					map.set({archived: true});
					return out;
				} else {
					return getOut();
				}
			}));

			// Export roll tables
			d20plus.ut.log("Exporting rolltables...");
			const rolltables = d20.Campaign.rollabletables.models.map(rolltable => ({
				attributes: rolltable.attributes,
				tableitems: (rolltable.tableitems.models || []).map(tableitem => tableitem.attributes),
			}));

			// Export decks (filter out "Playing Cards")
			d20plus.ut.log("Exporting decks...");
			const decks = d20.Campaign.decks.models.map(deck => {
				if (deck.name && deck.name.toLowerCase() === "playing cards") return;
				return {
					attributes: deck.attributes,
					cards: (deck.cards.models || []).map(card => card.attributes),
				};
			}).filter(it => it);

			// Export jukebox playlists and tracks
			d20plus.ut.log("Exporting jukebox...");
			const playlists = d20plus.jukebox.getExportablePlaylists();
			const tracks = d20plus.jukebox.getExportableTracks();

			// Export characters and handouts with blob data
			let blobCount = 0;
			let onBlobsReady = null;

			const handleBlob = (addTo, asKey, data) => {
				addTo[asKey] = data;
				blobCount--;
				if (onBlobsReady && blobCount === 0) onBlobsReady();
			};

			// Export characters
			d20plus.ut.log("Exporting characters...");
			const characters = d20.Campaign.characters.models.map(character => {
				character.attribs.fetch(character.attribs);
				const out = {
					attributes: character.attributes,
					attribs: character.attribs,
				};
				const abilities = (character.abilities || {models: []}).models.map(ability => ability.attributes);
				if (abilities && abilities.length) out.abilities = abilities;
				blobCount += 3;
				character._getLatestBlob("bio", (data) => handleBlob(out, "blobBio", data));
				character._getLatestBlob("gmnotes", (data) => handleBlob(out, "blobGmNotes", data));
				character._getLatestBlob("defaulttoken", (data) => handleBlob(out, "blobDefaultToken", data));
				return out;
			});

			// Export handouts (filter out system handouts)
			d20plus.ut.log("Exporting handouts...");
			const handouts = d20.Campaign.handouts.models.map(handout => {
				// Filter out system handouts and backup handouts
				if (handout.attributes.name === ART_HANDOUT ||
					handout.attributes.name === CONFIG_HANDOUT ||
					handout.attributes.name.startsWith(BACKUP_HANDOUT_PREFIX)) {
					return;
				}

				const out = {
					attributes: handout.attributes,
				};
				blobCount += 2;
				handout._getLatestBlob("notes", (data) => handleBlob(out, "blobNotes", data));
				handout._getLatestBlob("gmnotes", (data) => handleBlob(out, "blobGmNotes", data));
				return out;
			}).filter(it => it);

			// Wait for all blobs to load
			d20plus.ut.log("Waiting for blobs...");
			await new Promise(resolve => {
				onBlobsReady = () => {
					d20plus.ut.log("Blobs are ready!");
					resolve();
				};
				if (blobCount === 0) onBlobsReady();
			});

			// Build final payload
			const payload = {
				schema_version: 1,
				maps,
				rolltables,
				decks,
				journal,
				handouts,
				characters,
				playlists,
				tracks,
			};

			d20plus.ut.log("Backup data gathered successfully");
			return payload;

		} catch (e) {
			d20plus.ut.error("Failed to gather backup data:", e);
			throw e;
		}
	};

	/**
	 * Split a string into chunks of specified max size
	 * @param {string} str - String to split
	 * @param {number} maxSize - Maximum chunk size in bytes
	 * @returns {Array<string>} Array of chunks
	 */
	d20plus.autoBackup.splitIntoChunks = (str, maxSize) => {
		const chunks = [];
		const encoder = new TextEncoder();
		let currentChunk = "";
		let currentSize = 0;

		for (let i = 0; i < str.length; i++) {
			const char = str[i];
			const charBytes = encoder.encode(char).length;

			if (currentSize + charBytes > maxSize && currentChunk.length > 0) {
				chunks.push(currentChunk);
				currentChunk = char;
				currentSize = charBytes;
			} else {
				currentChunk += char;
				currentSize += charBytes;
			}
		}

		if (currentChunk.length > 0) {
			chunks.push(currentChunk);
		}

		return chunks;
	};

	/**
	 * Create a handout and return a promise
	 * @param {string} name - Handout name
	 * @param {boolean} archived - Whether to archive the handout
	 * @returns {Promise<Object>} Created handout
	 */
	d20plus.autoBackup.createHandout = (name, archived = true) => {
		return new Promise((resolve, reject) => {
			d20.Campaign.handouts.create({
				name: name,
				archived: archived
			}, {
				success: function(handout) {
					resolve(handout);
				},
				error: function(handout, error) {
					reject(new Error(`Failed to create handout "${name}": ${error}`));
				}
			});
		});
	};

	/**
	 * Create a backup handout with campaign data
	 * Automatically splits into multiple handouts if data exceeds 10 MB limit
	 * @param {boolean} isManual - Whether this is a manual backup
	 * @returns {Promise<void>}
	 */
	d20plus.autoBackup.createBackup = async (isManual = false) => {
		try {
			d20plus.ut.log(`Creating ${isManual ? "manual" : "automatic"} backup...`);

			// Get campaign data
			const data = await d20plus.autoBackup.getBackupData();

			// Create timestamp and handout name
			const timestamp = new Date();
			const dateStr = timestamp.toISOString().slice(0, 19).replace('T', ' ');
			const baseName = `${BACKUP_HANDOUT_PREFIX}${dateStr}`;

			// Add backup metadata
			const backupData = {
				...data,
				timestamp: timestamp.getTime(),
				backupType: isManual ? "manual" : "auto"
			};

			const json = JSON.stringify(backupData);
			const jsonSize = new TextEncoder().encode(json).length;

			d20plus.ut.log(`Backup data size: ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);

			if (jsonSize <= MAX_CHUNK_SIZE) {
				// Single handout backup (under size limit)
				d20plus.ut.log("Creating single-handout backup...");

				const handout = await d20plus.autoBackup.createHandout(baseName);
				handout.updateBlobs({gmnotes: json});
				handout.save({notes: timestamp.getTime(), inplayerjournals: ""});

				d20plus.ut.log(`Backup created: ${baseName}`);
			} else {
				// Split into multiple handouts
				const chunks = d20plus.autoBackup.splitIntoChunks(json, MAX_CHUNK_SIZE);
				d20plus.ut.log(`Backup requires ${chunks.length} parts (data exceeds 9 MB limit)`);

				// Create main handout with metadata
				const mainHandout = await d20plus.autoBackup.createHandout(baseName);
				const mainMetadata = JSON.stringify({
					isSplitBackup: true,
					partCount: chunks.length,
					timestamp: timestamp.getTime(),
					backupType: isManual ? "manual" : "auto",
					totalSize: jsonSize
				});
				mainHandout.updateBlobs({gmnotes: mainMetadata});
				mainHandout.save({notes: timestamp.getTime(), inplayerjournals: ""});

				// Create part handouts with delay to avoid rate limiting
				for (let i = 0; i < chunks.length; i++) {
					const partName = `${baseName}${BACKUP_PART_SUFFIX}${i + 1}`;
					d20plus.ut.log(`Creating backup part ${i + 1}/${chunks.length}...`);

					const partHandout = await d20plus.autoBackup.createHandout(partName);
					partHandout.updateBlobs({gmnotes: chunks[i]});
					partHandout.save({notes: i + 1, inplayerjournals: ""});

					// Small delay between parts to avoid overwhelming Roll20
					if (i < chunks.length - 1) {
						await d20plus.ut.promiseDelay(d20plus.cfg.getOrDefault("import", "importIntervalHandout") || 100);
					}
				}

				d20plus.ut.log(`Split backup created: ${baseName} (${chunks.length} parts)`);
			}

			// Update config with last backup timestamp
			if (d20plus.cfg && d20plus.cfg.setCfgVal) {
				d20plus.cfg.setCfgVal("autoBackup", "lastBackupTimestamp", timestamp.getTime());

				// Save config
				const configHandout = d20plus.cfg.getConfigHandout();
				if (configHandout) {
					const gmnotes = JSON.stringify(d20plus.cfg.current).replace(/%/g, "%25");
					configHandout.updateBlobs({gmnotes: gmnotes});
					configHandout.save({notes: timestamp.getTime()});
				}
			}

			// Cleanup old backups
			await d20plus.autoBackup.cleanupOldBackups();

			// Show success message
			d20plus.ut.chatLog(`Backup created successfully: ${baseName}`);

		} catch (e) {
			d20plus.ut.error("Backup failed:", e);
			d20plus.ut.chatLog("Backup failed! Check console for details.");
			throw e;
		}
	};

	/**
	 * List all backup handouts (excludes part handouts)
	 * @returns {Array} Array of backup handout models (main backups only)
	 */
	d20plus.autoBackup.listBackups = () => {
		return d20.Campaign.handouts.models.filter(h =>
			h.attributes.name.startsWith(BACKUP_HANDOUT_PREFIX) &&
			!h.attributes.name.includes(BACKUP_PART_SUFFIX)
		);
	};

	/**
	 * Get all part handouts for a given backup
	 * @param {string} baseName - The main backup handout name
	 * @returns {Array} Array of part handout models, sorted by part number
	 */
	d20plus.autoBackup.getBackupParts = (baseName) => {
		const parts = d20.Campaign.handouts.models.filter(h =>
			h.attributes.name.startsWith(baseName + BACKUP_PART_SUFFIX)
		);

		// Sort by part number
		parts.sort((a, b) => {
			const aNum = parseInt(a.attributes.name.split(BACKUP_PART_SUFFIX)[1]) || 0;
			const bNum = parseInt(b.attributes.name.split(BACKUP_PART_SUFFIX)[1]) || 0;
			return aNum - bNum;
		});

		return parts;
	};

	/**
	 * Load and merge backup data from a backup handout
	 * Handles both single-handout and split backups
	 * @param {Object} backupHandout - The main backup handout
	 * @returns {Promise<string>} The merged backup JSON string
	 */
	d20plus.autoBackup.loadBackupData = (backupHandout) => {
		return new Promise((resolve, reject) => {
			backupHandout._getLatestBlob("gmnotes", async (gmnotes) => {
				try {
					// Check if this is a split backup
					let metadata;
					try {
						metadata = JSON.parse(gmnotes);
					} catch (e) {
						// Not JSON metadata, this is a single-handout backup
						resolve(gmnotes);
						return;
					}

					if (!metadata.isSplitBackup) {
						// Single-handout backup (the gmnotes IS the backup data)
						resolve(gmnotes);
						return;
					}

					// Split backup - need to fetch and merge parts
					d20plus.ut.log(`Loading split backup with ${metadata.partCount} parts...`);

					const parts = d20plus.autoBackup.getBackupParts(backupHandout.attributes.name);

					if (parts.length !== metadata.partCount) {
						reject(new Error(`Backup corrupted: expected ${metadata.partCount} parts, found ${parts.length}`));
						return;
					}

					// Fetch all parts
					const partData = [];
					for (let i = 0; i < parts.length; i++) {
						const partContent = await new Promise((res, rej) => {
							parts[i]._getLatestBlob("gmnotes", (data) => {
								if (data) {
									res(data);
								} else {
									rej(new Error(`Failed to load part ${i + 1}`));
								}
							});
						});
						partData.push(partContent);
						d20plus.ut.log(`Loaded part ${i + 1}/${parts.length}`);
					}

					// Merge parts
					const mergedData = partData.join("");
					d20plus.ut.log(`Merged ${parts.length} parts (${(mergedData.length / 1024 / 1024).toFixed(2)} MB)`);

					resolve(mergedData);
				} catch (e) {
					reject(e);
				}
			});
		});
	};

	/**
	 * Delete a backup and all its parts (if split)
	 * @param {Object} backup - The main backup handout to delete
	 */
	d20plus.autoBackup.deleteBackup = (backup) => {
		const baseName = backup.attributes.name;

		// Delete any associated parts first
		const parts = d20plus.autoBackup.getBackupParts(baseName);
		parts.forEach(part => {
			d20plus.ut.log(`Deleting backup part: ${part.attributes.name}`);
			part.destroy();
		});

		// Delete the main backup handout
		d20plus.ut.log(`Deleting backup: ${baseName}`);
		backup.destroy();
	};

	/**
	 * Delete backups beyond the configured maximum
	 * @returns {Promise<void>}
	 */
	d20plus.autoBackup.cleanupOldBackups = async () => {
		try {
			const backups = d20plus.autoBackup.listBackups();
			const maxBackups = parseInt(d20plus.cfg.getOrDefault("autoBackup", "maxBackups", DEFAULT_MAX_BACKUPS));

			// Sort by name (which includes timestamp) - newest first
			backups.sort((a, b) => b.attributes.name.localeCompare(a.attributes.name));

			// Delete backups beyond maxBackups
			if (backups.length > maxBackups) {
				const toDelete = backups.slice(maxBackups);
				d20plus.ut.log(`Cleaning up ${toDelete.length} old backups (keeping ${maxBackups})...`);

				toDelete.forEach(backup => {
					d20plus.autoBackup.deleteBackup(backup);
				});
			}
		} catch (e) {
			d20plus.ut.error("Failed to cleanup old backups:", e);
		}
	};

	/**
	 * Check if backup is due and run if needed
	 * @returns {Promise<void>}
	 */
	d20plus.autoBackup.checkAndRunScheduledBackup = async () => {
		try {
			const schedule = d20plus.cfg.getOrDefault("autoBackup", "schedule", "off");
			if (schedule === "off") {
				d20plus.ut.log("Auto-backup is disabled");
				return;
			}

			const enabled = d20plus.cfg.getOrDefault("autoBackup", "enabled", true);
			if (!enabled) {
				d20plus.ut.log("Auto-backup is disabled via config");
				return;
			}

			const lastBackup = d20plus.cfg.getOrDefault("autoBackup", "lastBackupTimestamp", 0);
			const now = Date.now();

			// Calculate interval in milliseconds
			const intervals = {
				weekly: 7 * 24 * 60 * 60 * 1000,
				biweekly: 14 * 24 * 60 * 60 * 1000,
				monthly: 30 * 24 * 60 * 60 * 1000
			};

			const interval = intervals[schedule];
			if (!interval) {
				d20plus.ut.log(`Unknown backup schedule: ${schedule}`);
				return;
			}

			if (now - lastBackup >= interval) {
				d20plus.ut.log("Auto-backup is due, creating backup...");
				await d20plus.autoBackup.createBackup(false);
			} else {
				const nextBackup = new Date(lastBackup + interval);
				d20plus.ut.log(`Next auto-backup scheduled for: ${nextBackup.toISOString()}`);
			}
		} catch (e) {
			d20plus.ut.error("Failed to check scheduled backup:", e);
		}
	};

	/**
	 * Initialize auto-backup system
	 */
	d20plus.autoBackup.init = () => {
		if (!window.is_gm) {
			d20plus.ut.log("Auto-backup is GM-only, skipping initialization");
			return;
		}

		d20plus.ut.log("Initializing Auto-Backup system");

		// Wait 5 seconds after page load to check for scheduled backup
		setTimeout(() => {
			d20plus.autoBackup.checkAndRunScheduledBackup();
		}, 5000);
	};

	// ===========================
	// TOOL UI
	// ===========================

	d20plus.tool.tools.push({
		toolId: "AUTO_BACKUP",
		name: "Auto Backup",
		desc: "Configure automatic campaign backups and manage backup history",
		html: `
			<div id="d20plus-autobackup" title="BetteR20 - Auto Backup" style="position: relative">
				<h3>Auto Backup Configuration</h3>
				<p>Backups are stored as archived handouts named "BetteR20 Backup - [date]"</p>
				<p>Older backups beyond the configured limit are automatically deleted.</p>

				<hr>

				<h4>Manual Backup</h4>
				<button class="btn" name="backup-now">Backup Now</button>
				<span name="backup-status" style="margin-left: 10px; font-style: italic;"></span>

				<hr>

				<h4>Backup List</h4>
				<div id="backup-list-container">
					<ul class="list backuplist" style="max-height: 400px; overflow-y: auto; display: block; margin: 0;">
						<!-- populated by JS -->
					</ul>
				</div>

				<hr>

				<p><i>Schedule and retention settings are in the Config Editor (Settings > Edit Config > Auto Backup tab)</i></p>
			</div>
		`,
		dialogFn: () => {
			$("#d20plus-autobackup").dialog({
				autoOpen: false,
				width: 600,
				height: 500,
			});
		},
		openFn: () => {
			const $win = $("#d20plus-autobackup");
			$win.dialog("open");

			const $btnBackupNow = $win.find(`[name="backup-now"]`);
			const $backupStatus = $win.find(`[name="backup-status"]`);
			const $backupList = $win.find(".backuplist");

			// Populate backup list
			const populateBackupList = () => {
				const backups = d20plus.autoBackup.listBackups();
				backups.sort((a, b) => b.attributes.name.localeCompare(a.attributes.name));

				$backupList.empty();

				if (backups.length === 0) {
					$backupList.append(`<li style="padding: 5px;"><i>No backups found</i></li>`);
				} else {
					backups.forEach(backup => {
						const name = backup.attributes.name;
						const dateStr = name.replace(BACKUP_HANDOUT_PREFIX, "");

						const $li = $(`<li style="padding: 5px; display: flex; justify-content: space-between; align-items: center;"></li>`);
						const $label = $(`<span></span>`).text(dateStr);
						const $buttons = $(`<span style="white-space: nowrap;"></span>`);

						const $downloadBtn = $(`<button class="btn btn-sm" style="margin-left: 10px;" title="Download backup"><i class="fa fa-download"></i></button>`);
						const $deleteBtn = $(`<button class="btn btn-sm btn-danger" style="margin-left: 5px;" title="Delete backup"><i class="fa fa-trash"></i></button>`);

						$downloadBtn.on("click", async (e) => {
							e.stopPropagation();
							$backupStatus.text("Loading backup data...");

							try {
								// Use loadBackupData to handle both single and split backups
								const backupJson = await d20plus.autoBackup.loadBackupData(backup);

								// Create filename from backup name
								const filename = name.replace(/[^-\w\s]/g, "_") + ".json";

								// Create blob and download
								const blob = new Blob([backupJson], {type: "application/json"});
								d20plus.ut.saveAs(blob, filename);

								$backupStatus.text("Download started!");
								setTimeout(() => {
									$backupStatus.text("");
								}, 2000);
							} catch (e) {
								d20plus.ut.error("Failed to download backup:", e);
								$backupStatus.text("Download failed: " + e.message);
								setTimeout(() => {
									$backupStatus.text("");
								}, 5000);
							}
						});

						$deleteBtn.on("click", (e) => {
							e.stopPropagation();
							if (confirm(`Are you sure you want to delete this backup?\n\n${dateStr}`)) {
								try {
									d20plus.autoBackup.deleteBackup(backup);
									$backupStatus.text("Backup deleted!");
									populateBackupList();
									setTimeout(() => {
										$backupStatus.text("");
									}, 2000);
								} catch (e) {
									d20plus.ut.error("Failed to delete backup:", e);
									$backupStatus.text("Delete failed: " + e.message);
									setTimeout(() => {
										$backupStatus.text("");
									}, 5000);
								}
							}
						});

						$buttons.append($downloadBtn).append($deleteBtn);
						$li.append($label).append($buttons);
						$backupList.append($li);
					});
				}
			};

			populateBackupList();

			// Backup Now button
			$btnBackupNow.off("click").on("click", async () => {
				try {
					$btnBackupNow.prop("disabled", true);
					$backupStatus.text("Creating backup...");

					await d20plus.autoBackup.createBackup(true);

					$backupStatus.text("Backup created successfully!");
					populateBackupList();

					setTimeout(() => {
						$backupStatus.text("");
					}, 3000);
				} catch (e) {
					$backupStatus.text("Backup failed! Check console for details.");
				} finally {
					$btnBackupNow.prop("disabled", false);
				}
			});
		}
	});
}

SCRIPT_EXTENSIONS.push(baseToolAutoBackup);
