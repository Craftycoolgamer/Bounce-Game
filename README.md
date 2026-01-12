# Bounce Game - Multiplayer Edition

A multiplayer version of the bounce game where each square represents a different player. Squares are AI-controlled and bounce around, colliding with each other and collecting powerups.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

4. Open multiple browser windows/tabs to see multiple players!

## How It Works

- Each player gets assigned a square when they join
- Squares are AI-controlled (they bounce around automatically)
- Your square is highlighted with a white border and glow
- Player names are shown above each square
- When your square dies, you'll be notified
- The game continues with other players' squares

## Features

- Real-time multiplayer synchronization
- Player identification (your square is highlighted)
- All original game features:
  - Square types with different stats
  - Powerups (Health, Damage Boost, Speed Boost, Shield)
  - Collision detection and damage
  - Automatic square spawning

## Environment Variables

You can set the `PORT` environment variable to change the server port (default: 3000):

```bash
PORT=8080 npm start
```

