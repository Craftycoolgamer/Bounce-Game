module.exports = {
    // Game world
    world: {
        width: 854,
        height: 480
    },
    
    // Square properties
    square: {
        size: 50,
        maxCount: 50,
        defaultHealth: 100,
        defaultDamage: 10,
        defaultColor: '#4CAF50'
    },
    
    // Physics
    physics: {
        maxVelocity: 20,
        normalSpeed: 10,
        frictionTime: 1000,
        restitution: 0.8,
        separationBias: 0.01
    },
    
    // Powerups
    powerup: {
        size: 30,
        duration: 10000,
        spawnChance: 1,
        dropOffsetDistance: 20
    },
    
    // Spatial grid
    spatialGrid: {
        cellSize: 100
    },
    
    // Game loop
    gameLoop: {
        fps: 120
    }
};
