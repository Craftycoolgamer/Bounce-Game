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
        if (!square.powerups.shield) {
            square.powerups.shield = 0;
        }
        square.powerups.shield = Math.min(0.9, square.powerups.shield + powerupType.value);
    }
    
    remove(square, powerupType) {
        if (!square.powerups || !square.powerups.shield) return;
        
        square.powerups.shield = Math.max(0, square.powerups.shield - powerupType.value);
        if (square.powerups.shield <= 0) {
            delete square.powerups.shield;
        }
    }
}

module.exports = ShieldEffect;
