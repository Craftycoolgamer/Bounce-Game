const BasePowerupEffect = require('./BasePowerupEffect');

class SpeedBoostEffect extends BasePowerupEffect {
    static getDefaultConfig() {
        return {
            name: "Speed Boost",
            icon: "⚡",
            color: "#FFEB3B",
            effect: "speed",
            value: 1.5,
            permanent: false,
            duration: 5000
        };
    }
    
    apply(square, powerupType) {
        this.ensurePowerups(square);
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups[key]) {
            square.powerups[key] = 1;
        }
        square.powerups[key] *= powerupType.value;
        
        // Cap multiplier based on maxVelocity if it exists (like shield caps at 0.9)
        if (square.maxVelocity != null && square.normalSpeed > 0) {
            const maxMultiplier = square.maxVelocity / square.normalSpeed;
            square.powerups[key] = Math.min(square.powerups[key], maxMultiplier);
        }
        
        this.scheduleRemoval(square, powerupType);
    }
    
    remove(square, powerupType) {
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups || !square.powerups[key]) return;
        
        square.powerups[key] /= powerupType.value;
        
        // Cap multiplier based on maxVelocity if it exists
        if (square.maxVelocity != null && square.normalSpeed > 0) {
            const maxMultiplier = square.maxVelocity / square.normalSpeed;
            square.powerups[key] = Math.min(square.powerups[key], maxMultiplier);
        }
        
        if (square.powerups[key] <= 1) {
            delete square.powerups[key];
        }
    }
}

module.exports = SpeedBoostEffect;
