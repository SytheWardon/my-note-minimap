'use strict';

const { Plugin, MarkdownView, PluginSettingTab, Setting, Platform, Notice, debounce, setIcon } = require('obsidian');

const DEFAULTS = {
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
	arrowSize: 36, // px height of each arrow button (also its touch zone)
	stepSize: 120, // px scrolled per arrow tap
	holdSpeed: 1200, // px per second while an arrow is held
	smooth: true,
	animateBars: true, // slide/fade the top header and bottom bar while scrolling with the strip
	smoothMs: 340, // length of the glide animation
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

// Turns note text into one descriptor per line (class + length + indent).
function classify(text) {
	const lines = text.split('\n');
	const out = [];
	let inFront = lines.length > 0 && lines[0].trim() === '---';
	let fence = null;

	for (let n = 0; n < lines.length; n++) {
		const raw = lines[n];
		const t = raw.trim();
		let cls = 'nm-text';

		if (inFront) {
			cls = 'nm-frontmatter';
			if (n > 0 && (t === '---' || t === '...')) inFront = false;
		} else if (fence) {
			cls = 'nm-code';
			if (t.startsWith(fence)) fence = null;
		} else if (/^(```|~~~)/.test(t)) {
			fence = t.slice(0, 3);
			cls = 'nm-code';
		} else if (t === '') {
			cls = 'nm-blank';
		} else if (/^#{1,6}\s/.test(t)) {
			cls = 'nm-h' + t.match(/^#+/)[0].length;
		} else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
			cls = 'nm-hr';
		} else if (t.startsWith('>')) {
			cls = 'nm-quote';
		} else if (/^([-*+]|\d+[.)])\s/.test(t)) {
			cls = 'nm-list';
		} else if (/\*\*[^*]+\*\*|==[^=]+==|(^|[^*])\*[^*\s][^*]*\*/.test(t)) {
			cls = 'nm-em';
		}

		out.push({ cls, len: t.length, indent: raw.length - raw.trimStart().length });
	}
	return out;
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

// Sets inline styles with !important, so nothing in a theme can override them.
function lockStyle(el, styles) {
	for (const k in styles) el.style.setProperty(k, styles[k], 'important');
}

class NoteMinimapPlugin extends Plugin {
	async onload() {
		const saved = (await this.loadData()) || {};
		this.settings = Object.assign({}, DEFAULTS, saved);
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
		this.settings.ver = 5;
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
		}));
		this.registerEvent(this.app.workspace.on('editor-change', refreshSoon));
		// A theme or colour-scheme change: the canvas minimap has to pick up the new text colour.
		this.registerEvent(this.app.workspace.on('css-change', () => {
			this._mapText = null;
			for (const st of this.states.values()) st.mapDirty = true;
			this.queueRefresh();
		}));
		this.app.workspace.onLayoutReady(refresh);

		// A rotation or a window resize can change the safe areas, so re-measure.
		// Settings are written to disk shortly after the last change; make sure none is lost.
		this.registerDomEvent(document, 'visibilitychange', () => {
			if (document.visibilityState === 'hidden') this.flushSave();
		});
		this.registerDomEvent(window, 'resize', debounce(() => {
			this._safe = null;
			this.refreshAll();
		}, 250, true));
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

	onunload() {
		this._unloaded = true;
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
		document.body.toggleClass('nm-bars-hidden', hidden);
	}

	releaseBars() {
		this.setBars(false);
		this._barsCls = false;
		document.body.removeClass('nm-animate-bars');
	}

	// Called every frame the engine moves the note. Down hides, up (or the very top) shows.
	trackBars(st, pos) {
		if (!this.settings.animateBars) return;
		if (!this._barsCls) {
			this._barsCls = true;
			document.body.addClass('nm-animate-bars');
		}
		const d = pos - st.barLast;
		st.barLast = pos;
		if (d === 0) return;
		if ((d > 0) !== (st.barAcc > 0)) st.barAcc = 0; // direction changed
		st.barAcc += d;
		if (pos < 12 || st.barAcc < -14) this.setBars(false);
		else if (st.barAcc > 36) this.setBars(true);
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
			setTimeout(() => {
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
		const NS = 'http://www.w3.org/2000/svg';
		const eye = document.createElement('span');
		eye.className = 'nm-eye';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2.6');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		const shape = document.createElementNS(NS, 'g');
		shape.setAttribute('class', 'nm-eye-shape');
		const outline = document.createElementNS(NS, 'path');
		outline.setAttribute('d', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z');
		const pupil = document.createElementNS(NS, 'circle');
		pupil.setAttribute('cx', '12');
		pupil.setAttribute('cy', '12');
		pupil.setAttribute('r', '3');
		shape.appendChild(outline);
		shape.appendChild(pupil);
		const slash = document.createElementNS(NS, 'line');
		slash.setAttribute('class', 'nm-eye-slash');
		slash.setAttribute('x1', '3.5');
		slash.setAttribute('y1', '3.5');
		slash.setAttribute('x2', '20.5');
		slash.setAttribute('y2', '20.5');
		slash.setAttribute('pathLength', '1');
		svg.appendChild(shape);
		svg.appendChild(slash);
		eye.appendChild(svg);
		btn.appendChild(eye);
		this.addNotch(btn);
	}

	// Cuts a round notch from the hand icon with an SVG <mask>; CSS only animates its radius.
	addNotch(btn) {
		const icon = btn.querySelector('svg.svg-icon');
		if (!icon) return;
		const NS = 'http://www.w3.org/2000/svg';
		const id = 'nm-notch-' + Math.random().toString(36).slice(2, 9);
		const defs = document.createElementNS(NS, 'defs');
		const mask = document.createElementNS(NS, 'mask');
		mask.setAttribute('id', id);
		mask.setAttribute('maskUnits', 'userSpaceOnUse');
		mask.setAttribute('x', '0');
		mask.setAttribute('y', '0');
		mask.setAttribute('width', '24');
		mask.setAttribute('height', '24');
		const full = document.createElementNS(NS, 'rect');
		full.setAttribute('width', '24');
		full.setAttribute('height', '24');
		full.setAttribute('fill', '#fff');
		const hole = document.createElementNS(NS, 'circle');
		hole.setAttribute('class', 'nm-notch');
		hole.setAttribute('cx', '19.2');
		hole.setAttribute('cy', '19.2');
		hole.setAttribute('fill', '#000');
		mask.appendChild(full);
		mask.appendChild(hole);
		defs.appendChild(mask);
		const g = document.createElementNS(NS, 'g');
		g.setAttribute('mask', 'url(#' + id + ')');
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
		for (const [view, btn] of Array.from(this.buttons.entries())) {
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
		for (const btn of this.buttons.values()) {
			const k = on + '|' + this.settings.hideScrollbar;
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

	async saveSettings() {
		this.queueRefresh();
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
		for (const [view, st] of Array.from(this.states.entries())) {
			if (this.settings.style === 'scrollbar') this.updateViewport(st);
			// Fast rendering: a note in a background tab is rebuilt when it is shown again, not while
			// you type in another one.
			else if (this.settings.fastRender && view.containerEl.offsetParent === null) continue;
			else this.update(view);
		}
	}

	isExcluded(path) {
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
		for (const view of Array.from(this.states.keys())) {
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
			host,
			el,
			linesEl,
			vpEl,
			scroller: null,
			onScroll: null,
			onUser: null,
			text: null,
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
			repeatTimer: null,
			repeat: null,
			lead: false, // thumb follows the finger instantly while dragging it
			lastWrite: null,
			roContent: null,
			rows: [],
			items: null, // classified lines, kept for the canvas minimap
			step: 1,
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
			atTop: null,
			atBottom: null,
			ro: null,
		};

		st.onScroll = () => this.queueViewport(st);
		// If the finger or wheel scrolls the note itself, stop gliding and let it.
		st.onUser = () => {
			this.engineStop(st);
			this.settleBars();
		};
		st.tick = (now) => this.tick(st, now);

		const sbMode = () => this.settings.style === 'scrollbar';

		// The scrollTop the note should have for a pointer position on the strip.
		const targetFor = (e) => {
			const sc = st.scroller;
			const rect = el.getBoundingClientRect();
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
			this.bindScroller(view, st);
			if (!st.scroller || !st.stripH) return;
			try {
				el.setPointerCapture(e.pointerId);
			} catch (err) {
				/* ignore */
			}

			const rect = el.getBoundingClientRect();
			const y = e.clientY - rect.top;

			// Arrow buttons: tap to glide one step, hold to keep scrolling.
			if (sbMode() && this.settings.showArrows) {
				if (y < st.arrow) return this.startHold(st, -1);
				if (y > rect.height - st.arrow) return this.startHold(st, 1);
			}

			st.dragging = true;
			el.addClass('note-minimap-dragging');
			// Grabbing the thumb keeps it under the finger; tapping the track glides there.
			const onThumb = y >= st.vpTop && y <= st.vpTop + st.vpH;
			st.grab = sbMode() ? (onThumb ? y - st.vpTop : st.vpH / 2) : 0;
			st.lead = sbMode() && onThumb;
			this.glide(st, targetFor(e), onThumb ? this.dragOmega() : this.glideOmega());
			this.updateViewport(st);
		});

		el.addEventListener('pointermove', (e) => {
			if (st.dragging && st.scroller) {
				this.glide(st, targetFor(e), this.dragOmega());
				this.updateViewport(st, st.running ? st.pos : undefined);
			}
		});

		const stop = () => {
			st.dragging = false;
			el.removeClass('note-minimap-dragging');
			this.endHold(st);
			if (!st.running) st.lead = false; // otherwise cleared once the note settles
		};
		el.addEventListener('pointerup', stop);
		el.addEventListener('pointercancel', stop);
		el.addEventListener('lostpointercapture', stop);

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

		st.ro = new ResizeObserver(() => {
			st.mx = null;
			st.cvDirty = true;
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
		if (!st.running) {
			this.readMetrics(st, true);
			st.pos = sc.scrollTop;
			st.vel = 0;
			st.barLast = st.pos;
			st.barAcc = 0;
			st.running = true;
			st.lastWrite = st.pos;
			st.lastT = performance.now();
			st.raf = requestAnimationFrame(st.tick);
		}
	}

	tick(st, now) {
		const sc = st.scroller;
		if (!sc) {
			st.running = false;
			return;
		}
		const dt = Math.min(0.034, Math.max(0.001, (now - st.lastT) / 1000));
		st.lastT = now;

		// CodeMirror re-measures line heights as new lines scroll into view and nudges scrollTop
		// to keep the text steady. If we then write our own stale position, the note visibly
		// jumps back. Notice any outside change and carry the spring along with it.
		if (st.lastWrite !== undefined && st.lastWrite !== null) {
			const drift = sc.scrollTop - st.lastWrite;
			if (Math.abs(drift) > 1.5) {
				st.pos += drift;
				st.target += drift;
				st.holdGoal += drift;
				st.barLast += drift;
				st.mx = null;
			}
		}
		const mx = this.readMetrics(st);
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
			const ease = u * u * (3 - 2 * u); // smoothstep: no sudden jolt as the hold ramps to full speed
			st.target = Math.min(max, Math.max(0, st.target + st.hold * this.settings.holdSpeed * ease * dt));
			const g = this.glideOmega();
			st.omega = g + (Math.min(40, Math.max(22, g * 1.4)) - g) * ease;
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
			this.updateViewport(st);
			this.trackBars(st, st.pos);
			this.settleBars();
			return;
		}

		sc.scrollTop = st.pos;
		st.lastWrite = st.pos;
		this.updateViewport(st, st.pos);
		this.trackBars(st, st.pos);
		st.raf = requestAnimationFrame(st.tick);
	}

	engineStop(st) {
		if (st.raf) cancelAnimationFrame(st.raf);
		st.raf = 0;
		st.running = false;
		st.lastWrite = null;
		st.vel = 0;
		st.hold = 0;
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
		if (st.pressTimer) clearTimeout(st.pressTimer);
		st.pressTimer = null;
		st.pressT = performance.now();
		st.holdOn = false;
		if (st.el) {
			st.el.removeClass('nm-press-up', 'nm-press-down', 'nm-holding');
			st.el.addClass(dir < 0 ? 'nm-press-up' : 'nm-press-down');
		}

		if (!this.settings.smooth) {
			// No animation: step now, then repeat while the finger stays down.
			this.nudge(st, step);
			st.repeatTimer = setTimeout(() => {
				st.repeat = setInterval(() => this.nudge(st, step * 0.4), 90);
			}, 350);
			return;
		}

		// The press starts moving at once (a small push, then a ramp up to cruise
		// speed). Releasing early finishes the full step, so a tap always moves
		// one step and a hold never stalls between the two.
		const base = st.running ? st.target : sc.scrollTop;
		st.holdGoal = base + step;
		this.glide(st, base + step * 0.15, this.glideOmega());
		st.hold = dir;
		st.holdT = 0;
	}

	endHold(st) {
		if (st.repeatTimer) clearTimeout(st.repeatTimer);
		if (st.repeat) clearInterval(st.repeat);
		st.repeatTimer = null;
		st.repeat = null;

		const sc = st.scroller;
		if (st.hold && sc) {
			const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
			const goal = Math.min(max, Math.max(0, st.holdGoal));
			st.target = st.hold > 0 ? Math.max(st.target, goal) : Math.min(st.target, goal);
		}
		st.hold = 0; // the spring then eases the note to a soft stop
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
		if (sc === st.scroller) return;
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
				// The note's own height changes as lines are measured or rendered; the scroller's box does not.
				st.roContent = sc.querySelector('.cm-content, .markdown-preview-sizer');
				if (st.roContent) st.ro.observe(st.roContent);
			}
			sc.addEventListener('scroll', st.onScroll, { passive: true });
			sc.addEventListener('touchstart', st.onUser, { passive: true });
			sc.addEventListener('wheel', st.onUser, { passive: true });
		}
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
			const text = view.getViewData();
			if (text !== st.text) {
				st.text = text;
				if (wantCanvas) this.buildMap(st, classify(text));
				else this.buildLines(st, classify(text));
			}
		}

		this.bindScroller(view, st);
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
	buildMap(st, items) {
		const step = Math.max(1, Math.ceil(items.length / MAX_ROWS));
		st.items = items;
		st.step = step;
		st.stripH = Math.ceil(items.length / step) * ROW;
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

		const step = st.step;
		const rowCount = Math.ceil(items.length / step);
		// Only rows whose 2px bar overlaps the visible strip.
		const first = Math.max(0, Math.floor((-top - LINE_H) / ROW) + 1);
		const last = Math.min(rowCount - 1, Math.ceil((mapH - top) / ROW) - 1);
		let curCls = null;
		for (let r = first; r <= last; r++) {
			const it = items[r * step];
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
	buildLines(st, items) {
		const step = Math.max(1, Math.ceil(items.length / MAX_ROWS));
		const rows = st.rows;
		const frag = document.createDocumentFragment();
		let row = 0;

		for (let i = 0; i < items.length; i += step, row++) {
			const it = items[i];
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
				'--nm-line-top:' + row * (LINE_H + GAP) + 'px;--nm-line-width:' + pct + '%' + (left ? ';left:' + left + 'px' : '');
			frag.appendChild(d);
			rows[row] = { el: d, sig };
		}

		// The note got shorter: drop the rows past the end.
		for (let r = row; r < rows.length; r++) if (rows[r]) rows[r].el.remove();
		rows.length = row;

		st.linesEl.appendChild(frag);
		st.stripH = Math.ceil(items.length / step) * (LINE_H + GAP);
		st.linesEl.style.setProperty('--nm-strip-height', st.stripH + 'px');
		// Every bar has the same height, so it is set once on the container and inherited.
		st.linesEl.style.setProperty('--nm-line-height', LINE_H + 'px');
	}

	// Native scrolling (finger on the note, wheel, keyboard) can fire faster than the screen
	// refreshes. Redraw the thumb once per frame; the engine already redraws every frame itself.
	queueViewport(st) {
		if (st.vpQueued || st.running) return;
		st.vpQueued = true;
		requestAnimationFrame(() => {
			st.vpQueued = false;
			if (!st.dead && !st.running) this.updateViewport(st);
		});
	}

	updateViewport(st, livePos) {
		const sc = st.scroller;
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		if (!sc) {
			st.vpEl.style.display = 'none';
			return;
		}

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
		// While you drag the thumb it stays glued to your finger; the note catches up.
		const shown = sb && st.lead ? st.target : live ? livePos : sc.scrollTop;
		const frac = Math.min(1, Math.max(0, shown / maxScroll));
		const e = st.el.style;

		if (sb) {
			// Same maths as a native scrollbar thumb.
			const a = s.showArrows && s.touchEnabled ? s.arrowSize : 0;
			const trackH = Math.max(1, mapH - 2 * a);
			const vpH = Math.min(trackH, Math.max(44, (ch / sh) * trackH));
			const vpTop = a + frac * (trackH - vpH);
			st.arrow = a;
			st.trackH = trackH;
			st.stripTop = 0;
			st.vpH = vpH;
			st.vpTop = vpTop;
			const atTop = shown <= 1;
			const atBottom = shown >= maxScroll - 1;
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
			const v = st.vpEl.style;
			if (st.lastVpH !== vpH) {
				st.lastVpH = vpH;
				v.top = '0px';
				v.height = vpH + 'px';
			}
			v.transform = 'translate3d(0,' + vpTop + 'px,0)';
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
		const v = st.vpEl.style;
		if (st.lastVpH !== vpH) {
			st.lastVpH = vpH;
			v.top = '0px';
			v.height = vpH + 'px';
		}
		v.transform = 'translate3d(0,' + vpTop + 'px,0)';
		// The dimming overlays only exist while the strip is being dragged.
		if (st.dragging) {
			e.setProperty('--nm-fade-top', vpTop + 'px');
			e.setProperty('--nm-fade-bot', vpTop + vpH + 'px');
		}
	}
}

class MinimapSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		const p = this.plugin;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Touch controls')
			.setDesc('When off, the strip ignores your finger: it only shows where you are, and touches reach the note underneath. This is the same switch as the header button.')
			.addToggle((t) =>
				t.setValue(p.settings.touchEnabled).onChange(async (v) => {
					p.settings.touchEnabled = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Hide scrollbar')
			.setDesc('Hide the whole scrollbar or minimap and give the note its full width. Same as long-pressing the header button.')
			.addToggle((t) =>
				t.setValue(p.settings.hideScrollbar).onChange(async (v) => {
					p.settings.hideScrollbar = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Header button')
			.setDesc('Show a hand button in the note header (next to the Reading view icon) to turn the touch area on and off. Long-press it to hide or show the whole scrollbar. If the header is full, it may appear inside the three-dot menu instead.')
			.addToggle((t) =>
				t.setValue(p.settings.touchButton).onChange(async (v) => {
					p.settings.touchButton = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Fast rendering')
			.setDesc('Makes the minimap style much lighter on long notes: it is painted on a single canvas instead of thousands of elements, waits a little longer after you stop typing before it refreshes, and skips notes in background tabs until you switch to them. Nothing about how the note or the scrollbar looks changes. The scrollbar style is already light, so this has no effect on it.')
			.addToggle((t) =>
				t.setValue(p.settings.fastRender).onChange(async (v) => {
					p.settings.fastRender = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Style')
			.setDesc('Scrollbar: a thin draggable bar that looks like the normal scrollbar. Minimap: the colour-coded overview (very demanding, so it may lag on long notes).')
			.addDropdown((d) =>
				d
					.addOption('scrollbar', 'Scrollbar')
					.addOption('minimap', 'Minimap')
					.setValue(p.settings.style)
					.onChange(async (v) => {
						p.settings.style = v;
						await p.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName('Side')
			.setDesc('Which edge of the note the minimap sits on.')
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

		const comps = {};
		const slider = (name, desc, key, min, max, step, adjust) =>
			this.withReset(new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addSlider((sl) => {
					comps[key] = sl;
					sl
						.setLimits(min, max, step)
						.setValue(typeof p.settings[key] === 'number' ? p.settings[key] : key === 'thumbWidth' ? p.barWidth() : p.inset(key))
						.setDynamicTooltip()
						.onChange(async (v) => {
							p.settings[key] = v;
							if (adjust) adjust(v);
							await p.saveSettings();
						});
				}), [key]);

		if (p.settings.style === 'scrollbar') {
			slider('Bar width', 'Width of the visible scrollbar, in pixels. Starts at 14 and adjusts slightly to the screen of each device until you move this slider. The touch area below grows with it if it would otherwise be too narrow.', 'thumbWidth', 6, 40, 1, () => {
				const need = p.barWidth() + 6;
				if (p.settings.hitWidth < need) {
					p.settings.hitWidth = need;
					if (comps.hitWidth) comps.hitWidth.setValue(need);
				}
			});
			new Setting(containerEl)
				.setName('Shape')
				.setDesc('Corner style of the scrollbar thumb.')
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

			this.addColorSetting(containerEl, {
				name: 'Colour',
				desc: 'Thumb colour. Type a hex code (like #d19a66) or use the picker. Empty follows your theme accent.',
				key: 'thumbColor',
				fallback: '#d19a66',
			});

			slider('Opacity', 'How solid the thumb looks.', 'thumbOpacity', 0.2, 1, 0.05);

			new Setting(containerEl)
				.setName('Show track')
				.setDesc('A faint groove behind the thumb so you can see where the bar runs.')
				.addToggle((t) =>
					t.setValue(p.settings.showTrack).onChange(async (v) => {
						p.settings.showTrack = v;
						await p.saveSettings();
					})
				);

			new Setting(containerEl)
				.setName('Glow')
				.setDesc('A soft glow around the thumb.')
				.addToggle((t) =>
					t.setValue(p.settings.glow).onChange(async (v) => {
						p.settings.glow = v;
						await p.saveSettings();
						this.display();
					})
				);

			if (p.settings.glow) {
				this.addColorSetting(containerEl, {
					name: 'Glow colour',
					desc: 'Hex code for the glow. Empty uses the thumb colour.',
					key: 'glowColor',
					fallback: '#d19a66',
				});
				slider('Glow size', 'How far the glow spreads out (blur), in pixels.', 'glowBlur', 0, 40, 1);
				slider('Glow strength', 'How thick the glow is next to the thumb, in pixels.', 'glowSpread', 0, 10, 1);
				slider('Glow opacity', 'How bright the glow is.', 'glowOpacity', 0.1, 1, 0.05);
			}

			const dev = p.device();
			const auto = ['insetTop', 'insetBottom', 'insetEdge'].every((k) => p.settings[k] === null);
			new Setting(containerEl)
				.setName('Margins for this device')
				.setDesc(
					(auto ? 'Automatic: ' : 'Custom values. This device would use ') +
						'top ' + dev.insetTop + ', bottom ' + dev.insetBottom + ', edge ' + dev.insetEdge +
						' px. Moving a margin slider below makes it custom.'
				)
				.addButton((b) =>
					b
						.setButtonText('Use device defaults')
						.setDisabled(auto)
						.onClick(async () => {
							p.settings.insetTop = null;
							p.settings.insetBottom = null;
							p.settings.insetEdge = null;
							await p.saveSettings();
							this.display();
						})
				);

			slider('Top margin', 'Shortens the scrollbar from the top, so a camera cut-out or rounded corner does not cover the arrow.', 'insetTop', 0, 240, 2);
			slider('Bottom margin', 'Shortens the scrollbar from the bottom, so the gesture bar or a rounded corner does not cover the arrow.', 'insetBottom', 0, 240, 2);
			slider('Edge margin', 'Moves the scrollbar in from the side of the screen, away from curved edges, in pixels.', 'insetEdge', 0, 60, 1);
			slider('Touch area', 'Width of the scrollbar column that grabs your finger, in pixels. The bar sits inside it and the note is kept clear of it, so nothing overlaps. It is never narrower than the bar.', 'hitWidth', 20, 140, 2, (v) => {
				const need = p.barWidth() + 6;
				if (v < need) {
					p.settings.hitWidth = need;
					if (comps.hitWidth) comps.hitWidth.setValue(need);
				}
			});

			new Setting(containerEl)
				.setName('Arrow buttons')
				.setDesc('Add up and down arrows at the ends of the scrollbar. Tap an arrow to step one page-chunk, hold it to keep scrolling (it speeds up the longer you hold). While pressed, the arrow glides into a pill highlight and returns when released.')
				.addToggle((t) =>
					t.setValue(p.settings.showArrows).onChange(async (v) => {
						p.settings.showArrows = v;
						await p.saveSettings();
						this.display();
					})
				);

			if (p.settings.showArrows) {
				slider('Arrow size', 'Height of each arrow button and its touch zone, in pixels.', 'arrowSize', 14, 80, 1);
				slider('Step per tap', 'How far one arrow tap scrolls, in pixels.', 'stepSize', 40, 600, 10);
				slider('Hold speed', 'How fast the note scrolls while you hold an arrow, in pixels per second.', 'holdSpeed', 300, 4000, 100);
			}
		} else {
			slider('Width', 'Minimap width, as a % of the note width.', 'width', 3, 30, 1);
			slider('Top offset', 'Distance from the top of the note, in %.', 'top', 0, 50, 1);
			slider('Height', 'Minimap height, as a % of the note height.', 'height', 20, 100, 5);
		}

		new Setting(containerEl)
			.setName('Smooth scrolling')
			.setDesc('Glide when you tap the track, tap an arrow or use the wheel, and soften dragging.')
			.addToggle((t) =>
				t.setValue(p.settings.smooth).onChange(async (v) => {
					p.settings.smooth = v;
					await p.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Animate top and bottom bars')
			.setDesc('When the strip scrolls the note, slide the header and bottom bar away going down and glide them back going up, instead of popping.')
			.addToggle((t) =>
				t.setValue(p.settings.animateBars).onChange(async (v) => {
					p.settings.animateBars = v;
					if (!v) p.releaseBars();
					await p.saveSettings();
				})
			);

		if (p.settings.smooth) {
			slider('Glide length', 'How long a glide lasts, in milliseconds. Longer feels softer.', 'smoothMs', 80, 800, 20);
		}

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

	// Adds a reset button that puts the given settings back to their defaults.
	withReset(setting, keys) {
		const p = this.plugin;
		setting.addExtraButton((b) =>
			b
				.setIcon('rotate-ccw')
				.setTooltip('Reset to default')
				.onClick(async () => {
					for (const k of keys) p.settings[k] = DEFAULTS[k];
					await p.saveSettings();
					const box = this.containerEl;
					const top = box.scrollTop;
					this.display();
					box.scrollTop = top;
				})
		);
		return setting;
	}

	// A colour picker plus a hex text box that stay in sync. Empty text = '' (theme default).
	addColorSetting(containerEl, { name, desc, key, fallback }) {
		const p = this.plugin;
		let picker = null;
		let text = null;

		const swatchButtons = []; // { btn, hex } for the quick picks below
		const markSelected = () => {
			const cur = p.settings[key] || '';
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
		};

		const setting = new Setting(containerEl).setName(name).setDesc(desc);

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

			const apply = async (hex) => {
				el.removeClass('nm-input-error');
				p.settings[key] = hex;
				if (picker) picker.setValue(hex);
				markSelected();
				await p.saveSettings();
			};

			// Typing never rewrites what you typed. Only a complete 6-digit code is applied
			// while typing; a short code like "cac" is left alone until you finish (blur / Enter).
			t.setPlaceholder(fallback)
				.setValue(p.settings[key] || '')
				.onChange(async (v) => {
					const raw = v.trim();
					if (raw === '') {
						el.removeClass('nm-input-error');
						p.settings[key] = '';
						markSelected();
						await p.saveSettings();
						return;
					}
					const body = raw.replace(/^#/, '');
					if (!/^[0-9a-fA-F]*$/.test(body) || body.length > 6) {
						el.addClass('nm-input-error');
						return;
					}
					if (body.length === 6) {
						await apply('#' + body.toLowerCase());
						return;
					}
					el.removeClass('nm-input-error'); // still typing
				});

			const finish = async () => {
				const raw = el.value.trim();
				if (raw === '') return;
				const hex = normalizeHex(raw);
				if (!hex) {
					el.addClass('nm-input-error');
					return;
				}
				el.value = hex; // 3-digit shorthand is expanded only now
				await apply(hex);
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
			c.setValue(p.settings[key] || fallback).onChange(async (v) => {
				p.settings[key] = v;
				if (text) {
					text.setValue(v);
					text.inputEl.removeClass('nm-input-error');
				}
				markSelected();
				await p.saveSettings();
			});
		});

		// Quick picks: tap a swatch to use that colour. Read from the live theme, so they follow it.
		const pick = async (hex) => {
			p.settings[key] = hex;
			if (text) {
				text.setValue(hex);
				text.inputEl.removeClass('nm-input-error');
			}
			if (picker && hex) picker.setValue(hex);
			markSelected();
			await p.saveSettings();
			p.toast(name + ': ' + (hex || 'follows theme accent'), 700);
		};

		const sw = new Setting(containerEl)
			.setName(name + ' quick picks')
			.setDesc('Colours taken from your current theme, so they change when your theme or wallpaper accent does. Tap one to use it.');
		sw.settingEl.addClass('nm-swatch-setting');
		lockStyle(sw.settingEl, { 'flex-direction': 'column', 'align-items': 'stretch', gap: '8px' });
		lockStyle(sw.controlEl, {
			display: 'flex',
			'flex-direction': 'column',
			'align-items': 'stretch',
			'justify-content': 'flex-start',
			width: '100%',
			gap: '12px',
		});

		const addSwatch = (grid, hex, label, auto) => {
			const btn = grid.createEl('button', {
				cls: 'nm-swatch' + (auto ? ' nm-swatch-auto' : ''),
				attr: {
					type: 'button',
					'aria-label': label + (hex ? ' ' + hex : ''),
					title: label + (hex ? ' ' + hex : ''),
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
			groups = collectSwatchGroups(sw.controlEl);
		} catch (e) {
			console.error('My Note Minimap: could not read theme colours', e);
		}

		if (!groups.length) {
			sw.setDesc('No theme colours could be read. Use the hex box or picker above.');
			return;
		}

		groups.forEach((g, gi) => {
			const group = sw.controlEl.createDiv({ cls: 'nm-swatch-group' });
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

			if (gi === 0) {
				// "Theme": clears the colour so the plugin follows the theme accent on its own.
				const auto = addSwatch(grid, '', 'Follow theme accent', true);
				auto.createSpan({ cls: 'nm-swatch-auto-text', text: 'Auto' });
				lockStyle(auto, {
					background: 'var(--interactive-accent)',
					color: 'var(--text-on-accent, #ffffff)',
				});
				const tick = auto.createSpan({ cls: 'nm-swatch-tick' });
				setIcon(tick, 'check');
				auto.addEventListener('click', () => pick(''));
				swatchButtons.push({ btn: auto, hex: '', tick });
			}

			for (const item of g.items) {
				const btn = addSwatch(grid, item.hex, item.name, false);
				lockStyle(btn, { background: item.hex, color: readableOn(item.hex) });
				const tick = btn.createSpan({ cls: 'nm-swatch-tick' });
				setIcon(tick, 'check');
				btn.addEventListener('click', () => pick(item.hex));
				swatchButtons.push({ btn, hex: item.hex, tick });
			}
		});

		markSelected();
	}

	renderExclusions(containerEl) {
		const p = this.plugin;
		const ex = new Setting(containerEl)
			.setName('Exclusions')
			.setDesc('Files or folders (vault paths) that should not show a minimap.');
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

NoteMinimapPlugin.classify = classify;
module.exports = NoteMinimapPlugin;
