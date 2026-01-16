class Game {
    static fps = 120;
    
    constructor(overrides = {}) {
        // Game world - owned by Game instance
        this.world = {
            width: 854,
            height: 480,
            ...overrides.world
        };
    }
}

module.exports = Game;
