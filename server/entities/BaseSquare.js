const Entity = require('./Entity');

class BaseSquare extends Entity {
    static maxCount = 50;
    
    constructor(id, x, y, dx, dy, config) {
        super(id, x, y);
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
        return this.normalSpeed * speedBoost;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
    
    getEffectiveDamage() {
        const damageBoost = (this.powerups && this.powerups.damageBoost) ? this.powerups.damageBoost : 1;
        return Math.floor(this.baseDamage * damageBoost);
    }
    
    toJSON() {
        const json = super.toJSON();
        
        // Add square-specific properties
        json.playerId = this.playerId;
        json.playerName = this.playerName;
        json.name = this.type.name;
        json.maxHealth = this.maxHealth;
        json.health = this.health;
        json.damage = this.getEffectiveDamage();
        json.powerups = this.powerups || {};
        
        // Include subclass-specific properties if they exist
        if (this.hasOwnProperty('isSpawner')) {
            json.isSpawner = this.isSpawner;
        }
        if (this.hasOwnProperty('invisible')) {
            json.invisible = this.invisible;
        }
        
        return json;
    }
}

module.exports = BaseSquare;
