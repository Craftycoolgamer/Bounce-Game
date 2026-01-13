const GameConfig = require('../config/gameConfig');

class Square {
    constructor(id, x, y, dx, dy, config) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.health = config.health;
        this.maxHealth = config.health;
        this.damage = config.damage;
        this.baseDamage = config.damage;
        this.type = config.type;
        this.powerups = {};
        this.playerId = config.playerId || null;
        this.playerName = config.playerName || null;
    }
    
    getEffectiveSpeed() {
        const speedBoost = (this.powerups && this.powerups.speedBoost) ? this.powerups.speedBoost : 1;
        return GameConfig.physics.normalSpeed * speedBoost;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
    
    applyPowerup(powerupType) {
        // This will be handled by PowerupSystem
    }
    
    getEffectiveDamage() {
        const damageBoost = (this.powerups && this.powerups.damageBoost) ? this.powerups.damageBoost : 1;
        return Math.floor(this.baseDamage * damageBoost);
    }
    
    toJSON() {
        return {
            id: this.id,
            playerId: this.playerId,
            playerName: this.playerName,
            name: this.type.name,
            type: this.type,
            maxHealth: this.maxHealth,
            health: this.health,
            damage: this.getEffectiveDamage(),
            x: this.x,
            y: this.y,
            powerups: this.powerups || {}
        };
    }
}

module.exports = Square;
