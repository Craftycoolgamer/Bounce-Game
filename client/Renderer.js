import { GameConfig } from './config/gameConfig.js';
import { getHealthBarColor } from './utils/healthBar.js';

export class Renderer {
    constructor(gameArea, network = null) {
        this.gameArea = gameArea;
        this.network = network; // To get server config
        this.squareElements = new Map();
        this.powerupElements = new Map();
    }
    
    getSquareSize() {
        // Get from server config (single source of truth)
        if (this.network) {
            const config = this.network.getGameConfig();
            if (config && config.square && typeof config.square.size === 'number') {
                return config.square.size;
            }
        }
        // Fallback (shouldn't happen, but prevents errors)
        return 50;
    }
    
    getPowerupSize() {
        // Get from server config (single source of truth)
        if (this.network) {
            const config = this.network.getGameConfig();
            if (config && config.powerup && typeof config.powerup.size === 'number') {
                return config.powerup.size;
            }
        }
        // Fallback (shouldn't happen, but prevents errors)
        return 30;
    }
    
    createSquare(serverSquare, myPlayerId) {
        // Skip rendering invisible spawner squares
        if (serverSquare.invisible) {
            return;
        }
        
        const squareSize = this.getSquareSize();
        
        // Create square element
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
        if (serverSquare.playerId === myPlayerId && !serverSquare.isSpawner) {
            squareElement.style.boxShadow = '0 0 10px 3px rgba(255, 255, 255, 0.8)';
            squareElement.style.border = '3px solid white';
        } else {
            squareElement.style.border = '3px solid transparent';
        }
        
        this.gameArea.appendChild(squareElement);
        
        // Create nametag
        let nametagElement = null;
        if (!serverSquare.isSpawner) {
            nametagElement = document.createElement('div');
            nametagElement.id = `nametag-${serverSquare.id}`;
            nametagElement.textContent = serverSquare.playerName || serverSquare.name;
            nametagElement.style.left = (serverSquare.x + squareSize / 2) + 'px';
            nametagElement.style.top = (serverSquare.y + GameConfig.rendering.nametagOffset) + 'px';
            this.gameArea.appendChild(nametagElement);
        }
        
        // Create health bar
        let healthBarElement = null;
        let healthBarFill = null;
        if (!serverSquare.isSpawner) {
            healthBarElement = document.createElement('div');
            healthBarElement.id = `health-bar-${serverSquare.id}`;
            healthBarElement.style.left = serverSquare.x + 'px';
            healthBarElement.style.top = (serverSquare.y + squareSize + GameConfig.rendering.healthBarOffset) + 'px';
            this.gameArea.appendChild(healthBarElement);
            
            healthBarFill = document.createElement('div');
            healthBarFill.id = `health-bar-fill-${serverSquare.id}`;
            healthBarElement.appendChild(healthBarFill);
        }
        
        this.squareElements.set(serverSquare.id, {
            id: serverSquare.id,
            element: squareElement,
            nametag: nametagElement,
            healthBar: healthBarElement,
            healthBarFill: healthBarFill,
            playerId: serverSquare.playerId
        });
    }
    
    updateSquare(squareId, serverSquare, myPlayerId) {
        // Skip updating invisible spawner squares
        if (serverSquare.invisible || serverSquare.isSpawner) {
            return;
        }
        
        const square = this.squareElements.get(squareId);
        if (!square) return;
        
        const squareSize = this.getSquareSize();
        
        // Update position
        square.element.style.left = serverSquare.x + 'px';
        square.element.style.top = serverSquare.y + 'px';
        
        // Update nametag position
        square.nametag.style.left = (serverSquare.x + squareSize / 2) + 'px';
        square.nametag.style.top = (serverSquare.y + GameConfig.rendering.nametagOffset) + 'px';
        square.nametag.textContent = serverSquare.playerName || serverSquare.name;
        
        // Update health bar
        const healthPercentage = Math.max(0, (serverSquare.health / serverSquare.maxHealth) * 100);
        square.healthBarFill.style.width = healthPercentage + '%';
        square.healthBar.style.left = serverSquare.x + 'px';
        square.healthBar.style.top = (serverSquare.y + squareSize + GameConfig.rendering.healthBarOffset) + 'px';
        
        // Update health bar color
        const hasShield = serverSquare.powerups && serverSquare.powerups.shield;
        square.healthBarFill.style.backgroundColor = getHealthBarColor(healthPercentage, hasShield);
        
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
                this.removeSquare(squareId);
            }, GameConfig.rendering.deathAnimationDuration);
        }
    }
    
    removeSquare(squareId) {
        const square = this.squareElements.get(squareId);
        if (!square) return;
        
        if (square.element && square.element.parentNode) {
            square.element.parentNode.removeChild(square.element);
        }
        if (square.nametag && square.nametag.parentNode) {
            square.nametag.parentNode.removeChild(square.nametag);
        }
        if (square.healthBar && square.healthBar.parentNode) {
            square.healthBar.parentNode.removeChild(square.healthBar);
        }
        
        this.squareElements.delete(squareId);
    }
    
    createPowerup(serverPowerup) {
        const powerupSize = this.getPowerupSize();
        
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
        this.gameArea.appendChild(powerupElement);
        
        this.powerupElements.set(serverPowerup.id, {
            id: serverPowerup.id,
            element: powerupElement
        });
    }
    
    updatePowerup(powerupId, serverPowerup) {
        const powerup = this.powerupElements.get(powerupId);
        if (!powerup) return;
        
        powerup.element.style.left = serverPowerup.x + 'px';
        powerup.element.style.top = serverPowerup.y + 'px';
    }
    
    removePowerup(powerupId) {
        const powerup = this.powerupElements.get(powerupId);
        if (!powerup) return;
        
        if (powerup.element && powerup.element.parentNode) {
            powerup.element.parentNode.removeChild(powerup.element);
        }
        
        this.powerupElements.delete(powerupId);
    }
    
    updateGameState(gameState, myPlayerId) {
        if (!gameState) {
            console.warn('Renderer: Received null or undefined gameState');
            return;
        }
        
        try {
            // Update squares (filter out invisible spawners)
            if (gameState.squares && Array.isArray(gameState.squares)) {
                gameState.squares.forEach(serverSquare => {
                    // Skip invisible spawner squares
                    if (serverSquare.invisible) {
                        return;
                    }
                    
                    if (this.squareElements.has(serverSquare.id)) {
                        this.updateSquare(serverSquare.id, serverSquare, myPlayerId);
                    } else {
                        this.createSquare(serverSquare, myPlayerId);
                    }
                });
                
                // Remove squares that no longer exist
                const existingSquareIds = new Set(
                    gameState.squares
                        .filter(s => !s.invisible)
                        .map(s => s.id)
                );
                for (const squareId of this.squareElements.keys()) {
                    if (!existingSquareIds.has(squareId)) {
                        this.removeSquare(squareId);
                    }
                }
            }
            
            // Update powerups
            if (gameState.powerups && Array.isArray(gameState.powerups)) {
                gameState.powerups.forEach(serverPowerup => {
                    if (this.powerupElements.has(serverPowerup.id)) {
                        this.updatePowerup(serverPowerup.id, serverPowerup);
                    } else {
                        this.createPowerup(serverPowerup);
                    }
                });
                
                // Remove powerups that no longer exist
                const existingPowerupIds = new Set(gameState.powerups.map(p => p.id));
                for (const powerupId of this.powerupElements.keys()) {
                    if (!existingPowerupIds.has(powerupId)) {
                        this.removePowerup(powerupId);
                    }
                }
            }
        } catch (error) {
            console.error('Renderer: Error updating game state:', error);
        }
    }
}
