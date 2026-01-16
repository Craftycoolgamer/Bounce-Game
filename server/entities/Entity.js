class Entity {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
    }
    
    toJSON() {
        const json = {
            id: this.id,
            x: this.x,
            y: this.y
        };
        
        // Include additional properties if they exist
        if (this.hasOwnProperty('type')) {
            json.type = this.type;
        }
        if (this.hasOwnProperty('size')) {
            json.size = this.size;
        }
        
        return json;
    }
}

module.exports = Entity;
