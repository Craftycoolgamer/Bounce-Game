const PlayerSquare = require('./PlayerSquare');
const SpawnerSquare = require('./SpawnerSquare');
const BaseSquare = require('./BaseSquare');

class SquareFactory {
    constructor() {
    }
    
    createPlayerSquare(id, x, y, dx, dy, playerId, playerName, playerColor) {
        const squareTypeConfig = PlayerSquare.getDefaultConfig();
        
        const squareType = {
            name: squareTypeConfig.name,
            color: playerColor || PlayerSquare.defaultColor,
            health: squareTypeConfig.health,
            damage: squareTypeConfig.damage
        };
        
        return new PlayerSquare(id, x, y, dx, dy, {
            health: squareType.health,
            damage: squareType.damage,
            type: squareType,
            playerId: playerId,
            playerName: playerName || squareType.name,
            size: squareTypeConfig.size,
            normalSpeed: squareTypeConfig.normalSpeed,
            maxVelocity: squareTypeConfig.maxVelocity,
            frictionTime: squareTypeConfig.frictionTime,
            restitution: squareTypeConfig.restitution,
            separationBias: squareTypeConfig.separationBias
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
