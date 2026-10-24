# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a colour-coded minimap or scrollbar beside each markdown note, with click-and-drag navigation. Works on desktop and mobile.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Using it](#using-it): [arrows](#using-the-arrows), [touch button](#touch-button), [pages and the page bubble](#pages-and-the-page-bubble)
- [Settings reference](#settings-reference): every setting, with defaults
- [Commands](#commands)
- [How it works](#how-it-works): [refresh rate](#screen-refresh-rate), [minimap colours](#minimap-colours), [look and motion](#look-and-motion), [performance](#performance), [faster loading](#faster-loading-and-smoother-holding), [bar animation](#header-and-bottom-bar-animation), [first-run setup](#first-run-setup-phone-or-tablet-only), [diagnostics](#scroll-diagnostics)
- [Network use and privacy](#network-use-and-privacy)
- [Version history](#version-history)

## Features

- Two styles: **scrollbar** (light and smooth) or **minimap** (a full colour picture of the note, built to be performance-driven; see [Performance](#performance)). The minimap sits beside the note like the scrollbar does, below the header and above the bottom bar, and is coloured from your theme (see [Minimap colours](#minimap-colours)).
- **Performance-driven minimap:** the minimap is designed around speed first. It is painted on a single canvas, only the part of the picture you can see is ever drawn, it redraws only when something actually changed, and it stays out of the way while you type or while a note is in a background tab. Long notes cost no more to show than short ones. See [Performance](#performance) for how each of these works.
- Click and drag to jump around long notes. Touch works on mobile. The minimap is accurate to the note: every line sits where it really is, so the bars line up with the thumb and with what is on screen.
- Up/down **arrow buttons** (on by default): tap to jump to the next or previous heading (or scroll one step), hold to keep scrolling.
- **Page bubble**: shows where you are in a long note while you scroll: the page (*3 of 12*), or percent read.
- **Page vibration** on phones and tablets: a light buzz as you cross into another page, or as the percent changes.
- Customise the thumb's colour, width, shape (pill, rounded, square), opacity, track and glow, and choose which side it sits on. Bar width is **automatic** by default and adapts to your screen.
- **Animated top and bottom bars**: they slide and/or fade away while you scroll.
- A settings page grouped into clear sections, with **+ / − buttons** and a live number on every slider, and a **reset** button for each group.
- A hand-icon **touch button** in the note's top menu: tap to turn touch on or off, long-press to hide the scrollbar or minimap. Its messages say which one you are using. With the scrollbar and arrows on, turning touch off leaves the two arrow buttons in place and working; hiding the bar hides the arrows with it.
- Per-device margins for notches and rounded corners. The minimap measures your header and bottom bar and keeps clear of them on any screen (or set its top, bottom and edge margins yourself).
- Smooth, consistent motion: the minimap panel slides in and wakes as you scroll, the band lights up as you drag, the scrollbar's groove folds into the thumb when idle, and hiding or showing slides and fades. See [Look and motion](#look-and-motion).
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
- **Long-press** (about half a second) to hide or show the whole scrollbar or minimap. While hidden, the icon shows a cut-out with a small eye-with-a-slash. With the scrollbar and its arrows on, hiding removes the bar but the two arrow buttons stay (as they do when touch is turned off); the minimap hides completely.
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

Open **Settings → My Note Minimap [Scrollbar]**. The sections below follow the order on the settings page. Where a row only appears under certain conditions, that is noted. Sliders have **− and + buttons** (hold to repeat) and always show the current value; a **reset** button on a group puts its sliders back to default with a short glide. Rows that depend on a toggle fold open and shut smoothly.

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
| **Fast rendering** | The minimap's performance engine: paints the whole minimap on one canvas and only draws what is on screen, so long notes stay smooth. It looks the same as the slower path. Leave it on unless you have custom CSS that recolours individual bars. See [Performance](#performance). | On |
| **Width** | How wide the minimap is, as a % of the note. | 12 (3 to 30) |
| **Minimap edge margin** | Space between the minimap and the screen edge, in pixels. | Automatic (12 on a phone; 0 to 40 px) |
| **Minimap top margin** | Space between the header and the top of the minimap, in pixels. | Automatic: measured on your device (0 to 200 px) |
| **Minimap bottom margin** | Space between the bottom bar and the bottom of the minimap, in pixels. | Automatic: measured on your device (0 to 200 px) |
| **Top offset** | How far down it starts, as a % of the space between the header and the bottom bar. 0 starts right under the header. | 0 (0 to 50) |
| **Height** | How tall the minimap is, as a % of that space. 100 fills it. | 100 (20 to 100) |

### Scrolling

| Setting | What it does | Default / range |
| --- | --- | --- |
| **Smooth scrolling** | Scroll with a soft glide instead of jumping. | On |
| **Glide length** | How long the glide lasts, in milliseconds. Longer is softer. Only shown while smooth scrolling is on. | 340 ms (80 to 800) |
| **Ignore small movements** | While you hold the scrollbar or minimap, movement smaller than this many pixels is ignored, so a resting finger that drifts a little does not move the note. Once you move further than this from where you pressed, the drag follows you as normal. 0 turns it off. | 6 px (0 to 24) |
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

### Minimap colours

Every colour in the minimap is read from your current theme, so it follows the note itself and changes with the theme or light/dark mode:

- **Headings** use the colour of each heading level (H1 to H6). **Plain text** is your text colour, a little softer.
- Inside a line, **bold**, *italic*, ==highlight==, `inline code`, `[[wiki links]]`, `[links](url)`, `#tags`, ~~strikethrough~~ and the bullet or number of a list each get their own colour, drawn where they sit in the line.
- **Callouts** take the colour of their type (info, tip, warning and so on): a tinted band with a bar down its left edge, and the title line in the full colour. **Quotes** get the quote colour and bar. **Code blocks** sit on the code background. **Rules** and **front matter** use their theme colours.
- Each line sits where it really is in the note, so the bars line up with the thumb and with what is on screen. This also needs *Fast rendering*, as does colouring each word.
- Colouring each word needs *Fast rendering* (on by default). With it off, each line is one colour from the same palette.

### Look and motion

- **Minimap panel:** a rounded panel with a hairline edge. It slides in from its edge when it appears, rests a little quieter, wakes (fuller, brighter) while the note scrolls or you touch it, and settles about two seconds after things go quiet. The picture keeps a little air from the sides and fades out toward its top and bottom ends.
- **Visible band:** a lit glass window in your accent colour. While you drag it swells slightly past the panel, gets a bright rim and a glow, and everything outside it is dimmed. Glows are limited to the gap between the panel and the screen edge so they are even on both sides, and the panel lifts a few pixels inward while you drag to make room; a larger *Minimap edge margin* gives the glow more room.
- **Scrollbar groove:** when the scrollbar goes idle, the faint groove folds in to the thumb from both ends, wherever the thumb is, and fades out; scrolling again grows it back out. The thumb and the arrows stay. It steps aside while you drag.
- **Hiding and showing:** long-pressing the header button slides the strip out toward its edge as it fades, and brings it back the same way. With the arrows on, they go with the bar: hiding the scrollbar hides the arrow buttons too, and showing it brings them back.
- **How it is animated:** everything moves with one shared set of curves (arrivals slow down into place, travel glides, fades are soft) and only ever animates position, scale and opacity, the kind the phone's graphics side runs by itself, never layout or repainting. Shadows and glows are layers that fade in and out rather than shadows being tweened, the dimming around the band is slid into place, and the band's swell is a scale. All of it stops when the system's reduced-motion setting is on.

### Performance

The minimap is performance-driven: every part of how it is drawn and refreshed is built so that a long note, a busy theme or a phone does not make scrolling or typing feel slower. The **scrollbar** style is lighter still, because it draws no picture at all, so if you only want smooth navigation, choose it under *Style*. The rest of this section describes what the minimap does to stay fast. All of it applies with **Fast rendering**, which is on by default and has no visual cost (it is minimap only).

**How it is drawn**

- **One canvas instead of one element per line:** a note's lines are classified once into a compact list (heading level, quote, callout, code, list, plain text and so on, with the colour runs inside each line) and the whole minimap is painted onto a single canvas. Without Fast rendering the minimap needs a separate page element for every line (up to 3000 of them), and the browser has to lay out and track each one; with it, there is only one element, however long the note is. The canvas is sized to your screen's pixel density, so it stays sharp without being drawn any larger than it needs to be.
- **Only what is visible is painted:** the minimap can show a note far taller than the strip it sits in, so each paint finds the first line that can reach the strip by a binary search (a halving search rather than walking the list from the top) and stops at the first line past the bottom edge. The work per paint depends on how many lines fit in the strip, not on how long the note is.
- **It repaints only when something changed:** a paint is skipped unless the text changed, the strip's size changed, or the picture has moved, so a frame in which nothing moved costs almost nothing.
- **Layout is measured sparingly:** the minimap needs to know where each line really sits in the note so the bars line up with the thumb. That measurement is cached and is read again only when the note's height has really moved (the editor corrects its height estimates as it draws lines while you scroll). How soon it may be read again depends on what the last read cost: eight times that, but never sooner than 33 ms (about every other frame) and never later than 200 ms. A cheap read therefore keeps up with the note almost frame by frame, and an expensive one is spaced out, because reading layout can force the page to recompute it.
- **Very long notes are sampled:** a note is reduced to at most 3000 rows for the picture, so the size of the data the minimap keeps and walks has a ceiling, whatever the length of the note.
- **Theme colours are read once:** the colours come from your theme by styling short-lived hidden elements the way the note styles its own, and the result is kept until the theme or light/dark mode changes, instead of asking the browser for colours on every paint.

**How it stays out of your way**

- **Near-instant refresh that scales with the note:** after an edit the minimap is rebuilt within a few frames, not after you stop typing. The first change schedules one rebuild and every change that arrives before it runs is picked up by that same rebuild, so a burst of keystrokes costs one rebuild, never one per keystroke. How long it waits depends on what the last rebuild cost: five times that, never less than 40 ms and never more than 0.8 s. A rebuild that costs 8 ms or less is therefore done in 40 ms; one that costs 160 ms or more waits the full 0.8 s, so a very long or heavy note stays light to type in and a normal note feels live. Only the note that was edited is re-read, not every open note.
- **Background tabs wait:** a note that is not on screen is not rebuilt while you type in another one. It stays marked as out of date and is rebuilt when you switch back to it.
- **Hidden means idle:** when the strip is hidden, nothing is drawn or kept up to date, and the whole strip is rebuilt only when you show it again, if the note has changed meanwhile.
- **Motion costs the graphics side, not the page:** the panel, band and fades move by position, scale and opacity only, the kind a phone's graphics hardware runs by itself (see [Look and motion](#look-and-motion)).

If the minimap still stutters on a very long or heavy note or an older phone, switch to the scrollbar under *Style*. Turning Fast rendering off is not recommended: besides the per-line elements described above, it also gives up per-word colouring and exact line placement.

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

- **5.2.2:** An efficiency pass with no change in how anything looks or behaves. Every change was checked by running the old and the new code side by side on the same input and comparing what they produce.
  - *Minimap painting:* the canvas used to be told its fill colour and transparency again for almost every bar, although nearly every bar repeats the one before. Each is now written only when it differs from what was written last (starting from nothing known at the beginning of every paint, so the first write always happens). The first row of a wrapped paragraph also reuses the edge fade already worked out for it, and a heading's colour is looked up from a fixed list instead of a text key being built for every heading. Checked on 4,000 random notes (over 1.2 million drawn bars): every bar came out with the same position, size, transparency and colour, and the canvas received about a third fewer state changes.
  - *Waking the minimap while the note moves:* the "wake" timer, which settles the minimap 1.8 s after the last movement, was cancelled and created again on every frame the note moved. One timer is now kept and it checks, when it fires, whether the note moved again since; if so it waits for the time that is left. The settling moment is the same. Checked against the old code on 3,000 random movement patterns with a simulated clock: it settled at exactly the same moments every time.
  - *Left as it was on purpose:* the scroll engine's frame loop (its order of reading and writing is what keeps arrow-holding free of jitter), the thumb and page bubble (they already skip any write that would not change anything), the stylesheet (it already avoids `!important` and layout-heavy animation) and the note reader (it already skips lines it does not need to slice out). Changing those could alter how scrolling feels for no measurable gain.
- **5.2.1:** The message shown when you turn scrollbar touch off now says what is true: *Scrollbar touch: off (arrows still work)*. It used to say *(arrows stay)*, which read as if the arrows were merely left on screen. It stays up a little longer (1.1 s instead of 0.9 s) because it is longer. Nothing about how touch-off behaves has changed: the bar stops taking touches and the two arrow buttons keep working.
- **5.2.0:** The minimap follows the note almost instantly. Before, with Fast rendering on, the picture was rebuilt only 0.8 s after you stopped typing, and while you scrolled the editor's height corrections were picked up at most every 200 ms, so the bars could trail the text. Now a rebuild is scheduled 40 ms after an edit (about two frames), and every edit that arrives before it runs shares that one rebuild. The wait is five times what the last rebuild cost, between 40 ms and 0.8 s, so a short note updates at once and a very large one backs off to the old 0.8 s on its own, which keeps typing smooth. The layout read that places each line against the thumb is spaced by what it costs too: eight times the last read, between 33 and 200 ms (it was a fixed 200 ms), so the bars keep up while the editor corrects its height as you scroll. With Fast rendering off nothing changes (0.3 s wait).
- **5.1.0:** Micro movement is ignored while you hold the strip. A finger resting on the scrollbar or minimap is never perfectly still: it drifts a pixel or two, and each drift used to nudge the note. Now, after you press, the drag does nothing until the pointer has travelled 6 px from where it came down; from then on it follows you exactly as before (the dead zone applies once per press, so a deliberate drag is not slowed or made steppy). A tap on the track still glides to that spot at once, and holding an arrow is unchanged. New setting *Ignore small movements* in *Scrolling* (0 to 24 px, 0 turns it off).
- **5.0.0:** Performance release. The README now describes the minimap as performance-driven and explains, in the [Performance](#performance) section, how it earns that: one canvas, painting only what is visible, repainting only on change, cached layout and theme colours, a gentler refresh while typing, and no work for hidden strips or background tabs. The settings description of *Fast rendering* is rewritten to match, and the touch-button feature note now says that hiding the bar hides its arrows (it still said the arrows stayed). Also fixed: the version number inside `main.js` was left at 4.18.0 by the last two releases; it now matches the manifest. Rolls up 4.18.1 and 4.18.2.
- **4.18.2:** Tidy-up after 4.18.1. The leftover code and styles from the old "hide the bar but keep the arrows" mode are removed, since nothing uses them any more. Nothing changes on screen: hiding the scrollbar hides its arrows too.
- **4.18.1:** Hiding the scrollbar now hides its arrow buttons as well. Before, hiding the bar (long-press on the header button, or the *Hide scrollbar* setting) removed only the thumb and groove and left the two arrows on screen; now the whole strip slides and fades away, arrows included, and the note gets its full width back. Showing the bar brings the arrows back with it. Turning touch off is unchanged: the bar stops taking touches and the arrows stay.
- **4.18.0:** Final touches across the 4.x series. The per-device measuring of the header and bottom bar (4.14.0) read the page's layout on every refresh; it now does so at most four times a second, which keeps scrolling lighter. README: new features listed, the contents link to the colour and motion sections, and the settings tables and version notes were re-checked against the code. A full audit found no missing methods, undefined style variables or leftover code.
- **4.17.1:** Turning touch off for the scrollbar no longer removes its arrows. Before, the arrows were tied to touch being on, so tapping the hand button made them disappear; now only the bar stops taking touches (they fall through to the note), and the two arrow buttons stay visible and keep working. The message says so ("Scrollbar touch: off (arrows stay)"). Hiding the bar already kept the arrows (4.16.0), and so does the same rule now.
- **4.17.0:** A motion pass over everything added in the 4.x series. All animations now share one set of curves, and none of them animate anything that forces layout or repainting: the panel's shadow and glow and the band's glows are layers that fade (instead of box-shadows being tweened, which repaints every frame), the dimming around the band is a pair of overlays slid into place by transform (instead of resizing them as you drag) and now fade out when you let go instead of vanishing, and the band's swell while dragging is a scale instead of changing its edges. The panel's lift and entrance use the separate translate and scale properties so they never fight each other. Hiding and showing the strip slides and fades it (it used to snap, because display:none cannot animate), and hiding the bar while keeping the arrows fades the bar and groove out instead of cutting them.
- **4.16.0:** The header button's messages and tooltip now say which you are using: "Minimap touch: off", "Minimap hidden" and so on, instead of always saying "scrollbar". The three related settings (Touch controls, Hide, Header button) change their wording with the style too. And hiding the scrollbar no longer removes its arrows: the bar, groove and page bubble go, the arrow buttons stay and still work (tap to glide, hold to keep scrolling), and the rest of the column goes back to the note.
- **4.15.0:** Page bubble beside the minimap: it is now a rounded rectangle (in step with the panel's rounded corners) instead of a pill, and it keeps clear of the visible band. The gap used to be measured from the band at rest, but while you drag, the band lifts and swells toward the bubble and its rim sits outside that, so they touched. The bubble is now placed from the strip's layout position, past all of that with air to spare, whether you drag or just scroll. The scrollbar's bubble is unchanged.
- **4.14.0:** The minimap has its own top and bottom margins, and by default they are measured on your device so they fit any screen. The top clears the header where it floats over the note; the bottom clears the bottom bar (its real height plus the gap it floats above the screen edge; before, the minimap's end could touch the bar). Each also gets a little air that grows with the screen's height. The bars slide away while you scroll, so the largest reading for the current window size is kept, and it is measured again if you rotate or resize. New settings: *Minimap top margin* and *Minimap bottom margin* (the scrollbar's margins no longer affect the minimap).
- **4.13.0:** A tidy-up pass over everything added in the 4.x series. Fixed: the minimap's fade-in on appearing animated a clip on an element that is empty when Fast rendering is on, so it never showed and could stutter without it; it is now a plain fade on the picture itself. Timers and the groove's animations are cleaned up when a note closes, and a fold left over from one style no longer carries into the other when you switch. The idle timer ignores a note that has closed. The minimap rests slightly brighter (92 %) so colours stay closer to the note's own.
- **4.12.2:** Minimap: fixed the visible band's outline at the end of the track. When you dragged all the way down (or up), the panel cut off the band's two end corners and they went black instead of showing the purple outline; the strip no longer clips (the picture is clipped by its own layer), so the outline is whole everywhere. Fixed the lopsided glow while dragging: the screen edge was cutting off the glow on that side only, so that side looked dimmer. Glows are now limited to the gap between the panel and the screen edge (so they match on both sides and at the top and bottom), and the panel lifts a few pixels inward while you drag to make room.
- **4.12.1:** Minimap: the rounded corners now show properly. The picture was reaching right into the panel's corners with square bars (and the graphics layer it sits on ignored the rounded clip). It now keeps a little air from the sides, fades out softly toward its top and bottom ends, and is cut to the rounded shape with a clip that works on every layer. Wrapped lines also fill the full width instead of stopping short and leaving a dark stripe at the edge. The visible band's corners are rounder to match.
- **4.12.0:** The scrollbar groove's fold into the thumb is rebuilt to be as smooth as it can be. The groove is now a body with two round end caps; folding only moves and scales them (the graphics side runs it, nothing is repainted), the caps are never squashed, both ends land exactly on the thumb, and the fade happens in the last half of the way. If you scroll again while it is still folding, it turns around from wherever it has got to instead of jumping; otherwise it grows back out of the thumb's present place. New setting: *Minimap edge margin*, the gap between the minimap and the screen edge, separate from the scrollbar's. By default it lines the panel up with the header's buttons (12 px on a phone).
- **4.11.1:** The scrollbar groove's fold into the thumb at idle is smooth now. It used to animate a clip, which the browser repaints on every frame; it is now a scale that the graphics side runs on its own, landing both ends exactly on the thumb's ends.
- **4.11.0:** Minimap: fixed the square corners at the top and bottom while you drag (the picture was sticking out of the rounded panel; it now sits in its own clipping layer, so the corners stay round and the page bubble can still pop out). The visible band is much easier to see during a long scroll: it swells slightly past the panel's edges, fills with your accent colour, gets a bright rim and a wide glow, and the dimming around it is a little stronger. All the animations added in 4.9 and 4.10 are smoother: gentler easing, a slow soft settle back to rest but a quick wake, a longer slide-in and wipe, and a slower, smoother fold of the scrollbar groove.
- **4.10.0:** Scrollbar: when the bar goes idle, the groove behind the thumb now folds in to the thumb from both ends, wherever the thumb is, and fades out as it reaches it. The thumb and the arrows stay. When you scroll or touch the bar again the groove grows back out of the thumb. It still steps aside while you drag. Respects reduced motion.
- **4.9.0:** The minimap looks and moves like part of the note instead of a strip stuck to the corner. It is a rounded panel with a hairline edge and a soft shadow; it slides in from its edge when it appears and its picture wipes in from the top; it rests a little quieter and wakes up (fuller, brighter) while the note scrolls or you touch it, then settles after a moment. The visible band is a lit glass window whose glow strengthens as you scroll and again as you drag, and the dimming outside it fades in with rounded corners. Respects the system's reduced-motion setting. Where color-mix is not supported the band keeps the plain translucent look.
- **4.8.0:** The minimap is now accurate to the note. Every line used to get the same 3 px, so callouts, blocks of maths, headings and wrapped paragraphs threw the picture off: the bars did not line up with the thumb or with what was on screen. Now each line is placed where it really sits in the note (the same positions the thumb uses, in the editor and in the reading view), a paragraph that wraps over several screen lines is drawn as several rows, tall lines like headings are thicker, and callout, quote and code bands are as tall as the block really is. The layout is re-read as the editor corrects its height guesses, at most five times a second. If the layout cannot be read, it falls back to equal shares as before.
- **4.7.2:** If the bottom bar has not been laid out yet when the minimap first measures it, the empty reading is no longer remembered; it is measured again on the next refresh, so the minimap always ends up clear of the bar.
- **4.7.1:** The minimap no longer runs into the floating bottom bar. Its bottom margin is now at least the real height of that bar plus the gap it floats above the screen edge, measured on your device, instead of a fixed guess.
- **4.7.0:** The minimap is sized like the scrollbar: it fills the space between the header and the bottom bar (it used to be 60 % tall and could reach under the top menu), keeps the same margins and edge gap, and stays clear of a floating header. *Top offset* and *Height* are now shares of that space (defaults 0 and 100; the old 5 and 60 are upgraded once, anything you set yourself is kept). The minimap's colours now come from your theme instead of a fixed palette: heading levels, plain text, bold, italic, highlight, inline code, links, tags, strikethrough, list markers, quotes, code blocks, rules, front matter and callouts (each type in its own colour), with coloured words drawn where they sit in the line.
- **4.6.2:** Fixed the scrollbar's track sitting in the wrong place after you tried the minimap and switched back. The track hides while you drag the bar, as before; it now does so on purpose, and leftover values from a minimap drag are cleared when you switch back, so the track returns full-height beside the thumb when you let go.
- **4.5.7:** Putting things back when the plugin is turned off, reloaded or updated is now safe next to other plugins. The plugin changes a few of Obsidian's own functions (opening a note from memory, leaving the hidden reading view for later, the start-up preparation and holding back drawing during a hold). Before, switching it off put each one back unconditionally, which would also have removed any change another plugin had made on top of it afterwards. Now each one is only put back if it is still the one in place; if another plugin has wrapped it since, it stays in that plugin's chain and just passes everything through. The update also checks the downloaded stylesheet before anything is written. Nothing else changes.
- **4.5.6:** The page number is worked out with its layout reads (scroll position, heights) taken once together instead of one by one, so a scroll tick forces less layout. Pages are counted exactly as before.
- **4.4.1:** The page bubble and page vibration are lighter on long notes: the page table is built into a fixed-size array and, when the phone is idle, ahead of the first scroll; the page is worked out once per scroll tick instead of up to three times; the reduced-motion check is reused. Pages are counted exactly as before.
- **4.4.0:** Notices and console messages use the full name, *My Note Minimap [Scrollbar]*.
- **4.3.9:** The plugin is now named *My Note Minimap [Scrollbar]* in Obsidian's plugin list and settings (its ID is unchanged, so your settings carry over).
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
