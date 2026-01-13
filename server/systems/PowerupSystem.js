const GameConfig = require('../config/gameConfig');
const Powerup = require('../entities/Powerup');
const IdGenerator = require('../utils/IdGenerator');

class PowerupEffectRegistry {
    constructor() {
        this.effects = new Map();
        this.setupDefaultEffects();
    }
    
    setupDefaultEffects() {
        // Heal effect
        this.register('heal', (square, powerupType) => {
            square.health = Math.min(square.health + powerupType.value, square.maxHealth);
        });
        
        // Damage boost effect
        this.register('damage', (square, powerupType) => {
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
                this.schedulePowerupRemoval(square, 'damageBoost', powerupType.value);
            }
        });
        
        // Speed boost effect
        this.register('speed', (square, powerupType) => {
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.speedBoost) {
                square.powerups.speedBoost = 1;
            }
            square.powerups.speedBoost *= powerupType.value;
            
            if (powerupType.permanent === false) {
                this.schedulePowerupRemoval(square, 'speedBoost', powerupType.value);
            }
        });
        
        // Shield effect
        this.register('shield', (square, powerupType) => {
            if (!square.powerups) square.powerups = {};
            if (!square.powerups.shield) {
                square.powerups.shield = 0;
            }
            square.powerups.shield = Math.min(0.9, square.powerups.shield + powerupType.value);
            
            if (powerupType.permanent === false) {
                this.schedulePowerupRemoval(square, 'shield', powerupType.value);
            }
        });
    }
    
    register(effectName, handler) {
        this.effects.set(effectName, handler);
    }
    
    apply(square, powerupType) {
        const handler = this.effects.get(powerupType.effect);
        if (handler) {
            handler(square, powerupType);
        } else {
            console.warn(`Unknown powerup effect: ${powerupType.effect}`);
        }
    }
    
    schedulePowerupRemoval(square, powerupKey, value) {
        setTimeout(() => {
            if (!square.powerups || !square.powerups[powerupKey]) return;
            
            if (powerupKey === 'damageBoost') {
                square.powerups.damageBoost /= value;
                if (square.powerups.damageBoost <= 1) {
                    square.damage = square.baseDamage;
                    delete square.powerups.damageBoost;
                } else {
                    square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
                }
            } else if (powerupKey === 'speedBoost') {
                square.powerups.speedBoost /= value;
                if (square.powerups.speedBoost <= 1) {
                    delete square.powerups.speedBoost;
                }
            } else if (powerupKey === 'shield') {
                square.powerups.shield = Math.max(0, square.powerups.shield - value);
                if (square.powerups.shield <= 0) {
                    delete square.powerups.shield;
                }
            }
        }, GameConfig.powerup.duration);
    }
}

class PowerupSystem {
    constructor(powerupTypes, eventEmitter) {
        this.powerupTypes = powerupTypes;
        this.powerups = [];
        this.registry = new PowerupEffectRegistry();
        this.idGenerator = new IdGenerator();
        this.eventEmitter = eventEmitter;
    }
    
    create(x, y, specificType = null) {
        const powerupType = specificType || this.powerupTypes[Math.floor(Math.random() * this.powerupTypes.length)];
        const powerup = new Powerup(this.idGenerator.next(), x, y, powerupType);
        this.powerups.push(powerup);
        return powerup;
    }
    
    remove(powerup) {
        const index = this.powerups.indexOf(powerup);
        if (index > -1) {
            this.powerups.splice(index, 1);
        }
    }
    
    checkCollision(square, powerup) {
        const squareSize = require('../config/gameConfig').square.size;
        const powerupSize = GameConfig.powerup.size;
        
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
    
    applyPowerup(square, powerup) {
        this.registry.apply(square, powerup.type);
        this.remove(powerup);
        
        if (this.eventEmitter) {
            this.eventEmitter.emit('powerupCollected', { square, powerup });
        }
    }
    
    dropPowerupsFromSquare(square) {
        const activePowerups = [];
        
        // Collect active powerups
        if (square.powerups?.damageBoost > 1) {
            activePowerups.push({
                effect: 'damage',
                type: this.powerupTypes.find(p => p.effect === 'damage')
            });
        }
        if (square.powerups?.speedBoost > 1) {
            activePowerups.push({
                effect: 'speed',
                type: this.powerupTypes.find(p => p.effect === 'speed')
            });
        }
        if (square.powerups?.shield > 0) {
            activePowerups.push({
                effect: 'shield',
                type: this.powerupTypes.find(p => p.effect === 'shield')
            });
        }
        
        // Drop powerups in a circle
        activePowerups.forEach((powerup, index) => {
            const angle = (index * (Math.PI * 2 / activePowerups.length));
            const offsetX = square.x + Math.cos(angle) * GameConfig.powerup.dropOffsetDistance;
            const offsetY = square.y + Math.sin(angle) * GameConfig.powerup.dropOffsetDistance;
            this.create(offsetX, offsetY, powerup.type);
        });
        
        // Drop random powerup if no active ones
        if (activePowerups.length === 0 && Math.random() < GameConfig.powerup.spawnChance) {
            this.create(square.x, square.y);
        }
    }
    
    getAll() {
        return this.powerups;
    }
}

module.exports = PowerupSystem;
