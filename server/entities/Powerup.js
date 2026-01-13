class Powerup {
    constructor(id, x, y, type) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
    }
    
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y
        };
    }
}

module.exports = Powerup;
