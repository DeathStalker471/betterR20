function baseJsLoad () {
	d20plus.js = {};

	d20plus.js.scripts = [
		// {name: "listjs", url: "https://raw.githubusercontent.com/javve/list.js/v1.5.0/dist/list.min.js"},
		// {name: "localforage", url: "https://raw.githubusercontent.com/localForage/localForage/1.7.3/dist/localforage.min.js"},
		// {name: "JSZip", url: `https://raw.githubusercontent.com/Stuk/jszip/master/dist/jszip.min.js`},
	];

	if (d20plus.ut.isUseSharedJs()) {
		// d20plus.js.scripts.push({name: "5etoolsShared", url: `${SITE_JS_URL}shared.js`});
	} else {
		// d20plus.js.scripts.push({name: "5etoolsParser", url: `${SITE_JS_URL}parser.js`});
		// d20plus.js.scripts.push({name: "5etoolsUtils", url: `${SITE_JS_URL}utils.js`});
	}

	d20plus.js.apiScripts = [
		// {name: "VecMath", url: "https://raw.githubusercontent.com/Roll20/roll20-api-scripts/master/Vector%20Math/1.0/VecMath.js"},
		// {name: "MatrixMath", url: "https://raw.githubusercontent.com/Roll20/roll20-api-scripts/master/MatrixMath/1.0/matrixMath.js"},
		// {name: "PathMath", url: "https://raw.githubusercontent.com/Roll20/roll20-api-scripts/master/PathMath/1.5/PathMath.js"}
	];

	d20plus.js._unpackScript = script => {
		return script.trim().split("\n").slice(1, -1).join("\n");
	};

	d20plus.js.pAddScripts = async () => {
		d20plus.ut.log("Add JS");

		EXT_LIB_SCRIPTS.forEach(script => {
			d20plus.js._addScript("???", d20plus.js._unpackScript(script));
		});

		await Promise.all(d20plus.js.scripts.map(async it => {
			const js = await d20plus.js.pLoadWithRetries(it.name, it.url);
			d20plus.js._addScript(it.name, js)
		}));

		// Monkey patch JSON loading
		const cached = DataUtil.loadJSON;
		DataUtil.loadJSON = async (url, ...others) => {
			const xUrl = new URL(url);

			const cleanPathName = xUrl.pathname.replace(/^\//, "");
			// If d20plus.debug.forceExternalRequests is set to true as a parameter, load from chosen url rather than built in data
			if (!d20plus.debug?.forceExternalRequests && JSON_DATA[cleanPathName]) {
				const out = JSON_DATA[cleanPathName];
				await DataUtil.pDoMetaMerge(cleanPathName, out);
				return out;
			}

			if (url.startsWith("data/")) {
				url = BASE_SITE_URL + url;
			}

			return cached.bind(DataUtil)(url, ...others);
		};
	};

	d20plus.js.pAddApiScripts = async () => {
		d20plus.ut.log("Add Builtin API Scripts");

		EXT_LIB_API_SCRIPTS.forEach(script => {
			d20plus.js._addScript("???", d20plus.js._unpackScript(script));
		});

		await Promise.all(d20plus.js.apiScripts.map(async it => {
			const js = await d20plus.js.pLoadWithRetries(it.name, it.url);
			d20plus.js._addScript(it.name, js);
		}));
	};

	d20plus.js._addScript = (name, js) => {
		// sanity check
		if (js instanceof Promise) throw new Error(`Promise was passed instead of text! This is a bug.`);
		try {
			// eslint-disable-next-line no-eval
			window.eval(js);
			d20plus.ut.log(`JS [${name}] Loaded`);
		} catch (e) {
			d20plus.ut.log(`Error loading [${name}]`);
			d20plus.ut.log(e);
			throw e;
		}
	};

	d20plus.js.pLoadWithRetries = async (name, url) => {
		let retries = 3;

		function pFetchData () {
			return new Promise((resolve, reject) => {
				$.ajax({
					type: "GET",
					url: `${url}${d20plus.ut.getAntiCacheSuffix()}${retries}`,
					success: function (data) {
						resolve(data);
					},
					error: function (resp, qq, pp) {
						if (resp && resp.status >= 400 && retries-- > 0) {
							// eslint-disable-next-line no-console
							console.error(resp, qq, pp);
							d20plus.ut.log(`Error loading ${name}; retrying`);
							setTimeout(() => {
								reject(new Error(`Loading "${name}" failed (status ${resp.status}): ${resp} ${qq} ${pp}`));
							}, 500);
						} else {
							// eslint-disable-next-line no-console
							console.error(resp, qq, pp);
							setTimeout(() => {
								reject(new Error(`Loading "${name}" failed (status ${resp.status}): ${resp} ${qq} ${pp}`));
							}, 500);
						}
					},
				});
			})
		}

		let data;
		do {
			try {
				data = await pFetchData();
			} catch (e) {
				// error handling is done as part of data fetching
			}
		} while (!data && --retries > 0);

		if (data) return data;
		else throw new Error(`Failed to load ${name} from URL ${url}`);
	};

	d20plus.js.pLoadJsonWithRetries = async (name, url) => {
		let retries = 3;

		let out;
		let lastErr = null;
		while (retries-- > 0) {
			try {
				out = await DataUtil.loadJSON(`${url}${d20plus.ut.getAntiCacheSuffix()}${retries}`);
			} catch (e) {
				lastErr = e;
			}

			if (lastErr && retries) {
				d20plus.ut.log(`Error loading ${name}; retrying after 100ms`);
				await MiscUtil.pDelay(100);
			}
		}

		if (!retries) {
			d20plus.ut.error(`Failed to load "${name}" (URL was: ${url} )`);
			throw lastErr;
		}

		return out;
	};
}

SCRIPT_EXTENSIONS.push(baseJsLoad);
