const squareSize = 50;
const powerupSize = 30;

let squares = [];
let powerups = [];
let myPlayerId = null;
let mySquareId = null;
let socket = null;
let gameArea = null;
let viewport = null;

// Pan and zoom state
let panState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    translateX: 0,
    translateY: 0
};

let zoomState = {
    scale: 1,
    minScale: 0.1,
    maxScale: 5
};

// Initialize pan and zoom
function initializePanZoom() {
    viewport = document.getElementById('viewport');
    if (!viewport) return;

    // Calculate initial scale to fit viewport
    const initialScale = Math.min(
        window.innerWidth / 1920,
        window.innerHeight / 1080
    );
    zoomState.scale = initialScale;
    
    // Center the game area initially
    panState.translateX = (window.innerWidth - 1920 * initialScale) / 2;
    panState.translateY = (window.innerHeight - 1080 * initialScale) / 2;
    
    updateTransform();

    // Mouse drag handlers
    viewport.addEventListener('mousedown', handleMouseDown);
    viewport.addEventListener('mousemove', handleMouseMove);
    viewport.addEventListener('mouseup', handleMouseUp);
    viewport.addEventListener('mouseleave', handleMouseUp);

    // Mouse wheel zoom
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    // Touch handlers for mobile
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);
}

function updateTransform() {
    if (!gameArea) return;
    gameArea.style.transform = `translate(${panState.translateX}px, ${panState.translateY}px) scale(${zoomState.scale})`;
}

function handleMouseDown(e) {
    // Don't start drag if clicking on interactive elements
    if (e.target !== viewport && e.target !== gameArea && !e.target.closest('#gameArea')) {
        return;
    }
    panState.isDragging = true;
    panState.startX = e.clientX - panState.translateX;
    panState.startY = e.clientY - panState.translateY;
    viewport.classList.add('dragging');
    e.preventDefault();
}

function handleMouseMove(e) {
    if (!panState.isDragging) return;
    panState.translateX = e.clientX - panState.startX;
    panState.translateY = e.clientY - panState.startY;
    updateTransform();
    e.preventDefault();
}

function handleMouseUp(e) {
    if (panState.isDragging) {
        panState.isDragging = false;
        viewport.classList.remove('dragging');
    }
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(
        zoomState.minScale,
        Math.min(zoomState.maxScale, zoomState.scale + delta)
    );
    
    // Zoom towards mouse position
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom point in game coordinates
    const gameX = (mouseX - panState.translateX) / zoomState.scale;
    const gameY = (mouseY - panState.translateY) / zoomState.scale;
    
    zoomState.scale = newScale;
    
    // Adjust pan to zoom towards mouse
    panState.translateX = mouseX - gameX * zoomState.scale;
    panState.translateY = mouseY - gameY * zoomState.scale;
    
    updateTransform();
}

// Touch handlers for mobile support
let touchState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    lastDistance: 0,
    initialScale: 1,
    initialTranslateX: 0,
    initialTranslateY: 0
};

function handleTouchStart(e) {
    if (e.touches.length === 1) {
        // Single touch - pan
        const touch = e.touches[0];
        touchState.isDragging = true;
        touchState.startX = touch.clientX - panState.translateX;
        touchState.startY = touch.clientY - panState.translateY;
        viewport.classList.add('dragging');
    } else if (e.touches.length === 2) {
        // Two touches - zoom
        touchState.isDragging = false;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        touchState.lastDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        touchState.initialScale = zoomState.scale;
        touchState.initialTranslateX = panState.translateX;
        touchState.initialTranslateY = panState.translateY;
    }
    e.preventDefault();
}

function handleTouchMove(e) {
    if (e.touches.length === 1 && touchState.isDragging) {
        // Single touch - pan
        const touch = e.touches[0];
        panState.translateX = touch.clientX - touchState.startX;
        panState.translateY = touch.clientY - touchState.startY;
        updateTransform();
    } else if (e.touches.length === 2) {
        // Two touches - zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        const scaleChange = distance / touchState.lastDistance;
        const newScale = Math.max(
            zoomState.minScale,
            Math.min(zoomState.maxScale, touchState.initialScale * scaleChange)
        );
        
        // Zoom towards center of two touches
        const rect = viewport.getBoundingClientRect();
        const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        
        const gameX = (centerX - touchState.initialTranslateX) / touchState.initialScale;
        const gameY = (centerY - touchState.initialTranslateY) / touchState.initialScale;
        
        zoomState.scale = newScale;
        panState.translateX = centerX - gameX * zoomState.scale;
        panState.translateY = centerY - gameY * zoomState.scale;
        
        updateTransform();
    }
    e.preventDefault();
}

function handleTouchEnd(e) {
    touchState.isDragging = false;
    viewport.classList.remove('dragging');
}

// Connect to server (for viewing game state)
function connectToServer() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('playerJoined', (data) => {
        myPlayerId = data.playerId;
        mySquareId = data.squareId;
        console.log('Joined as', data.playerName, 'with square ID', data.squareId);
        // Hide login screen and show game
        const loginScreen = document.getElementById('loginScreen');
        loginScreen.classList.add('hidden');
    });

    socket.on('gameState', (gameState) => {
        updateGameState(gameState);
    });

    socket.on('squareDied', (data) => {
        if (data.squareId === mySquareId) {
            console.log('Your square died!');
            mySquareId = null;
        }
    });
}

// Send player info to join the game
function joinGame(playerColor) {
    if (socket && socket.connected) {
        socket.emit('playerInfo', {
            playerColor: playerColor
        });
    }
}

function updateGameState(gameState) {
    // Update squares
    gameState.squares.forEach(serverSquare => {
        let square = squares.find(s => s.id === serverSquare.id);
        
        if (!square) {
            // Create new square
            square = createSquareElement(serverSquare);
            squares.push(square);
        } else {
            // Update existing square
            updateSquare(square, serverSquare);
        }
    });

    // Remove squares that no longer exist
    squares = squares.filter(square => {
        const exists = gameState.squares.some(ss => ss.id === square.id);
        if (!exists && square.element && square.element.parentNode) {
            // Remove from DOM
            if (square.element.parentNode) square.element.parentNode.removeChild(square.element);
            if (square.nametag && square.nametag.parentNode) square.nametag.parentNode.removeChild(square.nametag);
            if (square.healthBar && square.healthBar.parentNode) square.healthBar.parentNode.removeChild(square.healthBar);
        }
        return exists;
    });

    // Update powerups
    gameState.powerups.forEach(serverPowerup => {
        let powerup = powerups.find(p => p.id === serverPowerup.id);
        
        if (!powerup) {
            powerup = createPowerupElement(serverPowerup);
            powerups.push(powerup);
        } else {
            updatePowerup(powerup, serverPowerup);
        }
    });

    // Remove powerups that no longer exist
    powerups = powerups.filter(powerup => {
        const exists = gameState.powerups.some(sp => sp.id === powerup.id);
        if (!exists && powerup.element && powerup.element.parentNode) {
            powerup.element.parentNode.removeChild(powerup.element);
        }
        return exists;
    });
}

function createSquareElement(serverSquare) {
    const squareElement = document.createElement('div');
    squareElement.id = `square-${serverSquare.id}`;
    squareElement.style.position = 'absolute';
    squareElement.style.width = squareSize + 'px';
    squareElement.style.height = squareSize + 'px';
    squareElement.style.backgroundColor = serverSquare.type.color;
    squareElement.style.transition = 'background-color 0.1s ease, border-color 0.1s ease';
    squareElement.style.left = serverSquare.x + 'px';
    squareElement.style.top = serverSquare.y + 'px';
    
    // Highlight player's own square
    if (serverSquare.playerId === myPlayerId) {
        squareElement.style.boxShadow = '0 0 10px 3px rgba(255, 255, 255, 0.8)';
        squareElement.style.border = '3px solid white';
    } else {
        squareElement.style.border = '3px solid transparent';
    }
    
    gameArea.appendChild(squareElement);

    // Create nametag (show player name if available, otherwise square type)
    const nametagElement = document.createElement('div');
    nametagElement.id = `nametag-${serverSquare.id}`;
    nametagElement.textContent = serverSquare.playerName || serverSquare.name;
    nametagElement.style.left = (serverSquare.x + squareSize / 2) + 'px';
    nametagElement.style.top = (serverSquare.y - 14) + 'px';
    gameArea.appendChild(nametagElement);

    // Create health bar
    const healthBarElement = document.createElement('div');
    healthBarElement.id = `health-bar-${serverSquare.id}`;
    healthBarElement.style.left = serverSquare.x + 'px';
    healthBarElement.style.top = (serverSquare.y + squareSize + 2) + 'px';
    gameArea.appendChild(healthBarElement);

    const healthBarFill = document.createElement('div');
    healthBarFill.id = `health-bar-fill-${serverSquare.id}`;
    healthBarElement.appendChild(healthBarFill);

    return {
        id: serverSquare.id,
        element: squareElement,
        nametag: nametagElement,
        healthBar: healthBarElement,
        healthBarFill: healthBarFill,
        playerId: serverSquare.playerId
    };
}

function updateSquare(square, serverSquare) {
    // Update position
    square.element.style.left = serverSquare.x + 'px';
    square.element.style.top = serverSquare.y + 'px';
    
    // Update nametag position
    square.nametag.style.left = (serverSquare.x + squareSize / 2) + 'px';
    square.nametag.style.top = (serverSquare.y - 14) + 'px';
    square.nametag.textContent = serverSquare.playerName || serverSquare.name;
    
    // Update health bar
    const healthPercentage = Math.max(0, (serverSquare.health / serverSquare.maxHealth) * 100);
    square.healthBarFill.style.width = healthPercentage + '%';
    square.healthBar.style.left = serverSquare.x + 'px';
    square.healthBar.style.top = (serverSquare.y + squareSize + 2) + 'px';
    
    // Update health bar color
    if (serverSquare.powerups && serverSquare.powerups.shield) {
        square.healthBarFill.style.backgroundColor = '#2196F3';
    } else {
        if (healthPercentage > 60) {
            square.healthBarFill.style.backgroundColor = '#4CAF50';
        } else if (healthPercentage > 30) {
            square.healthBarFill.style.backgroundColor = '#FF9800';
        } else {
            square.healthBarFill.style.backgroundColor = '#F44336';
        }
    }
    
    // Update border color based on powerups
    let borderColor = 'transparent';
    if (serverSquare.powerups) {
        const hasDamage = serverSquare.powerups.damageBoost && serverSquare.powerups.damageBoost > 1;
        const hasSpeed = serverSquare.powerups.speedBoost && serverSquare.powerups.speedBoost > 1;
        
        if (hasDamage && hasSpeed) {
            borderColor = '#FF9800';
        } else if (hasDamage) {
            borderColor = '#F44336';
        } else if (hasSpeed) {
            borderColor = '#FFEB3B';
        }
    }
    
    // Update border (but keep white border for player's own square)
    if (serverSquare.playerId === myPlayerId) {
        square.element.style.boxShadow = '0 0 10px 3px rgba(255, 255, 255, 0.8)';
        square.element.style.border = '3px solid white';
    } else {
        square.element.style.borderColor = borderColor;
    }
    
    // Handle square death animation
    if (serverSquare.health <= 0 && square.element && !square.element.classList.contains('dying')) {
        square.element.classList.add('dying');
        square.nametag.classList.add('dying');
        square.healthBar.classList.add('dying');
        
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
}

function createPowerupElement(serverPowerup) {
    const powerupElement = document.createElement('div');
    powerupElement.id = `powerup-${serverPowerup.id}`;
    powerupElement.style.position = 'absolute';
    powerupElement.style.width = powerupSize + 'px';
    powerupElement.style.height = powerupSize + 'px';
    powerupElement.style.backgroundColor = serverPowerup.type.color;
    powerupElement.style.border = '2px solid white';
    powerupElement.style.borderRadius = '4px';
    powerupElement.style.left = serverPowerup.x + 'px';
    powerupElement.style.top = serverPowerup.y + 'px';
    powerupElement.style.display = 'flex';
    powerupElement.style.alignItems = 'center';
    powerupElement.style.justifyContent = 'center';
    powerupElement.style.fontSize = '18px';
    powerupElement.style.fontWeight = 'bold';
    powerupElement.style.color = 'white';
    powerupElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
    powerupElement.textContent = serverPowerup.type.icon;
    gameArea.appendChild(powerupElement);

    return {
        id: serverPowerup.id,
        element: powerupElement
    };
}

function updatePowerup(powerup, serverPowerup) {
    powerup.element.style.left = serverPowerup.x + 'px';
    powerup.element.style.top = serverPowerup.y + 'px';
}

    // Initialize login screen
    window.addEventListener('DOMContentLoaded', () => {
        gameArea = document.getElementById('gameArea');
        initializePanZoom();
        
        // Connect to server immediately to receive game state updates
        connectToServer();
        
        const colorPicker = document.getElementById('colorPicker');
        const startButton = document.getElementById('startButton');

        // Handle button click
        function handleStartGame() {
            const playerColor = colorPicker.value;
            startButton.disabled = true;
            startButton.textContent = 'Connecting...';
            joinGame(playerColor);
        }

        startButton.addEventListener('click', handleStartGame);
    });
