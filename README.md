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
- While your finger is down, the arrow glides into the middle of a pill-shaped highlight, and slides back to its resting spot when you let go. While held, the arrow flows in the direction the note is moving, at a pace that follows *Hold speed*.
- At the very top or bottom of a note the arrow gives a small bump instead of scrolling.
- Turn them off, or change their size, under Settings → My Note Minimap → *Arrow buttons*.

## Turning touch off

There is a hand-icon button in the top menu of each note. Tap it to disable the touch action on the scrollbar: the strip then only shows where you are, and your touches go straight to the note underneath. Tap it again to turn touch back on. The button is highlighted while touch is on.

**Long-press** the button (about half a second) to hide the whole scrollbar or minimap; the note then uses its full width. Long-press again to show it. While the scrollbar is hidden, the hand icon has a round piece cut out of its bottom right with a small eye-with-a-slash in it; both animate in and out. The same switch is under Settings → My Note Minimap → *Hide scrollbar*.

You can also switch it under Settings → My Note Minimap → *Touch controls*, and hide the button itself with the *Header button* setting. If the top menu is full, the button may appear inside the three-dot menu instead.

## Performance

The **scrollbar** style is light and smooth. The **minimap** style is very demanding: it draws a bar for every line of the note (up to 3000), so it might lag, especially on long notes and on phones. If you notice stutter, switch back to the scrollbar style under Settings → My Note Minimap → *Style*. To make the minimap lighter on long notes, use **Fast rendering** (Settings → My Note Minimap; on by default). It only affects the minimap style, and nothing about how the note or the strip looks changes:

- **Minimap on one canvas:** instead of a `<div>` for each of up to 3000 lines, the minimap keeps the line data in an array and paints only the bars in view on a single canvas. The cost no longer grows with the length of the note. (Custom CSS that recolours the individual bars does not apply to the canvas.)
- **Gentler refresh while typing:** the minimap waits about 0.8 s after you stop typing (instead of 0.3 s) before rebuilding, and notes in background tabs are rebuilt when you switch back to them rather than while you type in another one.

The scrollbar style is already light, so Fast rendering has no effect on it.

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
