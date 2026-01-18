// ============================================
// CONNECTION STATS DISPLAY - TOGGLE ON/OFF
// Set to true to enable, false to disable
// ============================================
const SHOW_CONNECTION_STATS = true;
// ============================================

export class Network {
    constructor() {
        this.socket = null;
        this.myPlayerId = null;
        this.mySquareId = null;
        this.gameConfig = null; // Server-provided config (single source of truth)
        this.pingInterval = null;
        this.currentPing = 0;
        this.callbacks = {
            onConnect: null,
            onGameConfig: null,
            onPlayerJoined: null,
            onGameState: null,
            onSquareDied: null,
            onRoomsList: null,
            onRoomError: null
        };
        this.rooms = [];
        this.currentRoomId = null;
        
        // Hide stats display if disabled
        if (!SHOW_CONNECTION_STATS) {
            const statsEl = document.getElementById('connectionStats');
            if (statsEl) {
                statsEl.style.display = 'none';
            }
        }
    }
    
    connect() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (SHOW_CONNECTION_STATS) {
                this.updateStats();
                this.startPing();
            }
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });
        
        // ============================================
        // CONNECTION STATS - Event handlers
        // ============================================
        if (SHOW_CONNECTION_STATS) {
            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.stopPing();
                this.updateStats();
            });
            
            this.socket.on('connect_error', () => {
                this.updateStats();
            });
            
            this.socket.on('pong', (timestamp) => {
                this.currentPing = Date.now() - timestamp;
                this.updateStats();
            });
        }
        // ============================================
        
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
            if (SHOW_CONNECTION_STATS) {
                this.updateStats();
            }
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
        
        this.socket.on('roomsList', (rooms) => {
            this.rooms = rooms;
            console.log('Received rooms list:', rooms);
            if (this.callbacks.onRoomsList) {
                this.callbacks.onRoomsList(rooms);
            }
        });
        
        this.socket.on('roomError', (error) => {
            console.error('Room error:', error);
            if (this.callbacks.onRoomError) {
                this.callbacks.onRoomError(error);
            }
        });
    }
    
    joinRoom(roomId) {
        if (this.socket && this.socket.connected) {
            this.currentRoomId = roomId;
            this.socket.emit('joinRoom', roomId);
        }
    }
    
    joinGame(playerColor) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerInfo', {
                playerColor: playerColor
            });
        }
    }
    
    getRooms() {
        return this.rooms;
    }
    
    getCurrentRoomId() {
        return this.currentRoomId;
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
    
    // ============================================
    // CONNECTION STATS - Methods
    // ============================================
    startPing() {
        if (!SHOW_CONNECTION_STATS) return;
        this.pingInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('ping', Date.now());
            }
        }, 1000); // Ping every second
    }
    
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    updateStats() {
        if (!SHOW_CONNECTION_STATS) return;
        
        const statusEl = document.getElementById('connectionStatus');
        const socketIdEl = document.getElementById('socketId');
        const pingEl = document.getElementById('ping');
        const playerIdEl = document.getElementById('playerId');
        
        if (statusEl) {
            statusEl.textContent = this.socket && this.socket.connected ? 'Connected' : 'Disconnected';
            statusEl.style.color = this.socket && this.socket.connected ? '#4CAF50' : '#f44336';
        }
        
        if (socketIdEl) {
            socketIdEl.textContent = this.socket ? this.socket.id : '-';
        }
        
        if (pingEl) {
            pingEl.textContent = this.currentPing || '-';
            pingEl.style.color = this.currentPing < 50 ? '#4CAF50' : this.currentPing < 150 ? '#FFC107' : '#f44336';
        }
        
        if (playerIdEl) {
            playerIdEl.textContent = this.myPlayerId || '-';
        }
    }
    // ============================================
}
