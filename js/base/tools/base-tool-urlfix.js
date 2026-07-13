function baseToolUrlFix () {
	// b20-JS: Ultimate tokens & URLs fixer
	// Run the macro, and it will show the list of images by domain
	// and you'll be able to run default fixer scripts or create your own

	// The full custom rules syntax below:

	// <search>; <replace>[; <condition>[; <callback>[; <tabs(comma-separated)>]]]

	// Each rule should begin with new line. Spaces/tabs after semicolon are ignored
	// The <search> and <condition> support regular expressions if /wrapped in slashes/
	// The interface deliberately omits the details beyond search/replace/condition,
	// But if you're reading this you know what you're doing.

	// Arguments and their explanations are listed below
	// They work similarly for custom rules and [defaultRules]

	// rule = {
	//		name: "Name",					// Rule name (custom will be named #1, #2...)
	//		search: /regexp/ || "str",		// Search string
	//		replace: "string",				// Replacement (supports $N for regexp)
	//		condition: [/regex/ || "str"],	// Only apply rule if the string has these ("&&")
	//		callback: ["encodeURI"],		// One of the {callbacks} applied to the output
	//										// ["encodeURI", "decodeURIComponent"]
	//		tabs: ["placed"],				// Apply rule to specific image types
	//										// ["placed", "default", "multi", "avatar"]
	//		dns: ["domain"],				// Simpler conditioning for [defaultRules]
	//		migrating: true,				// True if current rule results in domain change
	// },

	const lag = 50;
	const previews = {
		normal: 4,
		extended: 8,
		single: 16,
		max: 128,
	};
	const cssHeight = {
		checkboxes: 107,
		textareaGrowth: 20,
		configBlock: 110,
	};

	const defaultRules = [
		{
			name: "Discord.app links -> require attention",
			search: /^https:\/\/cdn\.discordapp\.com\/attachments(.*?)$/,
			replace: "",
			callback: ["unfixableAskUser"],
			dns: ["cdn.discordapp.com"],
		},
		{
			name: "Extract from imgsrv.roll20.net",
			search: /^https:\/\/imgsrv\.roll20\.net\/\?src=(.*?)&cb=(\d*?)$/,
			replace: "$1",
			callback: ["decodeURIComponent"],
			dns: ["imgsrv.roll20.net"],
			tabs: ["placed", "default", "multi"],
			migrating: true,
		},
		{
			name: "5etools-mirror-1 -> 5e.tools/bestiary",
			search: /^https:\/\/5etools-mirror-1\.github\.io\/\/?img\/(?:bestiary\/|)(.*?)\/([^/]*?)\.([\w-]*?)(\?\d*|)$/,
			replace: "https://5e.tools/img/bestiary/tokens/$1/$2.$3$4",
			dns: ["5etools-mirror-1.github.io"],
			migrating: true,
		},
		{
			name: "5e.tools -> 5e.tools/bestiary",
			search: /^https:\/\/5e.tools\/img\/([^/]*?)\/([^/]*?)\.([\w-]*?)(\?\d*|)$/,
			replace: "https://5e.tools/img/bestiary/tokens/$1/$2.$3$4",
			dns: ["5e.tools"],
			migrating: true,
		},
		{
			name: "5e.tools image -> .webp",
			search: /\/(.*?)\.(png|jpg)(\?\d*|)$/,
			replace: "/$1.webp$3",
			dns: ["5etools-mirror-1.github.io", "5e.tools"],
		},
		{
			name: "?multiside-parameters -> #multiside-parameters",
			search: /\?roll20_(token_size|skip_token)=/g,
			replace: "#roll20_$1=",
			tabs: ["multi"],
		},
	];

	const defaultFilter = ["", "s3.amazonaws.com"];

	const callbacks = {
		encodeURI,
		encodeURIComponent,
		decodeURIComponent,
		getCurrentName: (urlPart, item) => {
			return item.model.attributes.name;
		},
		unfixableAskUser: (urlPart, item) => {
			item.error = true;
			return urlPart;
		},
	};

	const urls = {};
	const config = {};
	const $html = {};

	const fixer = (() => {
		const currentDns = (tab) => {
			tab = tab || config.currentTab;
			return Object.keys(tab.domains).filter(dn => {
				return !tab.filter.includes(dn);
			});
		};

		const parseRules = () => {
			const text = $html.config.mask.val();
			const regexp = /^\/(.*?)\/(\w*?)$/;

			const rules = text.split("\n").map(r => {
				const args = r.replace(/;[\t ]+/g, ";").split(";");
				const rule = {name: args[0]};
				const rcbs = (args[3] || "").split(",").filter(cb => !!callbacks[cb]);

				rule.search = args[0];
				rule.search.replace(regexp, (i, exp, p) => rule.search = new RegExp(exp, p));

				rule.replace = args[1];

				args[2] && (rule.condition = args[2]);
				args[3] && !!rcbs.length && (rule.callback = rcbs);
				args[4] && (rule.tabs = args[4].split(","));

				if (rule.replace && rule.search) return rule;
			}).filter(r => !!r);

			rules.length && (config.rules = rules);
			rules.length && (config.rulesCache = text);
			return !!rules.length;
		};

		const summarizeRules = () => {
			const tab = config.currentTab;
			const summary = defaultRules.filter(r => {
				const tabDns = currentDns(tab);
				return (!r.dns || !!(r.dns || []).filter(dn => tabDns.includes(dn)).length)
					&& (!r.tabs || r.tabs.includes(config.currentTab.name));
			}).reduce((text, r) => {
				return `${text}${r.name}\n`;
			}, "");
			if (config.defaults) {
				const tempRules = config.rulesCache || $html.config.mask.val();
				$html.config.mask.val("");
				$html.config.mask.attr("placeholder", summary || "no rules for current selection");
				tempRules && (config.rulesCache = tempRules);
			} else {
				$html.config.mask.val(config.rulesCache || "");
				$html.config.mask.attr("placeholder", "<search>;<replace>[;<condition>]\n<search>;<replace>[;<condition>]");
			}
		};

		const prepareRules = () => {
			const tab = config.currentTab;
			const activeRules = config.defaults
				? [...defaultRules]
				: config.rules || [];
			let passThrough = true;
			urls.rules = activeRules.filter((r, i) => {
				const tabDns = currentDns(tab);
				const activeDns = (r.dns || []).filter(dn => tabDns.includes(dn));

				if ((!passThrough && r.dns && Object.keys(tab.domains).length && !activeDns.length)
					|| (r.tabs && !r.tabs.includes(tab.name))) {
					passThrough = false;
					return false;
				}
				return true;
			});
		};

		const processUrl = (item) => {
			let processed = item.url;
			let migrated = false;
			let dn = item.dn;
			item.error = false;

			const applicable = (r) => {
				return (!r.condition
						|| processed.includes(r.condition))
					&& (migrated
						|| !r.dns?.length
						|| r.dns.includes(dn));
			}

			urls.rules.forEach((r, n) => {
				if (!applicable(r)) return;
				const changed = (() => {
					const initial = processed;
					return () => processed !== initial;
				})();
				processed = processed.replace(r.search, (str) => {
					r.replace.includes("$1")
						? (str = str.replace(r.search, r.replace))
						: (str = r.replace);
					r.callback && r.callback.forEach(p => {
						str = callbacks[p](str, item);
					});
					return str;
				});
				r.migrating
					&& changed()
					&& (dn = r20data.getDomainName(processed));
			});
			item.urlFix = processed !== item.url
				? processed
				: undefined;
		};

		const reProcessUrls = () => {
			const tab = config.currentTab;
			prepareRules();
			tab.models.forEach(t => {
				processUrl(t);
			});
		};

		const init = async () => {
			d20.Campaign.pages.models.find(p => !p.fullyLoaded)
				&& await r20data.loadAllPages();

			ui.initDialog();
			ui.initHtmls();

			["placed", "default", "multi", "avatar", "rules"]
				.forEach(t => delete urls[t]);

			Object.keys(config)
				.forEach(o => delete config[o]);

			config.addlag = true;
			config.defaults = true;
			config.previewsPerDomain = previews.normal;

			ui.initEvents();
		};

		return {
			parseRules,
			prepareRules,
			summarizeRules,
			processUrl,
			reProcessUrls,
			currentDns,
			init,
		};
	})();

	const r20data = (() => {
		const countDomains = (dn) => {
			const list = config.currentTab?.domains;
			list[dn] = list[dn] || {name: dn, count: 0};
			list[dn].count++;
		};

		const getDomainName = (url) => {
			const address = url.replace(/^https?:\/\/(www\.|)/, "");
			return address.split("/")[0];
		};

		const loadAllPages = async () => {
			const pages = d20.Campaign.pages.models;
			for (const p of pages) {
				!p.fullyLoaded && await p.fullyLoadPage();
			}
		}

		const indexPlaced = () => {
			return d20.Campaign
				.pages.models
				.map((p, i) => !p.attributes.archived
					&& (!config.singlepage || i === d20.Campaign.activePageIndex)
					&& (p.thegraphics?.models.filter(t => {
						return t.attributes.type === "image"
					}) || []))
				.flatten()
				.map(t => {
					const it = {
						id: t.id,
						url: t.attributes.imgsrc,
						model: t,
						name: t.attributes.name,
						dn: getDomainName(t.attributes.imgsrc),
						layer: t.attributes.layer,
						info: `on page ${t.collection.page.attributes.name}`,
					};
					config.currentTab._byId[t.id] = it;
					countDomains(it.dn);
					fixer.processUrl(it);
					return it;
				});
		};

		const indexDefault = () => {
			return d20.Campaign.characters.models.filter(c => {
				return c._blobcache.defaulttoken;
			}).map(c => {
				const t = JSON.parse(c._blobcache.defaulttoken);
				const it = {
					id: c.id,
					url: t.imgsrc,
					model: c,
					cache: t,
					name: t.name || c.attributes.name,
					dn: getDomainName(t.imgsrc),
					info: `default for ${c.attributes.name || c.attributes.charactersheetname}`,
				};
				config.currentTab._byId[c.id] = it;
				countDomains(it.dn);
				fixer.processUrl(it);
				return it;
			});
		};

		const indexMulti = () => {
			return d20.Campaign
				.pages.models
				.filter(p => !p.attributes.archived)
				.map(p => p.thegraphics?.models.filter(t => t.attributes.type === "image" && t.attributes.sides) || [])
				.flatten()
				.map(t => {
					const imgs = t.attributes.sides.split("|");
					return imgs.map((img, i) => {
						img = decodeURIComponent(img);
						const it = {
							index: i,
							id: `${t.id}#${i}`,
							url: img,
							model: t,
							collection: imgs,
							name: `${t.attributes.name}${i}`,
							dn: getDomainName(img),
							layer: t.attributes.layer,
							info: `on page ${t.collection.page.attributes.name}`,
						};
						config.currentTab._byId[it.id] = it;
						countDomains(it.dn);
						fixer.processUrl(it);
						return it;
					});
				}).concat(
					...d20.Campaign.characters.models.filter(c => {
						return c._blobcache?.defaulttoken?.includes(`"sides":`);
					}).map(c => {
						const t = JSON.parse(c._blobcache.defaulttoken);
						const imgs = t.sides.split("|");
						return imgs.map((img, i) => {
							img = decodeURIComponent(img);
							const it = {
								index: i,
								id: `${c.id}#${i}`,
								url: img,
								model: c,
								cache: t,
								collection: imgs,
								name: `${t.name}${i}`,
								dn: getDomainName(img),
								info: `default for ${c.attributes.name || "Unnamed character"}`,
							};
							config.currentTab._byId[it.id] = it;
							countDomains(it.dn);
							fixer.processUrl(it);
							return it;
						});
					}),
				).flatten();
		};

		const indexAvatar = () => {
			return d20.Campaign.characters.models.filter(c => {
				return c.attributes.avatar;
			}).map(c => {
				const it = {
					id: c.id,
					url: c.attributes.avatar,
					model: c,
					name: c.attributes.name,
					dn: getDomainName(c.attributes.avatar),
					info: `avatar for ${c.attributes.name || "Unnamed character"}`,
				};
				config.currentTab._byId[c.id] = it;
				countDomains(it.dn);
				fixer.processUrl(it);
				return it;
			});
		};

		const indexUrls = (name) => {
			urls[name] = {
				_byId: {},
				name,
				models: [],
				domains: {},
				filter: [...defaultFilter],
			};

			config.currentTab = urls[name];
			fixer.prepareRules(name);

			urls[name].models = {
				placed: indexPlaced,
				default: indexDefault,
				multi: indexMulti,
				avatar: indexAvatar,
			}[name]();
		};

		const reIndexUrls = async () => {
			const tab = config.currentTab;
			indexUrls(tab.name);
			ui.drawDomainsList();
			ui.drawPreviews();
		};

		const loadAllPlaced = () => {

		}

		const prepareMultisided = (stats) => {
			const tab = config.currentTab;
			const tokenModels = {};
			stats.images = 0;

			tab.models.forEach(i => {
				if (!i.urlFix) return;
				if (tab.filter.includes(i.dn)) return;

				tokenModels[i.model.id] = tokenModels[i.model.id] || {
					urlFix: false,
					id: i.model.id,
					collection: i.collection,
					model: i.model,
					cache: i.cache,
				};

				if (!i.error) {
					tokenModels[i.model.id].urlFix = true;
					tokenModels[i.model.id].collection[i.index] = i.urlFix;
					stats.images++;
				}
			});

			return Object.values(tokenModels);
		}

		const applyUpdateDefaultToken = (i) => {
			!i.collection && (i.cache.imgsrc = i.urlFix);
			i.collection && (i.cache.sides = i.collection.join("|"));

			i.blobcache = JSON.stringify(i.cache);
			i.model._blobcache.defaulttoken = i.blobcache;
			i.model.updateBlobs({defaulttoken: i.blobcache});
		}

		const applyUpdateUrl = async (i, stats) => {
			try {
				const tab = config.currentTab;
				switch (tab.name) {
					case "placed":
						i.model.save({imgsrc: i.urlFix});
						break;
					case "default":
						applyUpdateDefaultToken(i);
						break;
					case "multi":
						i.cache
							? applyUpdateDefaultToken(i)
							: i.model.save({sides: i.collection.join("|")});
						break;
					case "avatar":
						i.model.save({avatar: i.urlFix});
						break;
				}

				stats.count++;
				stats.unique[i.urlFix] = true;
				stats.$span.text(`Fixing ${stats.item} ${stats.count} of ${stats.total}`);
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
				stats.errors++;
			}
		}

		const applyUpdates = async () => {
			const tab = config.currentTab;
			const stats = {count: 0, unique: [], errors: 0, focus: 0};
			const skip = (d) => d && tab.filter.includes(d);

			const models = tab.name !== "multi"
				? tab.models.filter((i, k) => {
					return i.urlFix && !i.error && !skip(i.dn)
						&& ++stats.focus
						&& (!config.focusmode || stats.focus <= ui.getPreviewsPerSite());
				})
				: prepareMultisided(stats);

			stats.total = models.length;
			$html.statusBar.html(`<span>Fixing image 0 of ${stats.total}</span>`);
			stats.$span = $html.statusBar.find("span");
			stats.item = tab.name !== "multi" ? "image" : "token";

			d20.engine.unselect();
			$html.main.addClass("disabled");
			$html.buttons.apply.attr("disabled", true);

			for (const i of models) {
				if (!i.urlFix || i.error) continue;
				if (skip(i.dn)) continue;

				await applyUpdateUrl(i, stats);
				config.addlag && await new Promise(resolve => setTimeout(resolve, lag));
			}

			indexUrls(tab.name);
			ui.drawPreviews();
			ui.drawDomainsList();
			// fixer.summarizeRules();
			d20.engine.redrawScreenNextTick();

			stats.multiSummary = tab.name !== "multi" ? "" : ` (${stats.images} of ${stats.total} images)`;
			stats.singleSummary = tab.name === "multi" ? "" : ` of ${stats.total}`;
			stats.summary = `Fixed ${stats.count} ${stats.singleSummary} ${stats.item}s${stats.multiSummary}`;
			$html.main.removeClass("disabled");
			$html.buttons.apply.attr("disabled", false);
			$html.statusBar.html(`<span>${stats.summary}<br>Process finished with ${stats.errors} errors</span>`);
		};

		return {
			getDomainName,
			loadAllPages,
			applyUpdates,
			indexUrls,
			reIndexUrls,
		};
	})();

	const ui = (() => {
		const closeCancel = () => {
			$html.dialog.off(); $html.dialog.dialog("destroy").remove()
		};

		const closeCancelRoll20Editor = (char) => {
			d20.utils.summernoteDeInit(char.editview.$el);
			char.editview.$el.find(".attrib").trigger("doclose");
			char.editview.$el.find(".abil.editing").trigger("doclose");
			char.editview.$el.dialog("destroy");
		}

		const openRoll20CharacterEditor = (char) => {
			char.editview.showDialog().then(() => {
				const buttons = char.editview.$el
					.dialog("option", "buttons").map(b => {
						const hopeItsCancel = !b.class?.includes("save-button");
						hopeItsCancel && (b.click = () => closeCancelRoll20Editor(char));
						return b;
					});
				char.editview.$el.dialog({buttons});
				char.editview.$el.dialog("option", "beforeClose", () => void 0);
			});
		}

		const openRoll20Editor = (id) => {
			const item = config.currentTab._byId[id];
			item?.model.view.showDialog
				? openRoll20CharacterEditor(item?.model)
				: d20plus.menu.editToken(id.split("#")[0]);
		};

		const getPreviewsPerSite = () => {
			return config.singlesite && fixer.currentDns().length <= 1
				? (config.morepreviews ? previews.max : previews.single)
				: (config.morepreviews ? previews.extended : previews.normal);
		};

		const drawDomainsList = () => {
			const tab = config.currentTab;
			const domains = Object.entries(tab.domains)
				.map(([name, d]) => d);
			const html = domains.reduce((html, it) => {
				const name = it.name || "-roll20/";
				const exclude = (!config.focusmode && defaultFilter.includes(it.name))
					|| (config.focusmode && config.currentTab.filter.includes(it.name));
				const checked = exclude ? "" : "checked";
				return `${html}<li title="${name}">
					<label>
						<input type="checkbox" data-dn="${it.name}" ${checked}>
						<span>${name}</span>
					</label>
					(${it.count})
				</li>`;
			}, "")
			$html.lists[tab.name].html(html || "<li>Nothing found</li>");
		}

		const checkLoadedImages = (check) => {
			const images = $html.preview.thumbs.find("img");
			const loaded = !images.filter((i, img) => !img.complete).length;
			if (loaded) clearInterval(check);

			images
				.filter((i, img) => {
					if (!img.complete || !!img.naturalWidth) return false;
					$(img).data("urlid") && $html.preview.texts
						.find(`[data-urlid=${$(img).data("urlid")}]`)
						.css({"background-color": "rgba(200,100,100,.5)"});
					return true;
				})
				.parent().css({"background-color": "rgba(200,100,100,.5)"});
		}

		const drawPreviews = async () => {
			const tab = config.currentTab;
			const picked = {txt: "", thumb: ""};

			for (const dom in tab?.domains || {}) {
				if (tab.filter.includes(dom) && !config.singlepage) continue;
				let checked = {};

				const notDouble = (url) => checked[url] ? false : (checked[url] = true);
				const filter = (it) => it.dn === dom
					&& ((!config.focusmode && notDouble(it.url))
						|| (config.focusmode && it.urlFix)
						|| (config.singlepage));

				const links = tab.models.filter(l => filter(l));
				const pick = links.slice(0, getPreviewsPerSite());

				pick.forEach(u => {
					picked.txt += `<p${u.urlFix ? ` class="fixed"` : ""} data-id="${u.id}">
						<span data-urlid="${u.model.id}orig"${u.error ? ` style="background: rgba(200,100,100,.5)"` : ""}>${u.url}</span>
						${u.urlFix ? `<br><span data-urlid="${u.model.id}fix">${u.urlFix}</span>` : ""}
					</p>`;
					picked.thumb += `<div>
						<div data-id="${u.id}">
							<img data-urlid="${u.model.id}orig" src="${u.url}"${u.error ? ` style="background: rgba(200,100,100,.5)"` : ""}>
							${u.urlFix ? `<div><img data-urlid="${u.model.id}fix" src="${u.urlFix}"></div>` : ""}
						</div>
						<span>${u.name}</span>
					</div>`;
				});
			}

			$html.preview.texts.html(picked.txt);
			$html.preview.thumbs.html(picked.thumb);

			setInterval(checkLoadedImages, 50);
			statusUpdatePreviews();
		};

		const statusUpdateApply = () => {
			const tab = config.currentTab;
			const updated = tab.models.filter(t => t.urlFix && !t.error && !tab.filter.includes(t.dn));

			if (updated.length) $html.buttons.apply.attr("disabled", false);
			else $html.buttons.apply.attr("disabled", true);
			$html.statusBar.html(`<span>Fixes available for ${updated.length} images</span>`);
		};

		const statusUpdatePreviews = () => {
			const number = getPreviewsPerSite();
			const site = config.singlesite && fixer.currentDns().length <= 1 ? "selected" : "each";
			const image = config.focusmode ? " affected" : "";
			const text = config.singlepage
				? `Showing all images from current page`
				: `Showing first ${number}${image} for ${site} site`
			$html.preview.status.text(text);
		}

		const statusShowInfo = (() => {
			let cache = false;
			return (id) => {
				const img = config.currentTab._byId[id];
				if (!cache && img && img.error) {
					cache = $html.statusBar.html();
					$html.statusBar.html(`<span><a style="color: red;">The url can't be automatically fixed (${img.name || "Unnamed"})</a><br>${img.url}</span>`);
				} else if (!cache && img) {
					cache = $html.statusBar.html();
					$html.statusBar.html(`<span>${img.name || "Unnamed"} (${img.info})<br>${img.url}</span>`);
				} else if (cache) {
					$html.statusBar.html(cache);
					cache = false;
				}
			}
		})();

		const rulesEditingModeStop = () => {
			clearTimeout(config.editingMode);
			if (fixer.parseRules()) {
				config.editingMode = undefined;
				fixer.reProcessUrls();
				drawPreviews();
				$html.config.mask.blur();
				statusUpdateApply();
			}
		};

		const singlePageModeChanged = () => {
			indexUrls("placed");
			ui.drawPreviews();
			ui.drawDomainsList();
		}

		const switchTab = async (tab) => {
			if (!urls[tab]) r20data.indexUrls(tab);
			else config.currentTab = urls[tab];

			!config.previewTexts
				&& $html.preview.thumbs.css("display", "grid");

			$html.tabs.all.removeClass("current");
			$html.tabs[tab].addClass("current");

			drawDomainsList();
			drawPreviews();
			statusUpdateApply();
			fixer.summarizeRules();
		};

		const toggle = {
			dn: (tab, dn, state) => {
				urls[tab].filter.remove(dn);
				if (config.singlesite) {
					$html.lists[tab].find("input:checkbox").prop("checked", false);
					$html.lists[tab].find(`input[data-dn='${dn}']`).prop("checked", true);
					urls[tab].filter = Object.keys(urls[tab].domains).filter(d => d !== dn);
				} else {
					!state && urls[tab].filter.push(dn);
				}
				if (tab === config.currentTab.name) {
					drawPreviews();
					statusUpdateApply();
					fixer.summarizeRules();
				}
			},

			config: (setting, state) => {
				config[setting] = state;
				if (setting === "defaults") {
					$html.config.rules[state ? "addClass" : "removeClass"]("disabled");
					fixer.summarizeRules();
					fixer.reProcessUrls();
					drawPreviews();
					statusUpdateApply();
				} else if (["morepreviews", "focusmode"].includes(setting)) {
					drawPreviews();
				} else if (setting === "stickyconfig") {
					$html.config.menu.toggleClass("sticky", state);
				} else if (setting === "singlesite") {
					$html.tablist.toggleClass("singlesite", state);
					$html.tablist.toggleClass("singlepage", false);
					$html.config.singlepage.prop("checked", false);
					config.singlepage = false;
					drawPreviews();
					drawDomainsList();
					statusUpdateApply();
				} else if (setting === "singlepage") {
					$html.tablist.toggleClass("singlepage", state);
					$html.tablist.toggleClass("singlesite", false);
					$html.config.singlesite.prop("checked", false);
					config.singlesite = false;
					r20data.indexUrls("placed");
					drawDomainsList();
					drawPreviews();
					statusUpdateApply();
				}
			},

			previewMode: (mode, $btn) => {
				$html.btns.all.removeClass("current");
				$btn.addClass("current");
				$html.preview.texts.toggle(mode === "texts");
				$html.preview.thumbs.toggle(mode === "thumbs");

				config.previewTexts = mode === "texts";
				config.currentTab
					&& mode === "thumbs"
					&& $html.preview.thumbs.css("display", "grid");
			},

			rulesEditingMode: () => {
				$html.buttons.apply.attr("disabled", true);
				$html.statusBar.html(`<span>Finish editing the rules before continuing<br>Hit Esc or wait to apply the edits</span>`);
				clearTimeout(config.editingMode);
				config.editingMode = setTimeout(rulesEditingModeStop, 5000);
			},
		}

		const initDialog = () => {
			$html.dialog = $(dialogHtml);

			$html.dialog.dialog({
				autoopen: true,
				width: 700,
				height: 600,
				minWidth: 550,
				minHeight: 450,
				title: "Ultimate tokens & URLs fixer",
				buttons: {
					cancel: {
						text: "Cancel",
						class: "btn btn-cancel",
						click: closeCancel,
					},
					apply: {
						text: "Apply",
						class: "btn btn-primary",
						click: r20data.applyUpdates,
					},
				},
				open: () => {
					$html.dialog.css({height: "100%"});
					$html.dialog.parent().css({height: "600px"});
				},
				close: closeCancel,
			});
		};

		const initHtmls = () => {
			$html.preview = {};
			$html.tablist = $html.dialog.find(".b20-token-fixer-list");
			$html.main = $html.dialog.find(".b20-token-fixer");

			$html.tabs = {all: $html.dialog.find(".b20-token-fixer-list > ul > li")};
			$html.lists = {all: $html.dialog.find(".b20-token-fixer-list > ul > li > ul")};
			$html.btns = {all: $html.dialog.find(".b20-token-fixer-preview .btn")};
			$html.config = {all: $html.dialog.find(".b20-token-fixer-settings input:checkbox")};

			$html.tabs.placed = $html.dialog.find(".b20tf-placed").parent();
			$html.tabs.default = $html.dialog.find(".b20tf-default").parent();
			$html.tabs.multi = $html.dialog.find(".b20tf-multi").parent();
			$html.tabs.avatar = $html.dialog.find(".b20tf-avatar").parent();

			$html.lists.placed = $html.dialog.find(".b20tf-placed");
			$html.lists.default = $html.dialog.find(".b20tf-default");
			$html.lists.multi = $html.dialog.find(".b20tf-multi");
			$html.lists.avatar = $html.dialog.find(".b20tf-avatar");

			$html.preview.texts = $html.dialog.find(".b20tf-texts");
			$html.preview.thumbs = $html.dialog.find(".b20tf-thumbnails");
			$html.preview.status = $html.dialog.find(".b20tf-preview-status");

			$html.config.rules = $html.dialog.find(".b20tf-rules");
			$html.config.menu = $html.dialog.find(".b20-token-fixer-settings");
			$html.config.singlesite = $html.dialog.find("[value=singlesite]");
			$html.config.singlepage = $html.dialog.find("[value=singlepage]");
			$html.config.mask = $html.dialog.find(".b20tf-rules textarea");

			$html.statusBar = $(`<div class="b20-token-fixer-status"><span>No updates</span></div>`);
			$html.buttons = {pane: $html.dialog.parent().find(".ui-dialog-buttonpane")};

			$html.buttons.apply = $html.buttons.pane.find(".btn-primary");
			$html.buttons.cancel = $html.buttons.pane.find(".btn-cancel");

			$html.buttons.pane.prepend($html.statusBar);
			$html.buttons.pane.css({background: "rgba(100,100,100,.1)"})
		};

		const initEvents = () => {
			$html.dialog.on("click", ".b20tf-tab-selector", (evt) => {
				const tab = $(evt.currentTarget).data("tab");
				switchTab(tab);
			}).on("click", ".b20-token-fixer-list input:checkbox", (evt) => {
				const $click = $(evt.currentTarget);
				const tab = $click.closest("ul[data-tab]").data("tab");
				const dn = $click.data("dn");
				toggle.dn(tab, dn, $click.prop("checked"));
			}).on("click", ".b20-token-fixer-settings input:checkbox", (evt) => {
				const $click = $(evt.currentTarget);
				const setting = $click.prop("value");
				toggle.config(setting, $click.prop("checked"));
			}).on("click", ".b20-token-fixer-preview .btn", (evt) => {
				const $click = $(evt.currentTarget);
				const mode = $click.data("mode");
				toggle.previewMode(mode, $click);
			}).on("click", ".b20tf-thumbnails [data-id]", (evt) => {
				const id = $(evt.currentTarget).data("id");
				openRoll20Editor(id);
			}).on("click", ".b20tf-refresh", (evt) => {
				config.currentTab && r20data.reIndexUrls();
			}).on("mouseover", ".b20tf-thumbnails [data-id], .b20tf-texts [data-id]", (evt) => {
				statusShowInfo($(evt.currentTarget).data("id"));
			}).on("mouseout", ".b20tf-thumbnails [data-id], .b20tf-texts [data-id]", (evt) => {
				statusShowInfo();
			}).on("mouseover", ".b20tf-texts p span", evt => {
				const $text = $(evt.target);
				const max = $html.preview.texts.innerWidth();
				const fact = $text.width();
				fact > max && $text.css({display: "inline-block", left: max - fact});
			}).on("mouseout", ".b20tf-texts p span", evt => {
				const $text = $(evt.target);
				$text.css("left", "");
				setTimeout(() => !$text.attr("style")?.includes("left") && $text.css("display", ""), 4000);
			}).on("keydown", ".b20tf-rules textarea", evt => {
				if (evt.keyCode === 9) {
					const el = evt.currentTarget;
					el.setRangeText("\t", el.selectionStart, el.selectionStart, "end");
					evt.preventDefault();
				} else if (evt.keyCode === 27) {
					evt.preventDefault();
					config.editingMode && rulesEditingModeStop();
					return;
				}
				toggle.rulesEditingMode();
			}).on("blur", ".b20tf-rules textarea", evt => {
				config.editingMode && rulesEditingModeStop();
			});
		};

		const dialogTexts = {
			welcome: {
				header: "Welcome to the Tokens and image URLs fixer!",
				subtext: "This tool is designed to automatically solve most known issues with non-roll20 hosted images. With built-in set of URL transformations, using it is as simple as:",
				tldr: `<strong>TL;DR usage in 3 steps</strong><br>
					<span>1.</span> Select a category on the left by clicking its name<br>
					<span>2.</span> Browse the previews for broken and fixable images or text URLs<br>
					<span>3.</span> If the previews seem OK (you can see the images), hit Apply.<br>
					<span></span> Repeat for other categories if neccessary<br>`,
				manual: [
					"The categories on the left represent different types of images stored in roll20: tokens that appear on the maps, avatars that appear in journal, multisided token images, default tokens",
					"Each of these categories needs to be processed independently. Ultimately, you need to check each of them for broken images, and try to fix them",
					"Since urls usually break because of the server shutdowns or reorganizations, the images are grouped by domain names. The preview that will appear here will show examples of the few items for each domain linked in your images",
					"The previews may be displayed as texts or thumbnails (the toggle is at the top right), and represent both the original image, and the result of applying the current set of rules, if any. The broken images, both initial and replaced, are indicated with red background. So the DESIRED effect on previews is green overlay with a picture over a red-overlayed broken image icon.",
					"Check these previews to get the idea of what is broken, and what may be fixed. Click them to open the respective token or character settings. The status bar in the bottom will show the number of images with any replacement, no matter if it results in actually fixing the link or not",
					"There are built-in default rules for common known issues. You may also manually enter any replacement rules you can imagine, even using regular expressions! If you need help, ask in 5etools Discord",
					"Double check everything, and once you are sure the current settings are working, hit Apply!",
				],
			},
			help: {
				sources: "The list of categories. When you select a category, a list of web domains will be displayed. The domains selection affect both the previews and the actual execution of replacement when you hit Apply",
				preview: "The url previews of the images with the current view and replacement settings. Buttons on the right allow switching between text and images",
				config: "Check the previews and alter the settings here if neccessary. If you are satisfied with the estimated result, press Apply.",
				rules: "Custom rule format: <br><a style='font-weight:100;font-family:monospace'>search; replace[; filter[; callback]]</a><br>The <a>search</a> clause supports /regexp/. Each rule starts on new line. Tabs and spaces after the ';' are ignored. Available callbacks are <a style='font-weight:100;font-family:monospace'>encodeURI, encodeURIComponent, decodeURIComponent, getCurrentName, unfixableAskUser</a>",
			},
			controls: {
				defaults: "Default set of url replacement rules should automatically fix all known issues",
				extend: `Show ${previews.extended} image preiews for each site instead of ${previews.normal} by default. For single site mode even more previews are shown (up to ${previews.max})`,
				focus: "Only preiview items with changed URLs, and only apply fixes to items visible in previews. Allows for step by step fixing large quantities of images, checking each chunk of images before applying",
				delay: "Add a small delay between saving to roll20 DB to ensure safe operation. It is generally advised to keep this ON, however, it may drastically slow the process on large (>100) quantities",
				singlesite: "Only one domain selected when you click on them",
				singlepage: "Disables singlesite and focus modes, and operates exclusively on tokens from current page, including showing all previews for all the tokens on that page (for placed tokens)",
				nomaps: "Exclude tokens on map layer (for placed tokens) NOT WORKING/WIP",
				stickyconfig: "Check this to prevent automatic collapsing of this config checkboxes block",
			},
		};

		const dialogCss = `
			.b20-token-fixer {display:flex; height:100%}
			.b20-token-fixer.disabled {pointer-events: none; filter: opacity(0.7);}
			.b20-token-fixer-list {width:200px; height:100%; border-right:1px solid; overflow:auto;box-sizing: border-box;}
			.b20-token-fixer-manager {width:calc(100% - 200px); height:100%; padding-left:10px;box-sizing: border-box;overflow: clip;}
			.b20-token-fixer-preview {width:100%; height:calc(100% - ${cssHeight.configBlock + 2}px); border-bottom:1px solid;box-sizing: border-box;transition: height 1s;}
			.b20-token-fixer-settings {width:100%; height:160px;overflow: clip;transition: height 1s;}

			.b20-token-fixer-list ul {margin: 0px; list-style:none;}
			.b20-token-fixer-list > ul > li {margin-top:10px;}
			.b20-token-fixer-list > ul > li > span {display:block; width:100%; padding:5px 0px; cursor:pointer; box-sizing:border-box;}
			.b20-token-fixer-list > ul > li > span:hover {background-color:rgba(150,150,150,0.5); padding-left:2px;}
			.b20-token-fixer-list > ul > li li {padding: 2px 0px; font-size:12px}
			.b20-token-fixer-list > ul > li li:hover {background-color:rgba(150,150,150,0.5);}

			.b20-token-fixer-list li > label {display: inline-block}
			.b20-token-fixer-list li label input {width:12px;}
			.b20-token-fixer-list li:not(.current) li label input{opacity:.5;filter:grayscale(1)}
			.b20-token-fixer-list li > label > span {display:inline-block; width:125px; overflow:clip; text-overflow:ellipsis; white-space:nowrap;}

			.b20-token-fixer-list > ul > li.current {border-left:1px solid;}
			.b20-token-fixer-list > ul > li.current > span {padding-left:5px; font-weight:700;}
			.b20-token-fixer-list > ul > li.current li {padding-left:5px;}
			.b20-token-fixer-list.singlesite input[type="checkbox"]:not(:checked) {visibility: hidden;}
			.b20-token-fixer-list.singlepage input[type="checkbox"] {visibility:hidden}
			.b20-token-fixer-list.singlepage label {pointer-events:none}

			html.dark .b20-token-fixer-list > ul > li.current > span {color:var(--grayscale-dark-base);}
			html:not(.dark) .b20-token-fixer-list > ul > li.current > span {color:#333;}

			.b20-token-fixer button.b20tf-refresh {font-size:15px;top:0px;right:5px}
			.b20-token-fixer button {float:right;padding:3px;font-size:12px;position:relative;top:-15px;margin:0 0px -10px 5px;line-height:12px;}
			.b20-token-fixer button:not(.current):not(:hover) {background-color:rgba(120,120,120,.5);color:unset}

			.b20tf-thumbnails {display:grid;grid-template-columns:repeat(auto-fill,100px);grid-auto-rows: min-content;justify-content:space-between;width:100%;height:calc(100% - 40px);overflow:auto}
			.b20tf-thumbnails>div {width:100px;margin:10px 0}
			.b20tf-thumbnails>div>div {width:100px;height:100px;background-color:rgba(100,100,100,.2);text-align:center;line-height:100px;overflow:clip;}
			.b20tf-thumbnails>div>div>img{max-width:100px;max-height:100px}
			.b20tf-thumbnails>div>div>div {width:100px;height:100px;position:relative;top:-90px;background-color:rgba(150,200,150,.5);border-top:1px solid;border-radius:10px 10px;transition:top .5s;overflow:clip;}
			.b20tf-thumbnails>div:hover>div>div {top:-20px}
			.b20tf-thumbnails [data-id] { cursor: pointer;}
			.b20tf-thumbnails > p > span {display:inline-block;width:1em}
			.b20tf-thumbnails span {font-size:12px;white-space:nowrap;overflow:clip;text-overflow:ellipsis;width:100%;display:inline-block}

			.b20tf-texts {width:100%;height:calc(100% - 40px);overflow-y:auto;white-space:nowrap;cursor:text;user-select:text;overflow-x:clip}
			.b20tf-texts p {background-color:rgba(100,100,100,.2); max-width:100%; overflow:clip; text-overflow:ellipsis;user-select: text;}
			.b20tf-texts p.fixed { background-color: rgba(150,200,150,.2); }
			.b20tf-texts p span {position:relative;left:0;transition:left 5s;}

			.b20tf-checkboxes {height:0;padding:0;box-sizing:border-box;transition:height 1s,padding 1s;overflow:clip}
			.b20tf-checkboxes >div {width:calc(50% - 2px);display:inline-block;vertical-align:text-top;overflow:hidden;white-space:nowrap}
			.b20tf-checkboxes >div>p {width:100%}
			.b20-token-fixer-settings textarea {width: 100%; height: 50px; box-sizing: border-box; resize: vertical;white-space: pre;font-family: monospace;transition: height 1s}
			.b20-token-fixer-settings:hover textarea, .b20-token-fixer-settings.sticky textarea {height: ${50 + cssHeight.textareaGrowth}px}

			.b20-token-fixer-settings:hover .b20tf-checkboxes, .b20-token-fixer-settings.sticky .b20tf-checkboxes {height:${cssHeight.checkboxes - 1}px;padding:5px 0}
			.b20-token-fixer-settings:hover, .b20-token-fixer-settings.sticky {height:${cssHeight.configBlock + cssHeight.checkboxes + cssHeight.textareaGrowth + 5}px}
			.b20-token-fixer-preview:has(+div:hover), .b20-token-fixer-preview:has(+div.sticky) {height:calc(100% - ${cssHeight.configBlock + cssHeight.checkboxes + cssHeight.textareaGrowth + 1}px)}

			.b20tf-preview-status {font-size:10px;float:right;font-weight:100;margin-right:106px;opacity:.7;box-sizing:border-box}
			.b20-token-fixer-status {width:calc(100% - 135px);float:left;line-height:40px;opacity:.8;overflow:clip;text-overflow:ellipsis;white-space:nowrap;padding-left:5px}
			.b20-token-fixer-status>span {display:inline-block;line-height:normal;vertical-align:middle}
			.btn.btn-primary[disabled] {pointer-events:none;filter:grayscale(1)}

			.b20tf-rules span{text-align:right;display:block;margin-top:5px}
			.b20tf-rules.disabled {pointer-events:none; filter:grayscale(1) contrast(0.8) brightness(0.8)}
			html.dark .b20-token-fixer input[type=checkbox] {accent-color:var(--primary-dark);}

			.b20-token-fixer ::-webkit-scrollbar{width:4px;height: 4px;}
			.b20-token-fixer ::-webkit-scrollbar-track{background:none}
			.b20-token-fixer ::-webkit-scrollbar-thumb{background:rgba(100,100,100,.3);border-radius:3px}
			.b20-token-fixer ::-webkit-scrollbar-thumb:hover{background:rgba(100,100,100,.7)}
		`;

		const dialogHtml = `
		<div style="height:100%"><div class="b20-token-fixer">
			<div class="b20-token-fixer-list">
				<h4>Sources
					<a class="tipsy-s showtip pictos" title="${dialogTexts.help.sources}">?</a>
					<button class="btn b20tf-refresh tipsy-s showtip" title="Refresh all data for current category (e.g. if you manually edited a token)">↻</button>
				</h4>
				<ul>
					<li>
						<span class="b20tf-tab-selector" data-tab="placed">Placed tokens</span>
						<ul class="b20tf-placed" data-tab="placed"><li>select to fetch & preview...</li></ul>
					</li>
					<li>
						<span class="b20tf-tab-selector" data-tab="default">Default tokens</span>
						<ul class="b20tf-default" data-tab="default"><li>select to fetch & preview...</li></ul>
					</li>
					<li>
						<span class="b20tf-tab-selector" data-tab="multi">Token sides</span>
						<ul class="b20tf-multi" data-tab="multi"><li>select to fetch & preview...</li></ul>
					</li>
					<li>
						<span class="b20tf-tab-selector" data-tab="avatar">Journal avatars</span>
						<ul class="b20tf-avatar" data-tab="avatar"><li>select to fetch & preview...</li></ul>
					</li>
				</ul>
			</div>
			<div class="b20-token-fixer-manager">
				<div class="b20-token-fixer-preview">
					<h4>
						Preview
						<a class="tipsy-s showtip pictos" title="${dialogTexts.help.preview}">?</a>
						<span class="b20tf-preview-status">Select category to preview</span>
					</h4>
					<button class="btn current" data-mode="thumbs">Thumbnails</button>
					<button class="btn" data-mode="texts">Text</button>
					<div class="b20tf-thumbnails" style="display:block">
						<img style="width:100px; float: right" src="https://images.fallout.wiki/3/39/FoS_Mister_Handy.png"><p>${dialogTexts.welcome.header}</p>
						<p>${dialogTexts.welcome.subtext}</p>
						<p>${dialogTexts.welcome.tldr}</p>
						${dialogTexts.welcome.manual.reduce((t, p) => `${t}<p>${p}</p>`, "")}
					</div>
					<div class="b20tf-texts" style="display:none"></div>
				</div>
				<div class="b20-token-fixer-settings">
					<div style="width: 100%;height: 0px;overflow: visible;text-align: center;box-sizing: border-box;">▼</div>
					<h4 style="padding:10px 0px">Configuration <a class="tipsy-w showtip pictos" title="${dialogTexts.help.config}">?</a></h4>
					<div class="b20tf-checkboxes">
						<div>
							<p><label class="tipsy-e showtip" title="${dialogTexts.controls.extend}"><input type="checkbox" value="morepreviews"> <span>More previews per site</span></label></p>
							<p><label class="tipsy-e showtip" title="${dialogTexts.controls.focus}"><input type="checkbox" value="focusmode"> <span>Focus mode</span></label></p>
							<p><label class="tipsy-e showtip" title="${dialogTexts.controls.delay}"><input type="checkbox" value="addlag" checked> <span>Delay between applying fixes</span></label></p>
						</div>
						<div>
							<p><label class="tipsy-s showtip" title="${dialogTexts.controls.singlesite}"><input type="checkbox" value="singlesite"> <span>Single domain mode</span></label></p>
							<p><label class="tipsy-n showtip" title="${dialogTexts.controls.singlepage}"><input type="checkbox" value="singlepage"> <span>Single page mode</span></label></p>
							<p><label class="tipsy-n showtip" title="${dialogTexts.controls.nomaps}"><input type="checkbox" value="excludemaps"> <span>Exclude map layer</span></label></p>
							<p><label class="tipsy-n showtip" title="${dialogTexts.controls.stickyconfig}"><input type="checkbox" value="stickyconfig"> <span>Sticky config</span></label></p>
						</div>
					</div>
					<label style="float:left" class="tipsy-e showtip" title="${dialogTexts.controls.defaults}">
						<input type="checkbox" checked value="defaults">
						<span>Use the built-in set of rules</span>
					</label>
					<label class="b20tf-rules disabled">
						<span>Replacement rules <a class="tipsy-n-right showtip pictos" title="${dialogTexts.help.rules}">?</a></span>
						<textarea placeholder=""></textarea>
					</label>
				</div>
			</div>
			<style>${dialogCss}</style>
		</div></div>
		`;

		return {
			initDialog,
			initHtmls,
			initEvents,
			getPreviewsPerSite,
			drawDomainsList,
			drawPreviews,
		};
	})();

	d20plus.tool.tools.push({
		toolId: "URLFIX",
		name: "Token & avatar URL fixer",
		desc: "Fix & restore broken image URLs en masse",
		html: ``,
		dialogFn: () => {},
		openFn: () => {
			fixer.init();
		},
	});
}

SCRIPT_EXTENSIONS.push(baseToolUrlFix);