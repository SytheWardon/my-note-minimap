# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a colour-coded minimap or scrollbar beside each markdown note, with click-and-drag navigation. Works on desktop and mobile.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Using it](#using-it): [arrows](#using-the-arrows), [touch button](#touch-button), [pages and the page bubble](#pages-and-the-page-bubble)
- [Settings reference](#settings-reference): every setting, with defaults
- [Commands](#commands)
- [How it works](#how-it-works): [refresh rate](#screen-refresh-rate), [performance](#performance), [faster loading](#faster-loading-and-smoother-holding), [bar animation](#header-and-bottom-bar-animation), [first-run setup](#first-run-setup-phone-or-tablet-only), [diagnostics](#scroll-diagnostics)
- [Network use and privacy](#network-use-and-privacy)
- [Version history](#version-history)

## Features

- Two styles: **scrollbar** (light and smooth) or **minimap** (very demanding, may lag; see [Performance](#performance)).
- Click and drag to jump around long notes. Touch works on mobile.
- Up/down **arrow buttons** (on by default): tap to jump to the next or previous heading (or scroll one step), hold to keep scrolling.
- **Page bubble**: shows where you are in a long note while you scroll: the page (*3 of 12*), or percent read.
- **Page vibration** on phones and tablets: a light buzz as you cross into another page, or as the percent changes.
- Customise the thumb's colour, width, shape (pill, rounded, square), opacity, track and glow, and choose which side it sits on. Bar width is **automatic** by default and adapts to your screen.
- **Animated top and bottom bars**: they slide and/or fade away while you scroll.
- A settings page grouped into clear sections, with **+ / − buttons** and a live number on every slider, and a **reset** button for each group.
- A hand-icon **touch button** in the note's top menu: tap to turn touch on or off, long-press to hide the scrollbar.
- Per-device margins for notches and rounded corners.
- Option to hide on mobile, plus exclusions for files and folders.
- Optional, off-by-default update check (see [Network use and privacy](#network-use-and-privacy)).

## Installation

- **Community list:** Settings → Community plugins → Browse → search "My Note Minimap" → Install → Enable.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases) into `<your vault>/.obsidian/plugins/my-note-minimap/`, then enable it under Community plugins.

## Using it

### Using the arrows

The arrows sit at the top and bottom of the scrollbar.

- **Tap** does what *Arrow tap does* says. By default it **jumps to the next or previous heading**; a note with no heading that way scrolls one step instead. You can also set it to scroll a fixed step (set the distance with *Step per tap*). You can tap anywhere in the scrollbar column beside the arrow, not just the icon, and each arrow's tap area is 52 px tall by default (change it with *Arrow size*).
- **Press and hold** (about half a second) to keep scrolling. It eases up to full speed (set with *Hold speed*, default 200 px/s). Holding always scrolls, whatever *Arrow tap does* is set to.
- While held, the arrow glides into a pill-shaped highlight and bobs in the direction of travel at a pace that follows *Hold speed*. It slides back when you let go.
- At the very top or bottom of a note the arrow gives a small bump instead of scrolling.
- Turn the arrows off or resize them under *Arrow buttons*.

### Touch button

- **Tap** the hand icon in a note's top menu to turn the scrollbar's touch on or off. When off, the strip only shows where you are, and touches go to the note. The button is highlighted while touch is on.
- **Long-press** (about half a second) to hide or show the whole scrollbar or minimap. While hidden, the icon shows a cut-out with a small eye-with-a-slash.
- The same switches are under *Touch controls* and *Hide scrollbar*. Hide the button itself with *Header button*. If the top menu is full, it may move into the three-dot menu.

### Pages and the page bubble

Long notes are split into **pages**. While you scroll, a small **page bubble** shows where you are, for example **3 of 12**. It is on by default.

**What you see**

- A pill pops out of the thumb while the note scrolls, follows the thumb, and sits on the same side as the bar.
- It uses the thumb's colour, with black or white text for readability.
- When you stop, it settles into the bar's resting colour and shrinks away. It stays up while you drag the bar or hold an arrow.
- It does not appear when you open a note (jumping back to where you left off is not a scroll).
- With *reduce motion* on in your system, the number changes without animation.

**How pages are counted**

Pages are counted in the note's **text**, not screen heights, so rotating, unfolding or resizing never changes them.

- Each line counts as its length in characters, with a minimum of 40 so blank and short lines still take space.
- One page is **1800 characters** by default (change it with *Page length*).
- Your page is the one holding the line at the **top of the screen**. The very end of a note is always the last page.
- Works the same in the editor and the reading view.

**Page vibration** (phone or tablet only): a short buzz each time you scroll into another page, or each time the percent changes. It works with the bubble off. The first move after a pause never buzzes, and some devices (iPhone) don't allow vibration from apps.

## Settings reference

Open **Settings → My Note Minimap**. The sections below follow the order on the settings page. Where a row only appears under certain conditions, that is noted. Sliders have **− and + buttons** (hold to repeat) and always show the current value; a **reset** button on a group puts its sliders back to default with a short glide. Rows that depend on a toggle fold open and shut smoothly.

### Updates

| Setting | What it does | Default |
| --- | --- | --- |
| **Check for updates automatically** | Contacts api.github.com about once a day when Obsidian starts to look for a newer release, and shows a notice if there is one. It never installs by itself. | Off |
| **Version / Check for updates** | Shows the installed version. Tap the button to check GitHub now. While it checks, a small ring turns in the button. If a newer release exists, the button becomes **Update to X**: tap it to download and install the three release files and reload the plugin. | – |

### Controls

| Setting | What it does | Default |
| --- | --- | --- |
| **Touch controls** | Turn off to let touches pass through to the note. The bar then only shows where you are. | On |
| **Hide scrollbar** | Hide the bar and give the note the full width. | Off |
| **Header button** | Add the hand button to the note header (see [Touch button](#touch-button)). | On |

### Look

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Style** | *Scrollbar* is a thin bar you drag. *Minimap* is a small preview of your note (can be slow on long notes). | Scrollbar |
| **Side** | Which side of the screen the bar is on: *Right* or *Left*. | Right |
| **Page bubble** | Show a small circle with the page number when you scroll. | On |
| **Bubble shows** | *Page number* (3 of 12) or *Percent read*. Only shown while the bubble is on. | Page number |
| **Page length** | How much text is one page, in characters. Smaller means more, shorter pages. Only shown while the bubble is on. | 1800 (600 to 4000) |
| **Page vibration** | A light buzz as you scroll through the note. Phone or tablet only. Works even with the bubble off. | On |
| **Buzz on** | What the buzz counts: *Same as the bubble*, *Each page*, or *Each percent*. Phone or tablet only. | Same as the bubble |

**Scrollbar style only** (these rows fold away when *Style* is *Minimap*):

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Bar width** | How wide the bar is, in pixels. **Automatic** by default: about 14 px on a typical phone, nudged up or down with screen size. Setting your own value switches it off. | Automatic (6 to 40 px) |
| **Shape** | How round the bar corners are: *Pill (fully round)*, *Rounded* or *Square*. | Pill |
| **Colour** | *Auto* matches your theme. *Custom* lets you pick any colour: type a hex code, use the colour picker, or tap a quick-pick swatch. Swatches are grouped as *From your theme*, *Shades of your accent*, *Nearby hues* and *Palette*. | Auto |
| **Opacity** | How solid the bar looks. | 0.75 (0.2 to 1) |
| **Show track** | Show a faint line behind the bar. | On |
| **Glow** | Add a soft glow around the bar. Turning it on reveals the four rows below. | Off |
| **Glow colour** | *Auto* matches the bar. *Custom* lets you pick a colour, the same way as *Colour*. | Auto |
| **Glow size** | How far the glow spreads, in pixels. | 8 (0 to 40) |
| **Glow strength** | How thick the glow is, in pixels. | 1 (0 to 10) |
| **Glow opacity** | How bright the glow is. | 0.8 (0.1 to 1) |

### Margins and arrows

Scrollbar style only.

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Margins for this device** | Shows the margins worked out for this device, so the bar clears notches, rounded corners and gesture bars. **Use device defaults** puts them back to automatic after you change them. Moving any of the three margin sliders below switches to your own values. | Automatic |
| **Top margin** | Space above the bar, so the screen corner does not cover it. | Automatic (0 to 240 px) |
| **Bottom margin** | Space below the bar, so the gesture bar does not cover it. | Automatic (0 to 240 px) |
| **Edge margin** | Space between the bar and the screen edge, in pixels. | Automatic (0 to 60 px) |
| **Touch area** | How wide the area is that reacts to your finger, in pixels. It is never narrower than the bar plus its edge gap and a little air. | 64 (20 to 140 px) |
| **Arrow buttons** | Add up and down arrows. Tap to scroll a little (or jump to a heading), hold to keep scrolling. Turning it off hides the four rows below. | On |
| **Arrow size** | How big each arrow button is, in pixels. This is also its tap area. | 52 (14 to 80 px) |
| **Arrow tap does** | *Jump to heading*: a tap goes to the next or previous heading. *Scroll a step*: a tap moves the note a fixed distance. Holding always scrolls. | Jump to heading |
| **Step per tap** | How far one tap scrolls, in pixels. Only shown when *Arrow tap does* is *Scroll a step*. | 120 (40 to 600 px) |
| **Hold speed** | How fast the note scrolls while you hold an arrow. Higher is faster. | 200 px/s (100 to 4000) |

### Minimap style only

These rows fold away when *Style* is *Scrollbar*.

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Fast rendering** | Makes the minimap run faster on long notes. It looks the same. See [Performance](#performance). | On |
| **Width** | How wide the minimap is, as a % of the note. | 12 (3 to 30) |
| **Top offset** | How far down from the top it starts, in %. | 5 (0 to 50) |
| **Height** | How tall the minimap is, as a % of the note. | 60 (20 to 100) |

### Scrolling

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Smooth scrolling** | Scroll with a soft glide instead of jumping. | On |
| **Glide length** | How long the glide lasts, in milliseconds. Longer is softer. Only shown while smooth scrolling is on. | 340 ms (80 to 800) |
| **Screen refresh rate** | Helps arrow scrolling stay smooth. Leave on *Automatic* unless it looks jumpy. See [Screen refresh rate](#screen-refresh-rate). | Automatic (or 60, 90, 120, 144 Hz) |
| **Animate top and bottom bars** | Slide and fade the header and the bottom bar out of the way while you scroll, and bring them back when you stop. Holding an arrow hides them; Obsidian's own hide-on-scroll gets the same smooth slide. | On |
| **Bar animation** | How the bars leave and come back: *Slide and fade*, *Slide only* or *Fade only*. Only shown while the animation is on. | Slide and fade |
| **Bar animation speed** | How long the bars take to move, in milliseconds. Lower is quicker. Only shown while the animation is on. | 450 ms (150 to 900) |

### Performance

| Setting | What it does | Default |
| --- | --- | --- |
| **Get ready while Obsidian starts** | Does the first-time work while Obsidian is still opening, so the first scroll is smooth. Takes effect next time Obsidian starts. | On |
| **Faster loading and smoother holding** | Opens notes faster and makes holding an arrow smoother on long or heavy notes. See [Faster loading and smoother holding](#faster-loading-and-smoother-holding). | On |
| **Hold back jumps** | Stops sudden jumps while you hold an arrow: if the note moves more than the text did, it is put back. Turn it off if holding feels worse. | On |
| **Scroll diagnostics** | After holding an arrow, show a short report on how smooth it was. Only for troubleshooting. See [Scroll diagnostics](#scroll-diagnostics). | Off |

### Other

| Setting | What it does | Default |
| --- | --- | --- |
| **Hide on mobile** | Turn the minimap off on phones and tablets. | Off |
| **Exclusions** | Files or folders that should not show the bar. Type a path such as `Folder/Note.md` and tap **Add exclusion**. Each one appears as a tag you can remove. | None |

## Commands

Both are in the command palette.

- **Check for updates:** the same as the button under *Updates*. It shows a notice with the result.
- **Do nothing (pull-down action):** an empty command used by the [first-run setup](#first-run-setup-phone-or-tablet-only), so pulling down from the top of the screen no longer opens a menu. Its label is hidden when you pull down.

## How it works

### Screen refresh rate

Arrow scrolling is timed to your screen. On a phone the plugin asks once for your rate (60, 90, 120 or 144 Hz) and can measure it: tap *Measure* and keep a finger moving on the box. Change it any time under *Screen refresh rate*. Leave it on *Automatic* if unsure; a value that doesn't match the screen is ignored. Every redraw while holding moves the note by a whole number of pixels, which removes faint shimmer.

### Performance

The **scrollbar** style is light. The **minimap** draws a bar for every line (up to 3000), so it can lag on long notes and phones. If it stutters, switch to the scrollbar under *Style*, or use **Fast rendering** (on by default, minimap only, no visual change):

- **One canvas:** line data is kept in an array and only the visible bars are painted, so cost no longer grows with note length. (Custom CSS that recolours individual bars does not apply.)
- **Gentler refresh:** the minimap rebuilds about 0.8 s after you stop typing (was 0.3 s), and background tabs rebuild when you switch back.

### Faster loading and smoother holding

One setting, on by default, *Faster loading and smoother holding*. It switches itself off for the session if anything misbehaves.

**Loading**
- **Open from memory:** notes whose text is already in memory open from memory instead of being re-read from storage. Notes up to 1.5 MB too big for Obsidian's own copy get a small copy of their own, dropped on any change.
- **Hidden reading view waits:** while you are in the editor, the reading view is not built out of sight until you switch to it.
- **Read ahead:** when idle, linked and recent notes are read into memory, and the editor draws just below the screen so the first scroll doesn't stall.

**Holding an arrow**
- **Lighter screen:** the blur behind the header and bottom bar (if your theme has one) is off until the note stops.
- **Draw ahead (editor):** the next stretch is drawn slightly early, so pauses from heavy blocks (maths, callouts) land when the plugin picks.
- **Reading view:** Obsidian draws the view in slices that can take 100 ms or more on equation-heavy notes. During a hold these are held back while everything from one screen behind to three ahead is drawn, then continue when the hold ends.

Also: **Get ready while Obsidian starts** (on by default, applies next launch) does first-time work behind the loading screen, with a time limit (0.9 s on a phone). It layers the header and bottom bar, loads maths and code-colouring code if needed, renders a reading view to the end, and draws below the screen in the editor. Hidden views are skipped.

### Header and bottom bar animation

- **Animate top and bottom bars** (on by default): they slide and/or fade away while you scroll and return when you stop. Choose *Slide and fade*, *Slide only* or *Fade only*, and the speed with *Bar animation speed* (150–900 ms).
- The plugin's own hiding (holding an arrow, dragging the strip) and Obsidian's hide-on-scroll share one set of rules, so the bars move once, together, on one curve.
- The soft fade at the top (floating bars) shrinks with the header. Blur returns only after the slide finishes.
- The bars wait 0.5 s into a hold before sliding, and a slide just begun is never reversed by a small wobble.
- The bars are placed on their own graphics layers ahead of time, so the first slide doesn't hitch.
- **Hold back jumps** (on by default): during a hold, if the note moves more than the text above a reference line did, the move is put back.

### First-run setup (phone or tablet only)

After the refresh-rate pop-up, the plugin sets Obsidian's *Configure mobile Quick Action* to none, so pulling down from the top no longer opens a menu. This happens once, only from the automatic pop-up. Change it back any time under Settings → Mobile.

### Scroll diagnostics

An optional report after a hold. It shows late frames and whether they came from the plugin or from the note or screen, when in the hold the slowest frame happened, how often late frames repeat (time or distance), what ended each press, reading-view re-plans and render passes, jumps held back, draw-ahead attempts, and start-up time.

## Network use and privacy

The plugin runs on your device and collects no data. Its only network requests are for updates, and only to GitHub (the repository's releases):

- **api.github.com** (1 request): reads the latest release's version number. Made when you tap *Check for updates* (settings or command palette), or about once a day at start-up if you turn on *Check for updates automatically*. That toggle is off by default.
- **github.com** release downloads (1 request per file): `main.js`, `manifest.json` and `styles.css`, fetched only after you tap *Update to X*.

Nothing is sent about you or your notes, and nothing else leaves your device. No analytics, no telemetry.

## Version history

- **4.5.5:** Obsidian's own plugin list now shows the new version right after an update, without a restart. No other change.
- **4.5.4:** Opening the settings tab no longer reads a file from disk (that caused a small hitch). The running version is now built into `main.js`, so *Version* and *Check for updates* always use the version that is really running, including right after an update. No other change.
- **4.5.3:** The *Version* line under *Updates* now reads the installed `manifest.json` from disk, so it shows the right number right after an update (Obsidian only re-reads it at start-up, so it kept showing the old version, and *Check for updates* kept offering the same update). No other change.
- **4.5.2:** Version bump only. No change in behaviour.
- **4.5.1:** Removed the `!important` rules from the stylesheet (the update-check ring now wins by selector specificity). No change in behaviour.
- **4.5.0:** Plugin name, notices and log messages are back to *My Note Minimap* (the *[Scrollbar]* name tried in 4.3.9 and 4.4.0 is removed). No other change.
- **4.3.8:** *Arrow tap does* now defaults to *Jump to heading*. Arrow buttons are taller by default (*Arrow size* 52 px, was 36) so a single tap lands easily; the old default is upgraded once, a size you chose yourself is kept. *Check for updates* no longer makes the area behind the settings window's rounded corners flash black while it checks: the button is no longer disabled, and a small ring turns in it instead. README now lists every setting.
- **4.3.1:** Fixed *Jump to heading*: a tap that lasted a little long counted as a hold and moved the note only a few pixels, so the arrow seemed to do nothing. A press now has to last half a second to count as a hold, and a heading that is too close to move to is skipped for the next one (or a normal step). *Words read* is removed from *Bubble shows* and *Buzz on*.
- **4.3.0:** *Arrow tap does* is a new choice that replaces the old double-tap: *Scroll a step* (with *Step per tap*, which now shows only for this choice) or *Jump to heading*. *Page vibration* has a *Buzz on* choice (same as the bubble, each page, or each percent), so it works with percent with or without the bubble.
- **4.2.2:** The page bubble no longer has the *Words* and *Current heading* styles, and *Double-tap to jump to a heading* is gone. *Page vibration* now also works when the bubble shows percent: it buzzes each time the percent changes. Saved settings that used a removed style fall back to the page number.
- **4.2.1:** *Double-tap an arrow* jumps to the next or previous heading. The page bubble can show percent read, words or the current heading, and phones get an optional *page vibration*. New *Updates* section at the top of the settings: optional automatic check (off by default, about once a day, notice only) and a button to check now and install the latest GitHub release. Removed the last `!important` from the stylesheet (the reduced-motion rule now wins by selector specificity instead). No change in behaviour.
- **4.2.0:** The pull-down label ("Do nothing (pull-down action)") is now actually hidden. The pull-down still does nothing.
- **4.1.0:** Added the page bubble and pages, bar animation styles (*Slide and fade*, *Slide only*, *Fade only*) and speed (150–900 ms), *Hold back jumps*, *Get ready while Obsidian starts* (applies next launch), automatic bar width (old fixed 14 or 18 px widths are moved to automatic once), hold speed default 200 px/s, a regrouped settings page (*Controls*, *Look*, *Margins and arrows*, *Scrolling*, *Performance*, *Other*) with fine slider controls and per-group reset, and the *Do nothing (pull-down action)* command. Rolls up everything since 3.0.1.
- **3.0.1:** Fixed a note going blank after rotating, or a note opened from another note failing to appear. Holding back reading-view drawing is now only on while a finger is on an arrow, switches off when the scroll settles, and lets Obsidian draw at once for a different note, a rotation or an unlaid-out note.
- **3.0.0:** Hold speed default 200 px/s (was 320; custom values kept). Unused style rules removed. Rolls up everything since 2.0.
- **2.0.50:** Fixed the late frame every ~0.2 s when holding in reading view (the render passes described above).
- **2.0.49:** Removed the extra reading-view planning from 2.0.48 (it made things worse). Start-up skips hidden views instead of waiting out the time limit.
- **2.0.48:** Added *Get ready while Obsidian starts*.
- **2.0.47:** Bar animation on by default. First-run setup also turns off the Quick Action. No more `!important` in the stylesheet.
- **2.0.45:** Added *Animate top and bottom bars* and *Hold back jumps*. Fixed a jump when the editor drew ahead.
- **2.0.44:** Added faster note loading, merged into *Faster loading and smoother holding*. Simpler setting descriptions.
- **2.0.16–2.0.21:** The arrow bobs continuously. *Lighter screen* and *Draw ahead* merged into one setting. Draw ahead stays clear of the bars' slide. Less jitter in the bars.
- **2.0.19:** Header and bottom bar animate as in 1.4.x (slide 0.45 s, fade 0.35 s, together).
- **2.0.8–2.0.14:** Holding an arrow rebuilt: the note moves by speed × real time, easing up to *Hold speed* and to a soft stop on release; a tap still moves one step. A lost touch is taken back. Hold speed default lowered to 320. Reaches full speed in 0.4 s.
- **1.4.0:** Lighter on the device (fewer refreshes, thumb redraws and GPU layers), smoother arrow press, flowing hold animation, bar rests when the note fits on screen, a lost touch can't leave an arrow scrolling, smaller stylesheet.

## License

[MIT](LICENSE)
