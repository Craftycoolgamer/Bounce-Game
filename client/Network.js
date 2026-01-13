export class Network {
    constructor() {
        this.socket = null;
        this.myPlayerId = null;
        this.mySquareId = null;
        this.gameConfig = null; // Server-provided config (single source of truth)
        this.callbacks = {
            onConnect: null,
            onGameConfig: null,
            onPlayerJoined: null,
            onGameState: null,
            onSquareDied: null
        };
    }
    
    connect() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });
        
        this.socket.on('gameConfig', (config) => {
            this.gameConfig = config;
            console.log('Received game config from server:', config);
            if (this.callbacks.onGameConfig) {
                this.callbacks.onGameConfig(config);
            }
        });
        
        this.socket.on('playerJoined', (data) => {
            this.myPlayerId = data.playerId;
            this.mySquareId = data.squareId;
            console.log('Joined as', data.playerName, 'with square ID', data.squareId);
            if (this.callbacks.onPlayerJoined) {
                this.callbacks.onPlayerJoined(data);
            }
        });
        
        this.socket.on('gameState', (gameState) => {
            if (this.callbacks.onGameState) {
                this.callbacks.onGameState(gameState);
            } else {
                console.warn('Network: gameState received but no callback registered');
            }
        });
        
        this.socket.on('squareDied', (data) => {
            if (data.squareId === this.mySquareId) {
                console.log('Your square died!');
                this.mySquareId = null;
            }
            if (this.callbacks.onSquareDied) {
                this.callbacks.onSquareDied(data);
            }
        });
    }
    
    joinGame(playerColor) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerInfo', {
                playerColor: playerColor
            });
        }
    }
    
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn(`Unknown event: ${event}`);
        }
    }
    
    getMyPlayerId() {
        return this.myPlayerId;
    }
    
    getMySquareId() {
        return this.mySquareId;
    }
    
    getGameConfig() {
        return this.gameConfig;
    }
}
