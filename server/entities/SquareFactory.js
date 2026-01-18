const PlayerSquare = require('./PlayerSquare');
const SpawnerSquare = require('./SpawnerSquare');
const BaseSquare = require('./BaseSquare');

class SquareFactory {
    constructor() {
    }
    
    createPlayerSquare(id, x, y, dx, dy, playerId, playerConfig) {
        const squareTypeConfig = PlayerSquare.getDefaultConfig();
        
        const squareType = {
            name: squareTypeConfig.name,
            color: playerConfig?.playerColor || PlayerSquare.defaultColor,
        };
        
        return new PlayerSquare(id, x, y, dx, dy, {
            health: playerConfig?.health ?? squareTypeConfig.health,
            damage: playerConfig?.damage ?? squareTypeConfig.damage,
            type: squareType,
            playerId: playerId,
            playerName: playerConfig?.playerName,
            size: playerConfig?.size ?? squareTypeConfig.size,
            normalSpeed: playerConfig?.normalSpeed ?? squareTypeConfig.normalSpeed,
            maxVelocity: playerConfig?.maxVelocity ?? squareTypeConfig.maxVelocity,
            maxDamage: playerConfig?.maxDamage ?? null,
            frictionTime: playerConfig?.frictionTime ?? squareTypeConfig.frictionTime,
            restitution: playerConfig?.restitution ?? squareTypeConfig.restitution,
            separationBias: playerConfig?.separationBias ?? squareTypeConfig.separationBias
        });
    }
    
    createSpawnerSquare(id, x, y) {
        const squareTypeConfig = SpawnerSquare.getDefaultConfig();
        
        const squareType = {
            name: squareTypeConfig.name,
            color: '#000000',
            health: squareTypeConfig.health,
            damage: squareTypeConfig.damage,
            invisible: squareTypeConfig.invisible,
            isSpawner: squareTypeConfig.isSpawner
        };
        
        return new SpawnerSquare(id, x, y, {
            health: squareType.health,
            damage: squareType.damage,
            type: squareType,
            playerId: null,
            playerName: null,
            size: squareTypeConfig.size,
            normalSpeed: squareTypeConfig.normalSpeed,
            maxVelocity: squareTypeConfig.maxVelocity,
            frictionTime: squareTypeConfig.frictionTime,
            restitution: squareTypeConfig.restitution,
            separationBias: squareTypeConfig.separationBias
        });
    }
    
    getSquareTypes() {
        return {
            player: PlayerSquare.getDefaultConfig(),
            powerupSpawner: SpawnerSquare.getDefaultConfig()
        };
    }
}

module.exports = SquareFactory;
