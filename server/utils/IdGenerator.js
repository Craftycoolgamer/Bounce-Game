class IdGenerator {
    constructor(startId = 0) {
        this.nextId = startId;
    }
    
    next() {
        return this.nextId++;
    }
    
    reset() {
        this.nextId = 0;
    }
}

module.exports = IdGenerator;
