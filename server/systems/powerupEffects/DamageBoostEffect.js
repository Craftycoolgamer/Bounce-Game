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
        if (!square.powerups.damageBoost) {
            square.powerups.damageBoost = 1;
        }
        square.powerups.damageBoost *= powerupType.value;
        
        if (!square.baseDamage) {
            square.baseDamage = square.damage;
        }
        square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
    }

    remove(square, powerupType) {
        if (!square.powerups || !square.powerups.damageBoost) return;
        
        square.powerups.damageBoost /= powerupType.value;
        if (square.powerups.damageBoost <= 1) {
            square.damage = square.baseDamage;
            delete square.powerups.damageBoost;
        } else {
            square.damage = Math.floor(square.baseDamage * square.powerups.damageBoost);
        }
    }
}

module.exports = DamageBoostEffect;
