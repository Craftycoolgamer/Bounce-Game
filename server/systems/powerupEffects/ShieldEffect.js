const BasePowerupEffect = require('./BasePowerupEffect');

class ShieldEffect extends BasePowerupEffect {
    static getDefaultConfig() {
        return {
            name: "Shield",
            icon: "🛡",
            color: "#2196F3",
            effect: "shield",
            value: 0.5,
            permanent: true,
            duration: 0
        };
    }
    
    apply(square, powerupType) {
        this.ensurePowerups(square);
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups[key]) {
            square.powerups[key] = 0;
        }
        square.powerups[key] = Math.min(0.9, square.powerups[key] + powerupType.value);
    }
    
    remove(square, powerupType) {
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups || !square.powerups[key]) return;
        
        square.powerups[key] = Math.max(0, square.powerups[key] - powerupType.value);
        if (square.powerups[key] <= 0) {
            delete square.powerups[key];
        }
    }
}

module.exports = ShieldEffect;
