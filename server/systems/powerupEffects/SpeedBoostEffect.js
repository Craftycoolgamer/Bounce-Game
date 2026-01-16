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
        if (!square.powerups.speedBoost) {
            square.powerups.speedBoost = 1;
        }
        square.powerups.speedBoost *= powerupType.value;
        
        this.scheduleRemoval(square, powerupType);
    }
    
    remove(square, powerupType) {
        if (!square.powerups || !square.powerups.speedBoost) return;
        
        square.powerups.speedBoost /= powerupType.value;
        if (square.powerups.speedBoost <= 1) {
            delete square.powerups.speedBoost;
        }
    }
}

module.exports = SpeedBoostEffect;
