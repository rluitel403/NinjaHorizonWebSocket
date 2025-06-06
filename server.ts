import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
interface ClientInfo {
    id: string;
    roomId: string | null;
    playerId: string | null;
}

interface Message {
    type: string;
    [key: string]: any;
}

interface Player {
    ws: WebSocket;
    clientId: string;
}

class GameRoom {
    public id: string;
    public players: Map<string, Player>;
    public playerIds: string[];

    constructor(id: string) {
        this.id = id;
        this.players = new Map();
        this.playerIds = [];
    }

    addPlayer(ws: WebSocket, clientId: string, playerId: string): void {
        this.players.set(playerId, { ws, clientId });
        this.playerIds.push(playerId);
        
        // Notify when room becomes full (2 players)
        if (this.players.size === 2) {
            this.broadcastToRoom({
                type: 'game_started'
            });
        }
    }

    removePlayer(playerId: string): void {
        this.players.delete(playerId);
        
        const index = this.playerIds.indexOf(playerId);
        if (index > -1) {
            this.playerIds.splice(index, 1);
        }
    }

    hasPlayer(playerId: string): boolean {
        return this.players.has(playerId);
    }

    getPlayerCount(): number {
        return this.players.size;
    }

    isFull(): boolean {
        return this.players.size >= 2;
    }

    broadcastToRoom(message: Message, excludeWs?: WebSocket): void {
        this.players.forEach((player) => {
            if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify(message));
            }
        });
    }
}

// Main Game Server class
class GameServer {
    private static instance: GameServer;
    private port: number;
    private wss: WebSocket.Server;
    private rooms: Map<string, GameRoom>;
    public clients: Map<WebSocket, ClientInfo>;

    private constructor(port: number = 8080) {
        this.port = port;
        this.wss = new WebSocket.Server({ port: this.port });
        this.rooms = new Map();
        this.clients = new Map();
        
        this.setupWebSocketServer();
        console.log(`Game WebSocket server started on port ${this.port}`);
    }

    static getInstance(port?: number): GameServer {
        if (!GameServer.instance) {
            GameServer.instance = new GameServer(port);
        }
        return GameServer.instance;
    }

    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('New client connected');
            
            const clientId = uuidv4();
            this.clients.set(ws, {
                id: clientId,
                roomId: null,
                playerId: null
            });

            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message: Message = JSON.parse(data.toString());
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', (code: number, reason: string) => {
                this.handleDisconnect(ws, code, reason);
            });

            ws.on('error', (error: Error) => {
                console.error('WebSocket error:', error);
            });
        });
    }

    private handleMessage(ws: WebSocket, message: Message): void {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) return;

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

    private handleJoinRoom(ws: WebSocket, roomId: string, playerId: string): void {
        const clientInfo = this.clients.get(ws);
        if (!clientInfo) return;
        
        if (!roomId || !playerId) {
            console.log('roomId and playerId are required');
            return;
        }
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new GameRoom(roomId));
            console.log(`Room ${roomId} created`);
        }

        const room = this.rooms.get(roomId)!;
        
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

    private handleChat(ws: WebSocket, message: Message): void {
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

    private handleActionComplete(ws: WebSocket, message: Message): void {
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

    private handleDisconnect(ws: WebSocket, closeCode?: number, reason?: string): void {
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

    private handlePlayerDisconnect(roomId: string, disconnectedPlayerId: string): void {
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

    private handleGameOver(ws: WebSocket, message: Message): void {
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

    public sendMessage(ws: WebSocket, message: Message): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}

// Start the server
const port = parseInt(process.env.PORT || '8080');
const gameServer = GameServer.getInstance(port); 