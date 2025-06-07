"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const uuid_1 = require("uuid");
class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.playerIds = [];
    }
    addPlayer(ws, clientId, playerId) {
        this.players.set(playerId, { ws, clientId });
        this.playerIds.push(playerId);
        // Notify when room becomes full (2 players)
        if (this.players.size === 2) {
            this.broadcastToRoom({
                type: 'game_started'
            });
        }
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
        const index = this.playerIds.indexOf(playerId);
        if (index > -1) {
            this.playerIds.splice(index, 1);
        }
    }
    hasPlayer(playerId) {
        return this.players.has(playerId);
    }
    getPlayerCount() {
        return this.players.size;
    }
    isFull() {
        return this.players.size >= 2;
    }
    broadcastToRoom(message, excludeWs) {
        this.players.forEach((player) => {
            if (player.ws !== excludeWs && player.ws.readyState === ws_1.default.OPEN) {
                player.ws.send(JSON.stringify(message));
            }
        });
    }
}
// Main Game Server class
class GameServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = new ws_1.default.Server({ port: this.port });
        this.rooms = new Map();
        this.clients = new Map();
        this.setupWebSocketServer();
        console.log(`Game WebSocket server started on port ${this.port}`);
    }
    static getInstance(port) {
        if (!GameServer.instance) {
            GameServer.instance = new GameServer(port);
        }
        return GameServer.instance;
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            const clientId = (0, uuid_1.v4)();
            this.clients.set(ws, {
                id: clientId,
                roomId: null,
                playerId: null
            });
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(ws, message);
                }
                catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
            ws.on('close', (code, reason) => {
                this.handleDisconnect(ws, code, reason);
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    handleMessage(ws, message) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo)
            return;
        console.log(`Received message from ${clientInfo.id}:`, message);
        switch (message.type) {
            case 'join_room':
                this.handleJoinRoom(ws, message.roomId, message.playerId);
                break;
            case 'chat':
                this.handleChat(ws, message);
                break;
            case 'game_over':
                this.handleGameOver(ws, message);
                break;
            case 'action_complete':
                this.handleActionComplete(ws, message);
                break;
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }
    handleJoinRoom(ws, roomId, playerId) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo)
            return;
        if (!roomId || !playerId) {
            console.log('roomId and playerId are required');
            return;
        }
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new GameRoom(roomId));
            console.log(`Room ${roomId} created`);
        }
        const room = this.rooms.get(roomId);
        if (room.hasPlayer(playerId)) {
            // Player already in room - just return gracefully
            console.log(`Player ${playerId} already in room ${roomId} - ignoring join request`);
            return;
        }
        room.addPlayer(ws, clientInfo.id, playerId);
        clientInfo.roomId = roomId;
        clientInfo.playerId = playerId;
        console.log(`Player ${playerId} joined room ${roomId}`);
    }
    handleChat(ws, message) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo || !clientInfo.roomId) {
            console.log('Cannot send chat - not in any room');
            return;
        }
        const room = this.rooms.get(clientInfo.roomId);
        if (!room) {
            console.log('Cannot send chat - room not found');
            return;
        }
        console.log(`Chat from ${message.displayName} (${clientInfo.playerId}): ${message.message}`);
        // Broadcast chat message to all players in the room (including sender)
        room.broadcastToRoom({
            type: 'chat',
            playerId: clientInfo.playerId,
            displayName: message.displayName,
            message: message.message,
        });
    }
    handleActionComplete(ws, message) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo || !clientInfo.roomId) {
            console.log('Not in any room');
            return;
        }
        const room = this.rooms.get(clientInfo.roomId);
        if (!room) {
            console.log('Room not found');
            return;
        }
        console.log(`Player ${clientInfo.playerId} completed action`);
        // Broadcast action_complete to all players in the room
        room.broadcastToRoom({
            type: 'action_complete',
            playerId: clientInfo.playerId
        });
    }
    handleDisconnect(ws, closeCode, reason) {
        const clientInfo = this.clients.get(ws);
        if (clientInfo) {
            console.log(`Client ${clientInfo.id} (Player: ${clientInfo.playerId}) disconnected - Code: ${closeCode}, Reason: ${reason}`);
            if (clientInfo.roomId && clientInfo.playerId) {
                // Handle disconnect as player loss - broadcast disconnect event
                console.log(`Player ${clientInfo.playerId} disconnected from room ${clientInfo.roomId} - opponent wins`);
                this.handlePlayerDisconnect(clientInfo.roomId, clientInfo.playerId);
            }
            this.clients.delete(ws);
        }
    }
    handlePlayerDisconnect(roomId, disconnectedPlayerId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Room ${roomId} not found during disconnect`);
            return;
        }
        // Broadcast disconnect event to remaining players (excluding the disconnected player)
        room.broadcastToRoom({
            type: 'disconnect',
            playerId: disconnectedPlayerId
        });
        // Remove the disconnected player from the room
        room.removePlayer(disconnectedPlayerId);
        console.log(`Player ${disconnectedPlayerId} removed from room ${roomId} due to disconnect`);
        // Clean up empty room
        if (room.getPlayerCount() === 0) {
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty after disconnect)`);
        }
    }
    handleGameOver(ws, message) {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo || !clientInfo.roomId) {
            console.log('Not in any room');
            return;
        }
        const room = this.rooms.get(clientInfo.roomId);
        if (!room) {
            console.log('Room not found');
            return;
        }
        console.log(`Player ${clientInfo.playerId} reported game over`);
        // Broadcast game over to all players in the room
        room.broadcastToRoom({
            type: 'game_over',
            playerId: clientInfo.playerId
        });
    }
    sendMessage(ws, message) {
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}
// Start the server
const port = parseInt(process.env.PORT || '8080');
const gameServer = GameServer.getInstance(port);
//# sourceMappingURL=server.js.map