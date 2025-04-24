function d20plusVehicles () {
	d20plus.vehicles = {};

	d20plus.vehicles.fluff = null;

	d20plus.vehicles._loadFluff = async function () {
		// To prevent loading the fluff multiple times
		if (d20plus.vehicles.fluff) return;

		const fluffUrl = `${DATA_URL}fluff-vehicles.json`;
		DataUtil.loadJSON(fluffUrl).then((data) => {
			d20plus.vehicles.fluff = data.vehicleFluff;
		}).catch(e => {
			// eslint-disable-next-line no-console
			console.error(e);
		});
	}

	// Given the action name and entries, add an action
	d20plus.vehicles._addAction = function (character, renderer, actionName, entries, numActions) {
		const name = d20plus.importer.getCleanText(renderer.render(actionName));
		const text = d20plus.importer.getCleanText(renderer.render({entries: entries}, 1)).replace(/^\s*Hit:\s*/, "");
		d20plus.importer.addVehicleAction(character, name, text, numActions);
	}

	// Sets the image, mostly stolen from Giddy
	d20plus.vehicles._setFluffImage = function (character, data, fluff) {
		const tokenUrl = `${IMG_URL}vehicles/tokens/${data.source}/${data.name}.webp`;
		const primaryAvatarUrl = data.tokenUrl || Parser.nameToTokenName(tokenUrl);
		const tokenUrlFallBack = `${IMG_URL_REPO}vehicles/tokens/${data.source}/${data.name}.webp`;
		const secondaryAvatarUrl = data.tokenUrlFallBack || Parser.nameToTokenName(tokenUrlFallBack);
		const BLANK_WEBP_URL = `${IMG_URL_REPO}blank.webp`;// Fallback for blank image, currently set to mirror repo
		
		let firstFluffImageUrl = null;
		let isFirstFluffImageInternal = false;
		let internalFluffPath = null;
		if (d20plus.cfg.getOrDefault("import", "importCharAvatar") === "Portrait (where available)" && fluff && fluff.images && fluff.images.length > 0) {
			const firstImage = fluff.images[0] || {};
			if (firstImage.href) {
				if (firstImage.href.type === "internal") {
					internalFluffPath = firstImage.href.path;
					firstFluffImageUrl = `${IMG_URL}/${internalFluffPath}`;
					isFirstFluffImageInternal = true;
				} else {
					firstFluffImageUrl = firstImage.href.url; // External URL
					isFirstFluffImageInternal = false;
				}
			}
		}
		let initialFluffUrlToCheck = firstFluffImageUrl;

		const setFinalImages = (finalAvatar, fluffUrlToCheck, isInternal, fluffPath) => {
			if (isInternal && fluffUrlToCheck) {
				$.ajax({
					url: fluffUrlToCheck,
					type: 'HEAD',
					error: function() {
						const repoFallbackFluffUrl = `${IMG_URL_REPO}${fluffPath}`;
						console.warn(`Internal fluff image URL "${fluffUrlToCheck}" (using IMG_URL) failed. Attempting fallback using IMG_URL_REPO: ${repoFallbackFluffUrl}`);

						$.ajax({
							url: repoFallbackFluffUrl,
							type: 'HEAD',
							error: function() {
								console.error(`Fallback fluff image URL "${repoFallbackFluffUrl}" (using IMG_URL_REPO) also failed. Using NO fluff image.`);
								// If the REPO version ALSO fails, set fluff to null.
								d20plus.importer.getSetAvatarImage(character, finalAvatar, null);
							},
							success: function() {
								console.log(`Fallback fluff image URL "${repoFallbackFluffUrl}" succeeded.`);
								// REPO fallback succeeded, use it.
								d20plus.importer.getSetAvatarImage(character, finalAvatar, repoFallbackFluffUrl);
							}
						});
					},
					success: function() {
						//Fluff image URL check succeeded
						console.log(`Internal fluff image URL "${fluffUrlToCheck}" validated.`);
						d20plus.importer.getSetAvatarImage(character, finalAvatar, fluffUrlToCheck);
					}
				});
			} else {
				// Fluff image URL check not needed or not internal
				d20plus.importer.getSetAvatarImage(character, finalAvatar, fluffUrlToCheck);
			}
		};

		// --- Perform Avatar Checks ---
		// Check 1: Primary Avatar URL
		$.ajax({
			url: primaryAvatarUrl,
			type: "HEAD",
			error: function () {
				console.warn(`Primary avatar URL "${primaryAvatarUrl}" failed. Attempting secondary URL using IMG_URL_REPO: ${secondaryAvatarUrl}`);

				// Check 2: Secondary Avatar URL (IMG_URL_REPO based)
				$.ajax({
					url: secondaryAvatarUrl,
					type: "HEAD",
					error: function() {
						console.warn(`Secondary avatar URL "${secondaryAvatarUrl}" also failed. Using fallback: ${BLANK_WEBP_URL}`);
						// Both primary and secondary failed, use blank.webp
						setFinalImages(BLANK_WEBP_URL, initialFluffUrlToCheck, isFirstFluffImageInternal, internalFluffPath);
					},
					success: function() {
						console.log(`Secondary avatar URL "${secondaryAvatarUrl}" succeeded.`);
						// Secondary succeeded, use it
						setFinalImages(`${secondaryAvatarUrl}${d20plus.ut.getAntiCacheSuffix()}`, initialFluffUrlToCheck, isFirstFluffImageInternal, internalFluffPath);
					}
				});
			},
			success: function () {
				console.log(`Primary avatar URL "${primaryAvatarUrl}" succeeded.`);
				// Primary succeeded, use it
				setFinalImages(`${primaryAvatarUrl}${d20plus.ut.getAntiCacheSuffix()}`, initialFluffUrlToCheck, isFirstFluffImageInternal, internalFluffPath);
			}
		});
	}




	// Sets fluff text, mostly stolen from Giddy
	d20plus.vehicles._setFluff = function (character, data, fluff, renderer) {
		let renderFluff;
		if (data.entries) {
			renderFluff = renderer.render({entries: data.entries}, 1);
		}
		if (fluff && data.hasFluff) {
			const depth = fluff.type === "section" ? -1 : 2;
			if (fluff.type !== "section") renderer.setFirstSection(false);
			renderFluff = renderer.render({type: fluff.type, entries: fluff.entries || []}, depth);
		}

		if (renderFluff) {
			setTimeout(() => {
				const fluffAs = d20plus.cfg.get("import", "importFluffAs") || d20plus.cfg.getDefault("import", "importFluffAs");
				let k = fluffAs === "Bio" ? "bio" : "gmnotes";
				character.updateBlobs({
					[k]: Markdown.parse(renderFluff),
				});
				character.save({
					[k]: (new Date()).getTime(),
				});
			}, 500);
		}
	}

	// Import Vehicle button was clicked
	d20plus.vehicles.button = function () {
		const url = $("#import-vehicles-url").val();

		if (url && url.trim()) {
			DataUtil.loadJSON(url).then(async (data) => {
				await d20plus.importer.pAddBrew(url);
				d20plus.importer.showImportList(
					"vehicle",
					data.vehicle,
					d20plus.vehicles.handoutBuilder,
				);
			});
		}
	};

	d20plus.vehicles.handoutBuilder = async function (data, overwrite, inJournals, folderName, saveIdsTo, options) {
		// First make sure the fluff is there
		await d20plus.vehicles._loadFluff();

		// make dir
		const folder = d20plus.journal.makeDirTree(`Vehicles`, folderName);
		const path = ["Vehicles", ...folderName, data.name];

		// handle duplicates/overwrites
		if (!d20plus.importer._checkHandleDuplicate(path, overwrite)) return;

		const name = data.name;
		const source = data.source;
		d20.Campaign.characters.create(
			{
				name: name,
				tags: d20plus.importer.getTagString([
					Renderer.utils.getRenderedSize(data.size),
					Parser.vehicleTypeToFull(data.vehicleType),
					Parser.sourceJsonToFull(data.source),
				], "vehicle"),
			},
			{
				success: function (character) {
					if (saveIdsTo) saveIdsTo[UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VEHICLES](data)] = {name: data.name, source: data.source, type: "character", roll20Id: character.id};

					try {
						character.size = data.size || "L";
						character.name = name;
						character.senses = data.senses ? data.senses instanceof Array ? data.senses.join(", ") : data.senses : null;
						character.hp = data.hp;

						const renderer = new Renderer();
						renderer.setBaseUrl(BASE_SITE_URL);

						character.attribs.create({name: "npc", current: 1});
						character.attribs.create({name: "npc_options-flag", current: "on"});
						character.attribs.create({name: "is_vehicle", current: "1"});
						// region disable charachtermancer
						character.attribs.create({name: "mancer_confirm_flag", current: ""});
						character.attribs.create({name: "l1mancer_status", current: "completed"});
						// endregion
						character.attribs.create({name: "wtype", current: d20plus.importer.getDesiredWhisperType()});
						character.attribs.create({name: "rtype", current: d20plus.importer.getDesiredRollType()});
						character.attribs.create({
							name: "queryadvantage",
							current: d20plus.importer.getDesiredAdvantageToggle(),
						});
						character.attribs.create({
							name: "whispertoggle",
							current: d20plus.importer.getDesiredWhisperToggle(),
						});

						// Setting the basic vehicle variables
						const achpContainer = data.vehicleType === "INFWAR" ? data.hp : (data.hull || data);
						const acType = achpContainer.acFrom ? achpContainer.acFrom[0] : Parser.vehicleTypeToFull(data.vehicleType);
						const crew = (data.capCreature ? data.capCreature : data.capCrew) || 0;
						let speed = "\u2014";
						if (data.speed) speed = Parser.getSpeedString(data);
						else if (data.pace) speed = `${data.pace * 10} ft.`;
						const keel = data.dimensions ? data.dimensions[0].split(" ")[0] : "";
						const beam = data.dimensions ? data.dimensions[1].split(" ")[0] : "";
						const tokenSize = data.vehicleType === "SPELLJAMMER"
							? 4
							: {"L": 2, "H": 3, "G": 4}[data.size] || 1;

						character.attribs.create({name: "vehicle_ac", current: achpContainer.ac || ""});
						character.attribs.create({name: "vehicle_actype", current: acType});
						character.attribs.create({name: "vehicle_cargo", current: data.capCargo || ""});
						character.attribs.create({name: "vehicle_hp", current: achpContainer.hp || 0, max: achpContainer.hp || 0});
						character.attribs.create({name: "vehicle_crew", current: crew});
						character.attribs.create({name: "vehicle_dt", current: achpContainer.dt || ""});
						character.attribs.create({name: "vehicle_keel", current: keel});
						character.attribs.create({name: "vehicle_beam", current: beam});
						character.attribs.create({name: "vehicle_speed", current: speed});
						character.attribs.create({name: "vehicle_cost", current: Parser.vehicleCostToFull(data)});
						character.attribs.create({name: "token_size", current: tokenSize});

						// This adds weapons, or anything that might end up in the weapon catagory
						if (data.weapon) d20plus.importer.addVehicleWeapons(character, data.weapon, renderer);
						if (data.control) d20plus.importer.addVehicleWeapons(character, data.control, renderer, "Control");
						if (data.movement) d20plus.importer.addVehicleWeapons(character, data.movement, renderer, "Movement");
						if (data.trait) d20plus.importer.addVehicleWeapons(character, data.trait, renderer, "Trait");

						let numActions = 0;

						// Some ships (mostly UA) have an other catagory that contains an action explaining how that ship's actions work
						if (data.other) {
							d20plus.vehicles._addAction(character, renderer, data.other[0].name, data.other[0].entries, numActions++);
						}
						// Mostly GoS ships
						if (data.action && typeof data.action[0] === "string") {
							const text = d20plus.importer.getCleanText(renderer.render(data.action[0], 1)).replace(/^\s*Hit:\s*/, "");
							d20plus.importer.addVehicleAction(character, "Actions", text, numActions++);

							data.action[1].items.forEach((a, i) => {
								let actionEntries = [];
								if (data.weapon && i < data.weapon.length) actionEntries = data.weapon[i].entries;
								actionEntries.push(a.entry);
								d20plus.vehicles._addAction(character, renderer, a.name, actionEntries, numActions++);
							});
						}
						// Litterally just the Stahlmaster
						else if (data.action) {
							data.action.forEach(a => {
								d20plus.vehicles._addAction(character, renderer, a.name, a.entries, numActions++);
							});
						}
						// Mostly BGDIA infernal war machines
						else if (data.actionStation) {
							data.actionStation.forEach(a => {
								d20plus.vehicles._addAction(character, renderer, a.name, a.entries, numActions++);
							});
						}
						// Sort of a catch all but works especially well with spelljammer
						else if (data.weapon) {
							data.weapon.forEach(w => {
								if (w.action) {
									w.action.forEach(a => {
										d20plus.vehicles._addAction(character, renderer, a.name, a.entries.concat(w.entries), numActions++);
									});
								}
								else if (w.entries) {
									d20plus.vehicles._addAction(character, renderer, w.name, w.entries, numActions++);
								}
							});
						}

						character.view.updateSheetValues();

						// Deal with fluff and images here
						const fluff = d20plus.vehicles.fluff?.find(it => it.name === data.name && it.source === data.source);
						d20plus.vehicles._setFluffImage(character, data, fluff);
						d20plus.vehicles._setFluff(character, data, fluff, renderer);
					} catch (e) {
						d20plus.ut.log(`Error loading [${name}]`);
						d20plus.importer.addImportError(name);
						// eslint-disable-next-line no-console
						console.log(data, e);
					}
					d20.journal.addItemToFolderStructure(character.id, folder.id);
				},
			},
		);
	};
}

SCRIPT_EXTENSIONS.push(d20plusVehicles);
