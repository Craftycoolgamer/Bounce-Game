const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(__dirname));

// Game constants
const squareSize = 50;
const maxSquares = 50;
const maxVelocity = 10;
const normalSpeed = 3;
const frictionTime = 1000;
const powerupSize = 30;
const powerupDuration = 10000;
const powerupSpawnChance = 1;
const gameWidth = 1920; // Default game area width
const gameHeight = 1080; // Default game area height
const restitution = 0.8; // Bounciness coefficient (0 = no bounce, 1 = perfect bounce)
const separationBias = 0.01; // Small bias to prevent jitter in position correction

// Default player square type (all players have the same stats)
const defaultPlayerType = { name: 'Player', color: '#4CAF50', health: 100, damage: 10 };

// Powerup types
const powerupTypes = [
    { name: 'Health', icon: '+', color: '#4CAF50', effect: 'heal', value: 50, permanent: true },
    { name: 'Damage Boost', icon: '⚔', color: '#F44336', effect: 'damage', value: 1.5, permanent: true },
    { name: 'Speed Boost', icon: '⚡', color: '#FFEB3B', effect: 'speed', value: 1.5, permanent: false },
    { name: 'Shield', icon: '🛡', color: '#2196F3', effect: 'shield', value: 0.5, permanent: true }
];

// Game state
let squares = [];
let powerups = [];
let players = new Map(); // socketId -> { playerId, playerName, squareId }
let lastTime = Date.now();
let nextPlayerId = 1;
let nextSquareId = 0;

function clampVelocity(square) {
    const speed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
    if (speed > maxVelocity) {
        square.dx = (square.dx / speed) * maxVelocity;
        square.dy = (square.dy / speed) * maxVelocity;
    }
}

function createSquare(startX, startY, startDx, startDy, playerId = null, playerName = null, playerColor = null) {
    if (squares.length >= maxSquares) {
        return null;
    }

    const squareId = nextSquareId++;
    
    // Create type with player's chosen color or default
    const squareType = {
        name: defaultPlayerType.name,
        color: playerColor || defaultPlayerType.color,
        health: defaultPlayerType.health,
        damage: defaultPlayerType.damage
    };
    
    const square = {
        id: squareId,
        playerId: playerId,
        playerName: playerName || defaultPlayerType.name,
        name: defaultPlayerType.name,
        type: squareType,
        maxHealth: defaultPlayerType.health,
        health: defaultPlayerType.health,
        baseDamage: defaultPlayerType.damage,
        damage: defaultPlayerType.damage,
        x: startX,
        y: startY,
        dx: startDx,
        dy: startDy,
        powerups: {}
    };

    clampVelocity(square);
    squares.push(square);
    return square;
}

// Static AABB collision check (for already overlapping objects)
function checkCollision(square1, square2) {
    return square1.x < square2.x + squareSize &&
           square1.x + squareSize > square2.x &&
           square1.y < square2.y + squareSize &&
           square1.y + squareSize > square2.y;
}

// Swept AABB collision detection - prevents tunneling by checking movement path
function checkSweptCollision(square1, square2, deltaTime) {
    // Calculate relative velocity
    const relativeVx = square1.dx - square2.dx;
    const relativeVy = square1.dy - square2.dy;
    
    // If not moving relative to each other, use static collision check
    if (Math.abs(relativeVx) < 0.001 && Math.abs(relativeVy) < 0.001) {
        return checkCollision(square1, square2) ? { collided: true, t: 0 } : { collided: false };
    }
    
    // Expand square2 by square1's size (Minkowski sum)
    const expandedMinX = square2.x - squareSize;
    const expandedMaxX = square2.x + squareSize;
    const expandedMinY = square2.y - squareSize;
    const expandedMaxY = square2.y + squareSize;
    
    // Calculate time of collision for each axis
    let tEntryX, tExitX, tEntryY, tExitY;
    
    if (relativeVx > 0) {
        tEntryX = (expandedMinX - square1.x) / relativeVx;
        tExitX = (expandedMaxX - square1.x) / relativeVx;
    } else if (relativeVx < 0) {
        tEntryX = (expandedMaxX - square1.x) / relativeVx;
        tExitX = (expandedMinX - square1.x) / relativeVx;
    } else {
        tEntryX = -Infinity;
        tExitX = Infinity;
    }
    
    if (relativeVy > 0) {
        tEntryY = (expandedMinY - square1.y) / relativeVy;
        tExitY = (expandedMaxY - square1.y) / relativeVy;
    } else if (relativeVy < 0) {
        tEntryY = (expandedMaxY - square1.y) / relativeVy;
        tExitY = (expandedMinY - square1.y) / relativeVy;
    } else {
        tEntryY = -Infinity;
        tExitY = Infinity;
    }
    
    // Find the latest entry and earliest exit
    const tEntry = Math.max(tEntryX, tEntryY);
    const tExit = Math.min(tExitX, tExitY);
    
    // Check if collision occurs
    if (tEntry < tExit && tEntry >= 0 && tEntry <= 1) {
        return { collided: true, t: tEntry };
    }
    
    // Also check static collision (in case they're already overlapping)
    if (checkCollision(square1, square2)) {
        return { collided: true, t: 0 };
    }
    
    return { collided: false };
}

function createPowerup(x, y, specificType = null) {
    const powerupType = specificType || powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const powerupId = powerups.length;

    const powerup = {
        id: powerupId,
        type: powerupType,
        x: x,
        y: y
    };

    powerups.push(powerup);
    return powerup;
}

function checkPowerupCollision(square, powerup) {
    const squareCenterX = square.x + squareSize / 2;
    const squareCenterY = square.y + squareSize / 2;
    const powerupCenterX = powerup.x + powerupSize / 2;
    const powerupCenterY = powerup.y + powerupSize / 2;

    const distance = Math.sqrt(
        Math.pow(squareCenterX - powerupCenterX, 2) + 
        Math.pow(squareCenterY - powerupCenterY, 2)
    );

    return distance < (squareSize / 2 + powerupSize / 2);
}

function applyPowerup(square, powerupType) {
    switch (powerupType.effect) {
        case 'heal':
            square.health = Math.min(square.health + powerupType.value, square.maxHealth);
            break;
        case 'damage':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.damageBoost) {
                square.powerups.damageBoost = 1;
            }
            square.powerups.damageBoost *= powerupType.value;
            if (!square.baseDamage) {
                square.baseDamage = square.damage;
            }
            square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.damageBoost) {
                        square.powerups.damageBoost /= powerupType.value;
                        if (square.powerups.damageBoost <= 1) {
                            square.damage = square.baseDamage;
                            delete square.powerups.damageBoost;
                        } else {
                            square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
                        }
                    }
                }, powerupDuration);
            }
            break;
        case 'speed':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.speedBoost) {
                square.powerups.speedBoost = 1;
            }
            square.powerups.speedBoost *= powerupType.value;
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.speedBoost) {
                        square.powerups.speedBoost /= powerupType.value;
                        if (square.powerups.speedBoost <= 1) {
                            delete square.powerups.speedBoost;
                        }
                    }
                }, powerupDuration);
            }
            break;
        case 'shield':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.shield) {
                square.powerups.shield = 0;
            }
            square.powerups.shield = Math.min(0.9, square.powerups.shield + powerupType.value);
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.shield) {
                        square.powerups.shield = Math.max(0, square.powerups.shield - powerupType.value);
                        if (square.powerups.shield <= 0) {
                            delete square.powerups.shield;
                        }
                    }
                }, powerupDuration);
            }
            break;
    }
}

function removePowerup(powerup) {
    const index = powerups.indexOf(powerup);
    if (index > -1) {
        powerups.splice(index, 1);
    }
}

function removeSquare(square) {
    // Drop all active powerups when square dies
    const offsetDistance = 20;
    let powerupIndex = 0;
    let hasActivePowerups = false;
    
    if (square.powerups && square.powerups.damageBoost && square.powerups.damageBoost > 1) {
        const angle = (powerupIndex * (Math.PI * 2 / 3));
        const offsetX = square.x + Math.cos(angle) * offsetDistance;
        const offsetY = square.y + Math.sin(angle) * offsetDistance;
        createPowerup(offsetX, offsetY, powerupTypes.find(p => p.effect === 'damage'));
        powerupIndex++;
        hasActivePowerups = true;
    }
    
    if (square.powerups && square.powerups.speedBoost && square.powerups.speedBoost > 1) {
        const angle = (powerupIndex * (Math.PI * 2 / 3));
        const offsetX = square.x + Math.cos(angle) * offsetDistance;
        const offsetY = square.y + Math.sin(angle) * offsetDistance;
        createPowerup(offsetX, offsetY, powerupTypes.find(p => p.effect === 'speed'));
        powerupIndex++;
        hasActivePowerups = true;
    }
    
    if (square.powerups && square.powerups.shield && square.powerups.shield > 0) {
        const angle = (powerupIndex * (Math.PI * 2 / 3));
        const offsetX = square.x + Math.cos(angle) * offsetDistance;
        const offsetY = square.y + Math.sin(angle) * offsetDistance;
        createPowerup(offsetX, offsetY, powerupTypes.find(p => p.effect === 'shield'));
        powerupIndex++;
        hasActivePowerups = true;
    }
    
    if (!hasActivePowerups && Math.random() < powerupSpawnChance) {
        createPowerup(square.x, square.y);
    }

    // Remove from squares array
    const index = squares.indexOf(square);
    if (index > -1) {
        squares.splice(index, 1);
    }

    // Notify player if they owned this square
    if (square.playerId) {
        const player = Array.from(players.values()).find(p => p.playerId === square.playerId);
        if (player) {
            io.to(player.socketId).emit('squareDied', { squareId: square.id });
        }
    }
}

function handleCollision(square1, square2) {
    let damage1 = square2.damage;
    let damage2 = square1.damage;
    
    if (square1.powerups && square1.powerups.shield) {
        damage1 = Math.floor(damage1 * (1 - square1.powerups.shield));
    }
    if (square2.powerups && square2.powerups.shield) {
        damage2 = Math.floor(damage2 * (1 - square2.powerups.shield));
    }

    square1.health -= damage1;
    square2.health -= damage2;

    if (square1.health <= 0) {
        removeSquare(square1);
    }
    if (square2.health <= 0) {
        removeSquare(square2);
    }

    if (square1.health <= 0 || square2.health <= 0) {
        return;
    }

    // Calculate center points
    const center1X = square1.x + squareSize / 2;
    const center1Y = square1.y + squareSize / 2;
    const center2X = square2.x + squareSize / 2;
    const center2Y = square2.y + squareSize / 2;

    // Calculate collision normal
    let dx = center1X - center2X;
    let dy = center1Y - center2Y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    // Handle edge case where squares are exactly on top of each other
    if (distance < 0.001) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distance = Math.sqrt(dx * dx + dy * dy);
    }

    const normalX = dx / distance;
    const normalY = dy / distance;

    // Separate squares to prevent overlap (more robust separation)
    const minDistance = squareSize;
    if (distance < minDistance) {
        const overlap = minDistance - distance;
        // Use a small bias to prevent jitter
        const separationAmount = (overlap + separationBias) / 2;
        
        // Move squares apart along the normal
        square1.x += normalX * separationAmount;
        square1.y += normalY * separationAmount;
        square2.x -= normalX * separationAmount;
        square2.y -= normalY * separationAmount;
    }

    // Physics constants
    const mass1 = 1.0; // All squares have same mass for now
    const mass2 = 1.0;

    // Calculate relative velocity along collision normal
    const relativeVx = square1.dx - square2.dx;
    const relativeVy = square1.dy - square2.dy;
    const relativeSpeed = relativeVx * normalX + relativeVy * normalY;

    // Only resolve if objects are moving towards each other
    if (relativeSpeed < 0) {
        // Calculate impulse using conservation of momentum
        // J = -(1 + e) * v_rel / (1/m1 + 1/m2)
        // where e is restitution coefficient
        const impulse = -(1 + restitution) * relativeSpeed / (1/mass1 + 1/mass2);
        
        // Apply impulse to velocities
        square1.dx += (impulse * normalX) / mass1;
        square1.dy += (impulse * normalY) / mass1;
        square2.dx -= (impulse * normalX) / mass2;
        square2.dy -= (impulse * normalY) / mass2;
    }

    clampVelocity(square1);
    clampVelocity(square2);
}

function animateSquare(square, deltaTime) {
    const maxX = gameWidth - squareSize;
    const maxY = gameHeight - squareSize;

    const speedMultiplier = (square.powerups && square.powerups.speedBoost) ? square.powerups.speedBoost : 1;
    const effectiveNormalSpeed = normalSpeed * speedMultiplier;

    const currentSpeed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
    if (currentSpeed > effectiveNormalSpeed) {
        const timeConstant = frictionTime / 4.605;
        const decayFactor = Math.exp(-deltaTime / timeConstant);
        const targetSpeed = effectiveNormalSpeed + (currentSpeed - effectiveNormalSpeed) * decayFactor;
        const finalSpeed = Math.max(effectiveNormalSpeed, targetSpeed);
        
        if (currentSpeed > 0) {
            const directionX = square.dx / currentSpeed;
            const directionY = square.dy / currentSpeed;
            square.dx = directionX * finalSpeed;
            square.dy = directionY * finalSpeed;
        }
    } else if (currentSpeed > 0 && currentSpeed < effectiveNormalSpeed) {
        const directionX = square.dx / currentSpeed;
        const directionY = square.dy / currentSpeed;
        square.dx = directionX * effectiveNormalSpeed;
        square.dy = directionY * effectiveNormalSpeed;
    }

    square.x += square.dx;
    square.y += square.dy;

    if (square.x <= 0 || square.x >= maxX) {
        square.dx = -square.dx;
        square.x = Math.max(0, Math.min(square.x, maxX));
    }

    if (square.y <= 0 || square.y >= maxY) {
        square.dy = -square.dy;
        square.y = Math.max(0, Math.min(square.y, maxY));
    }
}

// Spatial partitioning grid for collision optimization
function buildSpatialGrid() {
    const cellSize = 100; // Adjust based on square size and expected density
    const gridWidth = Math.ceil(gameWidth / cellSize);
    const gridHeight = Math.ceil(gameHeight / cellSize);
    
    // Create grid
    const grid = Array(gridHeight).fill(null).map(() => 
        Array(gridWidth).fill(null).map(() => [])
    );
    
    // Assign squares to grid cells
    squares.forEach(square => {
        const cellX = Math.floor(square.x / cellSize);
        const cellY = Math.floor(square.y / cellSize);
        const clampedX = Math.max(0, Math.min(cellX, gridWidth - 1));
        const clampedY = Math.max(0, Math.min(cellY, gridHeight - 1));
        grid[clampedY][clampedX].push(square);
    });
    
    return { grid, gridWidth, gridHeight };
}

function gameLoop() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Animate squares
    const squaresCopy = [...squares];
    squaresCopy.forEach(square => {
        if (squares.includes(square)) {
            animateSquare(square, deltaTime);
        }
    });

    // Build spatial grid for optimized collision detection
    const { grid, gridWidth, gridHeight } = buildSpatialGrid();
    const collisionPairs = [];
    const processedPairs = new Set();
    
    // Check collisions using spatial grid
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = grid[y][x];
            
            // Check collisions within cell
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const square1 = cell[i];
                    const square2 = cell[j];
                    const pairKey = square1.id < square2.id 
                        ? `${square1.id}-${square2.id}` 
                        : `${square2.id}-${square1.id}`;
                    
                    if (!processedPairs.has(pairKey) && squares.includes(square1) && squares.includes(square2)) {
                        processedPairs.add(pairKey);
                        const collision = checkSweptCollision(square1, square2, deltaTime);
                        
                        if (collision.collided) {
                            // If collision occurs in the future, resolve it at the time of impact
                            if (collision.t > 0 && collision.t < 1) {
                                // Move squares to collision point
                                const oldX1 = square1.x;
                                const oldY1 = square1.y;
                                const oldX2 = square2.x;
                                const oldY2 = square2.y;
                                
                                square1.x = oldX1 + square1.dx * collision.t;
                                square1.y = oldY1 + square1.dy * collision.t;
                                square2.x = oldX2 + square2.dx * collision.t;
                                square2.y = oldY2 + square2.dy * collision.t;
                            }
                            
                            collisionPairs.push({ square1, square2 });
                        }
                    }
                }
            }
            
            // Check collisions with adjacent cells (right, down, down-right, down-left)
            // Only check 4 directions to avoid duplicate checks
            const adjacentOffsets = [
                [1, 0],   // right
                [0, 1],   // down
                [1, 1],   // down-right
                [-1, 1]   // down-left
            ];
            
            for (const [dx, dy] of adjacentOffsets) {
                const adjX = x + dx;
                const adjY = y + dy;
                
                if (adjX >= 0 && adjX < gridWidth && adjY >= 0 && adjY < gridHeight) {
                    const adjCell = grid[adjY][adjX];
                    
                    for (const square1 of cell) {
                        for (const square2 of adjCell) {
                            const pairKey = square1.id < square2.id 
                                ? `${square1.id}-${square2.id}` 
                                : `${square2.id}-${square1.id}`;
                            
                            if (!processedPairs.has(pairKey) && squares.includes(square1) && squares.includes(square2)) {
                                processedPairs.add(pairKey);
                                const collision = checkSweptCollision(square1, square2, deltaTime);
                                
                                if (collision.collided) {
                                    if (collision.t > 0 && collision.t < 1) {
                                        const oldX1 = square1.x;
                                        const oldY1 = square1.y;
                                        const oldX2 = square2.x;
                                        const oldY2 = square2.y;
                                        
                                        square1.x = oldX1 + square1.dx * collision.t;
                                        square1.y = oldY1 + square1.dy * collision.t;
                                        square2.x = oldX2 + square2.dx * collision.t;
                                        square2.y = oldY2 + square2.dy * collision.t;
                                    }
                                    
                                    collisionPairs.push({ square1, square2 });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Resolve all collisions
    collisionPairs.forEach(pair => {
        if (squares.includes(pair.square1) && squares.includes(pair.square2)) {
            handleCollision(pair.square1, pair.square2);
        }
    });

    // Check powerup collisions
    const squaresForPowerup = [...squares];
    const powerupsCopy = [...powerups];
    squaresForPowerup.forEach(square => {
        if (squares.includes(square)) {
            powerupsCopy.forEach(powerup => {
                if (powerups.includes(powerup)) {
                    if (checkPowerupCollision(square, powerup)) {
                        applyPowerup(square, powerup.type);
                        removePowerup(powerup);
                    }
                }
            });
        }
    });

    // Broadcast game state to all clients
    const gameState = {
        squares: squares.map(s => ({
            id: s.id,
            playerId: s.playerId,
            playerName: s.playerName,
            name: s.name,
            type: s.type,
            maxHealth: s.maxHealth,
            health: s.health,
            damage: s.damage,
            x: s.x,
            y: s.y,
            powerups: s.powerups || {}
        })),
        powerups: powerups.map(p => ({
            id: p.id,
            type: p.type,
            x: p.x,
            y: p.y
        }))
    };

    io.emit('gameState', gameState);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Generate player ID
    const playerId = nextPlayerId++;

    // Wait for player info before creating square
    socket.on('playerInfo', (data) => {
        const playerName = `Player ${playerId}`;
        const playerColor = data.playerColor || defaultPlayerType.color;

        console.log('Player info received:', playerName, playerColor);

        // Create a square for this player
        const centerX = (gameWidth - squareSize) / 2;
        const centerY = (gameHeight - squareSize) / 2;
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

// Start game loop (60 FPS)
setInterval(gameLoop, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

