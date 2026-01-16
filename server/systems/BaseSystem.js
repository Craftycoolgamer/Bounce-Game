class BaseSystem {
    constructor() {
        this.initialized = false;
        this.squareSize = 50;
        this.gameWidth = 854;
        this.gameHeight = 480;

        this.maxVelocity = 20;
        this.normalSpeed = 10;
        this.frictionTime = 1000;
        this.restitution = 0.8;
        this.separationBias = 0.01;
    }
    
    initialize() {
        this.initialized = true;
    }
    
    update(deltaTime) {
        // Override in subclasses
    }
    
    cleanup() {
        // Override in subclasses
    }
}

module.exports = BaseSystem;
