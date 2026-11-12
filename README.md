# My Note Minimap [Scrollbar]

An [Obsidian](https://obsidian.md) plugin that adds a scrollbar or a colour-coded minimap beside each note, so you can see where you are and jump around fast. Works on desktop and mobile.

## What you get

- **Two styles.** *Scrollbar* is a thin, smooth bar. *Minimap* is a small coloured picture of your whole note, with a band showing where you are. Pick one under **Style**.
- **Drag or tap to jump** anywhere in a long note.
- **Arrow buttons** (scrollbar style): tap to jump to the next or previous heading, hold to keep scrolling.
- **Page bubble:** while you scroll, a small bubble shows the page you are on, like *3 of 12*.
- **Page vibration** on phones: a light buzz as you cross into a new page.
- **Search button opens Find** (new in 6.5.1, off by default): a tap on the bottom bar's search button opens Find in the note instead of the quick switcher.
- **Tab arrows** (new in 6.5.0, off by default): the bottom bar's left and right arrows switch to the previous and next tab.
- **Page bookmarks** (new in 6.4.4): long-press the search button to bookmark the page you are on and to open all your bookmarks, across every note and tab.
- **Easy to restyle:** bar colour, width, shape, opacity, glow, and which side it sits on. The bar width adapts to your screen by default.
- **Smooth motion:** the bubble and the bar's track fade in and out together, and the top and bottom bars can slide away while you scroll.
- **Fits your device:** margins scale with your screen, so nothing sits under notches, the header buttons or the bottom bar.
- **Hides Obsidian's own scrollbar** (new in 6.3.2): so you see one scrollbar, not two. No CSS snippet needed.

## Install

- **From Obsidian:** Settings → Community plugins → Browse → search "My Note Minimap" → Install → Enable.
- **By hand:** put `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases) into `<your vault>/.obsidian/plugins/my-note-minimap/`, then enable the plugin.

## Using it

**The minimap.** The coloured bars are your note's lines: headings, lists, quotes, code and callouts each get their theme colour. The lit band is where you are, and it is always the same size. Touch or drag the minimap to go there. While you hold the band, the rest of the minimap dims a little.

**The arrows.** Tap an arrow to jump to the next or previous heading (or scroll a step, if you change *Arrow tap does*). Hold it for about half a second to keep scrolling; the speed is *Hold speed*.

**The hand button** in the note's top menu: tap it to turn touch on or off. Long-press it to hide or show the whole bar or minimap.

**Pages.** Long notes are split into pages by text length (1800 characters each by default), not by screen size, so rotating or unfolding your phone never changes them. The bubble shows the page you are on while you scroll, then shrinks away a moment after you stop.

## Settings

Open **Settings → My Note Minimap [Scrollbar]**. Every slider has − and + buttons and a reset button for its group.

| Group | What is in it |
| --- | --- |
| **Updates** | Optional update check (off by default) and a button to check now. |
| **Controls** | Touch on/off, **Hide Obsidian scrollbar**, hide the bar, show the hand button in the header. |
| **Look** | **Style**, **Side**, the page bubble (page length), page vibration, **Page bookmarks**. |
| **Scrollbar look** | Bar width (automatic by default), shape, colour, opacity, **Show track**, **Track when idle**, glow. |
| **Margins and arrows** | Top, bottom and edge margins (automatic per device), touch area, arrow buttons, arrow size, what a tap does, step size, hold speed. |
| **Minimap only** | Fast rendering, width, margins, top offset, height. |
| **Scrolling** | Smooth scrolling and glide length, ignore small finger movements, screen refresh rate, animate the top and bottom bars. |
| **Tab arrows** | **Arrows switch tabs** (off by default), wrap around, pop-up pill, tab button, buzz when switching, notice on every tap. |
| **Performance** | Get ready at start-up, faster loading, hold back jumps, scroll diagnostics. |
| **Other** | Hide on mobile, and files or folders to exclude. |
| **Experimental** | Full Screen Guard (off by default): force full screen, keep Auto full screen on, camera position, space to keep clear, and what Android reports. |

**Track when idle** (new in 6.3): *Fades away* (default) fades the faint track behind the bar out a moment after you stop scrolling and brings it back when you scroll. *Stays visible* keeps it there.

**Hide Obsidian scrollbar** (new in 6.3.2, on by default): the plugin hides Obsidian's built-in scrollbar in the editing, preview and reading views each time it starts, so it no longer clashes with the plugin's bar. Turn it off to get the native scrollbar back straight away, and turning the plugin off also brings it back. This replaces the old `hide-scrollbar.css` snippet, so you can remove that snippet. It is separate from **Hide scrollbar**, which hides the plugin's own bar.

Commands in the command palette: **Check for updates**, and an empty **Do nothing (pull-down action)** used by the first-run setup on Obsidian versions before 1.15.

## Experimental: Full Screen Guard

**Experimental, and off by default.** Phone app only (it does nothing on desktop). It was a separate plugin and is now built in. Turn it on under **Settings → My Note Minimap → Experimental**; its rows then open below the switch.

- **Force full screen.** Keeps the Android status bar hidden. Obsidian's Auto full screen hides it while you scroll down and shows it again when you scroll up or close the keyboard; the guard ignores those "show" requests and hides it again after rotating, returning to the app and closing the keyboard.
- **Keep Obsidian's Auto full screen on.** Switches Obsidian's own setting back on if it gets turned off.
- **Camera position** and **Keep this much space clear (px).** Keeps at least that much space free on the camera's edge so notes and bars never go under it (the larger of the number and what Android reports is used, so it is never added twice). The edge follows the phone when rotated. The slider has the usual − and + buttons, a number, a glide and a reset button. The minimap's own margins follow this space.
- **What Android reports right now** shows the four values Android gives the app, to help choose the number.
- Also a command: **Toggle forced full screen (experimental)**.

While it is off nothing runs. Turning it off puts everything back: the status bar returns and the extra space is removed. Limits: the bottom navigation bar cannot be hidden by a plugin, and a black strip at the top can only be changed in Android's own display settings for the app. If you still have the separate *Full Screen Guard* plugin, disable it, since both would do the same job.

## Search button opens Find

**Off by default.** Phone and tablet app only. Turn it on under **Settings → My Note Minimap → Search button opens Find** (next to the bookmark settings).

A quick tap on the search button in the bottom bar opens **Find** in the note you are reading, the same Find bar as Menu → Find…, instead of the quick switcher. Only a tap does this: holding the button still opens the bookmark menu when **Page bookmarks** is on, and when it is off, holding goes to the quick switcher, so the quick switcher is never out of reach. With no note open (a graph, settings, an empty tab) the button works as Obsidian made it. It works in editing and reading view. Turning it off gives the button back to Obsidian; nothing listens while it is off.

## Tab arrows

**Off by default.** Phone and tablet app only. It was a separate plugin (Tab Arrows 2.0.0) and is now built in. Turn it on under **Settings → My Note Minimap → Tab arrows**; its rows open below the switch.

- **Arrows switch tabs.** The left and right arrows in the bottom bar go to the previous and next tab, in the order of Obsidian's tab switcher. Holding an arrow still opens the history list.
- **Wrap around** (on): from the last tab the right arrow goes to the first, and the other way round. Off: the arrow at either end is greyed out.
- **Pop-up pill** (on): a small pill above the bottom bar says which tab you moved to, like *Tab 2 of 5*, with the same rise, press and sink animations as before. While it is on, the tab button shows a tabs icon instead of a number.
- **Tab button** (only with the pill off): the box in the bar shows the current tab number, or *2/5*.
- **Buzz when switching** (off) and **Show a notice on every tap** (off, for troubleshooting).

It patches none of Obsidian's code. Turning it off (or the plugin off) gives the arrows, their labels and the tab button back to Obsidian exactly as they were, and nothing listens. If the separate *Tab Arrows* plugin is still on, disable it: with both on, each tap would be handled twice.

## Page bookmarks

**Settings → My Note Minimap → Page bookmarks** (on by default; turn it off and the search button works exactly as Obsidian made it, with nothing listening at all).

**Long-press the search button** in the bottom bar (about half a second, finger kept still, with a light buzz) and a menu opens:

1. **Bookmark this page (Page 23)** asks for a name. It is filled in as *Page 23*, the page number the bubble shows, and you can type anything you like. If this page is already bookmarked, it says *Edit this bookmark* instead, so a page is never saved twice.
2. **Bookmarks (5)** opens the list of every bookmarked page, in every note. Your current note's bookmarks come first under *This note*, the rest under *Other notes* with the note's name. **Tap** a bookmark to go there, the **pencil** renames it, the **bin** deletes it. With more than eight bookmarks a filter box appears.

A normal tap on the search button still opens Obsidian's quick switcher; only a long press is taken over, and the tap that ends it is cancelled so the quick switcher does not open too.

- **Across tabs and notes.** A bookmark belongs to a note, not to a tab. Tapping one switches to the tab that already has that note open, or opens the note in the current tab, and moves to the bookmarked place. Bookmarks follow a note (or folder) when it is renamed or moved and are removed when it is deleted.
- **How the place is kept.** As the note's scroll position (a line number, the one Obsidian uses to jump to a heading), with the page and page count it had when saved, so rotating the phone does not move it. A large note that is still laying itself out when it opens is checked a few times and put back, until you touch the screen.
- **Keyboard.** The name box (and the filter box) moves up out of the way of the on-screen keyboard on any device: it reads the keyboard from Obsidian's keyboard events, its keyboard height and the visual viewport, lifts only as much as needed, shortens itself if it is taller than the free space, and glides back when the keyboard goes.
- **Commands** for the command palette (and desktop, which has no bottom bar): *Bookmark this page* and *Show page bookmarks*.
- **Editing a note moves lines.** The place is a line number, so text added or removed above a bookmark moves where it lands, by about as many lines as were added or removed.

## Good to know

- **Speed.** The minimap is drawn on one canvas, only the part you can see is painted, and it redraws only when something changed, so long notes cost no more than short ones. If a very long or heavy note still stutters on an older phone, switch to the scrollbar style. Leave **Fast rendering** on.
- **Screen refresh rate.** Arrow scrolling is timed to your screen. On a phone the plugin asks once (60, 90, 120 or 144 Hz) and can measure it for you. *Automatic* is fine if you are unsure.
- **Find bar.** While Obsidian's Find bar is open (Menu → Find…, or the search button with *Search button opens Find* on), the scrollbar or minimap, its arrows and the page bubble start just below it and are shorter by the same amount, so they never sit on top of the bar; they go back when Find closes. It follows the bar's real height, including the Replace row, on any device.
- **Colours** come from your current theme and follow light and dark mode.
- **First run on a phone or tablet:** after the refresh-rate pop-up the plugin turns off Obsidian's pull-down Quick Action so pulling down from the top no longer opens a menu. On Obsidian 1.15 and newer this is the real *Disabled* setting; on older versions it is set to the plugin's empty command. You can change it back under Settings → Interface (older versions: Settings → Mobile).
- **Reduced motion:** if your system asks for less motion, the animations are skipped.
- **Scroll diagnostics** is an optional report after holding an arrow, only for troubleshooting.

## Network use and privacy

The plugin runs on your device and collects no data. Its only network requests are for updates, and only to GitHub (this repository's releases):

- **api.github.com** (1 request): reads the latest release's version number. Made when you tap *Check for updates*, or about once a day at start-up if you turn on *Check for updates automatically* (off by default).
- **github.com** release downloads (1 request per file): `main.js`, `manifest.json` and `styles.css`, fetched only after you tap *Update to X*.

Nothing is sent about you or your notes. No analytics, no telemetry.

## Version history

Recent versions in short. Older notes are at the bottom.

- **6.5.2:** The scrollbar (or minimap), its arrows and the page bubble now stay clear of Obsidian's Find bar. While Find is open the strip starts just below the bar and is that much shorter, following the bar's real height (the Replace row makes it taller), and goes back when Find closes. It is measured from the bar itself, so it works the same on any phone, tablet or desktop.
- **6.5.1:** New **Search button opens Find** setting (off by default): a tap on the search button opens Find in the note; holding still opens the bookmark menu or the quick switcher.
- **6.5.0:** New **Tab arrows** setting (off by default): Tab Arrows 2.0.0 merged in, with all its options and animations. The bookmark name box (and the bookmark list's filter box) now moves up out of the way of the on-screen keyboard automatically, on any device. The page bubble now always shows the page number: **Bubble shows**, the percent option and **Buzz on** are removed (page vibration buzzes on each new page); old saved values are cleared.
- **6.4.5:** Fixes the bottom bar glitching after a bookmark jump and when coming back to a note from the sidebar. While a bookmark is put in place, Obsidian no longer takes the note's own scrolling for yours, so the bars stop hiding and showing; and the bar's slide no longer runs on top of Obsidian's own sideways slide of the bar with the sidebar, so it no longer waits at the screen edge and jumps.
- **6.4.4:** New **Page bookmarks**: long-press the search button to bookmark the current page (named *Page 23* by default, renamable) and to open the list of all bookmarks across every note and tab; tap one to go there. A setting turns it on or off; with it off nothing listens. Commands *Bookmark this page* and *Show page bookmarks*.
- **6.4.3:** Full Screen Guard's slider and plus/minus buttons no longer stutter. A changed value is now applied once you pause (at most 0.9 s into a long drag) instead of on every step, and the "What Android reports" line is redrawn once after the last step. Switching the Guard on or off is still immediate.
- **6.4.2:** Full Screen Guard is merged in as an **experimental** setting, **off by default**, with its slider, number and the same open/close animation as the other settings groups. Nothing changes until it is switched on.
- **6.4.1:** Version bump only; no change in behaviour.
- **6.4.0:** Checked against Obsidian 1.15.0. The pull-down Quick Action is now turned off with Obsidian's own *Disabled* value (an empty one), so no label or prompt appears and the plugin no longer watches the screen on each touch for one; versions before 1.15 keep the empty-command method. The first-run setup now opens Settings → Interface, where Obsidian 1.15 moved this setting (older versions: Mobile), and redraws it after the change. A Quick Action left on the old empty command is switched to *Disabled* on 1.15+.
- **6.3.2:** New setting **Hide Obsidian scrollbar** (on by default). The plugin now hides Obsidian's own scrollbar at start-up and puts it back when switched off or unloaded, replacing the `hide-scrollbar.css` snippet.
- **6.3.1:** README rewritten to be shorter and easier to read.
- **6.3.0:** New setting **Track when idle** (fade away or stay visible). Clean-up of old animation code.
- **6.2.1:** On phones the minimap's top and bottom margins never go below the device's own margins, so it no longer runs under the header buttons or the bottom bar.
- **6.2.0:** The minimap band is always the same height (40 px). Less dimming while you hold the band. The bubble and track fade a little slower.
- **6.1.0:** More accurate minimap: the thumb and your touches use each line's real place in the note. The bubble and track now fade in one continuous motion with no pause, and turn around smoothly if you scroll again mid-fade.
- **6.0.1:** No empty rows for blank lines in the minimap. The track fade runs on the bubble's clock.
- **6.0.0:** The minimap is drawn as an even column of bars again (as in 4.6.2), with no gaps from the note's own spacing. When the scrollbar is idle, the track fades out instead of shrinking onto the thumb.

<details>
<summary>Older versions (5.2.2 and earlier)</summary>

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

</details>
