const BasePowerupEffect = require('./BasePowerupEffect');

class DamageBoostEffect extends BasePowerupEffect {
    
    static getDefaultConfig() {
        return {
            name: "Damage Boost",
            icon: "⚔",
            color: "#FF5722",
            effect: "damage",
            value: 1.5,
            permanent: false,
            duration: 0
        };
    }
    
    apply(square, powerupType) {
        this.ensurePowerups(square);
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups[key]) {
            square.powerups[key] = 1;
        }
        square.powerups[key] *= powerupType.value;
        
        if (!square.baseDamage) {
            square.baseDamage = square.damage;
        }
        
        // Cap multiplier based on maxDamage if it exists (like shield caps at 0.9)
        if (square.maxDamage != null && square.baseDamage > 0) {
            const maxMultiplier = square.maxDamage / square.baseDamage;
            square.powerups[key] = Math.min(square.powerups[key], maxMultiplier);
        }
        
        square.damage = Math.floor(square.baseDamage * square.powerups[key]);
    }

    remove(square, powerupType) {
        const key = powerupType.effect; // Use effect name as key
        if (!square.powerups || !square.powerups[key]) return;
        
        square.powerups[key] /= powerupType.value;
        
        // Cap multiplier based on maxDamage if it exists
        if (square.maxDamage != null && square.baseDamage > 0) {
            const maxMultiplier = square.maxDamage / square.baseDamage;
            square.powerups[key] = Math.min(square.powerups[key], maxMultiplier);
        }
        
        if (square.powerups[key] <= 1) {
            square.damage = square.baseDamage;
            delete square.powerups[key];
        } else {
            square.damage = Math.floor(square.baseDamage * square.powerups[key]);
        }
    }
}

module.exports = DamageBoostEffect;
