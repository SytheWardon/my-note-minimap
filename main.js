'use strict';

const { Plugin, MarkdownView, PluginSettingTab, Setting, Platform, Notice, debounce, setIcon } = require('obsidian');

const DEFAULTS = {
	style: 'scrollbar', // 'scrollbar' or 'minimap'
	thumbWidth: 18, // px, visible thumb
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
	showArrows: false,
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
	exclusions: [],
};

const LINE_H = 2; // px per bar
const GAP = 1; // px between bars
const MAX_ROWS = 3000; // very long notes are sampled

// Accepts "#abc", "abc", "#aabbcc" or "aabbcc" and returns "#aabbcc", or null if invalid.
function normHex(v) {
	let h = String(v).trim().replace(/^#/, '');
	if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
	return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : null;
}

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
		this.settings.ver = 4;
		this.states = new Map();
		this.barsHidden = false;
		this.barsTimer = null;
		this.buttons = new Map(); // view -> header button

		this.addSettingTab(new MinimapSettingTab(this.app, this));

		const refresh = () => this.refreshAll();
		const refreshSoon = debounce(() => this.refreshAll(), 300, true);

		this.registerEvent(this.app.workspace.on('layout-change', refresh));
		this.registerEvent(this.app.workspace.on('active-leaf-change', refresh));
		this.registerEvent(this.app.workspace.on('file-open', refresh));
		this.registerEvent(this.app.workspace.on('editor-change', refreshSoon));
		this.app.workspace.onLayoutReady(refresh);

		// A rotation or a window resize can change the safe areas, so re-measure.
		this.registerDomEvent(window, 'resize', debounce(() => {
			this._safe = null;
			this.refreshAll();
		}, 250, true));
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
		const even = (n) => Math.round(n / 2) * 2;
		if (!Platform.isMobile) return { insetTop: 0, insetBottom: 0, insetEdge: 0 };
		if (!this._safe) this._safe = this.readSafeInsets();
		const safe = this._safe;
		// The long side of the screen in CSS px, so it is the same in portrait and landscape.
		const long = Math.max(screen.width || 0, screen.height || 0);
		const H = long >= 480 ? long : 868;
		let top = even(Math.max(64, H * 0.1014));
		let bottom = even(Math.max(40, H * 0.0691));
		top = Math.max(top, even(safe.top + 60));
		bottom = Math.max(bottom, even(safe.bottom + 36));
		const sideInset = this.settings.side === 'left' ? safe.left : safe.right;
		return { insetTop: top, insetBottom: bottom, insetEdge: Math.max(2, Math.ceil(sideInset)) };
	}

	// The margin actually in use: your own value, or this device's automatic one.
	inset(key) {
		const v = this.settings[key];
		return typeof v === 'number' ? v : this.device()[key];
	}

	onunload() {
		for (const view of Array.from(this.states.keys())) this.detach(view);
		this.clearButtons();
		this.setBars(false);
		document.body.removeClass('nm-animate-bars');
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

	// Called every frame the engine moves the note. Down hides, up (or the very top) shows.
	trackBars(st, pos) {
		if (!this.settings.animateBars) return;
		document.body.addClass('nm-animate-bars');
		const d = pos - st.barLast;
		st.barLast = pos;
		if (d === 0) return;
		if ((d > 0) !== (st.barAcc > 0)) st.barAcc = 0; // direction changed
		st.barAcc += d;
		if (pos < 12 || st.barAcc < -14) this.setBars(false);
		else if (st.barAcc > 36) this.setBars(true);
	}

	// When the note stops, bars that are still away come back after a short pause.
	settleBars() {
		if (!this.settings.animateBars || !this.barsHidden) return;
		if (this.barsTimer) clearTimeout(this.barsTimer);
		this.barsTimer = setTimeout(() => this.setBars(false), 1100);
	}

	// ---- Header button: scrollbar touch on / off ----------------------------

	async toggleTouch() {
		this.settings.touchEnabled = !this.settings.touchEnabled;
		await this.saveSettings();
		new Notice(this.settings.touchEnabled ? 'Scrollbar touch: on' : 'Scrollbar touch: off', 1500);
	}

	syncButtons(live) {
		if (!this.settings.touchButton) {
			this.clearButtons();
			return;
		}
		for (const view of live) {
			if (!this.buttons.has(view)) {
				this.buttons.set(view, view.addAction('hand', 'Scrollbar touch', () => this.toggleTouch()));
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
			btn.toggleClass('is-active', on);
			btn.setAttribute('aria-label', on ? 'Scrollbar touch: on (tap to turn off)' : 'Scrollbar touch: off (tap to turn on)');
		}
	}

	clearButtons() {
		for (const btn of this.buttons.values()) btn.remove();
		this.buttons.clear();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshAll();
	}

	isExcluded(path) {
		return this.settings.exclusions.some((ex) => {
			const e = ex.replace(/\/+$/, '');
			return path === e || path.startsWith(e + '/');
		});
	}

	refreshAll() {
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
			barLast: 0,
			barAcc: 0,
			ro: null,
		};

		st.onScroll = () => {
			if (!st.running) this.updateViewport(st);
		};
		// If the finger or wheel scrolls the note itself, stop gliding and let it.
		st.onUser = () => this.engineStop(st);
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
				this.updateViewport(st);
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

		el.addEventListener(
			'wheel',
			(e) => {
				this.bindScroller(view, st);
				if (!st.scroller) return;
				e.preventDefault();
				// Lines / pages -> pixels, and cap a huge notch so one flick cannot teleport.
				const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? st.scroller.clientHeight : 1;
				this.nudge(st, Math.max(-600, Math.min(600, e.deltaY * unit)));
			},
			{ passive: false }
		);

		st.ro = new ResizeObserver(() => this.updateViewport(st));
		st.ro.observe(host);

		this.states.set(view, st);
		return st;
	}

	detach(view) {
		const st = this.states.get(view);
		if (!st) return;
		this.engineStop(st);
		this.unbind(st);
		if (st.ro) st.ro.disconnect();
		st.el.remove();
		st.host.removeClass('note-minimap-host', 'note-minimap-pad-left', 'note-minimap-pad-right');
		st.host.style.removeProperty('--nm-width');
		this.states.delete(view);
	}

	// ---- Scroll engine -------------------------------------------------------
	// One critically damped spring drives every movement (taps, arrows, wheel,
	// dragging). Retargeting keeps the current velocity, so quick repeated
	// inputs blend together instead of restarting and stuttering.

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
		const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
		st.target = Math.min(max, Math.max(0, target));
		st.omega = omega;

		if (!this.settings.smooth) {
			this.engineStop(st);
			sc.scrollTop = st.target;
			this.updateViewport(st);
			return;
		}
		if (!st.running) {
			st.pos = sc.scrollTop;
			st.vel = 0;
			st.barLast = st.pos;
			st.barAcc = 0;
			st.running = true;
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
		const max = Math.max(0, sc.scrollHeight - sc.clientHeight);

		// Arrow held down: after a short delay the target starts moving, easing up to
		// full speed. The spring is already moving from the first tap, so there is no
		// stop-and-start between the tap and the hold.
		if (st.hold) {
			st.holdT += dt;
			const u = clamp01(st.holdT / 0.4);
			const ease = u * (2 - u); // quick to react, then settles into full speed
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
			this.updateViewport(st);
			this.trackBars(st, st.pos);
			this.settleBars();
			return;
		}

		sc.scrollTop = st.pos;
		this.updateViewport(st);
		this.trackBars(st, st.pos);
		st.raf = requestAnimationFrame(st.tick);
	}

	engineStop(st) {
		if (st.raf) cancelAnimationFrame(st.raf);
		st.raf = 0;
		st.running = false;
		st.vel = 0;
		st.hold = 0;
		st.lead = false;
		if (st.repeatTimer) clearTimeout(st.repeatTimer);
		if (st.repeat) clearInterval(st.repeat);
		st.repeatTimer = null;
		st.repeat = null;
		if (st.el) st.el.removeClass('nm-press-up', 'nm-press-down');
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
		if (st.el) st.el.addClass(dir < 0 ? 'nm-press-up' : 'nm-press-down');

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
		if (st.el) st.el.removeClass('nm-press-up', 'nm-press-down');
	}

	unbind(st) {
		if (!st.scroller) return;
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

	bindScroller(view, st) {
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
			sc.addEventListener('scroll', st.onScroll, { passive: true });
			sc.addEventListener('touchstart', st.onUser, { passive: true });
			sc.addEventListener('wheel', st.onUser, { passive: true });
		}
	}

	render(view, st) {
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		const left = s.side === 'left';

		st.el.toggleClass('nm-scrollbar', sb);
		st.el.toggleClass('nm-has-arrows', sb && s.showArrows && s.touchEnabled);
		st.el.toggleClass('nm-touch-off', !s.touchEnabled);
		if (!s.touchEnabled) {
			this.engineStop(st);
			st.dragging = false;
		}
		// A scrollbar-style strip is thin and overlays the edge, so it never reserves space.
		st.host.toggleClass('note-minimap-pad-left', !sb && left);
		st.host.toggleClass('note-minimap-pad-right', !sb && !left);
		st.el.toggleClass('note-minimap-left', left);
		st.el.toggleClass('note-minimap-right', !left);

		if (sb) {
			st.host.style.removeProperty('--nm-width');
			st.el.style.setProperty('--nm-width', Math.max(s.hitWidth, s.thumbWidth + 4) + 'px');
			st.el.style.setProperty('--nm-thumb', s.thumbWidth + 'px');
			st.el.style.setProperty('--nm-arrow', s.arrowSize + 'px');
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
			st.vpEl.style.removeProperty('transform');
			st.vpEl.style.removeProperty('top');
			st.vpEl.style.removeProperty('height');
			const w = s.width + '%';
			st.host.style.setProperty('--nm-width', w);
			st.el.style.setProperty('--nm-width', w);
			st.el.style.setProperty('--nm-top', s.top + '%');
			st.el.style.setProperty('--nm-height', s.height + '%');
		}

		if (st.style !== s.style) {
			st.style = s.style;
			st.text = null;
			st.stripH = 0;
		}

		if (sb) {
			st.linesEl.empty();
		} else {
			const text = view.getViewData();
			if (text !== st.text) {
				st.text = text;
				this.buildLines(st, classify(text));
			}
		}

		this.bindScroller(view, st);
		this.updateViewport(st);
	}

	buildLines(st, items) {
		const step = Math.max(1, Math.ceil(items.length / MAX_ROWS));
		const frag = document.createDocumentFragment();
		let row = 0;

		for (let i = 0; i < items.length; i += step, row++) {
			const it = items[i];
			if (it.cls === 'nm-blank') continue;
			const d = document.createElement('div');
			d.className = 'note-minimap-line ' + it.cls;
			d.style.setProperty('--nm-line-top', row * (LINE_H + GAP) + 'px');
			d.style.setProperty('--nm-line-height', LINE_H + 'px');
			const pct = Math.min(100, Math.max(8, (it.len / 80) * 100));
			d.style.setProperty('--nm-line-width', pct + '%');
			if (it.indent) d.style.left = Math.min(it.indent * 2, 16) + 'px';
			frag.appendChild(d);
		}

		st.linesEl.empty();
		st.linesEl.appendChild(frag);
		st.stripH = Math.ceil(items.length / step) * (LINE_H + GAP);
		st.linesEl.style.setProperty('--nm-strip-height', st.stripH + 'px');
	}

	updateViewport(st) {
		const sc = st.scroller;
		const s = this.settings;
		const sb = s.style === 'scrollbar';
		if (!sc) {
			st.vpEl.style.display = 'none';
			return;
		}

		const mapH = st.el.clientHeight;
		if (sb) st.stripH = mapH;
		if (!st.stripH) {
			st.vpEl.style.display = 'none';
			return;
		}
		st.vpEl.style.display = '';

		const sh = Math.max(1, sc.scrollHeight);
		const ch = sc.clientHeight;
		const maxScroll = Math.max(1, sh - ch);
		// While you drag the thumb it stays glued to your finger; the note catches up.
		const shown = sb && st.lead ? st.target : sc.scrollTop;
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
			// Move the thumb with a GPU transform; it stays perfectly in step with the note.
			const v = st.vpEl.style;
			v.top = '0px';
			v.height = vpH + 'px';
			v.transform = 'translate3d(0,' + vpTop + 'px,0)';
			return;
		}

		const overflow = Math.max(0, st.stripH - mapH);
		st.stripTop = -frac * overflow;

		const vpTop = (sc.scrollTop / sh) * st.stripH + st.stripTop;
		const vpH = Math.max(4, Math.min(st.stripH, (ch / sh) * st.stripH));
		st.vpH = vpH;

		e.setProperty('--nm-strip-top', st.stripTop + 'px');
		e.setProperty('--nm-vp-top', vpTop + 'px');
		e.setProperty('--nm-vp-height', vpH + 'px');
		e.setProperty('--nm-fade-top', vpTop + 'px');
		e.setProperty('--nm-fade-bot', vpTop + vpH + 'px');
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
			.setName('Header button')
			.setDesc('Show a hand button in the note header (next to the Reading view icon) to turn the touch area on and off. If the header is full, it may appear inside the three-dot menu instead.')
			.addToggle((t) =>
				t.setValue(p.settings.touchButton).onChange(async (v) => {
					p.settings.touchButton = v;
					await p.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Style')
			.setDesc('Scrollbar: a thin draggable bar that looks like the normal scrollbar. Minimap: the colour-coded overview.')
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

		const slider = (name, desc, key, min, max, step) =>
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addSlider((sl) =>
					sl
						.setLimits(min, max, step)
						.setValue(typeof p.settings[key] === 'number' ? p.settings[key] : p.inset(key))
						.setDynamicTooltip()
						.onChange(async (v) => {
							p.settings[key] = v;
							await p.saveSettings();
						})
				);

		if (p.settings.style === 'scrollbar') {
			slider('Bar width', 'Width of the visible scrollbar, in pixels.', 'thumbWidth', 6, 40, 1);
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

			let picker = null;
			let hexInput = null;
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
			slider('Touch area', 'Width of the invisible strip that grabs your finger, in pixels. Bigger is easier to hit.', 'hitWidth', 20, 140, 2);

			new Setting(containerEl)
				.setName('Arrow buttons')
				.setDesc('Add up and down arrows at the ends of the scrollbar. Tap to step, hold to keep scrolling.')
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
					if (!v) {
						p.setBars(false);
						document.body.removeClass('nm-animate-bars');
					}
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
			t.inputEl.addClass('nm-hex-input');
			t.setPlaceholder(fallback)
				.setValue(p.settings[key] || '')
				.onChange(async (v) => {
					if (v.trim() === '') {
						t.inputEl.removeClass('nm-input-error');
						p.settings[key] = '';
						markSelected();
						await p.saveSettings();
						return;
					}
					const hex = normalizeHex(v);
					if (!hex) {
						t.inputEl.addClass('nm-input-error');
						return;
					}
					t.inputEl.removeClass('nm-input-error');
					p.settings[key] = hex;
					if (picker) picker.setValue(hex);
					markSelected();
					await p.saveSettings();
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

		setting.addExtraButton((b) =>
			b
				.setIcon('rotate-ccw')
				.setTooltip('Reset')
				.onClick(async () => {
					p.settings[key] = '';
					await p.saveSettings();
					this.display();
				})
		);

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
			p.refreshAll();
			new Notice(name + ': ' + (hex || 'follows theme accent'), 1500);
		};

		const sw = new Setting(containerEl)
			.setName(name + ' quick picks')
			.setDesc('Colours taken from your current theme, so they change when your theme or wallpaper accent does. Tap one to use it. (build 1.3.2)');
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
