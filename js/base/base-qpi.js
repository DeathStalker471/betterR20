function baseQpi () {
	const qpi = {
		_version: "0.01-pre-pre-alpha",
		_: {
			log: {
				_ (...args) {
					qpi._log(...args)
				},
				works: 1,
			},

			// Campaign: { // FIXME this overwrites the window's campaign, which breaks stuff
			// 	_ () {
			// 		return Campaign;
			// 	},
			// 	works: 0
			// },

			on: {
				_preInit () {
					qpi._on_chatHandlers = [];
					if (d20.textchat.shoutref) {
						const seenMessages = new Set();
						d20.textchat.chatref = d20.textchat.shoutref.parent.child("chat");
						const handleChat = (e) => {
							if (!d20.textchat.chatstartingup) {
								e.id = e.key;
								if (!seenMessages.has(e.id)) {
									seenMessages.add(e.id);

									let t = e.val();
									if (t) {
										// eslint-disable-next-line no-console
										if (window.DEBUG) console.log("CHAT: ", t);

										qpi._on_chatHandlers.forEach(fn => fn(t));
									}
								}
							}
						};
						d20.textchat.chatref.on("child_added", handleChat);
						d20.textchat.chatref.on("child_changed", handleChat);
					} else {
						// eslint-disable-next-line no-console
						console.warn("%cQPI > ", "color: #b93032; font-size: large", "Can't properly initialize chat handler");
					}
				},
				_ (evtType, fn, ...others) {
					switch (evtType) {
						case "chat:message":
							qpi._on_chatHandlers.push(fn);
							break;
						default:
							// eslint-disable-next-line no-console
							console.error("Unhandled message type: ", evtType, "with args", fn, others)
							break;
					}
				},
				works: 0.01,
				notes: [
					`"chat:message" is the only available event.`,
				],
			},

			createObj: {
				_ (objType, obj, ...others) {
					switch (objType) {
						case "path": {
							const page = d20.Campaign.pages._byId[obj._pageid];
							obj.scaleX = obj.scaleX || 1;
							obj.scaleY = obj.scaleY || 1;
							obj.path = obj.path || obj._path
							return page.thepaths.create(obj)
						}
						default:
							// eslint-disable-next-line no-console
							console.error("Unhandled object type: ", objType, "with args", obj, others)
							break;
					}
				},
				works: 0.01,
				notes: [
					`Only supports "path" obects.`,
				],
			},

			sendChat: { // TODO lift code from doChatInput
				_ (speakingAs, input, callback, options) {
					const message = {
						who: speakingAs,
						type: "general",
						content: input,
						playerid: window.currentPlayer.id,
						avatar: null,
						inlinerolls: [],
					};

					const key = d20.textchat.chatref.push().key;
					d20.textchat.chatref.child(key).setWithPriority(message, Firebase.ServerValue.TIMESTAMP)
				},
				works: 0.01,
				notes: [
					`speakingAs: String only.`,
					`input: String only.`,
					`callback: Unimplemented.`,
					`options: Unimplemented.`,
					`Messages are always sent with the player ID of the QPI user.`,
				],
			},

			// findObjs: {
			// 	_ (attrs) {
			// 		// TODO
			// 		// const getters = {
			// 		// 	attribute: () => {},
			// 		// 	character: () => {},
			// 		// 	handout: () => {}
			// 		// };
			// 		// const getAll = () => {
			// 		// 	const out = [];
			// 		// 	Object.values(getters).forEach(fn => out.push(...fn()));
			// 		// 	return out;
			// 		// };
			//
			// 		// let out = attrs._type ? getters[attrs._type]() : getAll();
			//
			// 		throw new Error("findObjs is unimplemented!");
			// 	},
			// 	works: 0.00,
			// 	notes: [
			// 		`Unimplemented.`
			// 	]
			// }
		},

		_loadedScripts: null,
		async _init () {
			Object.keys(qpi._).forEach(k => {
				const it = qpi._[k];
				if (it._preInit) it._preInit();
				window[k] = it._;
			});

			qpi._loadedScripts = await StorageUtil.pGet("VeQpi") || {};

			$(`body`).append(`
				<div id="qpi-manager" title="Better20 - QPI Script Manager - v${qpi._version}">
					<div class="qpi-table"></div>
					<div>
						<input placeholder="URL*" class="qpi-url">
						<button class="btn qpi-add-url">Add URL</button>
					</div>
					<hr>
					<div>
						<input placeholder="Name*" class="qpi-name">
						<button class="btn qpi-add-text">Load Script</button>
						<br>
						<textarea class="qpi-text" style="width: 100%; height: 300px; resize: vertical;"></textarea>
					</div>
					<hr>
					<button class="btn qpi-help">Help/README</button> <i>Note that this tool is a for-testing faceplate over some internal code. It is intended for internal use only.</i>
				</div>
			`);
			$(`#qpi-manager`).dialog({
				autoOpen: false,
				resizable: true,
				width: 800,
				height: 600,
			});

			$(`body`).append(`
				<div id="qpi-manager-readme" title="QPI README - v${qpi._version}">
					<div class="qpi-readme"></div>
				</div>
			`);
			$(`#qpi-manager-readme`).dialog({
				autoOpen: false,
				resizable: true,
				width: 800,
				height: 600,
			});

			qpi._log("Initialised!");
		},

		man (name) {
			if (!name) {
				qpi._log(`Showing all...\n==== Available API Mimics ====\n  - ${Object.keys(qpi._).join("()\n  - ")}()`);
				return;
			}

			const found = Object.keys(qpi._).find(k => k === name);
			if (!found) qpi._log(`No mimic with ${name} found -- perhaps it's unimplemented?`);
			else {
				const it = qpi._[found];
				qpi._log(`Showing "${name}"...\n==== ${name} :: ${it.works * 100}% functional ====\n${(it.notes || []).join("\n")}`);
			}
		},

		_manHtml () {
			let stack = "";
			Object.keys(qpi._).forEach(k => {
				stack += `<h5>${k}</h5>`;
				const it = qpi._[k];
				stack += `<p><i>Estimated ${it.works * 100}% functional</i><br>${(it.notes || []).join("<br>")}</p>`;
			});
			return stack;
		},

		_openManager () {
			const $win = $(`#qpi-manager`);

			$win.find(`.qpi-help`).off("click").on("click", () => {
				const $winReadme = $(`#qpi-manager-readme`);
				$winReadme.dialog("open");

				$winReadme.find(`.qpi-readme`).html(qpi._manHtml());
			});

			$win.find(`.qpi-add-url`).off("click").on("click", () => {
				const url = $win.find(`.qpi-url`).val();
				if (url && script.trim()) {
					qpi._log(`Attempting to load: "${url}"`);
					d20plus.js.pLoadWithRetries(
						url,
						url,
					).then(data => {
						d20plus.js._addScript(url, data).then(() => {
							alert("Loaded successfully!");
							$win.find(`.qpi-url`).val("");
						}).catch(() => {
							alert(`Failed to load script! ${VeCt.STR_SEE_CONSOLE}`);
						});
					})
				} else {
					alert("Please enter a URL!");
				}
			});

			$win.find(`.qpi-add-text`).off("click").on("click", () => {
				const name = $win.find(`.qpi-name`).val();
				const script = $win.find(`.qpi-text`).val();
				if (name && script && name.trim() && script.trim()) {
					qpi._log(`Attempting to eval user script: ${name}`);
					d20plus.js._addScript(name, script).then(() => {
						alert("Loaded successfully!");
						$win.find(`.qpi-name`).val("");
						$win.find(`.qpi-text`).val("");
					}).catch(() => {
						alert("Failed to load script! See the console for more details (CTRL-SHIFT-J on Chrome)");
					});
				} else {
					alert("Please enter a name and some code!");
				}
			});

			$win.dialog("open");
		},

		_log (...args) {
			// eslint-disable-next-line no-console
			console.log("%cQPI > ", "color: #ff00ff; font-size: large", ...args);
		},
	};
	window.qpi = qpi;

	d20plus.qpi = {};
	d20plus.qpi.pInitMockApi = async () => { // TODO check if this needs to be enabled for players too
		d20plus.ut.log("Initialising mock API");
		await qpi._init();
	};
}

SCRIPT_EXTENSIONS.push(baseQpi);
