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

    getBoardConfig(boardSize) {
        const size = Number(boardSize) || 3;
        const winningLength = size === 3 ? 3 : size === 6 ? 5 : 4;
        return { boardSize: size, winningLength };
    }

    createRoom({ boardSize, ownerClientId, opponentClientId = null, code = null, source = 'code' }) {
        const roomId = crypto.randomUUID();
        const roomCode = source === 'code' ? (code || this.makeCode()) : null;
        const { boardSize: resolvedSize, winningLength } = this.getBoardConfig(boardSize);
        const room = {
            id: roomId,
            code: roomCode,
            source,
            boardSize: resolvedSize,
            winningLength,
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
        return this.json({ ok: true });
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
                roomLabel: user.roomId ? `In match` : ''
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
        return this.json({ ok: true, roomId: room.id });
    }

    async createRoomFromCode(request, state) {
        const body = await this.parseJson(request);
        const clientId = body?.clientId;
        const boardSize = Number(body?.boardSize) || 3;
        const user = state.users[clientId];

        if (!clientId || !user) {
            return this.error('You need to register first.', 404);
        }

        const room = this.createRoom({ boardSize, ownerClientId: clientId, source: 'code' });
        room.playerNames.X = user.username;
        user.roomId = room.id;
        await this.save();
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
        return this.json({ ok: true, roomId: room.id });
    }

    async getRoomState(url, state) {
        const roomId = url.searchParams.get('roomId');
        const clientId = url.searchParams.get('clientId');
        const room = this.getRoom(roomId);

        if (!room) {
            return this.error('Room not found.', 404);
        }

        if (this.getPlayerRole(room, clientId) === null) {
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
        room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
        room.currentTurnClientId = room.players[room.currentPlayer];
        room.updatedAt = Date.now();

        if (this.checkWinner(room.board, room.boardSize, room.winningLength, role)) {
            room.status = 'finished';
            room.winner = role;
        } else if (room.board.every((cell) => cell !== '')) {
            room.status = 'finished';
            room.winner = 'draw';
        }

        await this.save();
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

        if (!this.getPlayerRole(room, clientId)) {
            return this.error('You are not part of this room.', 403);
        }

        room.board = Array(room.boardSize * room.boardSize).fill('');
        room.currentPlayer = 'X';
        room.currentTurnClientId = room.players.X;
        room.status = room.players.O ? 'active' : 'waiting';
        room.winner = null;
        room.updatedAt = Date.now();

        await this.save();
        return this.json(this.buildStatePayload(room, clientId));
    }

    async leaveRoom(request, state) {
        const body = await this.parseJson(request);
        const roomId = body?.roomId;
        const clientId = body?.clientId;
        const room = this.getRoom(roomId);
        const user = state.users[clientId];

        if (room && user) {
            const role = this.getPlayerRole(room, clientId);
            if (role) {
                room.players[role] = null;
                room.playerNames[role] = null;
                room.winner = null;
                user.roomId = null;

                if (room.source === 'code' && !room.players.X && !room.players.O) {
                    if (room.code) {
                        delete this.cache.codes[room.code];
                    }
                    delete this.cache.rooms[room.id];
                } else {
                    room.status = room.players.X && room.players.O ? 'active' : 'waiting';
                    room.currentTurnClientId = room.players.X || room.players.O || null;
                }
            }
        }

        await this.save();
        return this.json({ ok: true });
    }
}