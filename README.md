# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a colour-coded minimap or scrollbar beside each markdown note, with click-and-drag navigation. Works on desktop and mobile.

## Features

- Two styles: **scrollbar** (light and smooth) or **minimap** (very demanding, may lag; see [Performance](#performance)).
- Click and drag to jump around long notes. Touch works on mobile.
- Up/down **arrow buttons** (on by default): tap for one step, hold to keep scrolling.
- **Page bubble**: shows which page of a long note you are on while you scroll, for example *3 of 12* (new in 4.1.0).
- Customise the thumb's colour, width, shape (pill, rounded, square), opacity, track and glow, and choose which side it sits on. Bar width is **automatic** by default and adapts to your screen.
- **Animated top and bottom bars**: they slide and/or fade away while you scroll (new in 4.1.0).
- A settings page grouped into clear sections, with **+ / − buttons** and a live number on every slider, and a **reset** button for each group (new in 4.1.0).
- A hand-icon **touch button** in the note's top menu: tap to turn touch on or off, long-press to hide the scrollbar.
- Per-device margins for notches and rounded corners.
- Option to hide on mobile, plus exclusions.

## Installation

- **Community list:** Settings → Community plugins → Browse → search "My Note Minimap" → Install → Enable.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases) into `<your vault>/.obsidian/plugins/my-note-minimap/`, then enable it under Community plugins.

## What's new in 4.1.0

- **Page bubble** and **pages** for long notes (details below).
- **Bar animation choices:** *Slide and fade*, *Slide only* or *Fade only*, with an adjustable speed (150–900 ms). On by default.
- **Hold back jumps:** during a hold, an unexpected jump in the note is put back. On by default.
- **Get ready while Obsidian starts:** first-time work is done behind the loading screen. On by default, applies next launch.
- **Automatic bar width:** about 14 px on a typical phone, nudged up or down with screen size. Old fixed 14 or 18 px widths are moved to automatic once. Set your own under *Bar width* (6–40 px).
- **Hold speed** default is 200 px/s.
- **Settings redesigned:** sections for *Controls*, *Look*, *Margins and arrows*, *Scrolling*, *Performance* and *Other*. Rows that depend on a toggle fold open and shut smoothly. Sliders have **− and + buttons** (hold to repeat) and always show the current value. A **reset** button on a group puts its sliders back to default with a short glide.
- **Do nothing (pull-down action)** command, used by the first-run setup so pulling down from the top no longer opens a menu.

### Pages and the page bubble

Long notes are now split into **pages**. While you scroll, a small **page bubble** shows where you are, for example **3 of 12**. It is on by default.

**What you see**

- A pill pops out of the thumb while the note scrolls, follows the thumb, and sits on the same side as the bar.
- It uses the thumb's colour, with black or white text for readability.
- When you stop, it settles into the bar's resting colour and shrinks away. It stays up while you drag the bar or hold an arrow.
- It does not appear when you open a note (jumping back to where you left off is not a scroll).
- With *reduce motion* on in your system, the number changes without animation.

**How pages are counted**

Pages are counted in the note's **text**, not screen heights, so rotating, unfolding or resizing never changes them.

- Each line counts as its length in characters, with a minimum of 40 so blank and short lines still take space.
- One page is **1800 characters** by default.
- Your page is the one holding the line at the **top of the screen**. The very end of a note is always the last page.
- Works the same in the editor and the reading view.

**Settings** (Settings → My Note Minimap)

- **Page bubble:** on or off.
- **Page length:** characters per page, 600 to 4000 (default 1800). Smaller means more, shorter pages. Only shown while the bubble is on.

## Using the arrows

The arrows sit at the top and bottom of the scrollbar.

- **Tap** to scroll one step (set the distance with *Step per tap*). You can tap anywhere in the scrollbar column beside the arrow, not just the icon.
- **Press and hold** to keep scrolling. It eases up to full speed (set with *Hold speed*, default 200 px/s).
- While held, the arrow glides into a pill-shaped highlight and bobs in the direction of travel at a pace that follows *Hold speed*. It slides back when you let go.
- At the very top or bottom of a note the arrow gives a small bump instead of scrolling.
- Turn them off or resize them under *Arrow buttons*.

## Touch button

- **Tap** the hand icon in a note's top menu to turn the scrollbar's touch on or off. When off, the strip only shows where you are, and touches go to the note. The button is highlighted while touch is on.
- **Long-press** (about half a second) to hide or show the whole scrollbar or minimap. While hidden, the icon shows a cut-out with a small eye-with-a-slash.
- The same switches are under *Touch controls* and *Hide scrollbar*. Hide the button itself with *Header button*. If the top menu is full, it may move into the three-dot menu.

## Screen refresh rate

Arrow scrolling is timed to your screen. On a phone the plugin asks once for your rate (60, 90, 120 or 144 Hz) and can measure it: tap *Measure* and keep a finger moving on the box. Change it any time under *Screen refresh rate*. Leave it on *Automatic* if unsure; a value that doesn't match the screen is ignored. Every redraw while holding moves the note by a whole number of pixels, which removes faint shimmer.

## Performance

The **scrollbar** style is light. The **minimap** draws a bar for every line (up to 3000), so it can lag on long notes and phones. If it stutters, switch to the scrollbar under *Style*, or use **Fast rendering** (on by default, minimap only, no visual change):

- **One canvas:** line data is kept in an array and only the visible bars are painted, so cost no longer grows with note length. (Custom CSS that recolours individual bars does not apply.)
- **Gentler refresh:** the minimap rebuilds about 0.8 s after you stop typing (was 0.3 s), and background tabs rebuild when you switch back.

## Faster loading and smoother holding

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

## Header and bottom bar animation

- **Animate top and bottom bars** (on by default): they slide and/or fade away while you scroll and return when you stop. Choose *Slide and fade*, *Slide only* or *Fade only*, and the speed with *Bar animation speed* (150–900 ms).
- The plugin's own hiding (holding an arrow, dragging the strip) and Obsidian's hide-on-scroll now share one set of rules, so the bars move once, together, on one curve.
- The soft fade at the top (floating bars) shrinks with the header. Blur returns only after the slide finishes.
- The bars wait 0.5 s into a hold before sliding, and a slide just begun is never reversed by a small wobble.
- The bars are placed on their own graphics layers ahead of time, so the first slide doesn't hitch.
- **Hold back jumps** (on by default): during a hold, if the note moves more than the text above a reference line did, the move is put back. Turn it off if holding feels worse.

## First-run setup (phone or tablet only)

After the refresh-rate pop-up, the plugin sets Obsidian's *Configure mobile Quick Action* to none, so pulling down from the top no longer opens a menu. This happens once, only from the automatic pop-up. Change it back any time under Settings → Mobile.

## Scroll diagnostics

An optional report after a hold. It shows late frames and whether they came from the plugin or from the note or screen, when in the hold the slowest frame happened, how often late frames repeat (time or distance), what ended each press, reading-view re-plans and render passes, jumps held back, draw-ahead attempts, and start-up time.

## Version history

- **4.2.1:** New *Updates* section at the top of the settings: automatic check (about once a day, notice only) and a button to check now and install the latest GitHub release. Removed the last `!important` from the stylesheet (the reduced-motion rule now wins by selector specificity instead). No change in behaviour.
- **4.2.0:** The pull-down label ("Do nothing (pull-down action)") is now actually hidden. The pull-down still does nothing.
- **4.1.0:** Added the page bubble and pages, bar animation styles and speed, *Hold back jumps*, *Get ready while Obsidian starts*, automatic bar width, a regrouped settings page with fine slider controls and per-group reset, and the *Do nothing (pull-down action)* command. Rolls up everything since 3.0.1.
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

## Settings

Open Settings → My Note Minimap. Sections: Controls, Look, Margins and arrows, Scrolling, Performance and Other (style, side, colours, shape, arrows, scrolling, bar animation, exclusions).

## Privacy

The plugin runs entirely on your device. It makes no network requests and collects no data.

## License

[MIT](LICENSE)
