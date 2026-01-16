const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Configuration
const Game = require('./server/Game');
const PlayerSquare = require('./server/entities/PlayerSquare');
const SpawnerSquare = require('./server/entities/SpawnerSquare');
const Powerup = require('./server/entities/Powerup');

// Systems
const EventEmitter = require('./server/utils/EventEmitter');
const IdGenerator = require('./server/utils/IdGenerator');
const SquareFactory = require('./server/entities/SquareFactory');
const PhysicsSystem = require('./server/systems/PhysicsSystem');
const CollisionSystem = require('./server/systems/CollisionSystem');
const PowerupSystem = require('./server/systems/PowerupSystem');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(__dirname));

// Initialize game config
const gameConfig = new Game();

// Game state
let squares = [];
let players = new Map(); // socketId -> { playerId, playerName, squareId, socketId }
let lastTime = Date.now();
let activeSpawnerCollisions = new Set(); // Track active square-spawner collisions

// Initialize systems
const gameEvents = new EventEmitter();
const playerIdGenerator = new IdGenerator(1);
const squareIdGenerator = new IdGenerator(0);
const squareFactory = new SquareFactory();
const physicsSystem = new PhysicsSystem(gameConfig);
const collisionSystem = new CollisionSystem(gameConfig);
const powerupSystem = new PowerupSystem(gameEvents);

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
    if (squares.length >= PlayerSquare.maxCount) {
        return null;
    }

    const squareId = squareIdGenerator.next();
    const square = squareFactory.createPlayerSquare(
        squareId, 
        startX, 
        startY, 
        startDx, 
        startDy, 
        playerId, 
        playerName, 
        playerColor || PlayerSquare.defaultColor
    );

    physicsSystem.clampVelocity(square);
    squares.push(square);
    return square;
}

function createSpawnerSquare(x, y) {
    const squareId = squareIdGenerator.next();
    const square = squareFactory.createSpawnerSquare(squareId, x, y);
    squares.push(square);
    return square;
}

function removeSquare(square, dropPowerups = true) {
    // Don't remove spawner squares
    if (square.isSpawner) {
        return;
    }
    
    // Drop powerups from square only if specified
    if (dropPowerups) {
        powerupSystem.dropPowerupsFromSquare(square);
    }

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

    // Animate squares (skip spawner squares)
    const squaresCopy = [...squares];
    squaresCopy.forEach(square => {
        if (squares.includes(square) && !square.isSpawner) {
            physicsSystem.animateSquare(square, deltaTime);
        }
    });

    // Detect collisions
    const collisionPairs = collisionSystem.detectCollisions(squares, deltaTime);
    
    // Track which collisions are happening this frame
    const currentFrameCollisions = new Set();
    
    // Resolve all collisions
    collisionPairs.forEach(pair => {
        if (squares.includes(pair.square1) && squares.includes(pair.square2)) {
            // Check if either square is a spawner
            if (pair.square1.isSpawner || pair.square2.isSpawner) {
                // Handle spawner collision
                const spawnerSquare = pair.square1.isSpawner ? pair.square1 : pair.square2;
                const hittingSquare = pair.square1.isSpawner ? pair.square2 : pair.square1;
                
                // Only spawn if hitting square is not a spawner
                if (!hittingSquare.isSpawner) {
                    // Create a unique key for this square-spawner pair
                    const collisionKey = `${hittingSquare.id}-${spawnerSquare.id}`;
                    currentFrameCollisions.add(collisionKey);
                    
                    // Only spawn if this is a new collision (wasn't colliding before)
                    if (!activeSpawnerCollisions.has(collisionKey)) {
                        activeSpawnerCollisions.add(collisionKey);
                        const randomX = Math.random() * (gameConfig.world.width - Powerup.size);
                        const randomY = Math.random() * (gameConfig.world.height - Powerup.size);
                        powerupSystem.create(randomX, randomY);
                    }
                }
            } else {
                // Normal collision resolution
                const result = physicsSystem.handleCollision(pair.square1, pair.square2);
                
                if (result.died1) {
                    removeSquare(pair.square1);
                }
                if (result.died2) {
                    removeSquare(pair.square2);
                }
            }
        }
    });
    
    // Remove collisions that are no longer active (square moved away from spawner)
    // Only keep collisions that are still happening this frame
    const collisionsToRemove = [];
    activeSpawnerCollisions.forEach(collisionKey => {
        if (!currentFrameCollisions.has(collisionKey)) {
            collisionsToRemove.push(collisionKey);
        }
    });
    collisionsToRemove.forEach(key => activeSpawnerCollisions.delete(key));

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

    // Send complete game config to client (single source of truth)
    socket.emit('gameConfig', {
        world: gameConfig.world,
        squareTypes: squareFactory.getSquareTypes(),
        powerupTypes: powerupSystem.getPowerupTypes()
    });

    // Generate player ID
    const playerId = playerIdGenerator.next();

    // Wait for player info before creating square
    socket.on('playerInfo', (data) => {
        const playerName = `Player ${playerId}`;
        const playerColor = data.playerColor || PlayerSquare.defaultColor;

        console.log('Player info received:', playerName, playerColor);

        // Create a square for this player
        const squareSize = PlayerSquare.getDefaultConfig().size;
        const centerX = (gameConfig.world.width - squareSize) / 2;
        const centerY = (gameConfig.world.height - squareSize) / 2;
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
            // Find and remove player's square (don't drop powerups on disconnect)
            const playerSquare = squares.find(s => s.id === player.squareId);
            if (playerSquare) {
                removeSquare(playerSquare, false);
            }
        }
        players.delete(socket.id);
    });
});

// Initialize spawner squares
function initializeSpawnerSquares() {
    const spawnerCount = 3; // Adjust as needed
    const squareSize = SpawnerSquare.getDefaultConfig().size;
    const margin = squareSize;
    
    for (let i = 0; i < spawnerCount; i++) {
        const x = margin + Math.random() * (gameConfig.world.width - 2 * margin - squareSize);
        const y = margin + Math.random() * (gameConfig.world.height - 2 * margin - squareSize);
        createSpawnerSquare(x, y);
    }
}

// Start game loop
setInterval(gameLoop, 1000 / Game.fps);

// Initialize spawner squares
initializeSpawnerSquares();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
