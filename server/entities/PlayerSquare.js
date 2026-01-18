const BaseSquare = require('./BaseSquare');

class PlayerSquare extends BaseSquare {
    constructor(id, x, y, dx, dy, config) {
        super(id, x, y, dx, dy, config);
        this.isSpawner = false;
        this.invisible = false;
        const defaultConfig = PlayerSquare.getDefaultConfig();
        this.size = config.size ?? defaultConfig.size;
        this.normalSpeed = config.normalSpeed ?? defaultConfig.normalSpeed;
        this.maxVelocity = config.maxVelocity ?? defaultConfig.maxVelocity;
        this.maxDamage = config.maxDamage ?? null;
        this.frictionTime = config.frictionTime ?? defaultConfig.frictionTime;
        this.restitution = config.restitution ?? defaultConfig.restitution;
        this.separationBias = config.separationBias ?? defaultConfig.separationBias;
    }

    static getDefaultConfig() {
        return {
            name: "Player",
            health: 100,
            damage: 10,
            speed: 3,
            size: 50,
            normalSpeed: 10,
            maxVelocity: 20,
            frictionTime: 1000,
            restitution: 0.8,
            separationBias: 0.01
        };
    }
    
    static defaultColor = '#4CAF50';
    
    takeDamage(amount) {
        return super.takeDamage(amount);
    }
    
    getEffectiveDamage() {
        const damage = super.getEffectiveDamage();
        
        // Apply maxDamage cap if it exists (including 0)
        if (this.maxDamage != null) {
            return Math.min(damage, this.maxDamage);
        }
        
        return damage;
    }
}

module.exports = PlayerSquare;
