function baseCss () {
	d20plus.css = {};

	// Convert to regular CSS:
	// `[ ... rules ... ].map(it => `${it.s} {\n${it.r.split(";").map(str => str.trim()).join(";\n")}}\n`).join("\n")`
	d20plus.css.baseCssRules = [
		// generic
		{
			s: ".inline-block, .display-inline-block",
			r: "display: inline-block;",
		},
		{
			s: ".bold",
			r: "font-weight: bold;",
		},
		{
			s: ".italic",
			r: "font-style: italic;",
		},
		{
			s: ".clickable",
			r: "cursor: pointer;",
		},
		{
			s: ".split",
			r: "display: flex; justify-content: space-between;",
		},
		{
			s: ".relative",
			r: "position: relative !important;",
		},
		{
			s: ".flex",
			r: "display: flex;",
		},
		{
			s: ".flex-col",
			r: "display: flex; flex-direction: column;",
		},
		{
			s: ".flex-v-center",
			r: "display: flex; align-items: center;",
		},
		{
			s: ".flex-vh-center",
			r: "display: flex; justify-content: center; align-items: center;",
		},
		{
			s: ".no-shrink",
			r: "flex-shrink: 0;",
		},
		{
			s: ".flex-1",
			r: "flex: 1",
		},
		{
			s: ".full-width",
			r: "width: 100%;",
		},
		{
			s: ".full-height",
			r: "height: 100%;",
		},
		{
			s: ".text-center",
			r: "text-align: center;",
		},
		{
			s: ".text-right",
			r: "text-align: right;",
		},
		{
			s: ".is-error",
			r: "color: #d60000;",
		},
		{
			s: ".flex-label",
			r: "display: inline-flex; align-items: center;",
		},
		{
			s: ".sel-xs",
			r: `
				height: 18px;
				line-height: 18px;
				margin: 0;
				padding: 0;
			`,
		},
		{
			s: ".btn-xs",
			r: `
				height: 18px;
				line-height: 18px;
				margin: 0;
				padding: 0 4px;
			`,
		},
		// // fix Roll20's <p> margins in the text editor // FIXME make this configurable
		// {
		// 	s: ".note-editable p",
		// 	r: "margin-bottom: 0;"
		// },
		// ensure rightclick menu width doesn't break layout // FIXME might be fixing the symptoms and not the cause
		{
			s: ".actions_menu.d20contextmenu > ul > li",
			r: "max-width: 100px;",
		},
		// search
		{
			s: ".Vetoolsresult",
			r: "background: #ff8080;",
		},
		// config editor
		{
			s: "div.config-table-wrapper",
			r: "min-height: 200px; width: 100%; height: 100%; max-height: 460px; overflow-y: auto; transform: translateZ(0);",
		},
		{
			s: "table.config-table",
			r: "width: 100%; table-layout: fixed;",
		},
		{
			s: "table.config-table tbody tr:nth-child(odd)",
			r: "background-color: #f8f8f8;",
		},
		{
			s: "table.config-table tbody td > *",
			r: "vertical-align: middle; margin: 0;",
		},
		{
			s: ".config-name",
			r: "display: inline-block; line-height: 35px; width: 100%;",
		},
		// tool list
		{
			s: ".tools-list",
			r: "max-height: 70vh;",
		},
		{
			s: ".tool-row",
			r: "min-height: 40px; display: flex; flex-direction: row; align-items: center;",
		},
		{
			s: ".tool-row:nth-child(odd)",
			r: "background-color: #f0f0f0;",
		},
		{
			s: ".tool-row > *",
			r: "flex-shrink: 0;",
		},
		// warning overlay
		{
			s: ".temp-warning",
			r: "position: fixed; top: 12px; left: calc(50vw - 200px); z-index: 10000; width: 320px; background: transparent; color: red; font-weight: bold; font-size: 150%; font-variant: small-caps; border: 1px solid red; padding: 4px; text-align: center; border-radius: 4px;",
		},
		// GM hover text
		{
			s: ".Vetools-token-hover",
			r: "pointer-events: none; position: fixed; z-index: 100000; background: white; padding: 5px 5px 0 5px; border-radius: 5px; border: 1px solid #ccc; max-width: 450px;",
		},
		// drawing tools bar
		{
			s: "#drawingtools.line_splitter .currentselection:after",
			r: "content: '✂️';",
		},
		// "old style" system messages
		{
			s: ".userscript-hacker-chat, .hacker-chat",
			r: "margin-left: -45px; margin-right: -5px; margin-bottom: -7px; margin-top: -15px; display: inline-block; font-weight: bold; font-family: 'Lucida Console', Monaco, monospace; color: #20C20E; background: black; padding: 3px; min-width: calc(100% + 60px);box-sizing: border-box;",
		},
		{
			s: ".userscript-hacker-chat a",
			r: "color: white;",
		},
		{
			s: ".userscript-hacker-chat-error",
			r: "margin-left: -45px; margin-right: -5px; margin-bottom: -7px; margin-top: -15px; display: inline-block; font-weight: bold; font-family: 'Lucida Console', Monaco, monospace; color: #FF69B4; background: black; padding: 3px; min-width: calc(100% + 60px);",
		},
		{
			s: ".userscript-hacker-chat-error a",
			r: "color: white;",
		},
		// "old style" chat tag
		{
			s: ".userscript-hackerintro",
			r: "background: black; padding: 3px;",
		},
		{
			s: ".userscript-hackerintro h1",
			r: "font-family: \"Lucida Console\", Monaco, monospace; color: rgb(32, 194, 14); font-size: 18px;",
		},
		{
			s: ".userscript-hackerintro p",
			r: "font-family: \"Lucida Console\", Monaco, monospace; color: rgb(32, 194, 14); font-size: unset; font-weight: bold; line-height: 20px;",
		},
		// vttes-style chat tag
		{
			s: ".userscript-b20intro img.userscript-b20img",
			r: "content: url('https://wiki.tercept.net/core-wiki-assets/5etoolslogocircle.png') !important",
		},
		{
			s: ".userscript-b20intro",
			r: "box-shadow: 0px 0px 10px rgb( 6 , 26 , 45 ); padding: 8px;background: rgb(6, 26, 45);color: whitesmoke;",
		},
		{
			s: ".userscript-b20intro strong",
			r: "color: orange;",
		},
		{
			s: ".userscript-b20intro h1",
			r: "color: whitesmoke;",
		},
		{
			s: "code",
			r: "padding: 1px 2px;color: rgb(73, 45, 32);background-color: #fff4e8;border: 1px solid;",
		},
		// "player connects/disconnects" messages
		{
			s: ".connects-log",
			r: "display: none; font-variant: small-caps; font-size: 12px; padding: 18px 2px 2px 32px; margin-left: -8px; border: 1px solid; border-top: none; margin-top: -16px; background: rgba(100, 100, 100, 0.2); cursor: pointer;",
		},
		{
			s: ".connects-info, .msg-action-button",
			r: "font-family: pictos; margin-right: 4px; text-decoration: none !important; cursor: pointer; float: right; position: relative; top: -16px;",
		},
		{
			s: ".msg-action-button",
			r: "top: 0px;",
		},
		{
			s: "input:checked + label .connects-info",
			r: "position: unset;",
		},
		{
			s: "input:checked + label .connects-log",
			r: "display: block;",
		},
		{
			s: ".connects-state",
			r: "display: none;",
		},
		{
			s: ".withoutavatars .userscript-hacker-chat",
			r: "margin-left: -15px; min-width: calc(100% + 30px);",
		},
		{
			s: ".Ve-btn-chat",
			r: "margin-top: 10px; margin-left: -35px;",
		},
		{
			s: ".withoutavatars .Ve-btn-chat",
			r: "margin-left: -5px;",
		},
		// Bootstrap-alikes
		{
			s: ".col",
			r: "display: inline-block;",
		},
		{
			s: ".col-1",
			r: "width: 8.333%;",
		},
		{
			s: ".col-2",
			r: "width: 16.666%;",
		},
		{
			s: ".col-3",
			r: "width: 25%;",
		},
		{
			s: ".col-4",
			r: "width: 33.333%;",
		},
		{
			s: ".col-5",
			r: "width: 41.667%;",
		},
		{
			s: ".col-6",
			r: "width: 50%;",
		},
		{
			s: ".col-7",
			r: "width: 58.333%;",
		},
		{
			s: ".col-8",
			r: "width: 66.667%;",
		},
		{
			s: ".col-9",
			r: "width: 75%;",
		},
		{
			s: ".col-10",
			r: "width: 83.333%;",
		},
		{
			s: ".col-11",
			r: "width: 91.667%;",
		},
		{
			s: ".col-12",
			r: "width: 100%;",
		},
		{
			s: ".ib",
			r: "display: inline-block;",
		},
		{
			s: ".float-right",
			r: "float: right;",
		},
		{
			s: ".my-0",
			r: "margin-top: 0 !important; margin-bottom: 0 !important;",
		},
		{
			s: ".m-1",
			r: "margin: 0.25rem !important;",
		},
		{
			s: ".mt-2",
			r: "margin-top: 0.5rem !important;",
		},
		{
			s: ".mr-1",
			r: "margin-right: 0.25rem !important;",
		},
		{
			s: ".ml-1",
			r: "margin-left: 0.25rem !important;",
		},
		{
			s: ".mr-2",
			r: "margin-right: 0.5rem !important;",
		},
		{
			s: ".ml-2",
			r: "margin-left: 0.5rem !important;",
		},
		{
			s: ".mb-2",
			r: "margin-bottom: 0.5rem !important;",
		},
		{
			s: ".mb-1",
			r: "margin-bottom: 0.25rem !important;",
		},
		{
			s: ".p-2",
			r: "padding: 0.5rem !important;",
		},
		{
			s: ".p-3",
			r: "padding: 1rem !important;",
		},
		{
			s: ".split",
			r: "display: flex; justify-content: space-between;",
		},
		{
			s: ".split--center",
			r: "align-items: center;",
		},
		// image rows
		{
			s: ".import-cb-label--img",
			r: "display: flex; height: 64px; align-items: center; padding: 4px;",
		},
		{
			s: ".import-label__img",
			r: "display: inline-block; width: 60px; height: 60px; padding: 0 5px;",
		},
		// importer
		{
			s: ".import-cb-label",
			r: "display: block; margin-right: -13px !important;",
		},
		{
			s: ".import-cb-label span",
			r: "display: inline-block; overflow: hidden; max-height: 18px; letter-spacing: -1px; font-size: 12px;",
		},
		{
			s: ".import-cb-label span.readable",
			r: "letter-spacing: initial",
		},
		{
			s: ".import-cb-label .source",
			r: "width: calc(16.667% - 28px);'",
		},
		// Table importer
		{
			s: ".table-import-search",
			r: "transform: translateZ(0); max-height: 490px; overflow-y: scroll; overflow-x: hidden;",
		},
		{
			s: ".table-import-textarea",
			r: "display: block; width: 600px; height: 340px;",
		},
		// horizontal toolbar
		{
			s: "#secondary-toolbar:hover",
			r: "opacity: 1 !important;",
		},
		// Config & dark mode fixes
		{
			s: ".config-name",
			r: "padding: 6px 0px; line-height: 21px;",
		},
		{
			s: "#d20plus-configeditor .nav li:not(.active) > a",
			r: "cursor: pointer;",
		},
		{
			s: "#d20plus-configeditor table.config-table tbody tr:nth-child(2n+1)",
			r: "background-color: rgba(120, 120, 120, 0.2);",
		},
		{
			s: ".tokeneditor__bar-inputs input[type=\"text\"][disabled], .token_bar_input[disabled]",
			r: "background-color: rgba(180, 180, 180, 0.3);",
		},
		{
			s: ".tool-row:nth-child(2n+1)",
			r: "background-color: rgba(120, 120, 120, 0.2);",
		},
		{
			s: "#floatinglayerbar li",
			r: "background-color: var(--dark-surface2);border-color: var(--dark-surface1);",
		},
		{
			s: ".ui-dialog .artr__side, .ui-dialog .artr__view, .ui-dialog .artr__side__tag_grid, .ui-dialog .artr__side__head",
			r: "background-color: unset;",
		},
		// Fix page options scrollbar color in darkmode on Chrome
		{
			s: ".ui-dialog-content::-webkit-scrollbar-thumb",
			r: "background-color: rgba(100, 100, 100, 0.5);",
		},
		// adjust the "Talking to Yourself" box
		{
			s: "#textchat-notifier",
			r: "top: -5px; background-color: red; opacity: 0.5; color: white;",
		},
		{
			s: "#textchat-notifier:after",
			r: "content: '!'",
		},
		{
			s: ".ctx__layer-icon",
			r: `
			display: inline-block;
			width: 12px;
			text-align: center;
			`,
		},
		// fix the shitty undersized "fire" icon
		{
			s: ".choosewalls > .pictostwo",
			r: "width: 15px; height: 17px; display: inline-block; text-align: center;",
		},
		{
			s: "#editinglayer.walls > .pictos",
			r: "width: 20px; height: 22px; display: inline-block; text-align: center; font-size: 0.9em;",
		},
		// weather config window
		{
			s: ".ui-dialog .wth__row",
			r: "margin-bottom: 10px; align-items: center; padding: 0 0 5px; border-bottom: 1px solid #eee;",
		},
		{
			s: ".wth__row select",
			r: "margin-bottom: 0",
		},
		{
			s: `.wth__row input[type="range"]`,
			r: "width: calc(100% - 8px);",
		},
		// context menu
		{
			s: `.ctx__divider`,
			r: "width: calc(100% - 2px); border: 1px solid black;",
		},
		// sidebar fix
		/* {
			s: `#rightsidebar`,
			r: `
				display: flex;
				flex-direction: column;
			`
		},
		{
			s: `#rightsidebar ul.tabmenu`,
			r: `
				padding: 0;
				flex-shrink: 0;
				position: relative;
				top: 0;
				width: 100%;
			`
		},
		{
			s: `#rightsidebar .ui-tabs-panel`,
			r: `
				height: 100% !important;
				display: block;
				top: 0;
			`
		},
		{
			s: `#textchat-input`,
			r: `
				position: relative;
				flex-shrink: 0;
			`
		},
		{
			s: `#textchat-input textarea`,
			r: `
				width: calc(100% - 8px) !important;
				resize: vertical;
			`
		}, */
		// Macro editor styles
		{
			s: `.jsdialog .actionhelp.r20, .jsdialog .commandhelp.r20`,
			r: `display: none;`,
		},
		{
			s: `.jsdialog .actionhelp.js, .jsdialog .commandhelp.js`,
			r: `display: inline-block;`,
		},
		{
			s: `.actionhelp.js, .commandhelp.js`,
			r: `display: none;`,
		},
		// Deck editor styles
		{
			s: `tr.card:hover::after`,
			r: `background: rgba(200, 200, 200, 0.4);`,
		},
		{
			s: `tr.card::after`,
			r: `content: "D";font-family: pictos;display: block;float: right;padding: 3px;border-radius: 5px;background: var(--dark-primary);margin: 10px 3px;`,
		},
	];

	d20plus.css.baseCssRulesPlayer = [
		{
			s: ".player-hidden",
			r: "display: none !important;",
		},
	];

	d20plus.css.cssRules = []; // other scripts should populate this

	// Mirrors of 5etools CSS
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		{
			s: ".copied-tip",
			r: "pointer-events: none; position: fixed; background: transparent; user-select: none; z-index: 100000; width: 80px; height: 24px; line-height: 24px;",
		},
		{
			s: ".copied-tip > span",
			r: "display: inline-block; width: 100%; text-align: center;",
		},
		{
			s: ".help",
			r: "cursor: help; text-decoration: underline; text-decoration-style: dotted;",
		},
		{
			s: ".help--subtle",
			r: "cursor: help;",
		},
	]);

	// QOL fixes
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		// Style dice rolls for BetterActions
		{
			s: ".inlinerollresult.showtip.hit-dice",
			r: "cursor: pointer",
		},
		{
			s: ".inlinerollresult.showtip.hit-dice.heal-dice::before",
			r: "content: \"+\"",
		},
		{
			s: ".inlinerollresult.showtip.hit-dice:hover::after",
			r: "content: \"\\2694\";font-size: initial; color: rgba(250,100,100,0.6); position: absolute;",
		},
		{
			s: ".inlinerollresult.showtip.check::after",
			r: "content: \"\\2612\";font-size: 15px;color: #b21a1a;position:absolute;background:inherit;margin-top: 4px;line-height: 15px;",
		},
		{
			s: ".inlinerollresult.showtip.check.success::after",
			r: "content: \"\\2611\";color: #009c00;",
		},
		{
			s: ".inlinerollresult.showtip.check.attack-failure::after",
			r: "content: \"\\26E8\"; padding-top: 2px;",
		},
		{
			s: ".inlinerollresult.showtip.check.attack-success::after",
			r: "content: \"\\2694\";color: #009c00;border: 1px solid;display: inline-block;border-radius: 10px;padding: 2px;font-size: 11px;line-height: 8px;margin-top: 5px;",
		},
		{
			s: ".sheet-grey .inlinerollresult.showtip.check::after",
			r: "content: \"\";border: none;",
		},
		{
			s: ".inlinerollresult.showtip.check",
			r: "margin-right: 8px;display: inline-block;height: 24px;line-height: 24px;margin-top: -4px;",
		},
		{
			s: ".sheet-grey .inlinerollresult.showtip.check, .inlinerollresult.showtip.check.attack-success, .inlinerollresult.showtip.attack-fail",
			r: "margin-right: unset;",
		},
		// Styles for altered messages
		{
			s: ".userscript-modify-message",
			r: "display: none;",
		},
		{
			s: ".message.inlang i",
			r: "cursor: help;",
		},
		{
			s: ".message.action .avatar, .message.action .by",
			r: "display: none;",
		},
		{
			s: ".message.general.talktomyself, .message.rollresult.talktomyself, .message.private.talktomyself",
			r: "filter: sepia(70%);",
		},
		{
			s: ".message.general.disconnect .by::before",
			r: "font-family: pictos; content: \"[\";",
		},
	]);

	// Rewamped page options
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		{
			s: ".ui-dialog-pagename",
			r: "padding: 12px 0px 0px 10px; display: inline-block; font-size: 14px; max-width: 130px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;",
		},
		{
			s: ".nav-tabs--beta .label",
			r: "left: calc( 50% - 21px); right: unset;",
		},
		{
			s: ".nav-tabs > li > ul .nav-tabs--beta .label",
			r: "top: -4px;",
		},
		{
			s: ".nav-tabs > li > ul",
			r: "width: 0px; overflow-x: visible; white-space: nowrap; margin-left: -50px; height: 0px; overflow-y: clip; transition: height 0.3s;",
		},
		{
			s: ".nav-tabs > li.active > ul",
			r: "height: 36px; transition: height 1s;",
		},
		{
			s: ".dialog .nav-tabs > li.active.dl > a",
			r: "background-color: unset; border-color: transparent; text-decoration: none; pointer-events: none; cursor: unset;",
		},
		{
			s: ".ui-dialog .ui-dialog-content",
			r: "background: inherit;",
		},
		{
			s: ".dialog .nav.nav-tabs > li > a",
			r: "cursor: pointer;",
		},
		{
			s: ".nav-tabs > ul > li",
			r: "list-style: none; display: inline-block;",
		},
		{
			s: ".nav-tabs > ul > li a",
			r: "border-radius: 4px 4px 0 0; padding-right: 12px; padding-left: 12px; margin-right: 2px; line-height: 14px; display: inline-block; padding-top: 9px; padding-bottom: 9px; border-style: solid; border-width: 1px; border-bottom: none;",
		},
		{
			s: ".nav-tabs > ul > li.active a",
			r: "background-color: var(--dark-primary); color: var(--dark-primarytext); border-color: var(--dark-primary-highlight); text-decoration-color: var(--color-primary-text); vertical-align: sub;",
		},
		{
			s: ".nav-tabs > ul > li.active,	ul.nav-tabs li.active",
			r: "border-bottom-width: 0px;",
		},
		{
			s: "ul.nav-tabs > li.nav-tabs",
			r: "border-bottom: none;",
		},
		{
			s: ".nav.nav-tabs.pagedetails_navigation",
			r: "position: sticky; top: -10px; z-index: 100; background-color: inherit; padding-top: 7px;",
		},
		{
			s: ".page-input",
			r: "box-sizing: border-box; height: 28px; width: 100%; border-radius: 0.5rem;",
		},
		{
			s: ".page-input.page-hint[type=\"text\"]",
			r: "border-radius: 0.5rem;",
		},
		{
			s: ".weather input[type=\"color\"]",
			r: "width: 100%; height: 24px; border-radius: 0.5rem; padding: 1px;",
		},
		{
			s: ".views .pagedetails h4",
			r: "display: inline;",
		},
		{
			s: ".tab-pane strong .showtip",
			r: "margin-left: 0px; margin-right: 3%; float: left; margin-top: 1px;",
		},
	]);

	// Art repo browser CSS
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		// full-width images search header
		{
			s: "#imagedialog .searchbox",
			r: "width: calc(100% - 10px)",
		},
		/// ////////////
		{
			s: ".artr__win",
			r: "display: flex; align-items: stretch; width: 100%; height: 100%; padding: 0 !important;",
		},
		// fix box sizing
		{
			s: ".artr__win *",
			r: "box-sizing: border-box;",
		},
		// custom scrollbars
		{
			s: ".artr__win *::-webkit-scrollbar",
			r: "width: 9px; height: 9px;",
		},
		{
			s: ".artr__win *::-webkit-scrollbar-track",
			r: "background: transparent;",
		},
		{
			s: ".artr__win *::-webkit-scrollbar-thumb",
			r: "background: #cbcbcb;",
		},
		/// ////////////
		{
			s: ".artr__side",
			r: "width: 300px; height: 100%; border-right: 1px solid #ccc; background: #f8f8f8; position: relative; flex-shrink: 0; display: flex; flex-direction: column;",
		},
		{
			s: ".artr__side__head",
			r: "flex-shrink: 0; font-weight: bold; margin-bottom: 7px; margin-bottom: 7px; border-bottom: 3px solid #ccc; background: white;",
		},
		{
			s: ".artr__side__head__title",
			r: "font-size: 16px; font-weight: bold;",
		},
		{
			s: ".artr__side__body",
			r: "flex-shrink: 0; overflow-y: auto; transform: translateZ(0);",
		},
		{
			s: ".artr__side__tag_header",
			r: "width: 100%; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; padding: 0 6px; cursor: pointer; margin-bottom: 10px;",
		},
		{
			s: ".artr__side__tag_grid",
			r: "display: flex; width: 100%; flex-wrap: wrap; margin-bottom: 15px; background: #f0f0f0; border-radius: 5px;",
		},
		{
			s: ".artr__side__tag",
			r: "padding: 2px 4px; margin: 2px 4px; font-size: 11px;",
		},
		{
			s: `.artr__side__tag[data-state="1"]`,
			r: "background-image: linear-gradient(#fff, #337ab7);",
		},
		{
			s: `.artr__side__tag[data-state="1"]:hover`,
			r: "background-image: linear-gradient(rgb(#337ab7), rgb(#337ab7)); background-position: 0; transition: none;",
		},
		{
			s: `.artr__side__tag[data-state="2"]`,
			r: "background-image: linear-gradient(#fff, #8a1a1b);",
		},
		{
			s: `.artr__side__tag[data-state="2"]:hover`,
			r: "background-image: linear-gradient(rgb(#8a1a1b), rgb(#8a1a1b)); background-position: 0; transition: none;",
		},
		{
			s: ".artr__main",
			r: "width: 100%; height: 100%; display: flex; overflow-y: auto; flex-direction: column; position: relative;",
		},
		{
			s: ".artr__side__loading, .artr__main__loading",
			r: "width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; font-style: italic;",
		},
		{
			s: ".artr__bread",
			r: "width: 100%; margin-bottom: 2px;",
		},
		{
			s: ".artr__crumb",
			r: "border: 1px solid #ccc; border-radius: 5px; padding: 0 5px; display: inline-block; cursor: pointer; user-select: none;",
		},
		{
			s: ".artr__crumb--sep",
			r: "border: 0; cursor: default;",
		},
		{
			s: ".artr__search",
			r: "flex-shrink: 0; width: 100%; border-bottom: 1px solid #ccc; display: flex; flex-direction: column;",
		},
		{
			s: ".artr__search__field",
			r: "width: 100%; height: 26px;",
		},
		{
			s: ".artr__view",
			r: "position: absolute; top: 64px; bottom: 0; left: 0; right: 0; overflow-y: auto; transform: translateZ(0); background-color: whitesmoke;",
		},
		{
			s: ".artr__view_inner",
			r: "display: flex; width: 100%; height: 100%; flex-wrap: wrap; align-content: flex-start;",
		},
		{
			s: ".artr__no_results_wrp",
			r: "width: 100%; height: 100%; display: flex; justify-content: center;",
		},
		{
			s: ".artr__no_results",
			r: "width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;",
		},
		{
			s: ".artr__no_results_headline",
			r: "font-size: 125%; font-weight: bold;",
		},
		{
			s: ".artr__item",
			r: "width: 180px; margin: 5px; box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.75); display: block; background: white; position: relative;",
			// Using flex makes scrolling extremely sluggish
			// display: flex; flex-direction: column; cursor: pointer; float: left;
		},
		{
			s: ".artr__item__stats",
			r: "position: absolute; left: 0; top: 0; display: none;",
		},
		{
			s: ".artr__item:hover .artr__item__stats",
			r: "display: block;",
		},
		{
			s: ".artr__item__stats_item",
			r: "color: grey; background: white; border-radius: 5px; margin: 4px 2px; padding: 0 2px; text-align: center; border: 1px solid #e0e0e0",
		},
		{
			s: ".artr__item__menu",
			r: "position: absolute; right: 0; top: 0; display: none;",
		},
		{
			s: ".artr__item:hover .artr__item__menu",
			r: "display: block;",
		},
		{
			s: ".artr__item__menu_item",
			r: "cursor: pointer; color: grey; font-size: 26px; line-height: 24px; border-radius: 5px; margin: 4px; padding: 2px; text-align: center; display: block; border: 1px solid #ccc; background: white;",
		},
		{
			s: ".artr__item--index",
			r: "height: 240px;",
		},
		{
			s: ".artr__item--item",
			r: "height: 180px;",
		},
		{
			s: ".artr__item:hover",
			r: "box-shadow: 0 0 8px 0 rgba(38, 167, 242, 1); opacity: 0.95;",
		},
		{
			s: ".artr__item--back",
			r: "display: flex; justify-content: center; align-items: center; font-size: 24px; color: #888;",
		},
		{
			s: ".artr__item__top",
			r: "width: 100%; height: 180px; flex-shrink: 0; margin: 0 auto; display: flex; align-items: center;",
		},
		{
			s: ".artr__item__top--quart",
			r: "display: flex; flex-wrap: wrap;",
		},
		{
			s: ".artr__item__bottom",
			r: "width: 100%; height: 60px; flex-shrink: 0;  border-top: 1px solid #ccc; background: #f8f8f8; display: flex; flex-direction: column; font-size: 12px; justify-content: space-evenly;",
		},
		{
			s: ".artr__item__bottom__row",
			r: "width: 100% height: 20px; flex-shrink: 0; padding: 4px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
		},
		{
			s: ".artr__item__thumbnail",
			r: "max-width: 100%; max-height: 100%; display: block; margin: 0 auto;",
		},
		{
			s: ".atr__item__quart",
			r: "width: 50%; height: 50%; display: block; margin: 0;",
		},
		{
			s: ".atr__item__quart--more",
			r: "display: flex; justify-content: center; align-items: center;",
		},
		{
			s: ".artr__item__full",
			r: "width: 100%; height: 180px; margin: 0 auto; display: flex; align-items: center; padding: 3px;",
		},
		{
			s: ".artr__wrp_big_img",
			r: "position: fixed; top: 0; bottom: 0; right: 0; left: 0; background: #30303080; padding: 30px; display: flex; justify-content: center; align-items: center; z-index: 99999;",
		},
		{
			s: ".artr__big_img",
			r: "display: block; max-width: 100%; max-height: 100%;",
		},
		// fix row styles
		{
			s: "#d20plus-artfolder .url",
			r: "width: calc(65% - 75px) !important;white-space: nowrap;overflow: hidden;",
		},
		{
			s: "#d20plus-artfolder .library-item",
			r: "line-height: 16px;",
		},
		{
			s: "#d20plus-artfolder .library-item:hover",
			r: "background-color: rgba(100,100,100,0.5);",
		},
		// fix global dialog height for art browser
		{
			s: ".ui-dialog",
			r: "max-height:98vh;",
		},
	]);

	// Animator CSS -- `anm__` prefix
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		// fix box sizing
		{
			s: ".anm__win *",
			r: "box-sizing: border-box;",
		},
		{
			s: ".ui-dialog .anm__row",
			r: `
				display: flex;
				align-items: center;
				margin-bottom: 3px;
				height: 20px;
			`,
		},
		{
			s: ".anm__row > div",
			r: `
				display: inline-flex;
			`,
		},
		{
			s: ".anm__row-btn",
			r: `
				padding: 0 6px;
			`,
		},
		{
			s: ".anm__row-wrp-cb",
			r: `
				justify-content: center;
				align-items: center;
			`,
		},
		{
			s: ".anm__wrp-sel-all",
			r: `
				align-items: center;
				margin-bottom: 5px;
				display: flex;
				justify-content: space-between;
			`,
		},
		{
			s: ".anm-edit__ipt-lines-wrp",
			r: `
				flex-basis: 100%;
				flex-shrink: 100;
			`,
		},
		{
			s: ".anm-edit__gui .anm-edit__gui-hidden",
			r: `
				display: none;
			`,
		},
		{
			s: ".anm-edit__text .anm-edit__gui-visible",
			r: `
				display: none;
			`,
		},
		{
			s: ".anm-edit__ipt-lines-wrp--gui",
			r: `
				overflow-y: auto;
				display: flex;
				flex-direction: column;
			`,
		},
		{
			s: ".anm-edit__ipt-lines-wrp--gui > *",
			r: `
				flex-shrink: 0;
			`,
		},
		{
			s: ".anm-edit__ipt-lines",
			r: `
				resize: none;
				width: 100%;
				height: 100%;
				margin-bottom: 0;
			`,
		},
		{
			s: ".anm-edit__gui-row",
			r: `
				padding: 4px;
				border: 1px solid #ccc;
				border-radius: 3px;
				margin-bottom: 3px;
			`,
		},
		{
			s: ".anm-edit__gui-row:nth-child(even)",
			r: `
				background: #f8f8f8;
			`,
		},
		{
			s: ".anm-edit__gui-row-name",
			r: `
				color: white;
				-webkit-text-stroke: 1px #555;
				text-stroke: 1px black;
				padding: 3px 5px;
				border-radius: 3px;
				font-size: 16px;
				display: inline-block;
				min-width: 150px;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Move",
			r: `
				background: #ff0004;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Rotate",
			r: `
				background: #ff6c00;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Copy",
			r: `
				background: #fff700;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Flip",
			r: `
				background: #a3ff00;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Scale",
			r: `
				background: #5eff00;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Layer",
			r: `
				background: #00ff25;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--Lighting",
			r: `
				background: #00ffb6;
			`,
		},
		{
			s: [
				".anm-edit__gui-row-name--SetProperty",
				".anm-edit__gui-row-name--SumProperty",
			],
			r: `
				background: #006bff;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--TriggerMacro",
			r: `
				background: #0023ff;
			`,
		},
		{
			s: ".anm-edit__gui-row-name--TriggerAnimation",
			r: `
				background: #9800ff;
			`,
		},
		{
			s: ".anm-scene__wrp-tokens",
			r: `
				width: 100%;
				max-height: 100%;
				overflow-y: auto;
				display: flex;
				flex-wrap: wrap;
			`,
		},
		{
			s: ".anm-scene__wrp-token",
			r: `
				width: 80px;
				height: 100px;
				background: #f0f0f0;
				box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.75);
				margin: 4px;
				display: flex;
				flex-direction: column;
				padding: 3px;
			`,
		},
		{
			s: ".anm-scene__wrp-token--active",
			r: `
				background: #a0f0ff;
			`,
		},
		{
			s: ".anm-scene__wrp-token-name",
			r: `
				height: 20px;
				overflow: hidden;
			`,
		},
		{
			s: ".anm-scene__wrp-token-name-inner",
			r: `
				height: 20px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`,
		},
		{
			s: ".flex-row",
			r: `
				display: flex;
				float: left;
				align-items: center;
				margin-bottom: 5px;
			`,
		},
		{
			s: ".pagedetails .flex-row input.units,.pagedetails .flex-row input.pixels",
			r: `
				width: 20%;
				text-align: center;
				border: 1px solid;
				border-radius: 5px;
				margin: 0 2%;
			`,
		},
	]);

	// Jukebox CSS
	d20plus.css.cssRules = d20plus.css.cssRules.concat([
		{
			s: ".jukebox-widget-button",
			r: `
				flex: 1;
				text-overflow: ellipsis;
				overflow: hidden;
				min-width: 50px;
			`,
		},
		{
			s: ".jukebox-widget-slider",
			r: `
				margin: 10px;
				display: inline-block;
				flex: 15;
			`,
		},
		{
			s: ".jukebox-widget-button",
			r: `
				letter-spacing: -1px
			`,
		},
	]);

	d20plus.css.miniInitStyle = `
		#initiativewindow button.initmacrobutton {
			padding: 1px 4px;
		}

		#initiativewindow input {
			font-size: 8px;
		}

		#initiativewindow ul li span.name {
			font-size: 13px;
			padding-top: 0;
			padding-left: 4px;
			margin-top: -3px;
		}

		#initiativewindow ul li img {
			min-height: 15px;
			max-height: 15px;
		}

		#initiativewindow ul li {
			min-height: 15px;
		}

		#initiativewindow div.header span.initiative,
		#initiativewindow ul li span.initiative,
		#initiativewindow ul li span.tracker-col,
		#initiativewindow div.header span.tracker-col,
		#initiativewindow div.header span.initmacro,
		#initiativewindow ul li span.initmacro {
			font-size: 10px;
			font-weight: bold;
			text-align: right;
			float: right;
			padding: 0 5px;
			width: 7%;
			min-height: 20px;
			display: block;
			overflow: hidden;
		}

		#initiativewindow ul li .controls {
			padding: 0 3px;
		}
	`;

	d20plus.css.clickableConditionHints = `
		.hinted.showtip,
		.message .hinted.showtip,
		.message .sheet-container .hinted.showtip {
			color: #b85f74;
			cursor: help;
			font-weight: bold;
			display: inline-block;
		}
		.hinted.showtip.clickable,
		.message .hinted.showtip.clickable,
		.message .sheet-container .hinted.showtip.clickable {
			cursor: pointer;
		}
		.b20-condition-hint {
			text-align: left;
		}
		.b20-condition-hint div, .b20-condition-hint p {
			text-align: left;
			max-height: 400px;
			overflow-y: hidden;
			font-size: 12px;
			line-height: normal;
		}
		.b20-condition-hint h2, .b20-condition-hint h3 {
			color: var(--link-text);
			font-size: 14px;
			line-height: normal;
			display: inline-block;
			width: 100%;
		}
		.b20-condition-hint ul {
			margin-left: 15px;
		}
		.b20-condition-hint td, .b20-condition-hint th {
			padding-right: 4px;
		}
		.b20-condition-hint .rd__h-toggle {
			display: none;
		}
		.b20-condition-hint .ve-flex-vh-center {
			font-weight: 100;
			line-height: normal;
			font-size: smaller;
			float: right;
		}
	`;

	d20plus.css.actionMenu = `
		/* Widen traits template for spell descriptions (not necessary) */
		.sheet-rolltemplate-traits {
			width:90%;
		}

		/* Adjust token actions position */
		#secondary-toolbar.legacy-menu.toolbar-collapse-adjust {
			left: 118px;
		}
		#secondary-toolbar.legacy-menu.toolbar-collapse-adjust.master-toolbar-collapsed {
			left: 92px;
		}

		#ba-panel {
			display: block;
		}

		/* Better actions button */
		#ba-panel button.large.page-button {
			position: absolute;
			height: 40px;
			left: 62px;
			width: 40px;
			top: 20px;
			border-radius: 8px;
			padding: 0 !important;
			background-color: var(--colors-light-060);
			border-style: solid;
			border-width: 1px;
			border-color: var(--grayscale-light-l60);
			backdrop-filter: blur(15px);
			transition: left ease 200ms;
		}
		.dark #ba-panel button.large.page-button {
			background-color: var(--colors-dark-050);
			border-color: --grayscale-light-l-30;
		}
		#ba-panel button.large.page-button:hover {
			border-width: 3px;
		}
		#ba-panel.master-toolbar-collapsed button.large.page-button {
			left: 36px;
		}

		/* Better actions menu dialog (general) */
		#ba-panel .ba-menu {
			position: absolute;
			left: 62px;
			top: 72px;
			width: 350px;
			background-color: var(--vtt-surface);
			border-radius: 8px;
			box-shadow: var(--vtt-submenu-box-shadow);
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			padding: 4px;
			font-family: var(--font-family-proxima-nova);
			font-style: normal;
			font-weight: 300;
			font-size: 13px;
			color: var(--vtt-grayscale-base);
			transition: width 1s ease, opacity 1s ease, left ease 200ms;
			opacity: 0.7;
		}
		#ba-panel:hover .ba-menu {
			opacity: unset;
		}
		#ba-panel.master-toolbar-collapsed .ba-menu {
			left: 36px;
		}
		#ba-panel .ba-token {
			background: var(--vtt-surface);
			width: 45px;
			display: inline-block;
			height: 45px;
			border-radius: 23px;
			position: relative;
			top: -10px;
			left: -13px;
			border: 1px solid var(--vtt-grayscale-base);
		}
		#ba-panel .ba-token img {
			width: 45px;
		}
		.ba-title {
			width: 100%;
			height: 35px;
		}
		.ba-title .ba-name {
			height: 100%;
			display: inline-block;
			vertical-align: middle;
			font-weight: bold;
		}
		.ba-title-actions {
			display: block;
			float: right;
			cursor: pointer;
		}
		.ba-title-actions button {
			font-family: Pictos;
			font-size: 15px;
			padding: 3px;
		}
		.ba-menu .ba-main {
			font-family: "Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif;;
			font-size: 13px;
			font-weight: normal;
			width: 100%;
		}

		/* Better actions tabs */
		#ba-panel .nav {
			margin-bottom: 10px;
			width: 100%;
			padding-left: 34px;
 			box-sizing: border-box;
			transition: padding-left 1s ease;
			overflow: clip;
			white-space: nowrap;
			height: 37px;
		}
		.ba-menu .nav-tabs > li > a {
			padding: 9px;
			height: 17px;
			text-decoration: none;
		}
		#ba-panel .ba-tabs > .nav-tabs a:hover {
			cursor: pointer;
			background: rgba(155,155,155,0.5);
		}
		.dark .ba-menu .nav-tabs a img {
			filter: contrast(0) brightness(2);
		}
		.ba-menu .nav-tabs a img {
			width: 15px;
 			margin: -5px;
		}
		.ba-menu .nav:not(:hover) .nav-tabs.active a span, .ba-menu .nav-tabs li:hover a span {
			max-width: 55px;
			padding-left: 6px;
			text-overflow: ellipsis;
		}
		.ba-menu .nav-tabs a span {
			display: inline-block;
			padding-left: 0px;
			margin-right: -3px;
			max-width: 0px;
			color: var(--vtt-grayscale-base);
			overflow: hidden;
			transition: max-width 1s ease, padding-left 1s ease;
		}

		.ba-list.content-left, .ba-main .content-right {
			display: inline-block;
			overflow-x: hidden;
			overflow-y: auto;
			min-height: 216px;
			max-height: 216px;
			margin-bottom: 6px;
			padding: 0px 5px;
			box-sizing: border-box;
			scrollbar-width: thin;
			scrollbar-color: transparent transparent;
			scrollbar-gutter: stable;
			transition: width 1s ease, max-height 0.6s ease, padding 0.5s 0.5s;
		}
		.ba-list.content-left:hover, .ba-main .content-right:hover {
			scrollbar-color: rgba(155,155,155,0.5) transparent;
		}
		.ba-main .content-left {
			width: 160px;
		}
		.ba-main .content-right {
			width: 180px;
			float: right;
			box-sizing: content-box;
		}
		.ba-info > ul, .ba-list > ul {
			list-style: none;
			margin: 0px;
		}
		.ba-info > ul > li {
			border-bottom: 1px solid rgba(155,155,155,0.5);
			padding-bottom: 5px;
		}
		.ba-info > ul > li > span {
			display: inline-block;
			padding-right: 4px;
			font-weight: lighter;
			color: var(--vtt-grayscale-base);
		}
		.ba-info > ul > li > span strong {
			font-weight: normal;
			color: rgb(140,140,140);
			white-space: nowrap;
		}

		/* Collapsed state */
		#ba-panel .ba-menu.wcollapsed {
			width: 170px;
		  }
		.ba-menu.wcollapsed .ba-name {
			max-width: 55px;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		  }
		#ba-panel .ba-menu.wcollapsed .nav {
			padding-left: 0px;
			margin-top: 5px;
			height: 29px;
		  }
		.ba-menu.wcollapsed .nav-tabs > li {
			width: 21px;
		}
		.ba-menu.wcollapsed .nav-tabs > li > a {
			width: 0px;
			height: 13px;
			padding-top: 5px;
		}
		.ba-menu.wcollapsed .nav-tabs > li > a > img {
			width: 12px;
			margin: -6px;
		}
		  .ba-menu.wcollapsed .nav:not(:hover) .nav-tabs.active a span, .ba-menu.wcollapsed .nav-tabs li:hover a span {
			display: none;
			margin-right: -9px;
		  }
		  #ba-panel .ba-menu.wcollapsed .ba-list.content-left {
			width: 164px;
		  }
		  #ba-panel .ba-menu.wcollapsed .ba-info.content-right {
			padding: 0px;
			width: 0%;
			height: 200px;
			position: absolute;
			top: 85px;
		  }
		  .ba-menu.wcollapsed .ba-title-actions [data-action="collapsew"]::after {
			content: "N";
			transform: none;
		  }
		  .ba-title-actions [data-action="collapsew"]::after {
			content: "l";
			transform: rotate(180deg);
			display: inline-block;
		  }
		  .ba-menu.hexpanded .ba-title-actions [data-action="expandh"]::after {
			content: "\`\`";
			font-size: 14px;
			display: inline-block;
			width: 14px;
			overflow: clip;
			text-indent: -7px;
			letter-spacing: 1px;
		  }
		  .ba-title-actions [data-action="expandh"]::after {
			content: "\`";
			font-size: 13px;
			display: inline-block;
		  }
		  .ba-menu.hexpanded .ba-list.content-left, .ba-menu.hexpanded  .ba-main .content-right {
			max-height: 70vh;
		  }

		.ba-list > ul > li {
			border-bottom: 1px solid rgba(155,155,155,0.5);
			padding: 5px 0px 5px 5px;
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow-x: hidden;
		}
		.ba-list ul > li[data-action]:hover {
			background-color: rgba(155,155,155,0.5);
			cursor: pointer;
		}
		.ba-list > ul > li:hover > .submenu {
			display: flex;
			margin: 0px 5px 0px -5px;
		}
		.ba-list .submenu {
			display: none;
		}
		.ba-list .submenu > li {
			list-style: none;
			display: block;
			text-align: center;
			padding: 3px;
			box-sizing: content-box;
			margin-bottom: -3px;
			margin-top: 2px;
			flex-grow: 1;
			border-left: 1px solid rgba(155,155,155,0.5);
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.ba-list .submenu > li:first-child {
			border-left: none;
		}
		.ba-list ul.uneven li.inactive > span, .ba-list li.inactive[data-action] {
			color: #848484;
			font-weight: 100;
		}
		.ba-list ul.uneven.filtered li.inactive, .ba-list ul.uneven.filtered .hasSub li.inactive {
			display: none;
		}
		.ba-list ul:not(.uneven) li.mods label.filter {
			display: none;
		}
		.ba-list ul[data-list="spells"] > li > span {
			text-align: right;
			width: 100%;
			display: inline-block;
			padding-right: 14px;
			box-sizing: border-box;
			font-weight: bold;
		}
		.ba-list ul[data-list="spells"] > .hasSub > .submenu {
			display: block;
			margin: 0px;
		}
		.ba-list ul[data-list="spells"] > .hasSub > .submenu > li {
			width: 100%;
			display: block;
			text-align: left;
			margin: 3px 0px 3px -5px;
			overflow: hidden;
			text-overflow: ellipsis;
			border-left: none;
		}
		.ba-list ul[data-list="spells"] i {
			font-style: normal;
			display: inline-block;
			font-size: 8px;
			font-weight: normal;
			float: left;
		}
		.ba-list ul[data-list="spells"] .selector:hover .submenu {
			display: flex;
			margin-left: 0px; 
		}
		.ba-list ul[data-list="spells"] .submenu .parameters > .submenu {
			display: none;
		}
		.ba-list ul[data-list="spells"] .submenu .parameters:hover > .submenu {
			display: block;
			position: absolute;
			z-index: 10;
			top: 75px;
			left: 130px;
			background: var(--vtt-surface);
			height: 240px;
			border-left: 1px dashed rgba(155,155,155,0.5);
		}
		.ba-info [data-pane] {
			width: 175px;
		}
		.ba-list [data-list], .ba-info [data-pane] {
			display: none;
		}
		.ba-list .active[data-list], .ba-info [data-pane] {
			display: none;
		}
		.ba-list .active[data-list], .ba-info .active[data-pane] {
			display: block;
		}
		.ba-list .mods {
			position: sticky;
			top: 0px;
			background: var(--vtt-surface);
			padding-top: 1px;
		}
		.ba-list li.mods label {
			display: inline-block;
			margin-bottom: 3px;
		}
		.ba-list li.mods label span {
			cursor: pointer;
			padding: 0px 3px;
			margin-right: 3px;
			border: 1px solid transparent;
			border-radius: 4px;
		}
		.ba-list li.mods label.filter span {
			font-family: pictos;
			font-size: 12px;
			display: inline-block;
			height: 19px;
			box-sizing: border-box;
			vertical-align: top;
			color: gray;
			width: 19px;
			overflow: clip;
			margin-left: 4px;
			transform: rotate(180deg);
			border-radius: 12px;
		}
		.ba-list li.mods label span:hover {
			background: rgba(155,155,155,0.5);
		}
		.ba-list li.mods input:checked + span {
			background-color: var(--primary-dark);
			color: var(--grayscale-dark-base);
			border: 1px solid var(--primary-dark-l20);
		}
		.ba-list li.mods label input {
			display: none;
		}
	`;

	d20plus.css.layerToolbar = `
		.b20.drawer-outer, .b20 .drawer-views {
			display: flex;
			flex-shrink: 1;
			flex-direction: column;
			align-items: center;
			position: absolute;
			background: var(--vtt-toolbar-drawer-bg);
			backdrop-filter: blur(5px);
			min-height: 44px;
			padding: 6px 2px;
			padding-top: 6px;
			padding-bottom: 6px;
			border-radius: 8px;
			bottom: 20px;
			left: 60px;
			padding-bottom: 3px;
			padding-top: 6px;
			z-index: 10499;
			box-shadow: var(--vtt-toolbar-drawer-box-shadow);
		}
		.b20.toolbar-button-outer, .b20 .drawer-views .toolbar-button-outer {
			position: relative;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
		}
		.drawer-outer #extra-layer-button {
			display: none;
		}
		.b20 .toolbar-button-mid {
			display: flex;
			flex-direction: column;
			align-items: center;
		}
		.b20 .toolbar-button-inner, .b20 .view-button-inner {
			display: flex;
			flex-direction: column;
			align-content: space-between;
			justify-content: center;
			align-items: center;
			position: relative;
			width: 44px;
			height: 40px;
		}
		.b20 .icon-slot {
			color: var(--vtt-toolbar-icon-color);
			display: flex;
			justify-content: center;
			align-items: center;
			width: 36px;
			height: 36px;
			border-radius: 12px;
		}
		.b20 .icon-circle {
			background: var(--vtt-layer-btn-bg);
			border-radius: 20px;
		}
		.b20 .icon-selected, .b20 .drawer-views .view-button-inner {
			border: 1px solid;
			border-radius: 12px;
			border-color: var(--vtt-toolbar-border-color);
			color: var(--72282855);
		}
		.b20 .b20-selected .icon-slot {
			background-color: #446810;
		}
		.b20 .submenu-caret {
			position: absolute;
			background-image: linear-gradient(to top left, var(--vtt-submenu-caret-color) 50%, transparent 0);
			background-size: 100% 100%;
			background-repeat: no-repeat;
			background-position: left,right;
			width: 4px;
			height: 4px;
			bottom: 2px;
			right: 4px;
		}
		.b20 span.grimoire__roll20-icon {
			font-family: Roll20Icons;
			font-size: var(--72a4ca39);
			user-select: none;
		  }
		.b20 .label {
			display: flex;
			justify-content: center;
			font-family: var(--font-family-proxima-nova);
			color: var(--vtt-layer-label-color);
			padding: 1.95px 5.85px 0px;
			letter-spacing: .03rem;
			font-size: 66%;
			max-width: 0px;
		}
		.b20.toolbar-button-outer:hover .toolbar-button-inner {
			border-radius: 12px;
			filter: drop-shadow(0px 0px 4px rgba(122, 150, 60, 0.3)) drop-shadow(0px 0px 2px rgba(121, 174, 27, 0.1)) drop-shadow(1px 1px 4px rgba(135, 193, 64, 0.6));
		}
		.b20 .toolbar-tooltip-outer {
			position: absolute;
			left: 59px;
			z-index:10500;
			display: none;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			height: 34px;
			top: var(--0c2fd930);
		}
		.b20.toolbar-button-outer:hover .toolbar-tooltip-outer,
		.b20 .drawer-views .toolbar-button-outer:hover .toolbar-tooltip-outer {
			display: flex;
		}
		.b20 .toolbar-tooltip-caret {
			background: var(--vtt-tooltip-bg);
			transform: rotate(-45deg);
			width: 8px;
			height: 8px;
		}
		.b20 .toolbar-tooltip-inner {
			background: var(--vtt-tooltip-bg);
			position: absolute;
			display: flex;
			flex-grow: 1;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			border-radius: 8px;
			padding: 0px 8px 0px 8px;
			gap: 8px;
			left: 4px;
		}
		.b20 .toolbar-tooltip-label {
			display: flex;
			align-items: center;
			color: var(--vtt-tooltip-color);
			background: var(--vtt-tooltip-bg);
			width: max-content;
			height: 34px;
		}
		.b20 .toolbar-shortcut-label {
			display: flex;
			align-items: center;
			color: var(--vtt-label-color);
			background: var(--vtt-tooltip-bg);
			width: max-content;
			height: 34px;
			font-weight: bold;
		}
		#layers-label {
			margin-bottom: 4px;
			font-size: 9px;
		}
		#master-toolbar .toolbar-button-mid .label {
			font-size: 8px;
			margin: -3px 0px 4px 0px;
		}
		/* Layer visibility toggles */
		.b20 .layer-toggle {
			font-family: Pictos;
			position: relative;
			margin: 0px 0px -16px 0px;
			top: -14px;
			left: 10px;
			background-color: var(--vtt-layer-btn-bg);
			border-radius: 8px;
			width: 16px;
			height: 16px;
			text-align: center;
			line-height: 16px;
			cursor: alias;
			opacity: 0.7;
		}
		.toolbar-button-inner.layer-off {
			pointer-events: none;
			filter: opacity(0.5) brightness(1.2);
		}
		.toolbar-button-inner.layer-off::after {
			content: "d";
			width: 16px;
			height: 16px;
			font-family: Pictos;
			margin-top:-16px;
			position: relative;
			left: 11px;
			top: 1px;
			font-size: 15px;
			color: rgb(177, 0, 0);
		}
		html.dark .toolbar-button-inner.layer-off::after {
			top: 3px;
		}
		/* View toggles */
		.b20.drawer-outer .drawer-views {
			left: 50px;
			bottom: 0px;
		}
		.b20 .drawer-views .toolbar-button-mid {
			height: 36px;
			border-radius: 20px;
			padding: 0px;
			margin: 2px 4px;
		}
		.b20 .drawer-views .view-button-inner {
			margin-bottom: -10px;
			border-radius: 20px;
			border: 1px solid transparent;
			border-bottom: none;
			border-top: none;
			width: 34px;
		}
		.b20 .drawer-views .last .view-button-inner {
			border-top-left-radius: 0px;
			border-top-right-radius: 0px;
			border-top: none;
		}
		.b20 .drawer-views .first .view-button-inner {
			border-bottom-left-radius: 0px;
			border-bottom-right-radius: 0px;
		}
		.b20 .drawer-views .middle .view-button-inner {
			border-radius: 0px;
			border-top: 0px;
		}
		.b20 .drawer-views .view-icon-slot {
			width: 36px;
			height: 38px;
			line-height: 18px;
			border-radius: 20px;
			padding: 8px;
			box-sizing: border-box;
		}
		.b20 .drawer-views .label {
			top: 0px;
			position: relative;
			font-size: 7px;
			max-width: 36px;
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: visible;
			overflow-x: clip;
			padding: 0px;
			display: block;
		}
		.b20 .drawer-views:hover .view-button-inner {
			border: 1px solid var(--vtt-toolbar-border-color);
			border-bottom: none;
			border-top: none;
		}
		.b20 .drawer-views .active .view-icon-slot {
			background: var(--vtt-layer-btn-bg);
		}
		.b20 .drawer-views .toolbar-button-outer:hover .view-button-inner {
			filter: drop-shadow(0px 0px 4px rgba(70, 190, 173, 0.3)) drop-shadow(0px 0px 5px rgba(27, 174, 133, 0.1)) drop-shadow(1px 1px 5px rgba(64, 193, 169, 0.6));
		}
		.b20 .drawer-views .active .view-icon-slot::after {
			font-family: Pictos;
			content: "E";
			position: relative;
			opacity: 0.7;
			top: -31px;
			left: 15px;
		}
	`;

	d20plus.css.hideExtraLayersToggle = `
		.b20 .layer-toggle {
			display: none;
		}
	`;

	d20plus.css.betterTokenMarkersMenu = `
		#radial-menu .markermenu.open {
			width: 301px;
			height: auto;
			line-height: 0px;
			border-radius: 25px;
			padding: 15px;
			overflow: auto;
			margin-left: 20px;
			max-height: 254px;
		}
		#radial-menu .markermenu.open::before {
			content: " ";
			background: inherit;
			width: 50px;
			height: 50px;
			display: block;
			position: absolute;
			left: -24px;
			top: 33px;
			border-radius: 25px;
			z-index: -1;
		}
		#radial-menu .markermenu .statusicon {
			margin: 1px;
			width: 28px;
			height: 28px;
			box-sizing: border-box;
			border: 4px solid transparent;
			padding: 0px;
			background-position: center;
		}
	`;

	d20plus.css.deserifyDarkmode = `
		.sheet-darkmode #tab-content {
			font-family: unset;
		}
	`;
}

SCRIPT_EXTENSIONS.push(baseCss);
