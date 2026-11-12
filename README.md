# 🌷 Little Garden

A cosy, casual gardening game prototype. Plant seeds, water them, watch
them grow, harvest flowers, earn coins.

## How to run it (VS Code)

### Easiest way (recommended)
1. Open this folder in VS Code: **File → Open Folder...**
2. Install the extension **"Live Server"** by Ritwick Dey
   (Extensions panel on the left, search "Live Server")
3. Right-click `index.html` → **"Open with Live Server"**
4. The game opens in your browser. Resize the window narrow or use
   your browser's phone simulator to see the mobile portrait layout.
   - Chrome: F12 → toggle the "device toolbar" icon (phone/tablet icon)

### No extensions? No problem.
Just double-click `index.html` — it also works straight from the file system.

## How to play
1. Tap an empty plot → pick a seed (you start with a free Daisy 🌼)
2. Tap the planted seed to water it 💧
3. It grows through stages: 🌰 → 🌱 → 🌿 → 🌼
4. Tap a blooming flower to harvest → earn coins 🪙
5. Spend coins in the **Seed Shop** on fancier flowers
6. Bonus: tap a growing plant again to water it for a speed boost
7. Progress saves automatically (LocalStorage) — refresh and it's all still there!

## Project structure
    little-garden/
    ├── index.html      → the page + layout
    ├── css/
    │   └── style.css   → ALL the visuals (colours, garden, animations)
    └── js/
        ├── data.js     → the flower catalogue (prices, grow times) ← edit me!
        ├── state.js    → player data + saving (coins, plots, inventory)
        ├── ui.js       → drawing things on screen
        └── game.js     → wiring taps/clicks + the game loop

**Beginner tip:** to add a new flower or change prices, you only ever
need to touch `js/data.js`. Everything else reacts automatically.
