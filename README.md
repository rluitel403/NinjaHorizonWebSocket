# Ninja Horizon WebSocket Server

A TypeScript WebSocket server for the Ninja Horizon multiplayer game.

## Features

- Room-based multiplayer gaming
- Player management and matchmaking
- Real-time communication between clients
- Game state synchronization
- Disconnect handling

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
npm start
```

## Deployment Options

### Option 1: Railway (Recommended)
1. Create account at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Railway will automatically detect and deploy your Node.js app
4. Your WebSocket will be available at: `wss://your-app-name.up.railway.app`

### Option 2: Heroku
1. Install Heroku CLI
2. Create Heroku app:
```bash
heroku create your-app-name
```
3. Deploy:
```bash
git push heroku main
```
4. Your WebSocket will be available at: `wss://your-app-name.herokuapp.com`

### Option 3: DigitalOcean App Platform
1. Create account at DigitalOcean
2. Go to App Platform
3. Connect your GitHub repository
4. Select Node.js runtime
5. Deploy

### Option 4: Render
1. Create account at [render.com](https://render.com)
2. Connect GitHub repository
3. Create new Web Service
4. Use build command: `npm install && npm run build`
5. Use start command: `npm start`

### Option 5: Azure App Service
1. Create account at [portal.azure.com](https://portal.azure.com)
2. Create a new App Service:
   - Choose "Web App"
   - Select Node.js runtime stack
   - Choose your subscription and resource group
3. Deploy via:
   - **GitHub Actions** (Recommended): Connect your repository for automatic deployments
   - **Local Git**: Push directly from your local repository
   - **ZIP Deploy**: Upload your built application
4. Configure application settings if needed
5. Your WebSocket will be available at: `wss://your-app-name.azurewebsites.net`

## Message Protocol

### Client to Server Messages:
- `join_room`: Join a game room
- `action_complete`: Notify action completion
- `game_over`: Report game over

### Server to Client Messages:
- `connected`: Connection confirmation
- `game_started`: Room is full, game can start
- `action_complete`: Player completed an action
- `game_over`: Game ended
- `disconnect`: Player disconnected

## Unity Integration

See the Unity section below for client implementation details.

---

# Unity WebSocket Client

## Setup

1. Install a WebSocket library for Unity:
   - **NativeWebSocket** (Recommended): Easy to use, good performance
   - **WebSocketSharp-netstandard**: Cross-platform compatibility
   - **Unity WebGL WebSocket**: For WebGL builds

### Installing NativeWebSocket
Add to your Unity project's `Packages/manifest.json`:
```json
{
  "dependencies": {
    "com.endel.nativewebsocket": "https://github.com/endel/NativeWebSocket.git#upm"
  }
}
```

## Example Usage

See the Unity scripts created in this project for complete implementation. 