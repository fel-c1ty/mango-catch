# 🥭 Mango Catch

A small arcade game for the browser. Move the basket to catch ripe fruit
falling from the mango trees, and let the rotten fruit hit the grass.
Everything is drawn in code on a canvas, so there are no image or sound files.

## How to run it

### With VS Code (recommended)

1. Open this folder in VS Code: **File → Open Folder...**
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click `index.html` and pick **Open with Live Server**.
4. To see the phone layout, open your browser's device toolbar
   (Chrome: F12, then the phone/tablet icon).

### Without extensions

Double-click `index.html`. It also works straight from the file system.

## How to play

| Fruit | What happens |
| --- | --- |
| Ripe or Kent mango | +10 points |
| Orange or apple | +8 points |
| Golden mango ✨ | +25 points and one heart back |
| Rotten fruit (flies, stink lines) | Costs one heart. Let it fall. |

- **Move:** drag anywhere on the screen, or use ←/→ (or A/D).
- **Pause:** the pause button in the top bar, or Esc / P. The game also
  pauses on its own when you switch tabs or windows.
- **Combo:** every 5 catches in a row adds +2 per fruit, up to +10.
  Dropping good fruit resets it.
- You start with 5 hearts. The game speeds up and drops more rotten fruit
  over the first 100 seconds.
- From the pause menu you can resume, restart, or quit to the main menu.
  After losing you can play again or quit to the main menu.
- Your best score and the sound setting are saved in the browser
  (LocalStorage).

## Project structure

    mango-catch/
    ├── index.html     → page layout: HUD, main menu, pause menu, game-over card
    ├── css/
    │   └── style.css  → all page styles (cards, buttons, HUD)
    └── js/
        └── game.js    → the whole game: drawing, input, scoring, game loop

### Inside `js/game.js`

- **Top of file:** core constants (`KINDS` sets the points for each fruit).
- **Painting helpers / fruit drawings / layers:** all artwork, drawn once
  into offscreen canvases by `rebuild()`.
- **Game flow:** `startGame`, `pauseGame`, `resumeGame`, `quitToMenu`,
  `finishGame`, plus `spawnFruit` and `catchFruit` (the scoring rules).
- **update / draw:** the per-frame game loop.
- **layout:** fits the portrait stage to any window size.

**Tip:** to tune difficulty, look at `spawnFruit()` (rotten chance, fall speed)
and the spawn timer in `update()`.
