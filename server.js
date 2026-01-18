const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Configuration
const Game = require('./server/Game');
const PlayerSquare = require('./server/entities/PlayerSquare');
const RoomManager = require('./server/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(__dirname));

// Initialize room manager
const roomManager = new RoomManager(io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Send available rooms list to client
    socket.emit('roomsList', roomManager.getAllRooms());

    // ============================================
    // CONNECTION STATS - Ping handler
    // Comment out this block to disable ping/pong
    // ============================================
    socket.on('ping', (timestamp) => {
        socket.emit('pong', timestamp);
    });
    // ============================================

    // Handle room joining
    socket.on('joinRoom', (roomId) => {
        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }

        // Join Socket.io room
        socket.join(roomId);

        // Send room-specific game config
        const gameConfig = room.getGameConfig();
        socket.emit('gameConfig', gameConfig);

        console.log(`Player ${socket.id} joined room: ${roomId}`);
    });

    // Wait for player info before creating square
    socket.on('playerInfo', (data) => {
        // Find which room this socket is in
        const socketRooms = Array.from(socket.rooms);
        const roomId = socketRooms.find(room => room !== socket.id); // socket.id is always in rooms
        
        if (!roomId) {
            socket.emit('roomError', { message: 'Please join a room first' });
            return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('roomError', { message: 'Room not found' });
            return;
        }

        const playerColor = data.playerColor || PlayerSquare.defaultColor;
        const playerData = room.addPlayer(socket.id, playerColor);

        console.log('Player info received:', playerData.playerName, playerColor, 'in room:', roomId);

        // Send initial game state
        socket.emit('playerJoined', {
            playerId: playerData.playerId,
            playerName: playerData.playerName,
            squareId: playerData.squareId
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove player from all rooms they might be in
        roomManager.rooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.removePlayer(socket.id);
                console.log(`Player ${socket.id} removed from room: ${roomId}`);
            }
        });
    });
});

// Start game loops for all rooms
roomManager.startGameLoops();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Available rooms: ${roomManager.getAllRooms().map(r => r.name).join(', ')}`);
});
