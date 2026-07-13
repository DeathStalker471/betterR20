function baseToolUnlock () {
	d20plus.tool.tools.push({
		toolId: "UNLOCKER",
		name: "Token Unlocker",
		desc: "Unlock previously-locked tokens",
		html: `
			<div id="d20plus-token-unlocker" title="Better20 - Token Unlocker">
				<p>
					<button class="btn" name="btn-refresh">Refresh</button>
				</p>
				<p class="split">
					<label><input type="checkbox" title="Select all" name="cb-all"> Select All</label> 
					<button class="btn" name="btn-unlock">Unlock Selected</button>
				</p>
				<div id="token-unlocker-list-container">
					<input class="search" autocomplete="off" placeholder="Search list..." style="width: 100%;">
					<br><br>
					<ul class="list unlock-list" style="max-height: 420px; overflow-y: scroll; display: block; margin: 0;"></ul>
				</div>
			</div>
		`,
		dialogFn: () => {
			const $win = $("#d20plus-token-unlocker").dialog({
				autoOpen: false,
				resizable: true,
				width: 800,
				height: 600,
			}).data("VE_HANDLE_UPDATE", () => {
				d20.engine.canvas._objects.forEach(ob => {
					if (ob.model) {
						const locked = ob.model.get("VeLocked");
						if (locked) {
							ob.lockMovementX = true;
							ob.lockMovementY = true;
							ob.lockScalingX = true;
							ob.lockScalingY = true;
							ob.lockRotation = true;
							ob.saveState();
						}
					}
				});
			});

			document.addEventListener("VePageChange", () => {
				$win.data("VE_HANDLE_UPDATE")();
			});

			document.addEventListener("VeLayerChange", () => {
				$win.data("VE_HANDLE_UPDATE")();
			});

			try {
				$win.data("VE_HANDLE_UPDATE")();
			} catch (e) {
				d20plus.ut.error("Failed to re-lock tokens!")
			}
		},
		openFn: () => {
			const $win = $("#d20plus-token-unlocker");
			$win.dialog("open");
			const $wrpCbs = $(`#token-unlocker-list-container`).find(`.unlock-list`);
			const $cbAll = $win.find(`[name="cb-all"]`);
			const $btnUnlock = $win.find(`[name="btn-unlock"]`);
			const $btnRefresh = $win.find(`[name="btn-refresh"]`).click(() => populateList());

			function populateList () {
				const objects = d20.engine.canvas._objects.filter(it => it.model && it.model.get("VeLocked"));
				$wrpCbs.empty();

				objects.forEach(it => {
					$wrpCbs.append(`
						<label class="import-cb-label" data-listid="${it.model.get("id")}">
							<input type="checkbox">
							<span class="name readable">${it.model.get("name") || `Unnamed${it.type ? ` ${it.type}` : ""}`}</span>
						</label>
					`);
				});

				// init list library
				const unlockList = new List("token-unlocker-list-container", {
					valueNames: ["name"],
					listClass: "unlock-list",
				});

				$cbAll.prop("checked", false);
				$cbAll.off("click").click(() => d20plus.importer._importToggleSelectAll(unlockList, $cbAll));

				$btnUnlock.off("click").on("click", () => {
					const sel = unlockList.items
						.filter(it => $(it.elm).find(`input`).prop("checked"))
						.map(it => $(it.elm).attr("data-listid"));

					if (!sel.length) {
						alert("No items selected!");
					} else {
						const currObjects = d20.engine.canvas._objects.filter(it => it.model);
						let counter = 0;
						sel.forEach(toUnlock => {
							const ob = currObjects.find(it => it.model && it.model.get("id") === toUnlock);
							if (ob) {
								counter++;
								ob.lockMovementX = false;
								ob.lockMovementY = false;
								ob.lockScalingX = false;
								ob.lockScalingY = false;
								ob.lockRotation = false;
								ob.saveState();

								ob.model.set("VeLocked", false);
								ob.model.save();
							}
						});
						alert(`${counter} item${counter === 1 ? "" : "s"} unlocked.`);
						populateList();
					}
				});
			}

			populateList();
		},
	})
}

SCRIPT_EXTENSIONS.push(baseToolUnlock);
