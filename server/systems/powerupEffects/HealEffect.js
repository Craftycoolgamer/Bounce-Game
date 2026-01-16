const BasePowerupEffect = require('./BasePowerupEffect');

class HealEffect extends BasePowerupEffect {
    static getDefaultConfig() {
        return {
            name: "Health",
            icon: "+",
            color: "#4CAF50",
            effect: "heal",
            value: 50,
            permanent: true,
            duration: 0
        };
    }

    apply(square, powerupType) {
        square.health = Math.min(square.health + powerupType.value, square.maxHealth);
    }
    
    remove(square, powerupType) {
        // Heal is instant, no removal needed
    }
}

module.exports = HealEffect;
