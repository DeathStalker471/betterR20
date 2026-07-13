function baseUtil () {
	const vttesUrl = "https://justas-d.github.io/roll20-enhancement-suite/";
	let shownHardDickWarning = false;

	d20plus.ut = {};

	// d20plus.ut.WIKI_URL = "https://wiki.5e.tools"; // I'll be back ...
	d20plus.ut.WIKI_URL = "https://wiki.tercept.net/en/betteR20";

	d20plus.ut.fixS3Url = (url) => {
		if (!url || typeof url !== "string") return url;
		// Fix old S3 AWS URLs to new files.d20.io format
		let fixed = url;
		// Pattern 1: Full S3 AWS URL -> files.d20.io
		fixed = fixed.replace(/^https?:\/\/s3\.amazonaws\.com\/(files\.d20\.io\/(images|marketplace)\/\d+\/[^/]+\/.*?\.(jpg|jpeg|png|gif|webp))(\?.*)?$/i, "https://$1");
		// Pattern 2: Relative path starting with /files.d20.io -> absolute URL
		fixed = fixed.replace(/^\/(files\.d20\.io\/(images|marketplace)\/\d+\/[^/]+\/.*?\.(jpg|jpeg|png|gif|webp))(\?.*)?$/i, "https://$1");
		// Pattern 3: Already correct files.d20.io URL but strip query params
		fixed = fixed.replace(/^(https?:\/\/files\.d20\.io\/(images|marketplace)\/\d+\/[^/]+\/.*?\.(jpg|jpeg|png|gif|webp))(\?.*)?$/i, "$1");
		// Pattern 4: Bare domain path (files.d20.io/...) -> full URL
		if (fixed.startsWith("files.d20.io/")) {
			fixed = "https://" + fixed.replace(/\?.*$/, "");
		}
		return fixed;
	};

	d20plus.ut.log = (...args) => {
		// eslint-disable-next-line no-console
		console.log("%cD20Plus > ", "color: #3076b9; font-size: large", ...args);
		$("#boring-progress").html(`<span>&gt;</span>${args.join(" ").toLocaleLowerCase()}`);
	};

	d20plus.ut.error = (...args) => {
		// eslint-disable-next-line no-console
		console.error("%cD20Plus > ", "color: #b93032; font-size: large", ...args);
	};

	d20plus.ut.chatLog = (arg) => {
		d20.textchat.incoming(
			false,
			{
				who: "betteR20",
				type: "general",
				content: (arg || "").toString(),
				playerid: window.currentPlayer.id,
				id: d20plus.ut.generateRowId(),
				target: window.currentPlayer.id,
				avatar: "https://i.imgur.com/bBhudno.png",
			},
		);
	};

	d20plus.ut.ascSort = (a, b) => {
		if (b === a) return 0;
		return b < a ? 1 : -1;
	};


	d20plus.ut.injectCode = (object, method, injectedCode) => {
		const original = object[method].bind(object);
		object[method] = (...initParams) => {
			return injectedCode.bind(object)(original, initParams);
		}
	}

	d20plus.ut.checkVersion = () => {
		d20plus.ut.log("Checking current version");

		const isStreamer = !!d20plus.cfg.get("chat", "streamerChatTag");
		const scriptName = isStreamer ? "Script" : "betteR20";
		$.ajax({
			url: `${B20_REPO_URL}betteR20-version`,
			success: (data) => {
				if (data) {
					const curr = d20plus.version;
					const avail = data;
					const cmp = d20plus.ut.cmpVersions(curr, avail);
					if (cmp < 0) {
						setTimeout(() => {
							if (!isStreamer) {
								const rawToolsInstallUrl = `${B20_REPO_URL}betteR20-5etools.user.js`;
								const rawCoreInstallUrl = `${B20_REPO_URL}betteR20-core.user.js`;
								const msgVars = [scriptName, avail, rawToolsInstallUrl, rawCoreInstallUrl];
								d20plus.ut.sendHackerChat(`
									<div class="userscript-b20intro" style="border: 1px solid; background-color: #582124;">
									<br>A newer version of ${msgVars[0]} is available.<br>Get ${msgVars[1]} <a href="${msgVars[2]}">5etools</a> OR <a href="${msgVars[3]}">core</a>.<br><br>
									</div>
								`);
							} else {
								d20plus.ut.sendHackerChat(`<br>A newer version of ${scriptName} is available.<br><br>`);
							}
						}, 1000);
					}
				}
			},
			error: () => {
				d20plus.ut.log("Failed to check version");
			},
		})
	};

	d20plus.ut.showHardDickMessage = (scriptName) => {
		if (shownHardDickWarning) return;
		shownHardDickWarning = true;

		/* d20plus.ut.sendHackerChat(`
			${scriptName} needs VTT Enhancement Suite! Please install it from <a href="${vttesUrl}">here</a>.
			<br>
		`, true); */
	};

	d20plus.ut.chatTag = () => {
		const legacyStyle = !!d20plus.cfg.getOrDefault("chat", "legacySystemMessagesStyle");
		const showWelcome = !!d20plus.cfg.getOrDefault("chat", "showWelcomeMessage");
		const isStreamer = !!d20plus.cfg.get("chat", "streamerChatTag");
		const classname = !legacyStyle ? "userscript-b20intro" : "userscript-hackerintro";
		const scriptName = isStreamer ? "Script" : d20plus.scriptName;
		const vttesVersion = window.r20es?.hooks?.welcomeScreen?.config?.previousVersion;
		const data = [
			d20plus.scriptName,
			(vttesVersion && `v${vttesVersion}`) || "not",
			d20plus.ut.WIKI_URL,
		];
		const welcomeTemplate = (b20v, vttv, faq) => `
			<div class="${classname}">
				<img src="" class="userscript-b20img" style="content: unset; width:30px;position: relative;top: 10px;float: right;margin-left:-20px">
				<h1 style="display: inline-block;line-height: 25px;margin-top: 5px; font-size: 22px;">
					betteR20 
					<span style=" font-size: 13px ; font-weight: normal">by 5etools</span>
					<p style="font-size: 11px;line-height: 15px;font-family: monospace;color: rgb(32, 194, 14);">VTTES ${vttv} detected<br>${b20v} loaded</p>
				</h1>
				<p>Need help? Visit our <a href="${faq}/index.php/BetteR20_FAQ"><strong>wiki</strong></a> or join our <a href="https://discord.gg/nGvRCDs"><strong>Discord</strong></a>.</p>
				<span title="You'd think this would be obvious.">
					<p>Please DO NOT post about this script or any related content in official channels, including the Roll20 forums.</p>
					<p>Before reporting a bug on the Roll20 forums, please disable the script and check if the problem persists.</p>
				</span>
			</div>
		`;
		const $boringProgress = $("#boring-progress");
		if (showWelcome) {
			if (!isStreamer) {
				d20plus.ut.sendHackerChat(welcomeTemplate(...data));
			} else {
				d20plus.ut.sendHackerChat(`VTTE detected and ${scriptName} successfully loaded.<br>`);
			}
		}
		if (window.enhancementSuiteEnabled) {
			$boringProgress.before(`<span><span>&gt;</span>vtt enhancement suite detected</span>`)
		} else {
			d20plus.ut.showHardDickMessage(scriptName);
		}
		d20plus.betaFeaturesEnabled && !isStreamer && d20plus.ut.sendHackerChat(`
			<div class="userscript-b20intro" style="border: 1px solid; background-color: #582124;">
			betteR20 does not support the beta UI preview at this moment! Using it MAY OR MAY NOT make some betteR20 or roll20 functionality unavailable. If you experience problems, try disabling roll20 Beta Features.
			</div>
		`);
		$boringProgress
			.before(`<span><span>&gt;</span>all systems operational</span>`)
			.html("");
		setTimeout(() => {
			const $bored = $(`.boring-chat`);
			$bored.css("height", "0px");
			setTimeout(() => {
				$bored.remove();
				clearInterval(d20plus.ut.cursor);
			}, 2000);
		}, 6000);
	};

	d20plus.ut.showInitMessage = () => {
		const consTemplate = `<div class="boring-chat">
			<span><span>&gt;</span>initializing, please wait...</span>
			<span id="boring-progress"><span>&gt;</span>loading data</span>
			<span id="boring-cursor"><span>&gt;</span><aside>|</aside></span>
			<style type="text/css">
			.boring-chat {
				font-family: Menlo, Monaco, Consolas, monospace;
				font-size: small;
				background: black;
				display: inline-block;
				font-weight: bold;
				color: rgb(32, 194, 14);
				width: 100%;
				position: sticky;
				z-index: 1000;
				top: 0px;
				height: 110px;
				transition: height 2s;
				overflow: hidden;
				border-bottom: 1px solid rgb(32, 194, 14);
			}
			.boring-chat > span {
				display: block; white-space: nowrap;
				padding: 0px 5px 0px 45px;
			}
			.boring-chat > span > span {
				float: left; margin-left: -39px;
			}
			</style>
		</div>`;
		$(`#textchat`).prepend(consTemplate);
		let blink = false;
		const $bored = $(`.boring-chat`);
		d20plus.ut.cursor = setInterval(() => {
			$bored.append($(`.boring-cursor`));
			if (blink) $bored.find(`aside`).html("|");
			else $bored.find(`aside`).html("");
			blink = !blink;
		}, 300);
	};

	d20plus.ut.showLoadingMessage = () => {
		const isStreamer = !!d20plus.cfg?.get("chat", "streamerChatTag");
		const scriptName = isStreamer ? "Script" : d20plus.scriptName;
		const loadMsgTemplate = `<span><span>&gt;</span>loading ${d20plus.scriptName}</span>`;
		if (!isStreamer) $(".boring-chat > span:first-child").after(loadMsgTemplate);
		if (!window.enhancementSuiteEnabled) d20plus.ut.showHardDickMessage(scriptName);
		// to get rid of an uncaught error that keeps appearing on timely basis
		if (!window.DD_RUM) window.DD_RUM = {addAction: () => {} };
	}

	d20plus.ut.showFullScreenWarning = (msg) => {
		const $body = $(`body`);
		$body.addClass("ve-fswarn__body");
		const $btnClose = $(`<button class="btn btn-danger ve-fswarn__btn-close">X</button>`)
			.click(() => {
				$overlay.remove();
				$body.removeClass("ve-fswarn__body");
			});
		const $overlay = $(`<div class="flex-col flex-vh-center ve-fswarn__overlay"/>`);
		$btnClose.appendTo($overlay);
		$overlay.append(`<div class="flex-col flex-vh-center">
			<div class="ve-fswarn__title mb-2">${msg.title || ""}</div>
			<div><i>betterR20: ${msg.message || ""}.<br>
			${msg.instructions || ""}</i></div>
			<style type="text/css">
				.ve-fswarn__body {overflow: hidden !important;}
				.ve-fswarn__overlay {background: darkred;position: fixed; z-index: 99999; top: 0; right: 0;	bottom: 0; left: 0; width: 100vw; height: 100vh; color: white; font-family: monospace;}
				.ve-fswarn__title {font-size: 72px;line-height: normal;}
				.ve-fswarn__btn-close {position: absolute;top: 8px;right: 8px;font-size: 16px;}
				.flex-col.flex-vh-center {display: flex;flex-direction: column;justify-content: center;align-items: center;}
			</style>
		</div>`).appendTo($body);

		$(`.boring-chat`).remove();

		d20?.textchat?.incoming(false, ({
			who: "system",
			type: "system",
			content: `<span style="color: red;">betterR20: ${msg.message || "error occurred"}! Exiting...</span>`,
		}));
	}

	d20plus.ut.sendHackerChat = (message, error = false) => {
		const legacyStyle = !!d20plus.cfg.get("chat", "legacySystemMessagesStyle");
		if (!message) return;
		d20.textchat.incoming(false, ({
			who: "system",
			type: !legacyStyle && error ? "error" : "system",
			content: (legacyStyle ? `<span class="${error ? "hacker-chat-error" : "hacker-chat"}">
				${message}
			</span>` : message),
		}));
	};

	d20plus.ut.generateVersionInfo = () => {
		d20plus.ut.log("Generating version info");
		const b20n = encodeURI(d20plus.scriptName.split("-")[1].split(" v")[0]);
		const b20v = encodeURI(d20plus.version);
		const vtte = encodeURI(window.r20es?.hooks?.welcomeScreen?.config?.previousVersion);
		const phdm = d20plus.ut.detectDarkModeScript();
		const date = Number(new Date());
		const info = btoa(JSON.stringify({b20n, b20v, vtte, phdm, dnd20: window.b20, date}));
		return info;
	}

	d20plus.ut.parseVersionInfo = (raw) => {
		const info = JSON.parse(decodeURI(atob(raw)));
		const time = d20plus.ut.timeAgo(info.date);
		const phdm = info.phdm ? `<br>Detected DarkMode script` : "";
		const vttes = info.vtte ? `<br>Detected VTTES v${info.vtte}` : "";
		const dnd20 = info.dnd20 ? `<br>Detected Beyond20 extension` : "";
		let html = `Detected betteR20-${info.b20n} v${info.b20v}${vttes}${phdm}${dnd20}<br>Info updated ${time}`;
		if (d20plus.ut.cmpVersions(info.b20v, d20plus.version) < 0) html += `<br>Player's betteR20 may be outdated`;
		if (d20plus.ut.cmpVersions(info.vtte, window.r20es?.hooks?.welcomeScreen?.config?.previousVersion) < 0) html += `<br>Player's VTTES may be outdated`;
		return html;
	}

	d20plus.ut.cmpVersions = (present, latest) => {
		if (!present || !latest) return 0;
		const regExStrip0 = /(\.0+)+$/;
		const segmentsA = present.replace(regExStrip0, "").split(".");
		const segmentsB = latest.replace(regExStrip0, "").split(".");
		const l = Math.min(segmentsA.length, segmentsB.length);

		for (let i = 0; i < l; i++) {
			const diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10);
			if (diff) {
				return diff;
			}
		}
		return segmentsA.length - segmentsB.length;
	}

	d20plus.ut.detectDarkModeScript = () => {
		d20plus.ut.dmscriptDetected = false;
		// Detect if player is using Roll20 Dark Theme
		// https://github.com/Pharonix/Roll20-Dark-Theme
		$("style").each((i, el) => {
			if (el.textContent.indexOf("/*New Characteristics Menu*/") >= 0) {
				d20plus.ut.dmscriptDetected = true;
				return false;
			}
		});
		return d20plus.ut.dmscriptDetected;
	}

	d20plus.ut.addCSS = (selectors, rules) => {
		if (!(selectors instanceof Array)) selectors = [selectors];

		selectors.forEach(selector => {
			try {
				const index = d20plus.css.sheet.cssRules.length;
				if ("insertRule" in d20plus.css.sheet) {
					d20plus.css.sheet.insertRule(`${selector}{${rules}}`, index);
				} else if ("addRule" in d20plus.css.sheet) {
					d20plus.css.sheet.addRule(selector, rules, index);
				}
			} catch (e) {
				if ((!selector && selector.startsWith("-webkit-"))) {
					// eslint-disable-next-line no-console
					console.error(`Selector was "${selector}"; rules were "${rules}"`, e);
				}
			}
		});
	};

	d20plus.ut.addAllCss = () => {
		d20plus.ut.log("Adding CSS");

		const sheetElement = document.createElement("style");
		d20plus.css.sheet = document.head.appendChild(sheetElement).sheet;

		_.each(d20plus.css.baseCssRules, function (r) {
			d20plus.ut.addCSS(r.s, r.r);
		});
		if (!window.is_gm) {
			_.each(d20plus.css.baseCssRulesPlayer, function (r) {
				d20plus.ut.addCSS(r.s, r.r);
			});
		}
		_.each(d20plus.css.cssRules, function (r) {
			d20plus.ut.addCSS(r.s, r.r);
		});
	};

	d20plus.ut.timeAgo = (ts) => {
		const difInteger = Number(new Date()) - Number(ts);
		const difMinutes = Math.ceil((difInteger - 60000) / 60000);
		const difHours = Math.ceil((difInteger - 3600000) / 3600000);
		const difDays = Math.ceil((difInteger - 86400000) / 86400000);
		if (difDays > 0) return `${difDays} d ago`;
		if (difHours > 0) return `${difHours} hr ago`;
		if (difMinutes > 0) return `${difMinutes} min ago`;
		return `0 min ago`;
	}

	d20plus.ut.getAntiCacheSuffix = () => {
		return `?${(new Date()).getTime()}`;
	};

	d20plus.ut.generateRowId = () => {
		return window.generateUUID().replace(/_/g, "Z");
	};

	d20plus.ut.randomRoll = (roll, success, error) => {
		d20.textchat.diceengine.process(roll, success, error);
	};

	d20plus.ut.getJournalFolderObj = () => {
		d20.journal.refreshJournalList();
		let journalFolder = d20.Campaign.get("journalfolder");
		if (journalFolder === "") {
			d20.journal.addFolderToFolderStructure("Characters");
			d20.journal.refreshJournalList();
			journalFolder = d20.Campaign.get("journalfolder");
		}
		return JSON.parse(journalFolder);
	};

	d20plus.ut.fetchCharAttribs = async (char, keepSync) => {
		const attribs = char?.attribs;
		if (!attribs) return false;
		if (keepSync && !attribs.backboneFirebase) {
			attribs.backboneFirebase = new BackboneFirebase(attribs)
		}
		if (attribs.length) {
			return char;
		}
		if (!attribs.fetching) {
			attribs.fetch(attribs);
			attribs.fetching = true;
		}
		return new Promise(resolve => {
			let inProgress = 0;
			const wait = setInterval(() => {
				inProgress++;
				if (attribs.length) resolve(char);
				if (attribs.length || inProgress > 100) {
					resolve(false);
					clearInterval(wait);
					delete attribs.fetching;
					d20plus.ut.log(`Tried fetching ${char.attributes.name}`);
				}
			}, 30);
		});
	}

	d20plus.ut._lastInput = null;
	d20plus.ut.getNumberRange = (promptText, min, max) => {
		function alertInvalid () {
			alert("Please enter a valid range.");
		}

		function isOutOfRange (num) {
			return num < min || num > max;
		}

		function addToRangeVal (range, num) {
			range.add(num);
		}

		function addToRangeLoHi (range, lo, hi) {
			for (let i = lo; i <= hi; ++i) {
				range.add(i);
			}
		}

		function alertOutOfRange () {
			alert(`Please enter numbers in the range ${min}-${max} (inclusive).`);
		}

		while (true) {
			const res = prompt(promptText, d20plus.ut._lastInput || "E.g. 1-5, 8, 11-13");
			if (res && res.trim()) {
				d20plus.ut._lastInput = res;
				const clean = res.replace(/\s*/g, "");
				if (/^((\d+-\d+|\d+),)*(\d+-\d+|\d+)$/.exec(clean)) {
					const parts = clean.split(",");
					const out = new Set();
					let failed = false;

					for (const part of parts) {
						if (part.includes("-")) {
							const spl = part.split("-");
							const numLo = Number(spl[0]);
							const numHi = Number(spl[1]);

							if (isNaN(numLo) || isNaN(numHi) || numLo === 0 || numHi === 0 || numLo > numHi) {
								alertInvalid();
								failed = true;
								break;
							}

							if (isOutOfRange(numLo) || isOutOfRange(numHi)) {
								alertOutOfRange();
								failed = true;
								break;
							}

							if (numLo === numHi) {
								addToRangeVal(out, numLo);
							} else {
								addToRangeLoHi(out, numLo, numHi);
							}
						} else {
							const num = Number(part);
							if (isNaN(num) || num === 0) {
								alertInvalid();
								failed = true;
								break;
							} else {
								if (isOutOfRange(num)) {
									alertOutOfRange();
									failed = true;
									break;
								}
								addToRangeVal(out, num);
							}
						}
					}

					if (!failed) {
						d20plus.ut._lastInput = null;
						return out;
					}
				} else {
					alertInvalid();
				}
			} else {
				d20plus.ut._lastInput = null;
				return null;
			}
		}
	};

	d20plus.ut.getTokensDistanceText = (tokenAmodel, tokenBmodel) => {
		if (!tokenAmodel?.attributes || !tokenBmodel?.attributes) return "";
		const page = d20.Campaign.activePage().attributes;
		const tokenA = tokenAmodel.attributes;
		const tokenB = tokenBmodel.attributes;
		const distX = Math.abs(tokenA.left - tokenB.left) - tokenA.width / 2 - tokenB.width / 2 + 70;
		const distY = Math.abs(tokenA.top - tokenB.top) - tokenA.height / 2 - tokenB.height / 2 + 70;
		const distMapUnits = (dist) => Math.round(dist / 70 * (page.scale_number || 5));
		if (page.diagonaltype === "foure") {
			const maxDist = Math.max(distX, distY);
			return `${distMapUnits(maxDist)} ${page.scale_units || "ft."}`;
		} else if (page.diagonaltype === "manhattan") {
			const totDist = distX + distY;
			return `${distMapUnits(totDist)} ${page.scale_units || "ft."}`;
		} else {
			const distPixels = Math.sqrt(distX ** 2 + distY ** 2);
			return `${distMapUnits(distPixels)} ${page.scale_units || "ft."}`;
		}
	};

	d20plus.ut.getPathById = (pathId) => {
		return d20plus.ut._getCanvasElementById(pathId, "thepaths");
	};

	d20plus.ut.getTokenById = (tokenId) => {
		return d20plus.ut._getCanvasElementById(tokenId, "thegraphics");
	};

	d20plus.ut.getAccountById = (playerId) => {
		return d20.Campaign.players.get(playerId)?.attributes?.d20userid;
	};

	d20plus.ut.getPlayerNameById = (playerId) => {
		return d20.Campaign.players.get(playerId)?.attributes?.displayname;
	};

	d20plus.ut._getCanvasElementById = (id, prop) => {
		const found = d20.Campaign.pages.models.find(model => model[prop]?.get(id));
		return found ? found[prop].get(id) : null;
	};

	d20plus.ut.getMacroByName = (macroName) => {
		const macros = d20.Campaign.players.map(p => p.macros.find(m => m.get("name") === macroName && (p.id === window.currentPlayer.id || m.visibleToCurrentPlayer())))
			.filter(Boolean);
		if (macros.length) {
			return macros[0];
		}
		return null;
	};

	d20plus.ut.getCharacter = (charRef) => {
		if (charRef === "selected") return d20.engine.selected()[0]?.model?.character;
		const characters = d20.Campaign.characters;
		if (charRef.id) return characters._byId[charRef.id];
		return characters._byId[charRef]
			|| characters.models.find(char => char.attributes.name === charRef);
	}

	d20plus.ut.getCharAttribByName = (char, attribName) => {
		return char.attribs?.models?.find(prop => prop?.attributes?.name === attribName);
	};

	d20plus.ut.getCharAbilityByName = (char, abilbName) => {
		return char.abilities?.models?.find(prop => prop?.attributes?.name === abilbName);
	};

	d20plus.ut.getCharMetaAttribByName = (char, attribNamePart, caseInsensitive) => {
		const extract = /^repeating_(?:attack|inventory|proficiencies|resource|spell_(?:\d?|cantrip)|traits)_[^_]*(?:_resource_(?:right|left)|)/;
		const toFind = caseInsensitive ? attribNamePart.toLowerCase() : attribNamePart;
		const metaAttrib = {_ref: {}};
		char.attribs?.models.forEach(prop => {
			const find = caseInsensitive
				? prop.attributes?.name.toLowerCase().includes(toFind)
				: prop.attributes?.name.includes(toFind);
			if (!find) return;
			metaAttrib._ref._id = metaAttrib._ref._id
				|| prop.attributes.name.match(extract)?.last()
				|| attribNamePart;
			const attribName = prop.attributes.name.replace(metaAttrib._ref._id, "").slice(1);
			metaAttrib[attribName || "current"] = prop.attributes.current;
			metaAttrib._ref[attribName || "current"] = prop;
			if (prop.attributes.max) {
				metaAttrib[`${attribName}max`] = prop.attributes.max;
				metaAttrib._ref[`${attribName}max`] = prop;
			}
		});
		if (Object.entries(metaAttrib).length > 1) return metaAttrib;
	}

	d20plus.ut._BYTE_UNITS = ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	d20plus.ut.getReadableFileSizeString = (fileSizeInBytes) => {
		let i = -1;
		do {
			fileSizeInBytes = fileSizeInBytes / 1024;
			i++;
		} while (fileSizeInBytes > 1024);
		return Math.max(fileSizeInBytes, 0.1).toFixed(1) + d20plus.ut._BYTE_UNITS[i];
	};

	d20plus.ut.sanitizeFilename = function (str) {
		return str.trim().replace(/[^-\w]/g, "_");
	};

	d20plus.ut.saveAsJson = function (filename, data) {
		const blob = new Blob([JSON.stringify(data, null, "\t")], {type: "application/json"});
		d20plus.ut.saveAs(blob, `${filename}.json`);
	};

	// based on:
	/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/src/FileSaver.js */
	d20plus.ut.saveAs = (function () {
		const view = window;
		let
			doc = view.document;
			// only get URL when necessary in case Blob.js hasn't overridden it yet
		let get_URL = function () {
			return view.URL || view.webkitURL || view;
		};
		let save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a");
		let can_use_save_link = "download" in save_link;
		let click = function (node) {
			let event = new MouseEvent("click");
			node.dispatchEvent(event);
		};
		let is_safari = /constructor/i.test(view.HTMLElement) || view.safari;
		let is_chrome_ios = /CriOS\/[\d]+/.test(navigator.userAgent);
		let setImmediate = view.setImmediate || view.setTimeout;
		let throw_outside = function (ex) {
			setImmediate(function () {
				throw ex;
			}, 0);
		};
		let force_saveable_type = "application/octet-stream";
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		let arbitrary_revoke_timeout = 1000 * 40; // in ms
		let revoke = function (file) {
			let revoker = function () {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		};
		let dispatch = function (filesaver, event_types, event) {
			event_types = [].concat(event_types);
			let i = event_types.length;
			while (i--) {
				let listener = filesaver[`on${event_types[i]}`];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		};
		let auto_bom = function (blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		};
		let FileSaver = function (blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			let
				filesaver = this;
			let type = blob.type;
			let force = type === force_saveable_type;
			let object_url;
			let dispatch_all = function () {
				dispatch(filesaver, "writestart progress write writeend".split(" "));
			};
			// on any filesys errors revert to saving with object URLs
			let fs_error = function () {
				if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
					// Safari doesn't allow downloading of blob urls
					let reader = new FileReader();
					reader.onloadend = function () {
						let url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, "data:attachment/file;");
						let popup = view.open(url, "_blank");
						if (!popup) view.location.href = url;
						url = undefined; // release reference before dispatching
						filesaver.readyState = filesaver.DONE;
						dispatch_all();
					};
					reader.readAsDataURL(blob);
					filesaver.readyState = filesaver.INIT;
					return;
				}
				// don't create more object URLs than needed
				if (!object_url) {
					object_url = get_URL().createObjectURL(blob);
				}
				if (force) {
					view.location.href = object_url;
				} else {
					let opened = view.open(object_url, "_blank");
					if (!opened) {
						// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
						view.location.href = object_url;
					}
				}
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
				revoke(object_url);
			};
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setImmediate(function () {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				}, 0);
				return;
			}

			fs_error();
		};
		let FS_proto = FileSaver.prototype;
		let saveAs = function (blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		};
		// IE 10+ (native saveAs)
		if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
			return function (blob, name, no_auto_bom) {
				name = name || blob.name || "download";

				if (!no_auto_bom) {
					blob = auto_bom(blob);
				}
				return navigator.msSaveOrOpenBlob(blob, name);
			};
		}
		FS_proto.abort = function () {};
		FS_proto.readyState = FS_proto.INIT = 0;
		FS_proto.WRITING = 1;
		FS_proto.DONE = 2;
		FS_proto.error =
			FS_proto.onwritestart =
				FS_proto.onprogress =
					FS_proto.onwrite =
						FS_proto.onabort =
							FS_proto.onerror =
								FS_proto.onwriteend =
									null;

		return saveAs;
	}());

	d20plus.ut.promiseDelay = function (delay) {
		return new Promise(resolve => {
			setTimeout(() => resolve(), delay);
		})
	};

	d20plus.ut.LAYERS = ["map", "floors", "background", "objects", "roofs", "foreground", "gmlayer", "walls", "weather"];
	d20plus.ut.layerToName = (l) => {
		switch (l) {
			case "map": return "Map";
			case "floors": return "Floors";
			case "background": return "Background";
			case "objects": return "Objects & Tokens";
			case "roofs": return "Roofs";
			case "foreground": return "Foreground";
			case "gmlayer": return "GM Info Overlay";
			case "walls": return "Dynamic Lighting";
			case "weather": return "Weather Exclusions";
		}
	};

	d20plus.ut.get$SelValue = ($sel) => {
		return $sel[0].options[$sel[0].selectedIndex].value;
	};

	d20plus.ut.isUseSharedJs = () => {
		return BASE_SITE_URL.includes("://5e.tools")
			|| BASE_SITE_URL.includes("://5etools.com")
			|| /:\/\/5etools-mirror-\d+\./.test(BASE_SITE_URL);
	};

	d20plus.ut.dynamicStyles = (slug) => {
		if (!d20plus.css.dynamic) d20plus.css.dynamic = {};
		if (!d20plus.css.dynamic[slug]) {
			d20plus.css.dynamic[slug] = $("<style></style>").appendTo(document.body);
		}
		return d20plus.css.dynamic[slug];
	}

	/**
	* Assumes any other lists have been searched using the same term
	*/
	d20plus.ut.getSearchTermAndReset = (list, ...otherLists) => {
		let lastSearch = null;
		if (list.searched) {
			lastSearch = $(`#search`).val();
			list.search();
			otherLists.forEach(l => l.search());
		}
		list.filter();
		otherLists.forEach(l => l.filter());
		return lastSearch;
	};
}

SCRIPT_EXTENSIONS.push(baseUtil);

/*

map
afow
grid
background
objects
foreground
gmlayer
walls
weather

 */
