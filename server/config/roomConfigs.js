const HealEffect = require('../systems/powerupEffects/HealEffect');
const DamageBoostEffect = require('../systems/powerupEffects/DamageBoostEffect');
const SpeedBoostEffect = require('../systems/powerupEffects/SpeedBoostEffect');
const ShieldEffect = require('../systems/powerupEffects/ShieldEffect');

// Default room - all powerups
const defaultRoom = {
    name: 'Default Room',
    gameConfig: {
        world: {
            width: 854,
            height: 480
        }
    },
    powerupTypes: [
        HealEffect.getDefaultConfig(),
        DamageBoostEffect.getDefaultConfig(),
        SpeedBoostEffect.getDefaultConfig(),
        ShieldEffect.getDefaultConfig()
    ],
    playerConfig: {
        maxVelocity: 1,
        maxDamage: 1,
    },
    spawnerCount: 3
};

// Fast-paced room - smaller world, only speed and damage powerups
const fastRoom = {
    name: 'Fast Room',
    gameConfig: {
        world: {
            width: 640,
            height: 360
        }
    },
    powerupTypes: [
        SpeedBoostEffect.getDefaultConfig(),
        DamageBoostEffect.getDefaultConfig()
    ],
    spawnerCount: 2
};

// Tank room - larger world, only heal and shield powerups
const tankRoom = {
    name: 'Tank Room',
    gameConfig: {
        world: {
            width: 1280,
            height: 720
        }
    },
    powerupTypes: [
        HealEffect.getDefaultConfig(),
        ShieldEffect.getDefaultConfig()
    ],
    playerConfig: {
        size: 50,
        normalSpeed: 5
    },
    spawnerCount: 5
};

// Aggressive room - enhanced damage and speed values
const aggressiveRoom = {
    name: 'Aggressive Room',
    gameConfig: {
        world: {
            width: 854,
            height: 480
        }
    },
    powerupTypes: [
        {
            ...DamageBoostEffect.getDefaultConfig(),
            value: 2.0 // Double damage boost
        },
        {
            ...SpeedBoostEffect.getDefaultConfig(),
            value: 2.0 // Double speed boost
        }
    ],
    spawnerCount: 4
};

// Turbo room - 3x speed boost
const turboRoom = {
    name: 'Turbo Room',
    gameConfig: {
        world: {
            width: 854,
            height: 480
        }
    },
    powerupTypes: [
        {
            ...SpeedBoostEffect.getDefaultConfig(),
            value: 3.0, // Triple speed boost
            duration: 1000 // 0.5 seconds
        },
    ],
    playerConfig: {
        size: 50,
        normalSpeed: 1,
        maxVelocity: 100,
    },
    spawnerCount: 1
};

const roomConfigs = {
    'default': defaultRoom,
    'fast': fastRoom,
    'tank': tankRoom,
    'aggressive': aggressiveRoom,
    'turbo': turboRoom
};

module.exports = roomConfigs;
