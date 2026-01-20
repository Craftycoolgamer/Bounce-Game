# Bounce Game

A browser-based physics game where colorful squares bounce around the screen, collide with each other, and battle for survival. Collect powerups, manage your health, and watch the chaos unfold!

## 🎮 How to Play

1. Open `index.html` in your web browser
2. Watch as squares automatically spawn and bounce around the screen
3. Squares collide with each other, dealing damage based on their type
4. When a square dies, it may drop powerups that other squares can collect
5. The last square standing wins, and a new square spawns after 5 seconds to continue the battle

## ✨ Features

- **Multiple Square Types**: 8 different square classes with unique stats
- **Powerup System**: Collect health, damage boosts, speed boosts, and shields
- **Physics-Based Collisions**: Realistic bouncing and collision detection
- **Visual Feedback**: Health bars, color-coded borders, and smooth animations
- **Auto-Spawning**: New squares spawn when existing ones hit corners or when only one remains

## 🎯 Square Types

| Type | Health | Damage | Color |
|------|--------|--------|-------|
| Basic | 100 | 10 | Green |
| Tank | 200 | 5 | Blue |
| Assassin | 50 | 20 | Red |
| Warrior | 150 | 15 | Orange |
| Scout | 75 | 12 | Purple |
| Bruiser | 180 | 18 | Cyan |
| GC | 10 | 1000 | Yellow |
| Balanced | 120 | 12 | Pink |

## 💎 Powerups

- **Health** (+): Restores 50 health points (permanent)
- **Damage Boost** (⚔): Increases damage by 1.5x (permanent, stacks multiplicatively)
- **Speed Boost** (⚡): Increases speed by 1.5x (temporary, 10 seconds, stacks multiplicatively)
- **Shield** (🛡): Reduces incoming damage by 50% (permanent, stacks additively, max 90% reduction)

### Powerup Mechanics

- Powerups spawn randomly when squares die (100% chance)
- Active powerups are dropped when a square dies, allowing others to collect them
- Permanent powerups persist until the square dies
- Temporary powerups last for 10 seconds
- Multiple powerups of the same type stack together

## 🎨 Visual Indicators

- **Health Bar**: Shows current health percentage
  - Green: >60% health
  - Orange: 30-60% health
  - Red: <30% health
  - Blue: Shield active
- **Border Colors**: Indicates active powerups
  - Red border: Damage boost active
  - Yellow border: Speed boost active
  - Orange border: Both damage and speed boosts active
- **Nametag**: Displays the square type name above each square

## ⚙️ Game Mechanics

### Collision System
- Squares bounce off walls and each other
- Collisions deal damage based on each square's damage stat
- Shield powerups reduce incoming damage
- Squares are separated to prevent overlap

### Spawning System
- Initial square spawns at the center of the screen
- New squares spawn when existing squares hit corners (within 50px of both edges)
- If only one square remains, a new one spawns after 5 seconds
- Maximum of 50 squares can exist at once

### Physics
- Squares have velocity that decays over time toward a normal speed
- Maximum velocity is capped to prevent squares from moving too fast
- Friction system gradually slows squares down after collisions
- Speed boosts temporarily increase movement speed

## 🛠️ Technical Details

### Files
- `index.html`: Main HTML file with embedded styles
- `script.js`: Game logic and physics engine

### Technologies
- Vanilla JavaScript (no dependencies)
- HTML5 Canvas-like rendering using DOM elements
- CSS animations for visual effects
- `requestAnimationFrame` for smooth 60fps animation

### Configuration

You can modify these constants in `script.js` to customize the game:

```javascript
const maxSquares = 50;              // Maximum number of squares
const maxVelocity = 10;             // Maximum velocity
const normalSpeed = 3;              // Normal movement speed
const frictionTime = 1000;          // Time to slow down (ms)
const powerupDuration = 10000;      // Temporary powerup duration (ms)
const powerupSpawnChance = 1;       // Powerup spawn chance (0-1)
const singleSquareSpawnDelay = 5000; // Delay before spawning new square (ms)
```

## 🚀 Getting Started

You can view a live version at https://craftycoolgamer.github.io/Bounce-Game/

1. Clone or download this repository
2. Open `index.html` in any modern web browser
3. No installation or build process required!

## 📝 License

This project is open source and available for personal use and modification.
