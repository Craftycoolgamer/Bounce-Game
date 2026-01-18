const Game = require('./Game');
const PlayerSquare = require('./entities/PlayerSquare');
const SpawnerSquare = require('./entities/SpawnerSquare');
const Powerup = require('./entities/Powerup');
const EventEmitter = require('./utils/EventEmitter');
const IdGenerator = require('./utils/IdGenerator');
const SquareFactory = require('./entities/SquareFactory');
const PhysicsSystem = require('./systems/PhysicsSystem');
const CollisionSystem = require('./systems/CollisionSystem');
const PowerupSystem = require('./systems/PowerupSystem');

class Room {
    constructor(roomId, roomConfig, io) {
        this.roomId = roomId;
        this.io = io;
        this.name = roomConfig.name || `Room ${roomId}`;
        
        // Initialize game config
        this.gameConfig = new Game(roomConfig.gameConfig || {});
        
        // Store player config if provided
        this.playerConfig = roomConfig.playerConfig || null;
        
        // Game state
        this.squares = [];
        this.players = new Map(); // socketId -> { playerId, playerName, squareId, socketId }
        this.lastTime = Date.now();
        this.activeSpawnerCollisions = new Set();
        
        // Initialize systems
        this.gameEvents = new EventEmitter();
        this.playerIdGenerator = new IdGenerator(1);
        this.squareIdGenerator = new IdGenerator(0);
        this.squareFactory = new SquareFactory();
        this.physicsSystem = new PhysicsSystem(this.gameConfig);
        this.collisionSystem = new CollisionSystem(this.gameConfig);
        
        // Initialize powerup system with custom powerup types if provided
        const customPowerupTypes = roomConfig.powerupTypes || null;
        this.powerupSystem = new PowerupSystem(this.gameEvents, customPowerupTypes);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize spawner squares
        this.initializeSpawnerSquares(roomConfig.spawnerCount || 3);
    }
    
    setupEventListeners() {
        this.gameEvents.on('squareDied', (data) => {
            const { square } = data;
            if (square.playerId) {
                // Broadcast to the room - all players in the room will receive it
                this.io.to(this.roomId).emit('squareDied', { squareId: square.id });
            }
        });
    }
    
    createSquare(startX, startY, startDx, startDy, playerId = null, playerName = null, playerColor = null) {
        if (this.squares.length >= (PlayerSquare.maxCount || 100)) {
            return null;
        }

        const playerConfig = {
            ...(this.playerConfig || {}),
            playerName: playerName,
            playerColor: playerColor
        };
        
        const squareId = this.squareIdGenerator.next();
        const square = this.squareFactory.createPlayerSquare(
            squareId, 
            startX, 
            startY, 
            startDx, 
            startDy, 
            playerId, 
            playerConfig
        );

        this.physicsSystem.clampVelocity(square);
        this.squares.push(square);
        return square;
    }
    
    createSpawnerSquare(x, y) {
        const squareId = this.squareIdGenerator.next();
        const square = this.squareFactory.createSpawnerSquare(squareId, x, y);
        this.squares.push(square);
        return square;
    }
    
    removeSquare(square, dropPowerups = true) {
        if (square.isSpawner) {
            return;
        }
        
        if (dropPowerups) {
            this.powerupSystem.dropPowerupsFromSquare(square);
        }

        const index = this.squares.indexOf(square);
        if (index > -1) {
            this.squares.splice(index, 1);
        }

        this.gameEvents.emit('squareDied', { square });
    }
    
    initializeSpawnerSquares(count) {
        const squareSize = SpawnerSquare.getDefaultConfig().size;
        const margin = squareSize;
        
        for (let i = 0; i < count; i++) {
            const x = margin + Math.random() * (this.gameConfig.world.width - 2 * margin - squareSize);
            const y = margin + Math.random() * (this.gameConfig.world.height - 2 * margin - squareSize);
            this.createSpawnerSquare(x, y);
        }
    }
    
    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Animate squares
        const squaresCopy = [...this.squares];
        squaresCopy.forEach(square => {
            if (this.squares.includes(square) && !square.isSpawner) {
                this.physicsSystem.animateSquare(square, deltaTime);
            }
        });

        // Detect collisions
        const collisionPairs = this.collisionSystem.detectCollisions(this.squares, deltaTime);
        
        const currentFrameCollisions = new Set();
        
        // Resolve collisions
        collisionPairs.forEach(pair => {
            if (this.squares.includes(pair.square1) && this.squares.includes(pair.square2)) {
                if (pair.square1.isSpawner || pair.square2.isSpawner) {
                    const spawnerSquare = pair.square1.isSpawner ? pair.square1 : pair.square2;
                    const hittingSquare = pair.square1.isSpawner ? pair.square2 : pair.square1;
                    
                    if (!hittingSquare.isSpawner) {
                        const collisionKey = `${hittingSquare.id}-${spawnerSquare.id}`;
                        currentFrameCollisions.add(collisionKey);
                        
                        if (!this.activeSpawnerCollisions.has(collisionKey)) {
                            this.activeSpawnerCollisions.add(collisionKey);
                            const randomX = Math.random() * (this.gameConfig.world.width - Powerup.size);
                            const randomY = Math.random() * (this.gameConfig.world.height - Powerup.size);
                            this.powerupSystem.create(randomX, randomY);
                        }
                    }
                } else {
                    const result = this.physicsSystem.handleCollision(pair.square1, pair.square2);
                    
                    if (result.died1) {
                        this.removeSquare(pair.square1);
                    }
                    if (result.died2) {
                        this.removeSquare(pair.square2);
                    }
                }
            }
        });
        
        // Remove inactive collisions
        const collisionsToRemove = [];
        this.activeSpawnerCollisions.forEach(collisionKey => {
            if (!currentFrameCollisions.has(collisionKey)) {
                collisionsToRemove.push(collisionKey);
            }
        });
        collisionsToRemove.forEach(key => this.activeSpawnerCollisions.delete(key));

        // Check powerup collisions
        const squaresForPowerup = [...this.squares];
        const powerupsCopy = [...this.powerupSystem.getAll()];
        squaresForPowerup.forEach(square => {
            if (this.squares.includes(square)) {
                powerupsCopy.forEach(powerup => {
                    if (this.powerupSystem.getAll().includes(powerup)) {
                        if (this.powerupSystem.checkCollision(square, powerup)) {
                            this.powerupSystem.applyPowerup(square, powerup);
                        }
                    }
                });
            }
        });

        // Broadcast game state to room
        const gameState = {
            squares: this.squares.map(s => s.toJSON()),
            powerups: this.powerupSystem.getAll().map(p => p.toJSON())
        };

        this.io.to(this.roomId).emit('gameState', gameState);
    }
    
    addPlayer(socketId, playerColor) {
        const playerId = this.playerIdGenerator.next();
        const playerName = `Player ${playerId}`;

        const squareSize = PlayerSquare.getDefaultConfig().size;
        const centerX = (this.gameConfig.world.width - squareSize) / 2;
        const centerY = (this.gameConfig.world.height - squareSize) / 2;
        const newDx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const newDy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 4 + 2);
        const square = this.createSquare(centerX, centerY, newDx, newDy, playerId, playerName, playerColor);

        this.players.set(socketId, {
            socketId: socketId,
            playerId: playerId,
            playerName: playerName,
            squareId: square ? square.id : null
        });

        return {
            playerId: playerId,
            playerName: playerName,
            squareId: square ? square.id : null
        };
    }
    
    removePlayer(socketId) {
        const player = this.players.get(socketId);
        if (player && player.squareId) {
            const playerSquare = this.squares.find(s => s.id === player.squareId);
            if (playerSquare) {
                this.removeSquare(playerSquare, false);
            }
        }
        this.players.delete(socketId);
    }
    
    getGameConfig() {
        return {
            world: this.gameConfig.world,
            squareTypes: this.squareFactory.getSquareTypes(),
            powerupTypes: this.powerupSystem.getPowerupTypes()
        };
    }
    
    getPlayerCount() {
        return this.players.size;
    }
}

module.exports = Room;
