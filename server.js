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
let activeSpawnerCollisions = new Set(); // Track active square-spawner collisions

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

function createSpawnerSquare(x, y) {
    const squareId = squareIdGenerator.next();
    const squareTypeConfig = squareTypes.powerupSpawner;
    
    const squareType = {
        name: squareTypeConfig.name,
        color: '#000000',
        health: squareTypeConfig.health,
        damage: squareTypeConfig.damage,
        invisible: squareTypeConfig.invisible,
        isSpawner: squareTypeConfig.isSpawner
    };
    
    const square = new Square(squareId, x, y, 0, 0, {
        health: squareType.health,
        damage: squareType.damage,
        type: squareType,
        playerId: null,
        playerName: null
    });
    
    squares.push(square);
    return square;
}

function removeSquare(square) {
    // Don't remove spawner squares
    if (square.isSpawner) {
        return;
    }
    
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
                        const randomX = Math.random() * (GameConfig.world.width - GameConfig.powerup.size);
                        const randomY = Math.random() * (GameConfig.world.height - GameConfig.powerup.size);
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
        square: {
            size: GameConfig.square.size,
            maxCount: GameConfig.square.maxCount,
            defaultHealth: GameConfig.square.defaultHealth,
            defaultDamage: GameConfig.square.defaultDamage,
            defaultColor: GameConfig.square.defaultColor
        },
        powerup: {
            size: GameConfig.powerup.size,
            duration: GameConfig.powerup.duration,
            spawnChance: GameConfig.powerup.spawnChance,
            dropOffsetDistance: GameConfig.powerup.dropOffsetDistance
        },
        world: {
            width: GameConfig.world.width,
            height: GameConfig.world.height
        },
        physics: {
            maxVelocity: GameConfig.physics.maxVelocity,
            normalSpeed: GameConfig.physics.normalSpeed,
            frictionTime: GameConfig.physics.frictionTime,
            restitution: GameConfig.physics.restitution,
            separationBias: GameConfig.physics.separationBias
        },
        spatialGrid: {
            cellSize: GameConfig.spatialGrid.cellSize
        },
        gameLoop: {
            fps: GameConfig.gameLoop.fps
        },
        squareTypes: squareTypes,
        powerupTypes: powerupTypes
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

// Initialize spawner squares
function initializeSpawnerSquares() {
    const spawnerCount = 3; // Adjust as needed
    const margin = GameConfig.square.size;
    
    for (let i = 0; i < spawnerCount; i++) {
        const x = margin + Math.random() * (GameConfig.world.width - 2 * margin - GameConfig.square.size);
        const y = margin + Math.random() * (GameConfig.world.height - 2 * margin - GameConfig.square.size);
        createSpawnerSquare(x, y);
    }
}

// Start game loop
const fps = GameConfig.gameLoop.fps;
setInterval(gameLoop, 1000 / fps);

// Initialize spawner squares
initializeSpawnerSquares();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
