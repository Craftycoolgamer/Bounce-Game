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
    });
    
    network.on('onSquareDied', (data) => {
        // Handle square death if needed
    });
    
    // Connect to server
    network.connect();
    
    // Setup login form
    const colorPicker = document.getElementById('colorPicker');
    const startButton = document.getElementById('startButton');
    
    if (startButton) {
        startButton.addEventListener('click', () => {
            const playerColor = colorPicker ? colorPicker.value : '#4CAF50';
            startButton.disabled = true;
            startButton.textContent = 'Connecting...';
            network.joinGame(playerColor);
        });
    }
});
