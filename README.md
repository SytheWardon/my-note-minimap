# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a colour-coded minimap or scrollbar beside each markdown note, with click-and-drag navigation. Works on desktop and mobile.

## Features

- Two styles: **scrollbar** (light and smooth) or **minimap** (demanding, may lag; see [Performance](#performance)).
- Click and drag to jump around long notes. Touch works on mobile.
- Up/down **arrow buttons**: tap for one step, hold to keep scrolling.
- **Page bubble**: shows which page of a long note you are on while you scroll, for example *3 of 12*.
- **Animated top and bottom bars** that slide and/or fade away while you scroll.
- Customise the thumb's colour, width (automatic by default), shape (pill, rounded, square), opacity, track and glow, and choose which side it sits on.
- A hand-icon **touch button** in the note's top menu.
- Per-device margins for notches and rounded corners, an option to hide on mobile, and exclusions.

## Installation

- **Community list:** Settings → Community plugins → Browse → search "My Note Minimap" → Install → Enable.
- **Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases) into `<your vault>/.obsidian/plugins/my-note-minimap/`, then enable it under Community plugins.

## What's new in 4.1.0

- **Page bubble and pages** for long notes.
- **Bar animation:** *Slide and fade*, *Slide only* or *Fade only*, speed 150–900 ms. On by default.
- **Hold back jumps:** an unexpected jump while holding an arrow is put back. On by default.
- **Get ready while Obsidian starts:** first-time work is done behind the loading screen. On by default, applies next launch.
- **Automatic bar width:** about 14 px on a typical phone, adjusted to screen size. Old fixed 14 or 18 px widths move to automatic once. Set your own under *Bar width* (6–40 px).
- **Hold speed** default is 200 px/s.
- **Redesigned settings:** sections for Controls, Look, Margins and arrows, Scrolling, Performance and Other. Rows tied to a toggle fold open and shut. Sliders have **− / +** buttons (hold to repeat) and a live value. Each group has a **reset** button.
- **Do nothing (pull-down action)** command, used by first-run setup.

## Page bubble

Long notes are split into **pages**. While you scroll, a pill shows your position (e.g. **3 of 12**). On by default.

- It pops out of the thumb, follows it, and sits on the same side as the bar. It uses the thumb's colour with black or white text.
- When you stop it shrinks away. It stays while you drag the bar or hold an arrow, and does not appear when you open a note. With *reduce motion* on, the number changes without animation.
- Pages are counted in the note's **text**, so rotating or resizing never changes them. Each line counts as its length in characters (minimum 40). One page is **1800 characters** by default. Your page is the one holding the line at the top of the screen, and the end of a note is always the last page. Works in the editor and reading view.
- Settings: **Page bubble** on/off, and **Page length** (600–4000 characters; smaller means more, shorter pages).

## Using the arrows

- **Tap** to scroll one step (*Step per tap*). You can tap anywhere in the scrollbar column beside the arrow.
- **Press and hold** to keep scrolling. It eases up to full speed (*Hold speed*).
- While held, the arrow glides into a pill-shaped highlight and bobs in the direction of travel. It slides back on release.
- At the top or bottom of a note the arrow gives a small bump instead of scrolling.
- Turn them off or resize them under *Arrow buttons*.

## Touch button

- **Tap** the hand icon in a note's top menu to turn the scrollbar's touch on or off. When off, the strip only shows where you are and touches go to the note.
- **Long-press** (about half a second) to hide or show the whole scrollbar. While hidden, the icon shows a small eye-with-a-slash.
- The same switches are under *Touch controls* and *Hide scrollbar*. Hide the button with *Header button*. If the top menu is full, it may move into the three-dot menu.

## Screen refresh rate

Arrow scrolling is timed to your screen. On a phone the plugin asks once for your rate (60, 90, 120 or 144 Hz) and can measure it: tap *Measure* and keep a finger moving on the box. Change it any time under *Screen refresh rate*, or leave it on *Automatic*. Each redraw while holding moves the note by a whole number of pixels, which removes faint shimmer.

## Performance

The **scrollbar** is light. The **minimap** draws a bar for every line (up to 3000) and can lag on long notes and phones. If it stutters, switch to the scrollbar under *Style*, or use **Fast rendering** (on by default, minimap only):

- **One canvas:** only visible bars are painted, so cost doesn't grow with note length. (Custom CSS that recolours individual bars does not apply.)
- **Gentler refresh:** the minimap rebuilds about 0.8 s after you stop typing, and background tabs rebuild when you switch back.

### Faster loading and smoother holding

One setting, on by default. It switches itself off for the session if anything misbehaves.

- **Loading:** notes already in memory open from memory (notes up to 1.5 MB get a small copy of their own). The hidden reading view isn't built until you switch to it. Linked and recent notes are read ahead when idle.
- **Holding an arrow:** the blur behind the header and bottom bar is off until the note stops. The editor draws the next stretch slightly early. In reading view, Obsidian's slow render slices are held back during a hold while the area from one screen behind to three ahead is drawn.
- **Get ready while Obsidian starts** does first-time work behind the loading screen (time limit 0.9 s on a phone): layering the bars, loading maths and code-colouring code, rendering a reading view to the end, and drawing below the screen in the editor. Hidden views are skipped.

## Top and bottom bar animation

- **Animate top and bottom bars:** choose *Slide and fade*, *Slide only* or *Fade only*, and the speed with *Bar animation speed*.
- The plugin's own hiding and Obsidian's hide-on-scroll share one set of rules, so the bars move once, together. The soft fade at the top shrinks with the header, and blur returns after the slide.
- The bars wait 0.5 s into a hold before sliding, and a slide just begun is never reversed by a small wobble. They are put on their own graphics layers ahead of time to avoid a hitch.
- **Hold back jumps:** during a hold, if the note moves more than the text above a reference line did, the move is put back. Turn it off if holding feels worse.

## First-run setup (phone or tablet only)

After the refresh-rate pop-up, the plugin sets Obsidian's *Configure mobile Quick Action* to none so pulling down from the top no longer opens a menu. This happens once. Change it back under Settings → Mobile.

## Scroll diagnostics

An optional report after a hold: late frames and whether the plugin or the note/screen caused them, when in the hold the slowest frame happened, how often late frames repeat, what ended each press, reading-view re-plans and render passes, jumps held back, draw-ahead attempts, and start-up time.

## Version history

- **4.1.0:** Page bubble and pages, bar animation styles and speed, *Hold back jumps*, *Get ready while Obsidian starts*, automatic bar width, regrouped settings with fine slider controls and per-group reset, *Do nothing* command. Rolls up everything since 3.0.1.
- **3.0.1:** Fixed a note going blank after rotating, or a note opened from another note failing to appear. Reading-view hold-back is now only on while a finger is on an arrow and lets Obsidian draw at once for a different note, a rotation or an unlaid-out note.
- **3.0.0:** Hold speed default 200 px/s (was 320; custom values kept). Unused style rules removed.
- **2.0.50:** Fixed the late frame every ~0.2 s when holding in reading view.
- **2.0.49:** Removed extra reading-view planning from 2.0.48. Start-up skips hidden views.
- **2.0.48:** Added *Get ready while Obsidian starts*.
- **2.0.47:** Bar animation on by default. First-run setup also turns off the Quick Action. No more `!important` in the stylesheet.
- **2.0.45:** Added *Animate top and bottom bars* and *Hold back jumps*. Fixed a jump when the editor drew ahead.
- **2.0.44:** Faster note loading, merged into *Faster loading and smoother holding*.
- **2.0.16–2.0.21:** Continuous arrow bob, merged *Lighter screen* and *Draw ahead*, draw ahead stays clear of the bars' slide, less bar jitter.
- **2.0.8–2.0.14:** Holding rebuilt: speed × real time, easing to full speed and a soft stop; a lost touch is taken back.
- **1.4.0:** Fewer refreshes, thumb redraws and GPU layers; smoother arrow press; bar rests when the note fits on screen; smaller stylesheet.

## Privacy

The plugin runs entirely on your device. It makes no network requests and collects no data.

## License

[MIT](LICENSE)
