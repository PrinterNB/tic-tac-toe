// Durable Object class for managing Tic Tac Toe games
export class TicTacToe {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.clients = new Map(); // WebSocket connections by player (X or O)
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameActive = false;
        this.roomCode = null;
    }

    async fetch(request) {
        // Handle WebSocket upgrade
        if (request.headers.get('Upgrade') === 'websocket') {
            const url = new URL(request.url);
            const roomCode = url.searchParams.get('room');
            
            if (!roomCode) {
                return new Response('Missing room parameter', { status: 400 });
            }
            
            // Accept the WebSocket
            const { 0: client, 1: server } = new WebSocketPair();
            server.accept();
            
            // Initialize WebSocket handlers
            server.addEventListener('message', (message) => {
                this.handleMessage(server, message.data, roomCode);
            });
            
            server.addEventListener('close', () => {
                this.handleClose(server, roomCode);
            });
            
            server.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
            });
            
            return new Response(null, {
                status: 101,
                webSocket: client
            });
        }
        
        // Handle HTTP requests (for room creation/lookup)
        return new Response('Tic Tac Toe Multiplayer Server', { status: 200 });
    }

    handleMessage(socket, data, roomCode) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'create_room':
                    this.handleCreateRoom(socket, message, roomCode);
                    break;
                    
                case 'join_room':
                    this.handleJoinRoom(socket, message, roomCode);
                    break;
                    
                case 'move':
                    this.handleMove(socket, message, roomCode);
                    break;
                    
                case 'reset':
                    this.handleReset(socket, message, roomCode);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendToSocket(socket, { type: 'error', message: 'Invalid message format' });
        }
    }

    handleCreateRoom(socket, message, roomCode) {
        // Only allow one host per room
        if (this.clients.has('X')) {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Room already has a host' 
            });
            return;
        }
        
        this.roomCode = roomCode;
        this.clients.set('X', socket);
        
        // Store the room code in the durable object
        this.state.storage.put('roomCode', roomCode);
        this.state.storage.put('board', this.board);
        this.state.storage.put('currentPlayer', this.currentPlayer);
        
        this.sendToSocket(socket, {
            type: 'room_created',
            room: roomCode,
            player: 'X'
        });
    }

    handleJoinRoom(socket, message, roomCode) {
        // Check if room exists
        if (!this.clients.has('X')) {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Room does not exist' 
            });
            return;
        }
        
        // Check if room is full
        if (this.clients.has('O')) {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Room is full' 
            });
            return;
        }
        
        this.clients.set('O', socket);
        
        // Initialize game
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameActive = true;
        
        // Notify both players
        this.sendToSocket(this.clients.get('X'), {
            type: 'opponent_joined',
            room: roomCode
        });
        
        this.sendToSocket(socket, {
            type: 'room_joined',
            room: roomCode,
            player: 'O'
        });
        
        // Save state
        this.state.storage.put('board', this.board);
        this.state.storage.put('currentPlayer', this.currentPlayer);
        this.state.storage.put('gameActive', this.gameActive);
    }

    handleMove(socket, message, roomCode) {
        // Verify it's this player's turn
        if (message.player !== this.currentPlayer) {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Not your turn' 
            });
            return;
        }
        
        // Validate move
        if (message.index < 0 || message.index > 8) {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Invalid move' 
            });
            return;
        }
        
        if (this.board[message.index] !== '') {
            this.sendToSocket(socket, { 
                type: 'error', 
                message: 'Cell already taken' 
            });
            return;
        }
        
        // Make the move
        this.board[message.index] = message.player;
        const won = this.checkWinner(message.player);
        
        // Update current player
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        
        // Broadcast move to both players
        const moveData = {
            type: 'move',
            room: roomCode,
            player: message.player,
            index: message.index
        };
        
        if (won) {
            moveData.winner = message.player;
            this.gameActive = false;
        } else if (this.board.every(cell => cell !== '')) {
            moveData.draw = true;
            this.gameActive = false;
        }
        
        this.sendToSocket(this.clients.get('X'), moveData);
        this.sendToSocket(this.clients.get('O'), moveData);
        
        // Save state
        this.state.storage.put('board', this.board);
        this.state.storage.put('currentPlayer', this.currentPlayer);
        this.state.storage.put('gameActive', this.gameActive);
    }

    handleReset(socket, message, roomCode) {
        // Reset game state
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameActive = true;
        
        // Notify both players
        const resetData = {
            type: 'reset',
            room: roomCode
        };
        
        this.sendToSocket(this.clients.get('X'), resetData);
        this.sendToSocket(this.clients.get('O'), resetData);
        
        // Save state
        this.state.storage.put('board', this.board);
        this.state.storage.put('currentPlayer', this.currentPlayer);
        this.state.storage.put('gameActive', this.gameActive);
    }

    handleClose(socket, roomCode) {
        // Remove the disconnected client
        for (const [player, client] of this.clients) {
            if (client === socket) {
                this.clients.delete(player);
                break;
            }
        }
        
        // If host disconnected, end the game
        if (!this.clients.has('X')) {
            this.clients.clear();
            this.board = Array(9).fill('');
            this.gameActive = false;
        }
    }

    checkWinner(player) {
        const winningCombos = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];
        
        for (const combo of winningCombos) {
            const [a, b, c] = combo;
            if (this.board[a] === player && 
                this.board[b] === player && 
                this.board[c] === player) {
                return true;
            }
        }
        
        return false;
    }

    sendToSocket(socket, data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }
    }
}

// Worker entry point
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Handle WebSocket connections for multiplayer
        if (request.headers.get('Upgrade') === 'websocket') {
            const roomId = url.searchParams.get('room') || generateRoomCode();
            const id = env.TIC_TAC_TOE.idFromName(roomId);
            const stub = env.TIC_TAC_TOE.get(id);
            return stub.fetch(request);
        }
        
        // Serve HTML files
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(indexHtml, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (url.pathname === '/human-vs-multiplayer.html') {
            return new Response(humanVsMultiplayerHtml, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (url.pathname === '/human-vs-human.html') {
            return new Response(humanVsHumanHtml, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (url.pathname === '/human-vs-ai.html') {
            return new Response(humanVsAiHtml, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (url.pathname === '/multiplayer-script.js') {
            return new Response(multiplayerScript, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (url.pathname === '/config.js') {
            return new Response(configJs, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (url.pathname === '/styles.css') {
            return new Response(stylesCss, {
                headers: { 'Content-Type': 'text/css' }
            });
        }
        
        if (url.pathname === '/script.js') {
            return new Response(scriptJs, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (url.pathname === '/game-script.js') {
            return new Response(gameScript, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (url.pathname === '/ai-game-script.js') {
            return new Response(aiGameScript, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        // Default: serve the index page
        return new Response(indexHtml, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
};

// HTML files content
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic Tac Toe</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="menu-container">
        <h1>Tic Tac Toe</h1>
        <div class="menu-buttons">
            <button class="menu-btn" onclick="window.location.href='human-vs-human.html'">Local Multiplayer</button>
            <button class="menu-btn" onclick="window.location.href='human-vs-ai.html'">Human vs AI</button>
            <button class="menu-btn" onclick="window.location.href='human-vs-multiplayer.html'">Online Multiplayer</button>
        </div>
        <div class="github-button-container">
            <button class="github-btn" onclick="window.open('https://github.com/PrinterNB/tic-tac-toe', '_blank')">GitHub</button>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`;

const humanVsMultiplayerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic Tac Toe - Online Multiplayer</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="game-container">
        <h1>Tic Tac Toe - Online Multiplayer</h1>
        <div class="multiplayer-controls">
            <div class="connection-status" id="connectionStatus">Connecting...</div>
            <div class="room-code-container">
                <label for="roomCode">Room Code:</label>
                <input type="text" id="roomCode" placeholder="Enter room code" maxlength="6">
                <button id="joinRoomBtn">Join Room</button>
                <button id="createRoomBtn">Create Room</button>
            </div>
        </div>
        <div class="status" id="status">Waiting for opponent...</div>
        <div class="board-wrapper">
            <div class="board" id="board">
            </div>
        </div>
        <button id="resetBtn">Reset Game</button>
        <button class="back-btn" id="backBtn">Back to Menu</button>
    </div>
    <script src="config.js"></script>
    <script src="multiplayer-script.js"></script>
</body>
</html>`;

const humanVsHumanHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic Tac Toe - Local Multiplayer</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="game-container">
        <h1>Tic Tac Toe</h1>
        <div class="board-size-selector">
            <label for="board-size">Board Size:</label>
            <select id="board-size">
                <option value="3">3x3 (3 in a row)</option>
                <option value="4">4x4 (4 in a row)</option>
                <option value="5">5x5 (4 in a row)</option>
                <option value="6">6x6 (5 in a row)</option>
            </select>
        </div>
        <div class="status" id="status">Player X's turn</div>
        <div class="board-wrapper">
            <div class="board" id="board">
            </div>
        </div>
        <button id="resetBtn">Reset Game</button>
        <button class="back-btn" id="backBtn">Back to Menu</button>
    </div>
    <script src="game-script.js"></script>
</body>
</html>`;

const humanVsAiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tic Tac Toe - Human vs AI</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="game-container">
        <h1>Tic Tac Toe</h1>
        <div class="status" id="status">Player X's turn</div>
        <div class="board-wrapper">
            <div class="board" id="board">
            </div>
        </div>
        <button id="resetBtn">Reset Game</button>
        <div class="difficulty-controls">
            <button class="difficulty-btn active" data-difficulty="easy">Easy</button>
            <button class="difficulty-btn" data-difficulty="medium">Medium</button>
            <button class="difficulty-btn" data-difficulty="hard">Hard</button>
        </div>
        <button class="back-btn" id="backBtn">Back to Menu</button>
    </div>
    <script src="ai-game-script.js"></script>
</body>
</html>`;

// JavaScript files content
const multiplayerScript = `...existing multiplayer-script.js content...`;
const configJs = `window.MULTIPLAYER_WORKER_URL = 'https://tic-tac-toe-multiplayer.printernb.workers.dev';`;
const stylesCss = `...existing styles.css content...`;
const scriptJs = `...existing script.js content...`;
const gameScript = `...existing game-script.js content...`;
const aiGameScript = `...existing ai-game-script.js content...`;

// Helper function to generate room codes
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
