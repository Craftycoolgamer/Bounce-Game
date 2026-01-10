const squareSize = 50;
const cornerDetectionThreshold = 50; // Distance from corner to trigger detection (in pixels)
const maxSquares = 50; // Maximum number of squares to prevent crashes
const maxVelocity = 10; // Maximum velocity to prevent squares from moving too fast
const normalSpeed = 3; // Normal speed that squares should slow down to (pixels per frame)
const frictionTime = 1000; // Time in milliseconds to slow down to normal speed
const powerupSize = 30; // Size of powerup squares
const powerupDuration = 10000; // Duration of temporary powerups in milliseconds
const powerupSpawnChance = 1; // Chance to spawn powerup when square dies (0-1)

// Array of square types that can be randomly spawned
const squareTypes = [
    { name: 'Basic', color: '#4CAF50', health: 100, damage: 10 },
    { name: 'Tank', color: '#2196F3', health: 200, damage: 5 },
    { name: 'Assassin', color: '#F44336', health: 50, damage: 20 },
    { name: 'Warrior', color: '#FF9800', health: 150, damage: 15 },
    { name: 'Scout', color: '#9C27B0', health: 75, damage: 12 },
    { name: 'Bruiser', color: '#00BCD4', health: 180, damage: 18 },
    { name: 'GC', color: '#FFEB3B', health: 10, damage: 1000 },
    { name: 'Balanced', color: '#E91E63', health: 120, damage: 12 }
];

// Array of powerup types
const powerupTypes = [
    { name: 'Health', icon: '+', color: '#4CAF50', effect: 'heal', value: 50, permanent: true },
    { name: 'Damage Boost', icon: '⚔', color: '#F44336', effect: 'damage', value: 1.5, permanent: true },
    { name: 'Speed Boost', icon: '⚡', color: '#FFEB3B', effect: 'speed', value: 1.5, permanent: false },
    { name: 'Shield', icon: '🛡', color: '#2196F3', effect: 'shield', value: 0.5, permanent: true }
];

let squares = [];
let powerups = [];
let lastTime = performance.now();
let singleSquareTimer = null; // Timer for when there's only one square
const singleSquareSpawnDelay = 5000; // 5 seconds in milliseconds

function getRandomSquareType() {
    const randomIndex = Math.floor(Math.random() * squareTypes.length);
    return squareTypes[randomIndex];
}

function clampVelocity(square) {
    const speed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
    if (speed > maxVelocity) {
        square.dx = (square.dx / speed) * maxVelocity;
        square.dy = (square.dy / speed) * maxVelocity;
    }
}

function createSquare(startX, startY, startDx, startDy) {
    // Don't create new squares if we've reached the limit
    if (squares.length >= maxSquares) {
        return null;
    }

    // Get a random square type
    const squareType = getRandomSquareType();

    const squareId = squares.length;
    const squareElement = document.createElement('div');
    squareElement.id = `square-${squareId}`;
    squareElement.style.position = 'absolute';
    squareElement.style.width = squareSize + 'px';
    squareElement.style.height = squareSize + 'px';
    squareElement.style.backgroundColor = squareType.color;
    squareElement.style.transition = 'background-color 0.1s ease';
    squareElement.style.left = startX + 'px';
    squareElement.style.top = startY + 'px';
    document.body.appendChild(squareElement);

    // Create nametag
    const nametagElement = document.createElement('div');
    nametagElement.id = `nametag-${squareId}`;
    nametagElement.textContent = squareType.name;
    nametagElement.style.left = (startX + squareSize / 2) + 'px';
    nametagElement.style.top = (startY - 14) + 'px';
    document.body.appendChild(nametagElement);

    // Create health bar
    const healthBarElement = document.createElement('div');
    healthBarElement.id = `health-bar-${squareId}`;
    healthBarElement.style.left = startX + 'px';
    healthBarElement.style.top = (startY + squareSize + 2) + 'px';
    document.body.appendChild(healthBarElement);

    const healthBarFill = document.createElement('div');
    healthBarFill.id = `health-bar-fill-${squareId}`;
    healthBarElement.appendChild(healthBarFill);

    const square = {
        element: squareElement,
        nametag: nametagElement,
        healthBar: healthBarElement,
        healthBarFill: healthBarFill,
        name: squareType.name,
        type: squareType,
        maxHealth: squareType.health,
        health: squareType.health,
        baseDamage: squareType.damage,
        damage: squareType.damage,
        x: startX,
        y: startY,
        dx: startDx,
        dy: startDy,
        wasNearCorner: false,
        powerups: {}
    };

    // Update health bar initially
    updateHealthBar(square);
    // Update border color initially
    updateBorderColor(square);

    // Clamp initial velocity
    clampVelocity(square);

    squares.push(square);
    return square;
}

function updateHealthBar(square) {
    const healthPercentage = Math.max(0, (square.health / square.maxHealth) * 100);
    square.healthBarFill.style.width = healthPercentage + '%';
    
    // If shield is active, show blue health bar
    if (square.powerups && square.powerups.shield) {
        square.healthBarFill.style.backgroundColor = '#2196F3'; // Blue for shield
    } else {
        // Change color based on health
        if (healthPercentage > 60) {
            square.healthBarFill.style.backgroundColor = '#4CAF50'; // Green
        } else if (healthPercentage > 30) {
            square.healthBarFill.style.backgroundColor = '#FF9800'; // Orange
        } else {
            square.healthBarFill.style.backgroundColor = '#F44336'; // Red
        }
    }
}

function updateBorderColor(square) {
    // Determine border color based on active powerups (shield not shown in border, only health bar)
    let borderColor = 'transparent';
    
    if (square.powerups) {
        const hasDamage = square.powerups.damageBoost && square.powerups.damageBoost > 1;
        const hasSpeed = square.powerups.speedBoost && square.powerups.speedBoost > 1;
        const hasShield = square.powerups.shield && square.powerups.shield > 0;

        // Priority: if multiple powerups, show combination colors (excluding shield)
        if (hasDamage && hasSpeed) {
            // Damage + Speed: orange (red + yellow)
            borderColor = '#FF9800';
        } else if (hasDamage) {
            // Damage only: red
            borderColor = '#F44336';
        } else if (hasSpeed) {
            // Speed only: yellow
            borderColor = '#FFEB3B';
        }
        // Shield is only indicated by blue health bar, not border color
    }

    square.element.style.borderColor = borderColor;
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

    const powerupElement = document.createElement('div');
    powerupElement.id = `powerup-${powerupId}`;
    powerupElement.style.position = 'absolute';
    powerupElement.style.width = powerupSize + 'px';
    powerupElement.style.height = powerupSize + 'px';
    powerupElement.style.backgroundColor = powerupType.color;
    powerupElement.style.border = '2px solid white';
    powerupElement.style.borderRadius = '4px';
    powerupElement.style.left = x + 'px';
    powerupElement.style.top = y + 'px';
    powerupElement.style.display = 'flex';
    powerupElement.style.alignItems = 'center';
    powerupElement.style.justifyContent = 'center';
    powerupElement.style.fontSize = '18px';
    powerupElement.style.fontWeight = 'bold';
    powerupElement.style.color = 'white';
    powerupElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
    powerupElement.textContent = powerupType.icon;
    document.body.appendChild(powerupElement);

    const powerup = {
        element: powerupElement,
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
            updateHealthBar(square);
            break;
        case 'damage':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.damageBoost) {
                square.powerups.damageBoost = 1; // Start at 1 (no boost)
            }
            // Stack damage boosts multiplicatively
            square.powerups.damageBoost *= powerupType.value;
            const currentBaseDamage = square.baseDamage || square.damage;
            if (!square.baseDamage) {
                square.baseDamage = currentBaseDamage;
            }
            square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
            updateBorderColor(square);
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.damageBoost) {
                        // Remove this boost by dividing it out
                        square.powerups.damageBoost /= powerupType.value;
                        if (square.powerups.damageBoost <= 1) {
                            square.damage = square.baseDamage;
                            delete square.powerups.damageBoost;
                        } else {
                            square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
                        }
                        updateBorderColor(square);
                    }
                }, powerupDuration);
            }
            break;
        case 'speed':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.speedBoost) {
                square.powerups.speedBoost = 1; // Start at 1 (no boost)
            }
            // Stack speed boosts multiplicatively
            square.powerups.speedBoost *= powerupType.value;
            updateBorderColor(square);
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.speedBoost) {
                        // Remove this boost by dividing it out
                        square.powerups.speedBoost /= powerupType.value;
                        if (square.powerups.speedBoost <= 1) {
                            delete square.powerups.speedBoost;
                        }
                        updateBorderColor(square);
                    }
                }, powerupDuration);
            }
            break;
        case 'shield':
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.shield) {
                square.powerups.shield = 0; // Start at 0 (no shield)
            }
            // Stack shields additively (cap at 90% damage reduction)
            square.powerups.shield = Math.min(0.9, square.powerups.shield + powerupType.value);
            updateBorderColor(square);
            updateHealthBar(square); // Update health bar color to blue
            if (powerupType.permanent === false) {
                setTimeout(() => {
                    if (square.powerups && square.powerups.shield) {
                        // Remove this shield boost
                        square.powerups.shield = Math.max(0, square.powerups.shield - powerupType.value);
                        if (square.powerups.shield <= 0) {
                            delete square.powerups.shield;
                            updateHealthBar(square); // Revert health bar color
                        }
                        updateBorderColor(square);
                    }
                }, powerupDuration);
            }
            break;
    }
}

function removePowerup(powerup) {
    if (powerup.element && powerup.element.parentNode) {
        powerup.element.parentNode.removeChild(powerup.element);
    }
    const index = powerups.indexOf(powerup);
    if (index > -1) {
        powerups.splice(index, 1);
    }
}

function removeSquare(square) {
    // Mark as dying and start shrink animation
    if (square.element && square.element.parentNode) {
        square.element.classList.add('dying');
    }
    if (square.nametag && square.nametag.parentNode) {
        square.nametag.classList.add('dying');
    }
    if (square.healthBar && square.healthBar.parentNode) {
        square.healthBar.classList.add('dying');
    }

    // Drop all active powerups when square dies
    const offsetDistance = 20; // Distance to spread powerups
    let powerupIndex = 0;
    let hasActivePowerups = false;
    
    if (square.powerups && square.powerups.damageBoost && square.powerups.damageBoost > 1) {
        const angle = (powerupIndex * (Math.PI * 2 / 3)); // Spread in 3 directions
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
    
    // Spawn random powerup when square dies (based on chance) if no powerups were dropped
    if (!hasActivePowerups && Math.random() < powerupSpawnChance) {
        createPowerup(square.x, square.y);
    }

    // Remove from squares array immediately to prevent further interactions
    const index = squares.indexOf(square);
    if (index > -1) {
        squares.splice(index, 1);
    }

    // Remove from DOM after animation completes (0.3s)
    setTimeout(() => {
        if (square.element && square.element.parentNode) {
            square.element.parentNode.removeChild(square.element);
        }
        if (square.nametag && square.nametag.parentNode) {
            square.nametag.parentNode.removeChild(square.nametag);
        }
        if (square.healthBar && square.healthBar.parentNode) {
            square.healthBar.parentNode.removeChild(square.healthBar);
        }
    }, 300);
}

function handleCollision(square1, square2) {
    // Calculate damage with shield reduction
    let damage1 = square2.damage;
    let damage2 = square1.damage;
    
    if (square1.powerups && square1.powerups.shield) {
        damage1 = Math.floor(damage1 * (1 - square1.powerups.shield));
    }
    if (square2.powerups && square2.powerups.shield) {
        damage2 = Math.floor(damage2 * (1 - square2.powerups.shield));
    }

    // Reduce health on collision using each square's damage value
    square1.health -= damage1;
    square2.health -= damage2;

    // Remove squares with no health
    if (square1.health <= 0) {
        removeSquare(square1);
        // square2.health += square2.damage; // Refund the damage if square1 dies
    }
    if (square2.health <= 0) {
        removeSquare(square2);
        // square1.health += square1.damage; // Refund the damage if square2 dies
    }

    // Update health bars
    updateHealthBar(square1);
    updateHealthBar(square2);

    // If either square was removed, don't process collision further
    if (square1.health <= 0 || square2.health <= 0) {
        return;
    }

    // Calculate center points
    const center1X = square1.x + squareSize / 2;
    const center1Y = square1.y + squareSize / 2;
    const center2X = square2.x + squareSize / 2;
    const center2Y = square2.y + squareSize / 2;

    // Calculate collision normal (direction from square2 to square1)
    let dx = center1X - center2X;
    let dy = center1Y - center2Y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    // Handle case where squares are exactly on top of each other
    if (distance === 0) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distance = Math.sqrt(dx * dx + dy * dy);
    }

    // Normalize collision normal
    const normalX = dx / distance;
    const normalY = dy / distance;

    // Separate squares to prevent overlap
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

    // Calculate relative velocity along collision normal
    const relativeSpeed = relativeVx * normalX + relativeVy * normalY;

    // Only resolve if squares are moving towards each other
    if (relativeSpeed < 0) {
        // Elastic collision: reflect velocities along collision normal
        // This ensures squares bounce away from each other in opposite directions
        const impulse = 2 * relativeSpeed;
        square1.dx -= impulse * normalX;
        square1.dy -= impulse * normalY;
        square2.dx += impulse * normalX;
        square2.dy += impulse * normalY;

        // Ensure minimum velocity to prevent sticking
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

    // Clamp velocities to prevent squares from moving too fast
    clampVelocity(square1);
    clampVelocity(square2);
}

function animateSquare(square, deltaTime) {
    const maxX = window.innerWidth - squareSize;
    const maxY = window.innerHeight - squareSize;

    // Apply speed boost if active
    const speedMultiplier = (square.powerups && square.powerups.speedBoost) ? square.powerups.speedBoost : 1;
    const effectiveNormalSpeed = normalSpeed * speedMultiplier;

    // Apply friction to slow down squares toward normal speed over frictionTime (1 second)
    const currentSpeed = Math.sqrt(square.dx * square.dx + square.dy * square.dy);
    if (currentSpeed > effectiveNormalSpeed) {
        // Calculate exponential decay toward normal speed based on time
        // Formula: speed = normalSpeed + (currentSpeed - normalSpeed) * e^(-t/τ)
        // Use time constant so that speed reaches ~1% of initial excess at frictionTime
        const timeConstant = frictionTime / 4.605; // 4.605 ≈ -ln(0.01), so e^(-4.605) ≈ 0.01
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
        // Maintain at normal speed if below normal
        const directionX = square.dx / currentSpeed;
        const directionY = square.dy / currentSpeed;
        square.dx = directionX * effectiveNormalSpeed;
        square.dy = directionY * effectiveNormalSpeed;
    }

    square.x += square.dx;
    square.y += square.dy;

    let hitX = false;
    let hitY = false;
    let bounced = false;
    let nearCorner = false;

    if (square.x <= 0 || square.x >= maxX) {
        square.dx = -square.dx;
        hitX = true;
        bounced = true;
        square.x = Math.max(0, Math.min(square.x, maxX));
    }

    if (square.y <= 0 || square.y >= maxY) {
        square.dy = -square.dy;
        hitY = true;
        bounced = true;
        square.y = Math.max(0, Math.min(square.y, maxY));
    }

    // Check if square is near a corner (within threshold distance from both edges)
    const nearLeftEdge = square.x <= cornerDetectionThreshold;
    const nearRightEdge = square.x >= maxX - cornerDetectionThreshold;
    const nearTopEdge = square.y <= cornerDetectionThreshold;
    const nearBottomEdge = square.y >= maxY - cornerDetectionThreshold;

    if ((nearLeftEdge || nearRightEdge) && (nearTopEdge || nearBottomEdge)) {
        nearCorner = true;
    }

    // Only create a new square when entering the corner area, not continuously while in it
    // And only if we haven't reached the maximum number of squares
    if (nearCorner && !square.wasNearCorner && squares.length < maxSquares) {
        const newDx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const newDy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const centerX = (window.innerWidth - squareSize) / 2;
        const centerY = (window.innerHeight - squareSize) / 2;
        createSquare(centerX, centerY, newDx, newDy);
    }

    square.wasNearCorner = nearCorner;
}

function animate() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Use a copy to avoid issues if squares are removed during iteration
    const squaresCopy = [...squares];
    squaresCopy.forEach(square => {
        if (squares.includes(square)) {
            animateSquare(square, deltaTime);
        }
    });

    // Check for collisions between all pairs of squares after movement
    // Use a copy to avoid issues when squares are removed during iteration
    const squaresForCollision = [...squares];
    for (let i = 0; i < squaresForCollision.length; i++) {
        for (let j = i + 1; j < squaresForCollision.length; j++) {
            const square1 = squaresForCollision[i];
            const square2 = squaresForCollision[j];
            // Make sure both squares still exist (haven't been removed)
            if (squares.includes(square1) && squares.includes(square2)) {
                if (checkCollision(square1, square2)) {
                    handleCollision(square1, square2);
                }
            }
        }
    }

    // Check for powerup collisions
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

    // Update positions after collision handling
    squares.forEach(square => {
        if (square.element && square.element.parentNode) {
            square.element.style.left = square.x + 'px';
            square.element.style.top = square.y + 'px';
        }
        if (square.nametag && square.nametag.parentNode) {
            square.nametag.style.left = (square.x + squareSize / 2) + 'px';
            square.nametag.style.top = (square.y - 14) + 'px';
        }
        if (square.healthBar && square.healthBar.parentNode) {
            square.healthBar.style.left = square.x + 'px';
            square.healthBar.style.top = (square.y + squareSize + 2) + 'px';
        }
    });

    // Check if there's only one square and spawn a new one after 10 seconds
    if (squares.length <= 1) {
        if (!singleSquareTimer) {
            // Start timer when there's only one square
            singleSquareTimer = currentTime;
        } else {
            // Check if 10 seconds have passed
            if (currentTime - singleSquareTimer >= singleSquareSpawnDelay) {
                // Spawn a new square at center with random velocity
                const centerX = (window.innerWidth - squareSize) / 2;
                const centerY = (window.innerHeight - squareSize) / 2;
                const newDx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
                const newDy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
                createSquare(centerX, centerY, newDx, newDy);
                singleSquareTimer = null; // Reset timer
            }
        }
    } else {
        // Reset timer if there's more than one square
        singleSquareTimer = null;
    }

    requestAnimationFrame(animate);
}

const centerX = (window.innerWidth - squareSize) / 2;
const centerY = (window.innerHeight - squareSize) / 2;
const initialSquare = createSquare(centerX, centerY, 3, 3);
animate();
