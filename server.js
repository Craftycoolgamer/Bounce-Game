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

function checkCollision(square1, square2) {
    return square1.x < square2.x + squareSize &&
           square1.x + squareSize > square2.x &&
           square1.y < square2.y + squareSize &&
           square1.y + squareSize > square2.y;
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

    if (distance === 0) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distance = Math.sqrt(dx * dx + dy * dy);
    }

    const normalX = dx / distance;
    const normalY = dy / distance;

    // Separate squares
    const minDistance = squareSize;
    if (distance < minDistance) {
        const overlap = minDistance - distance;
        const separationAmount = overlap / 2;
        square1.x += normalX * separationAmount;
        square1.y += normalY * separationAmount;
        square2.x -= normalX * separationAmount;
        square2.y -= normalY * separationAmount;
    }

    // Calculate relative velocity
    const relativeVx = square1.dx - square2.dx;
    const relativeVy = square1.dy - square2.dy;
    const relativeSpeed = relativeVx * normalX + relativeVy * normalY;

    if (relativeSpeed < 0) {
        const impulse = 2 * relativeSpeed;
        square1.dx -= impulse * normalX;
        square1.dy -= impulse * normalY;
        square2.dx += impulse * normalX;
        square2.dy += impulse * normalY;

        const minVelocity = 1;
        const speed1 = Math.sqrt(square1.dx * square1.dx + square1.dy * square1.dy);
        const speed2 = Math.sqrt(square2.dx * square2.dx + square2.dy * square2.dy);

        if (speed1 < minVelocity && speed1 > 0) {
            square1.dx = (square1.dx / speed1) * minVelocity;
            square1.dy = (square1.dy / speed1) * minVelocity;
        }
        if (speed2 < minVelocity && speed2 > 0) {
            square2.dx = (square2.dx / speed2) * minVelocity;
            square2.dy = (square2.dy / speed2) * minVelocity;
        }
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

    // Check collisions
    const squaresForCollision = [...squares];
    for (let i = 0; i < squaresForCollision.length; i++) {
        for (let j = i + 1; j < squaresForCollision.length; j++) {
            const square1 = squaresForCollision[i];
            const square2 = squaresForCollision[j];
            if (squares.includes(square1) && squares.includes(square2)) {
                if (checkCollision(square1, square2)) {
                    handleCollision(square1, square2);
                }
            }
        }
    }

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

