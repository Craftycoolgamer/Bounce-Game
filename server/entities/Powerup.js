const Entity = require('./Entity');

class Powerup extends Entity {
    static size = 30;
    static spawnChance = 1;
    static dropOffsetDistance = 20;
    
    constructor(id, x, y, type) {
        super(id, x, y);
        this.type = type;
        this.size = Powerup.size;
    }
}

module.exports = Powerup;
