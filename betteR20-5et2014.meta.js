// ==UserScript==
// @name         betteR20-beta-5et2014-death-jumpagate-import
// @namespace    https://5e.tools/
// @license      MIT (https://opensource.org/licenses/MIT)
// @version      1.36.1.4-beta-testing
// @updateURL    https://mighty-frosty.github.io/betterR20/betteR20-5et2014.meta.js
// @downloadURL  https://mighty-frosty.github.io/betterR20/betteR20-5et2014.user.js
// @description  Enhance your Roll20 experience
// @author       5egmegaanon/astranauta/MrLabRat/TheGiddyLimit/DBAWiseMan/BDeveau/Remuz/Callador Julaan/Erogroth/Stormy/FlayedOne/Cucucc/Cee/oldewyrm/darthbeep/Mertang/Redweller/DeathStalker

// @match        https://app.roll20.net/editor
// @match        https://app.roll20.net/editor#*
// @match        https://app.roll20.net/editor?*
// @match        https://app.roll20.net/editor/
// @match        https://app.roll20.net/editor/#*
// @match        https://app.roll20.net/editor/?*

// @grant        unsafeWindow
// @run-at       document-start

// @grant        GM_webRequest
// @webRequest   [{"selector": { "include": "*://www.google-analytics.com/analytics.js" },  "action": "cancel"}]
// @webRequest   [{"selector": { "include": "*://cdn.userleap.com/shim.js?*" },  "action": "cancel"}]
// @webRequest   [{"selector": { "include": "*://analytics.tiktok.com/*" },  "action": "cancel"}]

// ==/UserScript==
