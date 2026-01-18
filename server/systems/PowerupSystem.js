const Powerup = require('../entities/Powerup');
const IdGenerator = require('../utils/IdGenerator');
const BaseSystem = require('./BaseSystem');
const HealEffect = require('./powerupEffects/HealEffect');
const DamageBoostEffect = require('./powerupEffects/DamageBoostEffect');
const SpeedBoostEffect = require('./powerupEffects/SpeedBoostEffect');
const ShieldEffect = require('./powerupEffects/ShieldEffect');

class PowerupEffectRegistry {
    constructor() {
        this.effects = new Map();
        this.setupDefaultEffects();
    }
    
    setupDefaultEffects() {
        this.register('heal', new HealEffect());
        this.register('damage', new DamageBoostEffect());
        this.register('speed', new SpeedBoostEffect());
        this.register('shield', new ShieldEffect());
    }
    
    register(effectName, effectInstance) {
        this.effects.set(effectName, effectInstance);
    }
    
    apply(square, powerupType) {
        const effect = this.effects.get(powerupType.effect);
        if (effect) {
            effect.apply(square, powerupType);
        } else {
            console.warn(`Unknown powerup effect: ${powerupType.effect}`);
        }
    }
}

class PowerupSystem extends BaseSystem {
    constructor(eventEmitter, customPowerupTypes = null) {
        super();
        this.powerupTypes = customPowerupTypes || this.getDefaultPowerupTypes();
        this.powerups = [];
        this.registry = new PowerupEffectRegistry();
        this.idGenerator = new IdGenerator();
        this.eventEmitter = eventEmitter;
    }
    
    getDefaultPowerupTypes() {
        return [
            HealEffect.getDefaultConfig(),
            DamageBoostEffect.getDefaultConfig(),
            SpeedBoostEffect.getDefaultConfig(),
            ShieldEffect.getDefaultConfig()
        ];
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
        const squareSize = square.size;
        const powerupSize = powerup.size;
        
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
        
        // Collect active powerups by iterating through powerup types
        for (const powerupType of this.powerupTypes) {
            const key = powerupType.effect;
            const value = square.powerups?.[key];
            
            // Check if powerup is active (number > 0 for shields, > 1 for multipliers)
            if (value && ((typeof value === 'number' && value > 0) || value)) {
                // For multipliers, only drop if > 1
                if (typeof value === 'number' && value <= 1 && value > 0) {
                    continue; // Skip if it's a multiplier at base value (1) or shield at 0
                }
                activePowerups.push({
                    effect: key,
                    type: powerupType
                });
            }
        }
        
        // Drop powerups in a circle
        activePowerups.forEach((powerup, index) => {
            const angle = (index * (Math.PI * 2 / activePowerups.length));
            const offsetX = square.x + Math.cos(angle) * Powerup.dropOffsetDistance;
            const offsetY = square.y + Math.sin(angle) * Powerup.dropOffsetDistance;
            this.create(offsetX, offsetY, powerup.type);
        });
        
        // Drop random powerup if no active ones
        if (activePowerups.length === 0 && Math.random() < Powerup.spawnChance) {
            this.create(square.x, square.y);
        }
    }
    
    getAll() {
        return this.powerups;
    }
    
    getPowerupTypes() {
        return this.powerupTypes;
    }
}

module.exports = PowerupSystem;
