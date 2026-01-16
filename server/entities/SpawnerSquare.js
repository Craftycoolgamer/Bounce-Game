const BaseSquare = require('./BaseSquare');

class SpawnerSquare extends BaseSquare {
    constructor(id, x, y, config) {
        super(id, x, y, 0, 0, config);
        this.isSpawner = true;
        this.invisible = config.type?.invisible || false;
        this.size = config.size || 50;
        this.normalSpeed = config.normalSpeed || 0;
        this.maxVelocity = config.maxVelocity || 0;
        this.frictionTime = config.frictionTime || 0;
        this.restitution = config.restitution || 0;
        this.separationBias = config.separationBias || 0;
    }
    
    static getDefaultConfig() {
        return {
            name: "Powerup Spawner",
            health: 999999,
            damage: 0,
            speed: 0,
            invisible: false,
            isSpawner: true,
            size: 50,
            normalSpeed: 0,
            maxVelocity: 0,
            frictionTime: 0,
            restitution: 0,
            separationBias: 0
        };
    }
    
    takeDamage(amount) {
        // Spawner squares don't take damage
        return false;
    }
    
    getEffectiveDamage() {
        // Spawner squares don't deal damage
        return 0;
    }
}

module.exports = SpawnerSquare;
