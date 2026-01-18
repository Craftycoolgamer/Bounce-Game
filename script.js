import { Renderer } from './client/Renderer.js';
import { Camera } from './client/Camera.js';
import { Network } from './client/Network.js';

let renderer = null;
let camera = null;
let network = null;

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.getElementById('gameArea');
    const viewport = document.getElementById('viewport');
    
    if (!gameArea || !viewport) {
        console.error('Game area or viewport not found');
        return;
    }
    
    // Initialize systems (network first, then pass to others for config access)
    network = new Network();
    renderer = new Renderer(gameArea, network);
    camera = new Camera(viewport, gameArea, network);
    
    // Setup network callbacks
    network.on('onConnect', () => {
        console.log('Network connected');
    });
    
    network.on('onRoomsList', (rooms) => {
        const roomSelector = document.getElementById('roomSelector');
        if (roomSelector && rooms.length > 0) {
            roomSelector.innerHTML = '';
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `${room.name} (${room.playerCount} players)`;
                roomSelector.appendChild(option);
            });
        }
    });
    
    network.on('onRoomError', (error) => {
        console.error('Room error:', error);
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = 'Start Game';
        }
        alert('Error: ' + (error.message || 'Failed to join room'));
    });
    
    let pendingPlayerColor = null;
    let hasJoinedRoom = false;
    
    network.on('onGameConfig', (config) => {
        console.log('Game config received from server');
        
        // Set CSS custom properties from server config (server is single source of truth)
        const gameArea = document.getElementById('gameArea');
        if (gameArea && config) {
            // World dimensions
            if (config.world) {
                gameArea.style.setProperty('--server-width', config.world.width + 'px');
                gameArea.style.setProperty('--server-height', config.world.height + 'px');
            }
            
            // Square size
            if (config.square && config.square.size) {
                gameArea.style.setProperty('--server-square-size', config.square.size + 'px');
            }
            
            // Powerup size
            if (config.powerup && config.powerup.size) {
                gameArea.style.setProperty('--server-powerup-size', config.powerup.size + 'px');
            }
        }
        
        // Re-initialize camera with correct world dimensions
        if (camera) {
            camera.reinitializeWithConfig();
        }
        
        // If we have a pending player color, join the game
        if (pendingPlayerColor && hasJoinedRoom) {
            network.joinGame(pendingPlayerColor);
            pendingPlayerColor = null;
            hasJoinedRoom = false;
        }
    });
    
    network.on('onPlayerJoined', (data) => {
        // Hide login screen
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.classList.add('hidden');
        }
    });
    
    network.on('onGameState', (gameState) => {
        const myPlayerId = network.getMyPlayerId();
        if (renderer) {
            renderer.updateGameState(gameState, myPlayerId);
        } else {
            console.error('Renderer not initialized when gameState received');
        }
        
        // Update player stats
        updatePlayerStats(gameState, myPlayerId);
    });
    
    network.on('onSquareDied', (data) => {
        // Handle square death if needed
    });
    
    // Connect to server
    network.connect();
    
    // Setup login form
    const roomSelector = document.getElementById('roomSelector');
    const colorPicker = document.getElementById('colorPicker');
    const startButton = document.getElementById('startButton');
    
    if (startButton) {
        startButton.addEventListener('click', () => {
            const selectedRoomId = roomSelector ? roomSelector.value : '';
            const playerColor = colorPicker ? colorPicker.value : '#4CAF50';
            
            if (!selectedRoomId) {
                alert('Please select a room');
                return;
            }
            
            startButton.disabled = true;
            startButton.textContent = 'Connecting...';
            
            // Store player color for when config is received
            pendingPlayerColor = playerColor;
            hasJoinedRoom = true;
            
            // Join room first, then game config will trigger game join
            network.joinRoom(selectedRoomId);
        });
    }
});

// Update player stats display
function updatePlayerStats(gameState, myPlayerId) {
    if (!gameState || !myPlayerId) {
        const playerStatsEl = document.getElementById('playerStats');
        if (playerStatsEl) {
            playerStatsEl.classList.add('hidden');
        }
        return;
    }
    
    // Find the player's square
    const playerSquare = gameState.squares?.find(square => 
        square.playerId === myPlayerId && !square.isSpawner
    );
    
    const playerStatsEl = document.getElementById('playerStats');
    if (!playerStatsEl) return;
    
    if (!playerSquare) {
        playerStatsEl.classList.add('hidden');
        return;
    }
    
    // Show stats and update values
    playerStatsEl.classList.remove('hidden');
    
    const healthEl = document.getElementById('playerHealth');
    const maxHealthEl = document.getElementById('playerMaxHealth');
    const damageEl = document.getElementById('playerDamage');
    const powerupsEl = document.getElementById('playerPowerups');
    
    if (healthEl) {
        healthEl.textContent = Math.max(0, Math.floor(playerSquare.health || 0));
        // Color health based on percentage
        const healthPercent = playerSquare.maxHealth > 0 
            ? (playerSquare.health / playerSquare.maxHealth) * 100 
            : 0;
        if (healthPercent > 60) {
            healthEl.style.color = '#4CAF50';
        } else if (healthPercent > 30) {
            healthEl.style.color = '#FFC107';
        } else {
            healthEl.style.color = '#f44336';
        }
    }
    
    if (maxHealthEl) {
        maxHealthEl.textContent = Math.floor(playerSquare.maxHealth || 0);
    }
    
    if (damageEl) {
        damageEl.textContent = playerSquare.damage || 0;
    }
    
    if (powerupsEl) {
        const powerups = playerSquare.powerups || {};
        const activePowerups = [];
        
        // Check for active powerups
        for (const key in powerups) {
            const value = powerups[key];
            if (typeof value === 'number' && value > 0) {
                // Format powerup name (e.g., "damage" -> "Damage", "speed" -> "Speed")
                const formattedName = key.charAt(0).toUpperCase() + key.slice(1);
                activePowerups.push(`${formattedName} (${value.toFixed(1)}x)`);
            } else if (value) {
                const formattedName = key.charAt(0).toUpperCase() + key.slice(1);
                activePowerups.push(formattedName);
            }
        }
        
        if (activePowerups.length > 0) {
            powerupsEl.innerHTML = activePowerups.join('<br>');
            powerupsEl.style.color = '#4CAF50';
        } else {
            powerupsEl.textContent = 'None';
            powerupsEl.style.color = 'white';
        }
    }
}
