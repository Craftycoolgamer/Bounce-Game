const Room = require('./Room');
const roomConfigs = require('./config/roomConfigs');
const Game = require('./Game');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> Room instance
        this.initializeRooms();
    }
    
    initializeRooms() {
        // Create a room for each configuration
        Object.keys(roomConfigs).forEach(roomId => {
            const config = roomConfigs[roomId];
            const room = new Room(roomId, config, this.io);
            this.rooms.set(roomId, room);
        });
    }
    
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    
    getAllRooms() {
        return Array.from(this.rooms.entries()).map(([roomId, room]) => ({
            id: roomId,
            name: room.name,
            playerCount: room.getPlayerCount()
        }));
    }
    
    startGameLoops() {
        const fps = Game.fps;
        setInterval(() => {
            this.rooms.forEach(room => {
                room.gameLoop();
            });
        }, 1000 / fps);
    }
}

module.exports = RoomManager;
