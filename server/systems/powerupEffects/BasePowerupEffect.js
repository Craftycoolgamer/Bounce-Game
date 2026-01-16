class BasePowerupEffect {
    apply(square, powerupType) {
        // Override in subclasses
    }
    
    remove(square, powerupType) {
        // Override in subclasses
    }
    
    scheduleRemoval(square, powerupType) {
        if (powerupType.permanent === false && powerupType.duration) {
            setTimeout(() => {
                this.remove(square, powerupType);
            }, powerupType.duration);
        }
    }
    
    ensurePowerups(square) {
        if (!square.powerups) {
            square.powerups = {};
        }
    }
}

module.exports = BasePowerupEffect;
