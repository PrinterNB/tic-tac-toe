export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/api/')) {
            const id = env.LOBBY.idFromName('global');
            return env.LOBBY.get(id).fetch(request);
        }

        const response = await env.ASSETS.fetch(request);
        if (response.status === 404 && !url.pathname.includes('.')) {
            return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
        }
        return response;
    }
};

export class LobbyRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.cache = null;
        this.sockets = new Set();
    }

    async load() {
        if (!this.cache) {
            this.cache = (await this.state.storage.get('state')) || {
                users: {},
                invites: {},
                rooms: {},
                codes: {}
            };
        }
        this.pruneState();
        return this.cache;
    }

    async save() {
        await this.state.storage.put('state', this.cache);
    }

    attachSocket(socket) {
        this.sockets.add(socket);
        socket.addEventListener('close', () => {
            this.sockets.delete(socket);
        });
        socket.addEventListener('error', () => {
            this.sockets.delete(socket);
        });
    }

    notifyLobbyChange() {
        const message = JSON.stringify({ type: 'lobby-updated' });
        for (const socket of this.sockets) {
            try {
                socket.send(message);
            } catch {
                this.sockets.delete(socket);
            }
        }
    }

    pruneState() {
        const now = Date.now();
        const staleCutoff = now - 45000;

        for (const [clientId, user] of Object.entries(this.cache.users)) {
            if (user.lastSeen < staleCutoff) {
                delete this.cache.users[clientId];
            }
        }

        for (const [inviteId, invite] of Object.entries(this.cache.invites)) {
            if (invite.status === 'pending' && invite.createdAt < now - 15 * 60 * 1000) {
                invite.status = 'expired';
            }
        }
    }

    makeCode() {
        let code = '';
        do {
            code = Math.random().toString(36).slice(2, 8).toUpperCase();
        } while (this.cache.codes[code]);
        return code;
    }

    getBoardConfig(boardSize, winningLength = null) {
        const size = Number(boardSize) || 3;
        const resolvedWinningLength = Number(winningLength) || (size === 3 ? 3 : size === 6 ? 5 : 4);
        return { boardSize: size, winningLength: resolvedWinningLength };
    }

    normalizeLetter(letter) {
        const normalized = String(letter || '').trim().toUpperCase();
        return ['X', 'O', 'Y', 'Z'].includes(normalized) ? normalized : null;
    }

    getLobbyParticipant(room, clientId) {
        return room.participants?.find((participant) => participant.clientId === clientId) || null;
    }

    isLobbyParticipant(room, clientId) {
        return Boolean(this.getLobbyParticipant(room, clientId));
    }

    getLobbyTakenLetters(room, excludeClientId = null) {
        return (room.participants || [])
            .filter((participant) => participant.clientId !== excludeClientId)
            .map((participant) => participant.letter)
            .filter(Boolean);
    }

    activateLobbyRoom(room) {
        if (room.source !== 'lobby' || room.status === 'active') {
            return;
        }

        if ((room.participants || []).length !== 2) {
            return;
        }

        const letters = room.participants.map((participant) => participant.letter).filter(Boolean);
        if (letters.length !== 2 || new Set(letters).size !== 2) {
            return;
        }

        room.status = 'active';
        room.currentTurnClientId = room.hostClientId || room.participants[0].clientId;
        room.currentPlayer = this.getLobbyParticipant(room, room.currentTurnClientId)?.letter || room.participants[0].letter;
        room.board = Array(room.boardSize * room.boardSize).fill('');
        room.updatedAt = Date.now();
    }

    createRoom({ boardSize, ownerClientId, opponentClientId = null, code = null, source = 'code', winningLength = null, ownerLetter = null }) {
        const roomId = crypto.randomUUID();
        const roomCode = source === 'code' ? (code || this.makeCode()) : null;
        const { boardSize: resolvedSize, winningLength: resolvedWinningLength } = this.getBoardConfig(boardSize, winningLength);
        const ownerUser = this.getUser(ownerClientId);
        const room = {
            id: roomId,
            code: roomCode,
            source,
            boardSize: resolvedSize,
            winningLength: resolvedWinningLength,
            board: Array(resolvedSize * resolvedSize).fill(''),
            currentPlayer: 'X',
            currentTurnClientId: ownerClientId,
            players: {
                X: ownerClientId,
                O: opponentClientId
            },
            playerNames: {},
            status: opponentClientId ? 'active' : 'waiting',
            winner: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        if (source === 'lobby') {
            room.status = 'lobby';
            room.hostClientId = ownerClientId;
            room.currentPlayer = null;
            room.currentTurnClientId = null;
            room.participants = [
                {
                    clientId: ownerClientId,
                    username: ownerUser?.username || 'Player 1',
                    letter: this.normalizeLetter(ownerLetter),
                    ready: Boolean(ownerLetter)
                }
            ];
            delete room.players;
            delete room.playerNames;
        }

        this.cache.rooms[roomId] = room;
        if (roomCode) {
            this.cache.codes[roomCode] = roomId;
        }
        return room;
    }

    getUser(clientId) {
        return this.cache.users[clientId] || null;
    }

    getRoom(roomId) {
        return this.cache.rooms[roomId] || null;
    }

    getPlayerRole(room, clientId) {
        if (room.source === 'lobby') {
            return this.getLobbyParticipant(room, clientId)?.letter || null;
        }

        if (room.players.X === clientId) return 'X';
        if (room.players.O === clientId) return 'O';
        return null;
    }

    checkWinner(board, boardSize, winningLength, player) {
        for (let i = 0; i < boardSize; i++) {
            for (let j = 0; j <= boardSize - winningLength; j++) {
                let count = 0;
                for (let k = 0; k < winningLength; k++) {
                    if (board[i * boardSize + j + k] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count === winningLength) {
                    return true;
                }
            }
        }

        for (let j = 0; j < boardSize; j++) {
            for (let i = 0; i <= boardSize - winningLength; i++) {
                let count = 0;
                for (let k = 0; k < winningLength; k++) {
                    if (board[(i + k) * boardSize + j] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count === winningLength) {
                    return true;
                }
            }
        }

        for (let i = 0; i <= boardSize - winningLength; i++) {
            for (let j = 0; j <= boardSize - winningLength; j++) {
                let count = 0;
                for (let k = 0; k < winningLength; k++) {
                    if (board[(i + k) * boardSize + j + k] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count === winningLength) {
                    return true;
                }
            }
        }

        for (let i = 0; i <= boardSize - winningLength; i++) {
            for (let j = boardSize - 1; j >= winningLength - 1; j--) {
                let count = 0;
                for (let k = 0; k < winningLength; k++) {
                    if (board[(i + k) * boardSize + j - k] === player) {
                        count++;
                    } else {
                        break;
                    }
                }
                if (count === winningLength) {
                    return true;
                }
            }
        }

        return false;
    }

    buildStatePayload(room, clientId) {
        const role = this.getPlayerRole(room, clientId);
        if (room.source === 'lobby') {
            const participants = (room.participants || []).map((participant) => ({
                clientId: participant.clientId,
                username: participant.username,
                letter: participant.letter || null,
                ready: Boolean(participant.letter)
            }));

            return {
                roomId: room.id,
                code: room.code,
                boardSize: room.boardSize,
                winningLength: room.winningLength,
                board: room.board,
                currentPlayer: room.currentPlayer,
                currentTurnClientId: room.currentTurnClientId,
                status: room.status,
                winner: room.winner,
                participants,
                yourRole: role,
                yourLetter: role,
                availableLetters: ['X', 'O', 'Y', 'Z'].filter((letter) => !this.getLobbyTakenLetters(room, clientId).includes(letter) || role === letter),
                source: room.source,
                hostClientId: room.hostClientId
            };
        }

        return {
            roomId: room.id,
            code: room.code,
            boardSize: room.boardSize,
            winningLength: room.winningLength,
            board: room.board,
            currentPlayer: room.currentPlayer,
            currentTurnClientId: room.currentTurnClientId,
            status: room.status,
            winner: room.winner,
            players: room.players,
            playerNames: room.playerNames,
            yourRole: role,
            source: room.source
        };
    }

    json(data, init = {}) {
        return new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Cache-Control': 'no-store'
            },
            ...init
        });
    }

    error(message, status = 400) {
        return this.json({ error: message }, { status });
    }

    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204 });
        }

        const url = new URL(request.url);
        const state = await this.load();

        if (url.pathname === '/api/register' && request.method === 'POST') {
            return this.register(request, state);
        }

        if (url.pathname === '/api/heartbeat' && request.method === 'POST') {
            return this.heartbeat(request, state);
        }

        if (url.pathname === '/api/lobby/subscribe' && request.headers.get('Upgrade') === 'websocket') {
            return this.subscribeToLobby();
        }

        if (url.pathname === '/api/state' && request.method === 'GET') {
            return this.stateSnapshot(url, state);
        }

        if (url.pathname === '/api/invite' && request.method === 'POST') {
            return this.createInvite(request, state);
        }

        if (url.pathname === '/api/invite/respond' && request.method === 'POST') {
            return this.respondToInvite(request, state);
        }

        if (url.pathname === '/api/room/create' && request.method === 'POST') {
            return this.createRoomFromCode(request, state);
        }

        if (url.pathname === '/api/room/join' && request.method === 'POST') {
            return this.joinRoomByCode(request, state);
        }

        if (url.pathname === '/api/room/letter' && request.method === 'POST') {
            return this.setRoomLetter(request, state);
        }

        if (url.pathname === '/api/room' && request.method === 'GET') {
            return this.getRoomState(url, state);
        }

        if (url.pathname === '/api/room/move' && request.method === 'POST') {
            return this.applyMove(request, state);
        }

        if (url.pathname === '/api/room/reset' && request.method === 'POST') {
            return this.resetRoom(request, state);
        }

        if (url.pathname === '/api/room/leave' && request.method === 'POST') {
            return this.leaveRoom(request, state);
        }

        return this.error('Not found', 404);
    }

    async parseJson(request) {
        try {
            return await request.json();
        } catch {
            return null;
        }
    }

    async register(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        const username = String(body?.username || '').trim();
        const boardSize = Number(body?.boardSize) || 3;

        if (!clientId || !username) {
            return this.error('Username and client ID are required.');
        }

        const current = state.users[clientId];
        const normalized = username.toLowerCase();

        for (const [otherClientId, user] of Object.entries(state.users)) {
            if (otherClientId !== clientId && user.username.toLowerCase() === normalized) {
                return this.error('That username is already in use.');
            }
        }

        if (current && current.username !== username) {
            current.username = username;
        }

        state.users[clientId] = {
            username,
            lastSeen: Date.now(),
            boardSize,
            roomId: current?.roomId || null
        };

        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true });
    }

    async heartbeat(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        if (!clientId || !state.users[clientId]) {
            return this.error('Unknown client.', 404);
        }

        state.users[clientId].lastSeen = Date.now();
        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true });
    }

    subscribeToLobby() {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        this.attachSocket(server);
        server.send(JSON.stringify({ type: 'lobby-connected' }));
        return new Response(null, { status: 101, webSocket: client });
    }

    async stateSnapshot(url, state) {
        const clientId = url.searchParams.get('clientId');
        if (!clientId || !state.users[clientId]) {
            return this.error('Unknown client.', 404);
        }

        const currentUser = state.users[clientId];
        const users = Object.entries(state.users)
            .filter(([otherClientId]) => otherClientId !== clientId)
            .map(([otherClientId, user]) => ({
                clientId: otherClientId,
                username: user.username,
                roomLabel: user.roomId ? `In match` : '',
                boardSize: Number(user.boardSize) || 3
            }))
            .sort((left, right) => left.username.localeCompare(right.username));

        const incomingInvites = Object.values(state.invites)
            .filter((invite) => invite.toClientId === clientId && invite.status === 'pending')
            .sort((left, right) => right.createdAt - left.createdAt);

        const outgoingInvites = Object.values(state.invites)
            .filter((invite) => invite.fromClientId === clientId && invite.status === 'pending')
            .sort((left, right) => right.createdAt - left.createdAt);

        const activeRoomId = currentUser.roomId || null;
        const activeRoom = activeRoomId ? this.getRoom(activeRoomId) : null;

        return this.json({
            users,
            incomingInvites,
            outgoingInvites,
            activeRoomId,
            activeRoom: activeRoom ? this.buildStatePayload(activeRoom, clientId) : null,
            defaultBoardSize: currentUser.boardSize || 3
        });
    }

    async createInvite(request, state) {
        const body = await this.parseJson(request);
        const fromClientId = body?.fromClientId;
        const toClientId = body?.toClientId;
        const boardSize = Number(body?.boardSize) || 3;

        if (!fromClientId || !toClientId) {
            return this.error('Both players are required.');
        }

        if (fromClientId === toClientId) {
            return this.error('You cannot invite yourself.');
        }

        const fromUser = state.users[fromClientId];
        const toUser = state.users[toClientId];
        if (!fromUser || !toUser) {
            return this.error('One of the players is no longer online.', 404);
        }

        const inviteId = crypto.randomUUID();
        state.invites[inviteId] = {
            id: inviteId,
            fromClientId,
            fromUsername: fromUser.username,
            toClientId,
            toUsername: toUser.username,
            boardSize,
            status: 'pending',
            createdAt: Date.now()
        };

        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true, inviteId, toUsername: toUser.username });
    }

    async respondToInvite(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        const inviteId = body?.inviteId;
        const accept = Boolean(body?.accept);

        const invite = state.invites[inviteId];
        if (!invite || invite.toClientId !== clientId) {
            return this.error('Invite not found.', 404);
        }

        if (!accept) {
            invite.status = 'declined';
            await this.save();
            this.notifyLobbyChange();
            return this.json({ ok: true });
        }

        const room = this.createRoom({
            boardSize: invite.boardSize,
            ownerClientId: invite.fromClientId,
            opponentClientId: invite.toClientId,
            source: 'invite'
        });

        const inviter = state.users[invite.fromClientId];
        const invitee = state.users[invite.toClientId];
        if (inviter) inviter.roomId = room.id;
        if (invitee) invitee.roomId = room.id;
        room.playerNames.X = inviter?.username || 'Player X';
        room.playerNames.O = invitee?.username || 'Player O';
        invite.status = 'accepted';
        room.status = 'active';

        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true, roomId: room.id });
    }

    async createRoomFromCode(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        const mode = String(body?.mode || 'code').toLowerCase();
        const boardSize = Number(body?.boardSize) || (mode === 'lobby' ? 6 : 3);
        const winningLength = Number(body?.winningLength) || (mode === 'lobby' ? 4 : null);
        const ownerLetter = this.normalizeLetter(body?.letter) || 'X';
        const user = state.users[clientId];

        if (!clientId || !user) {
            return this.error('You need to register first.', 404);
        }

        const room = this.createRoom({
            boardSize,
            winningLength,
            ownerClientId: clientId,
            source: mode === 'lobby' ? 'lobby' : 'code',
            ownerLetter
        });

        if (room.source === 'lobby') {
            room.participants[0].letter = ownerLetter;
            room.participants[0].ready = true;
        } else {
            room.playerNames.X = user.username;
        }

        user.roomId = room.id;
        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true, roomId: room.id, code: room.code });
    }

    async joinRoomByCode(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        const code = String(body?.code || '').trim().toUpperCase();
        const user = state.users[clientId];

        if (!clientId || !user) {
            return this.error('You need to register first.', 404);
        }

        const roomId = state.codes[code];
        if (!roomId) {
            return this.error('That code does not exist.');
        }

        const room = state.rooms[roomId];
        if (!room) {
            return this.error('That room is no longer available.');
        }

        if (room.source === 'lobby') {
            if ((room.participants || []).some((participant) => participant.clientId === clientId)) {
                return this.json({ ok: true, roomId: room.id });
            }

            if ((room.participants || []).length >= 2) {
                return this.error('That room is already full.');
            }

            room.participants.push({
                clientId,
                username: user.username,
                letter: null,
                ready: false
            });
            user.roomId = room.id;
            room.status = 'lobby';
            await this.save();
            this.notifyLobbyChange();
            return this.json({ ok: true, roomId: room.id });
        }

        if (room.players.O) {
            return this.error('That room is already full.');
        }

        room.players.O = clientId;
        room.playerNames.O = user.username;
        room.status = 'active';
        room.currentTurnClientId = room.players.X;
        user.roomId = room.id;
        delete state.codes[code];

        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true, roomId: room.id });
    }

    async setRoomLetter(request, state) {
        const body = await this.parseJson(request);
        const roomId = body?.roomId;
        const clientId = body?.clientId;
        const letter = this.normalizeLetter(body?.letter);
        const room = this.getRoom(roomId);

        if (!room || room.source !== 'lobby') {
            return this.error('Lobby room not found.', 404);
        }

        if (!letter) {
            return this.error('Choose X, O, Y, or Z.');
        }

        const participant = this.getLobbyParticipant(room, clientId);
        if (!participant) {
            return this.error('You are not part of this room.', 403);
        }

        const takenLetters = this.getLobbyTakenLetters(room, clientId);
        if (takenLetters.includes(letter)) {
            return this.error('That letter is already taken.');
        }

        participant.letter = letter;
        participant.ready = true;
        room.updatedAt = Date.now();
        this.activateLobbyRoom(room);

        await this.save();
        this.notifyLobbyChange();
        return this.json(this.buildStatePayload(room, clientId));
    }

    async getRoomState(url, state) {
        const roomId = url.searchParams.get('roomId');
        const clientId = url.searchParams.get('clientId');
        const room = this.getRoom(roomId);

        if (!room) {
            return this.error('Room not found.', 404);
        }

        if (room.source === 'lobby') {
            if (!this.isLobbyParticipant(room, clientId)) {
                return this.error('You are not part of this room.', 403);
            }
        } else if (this.getPlayerRole(room, clientId) === null) {
            return this.error('You are not part of this room.', 403);
        }

        return this.json(this.buildStatePayload(room, clientId));
    }

    async applyMove(request, state) {
        const body = await this.parseJson(request);
        const roomId = body?.roomId;
        const clientId = body?.clientId;
        const index = Number(body?.index);
        const room = this.getRoom(roomId);

        if (!room) {
            return this.error('Room not found.', 404);
        }

        if (room.status !== 'active') {
            return this.error('The match is not active yet.');
        }

        const role = this.getPlayerRole(room, clientId);
        if (!role) {
            return this.error('You are not part of this room.', 403);
        }

        if (room.currentTurnClientId !== clientId) {
            return this.error('It is not your turn.');
        }

        if (!Number.isInteger(index) || index < 0 || index >= room.board.length || room.board[index]) {
            return this.error('That move is not valid.');
        }

        room.board[index] = role;
        if (room.source === 'lobby') {
            const nextParticipant = (room.participants || []).find((participant) => participant.clientId !== clientId);
            room.currentTurnClientId = nextParticipant?.clientId || null;
            room.currentPlayer = nextParticipant?.letter || null;
        } else {
            room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            room.currentTurnClientId = room.players[room.currentPlayer];
        }
        room.updatedAt = Date.now();

        if (this.checkWinner(room.board, room.boardSize, room.winningLength, role)) {
            room.status = 'finished';
            room.winner = role;
        } else if (room.board.every((cell) => cell !== '')) {
            room.status = 'finished';
            room.winner = 'draw';
        }

        await this.save();
        this.notifyLobbyChange();
        return this.json(this.buildStatePayload(room, clientId));
    }

    async resetRoom(request, state) {
        const body = await this.parseJson(request);
        const roomId = body?.roomId;
        const clientId = body?.clientId;
        const room = this.getRoom(roomId);

        if (!room) {
            return this.error('Room not found.', 404);
        }

        if (room.source === 'lobby') {
            if (!this.isLobbyParticipant(room, clientId)) {
                return this.error('You are not part of this room.', 403);
            }
        } else if (!this.getPlayerRole(room, clientId)) {
            return this.error('You are not part of this room.', 403);
        }

        room.board = Array(room.boardSize * room.boardSize).fill('');
        if (room.source === 'lobby') {
            this.activateLobbyRoom(room);
            if (room.status !== 'active') {
                room.currentPlayer = null;
                room.currentTurnClientId = null;
            }
        } else {
            room.currentPlayer = 'X';
            room.currentTurnClientId = room.players.X;
            room.status = room.players.O ? 'active' : 'waiting';
        }
        room.winner = null;
        room.updatedAt = Date.now();

        await this.save();
        this.notifyLobbyChange();
        return this.json(this.buildStatePayload(room, clientId));
    }

    async leaveRoom(request, state) {
        const body = await this.parseJson(request);
        const roomId = body?.roomId;
        const clientId = body?.clientId;
        const room = this.getRoom(roomId);
        const user = state.users[clientId];

        if (user) {
            user.roomId = null;
        }

        if (room) {
            const participantIds = room.source === 'lobby'
                ? (room.participants || []).map((participant) => participant.clientId)
                : Object.values(room.players).filter(Boolean);

            for (const participantId of participantIds) {
                const participantUser = state.users[participantId];
                if (participantUser) {
                    participantUser.roomId = null;
                }
            }

            if (room.code) {
                delete this.cache.codes[room.code];
            }
            delete this.cache.rooms[room.id];
        }

        await this.save();
        this.notifyLobbyChange();
        return this.json({ ok: true });
    }
}