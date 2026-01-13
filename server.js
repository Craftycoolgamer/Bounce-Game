const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Configuration
const GameConfig = require('./server/config/gameConfig');
const powerupTypes = require('./server/config/powerups.json');
const squareTypes = require('./server/config/squareTypes.json');

// Systems
const EventEmitter = require('./server/utils/EventEmitter');
const IdGenerator = require('./server/utils/IdGenerator');
const Square = require('./server/entities/Square');
const PhysicsSystem = require('./server/systems/PhysicsSystem');
const CollisionSystem = require('./server/systems/CollisionSystem');
const PowerupSystem = require('./server/systems/PowerupSystem');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(__dirname));

// Game state
let squares = [];
let players = new Map(); // socketId -> { playerId, playerName, squareId, socketId }
let lastTime = Date.now();

// Initialize systems
const gameEvents = new EventEmitter();
const playerIdGenerator = new IdGenerator(1);
const squareIdGenerator = new IdGenerator(0);
const physicsSystem = new PhysicsSystem();
const collisionSystem = new CollisionSystem();
const powerupSystem = new PowerupSystem(powerupTypes, gameEvents);

// Event listeners
gameEvents.on('squareDied', (data) => {
    const { square } = data;
    if (square.playerId) {
        const player = Array.from(players.values()).find(p => p.playerId === square.playerId);
        if (player) {
            io.to(player.socketId).emit('squareDied', { squareId: square.id });
        }
    }
});

function createSquare(startX, startY, startDx, startDy, playerId = null, playerName = null, playerColor = null) {
    if (squares.length >= GameConfig.square.maxCount) {
        return null;
    }

    const squareId = squareIdGenerator.next();
    
    // Get square type config
    const squareTypeConfig = squareTypes.player;
    
    // Create type with player's chosen color or default
    const squareType = {
        name: squareTypeConfig.name,
        color: playerColor || GameConfig.square.defaultColor,
        health: squareTypeConfig.health,
        damage: squareTypeConfig.damage
    };
    
    const square = new Square(squareId, startX, startY, startDx, startDy, {
        health: squareType.health,
        damage: squareType.damage,
        type: squareType,
        playerId: playerId,
        playerName: playerName || squareType.name
    });

    physicsSystem.clampVelocity(square);
    squares.push(square);
    return square;
}

function removeSquare(square) {
    // Drop powerups from square
    powerupSystem.dropPowerupsFromSquare(square);

    // Remove from squares array
    const index = squares.indexOf(square);
    if (index > -1) {
        squares.splice(index, 1);
    }

    // Emit event
    gameEvents.emit('squareDied', { square });
}

function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Animate squares
    const squaresCopy = [...squares];
    squaresCopy.forEach(square => {
        if (squares.includes(square)) {
            physicsSystem.animateSquare(square, deltaTime);
        }
    });

    // Detect collisions
    const collisionPairs = collisionSystem.detectCollisions(squares, deltaTime);
    
    // Resolve all collisions
    collisionPairs.forEach(pair => {
        if (squares.includes(pair.square1) && squares.includes(pair.square2)) {
            const result = physicsSystem.handleCollision(pair.square1, pair.square2);
            
            if (result.died1) {
                removeSquare(pair.square1);
            }
            if (result.died2) {
                removeSquare(pair.square2);
            }
        }
    });

    // Check powerup collisions
    const squaresForPowerup = [...squares];
    const powerupsCopy = [...powerupSystem.getAll()];
    squaresForPowerup.forEach(square => {
        if (squares.includes(square)) {
            powerupsCopy.forEach(powerup => {
                if (powerupSystem.getAll().includes(powerup)) {
                    if (powerupSystem.checkCollision(square, powerup)) {
                        powerupSystem.applyPowerup(square, powerup);
                    }
                }
            });
        }
    });

    // Broadcast game state to all clients
    const gameState = {
        squares: squares.map(s => s.toJSON()),
        powerups: powerupSystem.getAll().map(p => p.toJSON())
    };

    io.emit('gameState', gameState);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Send game config to client (single source of truth)
    socket.emit('gameConfig', {
        squareSize: GameConfig.square.size,
        powerupSize: GameConfig.powerup.size,
        worldWidth: GameConfig.world.width,
        worldHeight: GameConfig.world.height
    });

    // Generate player ID
    const playerId = playerIdGenerator.next();

    // Wait for player info before creating square
    socket.on('playerInfo', (data) => {
        const playerName = `Player ${playerId}`;
        const playerColor = data.playerColor || GameConfig.square.defaultColor;

        console.log('Player info received:', playerName, playerColor);

        // Create a square for this player
        const centerX = (GameConfig.world.width - GameConfig.square.size) / 2;
        const centerY = (GameConfig.world.height - GameConfig.square.size) / 2;
        const newDx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const newDy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const square = createSquare(centerX, centerY, newDx, newDy, playerId, playerName, playerColor);

        // Store player info
        players.set(socket.id, {
            socketId: socket.id,
            playerId: playerId,
            playerName: playerName,
            squareId: square ? square.id : null
        });

        // Send initial game state
        socket.emit('playerJoined', {
            playerId: playerId,
            playerName: playerName,
            squareId: square ? square.id : null
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player && player.squareId) {
            // Find and remove player's square
            const playerSquare = squares.find(s => s.id === player.squareId);
            if (playerSquare) {
                removeSquare(playerSquare);
            }
        }
        players.delete(socket.id);
    });
});

// Start game loop
const fps = GameConfig.gameLoop.fps;
setInterval(gameLoop, 1000 / fps);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
