// ==UserScript==
// @name         betteR20-theoctonaut-test-core
// @namespace    https://5e.tools/
// @license      MIT (https://opensource.org/licenses/MIT)
// @version      1.36.1.1jy-theoctonaut-test
// @homepageURL  https://github.com/TheOctonaut/betterR20/tree/theoctonaut-fix-requested-change
// @supportURL   https://github.com/TheOctonaut/betterR20/pull/2
// @updateURL    https://raw.githubusercontent.com/TheOctonaut/betterR20/theoctonaut-fix-requested-change/dist/betteR20-core.meta.js
// @downloadURL  https://raw.githubusercontent.com/TheOctonaut/betterR20/theoctonaut-fix-requested-change/dist/betteR20-core.user.js
// @description  Enhance your Roll20 experience
// @author       TheGiddyLimit/Redweller

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
