# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a colour-coded minimap / scrollbar beside each markdown note, with click-and-drag navigation. Works on desktop and mobile.

## Features

- Choose between a **scrollbar** style and a **minimap** style (the minimap is very demanding and may lag, see [Performance](#performance))
- Click and drag to jump around long notes, with touch support on mobile
- Up/down arrow buttons (on by default) with a pill-shaped press highlight, hold-to-scroll and smooth scrolling; tap the side of an arrow to trigger it
- Customisable thumb colour, width, shape (pill, rounded, square), opacity, track and glow
- Choose which side it appears on
- A hand-icon **touch button in the note's top menu**: tap it to turn the scrollbar's touch action on or off, **long-press it to hide the scrollbar**
- Per-device margins for phones with notches or rounded corners
- Option to hide on mobile, plus exclusions

## Installation

**From the community list:** Settings → Community plugins → Browse → search "My Note Minimap" → Install → Enable.

**Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases) into `<your vault>/.obsidian/plugins/my-note-minimap/`, then enable it under Community plugins.

## Using the arrows

The arrows sit at the top and bottom ends of the scrollbar.

- **Tap the side of an arrow** to trigger it: you don't need to hit the arrow icon itself. Tapping anywhere in the scrollbar column beside it (the touch area) counts.
- **Tap** an arrow to scroll one step in that direction (change the distance with *Step per tap*).
- **Press and hold** to keep scrolling; it eases up to full speed (change it with *Hold speed*).
- While your finger is down, the arrow glides into the middle of a pill-shaped highlight, and slides back to its resting spot when you let go. While held, the arrow bobs continuously in the direction the note is moving (out, back, out, back), at a pace that follows *Hold speed*.
- At the very top or bottom of a note the arrow gives a small bump instead of scrolling.
- Turn them off, or change their size, under Settings → My Note Minimap → *Arrow buttons*.

## Screen refresh rate

Arrow scrolling is timed to your screen. On a phone the plugin asks once for your refresh rate (60, 90, 120 or 144 Hz) and can measure it for you: tap *Measure* and keep a finger moving on the box. Change it any time under Settings → My Note Minimap → *Screen refresh rate*. Leave it on *Automatic* if you are not sure; a value that does not match how the screen really behaves is ignored. While you hold an arrow, every redraw moves the note by the same whole number of screen pixels, which removes the faint shimmer of uneven steps.

## Turning touch off

There is a hand-icon button in the top menu of each note. Tap it to disable the touch action on the scrollbar: the strip then only shows where you are, and your touches go straight to the note underneath. Tap it again to turn touch back on. The button is highlighted while touch is on.

**Long-press** the button (about half a second) to hide the whole scrollbar or minimap; the note then uses its full width. Long-press again to show it. While the scrollbar is hidden, the hand icon has a round piece cut out of its bottom right with a small eye-with-a-slash in it; both animate in and out. The same switch is under Settings → My Note Minimap → *Hide scrollbar*.

You can also switch it under Settings → My Note Minimap → *Touch controls*, and hide the button itself with the *Header button* setting. If the top menu is full, the button may appear inside the three-dot menu instead.

## Performance

The **scrollbar** style is light and smooth. The **minimap** style is very demanding: it draws a bar for every line of the note (up to 3000), so it might lag, especially on long notes and on phones. If you notice stutter, switch back to the scrollbar style under Settings → My Note Minimap → *Style*. To make the minimap lighter on long notes, use **Fast rendering** (Settings → My Note Minimap; on by default). It only affects the minimap style, and nothing about how the note or the strip looks changes:

- **Minimap on one canvas:** instead of a `<div>` for each of up to 3000 lines, the minimap keeps the line data in an array and paints only the bars in view on a single canvas. The cost no longer grows with the length of the note. (Custom CSS that recolours the individual bars does not apply to the canvas.)
- **Gentler refresh while typing:** the minimap waits about 0.8 s after you stop typing (instead of 0.3 s) before rebuilding, and notes in background tabs are rebuilt when you switch back to them rather than while you type in another one.

The scrollbar style is already light, so Fast rendering has no effect on it.

## What's new in 3.0.0

- **Hold speed now starts at 200 px/s** (down from 320), a calmer pace that is easier to follow with the eyes. If you were still on the old default of 320 it switches over by itself; any other value you chose is kept. Change it any time under Settings → My Note Minimap → *Hold speed*.
- **General clean-up.** Removed two leftover style rules that nothing used any more, and folded the two rules that shaped the settings' minus and plus buttons into one. Nothing looks or behaves differently from 2.0.50 apart from the hold speed.
- This is a milestone release: it rolls up everything since 2.0, including the bar animation on by default, the first-run refresh-rate and Quick Action setup, the reading-view smoothness work and a stylesheet free of `!important`.

## What's new in 2.0.50

- **Holding an arrow in reading view: the late frame every 0.2 s is fixed at its source.** Scroll diagnostics from a note full of equations showed 213 "re-plans" in an 18 s hold, 47 late frames that were not the plugin's own work (the plugin's share was 0.5 ms per frame), and a worst frame of 267 ms. In Obsidian, a reading view is drawn in slices: each pass draws at least ten sections that are not drawn yet (always from the top of the note, whatever is on screen), measures them, and queues the next pass for the very next frame. During a hold those passes shared every frame with the scroll, and a pass over equations can take 100 ms or more. While you hold an arrow, those passes are now held back as long as everything from one screen behind to three screens ahead is already drawn. They carry on the moment the hold reaches a part that is not drawn yet, and for the rest of the note when the hold ends. Part of *Faster loading and smoother holding*.
- **Scroll diagnostics** now has a *Reading view render passes* line (how many, average and worst time, and how many were held back) next to the re-plans line.

## What's new in 2.0.49

- **Taken back: the extra reading-view planning during a hold (added in 2.0.48).** Scroll diagnostics from a note full of equations showed it made things worse: 38 extra plans and 38 late frames that were not the plugin's own work, averaging well over 100 ms each. Each plan costs a lot on a note like that, so doing it more often only multiplied the cost. Obsidian's own, less frequent planning is back.
- **Scroll diagnostics now times Obsidian's own reading-view planning** during a hold (*Reading view re-plans: count, average and worst time*), so the next report shows whether those plans are what the late frames are made of.
- **Start-up no longer waits for a view that cannot be rendered yet.** The report showed *ready in 900 ms* with nothing done to a note: the reading view is hidden behind the loading screen and never finishes there, so the plugin simply waited out its time limit. It now skips a hidden view straight away; the maths and code loading and the bar layers are still done behind the loading screen.

## What's new in 2.0.48

- **New setting: *Get ready while Obsidian starts*** (on by default). Obsidian shows your last note on a loading screen while it loads everything underneath, and only takes that screen away once the workspace is built. The plugin now does its first-time work in that gap, with a time limit (0.9 s on a phone): the header and bottom bar are put on their own graphics layers, the maths and code-colouring code is loaded if an open note uses it, a reading view is rendered to the end, and an editor draws the stretch below the screen. Before, all of this waited until after the app had opened, so the first scroll and the first slide of the bars paid for it. Takes effect the next time Obsidian starts. *Scroll diagnostics* shows a *Start-up* line with how long it took.
- **(Taken back in 2.0.49.) Holding an arrow in reading view: the hitch about every 1100 px is spread out.** Obsidian re-plans which parts of a reading view are attached only every half screen or so of travel, and each re-plan attaches and measures several sections in one frame, which showed as a freeze followed by a jump. While you hold an arrow, the same planning now runs about every 100 px, so only one section changes at a time. Part of *Faster loading and smoother holding*.

## What's new in 2.0.47

- **Animate top and bottom bars is now on by default.** New installs get the slide-and-fade of the header and bottom bar right away. If you already had the setting saved, your choice is kept; change it any time under Settings → My Note Minimap → *Animate top and bottom bars*.
- **First-run setup also turns the pull-down Quick Action off.** After the refresh-rate pop-up that appears the first time, the plugin opens Obsidian's Mobile settings and sets *Configure mobile Quick Action* to none, so pulling down from the top no longer opens a menu. This happens once, only on a phone or tablet, and only from the pop-up that appears by itself (not when you tap *Measure* in the plugin's settings). You can set the Quick Action again any time under Settings → Mobile.
- The stylesheet no longer uses `!important` anywhere; the same rules win through more specific selectors instead (2.0.46).

## What's new in 2.0.45

- **New setting: *Animate top and bottom bars*** (Settings → My Note Minimap). It slides and fades the header and the bottom bar out of the way while you scroll and brings them back when you stop. Choose *Slide and fade*, *Slide only* or *Fade only*, and how long it takes (*Bar animation speed*, 150 to 900 ms). Off by default.
  - Both ways the bars can leave now use one set of rules: this plugin's own (holding an arrow, or dragging the strip) and Obsidian's own hide-on-scroll. Obsidian gives the header and the bottom bar different curves and lengths, and a different distance to travel, so with both in play the bars moved twice; now they move once, together, on the same curve.
  - The soft fade at the top of the note (floating bars) now shrinks along with the header instead of snapping away the instant the bars hide.
  - The blur behind the bars comes back only after they have finished sliding. It used to come back the moment the note stopped, which is exactly when the bars slide back in, and that showed as a stutter as they appeared.
- **Holding an arrow: a jump when the editor drew ahead is fixed.** When draw ahead made the editor draw the next stretch, the editor's correction for the shift was measured at the wrong line (one on the screen, not the one at the top), so a block that changed height on screen moved the whole note by that much when the position was put back. The shift is now measured at the line at the top of the screen.
- **New setting: *Hold back jumps*** (on by default). While you hold an arrow, one line near the top of the screen is used as a ruler. If the note suddenly moves by more than the text above that line did, the move is put back instead of being kept. *Scroll diagnostics* now reports how many such jumps it saw (and held back). If holding feels worse, turn it off; the diagnostics still count them.

## What's new in 2.0.44

- **Faster note loading**, merged into the existing hold setting, now called *Faster loading and smoother holding*: notes open from memory when Obsidian already has their text, the hidden reading view is left until you switch to it, and linked and recent notes are read ahead while you are idle. It switches itself off for the session if anything misbehaves.
- Simpler wording for every setting description, and a smoother end to the colour panel's close animation.

## What's new in 2.0.21

- The header and bottom bar are put on their own graphics layers ahead of time again (while *Animate top and bottom bars* is on), so the two big layers are not built on the first frame of the slide. This removes the hitch when both bars slide out together. The slide and fade look the same as in 2.0.20.

## What's new in 2.0.20

- Less jitter when the header and bottom bar slide during a hold: they wait until the hold is under way (0.5 s) before the first slide, and a slide that has only just begun is never reversed by a small wobble in direction. The slide itself looks exactly as in 2.0.19.

## What's new in 2.0.19

- **The header and bottom bar animate the way they did in the 1.4.x releases.** They slide away and fade together (0.45 s slide, 0.35 s fade) and start moving as soon as the note does. Removed from the later builds: the separate graphics layers (will-change / backface-visibility), the delayed fade, the 0.5 s wait before the first slide, and the limit on how often a slide may reverse. Draw ahead still stays out of the way while the bars move.

## What's new in 2.0.18

- (Replaced in 2.0.19: the forced priority on the bars' transition was removed together with the rest of the later bar changes.)
- *Scroll diagnostics* now also reports what the header does in the moments after it starts sliding (its position and opacity after a couple of frames, and any extra class or inline style on it). If the bars still pop, that shows what is doing it.

## What's new in 2.0.17

- Draw ahead now stays completely out of the way of the header and bottom bar: it does nothing before, during or just after their slide, so the bars always animate in and out.

## What's new in 2.0.16

- **Holding an arrow: the glyph now bobs continuously.** Instead of sweeping in the direction of travel and snapping back to the start, the arrow glides out, glides back, and repeats for as long as you hold. It starts from the pose it already has when the hold begins, so there is no jump, and the pace still follows *Hold speed*.
- **One switch for a smoother hold.** *Lighter screen while holding* and *Draw ahead while holding* are merged into a single setting, *Lighter screen and draw ahead while holding* (on by default). If you had either one on, the merged setting is on. Draw ahead still switches itself off if the editor misbehaves.
- The arrow stays inside its pill while it bobs (the travel scales with the arrow and glyph size). Draw ahead now waits until the header and bottom bar have finished sliding, and for the press-in animations, so a long frame can no longer make the bars snap.
- Small efficiency fixes: the hold loop no longer creates a new object on every frame, draw ahead looks from the first frame of each hold, and scrolling the note with a wheel or finger no longer does needless clean-up work on every event.

## What's new in 2.0.14

- The arrow's glow and flowing animation while you hold are back.

## What's new in 2.0.13

- **Draw ahead while holding (experimental, off by default; merged into the hold setting in 2.0.15).** While you hold an arrow in the editor, the plugin asks the editor to draw the next stretch of the note a little before it would on its own, so the freeze that comes with drawing heavy blocks (maths, callouts) lands at a moment the plugin picks. If the editor behaves unexpectedly it switches itself off. With *Scroll diagnostics* on, the popup says how many times it tried and how often the editor really drew something.

## What's new in 2.0.12

- (Withdrawn in 2.0.14: switching off the arrow's looping animations during a hold made no difference, so they are back.)
- *Scroll diagnostics* now says whether late frames come at regular times (something in the background) or at regular distances (the editor drawing the next chunk of the note).

## What's new in 2.0.11

- **Holding an arrow now scrolls at a speed your eyes can follow** (320 px/s by default, down from 800). If you were still on the old default it switches over automatically; *Hold speed* now goes down to 100 in steps of 20.

## What's new in 2.0.10

- *Scroll diagnostics* now says when in the hold the slowest frame of the plugin's own work happened, and how much of it was spent waiting on the page's layout.

## What's new in 2.0.9

- A hitch while holding an arrow (the editor drawing new lines) now reads as a brief slow-down that catches up, instead of a leap forward.
- The hold reaches full speed a little sooner (0.4 s) and the stop after letting go is slightly firmer.

## What's new in 2.0.8

- **Holding an arrow was rebuilt.** The note no longer chases a moving target with a spring. While an arrow is down, the plugin moves the note by speed x real elapsed time, easing up to *Hold speed*, and reads the editor before it writes, so a frame never waits on its own write. If the editor shifts the note while you hold (it re-measures lines as they scroll into view), the hold follows the shift instead of fighting it.
- Letting go eases the note to a soft stop from the speed it had; a tap still moves exactly one step.
- If the browser drops its grip on your finger while it is still down, the hold takes the touch back instead of stopping.
- *Scroll diagnostics* now also says what ended a press (finger lifted, touch cancelled, ...) and how long it lasted.

## What's new in 1.4.0

- Lighter on the device: one refresh per change instead of one per slider tick, one thumb redraw per frame during native scrolling, device margins worked out once, and fewer permanent GPU layers.
- Smoother arrow press and a new flowing hold animation that follows *Hold speed*.
- The bar and arrows rest quietly when the whole note already fits on screen.
- A lost touch (for example a notification pulling focus) can no longer leave an arrow scrolling.
- Smaller stylesheet with duplicated and unused rules removed.

## Settings

Open Settings → My Note Minimap to adjust the style, side, colours, shape, arrows, scrolling behaviour and exclusions.

## Privacy

The plugin runs entirely on your device. It makes no network requests and collects no data.

## License

[MIT](LICENSE)

## Faster loading and smoother holding

One setting (Settings → My Note Minimap → *Faster loading and smoother holding*, on by default). It speeds up opening notes and makes long holds smoother.

**Loading** (how Obsidian opens a note, and what changes):

- **Open from memory:** Obsidian re-reads the file from phone storage on every open, even when it already holds that exact text. With this on, a note whose text is in memory opens from memory. Notes up to 1.5 MB that are too big for Obsidian's own memory copy get a small copy of their own, checked against the file's time and size and dropped on any change.
- **Hidden reading view waits:** while you are in the editor, Obsidian also builds the whole reading view out of sight. That is left until you switch to it, and Obsidian fills it in then as usual.
- **Read ahead:** a moment after a note opens, when you are not touching the screen, the notes it links to and your recent notes are read into memory, and the editor draws the stretch just below the screen so the first scroll does not stall.

**Holding an arrow:**

- **Lighter screen:** while you hold an arrow, the blur behind the header and bottom bar (if your theme has one) is switched off until the note stops, so the graphics chip has less to redraw on every frame.
- **Draw ahead:** in the editor, the next stretch of the note is drawn a little before it would be on its own, so the pause that comes with heavy blocks (maths, callouts) lands at a moment the plugin picks. It switches itself off if the editor misbehaves.

With *Scroll diagnostics* on, the note shown after a hold says whether late frames came from the plugin or from the note or screen, and how often draw ahead tried and the editor really drew something.

## Scrollbar and bar animations

- The thumb is resized only when its size has really changed by a screen pixel, instead of being rewritten on almost every frame of a scroll (resizing means layout and repaint; moving does not).
- The header and bottom bar are put on their own graphics layers as soon as Obsidian has loaded, so even the first press has nothing to build.
- (Replaced in 2.0.19: the bars slide and fade together again, as in the 1.4.x releases.)
