const squareSize = 50;
const powerupSize = 30;

let squares = [];
let powerups = [];
let myPlayerId = null;
let mySquareId = null;
let socket = null;
let gameArea = null;

// Connect to server with player info
function connectToServer(playerColor) {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
        // Send player info to server (only color, name will be generated on server)
        socket.emit('playerInfo', {
            playerColor: playerColor
        });
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
        const colorPicker = document.getElementById('colorPicker');
        const startButton = document.getElementById('startButton');

        // Handle button click
        function handleStartGame() {
            const playerColor = colorPicker.value;
            startButton.disabled = true;
            startButton.textContent = 'Connecting...';
            connectToServer(playerColor);
        }

        startButton.addEventListener('click', handleStartGame);
    });
