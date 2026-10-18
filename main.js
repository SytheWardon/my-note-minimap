'use strict';

const obsidian = require('obsidian');
const { Plugin, MarkdownView, PluginSettingTab, Setting, Platform, Notice, Modal, debounce, setIcon, requestUrl } = obsidian;

// Obsidian's own setting for the pull-down Quick Action (Settings > Mobile > Configure mobile Quick Action).
// Obsidian has no real "off": with nothing assigned, every pull-down shows an "Action not configured" prompt. So the
// action is set to this plugin's own command, which does nothing; Obsidian counts it as configured and stays quiet.
const QUICK_ACTION_KEY = 'mobilePullAction';
const QUICK_ACTION_OFF = 'my-note-minimap:pull-nothing';

// A source line counts as at least this many characters of a page, so blank and short lines still take their place.
const PAGE_MIN = 40;

// Where updates come from: the latest GitHub release of this repository (owner/name). The release carries main.js,
// manifest.json and styles.css, exactly what the release workflow publishes.
const UPDATE_REPO = 'SytheWardon/my-note-minimap';
const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000; // the automatic check runs at most once a day

// 1 if version a is newer than b, -1 if older, 0 if the same ("1.2.3" style, a leading "v" is ignored).
function cmpVer(a, b) {
	const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
	const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d > 0 ? 1 : -1;
	}
	return 0;
}

const DEFAULTS = {
	autoUpdate: false, // opt-in: look for a new version about once a day, when Obsidian starts (it only tells you; installing is a tap)
	lastUpdateCheck: 0,
	style: 'scrollbar', // 'scrollbar' or 'minimap'
	thumbWidth: null, // px, visible thumb. null = automatic: 14 on a typical phone, nudged a little up or down with screen size
	hitWidth: 64, // px, invisible touch area around the thumb
	thumbColor: '', // '' = theme accent colour
	thumbOpacity: 0.75,
	shape: 'pill', // 'pill', 'rounded' or 'square'
	showTrack: true,
	glow: false,
	// null = automatic: worked out for this device (see device()). A number is your own choice.
	insetTop: null, // px trimmed off the top of the scrollbar
	insetBottom: null, // px trimmed off the bottom of the scrollbar
	insetEdge: null, // px gap between the scrollbar and the screen edge
	touchEnabled: true, // false = the strip ignores touches (they reach the note)
	touchButton: true, // show an on/off button in the note header
	hideScrollbar: false, // long-press the header button to hide / show the whole strip
	showArrows: true,
	arrowSize: 52, // px height of each arrow button (also its touch zone)
	stepSize: 120, // px scrolled per arrow tap
	holdSpeed: 200, // px per second while an arrow is held; slow enough for the eye to follow the text as it moves
	smooth: true,
	holdGuard: true, // while an arrow is held, a sudden jump of the note that the text did not make with it is put back, not kept
	animateBars: true, // slide/fade the top header and bottom bar while scrolling (with the strip, and Obsidian's own hide-on-scroll)
	barsMs: 450, // length of that slide, in milliseconds
	pageBubble: true, // a small circle with the page number pops out of the bar while the note scrolls
	pageShows: 'page', // what the bubble says: 'page' (3 of 12) or 'percent'
	pageHapticsBy: 'bubble', // what the buzz counts: 'bubble' (whatever the bubble shows), 'page' or 'percent'
	arrowTap: 'heading', // what tapping an arrow does: 'step' (scroll Step per tap) or 'heading' (jump to the next or previous heading)
	pageHaptics: true, // phone or tablet: a light buzz when the page (or, in percent mode, the percent) changes (works with the bubble off too)
	pageLen: 1800, // how much text is one page, in characters (counted in the note's text, so no screen can change it)
	barsStyle: 'slide-fade', // 'slide-fade', 'slide' or 'fade'
	smoothMs: 340, // length of the glide animation
	diagnostics: false, // after letting go of an arrow, show how smoothly the screen kept up
	refreshRate: 0, // Hz of the screen. 0 = automatic (measured from the frame times); otherwise the scrolling is timed to it
	startPrep: true, // get notes and animations ready behind Obsidian's loading screen, so the first scroll is smooth
	refreshAsked: false, // the refresh-rate question is only asked once
	holdLite: true, // faster loading (open from memory, leave the hidden reading view for later, read ahead) and, while an arrow is held, no blur behind the header and bottom bar and the editor draws the next stretch early
	glowColor: '', // '' = same as thumb
	glowBlur: 8,
	glowSpread: 1,
	glowOpacity: 0.8,
	side: 'right',
	width: 12, // % of the note width
	top: 5, // % from the top of the note
	height: 60, // % of the note height
	hideOnMobile: false,
	fastRender: true, // faster minimap: painted on one canvas, and refreshed more gently while you type
	exclusions: [],
};

const DESKTOP_INSETS = { insetTop: 0, insetBottom: 0, insetEdge: 0 };
const LINE_H = 2; // px per bar
const GAP = 1; // px between bars
const MAX_ROWS = 3000; // very long notes are sampled
const ROW = LINE_H + GAP; // px from one bar to the next

// Fast rendering draws the minimap on one canvas, so the bar colours live here instead of in CSS.
// [colour, opacity]; a null colour means the theme's normal text colour.
const MAP_STYLE = {
	'nm-text': [null, 0.35],
	'nm-h1': ['#e06c75', 1],
	'nm-h2': ['#d19a66', 1],
	'nm-h3': ['#e5c07b', 1],
	'nm-h4': ['#98c379', 1],
	'nm-h5': ['#56b6c2', 1],
	'nm-h6': ['#61afef', 1],
	'nm-code': ['#61afef', 0.55],
	'nm-quote': ['#c678dd', 0.6],
	'nm-list': ['#98c379', 0.6],
	'nm-hr': ['#d19a66', 0.7],
	'nm-em': ['#e5c07b', 0.6],
	'nm-frontmatter': ['#9aa5b1', 0.75],
};

const CAN_BUZZ = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const FENCE_RE = /^(```|~~~)/;
const HEADING_RE = /^#{1,6}\s/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const LIST_RE = /^([-*+]|\d+[.)])\s/;
const EM_RE = /\*\*[^*]+\*\*|==[^=]+==|(^|[^*])\*[^*\s][^*]*\*/;

// The class of one trimmed line that is not front matter or inside a code fence. The first
// character rules out most of the patterns, so a plain line costs a couple of comparisons
// instead of five regular expressions.
function classifyPlain(t) {
	if (t === '') return 'nm-blank';
	const c = t.charCodeAt(0);
	if (c === 35 && HEADING_RE.test(t)) {
		let n = 1;
		while (t.charCodeAt(n) === 35) n++;
		return 'nm-h' + n;
	}
	if ((c === 45 || c === 42 || c === 95) && HR_RE.test(t)) return 'nm-hr';
	if (c === 62) return 'nm-quote';
	if ((c === 45 || c === 42 || c === 43 || (c >= 48 && c <= 57)) && LIST_RE.test(t)) return 'nm-list';
	// Emphasis needs a '*' or '==' somewhere, so most lines never reach the regular expression.
	if ((t.indexOf('*') !== -1 || t.indexOf('==') !== -1) && EM_RE.test(t)) return 'nm-em';
	return 'nm-text';
}

// Turns note text into one descriptor per line (class + length + indent). Very long notes are
// sampled: only every `step`-th line is described, but every line is still scanned for the front
// matter / code fence state, so the result is exactly what describing every line and then picking
// every `step`-th one would give, at a fraction of the work.
function classify(text, maxRows) {
	const len = text.length;
	// Count the lines without creating them: only the sampled lines (and lines that can change the
	// front matter / fence state) are ever sliced out of the text.
	let total = 1;
	for (let p = text.indexOf('\n'); p !== -1; p = text.indexOf('\n', p + 1)) total++;
	const step = maxRows ? Math.max(1, Math.ceil(total / maxRows)) : 1;
	const out = [];
	let firstEnd = text.indexOf('\n');
	if (firstEnd === -1) firstEnd = len;
	let inFront = text.slice(0, firstEnd).trim() === '---';
	let fence = null;
	let pos = 0;

	for (let n = 0; n < total; n++) {
		let end = text.indexOf('\n', pos);
		if (end === -1) end = len;
		const keep = n % step === 0;

		// A line that is not sampled only matters if it can change the front matter / fence state. With no
		// such state open, that means it has to open a fence: its first real character is a backtick or
		// tilde. Most lines start with some other plain ASCII character and are skipped without being
		// sliced out. Anything unusual (control or non-ASCII leading characters) takes the normal path.
		if (!keep && !inFront && fence === null) {
			let i = pos;
			let c = text.charCodeAt(i);
			while (i < end && (c === 32 || c === 9)) c = text.charCodeAt(++i);
			if (i >= end || (c > 32 && c < 127 && c !== 96 && c !== 126)) {
				pos = end + 1;
				continue;
			}
		}

		const raw = text.slice(pos, end);
		pos = end + 1;
		const t = raw.trim();
		let cls;

		if (inFront) {
			cls = 'nm-frontmatter';
			if (n > 0 && (t === '---' || t === '...')) inFront = false;
		} else if (fence) {
			cls = 'nm-code';
			if (t.startsWith(fence)) fence = null;
		} else if ((t.charCodeAt(0) === 96 || t.charCodeAt(0) === 126) && FENCE_RE.test(t)) {
			fence = t.slice(0, 3);
			cls = 'nm-code';
		} else if (keep) {
			cls = classifyPlain(t);
		} else {
			continue; // not sampled, and it changes no state
		}

		if (keep) out.push({ cls, len: t.length, indent: raw.length - raw.trimStart().length });
	}
	return { items: out, step };
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Accepts #RGB, #RRGGBB (with or without #) and returns '#rrggbb', or null.
function normalizeHex(v) {
	let h = String(v).trim().replace(/^#/, '');
	if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
	return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
}

function hexToRgba(hex, a) {
	const n = parseInt(hex.slice(1), 16);
	return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
}

function hexToHsl(hex) {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d) {
		s = d / (1 - Math.abs(2 * l - 1));
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h, s, l };
}

function hslToHex(h, s, l) {
	h = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let rgb;
	if (h < 60) rgb = [c, x, 0];
	else if (h < 120) rgb = [x, c, 0];
	else if (h < 180) rgb = [0, c, x];
	else if (h < 240) rgb = [0, x, c];
	else if (h < 300) rgb = [x, 0, c];
	else rgb = [c, 0, x];
	return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

// Black or white, whichever reads better on top of this colour.
function readableOn(hex) {
	const n = parseInt(hex.slice(1), 16);
	const lin = (v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	};
	const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
	return lum > 0.4 ? '#000000' : '#ffffff';
}

// Turns whatever getComputedStyle returned (rgb(), rgba(), color(srgb ...)) into '#rrggbb', or null if
// it is missing / see-through.
function computedColorToHex(value) {
	if (!value) return null;
	let m = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
	let rgb = null;
	let alpha = 1;
	if (m) {
		rgb = [+m[1], +m[2], +m[3]];
		if (m[4] !== undefined) alpha = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
	} else if ((m = value.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/))) {
		rgb = [+m[1] * 255, +m[2] * 255, +m[3] * 255];
		if (m[4] !== undefined) alpha = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
	}
	if (!rgb || alpha < 0.5) return null;
	return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// Theme variables worth offering as quick picks. Anything a theme does not define is skipped, so this
// is safe to keep long. Themes that follow a wallpaper / system colour usually drive these.
const THEME_COLOURS = [
	['--interactive-accent', 'Accent'],
	['--interactive-accent-hover', 'Accent (hover)'],
	['--color-accent', 'Accent base'],
	['--color-accent-1', 'Accent 1'],
	['--color-accent-2', 'Accent 2'],
	['--text-accent', 'Text accent'],
	['--text-accent-hover', 'Text accent (hover)'],
	['--link-color', 'Link'],
	['--tag-color', 'Tag'],
	['--md-sys-color-primary', 'Primary'],
	['--md-sys-color-secondary', 'Secondary'],
	['--md-sys-color-tertiary', 'Tertiary'],
	['--md-sys-color-primary-container', 'Primary container'],
	['--md-sys-color-secondary-container', 'Secondary container'],
	['--md-sys-color-tertiary-container', 'Tertiary container'],
];

const PALETTE_COLOURS = [
	['--color-red', 'Red'],
	['--color-orange', 'Orange'],
	['--color-yellow', 'Yellow'],
	['--color-green', 'Green'],
	['--color-cyan', 'Cyan'],
	['--color-blue', 'Blue'],
	['--color-purple', 'Purple'],
	['--color-pink', 'Pink'],
];

// Reads the live theme and returns the groups of quick-pick swatches: [{ label, items: [{ hex, name }] }].
function collectSwatchGroups(hostEl) {
	const probe = hostEl.createSpan();
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
	const seen = new Set();
	const resolveVars = (list) => {
		const out = [];
		// What an undefined variable falls back to (the inherited text colour) is not a real swatch.
		probe.style.color = 'rgba(0, 0, 0, 0)';
		const inherited = computedColorToHex(getComputedStyle(hostEl).color);
		for (const [name, label] of list) {
			probe.style.color = 'var(' + name + ', rgba(0, 0, 0, 0))';
			const hex = computedColorToHex(getComputedStyle(probe).color);
			if (!hex || hex === inherited || seen.has(hex)) continue;
			seen.add(hex);
			out.push({ hex, name: label });
		}
		return out;
	};

	const groups = [];
	let theme = [];
	let palette = [];
	try {
		theme = resolveVars(THEME_COLOURS);
		const base = theme.length ? theme[0].hex : null;

		if (base) {
			const { h, s } = hexToHsl(base);
			const sat = Math.max(s, 0.35); // keep greys from producing a row of grey
			const shades = [];
			for (const l of [0.28, 0.4, 0.52, 0.64, 0.76, 0.88]) {
				const hex = hslToHex(h, sat, l);
				if (!seen.has(hex)) {
					seen.add(hex);
					shades.push({ hex, name: 'Shade ' + Math.round(l * 100) + '%' });
				}
			}
			const { l: baseL } = hexToHsl(base);
			const near = [];
			for (const dh of [-40, -20, 20, 40]) {
				const hex = hslToHex(h + dh, sat, Math.min(0.75, Math.max(0.35, baseL)));
				if (!seen.has(hex)) {
					seen.add(hex);
					near.push({ hex, name: 'Hue ' + (dh > 0 ? '+' : '') + dh });
				}
			}
			groups.push({ label: 'From your theme', items: theme });
			if (shades.length) groups.push({ label: 'Shades of your accent', items: shades });
			if (near.length) groups.push({ label: 'Nearby hues', items: near });
		} else if (theme.length) {
			groups.push({ label: 'From your theme', items: theme });
		}

		palette = resolveVars(PALETTE_COLOURS);
		if (palette.length) groups.push({ label: 'Palette', items: palette });
	} finally {
		probe.remove();
	}
	return groups;
}

// Builds an SVG element with its attributes and children in one go.
function svgEl(tag, attrs, kids) {
	const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const k in attrs) el.setAttribute(k, attrs[k]);
	if (kids) for (const c of kids) el.appendChild(c);
	return el;
}

// Sets inline styles with !important, so nothing in a theme can override them.
// Refresh rates screens really have. A measured frame time within 5% of one of these is treated as exactly that rate,
// so the physics step is the same on every frame instead of wobbling with the timestamps.
const STD_HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
function nearestHz(hz) {
	let best = 0;
	let bd = Infinity;
	for (const r of STD_HZ) {
		const d = Math.abs(hz - r) / r;
		if (d < bd) {
			bd = d;
			best = r;
		}
	}
	return bd < 0.05 ? best : 0;
}

function lockStyle(el, styles) {
	for (const k in styles) el.style.setProperty(k, styles[k], 'important');
}

class NoteMinimapPlugin extends Plugin {
	async onload() {
		const saved = (await this.loadData()) || {};
		this.settings = Object.assign({}, DEFAULTS, saved);
		// Own copy: the default array is shared, and adding an exclusion would otherwise change the default itself.
		this.settings.exclusions = Array.isArray(saved.exclusions) ? saved.exclusions.slice() : [];
		// v2 raised the default touch sizes; upgrade anyone still on the old defaults.
		if ((saved.ver || 1) < 2) {
			if (saved.hitWidth === 44) this.settings.hitWidth = DEFAULTS.hitWidth;
			if (saved.arrowSize === 24) this.settings.arrowSize = DEFAULTS.arrowSize;
		}
		// v3: a slightly longer, softer default glide.
		if ((saved.ver || 1) < 3 && saved.smoothMs === 280) this.settings.smoothMs = DEFAULTS.smoothMs;
		// v4: margins default to "automatic" (sized for each device). Untouched zeros become automatic;
		// anything you set yourself is kept.
		if ((saved.ver || 1) < 4) {
			for (const k of ['insetTop', 'insetBottom', 'insetEdge']) if (saved[k] === 0) this.settings[k] = null;
		}
		// v5: bar width defaults to "automatic" (14, scaled gently per device). The old fixed
		// defaults (18, or 14 saved as a number) become automatic; any other value you chose is kept.
		if ((saved.ver || 1) < 5 && (saved.thumbWidth === 18 || saved.thumbWidth === 14)) this.settings.thumbWidth = null;
		// v6: a gentler default hold speed. Every dropped frame (heavy maths, callouts) shows as a skip as
		// big as one frame of travel, so a slower hold hides them. The old default becomes the new one;
		// any other value you chose is kept.
		if ((saved.ver || 1) < 6 && saved.holdSpeed === 1200) this.settings.holdSpeed = DEFAULTS.holdSpeed;
		// v9: the hold speed is now one the eye can follow (about 8 degrees of view per second on a phone held at
		// reading distance). The old default of 800 px/s crossed a whole screen in a second, which blurs.
		if ((saved.ver || 1) < 9 && saved.holdSpeed === 800) this.settings.holdSpeed = DEFAULTS.holdSpeed;
		// v10: the two older hold helpers (draw ahead, lighter screen) are one setting (holdLite). It stays on if
		// either was on; the old key is dropped.
		if ((saved.ver || 1) < 10) this.settings.holdLite = saved.holdLite !== false || saved.predraw === true;
		// v11: the default hold speed is 200 px/s, a calmer pace still. The old default of 320 becomes the new one;
		// any other value you chose is kept.
		if ((saved.ver || 1) < 11 && saved.holdSpeed === 320) this.settings.holdSpeed = DEFAULTS.holdSpeed;
		delete this.settings.predraw;
		delete this.settings.pageIndicator; // removed feature: clear the leftover key
		delete this.settings.fullscreen; // removed feature: clear the leftover key
		delete this.settings.doubleTapHeading; // removed feature: clear the leftover key
		// The bubble's 'words' and 'heading' styles were removed: anyone on one of them gets the page number.
		if (this.settings.pageShows !== 'percent') this.settings.pageShows = 'page';
		if (!['bubble', 'page', 'percent'].includes(this.settings.pageHapticsBy)) this.settings.pageHapticsBy = 'bubble';
		if (this.settings.arrowTap !== 'heading') this.settings.arrowTap = 'step';
		// v12: the arrow buttons are taller (36 -> 52 px), so a single tap lands easily. The old default becomes the
		// new one; any other size you chose is kept.
		if ((saved.ver || 1) < 12 && saved.arrowSize === 36) this.settings.arrowSize = DEFAULTS.arrowSize;
		this.settings.ver = 12;
		this.states = new Map();
		this._unloaded = false;
		this._refreshQueued = false;
		this.saveDirty = false;
		this.saveSoon = debounce(() => this.flushSave(), 400, true);
		this.barsHidden = false;
		this.barsTimer = null;
		this.buttons = new Map(); // view -> header button

		this.addSettingTab(new MinimapSettingTab(this.app, this));

		// Several workspace events usually fire together for one action (opening a note, switching
		// pane). Run one refresh after they have all fired instead of one per event.
		const refresh = () => this.queueRefresh();
		// Typing only needs the minimap lines (or the thumb size) refreshed, not every setting re-applied.
		// Fast rendering waits a little longer after you stop typing, so a burst of edits costs one rebuild.
		const refreshSoonNormal = debounce(() => this.refreshContent(), 300, true);
		const refreshSoonFast = debounce(() => this.refreshContent(), 800, true);
		const refreshSoon = () => (this.settings.fastRender ? refreshSoonFast() : refreshSoonNormal());

		this.registerEvent(this.app.workspace.on('layout-change', refresh));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.setBars(false);
			refresh();
		}));
		this.registerEvent(this.app.workspace.on('file-open', () => {
			this.setBars(false);
			refresh();
			this.warmSoon();
		}));
		this.installLoadBoost();
		this.installStartPrep();
		// Only the note that was edited needs its minimap text re-read. The vault event covers changes
		// that do not come from typing (sync, another app, the same note open in a second pane).
		this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
			if (!this.needsEditRefresh()) return;
			this.markDirty(info);
			refreshSoon();
		}));
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (!this.needsEditRefresh()) return;
			if (this.markDirtyFile(file && file.path)) refreshSoon();
		}));
		// A theme or colour-scheme change: the canvas minimap has to pick up the new text colour.
		this.registerEvent(this.app.workspace.on('css-change', () => {
			this._mapText = null;
			for (const st of this.states.values()) st.mapDirty = true;
			this.queueRefresh();
		}));
		this.app.workspace.onLayoutReady(() => {
			refresh();
			this.warmSoon();
		});

		// Ask for the screen's refresh rate once, on a phone or tablet, as soon as the workspace is up.
		// Keep the pull-down Quick Action off, quietly, so the "configure" pop-up does not come back on a swipe down.
		this.addCommand({
			id: 'check-update',
			name: 'Check for updates',
			callback: async () => {
				const r = await this.checkForUpdate();
				if (r === 'available') new Notice('My Note Minimap [Scrollbar] ' + this._update.version + ' is available. Install it from the plugin settings.');
				else if (r === 'current') new Notice('My Note Minimap [Scrollbar] is up to date (' + this.manifest.version + ').');
				else if (r === 'error') new Notice('My Note Minimap [Scrollbar]: ' + (this._updMsg || 'could not check for updates.'));
			},
		});
		// Automatic check: a few seconds after start-up, at most once a day, and only a notice, never an install.
		this.app.workspace.onLayoutReady(() => {
			if (!this.settings.autoUpdate) return;
			if (Date.now() - (this.settings.lastUpdateCheck || 0) < UPDATE_EVERY_MS) return;
			this._updTimer = window.setTimeout(async () => {
				this._updTimer = null;
				if (this._unloaded || !this.settings.autoUpdate) return;
				if ((await this.checkForUpdate()) === 'available' && !this._unloaded) {
					new Notice('My Note Minimap [Scrollbar] ' + this._update.version + ' is available. Install it from the plugin settings.', 8000);
				}
			}, 8000);
		});
		this.addCommand({ id: 'pull-nothing', name: 'Do nothing (pull-down action)', callback: () => {} });
		this.app.workspace.onLayoutReady(() => this.keepQuickActionOff());
		this.blockPullDown();
		this.app.workspace.onLayoutReady(() => {
			this.prepBars();
			if (!Platform.isMobile || this.settings.refreshAsked) return;
			this._askTimer = window.setTimeout(() => {
				this._askTimer = null;
				if (!this._unloaded && !this.settings.refreshAsked) new RefreshRateModal(this.app, this, null, true).open();
			}, 250);
		});

		// Settings are written to disk shortly after the last change; make sure none is lost.
		this.registerDomEvent(document, 'visibilitychange', () => {
			if (document.visibilityState === 'hidden') this.flushSave();
			else this.keepQuickActionOff();
		});
		// Only a rotation (or a fold / unfold) changes the safe areas, so only that re-measures. Other
		// resizes, like dragging the window or the on-screen keyboard opening, are followed by each
		// strip's own ResizeObserver; re-measuring and re-styling everything for them just made typing
		// on a phone stutter.
		this._screenKey = this.screenKey();
		// A rotation makes Obsidian redraw the whole reading view at once; nothing may be held back from it.
		this.registerDomEvent(window, 'resize', () => {
			for (const st of this.states.values()) if (st.rgOn) this.ungateRender(st);
			this._pageQuiet = performance.now() + 700; // the note being laid out again is not a scroll
		});
		this.registerDomEvent(window, 'resize', debounce(() => {
			const key = this.screenKey();
			if (key === this._screenKey) return;
			this._screenKey = key;
			this._safe = null;
			this.refreshAll();
		}, 250, true));
	}

	// Whether an edit needs any work at all. The scrollbar style never reads the note's text, and its thumb
	// follows the note's height through a ResizeObserver, so typing costs it nothing here. (Switching style
	// clears the stored text, so a minimap built later always starts from the current note.) Only a note
	// where the observed content element could not be found still needs the light refresh.
	needsEditRefresh() {
		if (this.settings.style !== 'scrollbar') return true;
		for (const st of this.states.values()) if (!st.roContent) return true;
		return false;
	}

	screenKey() {
		const type = screen.orientation && screen.orientation.type;
		return (type || '') + '|' + (screen.width || 0) + 'x' + (screen.height || 0);
	}

	// The text of this note changed: its minimap has to be rebuilt. With no way to tell which note it
	// was (an embedded editor, say) every strip is marked.
	markDirty(info) {
		const st = info ? this.states.get(info) : null;
		if (st) return this.flagText(st);
		for (const s of this.states.values()) this.flagText(s);
	}

	flagText(st) {
		st.textDirty = true;
		st.pending = true;
	}

	markDirtyFile(path) {
		let hit = false;
		if (!path) return hit;
		for (const s of this.states.values()) {
			if (s.file && s.file.path === path) {
				this.flagText(s);
				hit = true;
			}
		}
		return hit;
	}

	// Workspace events, setting changes and resizes all land here: one refresh runs per tick,
	// however many of them fire together (a slider drag used to refresh on every pixel).
	queueRefresh() {
		if (this._refreshQueued) return;
		this._refreshQueued = true;
		queueMicrotask(() => {
			this._refreshQueued = false;
			if (!this._unloaded) this.refreshAll();
		});
	}

	// Setting changes wait for the next frame instead, so a slider dragged faster than the screen
	// refreshes still costs one restyle per frame, not one per input event.
	queueFrameRefresh() {
		if (this._refreshQueued || this._frameQueued) return;
		if (document.hidden) return this.queueRefresh(); // no frames are drawn while hidden
		this._frameQueued = true;
		requestAnimationFrame(() => {
			this._frameQueued = false;
			if (!this._unloaded) this.refreshAll();
		});
	}

	// ---- Per-device defaults -------------------------------------------------
	// Sized from the screen, tuned so a 411 x 868 phone gets top 88, bottom 60, edge 2:
	// room for the floating header above and the bottom bar below. Phones with notches or
	// rounded corners get at least their safe-area insets on top of that.

	readSafeInsets() {
		const out = { top: 0, bottom: 0, left: 0, right: 0 };
		try {
			const el = document.body.createDiv();
			el.style.cssText =
				'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
			const cs = getComputedStyle(el);
			out.top = parseFloat(cs.paddingTop) || 0;
			out.right = parseFloat(cs.paddingRight) || 0;
			out.bottom = parseFloat(cs.paddingBottom) || 0;
			out.left = parseFloat(cs.paddingLeft) || 0;
			el.remove();
		} catch (e) {
			/* keep zeros */
		}
		return out;
	}

	device() {
		if (!Platform.isMobile) return DESKTOP_INSETS;
		if (!this._safe) {
			this._safe = this.readSafeInsets();
			this._dev = null;
		}
		if (this._dev && this._devSide === this.settings.side) return this._dev;
		const even = (n) => Math.round(n / 2) * 2;
		const safe = this._safe;
		// The long side of the screen in CSS px, so it is the same in portrait and landscape.
		const long = Math.max(screen.width || 0, screen.height || 0);
		const H = long >= 480 ? long : 868;
		let top = even(Math.max(64, H * 0.1014));
		let bottom = even(Math.max(40, H * 0.0691));
		top = Math.max(top, even(safe.top + 60));
		bottom = Math.max(bottom, even(safe.bottom + 36));
		const sideInset = this.settings.side === 'left' ? safe.left : safe.right;
		this._devSide = this.settings.side;
		this._dev = { insetTop: top, insetBottom: bottom, insetEdge: Math.max(2, Math.ceil(sideInset)) };
		return this._dev;
	}

	// Visible bar width: your own value, or the automatic one. Automatic is 14 px, scaled by the
	// screen's long side relative to a 868 px phone and held to 0.85x - 1.2x (about 12 - 17 px),
	// so it adapts per device without ever getting thin or chunky. Desktop stays at 14.
	barWidth() {
		const v = this.settings.thumbWidth;
		if (typeof v === 'number') return v;
		if (!Platform.isMobile) return 14;
		const long = Math.max(screen.width || 0, screen.height || 0);
		const scale = long >= 480 ? Math.min(1.2, Math.max(0.85, long / 868)) : 1;
		return Math.round(14 * scale);
	}

	// Width of the touch column: your setting, but never narrower than the bar needs.
	touchWidth() {
		return Math.max(this.settings.hitWidth, this.barWidth() + 6);
	}

	// The margin actually in use: your own value, or this device's automatic one.
	inset(key) {
		const v = this.settings[key];
		return typeof v === 'number' ? v : this.device()[key];
	}

	// ---- Updates ----
	// Looks at the latest GitHub release. Returns 'available', 'current' or 'error' and leaves the details in
	// this._updState / this._update / this._updMsg for the settings page to show.
	async checkForUpdate() {
		if (this._updBusy) return this._updState;
		this._updBusy = true;
		this._updState = 'checking';
		this._updMsg = '';
		try {
			const res = await requestUrl({
				url: 'https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest',
				headers: { Accept: 'application/vnd.github+json' },
			});
			const rel = res.json || {};
			const latest = String(rel.tag_name || '').replace(/^v/, '');
			if (!/^\d+\.\d+\.\d+/.test(latest)) throw new Error('The latest release has no version number.');
			this.settings.lastUpdateCheck = Date.now();
			this.saveDirty = true;
			this.saveSoon();
			if (cmpVer(latest, this.manifest.version) > 0) {
				this._update = { version: latest, assets: Array.isArray(rel.assets) ? rel.assets : [] };
				this._updState = 'available';
			} else {
				this._update = null;
				this._updState = 'current';
			}
		} catch (e) {
			this._updState = 'error';
			this._updMsg = e && e.status === 404 ? 'No release was found on GitHub.' : 'Could not reach GitHub. Check your connection and try again.';
		}
		this._updBusy = false;
		return this._updState;
	}

	// Downloads the three release files, checks them, writes them over the installed ones and reloads the plugin.
	// Nothing is written unless all three downloaded and look right, so a failed download leaves the old version alone.
	async installUpdate() {
		const u = this._update;
		if (!u || this._updBusy) return;
		this._updBusy = true;
		this._updState = 'installing';
		this._updMsg = '';
		try {
			const get = async (name) => {
				const a = u.assets.find((x) => x.name === name);
				if (!a) throw new Error('The release is missing ' + name + '.');
				return (await requestUrl({ url: a.browser_download_url })).text;
			};
			const [js, manifestTxt, css] = await Promise.all([get('main.js'), get('manifest.json'), get('styles.css')]);
			let man;
			try {
				man = JSON.parse(manifestTxt);
			} catch (e) {
				throw new Error('The downloaded manifest is not valid.');
			}
			if (man.id !== this.manifest.id || man.version !== u.version) throw new Error('The release files do not match its version.');
			if (js.length < 1000 || !js.includes('NoteMinimapPlugin')) throw new Error('The downloaded main.js looks incomplete.');
			const ad = this.app.vault.adapter;
			const dir = this.manifest.dir;
			await ad.write(dir + '/styles.css', css);
			await ad.write(dir + '/manifest.json', manifestTxt);
			await ad.write(dir + '/main.js', js); // last, so the code only changes once everything else is in place
		} catch (e) {
			this._updBusy = false;
			this._updState = 'error';
			this._updMsg = (e && e.message) || 'The update failed.';
			return;
		}
		this._updBusy = false;
		this.flushSave();
		new Notice('My Note Minimap [Scrollbar] updated to ' + u.version + '. Reloading the plugin…');
		const plugins = this.app.plugins;
		const id = this.manifest.id;
		window.setTimeout(async () => {
			try {
				await plugins.disablePlugin(id);
				await plugins.enablePlugin(id);
			} catch (e) {
				new Notice('Updated. Restart Obsidian to finish.');
			}
		}, 400);
	}

	onunload() {
		this.removeStartHook();
		for (const st of this.states.values()) this.ungateRender(st, true);
		this.untimePlans();
		this._unloaded = true;
		this.uninstallLoadBoost();
		if (this._askTimer) clearTimeout(this._askTimer);
		if (this._updTimer) clearTimeout(this._updTimer);
		this.flushSave();
		this.clearToast();
		for (const view of Array.from(this.states.keys())) this.detach(view);
		this.clearButtons();
		this.releaseBars();
	}

	// ---- Top header / bottom bar: slide away going down, glide back going up ----
	// Obsidian hides these bars while you scroll. When the strip scrolls the note, we drive
	// the same thing ourselves and give it a proper transition, so it eases instead of popping.

	setBars(hidden) {
		if (this.barsTimer) {
			clearTimeout(this.barsTimer);
			this.barsTimer = null;
		}
		if (this.barsHidden === hidden) return;
		this.barsHidden = hidden;
		// The slide is a CSS transition (barsMs long, 0.45 s by default). Draw ahead can block the page for a long frame,
		// so it stays out of the way until the slide is over (see cruiseTick); a stalled frame in the middle of the
		// slide reads as a snap.
		this._barsMoveUntil = performance.now() + this.barsMs() + 70;
		document.body.toggleClass('nm-bars-hidden', hidden);
		if (this.settings.diagnostics) this.probeBars(hidden);
	}

	// Length of the bars' slide, kept inside sane limits.
	barsMs() {
		const v = Number(this.settings.barsMs);
		return Math.min(900, Math.max(120, isFinite(v) && v > 0 ? v : 450));
	}

	// Puts the chosen speed and style of the bars' slide on the body, where the stylesheet reads them.
	applyBarsLook() {
		const b = document.body;
		b.style.setProperty('--nm-bars-ms', this.barsMs() + 'ms');
		b.toggleClass('nm-bars-slide-only', this.settings.barsStyle === 'slide');
		b.toggleClass('nm-bars-fade-only', this.settings.barsStyle === 'fade');
	}

	// True while the bars are away or still moving.
	barsBusy() {
		return !!this.barsHidden || performance.now() < (this._barsMoveUntil || 0);
	}

	// Scroll diagnostics only: what the header really does in the moments after a slide starts. If something other than
	// this plugin hides or moves it (a theme, Obsidian itself), the numbers show it: a transform that is already at
	// its end after two frames, or an inline style / extra class on the header, means the slide never got to play.
	probeBars(hidden) {
		const hdr = document.querySelector('.workspace-leaf.mod-active .view-header') || document.querySelector('.view-header');
		if (!hdr) return;
		const probe = { hidden, t0: performance.now(), s: [], cls: hdr.className.replace(/\s+/g, ' ').trim(), style: hdr.getAttribute('style') || '' };
		this._barsProbe = probe;
		const read = () => {
			const c = getComputedStyle(hdr);
			const m = c.transform.match(/matrix\(([^)]+)\)/);
			probe.s.push(Math.round(performance.now() - probe.t0) + 'ms ' + (m ? Math.round(parseFloat(m[1].split(',')[5])) : 0) + 'px/' + c.opacity);
		};
		requestAnimationFrame(() => requestAnimationFrame(read));
		setTimeout(read, 120);
		setTimeout(read, 300);
	}

	// ---- Faster loading (the loading half of Settings > Faster loading and smoother holding) ----
	// How Obsidian opens a note (read from its app.js): the note view asks the vault to READ the file on every open,
	// which always goes out through the native bridge to the phone's storage, even when Obsidian already holds that
	// exact text in memory (the cachedRead copy it keeps for notes up to 64 KB, dropped the moment the file changes).
	// It then hands the text to BOTH the editor and the reading view, so a note opened in the editor also has its whole
	// reading view parsed and drawn, hidden, and again when you switch to it. Three changes here, all undone on unload:
	//   1. A note whose text is already in memory is opened from memory. Bigger notes (up to 1.5 MB) get a small copy
	//      of their own, checked against the file's time and size, and dropped on any change.
	//   2. While the editor is showing, the hidden reading view is not filled in. Obsidian fills it in itself when you
	//      switch to it (setMode always sets the text again), so nothing is lost.
	//   3. Soon after a note opens and the phone is idle, the notes it links to and your recent notes are read ahead into
	//      memory, and the editor draws the stretch just below the screen, so the first scroll does not stall.
	// If anything here misbehaves, it switches itself off for the session and Obsidian carries on as usual.
	installLoadBoost() {
		if (this._boost || !this.settings.holdLite || this._boostBad) return;
		const plugin = this;
		const vault = this.app.vault;
		const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
		const boost = {};
		this._bstat = this._bstat || { memory: 0, disk: 0, big: 0, deferred: 0, warmed: 0, drew: 0 };
		this._big = new Map(); // path -> { text, key } where key is the file's time and size when it was read
		this._guard = false;
		this._lastTouch = 0;
		this._warmId = 0;
		try {
			// 1. Open from memory.
			if (typeof vault.read === 'function' && typeof vault.cachedRead === 'function') {
				const origRead = vault.read;
				const origCached = vault.cachedRead;
				boost.ownRead = hasOwn(vault, 'read');
				boost.origRead = origRead;
				vault.read = function (file) {
					if (plugin._guard) {
						plugin._bstat.disk++; // cachedRead found nothing: a real read
						return origRead.call(this, file);
					}
					if (!plugin.boostFile(file)) return origRead.call(this, file);
					const kept = plugin.bigGet(file);
					if (kept !== null) {
						plugin._bstat.big++;
						return Promise.resolve(kept);
					}
					let p;
					plugin._guard = true; // cachedRead calls read() when it has nothing; let that one through
					const before = plugin._bstat.disk;
					try {
						p = origCached.call(this, file);
					} finally {
						plugin._guard = false;
					}
					if (plugin._bstat.disk === before) plugin._bstat.memory++;
					const size = file.stat.size;
					const small = plugin.app.vault.cacheLimit || 65536; // Obsidian keeps notes up to this size itself
					const key = plugin.statKey(file);
					return p.then((text) => {
						if (typeof text !== 'string') return text;
						if (size > small && size <= 1572864 && plugin.statKey(file) === key && !file.saving) plugin.bigPut(file, text, key);
						return text;
					});
				};
			}
			// 2. Leave the hidden reading view for later.
			const proto = MarkdownView && MarkdownView.prototype;
			if (proto && typeof proto.setViewData === 'function') {
				const origSet = proto.setViewData;
				boost.ownSet = hasOwn(proto, 'setViewData');
				boost.origSet = origSet;
				proto.setViewData = function (data, clear) {
					let undo = null;
					try {
						if (clear && !plugin._boostBad && plugin.settings.holdLite) {
							const pm = this.modes && this.modes.preview;
							if (pm && this.currentMode && this.currentMode !== pm && typeof pm.clear === 'function') {
								const own = hasOwn(pm, 'set');
								const prev = pm.set;
								pm.set = function (text, fresh) {
									if (fresh) this.clear(); // what the reading view does first; the text itself waits
									plugin._bstat.deferred++;
								};
								undo = () => {
									if (own) pm.set = prev;
									else delete pm.set;
								};
							}
						}
					} catch (e) {
						plugin._boostBad = true;
						undo = null;
					}
					try {
						return origSet.call(this, data, clear);
					} finally {
						if (undo) {
							try {
								undo();
							} catch (e) {
								plugin._boostBad = true;
							}
						}
					}
				};
			}
			this._boost = boost;
			// Any change to a note drops our own copy of it.
			const drop = (f, old) => {
				if (f && f.path) this._big.delete(f.path);
				if (typeof old === 'string') this._big.delete(old);
			};
			this._boostEvents = [
				vault.on('modify', drop),
				vault.on('delete', drop),
				vault.on('rename', drop),
			];
			for (const ref of this._boostEvents) this.registerEvent(ref);
			this._touchOn = () => {
				this._lastTouch = performance.now();
			};
			document.addEventListener('touchstart', this._touchOn, { passive: true, capture: true });
			document.addEventListener('wheel', this._touchOn, { passive: true, capture: true });
		} catch (err) {
			console.error('My Note Minimap [Scrollbar]: faster loading could not start', err);
			this._boost = boost;
			this._boostBad = true;
			this.uninstallLoadBoost();
		}
	}

	uninstallLoadBoost() {
		const boost = this._boost;
		this._boost = null;
		this._warmId = (this._warmId || 0) + 1;
		if (this._warmTimer) clearTimeout(this._warmTimer);
		if (this._warmEdTimer) clearTimeout(this._warmEdTimer);
		this._warmTimer = this._warmEdTimer = null;
		if (this._touchOn) {
			document.removeEventListener('touchstart', this._touchOn, { capture: true });
			document.removeEventListener('wheel', this._touchOn, { capture: true });
			this._touchOn = null;
		}
		if (this._boostEvents) {
			for (const ref of this._boostEvents) {
				try {
					this.app.vault.offref(ref);
				} catch (e) {}
			}
			this._boostEvents = null;
		}
		if (this._big) this._big.clear();
		if (!boost) return;
		try {
			if (boost.origRead) {
				if (boost.ownRead) this.app.vault.read = boost.origRead;
				else delete this.app.vault.read;
			}
			if (boost.origSet) {
				if (boost.ownSet) MarkdownView.prototype.setViewData = boost.origSet;
				else delete MarkdownView.prototype.setViewData;
			}
		} catch (e) {
			console.error('My Note Minimap [Scrollbar]: could not put loading back', e);
		}
	}

	// Which notes the faster loading may touch: ordinary notes that are not being written right now.
	boostFile(file) {
		return !this._boostBad && this.settings.holdLite && !!file && file.extension === 'md' && !file.saving && !!file.stat;
	}

	statKey(file) {
		const s = file.stat;
		return s ? s.mtime + ':' + s.ctime + ':' + s.size : '';
	}

	bigGet(file) {
		const e = this._big && this._big.get(file.path);
		if (!e) return null;
		if (e.key !== this.statKey(file) || file.saving) {
			this._big.delete(file.path);
			return null;
		}
		this._big.delete(file.path); // most recently used goes to the back
		this._big.set(file.path, e);
		return e.text;
	}

	bigPut(file, text, key) {
		if (!this._big) return;
		this._big.delete(file.path);
		this._big.set(file.path, { text, key });
		while (this._big.size > 3) this._big.delete(this._big.keys().next().value);
	}

	// A note just opened. Once the phone has been quiet for a moment: read ahead the notes it links to and your recent
	// ones, then let the editor draw the stretch just below the screen.
	warmSoon() {
		if (!this._boost || this._boostBad || this._unloaded) return;
		this._warmId++;
		if (this._warmTimer) clearTimeout(this._warmTimer);
		if (this._warmEdTimer) clearTimeout(this._warmEdTimer);
		const id = this._warmId;
		this._warmTimer = window.setTimeout(() => this.warmReads(id), 700);
		this._warmEdTimer = window.setTimeout(() => this.warmEditor(id, 0), 450);
	}

	warmQuiet(id) {
		return (
			id === this._warmId &&
			this._boost &&
			!this._boostBad &&
			!this._unloaded &&
			this.settings.holdLite &&
			!this._lite &&
			document.visibilityState !== 'hidden' &&
			performance.now() - this._lastTouch > 700
		);
	}

	warmReads(id) {
		this._warmTimer = null;
		if (!this.warmQuiet(id)) return;
		try {
			const app = this.app;
			const active = app.workspace.getActiveFile();
			if (!active) return;
			const paths = [];
			const links = app.metadataCache.resolvedLinks && app.metadataCache.resolvedLinks[active.path];
			if (links) paths.push(...Object.keys(links).sort((a, b) => links[b] - links[a]).slice(0, 6));
			const recent = app.workspace.getLastOpenFiles ? app.workspace.getLastOpenFiles() : [];
			for (const p of recent.slice(0, 5)) if (!paths.includes(p)) paths.push(p);
			const files = [];
			for (const p of paths) {
				const f = app.vault.getAbstractFileByPath(p);
				if (f && f !== active && f.extension === 'md' && f.stat && f.stat.size <= 1572864) files.push(f);
				if (files.length >= 8) break;
			}
			const next = () => {
				if (!this.warmQuiet(id)) return;
				const f = files.shift();
				if (!f) return;
				const again = () => {
					this._bstat.warmed++;
					this._warmTimer = window.setTimeout(next, 150);
				};
				try {
					app.vault.read(f).then(again, again); // goes through our read: kept in memory for the next open
				} catch (e) {
					again();
				}
			};
			next();
		} catch (err) {
			this._boostBad = true;
			console.error('My Note Minimap [Scrollbar]: read-ahead switched off', err);
		}
	}

	warmEditor(id, pass) {
		this._warmEdTimer = null;
		if (!this.warmQuiet(id)) return;
		try {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const st = view && this.states.get(view);
			const sc = st && st.scroller;
			if (st && st.boundMode === 'preview' && view) {
				this.prepPreview(view, 600);
				return;
			}
			if (!sc || !sc.isConnected || st.cmBad || st.boundMode === 'preview' || performance.now() < (this._barsMoveUntil || 0)) return;
			st.peekWait = 0;
			const y = sc.scrollTop;
			if (this.drawAhead(st, y, 1, sc.clientHeight)) {
				sc.scrollTop = y; // straight back, before anything is painted
				this._bstat.drew++;
				if (!st.cmBad && st.peekWait < 30 && pass < 2) {
					this._warmEdTimer = window.setTimeout(() => this.warmEditor(id, pass + 1), 220);
				}
			}
		} catch (err) {
			this._boostBad = true;
			console.error('My Note Minimap [Scrollbar]: editor draw-ahead switched off', err);
		}
	}

	// ---- Getting ready while Obsidian starts (Settings > Get ready while Obsidian starts) ----
	// How Obsidian starts (read from its app.js): it shows the last note you had open in a stand-in view on top of
	// everything (the loading screen), then loads the plugins, the vault, the cache and the workspace underneath, and
	// only when workspace.loadLayout() has finished does it take the stand-in away. The plugin's usual warm-ups
	// (onLayoutReady, a note opening) only start after that, so the first scroll or the first slide of the bars paid
	// for work that could have been done behind the loading screen. So: while loading, loadLayout is wrapped, and when
	// it finishes (the real notes are built, still hidden) we do that work first, with a hard time limit, and only then
	// let Obsidian take the loading screen away. Nothing here changes what is shown; it only moves work earlier.
	installStartPrep() {
		if (!this.settings.startPrep || this._prepHook || this._prepDone) return;
		const ws = this.app.workspace;
		if (ws.layoutReady === true) {
			// Switched on later: nothing is hidden behind a loading screen now, so prepare quietly in the background.
			this._prepTimer = window.setTimeout(() => {
				this._prepTimer = null;
				this.startPrep();
			}, 400);
			return;
		}
		if (typeof ws.loadLayout !== 'function') return;
		const plugin = this;
		const orig = ws.loadLayout;
		this._prepHook = { orig, own: Object.prototype.hasOwnProperty.call(ws, 'loadLayout') };
		ws.loadLayout = async function (...args) {
			let out;
			try {
				out = await orig.apply(this, args);
			} finally {
				plugin.removeStartHook();
			}
			try {
				if (Platform.isMobile) {
					// The loading screen is still up; wait (at most the time limit, plus a little) for the work.
					await Promise.race([plugin.startPrep(), new Promise((r) => window.setTimeout(r, 1200))]);
				} else {
					plugin.startPrep();
				}
			} catch (err) {
				console.error('My Note Minimap [Scrollbar]: start-up preparation failed', err);
			}
			return out;
		};
	}

	removeStartHook() {
		if (this._prepTimer) clearTimeout(this._prepTimer);
		this._prepTimer = null;
		const h = this._prepHook;
		if (!h) return;
		this._prepHook = null;
		try {
			if (h.own) this.app.workspace.loadLayout = h.orig;
			else delete this.app.workspace.loadLayout;
		} catch (e) {}
	}

	async startPrep() {
		if (this._prepDone || this._unloaded || !this.settings.startPrep) return;
		this._prepDone = true;
		const t0 = performance.now();
		const stat = (this._pstat = { ms: 0, math: false, code: false, reading: 0, editor: 0, frames: false });
		const budget = Platform.isMobile ? 900 : 600;
		const left = () => Math.max(0, budget - (performance.now() - t0));
		const within = (p, ms) =>
			Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => window.setTimeout(r, Math.max(0, ms)))]);
		try {
			// The header and bottom bar get their own graphics layers now, not on the first slide.
			this.prepBars();

			// Things Obsidian loads the first time a note needs them: maths and code colouring. Only if an open note
			// has some (a note's text is not known yet: assume it does), so a vault without them pays nothing.
			const open = this.app.workspace.getLeavesOfType('markdown').map((l) => l.view).filter((v) => v instanceof MarkdownView && v.file);
			const texts = open.map((v) => (typeof v.data === 'string' ? v.data : null));
			const anyMath = texts.some((t) => t === null || t.includes('$'));
			const anyCode = texts.some((t) => t === null || t.includes('```'));
			const libs = [];
			if (anyMath && typeof obsidian.loadMathJax === 'function' && typeof obsidian.renderMath === 'function') {
				libs.push(
					obsidian
						.loadMathJax()
						.then(() => {
							obsidian.renderMath('f(x)=\\frac{a+b}{c}', true); // builds the typesetter's tables
							return obsidian.finishRenderMath ? obsidian.finishRenderMath() : null;
						})
						.then(() => {
							stat.math = true;
						})
				);
			}
			if (anyCode && typeof obsidian.loadPrism === 'function') {
				libs.push(
					obsidian.loadPrism().then(() => {
						stat.code = true;
					})
				);
			}

			// The notes on screen: a reading view is rendered to the end and laid out; an editor draws the stretch below.
			const jobs = [];
			let seen = 0;
			for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
				const view = leaf.view;
				if (!(view instanceof MarkdownView) || !view.file || seen >= 2) continue;
				seen++;
				const mode = view.getMode ? view.getMode() : 'source';
				if (mode === 'preview') {
					jobs.push(this.prepPreview(view, Math.min(350, left())).then((ok) => (stat.reading += ok ? 1 : 0)));
				} else {
					stat.editor += this.prepEditor(view);
				}
			}
			await within(Promise.all(libs.concat(jobs)), left());

			// Let the page lay out and paint once with everything in place before the loading screen goes.
			const frame = () =>
				new Promise((r) => {
					window.requestAnimationFrame(() => r());
				});
			await within(frame().then(frame), Math.min(120, left()));
			stat.frames = true;
		} catch (err) {
			console.error('My Note Minimap [Scrollbar]: start-up preparation stopped', err);
		}
		stat.ms = Math.round(performance.now() - t0);
	}

	// Waits until the reading view has rendered every section (Obsidian does this in slices, which is what later
	// lands in the middle of a hold), then lays out the part around the screen once.
	prepPreview(view, ms) {
		const r = view && view.previewMode && view.previewMode.renderer;
		if (!r || typeof r.onRendered !== 'function') return Promise.resolve(false);
		// Obsidian only renders a reading view that is on screen; a hidden one never finishes, so do not wait for it.
		const pe = r.previewEl;
		if (!pe || !pe.offsetParent || !(pe.offsetWidth > 0)) return Promise.resolve(false);
		return new Promise((resolve) => {
			let done = false;
			const fin = (ok) => {
				if (done) return;
				done = true;
				try {
					if (ok && typeof r.updateVirtualDisplay === 'function') r.updateVirtualDisplay();
				} catch (e) {}
				resolve(ok);
			};
			const timer = window.setTimeout(() => fin(false), Math.max(50, ms));
			try {
				r.onRendered(() => {
					clearTimeout(timer);
					fin(true);
				});
			} catch (e) {
				clearTimeout(timer);
				fin(false);
			}
		});
	}

	// The editor draws the stretch just below the screen now (the same thing draw ahead does during a hold).
	prepEditor(view) {
		try {
			const sc = view.contentEl && view.contentEl.querySelector('.cm-scroller');
			if (!sc || !sc.isConnected || !(sc.clientHeight > 0)) return 0;
			const st = this.states.get(view) || { view, scroller: sc, peekWait: 0, boundMode: 'source' };
			if (st.cmBad) return 0;
			let n = 0;
			for (let pass = 0; pass < 3; pass++) {
				st.peekWait = 0;
				const y = sc.scrollTop;
				if (!this.drawAhead(st, y, 1, sc.clientHeight)) break;
				sc.scrollTop = y;
				n++;
				if (st.cmBad || st.peekWait >= 30) break;
			}
			return n;
		} catch (err) {
			return 0;
		}
	}

	// Reading view, while an arrow is held. Obsidian draws a reading view in slices: every pass renders at least ten
	// sections that are not drawn yet (always from the top of the note, whatever is on screen), measures them and
	// re-plans which sections are attached, and the next pass is queued for the very next frame. During a hold those
	// passes share every frame with the scroll; on a note with equations a pass can take 100 ms or more, which is the
	// late frame every 0.2 s seen in the diagnostics (213 passes in one 18 s hold). The passes are held back while
	// everything from one screen behind to three screens ahead is already drawn, and carried on when the hold ends
	// (or as soon as the hold reaches a part that is not drawn yet).
	gateRender(st) {
		if (st.rgOn || st.rgBad) return;
		const r = st.view && st.view.previewMode && st.view.previewMode.renderer;
		if (!r || typeof r.queueRender !== 'function' || !Array.isArray(r.sections)) {
			st.rgBad = true;
			return;
		}
		const orig = r.queueRender;
		const own = Object.prototype.hasOwnProperty.call(r, 'queueRender');
		const plugin = this;
		const secs = r.sections;
		r.queueRender = function (...args) {
			try {
				const g = st.rgOn;
				// Anything that is not the same hold on the same drawn note (a different note in this view, a rebuilt
				// section list after a rotation, the hold being over) is Obsidian's own business: lift the gate and let
				// the request through, so a note can never be left undrawn.
				if (!g || g.r !== r || g.secs !== r.sections || !st.hold || st.dead) {
					plugin.ungateRender(st, true);
				} else if (!plugin.renderNeeded(r)) {
					st.rgPending = true;
					if (st.diag) st.diag.rgN++;
					return;
				}
			} catch (err) {
				st.rgBad = true;
			}
			return orig.apply(this, args);
		};
		st.rgOn = { r, orig, own, secs };
	}

	ungateRender(st, quick) {
		const g = st.rgOn;
		if (g) {
			st.rgOn = null;
			st.rgR = g.r; // kept so the drawing that was held back can still be carried on afterwards
			try {
				if (g.own) g.r.queueRender = g.orig;
				else delete g.r.queueRender;
			} catch (e) {}
		}
		if (!st.rgPending) return;
		if (quick || this._unloaded) {
			st.rgPending = false;
			return;
		}
		if (st.rgFlush) return; // one carry-on is already waiting
		// Carry on drawing the rest of the note once the hold is over and the bars have had their moment.
		st.rgFlush = window.setTimeout(() => {
			st.rgFlush = 0;
			if (this._unloaded || st.dead) return;
			// Another hold began: the next time the gate is lifted it carries on (the flag stays set).
			if (st.rgOn || st.running || st.hold) return;
			st.rgPending = false;
			try {
				const r = st.rgR;
				if (r && typeof r.queueRender === 'function') r.queueRender();
			} catch (e) {}
		}, 300);
	}

	// True if any section from one screen behind to three screens ahead of the screen is not drawn yet.
	renderNeeded(r) {
		const pe = r.previewEl;
		if (!pe) return true;
		const secs = r.sections;
		const top = pe.scrollTop;
		const vh = pe.clientHeight || 800;
		const lo = top - vh;
		const hi = top + vh * 3;
		let sum = 0;
		let cnt = 0;
		for (let i = 0; i < secs.length; i++) {
			if (secs[i].height > 0) {
				sum += secs[i].height;
				cnt++;
			}
		}
		const avg = cnt ? sum / cnt : 100;
		let y = r.topSpace || 0;
		let seen = false; // at least one section is laid out
		for (let i = 0; i < secs.length; i++) {
			const sec = secs[i];
			if (!sec.shown) continue;
			seen = true;
			if (y > hi) break;
			const bottom = y + (sec.height > 0 ? sec.height : avg);
			if (bottom >= lo && !sec.rendered) return true;
			y = bottom;
		}
		// A note with no section laid out yet (just opened, or just rebuilt) has to be drawn: never hold that back.
		return !seen;
	}

	// Scroll diagnostics, reading view: times Obsidian's own re-plans and render passes during a hold, so the report
	// shows what the late frames are made of. The timers are taken off again on unload.
	timePlans(st) {
		const r = st.view && st.view.previewMode && st.view.previewMode.renderer;
		if (!r || st.vdWrap || typeof r.updateVirtualDisplay !== 'function' || typeof r.onRender !== 'function') return;
		const wrap = (name, n, ms, worst) => {
			const orig = r[name];
			const own = Object.prototype.hasOwnProperty.call(r, name);
			r[name] = function (...args) {
				const t = performance.now();
				try {
					return orig.apply(this, args);
				} finally {
					const d = st.diag;
					if (d) {
						const c = performance.now() - t;
						d[n]++;
						d[ms] += c;
						if (c > d[worst]) d[worst] = c;
					}
				}
			};
			return { name, orig, own };
		};
		st.vdWrap = {
			r,
			list: [wrap('updateVirtualDisplay', 'vdN', 'vdMs', 'vdWorst'), wrap('onRender', 'rnN', 'rnMs', 'rnWorst')],
		};
	}

	untimePlans() {
		for (const st of this.states.values()) {
			const w = st.vdWrap;
			if (!w) continue;
			st.vdWrap = null;
			for (const x of w.list) {
				try {
					if (x.own) w.r[x.name] = x.orig;
					else delete w.r[x.name];
				} catch (e) {}
			}
		}
	}

	loadLine() {
		const b = this._bstat;
		if (!this.settings.holdLite || !this._boost || !b) return '';
		const p = this._pstat;
		const start = p ? 'Start-up: ready in ' + p.ms + ' ms (maths ' + (p.math ? 'yes' : 'no') + ', code ' + (p.code ? 'yes' : 'no') + ', ' + p.reading + ' reading view, editor drew ' + p.editor + 'x)\n' : '';
		return start + 'Loading: ' + b.memory + ' from memory' + (b.big ? ', ' + b.big + ' long' : '') + ', ' + b.deferred + ' reading views left for later, ' + b.warmed + ' read ahead, editor drew ahead ' + b.drew + 'x' + (this._boostBad ? ' (switched off)' : '') + '\n';
	}

	// The "lighter screen" half of the hold setting (the other half is drawAhead). While an arrow is held, the whole
	// screen scrolls under the header and bottom bar. If a theme blurs what is behind them, the phone's graphics chip
	// has to redo that blur on every single frame. A class on the body switches the blur off until the note has
	// stopped moving.
	liteOn() {
		if (this._lite || !this.settings.holdLite) return;
		this._lite = true;
		document.body.addClass('nm-hold-lite');
	}

	// The blur comes back only once the bars have finished sliding. It used to come back the moment the note stopped,
	// which is exactly when the bars start to slide back in: two big blurred layers fading and moving over a page that
	// has to blur what is behind them on every frame, which showed as a stutter as the bars appeared. If the bars are
	// still away or moving, look again a little later (never while another hold is running).
	liteOff(force) {
		if (!this._lite) return;
		if (!force && this.settings.animateBars && this.barsBusy()) {
			if (!this._liteT) {
				this._liteT = setTimeout(() => {
					this._liteT = null;
					for (const st of this.states.values()) if (st.running || st.hold) return; // a new hold has the screen lightened again
					this.liteOff();
				}, 120);
			}
			return;
		}
		this._lite = false;
		document.body.removeClass('nm-hold-lite');
	}

	releaseBars() {
		if (this._liteT) clearTimeout(this._liteT);
		this._liteT = null;
		if (this._barsOffT) clearTimeout(this._barsOffT);
		this._barsOffT = null;
		this.liteOff(true);
		this.setBars(false);
		this._barsCls = false;
		const b = document.body;
		b.removeClass('nm-animate-bars');
		b.removeClass('nm-bars-slide-only');
		b.removeClass('nm-bars-fade-only');
		b.style.removeProperty('--nm-bars-ms');
	}

	// Puts the header and bottom bar on their own layers ahead of time. Doing it on the first frame of the
	// first scroll made that frame slow; doing it when the finger lands (before anything moves) does not.
	prepBars() {
		if (!this.settings.animateBars || this._barsCls) return;
		this._barsCls = true;
		this.applyBarsLook();
		document.body.addClass('nm-animate-bars');
	}

	// The setting was switched on or off, or its speed / style changed.
	refreshBarsSetting() {
		if (this.settings.animateBars) {
			if (this._barsCls) this.applyBarsLook();
			else this.prepBars();
			return;
		}
		// Off: let the bars slide back first, then drop the classes (dropping them mid-slide would make the bars jump).
		this.setBars(false);
		if (this._barsOffT) clearTimeout(this._barsOffT);
		this._barsOffT = setTimeout(() => {
			this._barsOffT = null;
			if (!this.settings.animateBars && !this._unloaded) this.releaseBars();
		}, this.barsMs() + 150);
	}

	// Called every frame the engine moves the note. Down hides, up (or the very top) shows.
		trackBars(st, pos) {
		if (!this.settings.animateBars) return;
		this.prepBars();
		const d = pos - st.barLast;
		st.barLast = pos;
		// The press restyles the strip, starts the arrow's animations (0.45 s) and ramps the speed up. Starting the
		// bars' slide in those same frames piles everything onto the start of the hold and shows as jitter, so the
		// bars wait until the hold is under way. This only changes WHEN the slide starts, not how it looks.
		if (st.hold && st.holdT < 0.5) {
			st.barAcc = 0;
			return;
		}
		if (d === 0) return;
		if ((d > 0) !== (st.barAcc > 0)) st.barAcc = 0; // direction changed
		st.barAcc += d;
		// Never reverse a slide that has only just begun: a small wobble in direction would start and cancel
		// transitions back to back, and every restart is a visible hitch. Reaching the top is exempt.
		const want = pos < 12 || st.barAcc < -14 ? false : st.barAcc > 36 ? true : null;
		if (want !== null && want !== this.barsHidden) {
			const t = performance.now();
			if (pos < 12 || !this._barsT || t - this._barsT > 280) {
				this._barsT = t;
				this.setBars(want);
			}
		}
		// Safety net: whatever stops the note, the bars always come back once movement ceases.
		if (this.barsHidden) {
			const t = performance.now();
			if (!this.barsArmedAt || t - this.barsArmedAt > 200) {
				this.barsArmedAt = t;
				this.armBars(1100);
			}
		}
	}

	armBars(ms) {
		if (!this.barsHidden) return;
		if (this.barsTimer) clearTimeout(this.barsTimer);
		this.barsTimer = setTimeout(() => {
			this.barsTimer = null;
			this.setBars(false);
		}, ms);
	}

	// When the note stops, bars that are still away come back after a short pause.
	settleBars() {
		if (!this.settings.animateBars) return;
		this.armBars(1100);
	}

	// ---- Header button: scrollbar touch on / off ----------------------------

	// A tiny message of our own instead of Obsidian's Notice: it always goes away by itself after a
	// moment (no swiping), and a new one replaces the old so quick toggles never pile up.
	toast(msg, ms) {
		this.clearToast();
		const el = document.body.createDiv({ cls: 'nm-toast', text: msg });
		this._toastEl = el;
		this._toastT = setTimeout(() => {
			this._toastT = null;
			el.addClass('nm-toast-out');
			this._toastT = setTimeout(() => {
				this._toastT = null;
				el.remove();
				if (this._toastEl === el) this._toastEl = null;
			}, 200);
		}, ms || 600);
	}

	clearToast() {
		if (this._toastT) clearTimeout(this._toastT);
		this._toastT = null;
		if (this._toastEl) this._toastEl.remove();
		this._toastEl = null;
	}

	async toggleTouch() {
		this.settings.touchEnabled = !this.settings.touchEnabled;
		await this.saveSettings();
		this.toast(this.settings.touchEnabled ? 'Scrollbar touch: on' : 'Scrollbar touch: off', 600);
	}

	async toggleHide() {
		this.settings.hideScrollbar = !this.settings.hideScrollbar;
		await this.saveSettings();
		this.toast(this.settings.hideScrollbar ? 'Scrollbar hidden' : 'Scrollbar shown', 600);
	}

	// Tap = touch on / off (the button's own click). Long press = hide / show the whole scrollbar.
	bindLongPress(btn) {
		let timer = null;
		let fired = false;
		const clear = () => {
			if (timer) clearTimeout(timer);
			timer = null;
		};
		btn.addEventListener('pointerdown', () => {
			fired = false;
			clear();
			timer = setTimeout(() => {
				timer = null;
				fired = true;
				this.toggleHide();
			}, 500);
		});
		for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, clear);
		// The release after a long press must not also count as a tap.
		btn.addEventListener(
			'click',
			(e) => {
				if (!fired) return;
				fired = false;
				e.preventDefault();
				e.stopImmediatePropagation();
			},
			true
		);
		btn.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	// Adds the small "eye with a slash" that pops into a round notch cut from the hand icon while
	// the scrollbar is hidden. Both parts are drawn and animated by CSS (see styles.css).
	decorateButton(btn) {
		btn.addClass('nm-hand-btn');
		const eye = document.createElement('span');
		eye.className = 'nm-eye';
		const svg = svgEl('svg', {
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2.6',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		});
		const shape = svgEl('g', { class: 'nm-eye-shape' }, [
			svgEl('path', { d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z' }),
			svgEl('circle', { cx: '12', cy: '12', r: '3' }),
		]);
		const slash = svgEl('line', { class: 'nm-eye-slash', x1: '3.5', y1: '3.5', x2: '20.5', y2: '20.5', pathLength: '1' });
		svg.append(shape, slash);
		eye.appendChild(svg);
		btn.appendChild(eye);
		this.addNotch(btn);
	}

	// Cuts a round notch from the hand icon with an SVG <mask>; CSS only animates its radius.
	addNotch(btn) {
		const icon = btn.querySelector('svg.svg-icon');
		if (!icon) return;
		const id = 'nm-notch-' + Math.random().toString(36).slice(2, 9);
		const mask = svgEl('mask', { id, maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: '24', height: '24' }, [
			svgEl('rect', { width: '24', height: '24', fill: '#fff' }),
			svgEl('circle', { class: 'nm-notch', cx: '19.2', cy: '19.2', fill: '#000' }),
		]);
		const defs = svgEl('defs', {}, [mask]);
		const g = svgEl('g', { mask: 'url(#' + id + ')' });
		while (icon.firstChild) g.appendChild(icon.firstChild);
		icon.appendChild(defs);
		icon.appendChild(g);
	}

	syncButtons(live) {
		if (!this.settings.touchButton) {
			this.clearButtons();
			return;
		}
		for (const view of live) {
			if (!this.buttons.has(view)) {
				const btn = view.addAction('hand', 'Scrollbar touch', () => this.toggleTouch());
				this.bindLongPress(btn);
				this.decorateButton(btn);
				this.buttons.set(view, btn);
			}
		}
		for (const [view, btn] of this.buttons) {
			if (!live.has(view)) {
				btn.remove();
				this.buttons.delete(view);
			}
		}
		this.refreshButtons();
	}

	// The button is highlighted while the touch area is on.
	refreshButtons() {
		const on = this.settings.touchEnabled;
		const k = on + '|' + this.settings.hideScrollbar;
		for (const btn of this.buttons.values()) {
			if (btn._nmOn === k) continue;
			btn._nmOn = k;
			btn.toggleClass('is-active', on);
			btn.toggleClass('nm-strip-off', !!this.settings.hideScrollbar);
			btn.setAttribute(
				'aria-label',
				(on ? 'Scrollbar touch: on (tap to turn off)' : 'Scrollbar touch: off (tap to turn on)') +
					(this.settings.hideScrollbar ? ', scrollbar hidden (long-press to show)' : ', long-press to hide the scrollbar')
			);
		}
	}

	clearButtons() {
		for (const btn of this.buttons.values()) btn.remove();
		this.buttons.clear();
	}

	// First run only, once the refresh-rate pop-up has closed: open Obsidian's own settings on the Mobile page and
	// turn the pull-down Quick Action off, so a pull from the top of the screen no longer opens a menu while the
	// strip and the bars are being used. Obsidian has no public call for this, so every step is guarded: if one is
	// missing in some version, that step is skipped and the plugin carries on.
	async quietQuickAction() {
		if (!Platform.isMobile || this._unloaded) return;
		const app = this.app;
		const setting = app.setting;
		try {
			if (setting && typeof setting.open === 'function') {
				setting.open();
				if (typeof setting.openTabById === 'function') setting.openTabById('mobile');
			}
		} catch (e) {
			// the settings page could not be opened; the value below is still set
		}
		// Give the page a moment to draw, so the change is seen being made.
		await new Promise((resolve) => window.setTimeout(resolve, 450));
		if (this._unloaded) return;
		try {
			if (app.vault && typeof app.vault.setConfig === 'function') app.vault.setConfig(QUICK_ACTION_KEY, QUICK_ACTION_OFF);
			// Draw the Mobile page again so it shows the new value.
			const tab = setting && setting.activeTab;
			if (tab && typeof tab.display === 'function') tab.display();
			new Notice('Pull-down Quick Action set to do nothing.');
		} catch (e) {
			// leave it as it was
		}
	}

	// Obsidian shows a label at the top of the screen while you pull down ("Configure pull action", or the name of the
	// assigned command) and, on letting go, an "Action not configured" bar. Nothing here can turn those off, so they
	// are hidden the moment they exist. To stay cheap, the page is only watched while a finger is down (plus a
	// moment after), and only small pieces of text are looked at.
	blockPullDown() {
		if (!Platform.isMobile) return;
		const RE = /Action not configured|Configure pull action|Do nothing \(pull-down action\)/;
		const hideIfPrompt = (n) => {
			if (n && n.nodeType === 3) n = n.parentElement; // text set on an existing label arrives as a text node
			if (!(n instanceof HTMLElement) || n.hasAttribute('data-nm-nopull') || n.closest('.note-minimap, .modal, .vertical-tab-content')) return false;
			if (n.childElementCount > 8) return false;
			const t = n.textContent;
			if (!t || t.length > 140 || !RE.test(t)) return false;
			// Hide the whole piece, not just the text node's parent: climb while the parent holds nothing more.
			let el = n;
			while (el.parentElement && el.parentElement !== document.body && el.parentElement.textContent.length <= t.length + 2) el = el.parentElement;
			el.setAttribute('data-nm-nopull', '');
			// Actually hide it (the attribute alone changes nothing). Inline and important, so Obsidian's own inline styles on the label can't win.
			el.style.setProperty('visibility', 'hidden', 'important');
			el.style.setProperty('opacity', '0', 'important');
			return true;
		};
		const scan = () => {
			const kids = document.body.children;
			for (let i = 0; i < kids.length; i++) {
				hideIfPrompt(kids[i]);
				const sub = kids[i].children;
				for (let j = 0; j < sub.length && j < 40; j++) hideIfPrompt(sub[j]);
			}
		};
		const mo = new MutationObserver((list) => {
			for (const r of list) {
				if (r.type === 'childList') r.addedNodes.forEach(hideIfPrompt);
				else if (r.type === 'characterData') hideIfPrompt(r.target.parentElement);
				else hideIfPrompt(r.target);
			}
		});
		let timer = null;
		const watch = () => {
			if (timer) clearTimeout(timer);
			timer = null;
			if (!this._pullWatching) {
				this._pullWatching = true;
				scan();
				mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
			}
		};
		const unwatch = () => {
			if (timer) clearTimeout(timer);
			timer = window.setTimeout(() => {
				timer = null;
				mo.disconnect();
				this._pullWatching = false;
			}, 1500);
		};
		this.registerDomEvent(window, 'touchstart', watch, { capture: true, passive: true });
		this.registerDomEvent(window, 'touchend', unwatch, { capture: true, passive: true });
		this.registerDomEvent(window, 'touchcancel', unwatch, { capture: true, passive: true });
		this.register(() => {
			mo.disconnect();
			if (timer) clearTimeout(timer);
		});
	}

	// After the first run, make sure Obsidian's pull-down Quick Action is still None (it can be reset by an update or a
	// sync). No settings page, no notice: just the value, and only when it differs.
	keepQuickActionOff() {
		if (!Platform.isMobile || this._unloaded || !this.settings.refreshAsked) return;
		try {
			const v = this.app.vault;
			if (v && typeof v.getConfig === 'function' && typeof v.setConfig === 'function' && v.getConfig(QUICK_ACTION_KEY) !== QUICK_ACTION_OFF) {
				v.setConfig(QUICK_ACTION_KEY, QUICK_ACTION_OFF);
			}
		} catch (e) {
			// leave it as it was
		}
	}

	async saveSettings() {
		if (this.settings.animateBars && this._barsCls) this.applyBarsLook(); // speed / style of the bars' slide (also after a reset)
		this.queueFrameRefresh();
		this.saveDirty = true;
		this.saveSoon();
	}

	flushSave() {
		if (!this.saveDirty) return;
		this.saveDirty = false;
		return this.saveData(this.settings);
	}

	// Light refresh used while typing: only what depends on the note's text or height.
	refreshContent() {
		for (const [view, st] of this.states) {
			// Only notes that actually changed. The rest keep their strip as it is.
			if (!st.pending) continue;
			if (this.settings.style === 'scrollbar') {
				// The thumb follows the note's height through the ResizeObserver on its content; this is
				// only a fallback for a note where that element could not be found.
				if (!st.roContent) this.updateViewport(st);
				st.pending = false;
			}
			// Fast rendering: a note in a background tab is rebuilt when it is shown again, not while
			// you type in another one. It stays marked, so it is rebuilt then.
			else if (this.settings.fastRender && view.containerEl.offsetParent === null) continue;
			else {
				st.pending = false;
				this.update(view);
			}
		}
	}

	isExcluded(path) {
		if (!this.settings.exclusions.length) return false;
		return this.settings.exclusions.some((ex) => {
			const e = ex.replace(/\/+$/, '');
			return path === e || path.startsWith(e + '/');
		});
	}

	refreshAll() {
		this._key = this.styleKey();
		const live = new Set();
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			live.add(view);
			this.update(view);
		}
		for (const view of this.states.keys()) {
			if (!live.has(view)) this.detach(view);
		}
		this.syncButtons(live);
	}

	update(view) {
		const file = view.file;
		const hidden =
			!file ||
			this.isExcluded(file.path) ||
			(Platform.isMobile && this.settings.hideOnMobile);

		let st = this.states.get(view);
		if (hidden) {
			if (st) this.detach(view);
			return;
		}
		if (!st) st = this.attach(view);
		this.render(view, st);
	}

	attach(view) {
		const host = view.contentEl;
		host.addClass('note-minimap-host');

		const el = host.createDiv({ cls: 'note-minimap' });
		el.style.touchAction = 'none';
		const linesEl = el.createDiv({ cls: 'note-minimap-lines' });
		const vpEl = el.createDiv({ cls: 'note-minimap-viewport' });
		el.createDiv({ cls: 'nm-arrow nm-arrow-up' });
		el.createDiv({ cls: 'nm-arrow nm-arrow-down' });

		const st = {
			view, // the note this strip belongs to (its editor is asked to draw ahead during a hold)
			host,
			el,
			linesEl,
			vpEl,
			scroller: null,
			onScroll: null,
			onUser: null,
			text: null,
			file: null, // the note this strip was last built for
			textDirty: true, // the note's text may have changed since the minimap was built
			pending: false, // an edit is waiting for the next light refresh
			lastVpTop: null,
			stripH: 0,
			stripTop: 0,
			vpH: 0,
			vpTop: 0,
			grab: 0,
			arrow: 0,
			trackH: 0,
			style: null,
			dragging: false,
			// scroll engine
			running: false,
			raf: 0,
			pos: 0,
			vel: 0,
			target: 0,
			omega: 16,
			lastT: 0,
			hold: 0, // -1 / 0 / 1 while an arrow is held down
			holdT: 0, // seconds since the arrow was pressed
			holdGoal: 0, // where a plain tap should end up
			cruise: false, // an arrow is held and the hold engine (not the spring) is moving the note
			cv: 0, // cruise speed, px per second, always >= 0 (the direction is st.hold)
			cv0: 0, // speed the cruise started from
			repeatTimer: null,
			repeat: null,
			lead: false, // thumb follows the finger instantly while dragging it
			lastWrite: null,
			roContent: null,
			rows: [],
			items: null, // classified lines, kept for the canvas minimap
			canvas: null,
			ctx: null,
			cvW: 0,
			cvDirty: true, // canvas needs resizing
			mapDirty: true, // canvas needs redrawing
			drawnTop: null,
			drawnH: 0,
			renderKey: null,
			boundMode: null,
			barLast: 0,
			barAcc: 0,
			pressT: 0,
			pressTimer: null,
			holdOn: false,
			vpQueued: false,
			dead: false,
			noScroll: null,
			rect: null, // the strip's box, cached while it is pressed
			rectT: 0,
			atTop: null,
			atBottom: null,
			ro: null,
		};

		st.onScroll = () => this.queueViewport(st);
		// If the finger or wheel scrolls the note itself, stop gliding and let it.
		// This fires for every wheel notch and every touch on the note, so when the engine is already idle it does
		// nothing but the (cheap) bars check, instead of cancelling timers and stripping classes each time.
		st.onUser = () => {
			if (st.running || st.hold || st.lead || st.holdOn || st.repeat || st.repeatTimer || st.pressTimer) this.engineStop(st);
			this.settleBars();
		};
		st.tick = (now) => this.tick(st, now);

		const sbMode = () => this.settings.style === 'scrollbar';

		// The scrollTop the note should have for a pointer position on the strip.
		// The strip's box is read once per press and then reused: a pointer event can arrive several times
		// per frame, and each fresh read right after the engine wrote scrollTop could force a layout. It is
		// dropped when the strip resizes, and re-read at most every 250 ms during a drag as a safety net.
		const rectOf = (fresh) => {
			const now = performance.now();
			if (fresh || !st.rect || now - st.rectT > 250) {
				st.rect = el.getBoundingClientRect();
				st.rectT = now;
			}
			return st.rect;
		};

		const targetFor = (e) => {
			const sc = st.scroller;
			const rect = rectOf(false);
			if (sbMode()) {
				const track = Math.max(1, st.trackH - st.vpH);
				const frac = clamp01((e.clientY - rect.top - st.arrow - st.grab) / track);
				return frac * Math.max(0, sc.scrollHeight - sc.clientHeight);
			}
			const frac = clamp01((e.clientY - rect.top - st.stripTop) / st.stripH);
			return frac * sc.scrollHeight - sc.clientHeight / 2;
		};

		// A long press on Android opens a context menu / text selection and cancels the
		// touch, which used to cut arrow-holding short. Block it on the strip.
		el.addEventListener('contextmenu', (e) => e.preventDefault());
		el.addEventListener('selectstart', (e) => e.preventDefault());

		el.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			this.ensureScroller(view, st);
			if (!st.scroller || !st.stripH) return;
			st.downId = e.pointerId;
			try {
				el.setPointerCapture(e.pointerId);
			} catch (err) {
				/* ignore */
			}

			const rect = rectOf(true);
			const y = e.clientY - rect.top;

			// Arrow buttons: tap to glide one step, hold to keep scrolling.
			if (sbMode() && this.settings.showArrows) {
				const dir = y < st.arrow ? -1 : y > rect.height - st.arrow ? 1 : 0;
				if (dir) {
					st.pressDir = dir;
					return this.startHold(st, dir);
				}
			}

			this.endHold(st);
			st.dragging = true;
			st.lastY = e.clientY;
			el.addClass('note-minimap-dragging');
			// Grabbing the thumb keeps it under the finger; tapping the track glides there.
			// The thumb can be thin on a long note, so a touch near it counts as a grab (at least 56 px tall in all),
			// and the thumb stays under the finger instead of the note jumping to that spot.
			const slop = sbMode() ? Math.max(8, (56 - st.vpH) / 2) : 0;
			const onThumb = y >= st.vpTop - slop && y <= st.vpTop + st.vpH + slop;
			st.grab = sbMode() ? (onThumb ? Math.max(0, Math.min(st.vpH, y - st.vpTop)) : st.vpH / 2) : 0;
			st.lead = sbMode() && onThumb;
			this.prepBars();
			this.glide(st, targetFor(e), onThumb ? this.dragOmega() : this.glideOmega());
			this.updateViewport(st);
		});

		el.addEventListener('pointermove', (e) => {
			if (st.dragging && st.scroller) {
				if (e.clientY === st.lastY) return;
				st.lastY = e.clientY;
				// glide() either moves the note and the thumb itself (smooth scrolling off) or starts the
				// engine, whose next frame redraws the thumb before the screen is painted, so redrawing it
				// here as well would only repeat the same style writes for every extra pointer event.
				this.glide(st, targetFor(e), this.dragOmega());
			}
		});

		const stop = (e) => {
			st.rect = null;
			st.pressDir = 0;
			st.dragging = false;
			el.removeClass('note-minimap-dragging');
			this.endHold(st, e && e.type);
			if (!st.running) st.lead = false; // otherwise cleared once the note settles
		};
		el.addEventListener('pointerup', stop);
		el.addEventListener('pointercancel', stop);
		// The browser can drop the capture while the finger is still down (the strip being restyled or re-attached,
		// say). That used to end the hold on the spot, so the note stopped dead under a finger that had not moved.
		// Take the capture back; if the pointer really is gone this throws and the hold ends as before.
		el.addEventListener('lostpointercapture', (e) => {
			if ((st.hold || st.dragging) && e.pointerId === st.downId) {
				try {
					el.setPointerCapture(e.pointerId);
					if (st.diag) st.diag.recaptured++;
					return;
				} catch (err) {
					/* the pointer is gone */
				}
			}
			stop(e);
		});

		el.addEventListener(
			'wheel',
			(e) => {
				this.ensureScroller(view, st);
				if (!st.scroller) return;
				e.preventDefault();
				// Lines / pages -> pixels, and cap a huge notch so one flick cannot teleport.
				const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? st.scroller.clientHeight : 1;
				this.nudge(st, Math.max(-600, Math.min(600, e.deltaY * unit)));
			},
			{ passive: false }
		);

		st.ro = new ResizeObserver((entries) => {
			st.mx = null;
			st.rect = null;
			// The canvas depends on the strip's size, not on how tall the note's text is. The note's content
			// changes height on almost every edit, so that alone must not trigger a redraw of the canvas.
			for (const en of entries) {
				if (en.target !== st.roContent) {
					st.cvDirty = true;
					break;
				}
			}
			if (!st.running) this.updateViewport(st); // while running, the next frame re-reads and redraws
		});
		st.ro.observe(host);

		this.states.set(view, st);
		return st;
	}

	detach(view) {
		const st = this.states.get(view);
		if (!st) return;
		st.dead = true;
		this.engineStop(st);
		if (st.pressTimer) clearTimeout(st.pressTimer);
		this.settleBars();
		this.unbind(st);
		if (st.ro) st.ro.disconnect();
		if (st.pageTimer) clearTimeout(st.pageTimer);
		if (st.pageFadeTimer) clearTimeout(st.pageFadeTimer);
		if (st.pageClearTimer) clearTimeout(st.pageClearTimer);
		if (st.pageEl) st.pageEl.remove();
		st.el.remove();
		st.host.removeClass('note-minimap-host', 'note-minimap-pad-left', 'note-minimap-pad-right');
		st.host.style.removeProperty('--nm-width');
		st.host.style.removeProperty('--nm-gutter');
		this.states.delete(view);
	}

	// ---- Scroll engine -------------------------------------------------------
	// One critically damped spring drives every movement (taps, arrows, wheel,
	// dragging). Retargeting keeps the current velocity, so quick repeated
	// inputs blend together instead of restarting and stuttering.

	// Layout reads (scrollHeight etc.) right after writing scrollTop force a synchronous layout.
	// While the engine runs we read them at most every ~150 ms and reuse them between frames.
	readMetrics(st, force) {
		const sc = st.scroller;
		const now = performance.now();
		if (force || !st.mx || now - st.mx.t > 120) {
			st.mx = {
				sh: Math.max(1, sc.scrollHeight),
				ch: sc.clientHeight,
				mapH: st.el.clientHeight,
				t: now,
			};
		}
		return st.mx;
	}

	glideOmega() {
		const ms = Math.max(80, this.settings.smoothMs);
		return Math.min(40, Math.max(5, 4.5 / (ms / 1000)));
	}

	dragOmega() {
		return Math.min(40, Math.max(24, this.glideOmega() * 2));
	}

	glide(st, target, omega) {
		const sc = st.scroller;
		if (!sc) return;
		if (st.cruise) this.cruiseToSpring(st); // something else wants the note: the hold gives way to the spring
		const mx0 = this.readMetrics(st, !st.running);
		const max = Math.max(0, mx0.sh - mx0.ch);
		st.target = Math.min(max, Math.max(0, target));
		st.omega = omega;

		if (!this.settings.smooth) {
			this.engineStop(st);
			sc.scrollTop = st.target;
			this.updateViewport(st);
			return;
		}
		if (!st.running) this.engineStart(st);
	}

	engineStart(st) {
		const sc = st.scroller;
		st.pos = sc.scrollTop;
		st.vel = 0;
		st.barLast = st.pos;
		st.barAcc = 0;
		st.dtN = 0;
		st.dtI = 0;
		st.running = true;
		st.lastWrite = st.pos;
		st.lastT = performance.now();
		st.raf = requestAnimationFrame(st.tick);
	}

	tick(st, now) {
		const sc = st.scroller;
		if (!sc) {
			st.running = false;
			this.ungateRender(st);
			return;
		}
		const rawDt = (now - st.lastT) / 1000;
		st.lastT = now;
		const dt = this.frameDt(st, rawDt);
		st.dtLast = dt;
		const t0 = st.diag ? performance.now() : 0;
		if (st.diag) {
			const ms = rawDt * 1000;
			st.diag.frames++;
			st.diag.sum += ms;
			if (st.period && ms > st.period * 1500) {
				st.diag.late++;
				// If the plugin's own last frame took more than half a refresh period, the delay is partly ours;
				// otherwise the time went to the note (editor drawing, maths) or to the screen itself.
				if (st.diag.prevWork > st.period * 500) st.diag.lateOurs++;
				else st.diag.lateOther++;
			}
			if (ms > st.diag.worst) st.diag.worst = ms;
		}

		if (st.cruise) return this.cruiseTick(st, rawDt, dt, t0);

		// CodeMirror re-measures line heights as new lines scroll into view and nudges scrollTop
		// to keep the text steady. If we then write our own stale position, the note visibly
		// jumps back. Notice any outside change and carry the spring along with it.
		//
		// Every one of these nudges has to be followed, however small. The ResizeObserver clears the
		// cached metrics right after each re-measure, which is exactly when a nudge happens, so the
		// metrics are read first (cheap: nothing has been written yet this frame) instead of trusting
		// a cache that is empty at the moment it matters. A nudge that was ignored because the cache
		// was empty and the nudge was under 1.5 px made the note jump back by that much, over and
		// over, while an arrow was held. That was the jitter.
		// Our own writes land on whole device pixels (below), so the browser hands back what we wrote
		// to within a thousandth of a pixel and anything beyond a fraction of a device pixel is
		// somebody else's move. Only right at the ends of the note, where the browser clamps to the
		// real end and a rounding difference could keep the engine awake, is the looser 1.5 px kept.
		let mx = this.readMetrics(st);
		if (st.lastWrite !== undefined && st.lastWrite !== null) {
			const drift = sc.scrollTop - st.lastWrite;
			const endMax = Math.max(0, mx.sh - mx.ch);
			const midNote = st.pos > 2 && st.pos < endMax - 2;
			const limit = midNote ? Math.max(0.1, 0.35 / (window.devicePixelRatio || 1)) : 1.5;
			if (Math.abs(drift) > limit) {
				st.pos += drift;
				st.target += drift;
				st.holdGoal += drift;
				st.barLast += drift;
				mx = this.readMetrics(st, true); // the note's height changed with it
				if (st.diag) {
					st.diag.nudges++;
					st.diag.nudgePx += Math.abs(drift);
				}
			}
		}
		const max = Math.max(0, mx.sh - mx.ch);

		// Arrow held down: after a short delay the target starts moving, easing up to
		// full speed. The spring is already moving from the first tap, so there is no
		// stop-and-start between the tap and the hold.
		if (st.hold) {
			st.holdT += dt;
			if (st.holdT > 0.35 && !st.holdOn) {
				st.holdOn = true;
				st.el.addClass('nm-holding');
			}
			const u = clamp01(st.holdT / 0.3);
			const ramp = u * u * (3 - 2 * u); // smoothstep: no sudden jolt as the hold ramps to full speed
			// The target starts moving at once, at a third of full speed, and the spring follows it. There is no
			// separate first push any more: that push followed by a slow ramp made two bumps in the speed right
			// after the press, which showed as a small stutter before the hold settled.
			const ease = 0.35 + 0.65 * ramp;
			// When every frame lasts exactly one refresh period, make each frame's travel a whole number of screen
			// pixels. A step like 35.4 px gets written as 35, 36, 35, 35, 36 and shows as a faint shimmer in the text;
			// 35 px every frame is perfectly even. The speed changes by less than half a pixel per frame (about 1%).
			const unit = st.unit || 1 / (window.devicePixelRatio || 1);
			let stepPx = this.settings.holdSpeed * dt;
			if (st.dtSteady) stepPx = Math.max(1, Math.round(stepPx / unit)) * unit;
			st.target = Math.min(max, Math.max(0, st.target + st.hold * stepPx * ease));
			const g = this.glideOmega();
			st.omega = g + (Math.min(40, Math.max(22, g * 1.4)) - g) * ramp;
		}

		// Exact step of a critically damped spring (stable at any frame time).
		const w = st.omega;
		const x0 = st.pos - st.target;
		const k = st.vel + w * x0;
		const e = Math.exp(-w * dt);
		st.pos = st.target + (x0 + k * dt) * e;
		st.vel = (st.vel - w * k * dt) * e;

		// Never run past the ends of the note.
		if (st.pos < 0) {
			st.pos = 0;
			st.vel = Math.max(0, st.vel);
		} else if (st.pos > max) {
			st.pos = max;
			st.vel = Math.min(0, st.vel);
		}

		const settled = Math.abs(st.pos - st.target) < 0.3 && Math.abs(st.vel) < 6;
		if (settled && !st.hold) {
			st.pos = st.target;
			st.vel = 0;
			st.running = false;
			st.raf = 0;
			st.lead = false;
			sc.scrollTop = st.pos;
			st.lastWrite = null;
			this.ungateRender(st);
			this.liteOff();
			this.updateViewport(st);
			this.trackBars(st, st.pos);
			this.settleBars();
			return;
		}

		// Write a whole number of device pixels. A fractional position gets rounded by the browser
		// anyway (and not always the same way), which makes the text shimmer and hides how far the
		// browser really moved. The thumb below still uses the exact position. The small +0.001 keeps
		// a browser that rounds down from landing one pixel short on a value like 1234.99999.
		const dpr = window.devicePixelRatio || 1;
		const unit = st.unit || 1 / dpr;
		const snapped = Math.round(st.pos / unit) * unit + 0.001 * unit;
		sc.scrollTop = snapped;
		// Remember what the browser actually kept, not what we asked for. Webviews differ in how they round
		// a scroll position (device pixels, whole pixels, down), and a different rounding must never look like
		// somebody else moving the note. Nothing has changed layout yet, so this read is cheap.
		st.lastWrite = sc.scrollTop;
		// Some webviews keep only whole CSS pixels of a scroll position. Then steps of a third of a pixel would
		// be rounded again by the browser, unevenly. Watch what comes back for a few frames and, if it is always
		// a whole number while what we asked for was not, use whole pixels as the grid from then on.
		if (!st.unitKnown && Math.abs(snapped - Math.round(snapped)) > 0.01) {
			st.uSeen = (st.uSeen || 0) + 1;
			if (Math.abs(st.lastWrite - Math.round(st.lastWrite)) < 0.01) st.uInt = (st.uInt || 0) + 1;
			if (st.uSeen >= 12) {
				st.unitKnown = true;
				if (dpr !== 1 && st.uInt / st.uSeen > 0.9) st.unit = 1;
			}
		}
		this.updateViewport(st, st.pos);
		this.trackBars(st, st.pos);
		if (st.diag) {
			const c = performance.now() - t0;
			st.diag.work += c;
			st.diag.prevWork = c;
			if (c > st.diag.workWorst) st.diag.workWorst = c;
		}
		st.raf = requestAnimationFrame(st.tick);
	}

	// ---- Holding an arrow: the cruise engine ---------------------------------
	// While an arrow is down the note is NOT chased by a spring any more. The old design moved a target and let
	// a spring follow it, and it re-read scrollTop after every write; any nudge from the editor (line heights
	// being re-measured) or any rounding by the webview was then folded back into the target, which showed as
	// jitter, and at worst cancelled a whole frame's travel so the note seemed to refuse to move.
	//
	// Now the engine owns one number, the position, and moves it by speed x real elapsed time:
	//  - the speed climbs from where it was to the hold speed along a smoothstep, so there is no jolt;
	//  - every frame reads first (scrollTop, heights) and writes once at the end, and never reads back what it
	//    just wrote, so the frame has no forced layout in the middle of it;
	//  - the editor is only "moving the note itself" if scrollTop is more than a full CSS pixel away from what
	//    we wrote (rounding by a webview is never that big); a clamp at the end of the note counts the same way,
	//    so a note whose height estimate grows as you scroll just keeps going;
	//  - on release the spring takes over with the speed we had, so the note coasts to a soft stop, and a tap
	//    still ends one full step further on.

	// Hold speed, nudged so one frame's travel is a whole number of device pixels: 35.4 px a frame written as
	// 35, 36, 35, 35, 36 shows as a faint shimmer; 35 every frame does not. At most about 3% off.
	cruiseSpeed(st) {
		const v = Math.max(50, this.settings.holdSpeed);
		if (!st.periodKnown || !st.period) return v;
		const unit = st.unit || 1 / (window.devicePixelRatio || 1);
		return (Math.max(1, Math.round((v * st.period) / unit)) * unit) / st.period;
	}

	// A "ruler" for the hold: where a line near the top of the screen sits in the note (its distance from the top of
	// the scrolled content, which only changes when the layout above it changes). It is the same line the editor
	// itself keeps steady when it re-measures (the one 8 px below the top), picked again as it scrolls off the top.
	// Reads only, no writes. readAnchor gives the ruler's place now (NaN when there is none: reading view, nothing
	// drawn near the top, an editor that does not offer what is needed) and how far below the top it is (st.ancRel);
	// pickAnchor chooses a fresh ruler line.
	readAnchor(st, obs) {
		st.ancRel = -1e9;
		const el = st.anc;
		if (!(this.settings.holdGuard || this.settings.holdLite)) return NaN;
		if (st.ancBad || st.cmBad || st.boundMode === 'preview' || !el || !el.isConnected) return NaN;
		try {
			const rel = el.getBoundingClientRect().top - st.scroller.getBoundingClientRect().top;
			st.ancRel = rel;
			return rel + obs;
		} catch (err) {
			st.ancBad = true;
			st.anc = null;
			return NaN;
		}
	}

	pickAnchor(st, obs, ch) {
		if (!(this.settings.holdGuard || this.settings.holdLite)) return NaN;
		if (st.ancBad || st.cmBad || st.boundMode === 'preview') return NaN;
		try {
			const cm = st.view && st.view.editor && st.view.editor.cm;
			if (!cm || typeof cm.lineBlockAtHeight !== 'function' || typeof cm.domAtPos !== 'function') {
				st.ancBad = true;
				return NaN;
			}
			const pad = cm.documentPadding ? cm.documentPadding.top : 0;
			const blk = cm.lineBlockAtHeight(Math.max(0, obs - pad) + 8);
			const at = cm.domAtPos(blk.from);
			let n = at && at.node;
			if (n && n.nodeType !== 1) n = n.parentElement;
			const line = n && n.closest ? n.closest('.cm-line') : null;
			if (!line) return NaN; // a block drawn by a widget (a table, say): the old ruler stays until there is a line
			const rel = line.getBoundingClientRect().top - st.scroller.getBoundingClientRect().top;
			if (!(rel > -3000 && rel < ch)) return NaN;
			st.anc = line;
			st.ancRel = rel;
			return rel + obs;
		} catch (err) {
			st.ancBad = true;
			st.anc = null;
			return NaN;
		}
	}

	cruiseTick(st, rawDt, steadyDt, t0) {
		const sc = st.scroller;
		const dpr = window.devicePixelRatio || 1;
		const unit = st.unit || 1 / dpr;

		// ---- reads, all before the write ----
		const obs = sc.scrollTop;
		const sh = Math.max(1, sc.scrollHeight);
		const ch = sc.clientHeight;
		// The metrics object is updated in place: a new one every frame is garbage the phone has to collect mid-hold.
		const mxNow = performance.now();
		let m = st.mx;
		if (m) {
			m.sh = sh;
			m.ch = ch;
			m.t = mxNow;
		} else {
			m = st.mx = { sh, ch, mapH: st.el.clientHeight, t: mxNow };
		}
		const max = Math.max(0, sh - ch);
		// Where a line near the top of the screen sits in the note, to tell a real layout shift from a stray nudge.
		const ya = this.readAnchor(st, obs);
		if (st.diag) {
			// How long the reads took: if the page's layout was out of date, the first read pays for all of it.
			const r = performance.now() - t0;
			if (r > st.diag.readWorst) {
				st.diag.readWorst = r;
				st.diag.readAt = st.holdT;
			}
		}

		// Did the webview keep what we asked for to the whole CSS pixel? If so, step on whole pixels from here on.
		if (st.lastWrite !== null && !st.unitKnown && Math.abs(st.lastWrite - Math.round(st.lastWrite)) > 0.01) {
			st.uSeen = (st.uSeen || 0) + 1;
			if (Math.abs(obs - Math.round(obs)) < 0.01) st.uInt = (st.uInt || 0) + 1;
			if (st.uSeen >= 12) {
				st.unitKnown = true;
				if (dpr !== 1 && st.uInt / st.uSeen > 0.9) st.unit = 1;
			}
		}

		// ---- somebody else moved the note (or the end clamped our write): follow what is real, never fight it ----
		// The editor re-measures lines as they are drawn and moves the scroll position to keep the text steady, and
		// that is a move to follow. But a move that the text did not make with it (the scroll position went back
		// while the lines above stayed where they were) is a visible jump, and following it keeps the jump. With a
		// line near the top of the screen as a ruler we can tell the two apart: how far that line moved in the note
		// (l) is how far the note really shifted. If the scroll position moved by the same, follow it as before. If
		// not, go by the ruler: a stray nudge is dropped (our own write puts the note back where it was going), and
		// a shift the editor did not make up for is made up for here. Without a ruler (reading view, nothing drawn
		// near the top) it is the old behaviour.
		let l = NaN;
		if (ya === ya && st.ancY !== null) {
			l = ya - st.ancY;
			if (Math.abs(l) < 0.6) l = 0;
			else if (Math.abs(l) > 600) l = NaN; // not a shift of the lines: the ruler itself changed
		}
		// A fresh ruler line once the old one has scrolled off the top (or is gone). Picked now, before anything is
		// written, so what is read here is the layout the frame starts from.
		if (!(st.ancRel > -20)) {
			const yn = this.pickAnchor(st, obs, ch);
			st.ancY = yn === yn ? yn : ya === ya ? ya : null;
		} else {
			st.ancY = ya;
		}
		if (st.lastWrite !== null) {
			const d = obs - st.lastWrite;
			let move = d;
			if (l === l && Math.abs(d - l) > 1.5) {
				// The note moved by something other than what the lines did. Counted even when "Hold back jumps" is off.
				if (this.settings.holdGuard) move = l;
				if (st.diag) {
					st.diag.jumps++;
					st.diag.jumpPx += Math.abs(d - l);
				}
			}
			if (Math.abs(move) > 1) {
				st.pos += move;
				st.holdGoal += move;
				st.barLast += move;
				if (st.diag) {
					st.diag.nudges++;
					st.diag.nudgePx += Math.abs(move);
				}
			}
		}

		// ---- time: the frame length when frames are even, otherwise what really elapsed ----
		// A hitch (the editor drawing new lines, say) must not turn into a leap: the frame after it would move the note
		// two or three frames' worth at once. At most 1.6 frames' worth is taken at a time, and the rest is paid back
		// over the next frames at up to 30% extra speed, so the hitch reads as a short slow-down that catches up.
		if (st.diag && st.periodKnown && rawDt > st.period * 1.4) {
			// Remember when (and where in the note) late frames happen, to see whether they repeat.
			const L = st.diag.lateAt;
			if (L.length < 300 && (!L.length || st.holdT - L[L.length - 1][0] > 0.1)) L.push([st.holdT, st.pos]);
		}
		const base = st.dtSteady ? steadyDt : Math.min(0.1, Math.max(0.001, rawDt));
		const per = st.periodKnown && st.period ? st.period : 1 / 60;
		let dt = Math.min(base, per * 1.6);
		st.debt = Math.min(0.2, (st.debt || 0) + base - dt);
		if (st.debt > 0 && base <= per * 1.05) {
			const pay = Math.min(st.debt, dt * 0.3);
			dt += pay;
			st.debt -= pay;
		}
		st.dtLast = dt;
		st.holdT += dt;
		if (st.holdT > 0.35 && !st.holdOn) {
			st.holdOn = true;
			st.el.addClass('nm-holding');
		}

		// ---- speed: smoothstep from the starting speed up to the hold speed ----
		const vmax = this.cruiseSpeed(st);
		const u = clamp01(st.holdT / 0.4);
		const ramp = u * u * (3 - 2 * u);
		const v0 = Math.min(st.cv0, vmax);
		const vPrev = st.cv;
		st.cv = v0 + (vmax - v0) * ramp;

		// ---- position: distance = average speed over the frame x time ----
		const dir = st.hold;
		let pos = st.pos + dir * 0.5 * (vPrev + st.cv) * dt;
		pos = Math.min(max, Math.max(0, pos));
		st.pos = pos;

		// ---- the one write ----
		let snapped = Math.round(pos / unit) * unit + 0.001 * unit;
		st.peekComp = 0;
		// Draw ahead stays out of the way of the header / bottom bar. It waits for the press-in animations (0.5 s), and
		// while the bars are animating it does nothing: not before the slide (going down, the bars have not left yet, so
		// the peek would land on the very frame the slide starts), not during it, and not just after it.
		const barsQuiet = !this.settings.animateBars || (this.barsHidden === dir > 0 && mxNow >= (this._barsMoveUntil || 0) + 150);
		const peeked = this.settings.holdLite && st.holdT > 0.5 && barsQuiet && this.drawAhead(st, snapped, dir, ch);
		if (peeked && Math.abs(st.peekComp) > 1) {
			// While the editor drew ahead it shifted the note to keep what is on screen steady (line heights changed).
			// Carry that over, so putting the position back does not undo it.
			pos += st.peekComp;
			st.pos = pos;
			st.holdGoal += st.peekComp;
			st.barLast += st.peekComp;
			snapped = Math.round(pos / unit) * unit + 0.001 * unit;
		}
		if (peeked || snapped !== st.lastWrite) sc.scrollTop = snapped;
		st.lastWrite = snapped;

		if (st.boundMode === 'preview') {
			if (st.diag) this.timePlans(st);
			// Held back only while a finger is on an arrow. A tap, or the glide to rest after letting go, draws normally.
			if (this.settings.holdLite && !this._boostBad && st.hold) this.gateRender(st);
			else this.ungateRender(st);
		}
		this.updateViewport(st, pos);
		this.trackBars(st, pos);
		if (st.diag) {
			const c = performance.now() - t0;
			st.diag.work += c;
			st.diag.prevWork = c;
			if (c > st.diag.workWorst) {
				st.diag.workWorst = c;
				st.diag.workAt = st.holdT;
			}
		}
		st.raf = requestAnimationFrame(st.tick);
	}

	// The "draw ahead" half of the hold setting (Settings > Faster loading and smoother holding; the other
	// half is liteOn). It switches itself off for the note if the editor misbehaves. The editor only draws the part of the note near the
	// screen, and when the screen gets close to the edge of what it has drawn it draws the next stretch in one go.
	// With heavy blocks (maths, callouts) that is a freeze of 100 ms or more every ~500 px. Here, shortly before
	// that would happen, the scroll position is moved just past the drawn edge for an instant and the editor is
	// told to measure, so it draws the next stretch now, in a frame we choose, and the position is put straight back
	// (before anything is painted). Whether this makes freezes shorter depends on the editor; the diagnostics
	// report what it did. Any surprise from the editor switches it off for the rest of the session.
	drawAhead(st, snapped, dir, ch) {
		if (st.cmBad || st.boundMode === 'preview') return false;
		if (st.peekWait > 0) {
			st.peekWait--;
			return false;
		}
		const sc = st.scroller;
		try {
			const cm = st.view && st.view.editor && st.view.editor.cm;
			if (!cm || typeof cm.measure !== 'function' || !cm.viewport || typeof cm.lineBlockAt !== 'function') {
				st.cmBad = true;
				return false;
			}
			const pad = cm.documentPadding ? cm.documentPadding.top : 0;
			const vp = cm.viewport;
			const blk = cm.lineBlockAt(dir > 0 ? vp.to : vp.from);
			const edge = (dir > 0 ? blk.bottom : blk.top) + pad;
			const seen = dir > 0 ? snapped + ch : snapped;
			const ahead = dir > 0 ? edge - seen : seen - edge;
			st.peekWait = 5; // looking is cheap, but not every frame
			if (!(ahead < 700)) return false;
			const t = performance.now();
			const from = dir > 0 ? vp.to : vp.from;
			sc.scrollTop = snapped + dir * Math.max(40, Math.min(420, ahead + 30));
			const set = sc.scrollTop;
			cm.measure();
			// How far the note shifted under us while the editor drew. The editor keeps the line at the top of the
			// PEEKED position steady, and that line is not the one at the top of the real screen: a block on screen
			// that changed height counted in full and moved the real screen by that much when the position was put
			// back. So measure the shift of the ruler line at the top of the real screen instead (and fall back to
			// the editor's own correction if there is no ruler).
			let comp = sc.scrollTop - set;
			const el = st.anc;
			if (el && el.isConnected && st.ancY !== null) {
				const y2 = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
				if (y2 === y2) {
					comp = Math.abs(y2 - st.ancY) < 0.6 ? 0 : y2 - st.ancY;
					st.ancY = y2;
				}
			} else {
				st.ancY = null; // the ruler went with the redraw: pick another next frame
			}
			st.peekComp = comp;
			const redrew = (dir > 0 ? cm.viewport.to : cm.viewport.from) !== from;
			if (!redrew) st.peekWait = 30; // the editor had nothing to draw; do not keep asking
			if (st.diag) {
				const c = performance.now() - t;
				st.diag.peeks++;
				if (redrew) st.diag.redrew++;
				st.diag.peekMs += c;
				if (c > st.diag.peekWorst) st.diag.peekWorst = c;
			}
			return true;
		} catch (err) {
			st.cmBad = true;
			return true; // the scroll position may have been moved: the caller writes the real one back
		}
	}

	// Hands the note from the hold engine to the spring, keeping its speed. The spring lands one full step from
	// where the press began (a tap), or a short coast further on if the hold was already faster than that.
	cruiseToSpring(st) {
		if (!st.cruise) return;
		const dir = st.hold;
		const v = st.cv * dir;
		const w = Math.min(12, Math.max(9, this.glideOmega()));
		const mx = st.mx || this.readMetrics(st, true);
		const max = Math.max(0, mx.sh - mx.ch);
		// A press that lasted half a second is a hold, not a tap: it stops where it carried the note, not at the heading.
		// (A slower tap used to count as a hold and moved the note only a few pixels.)
		const held = performance.now() - st.pressT > 500;
		const goal = st.headTap && held ? st.pos : Math.min(max, Math.max(0, st.holdGoal));
		const coast = st.pos + v / w; // exactly the distance an exponential stop from speed v takes
		let target = dir > 0 ? Math.max(goal, coast) : Math.min(goal, coast);
		// A tap to a heading ends exactly on it, not past it.
		if (st.headTap && !held) target = dir > 0 ? Math.max(goal, st.pos) : Math.min(goal, st.pos);
		st.target = Math.min(max, Math.max(0, target));
		st.vel = v;
		st.omega = w;
		st.cruise = false;
		st.cv = 0;
		st.lastWrite = null; // the spring takes a fresh reading on its first frame
	}

	// Frame time for the physics, steadied. A screen shows frames at a fixed rate, but the timestamps we are
	// handed wobble by a millisecond or so; at 1200 px/s that is a pixel of wobble in the note. So a frame
	// that is (nearly) a whole number of refresh periods long counts as exactly that many. A frame that came
	// late is capped at a little over one period: moving two frames' worth in one go reads as a leap, while
	// moving one frame's worth reads as a brief slow-down.
	frameDt(st, raw) {
		// The last 15 frame times live in a fixed ring and are sorted in a scratch array with an insertion
		// sort, so a frame allocates nothing (this runs at the screen's refresh rate, up to 120+ times a second).
		let ring = st.dtRing;
		if (!ring) {
			ring = st.dtRing = new Float64Array(15);
			st.dtTmp = new Float64Array(15);
			st.dtN = 0;
			st.dtI = 0;
		}
		if (raw > 0) {
			ring[st.dtI] = raw;
			st.dtI = (st.dtI + 1) % 15;
			if (st.dtN < 15) st.dtN++;
		}
		let period = st.period || 1 / 60;
		let known = false;
		// The refresh rate you chose (0 = automatic). It is only trusted while the frames really arrive at that
		// rate, so a wrong choice can never make the scrolling run too fast or too slow.
		const rate = this.settings.refreshRate;
		const manual = rate > 0 ? 1 / rate : 0;
		if (st.dtN >= 6) {
			const n = st.dtN;
			const tmp = st.dtTmp;
			for (let i = 0; i < n; i++) {
				const v = ring[i];
				let j = i - 1;
				while (j >= 0 && tmp[j] > v) {
					tmp[j + 1] = tmp[j];
					j--;
				}
				tmp[j + 1] = v;
			}
			const med = tmp[n >> 1];
			if (med > 0.003 && med < 0.05) {
				if (manual && Math.abs(med / manual - 1) < 0.12) {
					st.period = manual;
				} else {
					// A frame time within 5% of a real refresh rate counts as exactly that rate. Once the period is
					// known it only moves when the screen has really changed rate (adaptive refresh switching between
					// 60 and 120 Hz), not for every millisecond of wobble in the median.
					const hz = nearestHz(1 / med);
					const want = hz ? 1 / hz : med;
					if (!st.periodKnown) st.period = want;
					else if (Math.abs(want - st.period) > st.period * 0.04) st.period += (want - st.period) * 0.35;
				}
				st.periodKnown = true;
				period = st.period;
				known = true;
			}
		} else if (st.periodKnown) {
			// A new press clears the ring, but the screen's refresh period has not changed. Keep using it, so the
			// first frames are steadied too instead of running on raw timestamps.
			period = st.period;
			known = true;
		} else if (manual && raw > 0 && Math.abs(raw / manual - 1) < 0.3) {
			// Very first frames of a view: start from the chosen rate rather than from raw timestamps.
			period = manual;
			known = true;
		}
		st.dtSteady = false;
		if (!(raw > 0)) return 0.001;
		if (!known) return Math.min(0.034, Math.max(0.001, raw));
		const ratio = raw / period;
		const n = Math.max(1, Math.round(ratio));
		const snap = Math.abs(ratio - n) < 0.3;
		let dt = snap ? n * period : raw;
		dt = Math.min(dt, period * 1.3, 0.05);
		st.dtSteady = snap;
		return Math.max(0.001, dt);
	}

	reportDiag(st) {
		const d = st.diag;
		st.diag = null;
		// A short tap says nothing, but a press that ended any other way than lifting the finger is exactly what to see.
		if (!d || (d.frames < 12 && (!d.why || d.why === 'pointerup' || d.why === 'restart'))) return;
		const ms = (n) => (Math.round(n * 10) / 10).toString();
		const msg =
			this.repeatLine(d.lateAt, ms) +
			(d.rnN || d.rgN ? 'Reading view render passes: ' + d.rnN + ', avg ' + ms(d.rnN ? d.rnMs / d.rnN : 0) + ' ms, worst ' + ms(d.rnWorst) + ' ms; held back: ' + d.rgN + '\n' : '') +
			(d.vdN ? 'Reading view re-plans: ' + d.vdN + ', avg ' + ms(d.vdMs / d.vdN) + ' ms, worst ' + ms(d.vdWorst) + ' ms\n' : '') +
			(this.settings.holdLite ? 'Draw ahead: ' + d.peeks + ' tries, editor drew on ' + d.redrew + ' (worst ' + ms(d.peekWorst) + ' ms)' + (st.cmBad ? ', then switched off' : '') + '\n' : '') +
			(this._barsProbe ? 'Bars ' + (this._barsProbe.hidden ? 'away' : 'back') + ' (header transform/opacity): ' + (this._barsProbe.s.join(', ') || 'no samples') + '\nHeader classes: ' + (this._barsProbe.cls || '-').slice(0, 80) + (this._barsProbe.style ? ' | inline: ' + this._barsProbe.style.slice(0, 80) : '') + '\n' : '') +
			this.loadLine() +
			'Ended by: ' + (d.why || '?') + ' after ' + ms(d.ms / 1000) + ' s' + (d.recaptured ? ' (touch re-grabbed ' + d.recaptured + 'x)' : '') + '\n' +
			'Hold: ' + d.frames + ' frames, avg ' + ms(d.sum / d.frames) + ' ms, worst ' + ms(d.worst) + ' ms\n' +
			'Late frames: ' + d.late + ' of ' + d.frames + (d.late ? ' (plugin ' + d.lateOurs + ', note or screen ' + d.lateOther + ')' : '') + '\n' +
			'Our work: ' + ms(d.work / d.frames) + ' ms per frame, worst ' + ms(d.workWorst) + ' ms at ' + ms(d.workAt) + ' s into the hold (reads ' + ms(d.readWorst) + ' ms at ' + ms(d.readAt) + ' s)\n' +
			'Nudges from the note: ' + d.nudges + (d.nudges ? ' (avg ' + ms(d.nudgePx / d.nudges) + ' px)' : '') + '\n' +
			(this.settings.holdGuard ? 'Jumps held back: ' : 'Jumps seen (not held back): ') + d.jumps + (d.jumps ? ' (avg ' + ms(d.jumpPx / d.jumps) + ' px)' : '') + (st.ancBad ? ' (no ruler line in this note)' : '') + '\n' +
			'Frame rate: ' + (st.period ? Math.round(1 / st.period) + ' Hz' : '?') + (this.settings.refreshRate ? ' (set to ' + this.settings.refreshRate + ' Hz)' : ' (automatic)') +
			', step grid: ' + (st.unit === 1 ? 'whole pixels' : 'device pixels');
		new Notice(msg, 9000);
	}

	// Do the late frames come at regular times (something running in the background) or at regular distances
	// (the editor drawing a new chunk of the note)? The steadier of the two is the likelier culprit.
	repeatLine(L, ms) {
		if (!L || L.length < 4) return '';
		const gt = [];
		const gp = [];
		for (let i = 1; i < L.length; i++) {
			gt.push(L[i][0] - L[i - 1][0]);
			gp.push(Math.abs(L[i][1] - L[i - 1][1]));
		}
		const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
		const spread = (a) => {
			const m = med(a);
			return m ? Math.round((med(a.map((x) => Math.abs(x - m))) / m) * 100) : 100;
		};
		return 'Late frames come every ' + ms(med(gt)) + ' s (+-' + spread(gt) + '%) or ' + Math.round(med(gp)) + ' px (+-' + spread(gp) + '%)\n';
	}

	engineStop(st) {
		this.liteOff();
		this.ungateRender(st);
		if (st.raf) cancelAnimationFrame(st.raf);
		st.raf = 0;
		st.running = false;
		st.lastWrite = null;
		st.vel = 0;
		st.hold = 0;
		st.cruise = false;
		st.cv = 0;
		st.lead = false;
		if (st.repeatTimer) clearTimeout(st.repeatTimer);
		if (st.repeat) clearInterval(st.repeat);
		st.repeatTimer = null;
		st.repeat = null;
		if (st.pressTimer) clearTimeout(st.pressTimer);
		st.pressTimer = null;
		st.holdOn = false;
		if (st.el) st.el.removeClass('nm-press-up', 'nm-press-down', 'nm-holding');
	}

	// Lets the pressed look finish: even a very quick tap shows the full press-and-release.
	releasePress(st) {
		if (!st.el) return;
		if (st.pressTimer) clearTimeout(st.pressTimer);
		const wait = Math.max(0, 260 - (performance.now() - st.pressT));
		const done = () => {
			st.pressTimer = null;
			st.holdOn = false;
			st.el.removeClass('nm-press-up', 'nm-press-down', 'nm-holding');
		};
		if (wait > 0) st.pressTimer = setTimeout(done, wait);
		else done();
	}

	// Where the next (dir 1) or previous (dir -1) heading sits, as a scroll position; null if there is none that way.
	// The headings come from Obsidian's own list for the note. In the reading view the section that holds the heading
	// says where it is; in the editor the line's block does.
	arrowHeading(st, dir) {
		try {
			const view = st.view;
			const sc = st.scroller;
			if (!view || !view.file || !sc) return null;
			const cache = this.app.metadataCache.getFileCache(view.file);
			const heads = cache && cache.headings;
			if (!heads || !heads.length) return null;
			const mode = st.boundMode === 'preview' ? 'preview' : 'source';
			const top = this.pageTopLine(st, view, mode, sc);
			const mx = st.mx || this.readMetrics(st, true);
			const max = Math.max(0, mx.sh - mx.ch);
			const here = st.running ? st.target : sc.scrollTop;
			// Walk the headings in the direction of the tap, starting just past the top of the screen (half a line of room,
			// so the heading you have just landed on is not picked again). The first one that is a real move away wins;
			// one that is too close, or that the note cannot be scrolled to, is skipped so a tap never does nothing.
			const list = dir > 0 ? heads.filter((h) => h.position.start.line > top + 0.5) : heads.filter((h) => h.position.start.line < top - 0.5).reverse();
			for (const h of list) {
				const y = this.headingY(view, mode, h.position.start.line);
				if (y === null) continue;
				const to = Math.min(max, Math.max(0, y - 6));
				if ((to - here) * dir >= 24) return to;
			}
			return null;
		} catch (err) {
			return null;
		}
	}

	// Scroll position of a heading's line: the reading view's section that holds it, or the editor's block for the line.
	headingY(view, mode, line) {
		if (mode === 'preview') {
			const r = view.previewMode && view.previewMode.renderer;
			const secs = r && r.sections;
			if (!Array.isArray(secs) || typeof r.getSectionTop !== 'function') return null;
			const sec = secs.find((x) => x.start && x.end && x.shown !== false && x.start.line <= line && x.end.line >= line);
			const y = sec ? r.getSectionTop(sec) : -1;
			return y >= 0 ? y : null;
		}
		const cm = view.editor && view.editor.cm;
		if (!cm || !cm.state || line + 1 > cm.state.doc.lines) return null;
		const pad = cm.documentPadding ? cm.documentPadding.top : 0;
		return cm.lineBlockAt(cm.state.doc.line(line + 1).from).top + pad;
	}

	// Scroll by a relative amount; repeated calls add up while a glide is running.
	nudge(st, delta) {
		const sc = st.scroller;
		if (!sc) return;
		const base = st.running ? st.target : sc.scrollTop;
		this.glide(st, base + delta, this.glideOmega());
	}

	startHold(st, dir) {
		this.endHold(st);
		const sc = st.scroller;
		if (!sc) return;
		const step = this.settings.stepSize * dir;
		// With Arrow tap set to a heading, a tap goes to the next or previous heading. A note with none that way
		// falls back to a plain step. Holding still scrolls (see cruiseToSpring).
		const headY = this.settings.arrowTap === 'heading' ? this.arrowHeading(st, dir) : null;
		st.headTap = headY !== null;
		st.diag = this.settings.diagnostics
			? { frames: 0, sum: 0, late: 0, lateOurs: 0, lateOther: 0, prevWork: 0, worst: 0, work: 0, workWorst: 0, nudges: 0, nudgePx: 0, jumps: 0, jumpPx: 0, recaptured: 0, why: '', ms: 0, readWorst: 0, readAt: 0, workAt: 0, lateAt: [], peeks: 0, redrew: 0, peekMs: 0, peekWorst: 0, vdN: 0, vdMs: 0, vdWorst: 0, rnN: 0, rnMs: 0, rnWorst: 0, rgN: 0 }
			: null;
		this._barsProbe = null; // the diagnostics line about the bars is per hold
		if (st.pressTimer) clearTimeout(st.pressTimer);
		st.pressTimer = null;
		st.pressT = performance.now();
		st.holdOn = false;
		st.peekWait = 0; // draw ahead may look from the first frame of every hold
		st.anc = null; // the ruler line is picked again at the first frame
		st.ancY = null;
		st.ancBad = false;
		st.ancRel = -1e9;
		if (st.el) {
			st.el.removeClass('nm-press-up', 'nm-press-down', 'nm-holding');
			st.el.addClass(dir < 0 ? 'nm-press-up' : 'nm-press-down');
		}

		if (!this.settings.smooth) {
			// No animation: step now, then repeat while the finger stays down.
			this.nudge(st, headY !== null ? headY - sc.scrollTop : step);
			st.repeatTimer = setTimeout(() => {
				st.repeat = setInterval(() => this.nudge(st, step * 0.4), 90);
			}, 350);
			return;
		}

		// The press starts moving at once (a small push, then a ramp up to cruise
		// speed). Releasing early finishes the full step, so a tap always moves
		// one step and a hold never stalls between the two.
		this.liteOn();
		this.prepBars();
		// Pick up from whatever the note is doing (a glide that is still settling, say) so nothing jerks.
		const moving = st.running;
		const base = moving ? st.pos : sc.scrollTop;
		const v0 = moving ? Math.max(0, st.vel * dir) : 0;
		const mx = this.readMetrics(st, true);
		if (!moving) this.engineStart(st);
		st.pos = base;
		st.holdGoal = headY !== null ? headY : (moving ? st.target : base) + step;
		st.hold = dir;
		st.holdT = 0;
		st.cv0 = v0;
		st.cv = v0;
		st.debt = 0;
		st.vel = 0;
		st.lastWrite = null;
		st.target = Math.min(Math.max(0, mx.sh - mx.ch), Math.max(0, base));
		st.cruise = true;
	}

	endHold(st, why) {
		if (st.diag) {
			st.diag.why = why || 'restart';
			st.diag.ms = performance.now() - st.pressT;
		}
		if (st.repeatTimer) clearTimeout(st.repeatTimer);
		if (st.repeat) clearInterval(st.repeat);
		st.repeatTimer = null;
		st.repeat = null;

		if (st.cruise) this.cruiseToSpring(st); // the spring then eases the note to a soft stop
		st.headTap = false;
		st.hold = 0;
		if (st.diag) this.reportDiag(st);
		this.releasePress(st);
	}

	unbind(st) {
		if (!st.scroller) return;
		if (st.ro) {
			st.ro.unobserve(st.scroller);
			if (st.roContent) st.ro.unobserve(st.roContent);
		}
		st.roContent = null;
		st.scroller.removeEventListener('scroll', st.onScroll);
		st.scroller.removeEventListener('touchstart', st.onUser);
		st.scroller.removeEventListener('wheel', st.onUser);
		st.scroller.style.scrollBehavior = st.prevBehavior || '';
		st.scroller = null;
	}

	findScroller(view) {
		const root = view.contentEl;
		if (view.getMode && view.getMode() === 'preview') {
			return root.querySelector('.markdown-preview-view');
		}
		return root.querySelector('.cm-scroller');
	}

	// Cheap check for hot paths (wheel): only look the scroller up again if the view changed mode
	// or the element went away.
	ensureScroller(view, st) {
		const mode = view.getMode ? view.getMode() : '';
		if (st.scroller && st.scroller.isConnected && st.boundMode === mode) return;
		this.bindScroller(view, st);
	}

	bindScroller(view, st) {
		st.boundMode = view.getMode ? view.getMode() : '';
		const sc = this.findScroller(view);
		if (sc === st.scroller) {
			if (sc && st.ro && !st.roContent) this.observeContent(st, sc);
			return;
		}
		this.engineStop(st);
		this.unbind(st);
		st.scroller = sc;
		if (sc) {
			// A theme with scroll-behavior: smooth would restart its own animation on every
			// frame we set scrollTop, which looks like stutter. Our spring does the easing.
			st.prevBehavior = sc.style.scrollBehavior;
			sc.style.scrollBehavior = 'auto';
			if (st.ro) {
				st.ro.observe(sc);
				this.observeContent(st, sc);
			}
			sc.addEventListener('scroll', st.onScroll, { passive: true });
			sc.addEventListener('touchstart', st.onUser, { passive: true });
			sc.addEventListener('wheel', st.onUser, { passive: true });
		}
	}

	// The note's own height changes as lines are measured or rendered; the scroller's box does not, so the
	// content element is watched too. It may not exist yet when the note is first bound; render() retries.
	observeContent(st, sc) {
		st.roContent = sc.querySelector('.cm-content, .markdown-preview-sizer');
		if (st.roContent) st.ro.observe(st.roContent);
	}

	// Everything that depends only on settings and device margins. Re-run only when one changes.
	styleKey() {
		const s = this.settings;
		return [
			s.style, s.side, s.touchEnabled, s.showArrows, s.hitWidth, this.barWidth(), s.arrowSize,
			s.thumbColor, s.thumbOpacity, s.shape, s.glow, s.glowColor, s.glowBlur, s.glowSpread,
			s.glowOpacity, s.showTrack, s.width, s.top, s.height, s.hideScrollbar, s.holdSpeed,
			this.inset('insetTop'), this.inset('insetBottom'), this.inset('insetEdge'),
		].join('|');
	}

	applyStyle(view, st) {
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		const left = s.side === 'left';

		st.el.toggleClass('nm-scrollbar', sb);
		st.el.toggleClass('nm-has-arrows', sb && s.showArrows && s.touchEnabled);
		st.el.toggleClass('nm-touch-off', !s.touchEnabled);
		st.el.toggleClass('nm-hidden', !!s.hideScrollbar);
		if (!s.touchEnabled || s.hideScrollbar) {
			this.engineStop(st);
			st.dragging = false;
			this.settleBars();
		}
		// The strip owns its own column: the note is padded away from it, so on a normal open
		// nothing overlaps the scrollbar area (zooming is the only case that may).
		// Hidden: give the note its full width back.
		st.host.toggleClass('note-minimap-pad-left', left && !s.hideScrollbar);
		st.host.toggleClass('note-minimap-pad-right', !left && !s.hideScrollbar);
		st.el.toggleClass('note-minimap-left', left);
		st.el.toggleClass('note-minimap-right', !left);

		if (sb) {
			// Bar width and touch area are independent settings that co-exist: the touch
			// column is never narrower than the bar (plus its edge gap and a little air).
			const hitW = this.touchWidth();
			const edgeGap = this.inset('insetEdge');
			st.host.style.removeProperty('--nm-width');
			st.host.style.setProperty('--nm-gutter', hitW + edgeGap + 'px');
			st.el.style.setProperty('--nm-width', hitW + 'px');
			st.el.style.setProperty('--nm-thumb', this.barWidth() + 'px');
			st.el.style.setProperty('--nm-glyph', Math.min(20, Math.max(10, this.barWidth())) + 'px');
			st.el.style.setProperty('--nm-arrow', s.arrowSize + 'px');
			st.el.style.setProperty('--nm-flow', Math.round(Math.min(800, Math.max(300, 480000 / Math.max(1, s.holdSpeed)))) + 'ms');
			st.el.style.setProperty('--nm-arrow-gap', (s.showArrows && s.touchEnabled ? s.arrowSize : 0) + 'px');
			const color = s.thumbColor || 'var(--text-accent)';
			const radius = { pill: '999px', rounded: '6px', square: '0px' }[s.shape] || '999px';
			st.el.style.setProperty('--nm-thumb-color', color);
			st.el.style.setProperty('--nm-thumb-opacity', String(s.thumbOpacity));
			st.el.style.setProperty('--nm-thumb-radius', radius);
			const glowBase = s.glowColor || s.thumbColor;
			const glowCss = glowBase
				? hexToRgba(glowBase, s.glowOpacity)
				: 'color-mix(in srgb, var(--text-accent) ' + Math.round(s.glowOpacity * 100) + '%, transparent)';
			st.el.style.setProperty(
				'--nm-thumb-shadow',
				s.glow ? '0 0 ' + s.glowBlur + 'px ' + s.glowSpread + 'px ' + glowCss : 'none'
			);
			st.el.style.setProperty(
				'--nm-thumb-shadow-active',
				s.glow ? '0 0 ' + s.glowBlur * 1.5 + 'px ' + (s.glowSpread + 1) + 'px ' + glowCss : 'none'
			);
			st.el.style.setProperty('--nm-track-opacity', s.showTrack ? '0.5' : '0');
			const iTop = this.inset('insetTop');
			const iBottom = this.inset('insetBottom');
			st.el.style.setProperty('--nm-top', iTop + 'px');
			st.el.style.setProperty('--nm-height', 'calc(100% - ' + (iTop + iBottom) + 'px)');
			st.el.style.setProperty('--nm-edge', this.inset('insetEdge') + 'px');
		} else {
			st.host.style.removeProperty('--nm-gutter');
			st.vpEl.style.removeProperty('transform');
			st.vpEl.style.removeProperty('top');
			st.vpEl.style.removeProperty('height');
			st.lastVpH = null;
			st.lastVpTop = null;
			const w = s.width + '%';
			st.host.style.setProperty('--nm-width', w);
			st.el.style.setProperty('--nm-width', w);
			// Same margins as the scrollbar, so the minimap never sits under the floating header or the
			// bottom bar. Your top / height settings still apply wherever they leave more room.
			const mTop = this.inset('insetTop');
			const mBottom = this.inset('insetBottom');
			const topCss = 'max(' + s.top + '%, ' + mTop + 'px)';
			st.el.style.setProperty('--nm-top', topCss);
			st.el.style.setProperty('--nm-height', 'min(' + s.height + '%, calc(100% - ' + topCss + ' - ' + mBottom + 'px))');
		}

		if (st.style !== s.style) {
			st.style = s.style;
			st.text = null;
			st.stripH = 0;
			st.lastVpH = null;
			st.lastVpTop = null;
			st.linesEl.style.removeProperty('transform');
			this.clearLines(st);
		}
	}

	render(view, st) {
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		const key = this._key;
		const padCls = s.side === 'left' ? 'note-minimap-pad-left' : 'note-minimap-pad-right';
		// Re-apply only if a setting changed, or something outside the plugin stripped our markup.
		if (st.renderKey !== key || !st.el.isConnected || (!s.hideScrollbar && !st.host.classList.contains(padCls))) {
			this.applyStyle(view, st);
			st.renderKey = key;
		}

		// Fast rendering draws the minimap on one canvas; otherwise it is a div per bar.
		const wantCanvas = !!s.fastRender && !sb;
		if (!!st.canvas !== wantCanvas) {
			this.clearLines(st);
			if (wantCanvas) this.makeCanvas(st);
			else this.dropCanvas(st);
			st.text = null;
			st.linesEl.style.removeProperty('transform');
		}

		if (s.hideScrollbar) {
			// Hidden: nothing to draw. The bars are rebuilt on show if the note changed meanwhile.
		} else if (sb) {
			if (st.linesEl.firstChild) this.clearLines(st);
		} else {
			// Reading the whole note out of the editor is not free, and a refresh also runs for layout
			// changes, pane switches and the like, so only do it when the text may have changed.
			if (st.file !== view.file) {
				st.file = view.file;
				st.textDirty = true;
			}
			if (st.textDirty || st.text === null) {
				st.textDirty = false;
				const text = view.getViewData();
				if (text !== st.text) {
					st.text = text;
					const res = classify(text, MAX_ROWS);
					if (wantCanvas) this.buildMap(st, res);
					else this.buildLines(st, res);
				}
			}
		}

		this.ensureScroller(view, st);
		if (st.scroller && st.ro && !st.roContent) this.observeContent(st, st.scroller);
		this.updateViewport(st);
	}

	clearLines(st) {
		st.linesEl.empty();
		st.rows = [];
		st.items = null;
		st.mapDirty = true;
		if (st.canvas) this.drawMap(st, st.el.clientHeight);
	}

	// ---- Fast rendering: the minimap on a single canvas ----------------------
	// The normal minimap is one <div> per bar (up to 3000), and the browser has to style and lay out
	// every one. Here the classified lines are kept in an array and only the bars that are in view
	// are painted, so the cost no longer grows with the length of the note.

	makeCanvas(st) {
		if (st.canvas) return;
		const cv = document.createElement('canvas');
		cv.className = 'note-minimap-canvas';
		st.el.insertBefore(cv, st.vpEl);
		st.canvas = cv;
		st.ctx = cv.getContext('2d');
		st.cvDirty = true;
		st.mapDirty = true;
		st.drawnTop = null;
	}

	dropCanvas(st) {
		if (!st.canvas) return;
		st.canvas.remove();
		st.canvas = null;
		st.ctx = null;
		st.items = null;
	}

	// Keeps the classified lines and works out the strip height; drawMap paints from them.
	buildMap(st, res) {
		st.items = res.items;
		st.stripH = res.items.length * ROW;
		st.mapDirty = true;
	}

	mapTextColor() {
		if (!this._mapText) this._mapText = getComputedStyle(document.body).color || '#888888';
		return this._mapText;
	}

	// Paints the bars that fall inside the strip. Skipped when nothing moved since the last paint.
	drawMap(st, mapH) {
		const cv = st.canvas;
		if (!cv || !st.ctx) return;
		const top = Math.round(st.stripTop || 0);
		if (!st.mapDirty && !st.cvDirty && st.drawnTop === top && st.drawnH === mapH) return;

		if (st.cvDirty || st.drawnH !== mapH) {
			st.cvW = st.el.clientWidth;
			const dpr = window.devicePixelRatio || 1;
			const pw = Math.max(1, Math.round(st.cvW * dpr));
			const ph = Math.max(1, Math.round(mapH * dpr));
			if (cv.width !== pw) cv.width = pw;
			if (cv.height !== ph) cv.height = ph;
			st.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			st.cvDirty = false;
		}
		st.mapDirty = false;
		st.drawnTop = top;
		st.drawnH = mapH;

		const ctx = st.ctx;
		const w = st.cvW;
		ctx.clearRect(0, 0, w, mapH);
		const items = st.items;
		if (!items || !items.length) return;

		// Only rows whose 2px bar overlaps the visible strip.
		const first = Math.max(0, Math.floor((-top - LINE_H) / ROW) + 1);
		const last = Math.min(items.length - 1, Math.ceil((mapH - top) / ROW) - 1);
		let curCls = null;
		for (let r = first; r <= last; r++) {
			const it = items[r];
			if (!it || it.cls === 'nm-blank') continue;
			if (it.cls !== curCls) {
				curCls = it.cls;
				const ms = MAP_STYLE[it.cls] || MAP_STYLE['nm-text'];
				ctx.fillStyle = ms[0] || this.mapTextColor();
				ctx.globalAlpha = ms[1];
			}
			const pct = Math.min(100, Math.max(8, (it.len / 80) * 100));
			const left = it.indent ? Math.min(it.indent * 2, 16) : 0;
			ctx.fillRect(left, top + r * ROW, (w * pct) / 100, LINE_H);
		}
		ctx.globalAlpha = 1;
	}

	// Rows are kept between edits and only the ones whose look changed are touched, so typing in a
	// long note updates a handful of nodes instead of tearing down and recreating thousands.
	buildLines(st, res) {
		const items = res.items;
		const rows = st.rows;
		const frag = document.createDocumentFragment();
		let row = 0;

		for (; row < items.length; row++) {
			const it = items[row];
			const cur = rows[row];
			if (it.cls === 'nm-blank') {
				if (cur) {
					cur.el.remove();
					rows[row] = null;
				}
				continue;
			}
			const pct = Math.min(100, Math.max(8, (it.len / 80) * 100));
			const left = it.indent ? Math.min(it.indent * 2, 16) : 0;
			const sig = it.cls + '|' + pct + '|' + left;
			if (cur) {
				if (cur.sig === sig) continue;
				cur.el.className = 'note-minimap-line ' + it.cls;
				cur.el.style.setProperty('--nm-line-width', pct + '%');
				cur.el.style.left = left ? left + 'px' : '';
				cur.sig = sig;
				continue;
			}
			const d = document.createElement('div');
			d.className = 'note-minimap-line ' + it.cls;
			d.style.cssText =
				'--nm-line-top:' + row * ROW + 'px;--nm-line-width:' + pct + '%' + (left ? ';left:' + left + 'px' : '');
			frag.appendChild(d);
			rows[row] = { el: d, sig };
		}

		// The note got shorter: drop the rows past the end.
		for (let r = row; r < rows.length; r++) if (rows[r]) rows[r].el.remove();
		rows.length = row;

		st.linesEl.appendChild(frag);
		st.stripH = items.length * ROW;
		st.linesEl.style.setProperty('--nm-strip-height', st.stripH + 'px');
		// Every bar has the same height, so it is set once on the container and inherited.
		st.linesEl.style.setProperty('--nm-line-height', LINE_H + 'px');
	}

	// Native scrolling (finger on the note, wheel, keyboard) can fire faster than the screen
	// refreshes. Redraw the thumb once per frame; the engine already redraws every frame itself.
	queueViewport(st) {
		if (st.vpQueued || st.running || this.settings.hideScrollbar) return;
		st.vpQueued = true;
		requestAnimationFrame(() => {
			st.vpQueued = false;
			if (!st.dead && !st.running) this.updateViewport(st);
		});
	}

	// Writes the thumb's size and position, skipping whatever has not changed since the last write.
	// ---- Page bubble ----
	// A small circle pops out beside the thumb while the note scrolls and says which page you are on. Pages are
	// counted in the note's own text, never in screen heights, so turning the phone or unfolding it cannot change
	// them: every source line counts as its length (at least PAGE_MIN, so blank and short lines still take their
	// place), and one page is `pageLen` of that. The page you are on is the one holding the line at the top of the
	// screen; the editor and the reading view are each asked for that line in their own way (Obsidian's reading view
	// keeps the first and last line of every section, the editor can say which line sits at a given height).
	pageModel(st, view, mode) {
		let key;
		let build;
		if (mode === 'preview') {
			key = typeof view.data === 'string' ? view.data : '';
			build = () => {
				const n = key.length;
				const cum = [0];
				let i = 0;
				while (i <= n) {
					let j = key.indexOf('\n', i);
					if (j < 0) j = n;
					cum.push(cum[cum.length - 1] + Math.max(PAGE_MIN, j - i + 1));
					i = j + 1;
				}
				return cum;
			};
		} else {
			const cm = view.editor && view.editor.cm;
			if (!cm || !cm.state) return null;
			const doc = cm.state.doc;
			key = doc;
			build = () => {
				const cum = [0];
				if (typeof doc.iterLines === 'function') {
					for (const ln of doc.iterLines()) cum.push(cum[cum.length - 1] + Math.max(PAGE_MIN, ln.length + 1));
				} else {
					for (let i = 1; i <= doc.lines; i++) cum.push(cum[cum.length - 1] + Math.max(PAGE_MIN, doc.line(i).length + 1));
				}
				return cum;
			};
		}
		const m = st.pm;
		if (m && m.key === key && m.mode === mode) return m.cum;
		const cum = build();
		st.pm = { key, mode, cum };
		return cum;
	}

	// The source line (a fraction, in the reading view) at the top of the screen.
	pageTopLine(st, view, mode, sc) {
		if (mode === 'preview') {
			const r = view.previewMode && view.previewMode.renderer;
			const secs = r && r.sections;
			if (!Array.isArray(secs) || !secs.length) return 0;
			// Same walk Obsidian uses to place its sections (getSectionTop): heights not measured yet are guessed.
			const y = sc.scrollTop;
			let acc = 0;
			let best = null;
			let bestTop = 0;
			for (let i = 0; i < secs.length; i++) {
				const sec = secs[i];
				if (acc > y) break;
				best = sec;
				bestTop = acc;
				let h = sec.height;
				if (!sec.computed && h === 0 && i > 0) h = acc / i;
				if (!sec.shown) h = 0;
				acc += h;
			}
			if (!best || !best.start) return 0;
			const f = best.height > 0 ? Math.min(1, Math.max(0, (y - bestTop) / best.height)) : 0;
			return best.start.line + f * Math.max(0, (best.lines || 0) - 1);
		}
		const cm = view.editor && view.editor.cm;
		const pad = cm.documentPadding ? cm.documentPadding.top : 0;
		const blk = cm.lineBlockAtHeight(Math.max(0, sc.scrollTop - pad));
		return cm.state.doc.lineAt(blk.from).number - 1;
	}

	// What the buzz counts: the same as the bubble unless Page vibration has its own choice.
	hapMode() {
		const by = this.settings.pageHapticsBy || 'bubble';
		return by === 'bubble' ? this.settings.pageShows || 'page' : by;
	}

	pageInfo(st) {
		try {
			const view = st.view;
			const sc = st.scroller;
			if (!view || !sc) return null;
			const mode = st.boundMode === 'preview' ? 'preview' : 'source';
			const cum = this.pageModel(st, view, mode);
			if (!cum || cum.length < 2) return null;
			const lines = cum.length - 1;
			const line = Math.max(0, Math.min(lines - 1, Math.floor(this.pageTopLine(st, view, mode, sc))));
			const per = Math.max(300, this.settings.pageLen || 1800);
			const total = Math.max(1, Math.ceil(cum[lines] / per));
			let page = Math.floor(cum[line] / per) + 1;
			const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
			if (atEnd) page = total; // the very end is the last page
			const info = { page: Math.max(1, Math.min(total, page)), total };
			const modes = [this.settings.pageBubble !== false ? this.settings.pageShows : null, this.settings.pageHaptics !== false ? this.hapMode() : null];
			if (modes.includes('percent')) {
				info.pct = atEnd ? 100 : Math.max(0, Math.min(100, Math.round((cum[line] / Math.max(1, cum[lines])) * 100)));
			}
			return info;
		} catch (err) {
			return null;
		}
	}

	// Called every time the thumb is placed. A change of position of more than a pixel or two is a scroll.
	pageTick(st, vpTop, vpH) {
		const bub = this.settings.pageBubble;
		const hap = this.settings.pageHaptics && CAN_BUZZ && Platform.isMobile;
		if ((!bub && !hap) || st.dead) return;
		const y = st.pageY;
		if (y === undefined) return;
		const now = performance.now();
		const file = st.view && st.view.file;
		if (st.pageFile !== file) {
			// Another note: no bubble for the jump back to where it was left.
			st.pageFile = file;
			st.pageSeen = y;
			st.pageQuiet = now + 900;
			return;
		}
		if (st.pageSeen === undefined) {
			st.pageSeen = y;
			return;
		}
		if (Math.abs(y - st.pageSeen) >= 2) {
			st.pageSeen = y;
			if (!st.noScroll && now > (st.pageQuiet || 0) && now > (this._pageQuiet || 0)) {
				const rested = now - (st.pageLastMove || 0) > 600;
				st.pageLastMove = now;
				if (bub) {
					if (st.pageFading) this.pageKeep(st);
					else if (!st.pageOn) this.pageShow(st, vpTop, vpH);
				}
				if (hap) this.pageBuzz(st, now, rested);
			}
		}
		if (bub && st.pageOn) this.pageMove(st, vpTop, vpH, now, false);
	}

	// A short buzz each time the scroll crosses into another page (or, when the bubble shows percent, each time the
	// percent changes). After a pause the first move only notes where you are, so starting to scroll never buzzes by itself.
	pageBuzz(st, now, rested) {
		if (rested) st.hapPage = null;
		if (now - (st.hapT || 0) < 70) return;
		st.hapT = now;
		const info = this.pageInfo(st);
		if (!info) return;
		// What is being counted: whole percents in percent mode, pages otherwise. The prefix tells the two apart,
		// so switching the setting just starts counting again instead of buzzing once.
		const hm = this.hapMode();
		const key = hm === 'percent' && info.pct !== undefined ? 'p' + info.pct : 'n' + info.page;
		const prev = st.hapPage;
		if (typeof prev === 'string' && prev.charAt(0) === key.charAt(0) && prev !== key) {
			try {
				navigator.vibrate(12);
			} catch (e) {
				/* not supported here */
			}
		}
		st.hapPage = key;
	}

	pageShow(st, vpTop, vpH) {
		const info = this.pageInfo(st);
		if (!info) return;
		if (st.pageClearTimer) clearTimeout(st.pageClearTimer);
		st.pageClearTimer = null;
		if (st.pageEl) st.pageEl.removeClass('nm-page-fade');
		if (!st.pageEl) {
			const el = st.host.createDiv({ cls: 'nm-page' });
			const b = el.createDiv({ cls: 'nm-page-b' });
			st.pageNum = b.createSpan({ cls: 'nm-page-n' });
			st.pageOf = b.createSpan({ cls: 'nm-page-of' });
			st.pageEl = el;
		}
		// Where it sits: beside the thumb, on the side the bar is on (measured once per appearance).
		const hr = st.host.getBoundingClientRect();
		const tr = st.vpEl.getBoundingClientRect();
		const sr = st.el.getBoundingClientRect();
		const right = !st.el.hasClass('note-minimap-left');
		const size = 38; // height of the pill
		const gap = 10;
		const e = st.pageEl.style;
		if (right) {
			e.left = 'auto';
			e.right = Math.round(hr.right - tr.left + gap) + 'px';
		} else {
			e.right = 'auto';
			e.left = Math.round(tr.right - hr.left + gap) + 'px';
		}
		e.setProperty('--nm-page-from', (right ? 1 : -1) * 30 + 'px'); // it starts at the bar and grows out of it
		e.setProperty('--nm-page-origin', right ? 'right center' : 'left center');
		e.setProperty('--nm-page-idle-op', st.el.style.getPropertyValue('--nm-thumb-opacity') || '0.75');
		const bg = st.el.style.getPropertyValue('--nm-thumb-color') || 'var(--text-accent)';
		let fg = 'var(--text-on-accent)';
		if (/^#[0-9a-f]{6}$/i.test(bg)) {
			const n = parseInt(bg.slice(1), 16);
			fg = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#000' : '#fff';
		}
		e.setProperty('--nm-page-bg', bg);
		e.setProperty('--nm-page-fg', fg);
		st.pageOff = sr.top - hr.top;
		st.pageHostH = hr.height;
		st.pageSize = size;
		st.pageTxt = null;
		st.pageSub = null;
		st.pageY0 = null;
		this.pageSet(st, info, false);
		this.pageMove(st, vpTop, vpH, performance.now(), true);
		void st.pageEl.offsetWidth; // so the pop starts from its resting place
		st.pageEl.addClass('nm-page-on');
		st.pageOn = true;
		this.pageArm(st, 800);
	}

	// Checks that the note has stopped, then hides the circle. Stays while a finger is on the bar or an arrow is held.
	pageArm(st, ms) {
		if (st.pageTimer) clearTimeout(st.pageTimer);
		st.pageTimer = window.setTimeout(() => {
			st.pageTimer = null;
			if (!st.pageOn || st.dead || st.pageFading) return;
			const idle = performance.now() - st.pageLastMove;
			if (st.dragging || st.hold || st.cruise || idle < 800) this.pageArm(st, Math.max(120, 800 - idle));
			else this.pageHide(st);
		}, ms);
	}

	// Two steps: the circle first settles into the colour the bar has when it is not being used, then slips away.
	pageHide(st) {
		if (!st.pageOn || st.pageFading || !st.pageEl) return;
		st.pageFading = true;
		st.pageEl.addClass('nm-page-fade');
		st.pageFadeTimer = window.setTimeout(() => {
			st.pageFadeTimer = null;
			st.pageFading = false;
			st.pageOn = false;
			if (!st.pageEl) return;
			st.pageEl.removeClass('nm-page-on');
			st.pageClearTimer = window.setTimeout(() => {
				st.pageClearTimer = null;
				if (st.pageEl && !st.pageOn) st.pageEl.removeClass('nm-page-fade');
			}, 260);
		}, 470); // the colour settle and the shrink play together (0.46 s)
	}

	// The note moved again while the circle was settling: back to full colour, and the countdown starts over.
	pageKeep(st) {
		if (!st.pageFading) return;
		if (st.pageFadeTimer) clearTimeout(st.pageFadeTimer);
		st.pageFadeTimer = null;
		st.pageFading = false;
		if (st.pageEl) st.pageEl.removeClass('nm-page-fade');
		this.pageArm(st, 800);
	}

	pageMove(st, vpTop, vpH, now, fresh) {
		if (!fresh && now - (st.pageCalcT || 0) > 70) {
			st.pageCalcT = now;
			const info = this.pageInfo(st);
			if (info) this.pageSet(st, info, true);
		}
		const room = Math.max(0, (st.pageHostH || 0) - st.pageSize - 4);
		const y = Math.round(Math.max(0, Math.min(room, st.pageOff + vpTop + vpH / 2 - st.pageSize / 2)));
		if (st.pageY0 !== y) {
			st.pageY0 = y;
			st.pageEl.style.transform = 'translate3d(0,' + y + 'px,0)';
		}
	}

	pageSet(st, info, animate) {
		const mode = this.settings.pageShows || 'page';
		let t;
		let sub = '';
		if (mode === 'percent' && info.pct !== undefined) t = info.pct + '%';
		else {
			t = String(info.page);
			sub = 'of ' + info.total;
		}
		const changed = st.pageTxt !== t;
		if (changed) {
			st.pageTxt = t;
			st.pageNum.textContent = t;
		}
		if (st.pageSub !== sub) {
			st.pageSub = sub;
			st.pageOf.textContent = sub;
			st.pageOf.style.display = sub ? '' : 'none';
		}
		const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (animate && changed && !reduced && st.pageNum.animate) {
			st.pageNum.animate([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 130, easing: 'ease-out' });
		}
	}

	placeThumb(st, vpTop, vpH) {
		const v = st.vpEl.style;
		if (st.lastVpH !== vpH) {
			st.lastVpH = vpH;
			v.top = '0px';
			v.height = vpH + 'px';
		}
		if (st.lastVpTop !== vpTop) {
			st.lastVpTop = vpTop;
			v.transform = 'translate3d(0,' + vpTop + 'px,0)';
		}
		this.pageTick(st, vpTop, vpH);
	}

	updateViewport(st, livePos) {
		const sc = st.scroller;
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		if (!sc) {
			st.vpEl.style.display = 'none';
			return;
		}
		// A hidden strip is display:none; showing it again re-styles and redraws it (the style key
		// includes hideScrollbar), so there is nothing to keep up to date meanwhile.
		if (s.hideScrollbar) return;

		const live = livePos !== undefined;
		const mx = live ? this.readMetrics(st) : null;
		const mapH = live ? mx.mapH : st.el.clientHeight;
		if (sb) st.stripH = mapH;
		if (!st.stripH) {
			st.vpEl.style.display = 'none';
			return;
		}
		st.vpEl.style.display = '';

		const sh = live ? mx.sh : Math.max(1, sc.scrollHeight);
		const ch = live ? mx.ch : sc.clientHeight;
		const maxScroll = Math.max(1, sh - ch);
		// The editor only knows the real height of lines it has drawn, so while a long note scrolls its total
		// height is corrected again and again. Read straight, that makes the thumb's size and position twitch.
		// While the engine runs, the height the thumb uses eases toward the real one over a few frames instead
		// (about a tenth of a second); the note itself always uses the real numbers.
		let shV = sh;
		if (sb) {
			if (live && st.shView) {
				// 0.2 per frame at 60 Hz is a time constant of about 75 ms; keep that at any refresh rate.
				const k = 1 - Math.exp(-Math.min(0.05, st.dtLast || 1 / 60) / 0.075);
				shV = st.shView + (sh - st.shView) * k;
				if (Math.abs(sh - shV) < 0.5) shV = sh;
			}
			st.shView = shV;
		}
		const maxView = Math.max(1, shV - ch);
		// While you drag the thumb it stays glued to your finger; the note catches up.
		const shown = sb && st.lead ? st.target : live ? livePos : sc.scrollTop;
		st.pageY = shown;
		const frac = Math.min(1, Math.max(0, shown / maxView));
		const e = st.el.style;

		if (sb) {
			// Same maths as a native scrollbar thumb.
			const a = s.showArrows && s.touchEnabled ? s.arrowSize : 0;
			const trackH = Math.max(1, mapH - 2 * a);
			let vpH = Math.min(trackH, Math.max(44, (ch / shV) * trackH));
			// Resizing the thumb means laying it out and redrawing it. While a long note scrolls, its height
			// estimate creeps by fractions of a pixel on almost every frame; only follow changes you could see.
			if (st.vpHq !== undefined && Math.abs(vpH - st.vpHq) < 1 / (window.devicePixelRatio || 1)) vpH = st.vpHq;
			else st.vpHq = vpH;
			const vpTop = a + frac * (trackH - vpH);
			st.arrow = a;
			st.trackH = trackH;
			st.stripTop = 0;
			st.vpH = vpH;
			st.vpTop = vpTop;
			const atTop = shown <= 1;
			const atBottom = shown >= maxScroll - 1; // real height: this is about the note, not the thumb
			if (atTop !== st.atTop) {
				st.atTop = atTop;
				st.el.toggleClass('nm-at-top', atTop);
			}
			if (atBottom !== st.atBottom) {
				st.atBottom = atBottom;
				st.el.toggleClass('nm-at-bottom', atBottom);
			}
			const noScroll = sh <= ch + 1;
			if (noScroll !== st.noScroll) {
				st.noScroll = noScroll;
				st.el.toggleClass('nm-no-scroll', noScroll);
			}
			// Move the thumb with a GPU transform; it stays perfectly in step with the note.
			this.placeThumb(st, vpTop, vpH);
			return;
		}

		const overflow = Math.max(0, st.stripH - mapH);
		st.stripTop = -frac * overflow;

		const vpTop = ((live ? livePos : sc.scrollTop) / sh) * st.stripH + st.stripTop;
		const vpH = Math.max(4, Math.min(st.stripH, (ch / sh) * st.stripH));
		st.vpH = vpH;

		// Custom properties set on the strip are inherited by every bar (up to 3000), so changing
		// them each frame would restyle all of them. Transforms on the two moving parts do not.
		if (st.canvas) this.drawMap(st, mapH);
		else st.linesEl.style.transform = 'translate3d(0,' + st.stripTop + 'px,0)';
		this.placeThumb(st, vpTop, vpH);
		// The dimming overlays only exist while the strip is being dragged.
		if (st.dragging) {
			e.setProperty('--nm-fade-top', vpTop + 'px');
			e.setProperty('--nm-fade-bot', vpTop + vpH + 'px');
		}
	}
}

class RefreshRateModal extends Modal {
	constructor(app, plugin, onDone, firstRun) {
		super(app);
		this.plugin = plugin;
		this.onDone = onDone;
		this.firstRun = !!firstRun; // true only for the pop-up that appears by itself the first time
		this.stop = null;
	}

	onOpen() {
		const { contentEl } = this;
		const p = this.plugin;
		contentEl.empty();
		contentEl.addClass('nm-hz-modal');
		// Our own entrance and exit for the whole pop-up (see styles.css); the built-in one is switched off for it.
		this.closing = false;
		if (this.containerEl) this.containerEl.addClass('nm-hz-container');
		if (this.modalEl) this.modalEl.addClass('nm-hz-box');
		contentEl.createEl('h3', { text: 'What is your screen refresh rate?' });
		contentEl.createEl('p', {
			text: 'Arrow scrolling is timed to your screen so every redraw moves the note by the same, whole number of pixels. Most phones are 60 Hz; many newer ones are 90 or 120 Hz. Pick yours, or let the plugin measure it.',
		});
		this.status = contentEl.createDiv({ cls: 'nm-hz-status' });
		this.showCurrent();
		this.pad = contentEl.createDiv({ cls: 'nm-hz-pad' });
		this.pad.createDiv({ cls: 'nm-hz-hint', text: 'Measure: tap the button, then keep a finger moving on this box' });
		this.dot = this.pad.createDiv({ cls: 'nm-hz-dot' });
		this.result = this.pad.createDiv({ cls: 'nm-hz-result' });
		this.progress = this.pad.createDiv({ cls: 'nm-hz-progress' });

		const row = contentEl.createDiv({ cls: 'nm-hz-row' });
		const measure = row.createEl('button', { text: 'Measure', cls: 'mod-cta' });
		measure.addEventListener('click', () => this.measure(measure));
		this.choices = new Map(); // refresh rate -> its button, so the current one can be marked
		for (const hz of [60, 90, 120, 144]) {
			const b = row.createEl('button', { text: hz + ' Hz' });
			b.addEventListener('click', () => this.choose(hz));
			this.choices.set(hz, b);
		}
		const auto = row.createEl('button', { text: 'Automatic' });
		auto.addEventListener('click', () => this.choose(0));
		this.choices.set(0, auto);
		this.showCurrent();
		contentEl.createEl('p', {
			cls: 'nm-hz-note',
			text: 'Not sure? Leave it on Automatic. You can change this any time under Settings → My Note Minimap [Scrollbar] → Screen refresh rate.',
		});
	}

	// Plays the exit animation, then really closes.
	close() {
		const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (this.closing || reduced || !this.containerEl || !this.containerEl.isConnected) {
			super.close();
			return;
		}
		this.closing = true;
		this.containerEl.addClass('nm-hz-closing');
		window.setTimeout(() => super.close(), 190);
	}

	showCurrent() {
		const r = this.plugin.settings.refreshRate;
		this.status.setText('Current: ' + (r ? r + ' Hz' : 'automatic'));
		if (this.choices) for (const [hz, b] of this.choices) b.toggleClass('nm-hz-current', hz === (r || 0));
	}

	async choose(hz) {
		this.plugin.settings.refreshRate = hz;
		this.plugin.settings.refreshAsked = true;
		await this.plugin.saveSettings();
		this.close();
	}

	// Counts how long frames really take while a finger is on the pad. Phones with adaptive refresh drop to a
	// lower rate when nothing is touching the screen, so the frames only count while the finger is down.
	measure(btn) {
		if (this.stop) return;
		const pad = this.pad;
		const dot = this.dot;
		const gaps = [];
		let touching = false;
		let last = 0;
		let raf = 0;
		const t0 = performance.now();
		// Read once: asking for the width on every frame forced a re-layout each time and made the dot stutter.
		const travel = Math.max(0, pad.clientWidth - 24);
		const progress = this.progress;
		progress.style.transform = 'scaleX(0)';
		pad.removeClass('nm-hz-done');
		const down = () => {
			touching = true;
			last = 0;
		};
		const up = () => {
			touching = false;
			last = 0;
		};
		pad.addEventListener('pointerdown', down);
		pad.addEventListener('pointerup', up);
		pad.addEventListener('pointercancel', up);
		pad.addEventListener('pointerleave', up);
		pad.addClass('nm-hz-live');
		btn.disabled = true;
		this.status.setText('Measuring: keep your finger moving on the box…');

		const end = (done) => {
			cancelAnimationFrame(raf);
			pad.removeEventListener('pointerdown', down);
			pad.removeEventListener('pointerup', up);
			pad.removeEventListener('pointercancel', up);
			pad.removeEventListener('pointerleave', up);
			pad.removeClass('nm-hz-live');
			btn.disabled = false;
			this.stop = null;
			if (!done) {
				this.showCurrent();
				return;
			}
			const g = gaps.slice(4).sort((a, b) => a - b);
			if (g.length < 20) {
				this.status.setText('Not enough frames. Tap Measure again and keep a finger moving on the box.');
				return;
			}
			const med = g[g.length >> 1];
			const hz = nearestHz(1000 / med) || Math.round(1000 / med);
			this.plugin.settings.refreshRate = hz;
			this.plugin.settings.refreshAsked = true;
			this.plugin.saveSettings();
			this.status.setText('Measured ' + hz + ' Hz and saved it.');
			this.result.setText(hz + ' Hz');
			pad.addClass('nm-hz-done');
			if (this.choices) for (const [k, b] of this.choices) b.toggleClass('nm-hz-current', k === hz);
		};
		this.stop = () => end(false);

		const frame = (t) => {
			// Something has to change on every frame, or the screen has no reason to redraw at full rate.
			dot.style.transform = 'translate3d(' + (Math.sin(t / 170) * 0.5 + 0.5) * travel + 'px,0,0)';
			if (touching) {
				if (last) gaps.push(t - last);
				last = t;
				progress.style.transform = 'scaleX(' + Math.min(1, gaps.length / 70) + ')';
			}
			if (gaps.length >= 70) return end(true);
			if (performance.now() - t0 > 15000) return end(true);
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
	}

	async onClose() {
		if (this.stop) this.stop();
		this.contentEl.empty();
		if (!this.plugin.settings.refreshAsked) {
			this.plugin.settings.refreshAsked = true;
			await this.plugin.saveSettings();
		}
		if (this.onDone) this.onDone();
		// The first-run pop-up also takes the person to Obsidian's Mobile settings and turns the Quick Action off.
		if (this.firstRun) {
			this.firstRun = false;
			this.plugin.quietQuickAction();
		}
	}
}

class MinimapSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Every toggle here that shows or hides other rows rebuilds the whole tab, and an emptied tab lost its scroll
	// position, so the list jumped back to the top. Rebuilding now keeps the place: the scroll position is read first
	// and put back as soon as the rows are drawn again (and once more a frame later, after layout settles).
	display() {
		const box = this.scrollBox();
		const top = box ? box.scrollTop : 0;
		this.build();
		if (box && top > 0) {
			box.scrollTop = top;
			requestAnimationFrame(() => {
				box.scrollTop = top;
			});
		}
	}

	// Opens or closes a group of rows with the same motion as the colour panel. Opening: the layout changes once and the
	// rows fade and slide down into place. Closing: the group shrinks away over a longer, softer curve while the rows
	// below glide up on their own graphics layers. Not rebuilding the tab keeps the scroll position and everything else.
	setFold(wrap, open) {
		if (!wrap) return;
		const was = !wrap.hasClass('nm-collapsed');
		if (was === open && !wrap._foldEnd) return;
		const inner = wrap.firstElementChild;
		if (wrap._foldEnd) wrap._foldEnd(false);
		if (wrap._foldOpen) {
			wrap._foldOpen.cancel();
			wrap._foldOpen = null;
		}
		const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced || !wrap.animate || !inner || !inner.animate) {
			wrap.toggleClass('nm-collapsed', !open);
			return;
		}
		if (open) {
			wrap.removeClass('nm-collapsed');
			const a = inner.animate(
				[
					{ opacity: 0, transform: 'translateY(-14px)' },
					{ opacity: 1, transform: 'translateY(0)' },
				],
				{ duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
			);
			wrap._foldOpen = a;
			a.onfinish = () => {
				wrap._foldOpen = null;
			};
			return;
		}
		const full = wrap.offsetHeight;
		// Everything that sits after the group, at its own level and at every level above it (a group can be nested in
		// another one), is what moves up while the group shrinks.
		const below = [];
		const root = this.containerEl;
		for (let el = wrap; el && el !== root; el = el.parentElement) {
			for (let n = el.nextElementSibling; n; n = n.nextElementSibling) below.push(n);
		}
		// The shrinking group is not the only thing that moves the rows below: the gaps between neighbouring rows change
		// once the group is clipped (margins stop merging through it), and change again when it is finally removed. Left
		// alone, the rows glide up and then jump the last few pixels at the very end. So the layout is measured at the four
		// moments that matter (before, folding at full height, folding at zero height, removed) and the rows below are
		// moved by the difference with a transform that runs on the same curve as the height, so the whole motion is one
		// continuous glide from where the rows are now to where they end up.
		let shiftFrom = 0;
		let shiftTo = 0;
		// The first one that is actually drawn: a closed group next to it is display:none and has no position to measure.
		const ref = below.find((n) => n.getClientRects().length > 0);
		if (ref) {
			const box = this.scrollBox();
			const keep = box ? box.scrollTop : 0;
			const yA = ref.getBoundingClientRect().top;
			wrap.addClass('nm-folding');
			wrap.style.height = full + 'px';
			const yB = ref.getBoundingClientRect().top;
			wrap.style.height = '0px';
			const yC = ref.getBoundingClientRect().top;
			wrap.style.height = '';
			wrap.removeClass('nm-folding');
			wrap.addClass('nm-collapsed');
			const yD = ref.getBoundingClientRect().top;
			wrap.removeClass('nm-collapsed');
			if (box) box.scrollTop = keep;
			shiftFrom = yA - yB;
			shiftTo = yD - yC;
		}
		for (const n of below) n.style.willChange = 'transform';
		wrap.addClass('nm-folding');
		const hAnim = wrap.animate([{ height: full + 'px' }, { height: '0px' }], {
			duration: 460,
			easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
			fill: 'forwards',
		});
		const sAnims = [];
		if (Math.abs(shiftFrom) > 0.5 || Math.abs(shiftTo) > 0.5) {
			for (const n of below) {
				if (!n.animate) continue;
				sAnims.push(
					n.animate(
						[{ transform: 'translateY(' + shiftFrom + 'px)' }, { transform: 'translateY(' + shiftTo + 'px)' }],
						{ duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' }
					)
				);
			}
		}
		const fAnim = inner.animate(
			[
				{ opacity: 1, transform: 'translateY(0)' },
				{ opacity: 0, transform: 'translateY(-18px)' },
			],
			{ duration: 300, easing: 'ease-in', fill: 'forwards' }
		);
		wrap._foldEnd = (finished) => {
			wrap._foldEnd = null;
			hAnim.onfinish = null;
			wrap.toggleClass('nm-collapsed', finished);
			hAnim.cancel();
			fAnim.cancel();
			for (const a of sAnims) a.cancel();
			wrap.removeClass('nm-folding');
			for (const n of below) n.style.willChange = '';
		};
		hAnim.onfinish = () => wrap._foldEnd && wrap._foldEnd(true);
	}

	// The element that scrolls the settings page.
	scrollBox() {
		let el = this.containerEl;
		while (el && el !== document.body) {
			if (el.classList && el.classList.contains('vertical-tab-content')) return el;
			const oy = getComputedStyle(el).overflowY;
			if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
			el = el.parentElement;
		}
		return this.containerEl.closest('.vertical-tab-content') || null;
	}

	build() {
		const { containerEl } = this;
		const p = this.plugin;
		containerEl.empty();

		new Setting(containerEl).setName('Updates').setHeading();

		new Setting(containerEl)
			.setName('Check for updates automatically')
			.setDesc('Off by default. When on, contacts api.github.com about once a day when Obsidian starts to look for a newer release, and shows a notice if there is one. It never installs by itself.')
			.addToggle((t) =>
				t.setValue(p.settings.autoUpdate).onChange(async (v) => {
					p.settings.autoUpdate = v;
					p.saveDirty = true;
					p.saveSoon();
				})
			);

		const updRow = new Setting(containerEl).setName('Version ' + p.manifest.version);
		let updBtn = null;
		let spinEl = null;
		let spinTimer = null;
		const stopSpin = () => {
			if (spinTimer) window.clearInterval(spinTimer);
			spinTimer = null;
			spinEl = null;
		};
		const paintUpdate = () => {
			const st = p._updState;
			const u = p._update;
			let desc = 'Contacts api.github.com only when you tap the button. Installing then downloads the release files from github.com.';
			if (p.settings.lastUpdateCheck) desc = 'Last checked ' + new Date(p.settings.lastUpdateCheck).toLocaleString() + '.';
			if (st === 'checking') desc = 'Checking…';
			else if (st === 'installing') desc = 'Downloading and installing ' + (u ? u.version : '') + '…';
			else if (st === 'current') desc = 'You have the latest version.';
			else if (st === 'available' && u) desc = 'Version ' + u.version + ' is available.';
			else if (st === 'error') desc = p._updMsg || 'The update failed.';
			updRow.setDesc(desc);
			if (!updBtn) return;
			const busy = st === 'checking' || st === 'installing';
			// Not setDisabled(): a disabled button gets a spinning loader from Obsidian, and that animated layer made the
			// black area behind the modal's rounded corners flash while checking. The button stays enabled but inert
			// (onClick ignores taps while busy), and a plain class dims it instead.
			updBtn.buttonEl.toggleClass('nm-upd-busy', busy);
			updBtn.setButtonText(u ? 'Update to ' + u.version : 'Check for updates');
			// While it runs, show a small rolling ring in place of the label. It is drawn as text frames swapped from
			// script, NOT a CSS animation: any continuously animated layer inside the modal made the area behind its
			// rounded corners flash black on Android, and Obsidian's own disabled-button loader did the same.
			if (busy) {
				if (!spinEl || !spinEl.isConnected) {
					updBtn.buttonEl.empty();
					spinEl = updBtn.buttonEl.createSpan({ cls: 'nm-upd-spin' });
				}
				if (!spinTimer) {
					let i = 0;
					const frames = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
					const tick = () => {
						if (!spinEl || !spinEl.isConnected) return stopSpin();
						spinEl.setText(frames[i++ % frames.length]);
					};
					tick();
					spinTimer = window.setInterval(tick, 90);
				}
			} else {
				stopSpin();
			}
			if (u) updBtn.setCta();
			else updBtn.removeCta();
		};
		updRow.addButton((b) => {
			updBtn = b;
			b.buttonEl.addClass('nm-upd-btn');
			b.onClick(async () => {
				if (p._updBusy) return;
				const run = p._update ? p.installUpdate() : p.checkForUpdate();
				paintUpdate(); // shows "Checking…" / "Installing…" while it runs
				await run;
				paintUpdate();
			});
		});
		paintUpdate();

		new Setting(containerEl).setName('Controls').setHeading();

		new Setting(containerEl)
			.setName('Touch controls')
			.setDesc('Turn off to let touches pass through to the note. The bar then only shows where you are.')
			.addToggle((t) =>
				t.setValue(p.settings.touchEnabled).onChange(async (v) => {
					p.settings.touchEnabled = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Hide scrollbar')
			.setDesc('Hide the bar and give the note the full width.')
			.addToggle((t) =>
				t.setValue(p.settings.hideScrollbar).onChange(async (v) => {
					p.settings.hideScrollbar = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Header button')
			.setDesc('Add a hand button to the note header. Tap it to turn touch on or off. Long-press it to hide or show the bar.')
			.addToggle((t) =>
				t.setValue(p.settings.touchButton).onChange(async (v) => {
					p.settings.touchButton = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl).setName('Look').setHeading();

		const styleFolds = {};
		new Setting(containerEl)
			.setName('Style')
			.setDesc('Scrollbar is a thin bar you drag. Minimap is a small preview of your note (can be slow on long notes).')
			.addDropdown((d) =>
				d
					.addOption('scrollbar', 'Scrollbar')
					.addOption('minimap', 'Minimap')
					.setValue(p.settings.style)
					.onChange(async (v) => {
						p.settings.style = v;
						this.setFold(styleFolds.sb && styleFolds.sb.wrap, v === 'scrollbar');
						this.setFold(styleFolds.mm && styleFolds.mm.wrap, v !== 'scrollbar');
						await p.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Side')
			.setDesc('Which side of the screen the bar is on.')
			.addDropdown((d) =>
				d
					.addOption('right', 'Right')
					.addOption('left', 'Left')
					.setValue(p.settings.side)
					.onChange(async (v) => {
						p.settings.side = v;
						await p.saveSettings();
					})
			);

		// Rows that belong to a toggle sit in a wrapper that folds open and shut (see .nm-collapse), so flipping the
		// toggle animates them in place instead of rebuilding the whole tab.
		let host = containerEl; // where the rows being built go (a fold's inner box while one is being filled)
		const fold = (on) => {
			const wrap = host.createDiv({ cls: 'nm-collapse' });
			const inner = wrap.createDiv({ cls: 'nm-collapse-inner' });
			wrap.toggleClass('nm-collapsed', !on);
			return { wrap, inner };
		};
		const comps = {};
		const slider = (name, desc, key, min, max, step, adjust, parent) =>
			this.withReset(new Setting(parent || host)
				.setName(name)
				.setDesc(desc)
				.addSlider((sl) => {
					comps[key] = sl;
					const apply = async (v) => {
						p.settings[key] = v;
						if (adjust) adjust(v);
						await p.saveSettings();
					};
					sl
						.setLimits(min, max, step)
						.setValue(typeof p.settings[key] === 'number' ? p.settings[key] : key === 'thumbWidth' ? p.barWidth() : p.inset(key))
						.onChange(apply);
					this.addFineControls(sl, min, max, step, apply);
				}), [key], comps);

		// Page length folds away under the toggle. Switching it must not rebuild the whole tab (that threw the
		// list back to the top), so the row is always there and only collapses.
		const pageWrap = containerEl.createDiv({ cls: 'nm-collapse' });
		const pageInner = pageWrap.createDiv({ cls: 'nm-collapse-inner' });
		pageWrap.toggleClass('nm-collapsed', p.settings.pageBubble === false);

		new Setting(containerEl)
			.setName('Page bubble')
			.setDesc('Show a small circle with the page number when you scroll.')
			.addToggle((t) =>
				t.setValue(p.settings.pageBubble !== false).onChange(async (v) => {
					p.settings.pageBubble = v;
					this.setFold(pageWrap, v);
					await p.saveSettings();
				})
			);
		containerEl.insertBefore(pageWrap, null); // keeps the row right under the toggle

		new Setting(pageInner)
			.setName('Bubble shows')
			.setDesc('What the bubble says. Page number: 3 of 12. Percent read: how far through the note you are.')
			.addDropdown((d) =>
				d
					.addOption('page', 'Page number')
					.addOption('percent', 'Percent read')
					.setValue(p.settings.pageShows || 'page')
					.onChange(async (v) => {
						p.settings.pageShows = v;
						await p.saveSettings();
					})
			);
		slider('Page length', 'How much text is one page, in characters. Counted in the text, so rotating or unfolding never changes it.', 'pageLen', 600, 4000, 100, undefined, pageInner);

		if (Platform.isMobile) {
			new Setting(containerEl)
				.setName('Page vibration')
				.setDesc('A light buzz as you scroll through the note. Works even with the bubble off.')
				.addToggle((t) =>
					t.setValue(p.settings.pageHaptics !== false).onChange(async (v) => {
						p.settings.pageHaptics = v;
						this.setFold(hapFold.wrap, v);
						await p.saveSettings();
					})
				);
			const hapFold = fold(p.settings.pageHaptics !== false);
			new Setting(hapFold.inner)
				.setName('Buzz on')
				.setDesc('What the buzz counts. Each page: a buzz for every new page. Each percent: a buzz for every new percent.')
				.addDropdown((d) =>
					d
						.addOption('bubble', 'Same as the bubble')
						.addOption('page', 'Each page')
						.addOption('percent', 'Each percent')
						.setValue(p.settings.pageHapticsBy || 'bubble')
						.onChange(async (v) => {
							p.settings.pageHapticsBy = v;
							await p.saveSettings();
						})
				);
		}

		styleFolds.sb = fold(p.settings.style === 'scrollbar');
		host = styleFolds.sb.inner;
		{
			slider('Bar width', 'How wide the bar is, in pixels.', 'thumbWidth', 6, 40, 1, () => {
				const need = p.barWidth() + 6;
				if (p.settings.hitWidth < need) {
					p.settings.hitWidth = need;
					if (comps.hitWidth) comps.hitWidth.setValue(need);
				}
			});
			new Setting(host)
				.setName('Shape')
				.setDesc('How round the bar corners are.')
				.addDropdown((d) =>
					d
						.addOption('pill', 'Pill (fully round)')
						.addOption('rounded', 'Rounded')
						.addOption('square', 'Square')
						.setValue(p.settings.shape)
						.onChange(async (v) => {
							p.settings.shape = v;
							await p.saveSettings();
						})
				);

			this.addColorSetting(host, {
				name: 'Colour',
				desc: 'Auto matches your theme. Custom lets you pick any colour.',
				key: 'thumbColor',
				fallback: '#d19a66',
			});

			slider('Opacity', 'How solid the bar looks.', 'thumbOpacity', 0.2, 1, 0.05);

			new Setting(host)
				.setName('Show track')
				.setDesc('Show a faint line behind the bar.')
				.addToggle((t) =>
					t.setValue(p.settings.showTrack).onChange(async (v) => {
						p.settings.showTrack = v;
						await p.saveSettings();
					})
				);

			new Setting(host)
				.setName('Glow')
				.setDesc('Add a soft glow around the bar.')
				.addToggle((t) =>
					t.setValue(p.settings.glow).onChange(async (v) => {
						p.settings.glow = v;
						this.setFold(glowFold.wrap, v);
						await p.saveSettings();
					})
				);

			const glowFold = fold(p.settings.glow);
			this.addColorSetting(glowFold.inner, {
				name: 'Glow colour',
				desc: 'Auto matches the bar. Custom lets you pick a colour.',
				key: 'glowColor',
				fallback: '#d19a66',
			});
			slider('Glow size', 'How far the glow spreads, in pixels.', 'glowBlur', 0, 40, 1, undefined, glowFold.inner);
			slider('Glow strength', 'How thick the glow is, in pixels.', 'glowSpread', 0, 10, 1, undefined, glowFold.inner);
			slider('Glow opacity', 'How bright the glow is.', 'glowOpacity', 0.1, 1, 0.05, undefined, glowFold.inner);

			const dev = p.device();
			const auto = ['insetTop', 'insetBottom', 'insetEdge'].every((k) => p.settings[k] === null);
			new Setting(host).setName('Margins and arrows').setHeading();

			const marginText = (isAuto) =>
				(isAuto ? 'Automatic: ' : 'Custom. Device default: ') +
				'top ' + dev.insetTop + ', bottom ' + dev.insetBottom + ', side ' + dev.insetEdge +
				' px.' + (isAuto ? ' Move a slider below to set your own.' : '');
			let marginBtn = null;
			const marginRow = new Setting(host)
				.setName('Margins for this device')
				.setDesc(marginText(auto))
				.addButton((b) => {
					marginBtn = b;
					b
						.setButtonText('Use device defaults')
						.setDisabled(auto)
						.onClick(async () => {
							p.settings.insetTop = null;
							p.settings.insetBottom = null;
							p.settings.insetEdge = null;
							await p.saveSettings();
							// Update the row and the three sliders where they are; nothing is rebuilt.
							marginRow.setDesc(marginText(true));
							b.setDisabled(true);
							for (const k of ['insetTop', 'insetBottom', 'insetEdge']) {
								if (comps[k]) comps[k].setValue(p.inset(k));
							}
						});
				});

			slider('Top margin', 'Space above the bar, so the screen corner does not cover it.', 'insetTop', 0, 240, 2);
			slider('Bottom margin', 'Space below the bar, so the gesture bar does not cover it.', 'insetBottom', 0, 240, 2);
			slider('Edge margin', 'Space between the bar and the screen edge, in pixels.', 'insetEdge', 0, 60, 1);
			slider('Touch area', 'How wide the area is that reacts to your finger, in pixels.', 'hitWidth', 20, 140, 2, (v) => {
				const need = p.barWidth() + 6;
				if (v < need) {
					p.settings.hitWidth = need;
					if (comps.hitWidth) comps.hitWidth.setValue(need);
				}
			});

			new Setting(host)
				.setName('Arrow buttons')
				.setDesc('Add up and down arrows. Tap to scroll a little, hold to keep scrolling.')
				.addToggle((t) =>
					t.setValue(p.settings.showArrows).onChange(async (v) => {
						p.settings.showArrows = v;
						this.setFold(arrowFold.wrap, v);
						await p.saveSettings();
					})
				);

			const arrowFold = fold(p.settings.showArrows);
			slider('Arrow size', 'How big each arrow button is, in pixels.', 'arrowSize', 14, 80, 1, undefined, arrowFold.inner);
			new Setting(arrowFold.inner)
				.setName('Arrow tap does')
				.setDesc('Scroll a step: a tap moves the note a fixed distance. Jump to heading: a tap goes to the next or previous heading. Holding always scrolls.')
				.addDropdown((d) =>
					d
						.addOption('step', 'Scroll a step')
						.addOption('heading', 'Jump to heading')
						.setValue(p.settings.arrowTap === 'heading' ? 'heading' : 'step')
						.onChange(async (v) => {
							p.settings.arrowTap = v;
							this.setFold(stepFold.wrap, v === 'step');
							await p.saveSettings();
						})
				);
			const outer = host;
			host = arrowFold.inner;
			const stepFold = fold(p.settings.arrowTap !== 'heading');
			host = outer;
			slider('Step per tap', 'How far one tap scrolls, in pixels.', 'stepSize', 40, 600, 10, undefined, stepFold.inner);
			slider('Hold speed', 'How fast the note scrolls while you hold an arrow. Higher is faster.', 'holdSpeed', 100, 4000, 20, undefined, arrowFold.inner);
		}
		host = containerEl;
		styleFolds.mm = fold(p.settings.style !== 'scrollbar');
		host = styleFolds.mm.inner;
		{
			new Setting(host)
				.setName('Fast rendering')
				.setDesc('Makes the minimap run faster on long notes. It looks the same.')
				.addToggle((t) =>
					t.setValue(p.settings.fastRender).onChange(async (v) => {
						p.settings.fastRender = v;
						await p.saveSettings();
					})
				);

			slider('Width', 'How wide the minimap is, as a % of the note.', 'width', 3, 30, 1);
			slider('Top offset', 'How far down from the top it starts, in %.', 'top', 0, 50, 1);
			slider('Height', 'How tall the minimap is, as a % of the note.', 'height', 20, 100, 5);
		
		}
		host = containerEl;

		new Setting(containerEl).setName('Scrolling').setHeading();

		new Setting(containerEl)
			.setName('Smooth scrolling')
			.setDesc('Scroll with a soft glide instead of jumping.')
			.addToggle((t) =>
				t.setValue(p.settings.smooth).onChange(async (v) => {
					p.settings.smooth = v;
					this.setFold(smoothFold.wrap, v);
					await p.saveSettings();
				})
			);

		const smoothFold = fold(p.settings.smooth);
		slider('Glide length', 'How long the glide lasts, in milliseconds. Longer is softer.', 'smoothMs', 80, 800, 20, undefined, smoothFold.inner);

		{
			const cur = p.settings.refreshRate || 0;
			const rates = [60, 90, 120, 144];
			if (cur && !rates.includes(cur)) rates.push(cur);
			rates.sort((a, b) => a - b);
			let rateDD = null;
			new Setting(containerEl)
				.setName('Screen refresh rate')
				.setDesc('Helps arrow scrolling stay smooth. Leave on Automatic unless it looks jumpy.')
				.addDropdown((d) => {
					rateDD = d;
					d.addOption('0', 'Automatic');
					for (const r of rates) d.addOption(String(r), r + ' Hz');
					d.setValue(String(cur)).onChange(async (v) => {
						p.settings.refreshRate = Number(v) || 0;
						p.settings.refreshAsked = true;
						await p.saveSettings();
					});
				})
				.addButton((b) =>
					b.setButtonText('Measure').onClick(() => {
						new RefreshRateModal(this.app, p, () => {
							// Show the measured rate in the dropdown without rebuilding the page.
							const now = p.settings.refreshRate || 0;
							if (rateDD && !rateDD.selectEl.querySelector('option[value="' + now + '"]')) rateDD.addOption(String(now), now + ' Hz');
							if (rateDD) rateDD.setValue(String(now));
						}).open();
					})
				);
		}

		new Setting(containerEl)
			.setName('Animate top and bottom bars')
			.setDesc('Slide and fade the header and the bottom bar out of the way while you scroll, and bring them back when you stop. Holding an arrow hides them; Obsidian\'s own hide-on-scroll gets the same smooth slide.')
			.addToggle((t) =>
				t.setValue(p.settings.animateBars).onChange(async (v) => {
					p.settings.animateBars = v;
					await p.saveSettings();
					p.refreshBarsSetting();
					this.setFold(barsFold.wrap, v);
				})
			);

		const barsFold = fold(p.settings.animateBars);
		{
			new Setting(barsFold.inner)
				.setName('Bar animation')
				.setDesc('How the bars leave and come back.')
				.addDropdown((d) =>
					d
						.addOption('slide-fade', 'Slide and fade')
						.addOption('slide', 'Slide only')
						.addOption('fade', 'Fade only')
						.setValue(p.settings.barsStyle || 'slide-fade')
						.onChange(async (v) => {
							p.settings.barsStyle = v;
							await p.saveSettings();
							p.applyBarsLook();
						})
				);
			slider('Bar animation speed', 'How long the bars take to move, in milliseconds. Lower is quicker.', 'barsMs', 150, 900, 10, () => p.applyBarsLook(), barsFold.inner);
		}

		new Setting(containerEl).setName('Performance').setHeading();

		new Setting(containerEl)
			.setName('Get ready while Obsidian starts')
			.setDesc('Does the first-time work while Obsidian is still opening, so the first scroll is smooth. Takes effect next time Obsidian starts.')
			.addToggle((t) =>
				t.setValue(p.settings.startPrep).onChange(async (v) => {
					p.settings.startPrep = v;
					if (!v) p.removeStartHook();
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Faster loading and smoother holding')
			.setDesc('Opens notes faster and makes holding an arrow smoother on long or heavy notes.')
			.addToggle((t) =>
				t.setValue(p.settings.holdLite).onChange(async (v) => {
					p.settings.holdLite = v;
					if (!v) {
						p.liteOff();
						p.uninstallLoadBoost();
					} else {
						p._boostBad = false;
						p.installLoadBoost();
						p.warmSoon();
					}
					for (const st of p.states.values()) {
						st.cmBad = false;
						st.peekWait = 0;
					}
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Hold back jumps')
			.setDesc('Stops sudden jumps while you hold an arrow: if the note moves more than the text did, it is put back.')
			.addToggle((t) =>
				t.setValue(p.settings.holdGuard !== false).onChange(async (v) => {
					p.settings.holdGuard = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Scroll diagnostics')
			.setDesc('After holding an arrow, show a short report on how smooth it was. Only for troubleshooting.')
			.addToggle((t) =>
				t.setValue(p.settings.diagnostics).onChange(async (v) => {
					p.settings.diagnostics = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl).setName('Other').setHeading();

		new Setting(containerEl)
			.setName('Hide on mobile')
			.setDesc('Turn the minimap off on phones and tablets.')
			.addToggle((t) =>
				t.setValue(p.settings.hideOnMobile).onChange(async (v) => {
					p.settings.hideOnMobile = v;
					await p.saveSettings();
				})
			);

		this.renderExclusions(containerEl);
	}

	// Fine control for a slider: a minus and a plus button that move it exactly one step (hold to repeat), and a
	// number that always shows the current value, so you no longer have to land a finger on the exact notch.
	addFineControls(sl, min, max, step, apply) {
		const ctl = sl.sliderEl.parentElement;
		if (!ctl) return;
		const dec = step < 1 ? (String(step).split('.')[1] || '').length : 0;
		const fmt = (v) => (dec ? Number(v).toFixed(dec) : String(Math.round(Number(v))));

		const readout = createEl('span', { cls: 'nm-slider-value' });
		const bubbleHooks = { show: () => {}, hide: () => {}, bubble: null };
		// The filled part of the pill track follows the value (CSS reads --nm-frac, 0 to 1).
		const show = () => {
			readout.setText(fmt(sl.getValue()));
			if (bubbleHooks.bubble) bubbleHooks.bubble.setText(fmt(sl.getValue()));
			(sl.sliderEl.parentElement || sl.sliderEl).style.setProperty('--nm-frac', String(Math.min(1, Math.max(0, (Number(sl.getValue()) - min) / (max - min || 1)))));
		};

		// The thumb glides to its new place instead of jumping. A range input only sits on whole steps, so while it
		// glides the step is lifted (step="any"), then put back and the value snapped to the exact target. The setting
		// itself changes at once; only the picture eases. Pressing again mid-glide carries on from where the thumb is.
		const input = sl.sliderEl;
		const GLIDE_MS = 170;
		let raf = 0;
		let tgt = null; // where the glide is heading
		const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

		const endGlide = () => {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			tgt = null;
			input.step = String(step);
			input.removeClass('nm-slider-gliding');
		};

		const glideTo = (to) => {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			const from = Number(input.value);
			if (reduced() || from === to) {
				endGlide();
				sl.setValue(to);
				return;
			}
			tgt = to;
			input.step = 'any';
			input.addClass('nm-slider-gliding');
			const t0 = performance.now();
			const frame = (now) => {
				const t = Math.min(1, (now - t0) / GLIDE_MS);
				if (t < 1) {
					sl.setValue(from + (to - from) * (1 - Math.pow(1 - t, 3)));
					raf = requestAnimationFrame(frame);
				} else {
					endGlide();
					sl.setValue(to);
				}
			};
			raf = requestAnimationFrame(frame);
		};

		// A finger on the slider itself takes over from any glide.
		input.addEventListener('pointerdown', endGlide);

		const pop = () => {
			readout.removeClass('nm-pop');
			void readout.offsetWidth; // restart the animation if it is still playing
			readout.addClass('nm-pop');
		};

		const stepBy = (dir) => {
			const cur = tgt !== null ? tgt : Number(sl.getValue());
			let nv = Math.round((cur - min) / step) * step + min + dir * step;
			nv = Math.min(max, Math.max(min, Number(nv.toFixed(dec))));
			if (nv === cur) return;
			glideTo(nv);
			apply(nv);
		};

		const makeBtn = (label, dir, aria) => {
			const btn = createEl('button', { cls: ['nm-step-btn', dir < 0 ? 'nm-step-minus' : 'nm-step-plus'], attr: { 'aria-label': aria, type: 'button' } });
			let delay = null;
			let rep = null;
			const stop = () => {
				if (delay) window.clearTimeout(delay);
				if (rep) window.clearInterval(rep);
				delay = rep = null;
			};
			btn.addEventListener('pointerdown', (e) => {
				e.preventDefault();
				stop();
				bubbleHooks.show();
				stepBy(dir);
				// Holding repeats, after a short pause so a single tap is always exactly one step.
				delay = window.setTimeout(() => {
					delay = null;
					rep = window.setInterval(() => stepBy(dir), 90);
				}, 400);
			});
			for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => { stop(); bubbleHooks.hide(450); });
			btn.addEventListener('contextmenu', (e) => e.preventDefault());
			return btn;
		};

		// One row of its own holds [minus] [slider] [plus] [number]. Obsidian's phone layout stretches loose buttons and
		// wraps controls, which pushed the slider off the screen; inside this row nothing can grow past the width.
		const row = createDiv({ cls: 'nm-slider-row' });
		ctl.insertBefore(row, sl.sliderEl);
		row.appendChild(makeBtn('\u2212', -1, 'Decrease by one step'));
		// The groove is drawn by two plain elements behind the input, so the thumb sits dead centre on it.
		const wrap = createDiv({ cls: 'nm-slider-wrap' });
		const groove = wrap.createDiv({ cls: 'nm-slider-groove' });
		groove.createDiv({ cls: 'nm-slider-fill' });
		wrap.appendChild(sl.sliderEl);
		wrap.createDiv({ cls: 'nm-slider-thumb' });
		// The pop-up that grows out of the pill while the slider is in use and shows the number.
		const bubble = wrap.createDiv({ cls: 'nm-slider-bubble' });
		let hideT = 0;
		const showBubble = () => {
			window.clearTimeout(hideT);
			row.addClass('nm-active');
		};
		const hideBubble = (delay) => {
			window.clearTimeout(hideT);
			hideT = window.setTimeout(() => row.removeClass('nm-active'), delay);
		};
		sl.sliderEl.addEventListener('pointerdown', showBubble);
		for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'change']) sl.sliderEl.addEventListener(ev, () => hideBubble(150));
		bubbleHooks.show = showBubble;
		bubbleHooks.hide = hideBubble;
		bubbleHooks.bubble = bubble;
		row.appendChild(wrap);
		row.appendChild(makeBtn('+', 1, 'Increase by one step'));
		row.appendChild(readout);
		// Anything else Obsidian put next to the slider (its own value label) would repeat our number: hide it.
		for (const k of Array.from(ctl.children)) if (k !== row) k.style.display = 'none';
		const item = ctl.closest('.setting-item');
		if (item) item.addClass('nm-slider-setting');

		// Keep the number right when the slider is dragged, or set from code (the reset button glides it).
		sl.sliderEl.addEventListener('input', show);
		const setValue = sl.setValue.bind(sl);
		sl.setValue = (v) => {
			const r = setValue(v);
			show();
			return r;
		};
		show();
	}

	// Adds a reset button that puts the given settings back to their defaults. The icon spins and the
	// slider glides to its default value instead of jumping.
	withReset(setting, keys, comps) {
		const p = this.plugin;
		setting.addExtraButton((b) =>
			b
				.setIcon('rotate-ccw')
				.setTooltip('Reset to default')
				.onClick(async () => {
					const btn = b.extraSettingsEl;
					btn.removeClass('nm-reset-spin');
					void btn.offsetWidth; // restart the animation if clicked again
					btn.addClass('nm-reset-spin');
					window.setTimeout(() => btn.removeClass('nm-reset-spin'), 600);

					for (const k of keys) {
						const sl = comps && comps[k];
						p.settings[k] = DEFAULTS[k];
						if (!sl || !sl.sliderEl) continue;
						const from = Number(sl.getValue());
						const to = typeof DEFAULTS[k] === 'number' ? DEFAULTS[k] : k === 'thumbWidth' ? p.barWidth() : p.inset(k);
						sl.sliderEl.addClass('nm-slider-gliding');
						const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
						const dur = reduce || from === to ? 0 : 380;
						const t0 = performance.now();
						const step = (now) => {
							const t = dur ? Math.min(1, (now - t0) / dur) : 1;
							const e = 1 - Math.pow(1 - t, 3); // ease-out
							sl.setValue(from + (to - from) * e);
							if (t < 1) requestAnimationFrame(step);
							else {
								sl.setValue(to);
								sl.sliderEl.removeClass('nm-slider-gliding');
							}
						};
						requestAnimationFrame(step);
					}
					await p.saveSettings();
				})
		);
		return setting;
	}

	// One colour setting. A row with "Auto" and "Custom" switches between following the theme and using your own
	// colour. Custom opens a panel holding the hex box, the picker and the quick picks. Typing a code or tapping a
	// colour makes it Custom; tapping Auto goes back to the theme, and tapping Custom again brings back the last
	// custom colour.
	addColorSetting(containerEl, { name, desc, key, fallback }) {
		const p = this.plugin;
		let picker = null;
		let text = null;
		if (!p._lastCustomColour) p._lastCustomColour = {};
		const remember = (hex) => {
			if (hex) p._lastCustomColour[key] = hex;
		};
		remember(p.settings[key]);

		const swatchButtons = []; // { btn, hex, tick } for the quick picks
		let autoBtn = null;
		let customBtn = null;
		let customDot = null;
		let panel = null;
		// Custom was tapped but no colour has been chosen yet: the panel is open with an empty box, and the colour
		// stays on the theme until a code is typed or a colour is picked.
		let pendingCustom = false;
		let panelOpen = null; // unknown until the first draw, which sets it without animating
		let panelAnim = null;
		let inner = null;

		// Opens or closes the panel. Opening: the page layout changes once and the contents fade and slide in (cheap on
		// a phone). Closing: the panel shrinks back to its small size over a longer, softer curve. While it shrinks the
		// settings below it are given their own graphics layers, so they glide up without being redrawn on every frame.
		let endClose = null; // stops a close that is still running and puts everything back
		const setPanelOpen = (open) => {
			if (!panel || open === panelOpen) return;
			const first = panelOpen === null;
			panelOpen = open;
			if (endClose) endClose(false);
			if (panelAnim) {
				panelAnim.onfinish = null;
				panelAnim.cancel();
				panelAnim = null;
			}
			const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (first || reduced || !inner.animate || !panel.animate) {
				panel.toggleClass('is-closed', !open);
				return;
			}
			if (open) {
				panel.removeClass('is-closed');
				panelAnim = inner.animate(
					[
						{ opacity: 0, transform: 'translateY(-14px)' },
						{ opacity: 1, transform: 'translateY(0)' },
					],
					{ duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
				);
				panelAnim.onfinish = () => {
					panelAnim = null;
				};
				return;
			}

			const full = panel.offsetHeight;
			const below = [];
			for (let n = setting.settingEl.nextElementSibling; n && below.length < 40; n = n.nextElementSibling) below.push(n);
			for (const n of below) n.style.willChange = 'transform';
			panel.addClass('nm-colour-collapsing');
			const hAnim = panel.animate([{ height: full + 'px', marginTop: '0px' }, { height: '0px', marginTop: '-12px' }], {
				duration: 460,
				easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
				fill: 'forwards',
			});
			const fAnim = inner.animate(
				[
					{ opacity: 1, transform: 'translateY(0)' },
					{ opacity: 0, transform: 'translateY(-18px)' },
				],
				{ duration: 300, easing: 'ease-in', fill: 'forwards' }
			);
			panelAnim = hAnim;
			endClose = (finished) => {
				endClose = null;
				hAnim.onfinish = null;
				panel.toggleClass('is-closed', finished);
				hAnim.cancel();
				fAnim.cancel();
				panel.removeClass('nm-colour-collapsing');
				for (const n of below) n.style.willChange = '';
				if (panelAnim === hAnim) panelAnim = null;
			};
			hAnim.onfinish = () => endClose && endClose(true);
		};

		const markSelected = () => {
			const cur = p.settings[key] || '';
			const custom = cur !== '' || pendingCustom;
			for (const { btn, hex, tick } of swatchButtons) {
				const on = hex === cur;
				btn.toggleClass('is-selected', on);
				btn.setAttr('aria-pressed', on ? 'true' : 'false');
				lockStyle(btn, {
					outline: on ? '2px solid var(--text-normal)' : 'none',
					'outline-offset': '2px',
				});
				lockStyle(tick, { display: on ? 'inline-flex' : 'none' });
			}
			if (autoBtn) {
				autoBtn.toggleClass('is-selected', !custom);
				autoBtn.setAttr('aria-pressed', custom ? 'false' : 'true');
			}
			if (customBtn) {
				customBtn.toggleClass('is-selected', custom);
				customBtn.setAttr('aria-pressed', custom ? 'true' : 'false');
				if (customDot) customDot.style.background = custom ? cur : 'transparent';
			}
			setPanelOpen(custom);
		};

		// Sets a custom colour from anywhere (hex box, picker, quick pick, the Custom button).
		const setColour = async (hex) => {
			pendingCustom = false;
			p.settings[key] = hex;
			remember(hex);
			if (text) {
				text.setValue(hex);
				text.inputEl.removeClass('nm-input-error');
			}
			if (picker) picker.setValue(hex);
			markSelected();
			await p.saveSettings();
		};

		const setAuto = async () => {
			pendingCustom = false;
			p.settings[key] = '';
			if (text) {
				text.setValue('');
				text.inputEl.removeClass('nm-input-error');
			}
			markSelected();
			await p.saveSettings();
		};

		const setting = new Setting(containerEl).setName(name).setDesc(desc);
		setting.settingEl.addClass('nm-swatch-setting');
		lockStyle(setting.settingEl, { 'flex-direction': 'column', 'align-items': 'stretch', gap: '8px' });
		lockStyle(setting.controlEl, {
			display: 'flex',
			'flex-direction': 'column',
			'align-items': 'stretch',
			'justify-content': 'flex-start',
			width: '100%',
			gap: '12px',
		});

		// Auto / Custom switch.
		const modes = setting.controlEl.createDiv({ cls: 'nm-colour-modes' });
		autoBtn = modes.createEl('button', {
			cls: 'nm-colour-mode',
			attr: { type: 'button', 'aria-label': 'Follow the theme' },
		});
		autoBtn.createSpan({ text: 'Auto' });
		setIcon(autoBtn.createSpan({ cls: 'nm-swatch-tick' }), 'check');
		autoBtn.addEventListener('click', () => {
			if (p.settings[key] || pendingCustom) setAuto();
		});

		customBtn = modes.createEl('button', {
			cls: 'nm-colour-mode',
			attr: { type: 'button', 'aria-label': 'Use a custom colour' },
		});
		customDot = customBtn.createSpan({ cls: 'nm-colour-dot' });
		customBtn.createSpan({ text: 'Custom' });
		setIcon(customBtn.createSpan({ cls: 'nm-swatch-tick' }), 'check');
		customBtn.addEventListener('click', () => {
			if (p.settings[key] || pendingCustom) return;
			const last = p._lastCustomColour[key];
			if (last) {
				setColour(last); // going back to a custom colour you already chose
			} else {
				pendingCustom = true; // first time: an empty box waiting for a code
				if (text) text.setValue('');
				markSelected();
			}
		});

		// Custom panel: it opens and closes with a slide.
		panel = setting.controlEl.createDiv({ cls: 'nm-colour-panel' });
		inner = panel.createDiv({ cls: 'nm-colour-panel-inner' });
		const inputs = inner.createDiv({ cls: 'nm-colour-inputs' });

		setting.addText((t) => {
			text = t;
			const el = t.inputEl;
			el.addClass('nm-hex-input');
			// Stop the keyboard from "helping": no suggestions, no auto-correct, no capitals.
			el.setAttribute('autocomplete', 'off');
			el.setAttribute('autocorrect', 'off');
			el.setAttribute('autocapitalize', 'off');
			el.setAttribute('spellcheck', 'false');
			el.setAttribute('maxlength', '7');
			el.setAttribute('enterkeyhint', 'done');
			inputs.appendChild(el);

			// Typing never rewrites what you typed. Only a complete 6-digit code is applied
			// while typing; a short code like "cac" is left alone until you finish (blur / Enter).
			t.setPlaceholder('Input hex code')
				.setValue(p.settings[key] || '')
				.onChange(async (v) => {
					const raw = v.trim();
					if (raw === '') {
						el.removeClass('nm-input-error');
						return; // an empty box while typing changes nothing; Auto is its own button
					}
					const body = raw.replace(/^#/, '');
					if (!/^[0-9a-fA-F]*$/.test(body) || body.length > 6) {
						el.addClass('nm-input-error');
						return;
					}
					if (body.length === 6) {
						await setColour('#' + body.toLowerCase());
						return;
					}
					el.removeClass('nm-input-error'); // still typing
				});

			const finish = async () => {
				const raw = el.value.trim();
				if (raw === '') {
					el.value = p.settings[key] || ''; // nothing typed: put the current colour back
					el.removeClass('nm-input-error');
					return;
				}
				const hex = normalizeHex(raw);
				if (!hex) {
					el.addClass('nm-input-error');
					return;
				}
				el.value = hex; // 3-digit shorthand is expanded only now
				await setColour(hex);
			};
			el.addEventListener('blur', finish);
			el.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					el.blur();
				}
			});
		});

		setting.addColorPicker((c) => {
			picker = c;
			c.setValue(p.settings[key] || p._lastCustomColour[key] || fallback).onChange(async (v) => {
				await setColour(v);
			});
			inputs.appendChild(c.colorPickerEl);
		});

		// Quick picks inside the panel: tap a swatch to use that colour. Read from the live theme, so they follow it.
		const addSwatch = (grid, hex, label) => {
			const btn = grid.createEl('button', {
				cls: 'nm-swatch',
				attr: {
					type: 'button',
					'aria-label': label + ' ' + hex,
					title: label + ' ' + hex,
				},
			});
			// Fixed-size pill. Set inline (and !important) so theme or mobile button styles, or a stale
			// stylesheet, cannot stretch it.
			lockStyle(btn, {
				display: 'inline-flex',
				'align-items': 'center',
				'justify-content': 'center',
				'box-sizing': 'border-box',
				flex: '0 0 auto',
				width: '64px',
				'min-width': '64px',
				'max-width': '64px',
				height: '36px',
				margin: '0',
				padding: '0',
				'border-radius': '999px',
				border: '1px solid var(--background-modifier-border)',
				'box-shadow': 'none',
				cursor: 'pointer',
				'font-size': '12px',
				'font-weight': '600',
			});
			return btn;
		};

		let groups = [];
		try {
			groups = collectSwatchGroups(inner);
		} catch (e) {
			console.error('My Note Minimap [Scrollbar]: could not read theme colours', e);
		}

		for (const g of groups) {
			const group = inner.createDiv({ cls: 'nm-swatch-group' });
			lockStyle(group, { width: '100%' });
			const label = group.createDiv({ cls: 'nm-swatch-label', text: g.label });
			lockStyle(label, { 'text-align': 'left', width: '100%', 'margin-bottom': '6px' });
			const grid = group.createDiv({ cls: 'nm-swatch-grid' });
			lockStyle(grid, {
				display: 'flex',
				'flex-flow': 'row wrap',
				'justify-content': 'flex-start',
				'align-items': 'center',
				gap: '10px',
				width: '100%',
			});
			for (const item of g.items) {
				const btn = addSwatch(grid, item.hex, item.name);
				lockStyle(btn, { background: item.hex, color: readableOn(item.hex) });
				const tick = btn.createSpan({ cls: 'nm-swatch-tick' });
				setIcon(tick, 'check');
				btn.addEventListener('click', () => setColour(item.hex));
				swatchButtons.push({ btn, hex: item.hex, tick });
			}
		}

		markSelected();
	}

	renderExclusions(containerEl) {
		const p = this.plugin;
		const ex = new Setting(containerEl)
			.setName('Exclusions')
			.setDesc('Files or folders that should not show the bar.');
		ex.settingEl.addClass('nm-exclusion-setting');

		const wrap = ex.controlEl.createDiv({ cls: 'nm-exclusion-input-wrap nm-validation-relative' });
		const input = wrap.createEl('input', {
			type: 'text',
			cls: 'nm-exclusion-input',
			placeholder: 'Folder/Note.md',
		});
		let tip = null;
		const clearError = () => {
			input.removeClass('nm-input-error');
			if (tip) {
				tip.remove();
				tip = null;
			}
		};
		input.addEventListener('input', clearError);

		const tags = ex.settingEl.createDiv({ cls: 'nm-exclusion-tags' });
		const drawTags = () => {
			tags.empty();
			if (!p.settings.exclusions.length) {
				tags.createDiv({ cls: 'nm-exclusion-empty', text: 'No exclusions.' });
				return;
			}
			for (const path of p.settings.exclusions) {
				const tag = tags.createDiv({ cls: 'nm-exclusion-tag' });
				tag.createSpan({ cls: 'nm-exclusion-tag-text', text: path });
				const rm = tag.createEl('button', { cls: 'nm-exclusion-tag-remove', text: '×' });
				rm.addEventListener('click', async () => {
					p.settings.exclusions = p.settings.exclusions.filter((x) => x !== path);
					await p.saveSettings();
					drawTags();
				});
			}
		};

		ex.addButton((b) =>
			b.setButtonText('Add exclusion').onClick(async () => {
				const v = input.value.trim();
				if (!v) {
					input.addClass('nm-input-error');
					if (!tip) tip = wrap.createDiv({ cls: 'nm-validation-tooltip', text: 'Enter a file or folder path.' });
					return;
				}
				if (!p.settings.exclusions.includes(v)) p.settings.exclusions.push(v);
				input.value = '';
				clearError();
				await p.saveSettings();
				drawTags();
			})
		);

		drawTags();
	}
}

NoteMinimapPlugin.classify = (text) => classify(text, 0).items;
module.exports = NoteMinimapPlugin;

/* nosourcemap */
/* nosourcemap */