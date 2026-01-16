const BaseSquare = require('./BaseSquare');

class PlayerSquare extends BaseSquare {
    constructor(id, x, y, dx, dy, config) {
        super(id, x, y, dx, dy, config);
        this.isSpawner = false;
        this.invisible = false;
        this.size = config.size || 50;
        this.normalSpeed = config.normalSpeed || 10;
        this.maxVelocity = config.maxVelocity || 20;
        this.frictionTime = config.frictionTime || 1000;
        this.restitution = config.restitution || 0.8;
        this.separationBias = config.separationBias || 0.01;
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
    
    takeDamage(amount) {
        return super.takeDamage(amount);
    }
    
    getEffectiveDamage() {
        return super.getEffectiveDamage();
    }
}

module.exports = PlayerSquare;
