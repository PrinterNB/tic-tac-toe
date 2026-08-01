const API_BASE = '/api';
const roomIdParam = new URLSearchParams(window.location.search).get('roomId');
const clientIdParam = new URLSearchParams(window.location.search).get('clientId') || localStorage.getItem('ttt-online-client-id');

const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const backBtn = document.getElementById('backBtn');
const roomMeta = document.getElementById('room-meta');
const copyInviteLinkBtn = document.getElementById('copy-invite-link-btn');
const inviteLinkStatus = document.getElementById('invite-link-status');

let currentRoom = null;
let refreshTimer = null;

function apiFetch(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    }).then(async (response) => {
        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { message: text };
            }
        }

        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || 'Request failed');
        }

        return payload;
    });
}

function setInviteLinkStatus(message, error = false) {
    if (!inviteLinkStatus) {
        return;
    }
    inviteLinkStatus.textContent = message;
    inviteLinkStatus.classList.toggle('error', error);
}

function getInviteLink(code) {
    return `${window.location.origin}/online-multiplayer.html?join=${encodeURIComponent(code)}`;
}

function renderBoard(room) {
    boardElement.innerHTML = '';
    boardElement.dataset.size = String(room.boardSize);
    boardElement.style.gridTemplateColumns = `repeat(${room.boardSize}, 1fr)`;

    const cellSize = Math.max(42, 108 - (room.boardSize * 8));

    room.board.forEach((value, index) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = String(index);
        cell.textContent = value;
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.fontSize = room.boardSize === 3 ? '3rem' : room.boardSize === 4 ? '2.5rem' : room.boardSize === 5 ? '2rem' : '1.5rem';

        if (value) {
            cell.classList.add('taken', value.toLowerCase());
        }

        if (room.status === 'active' && !value && room.currentTurnClientId === clientIdParam) {
            cell.classList.add('clickable');
        }

        boardElement.appendChild(cell);
    });
}

function updateStatus(room) {
    const role = room.players.X === clientIdParam ? 'X' : room.players.O === clientIdParam ? 'O' : '?';
    if (room.status === 'waiting') {
        statusElement.textContent = room.code ? `Waiting for an opponent. Share code ${room.code}.` : 'Waiting for an opponent to accept the invite.';
        return;
    }

    if (room.status === 'finished') {
        if (room.winner === 'draw') {
            statusElement.textContent = 'It is a draw.';
        } else if (room.winner) {
            statusElement.textContent = `Player ${room.winner} wins!`;
        } else {
            statusElement.textContent = 'Match finished.';
        }
        return;
    }

    if (room.currentTurnClientId === clientIdParam) {
        statusElement.textContent = `You are ${role}. Your turn.`;
    } else {
        const turnRole = room.currentPlayer;
        statusElement.textContent = `You are ${role}. Waiting for Player ${turnRole}.`;
    }
}

function updateRoomMeta(room) {
    const playerNames = [`X: ${room.playerNames.X || 'Waiting'}`, `O: ${room.playerNames.O || 'Waiting'}`];
    roomMeta.textContent = `Code ${room.code || 'private'} · ${room.boardSize}x${room.boardSize} · ${playerNames.join(' · ')}`;

    if (copyInviteLinkBtn) {
        copyInviteLinkBtn.hidden = !room.code;
    }
}

async function refreshRoom() {
    if (!roomIdParam || !clientIdParam) {
        window.location.href = 'online-multiplayer.html';
        return;
    }

    try {
        const room = await apiFetch(`/room?roomId=${encodeURIComponent(roomIdParam)}&clientId=${encodeURIComponent(clientIdParam)}`);
        currentRoom = room;
        updateRoomMeta(room);
        renderBoard(room);
        updateStatus(room);
    } catch (error) {
        const message = error?.message || 'Unknown error';
        if (message.includes('Room not found') || message.includes('not part of this room')) {
            window.location.href = 'online-multiplayer.html';
            return;
        }
        statusElement.textContent = message;
    }
}

async function copyInviteLink() {
    if (!currentRoom?.code) {
        setInviteLinkStatus('This room does not have a shareable code.', true);
        return;
    }

    const link = getInviteLink(currentRoom.code);
    try {
        await navigator.clipboard.writeText(link);
        setInviteLinkStatus('Invite link copied to clipboard.');
    } catch {
        setInviteLinkStatus(link);
    }
}

async function makeMove(event) {
    const cell = event.target.closest('.cell');
    if (!cell || !currentRoom || currentRoom.status !== 'active') {
        return;
    }

    const index = Number(cell.dataset.index);
    try {
        await apiFetch('/room/move', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomIdParam,
                clientId: clientIdParam,
                index
            })
        });
        await refreshRoom();
    } catch (error) {
        statusElement.textContent = error.message;
    }
}

async function resetGame() {
    try {
        await apiFetch('/room/reset', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomIdParam,
                clientId: clientIdParam
            })
        });
        await refreshRoom();
    } catch (error) {
        statusElement.textContent = error.message;
    }
}

async function leaveMatch() {
    try {
        await apiFetch('/room/leave', {
            method: 'POST',
            body: JSON.stringify({
                roomId: roomIdParam,
                clientId: clientIdParam
            })
        });
    } catch {
        // Best-effort leave.
    }

    window.location.href = 'online-multiplayer.html';
}

boardElement.addEventListener('click', makeMove);
resetBtn.addEventListener('click', resetGame);
backBtn.addEventListener('click', leaveMatch);
copyInviteLinkBtn?.addEventListener('click', copyInviteLink);

refreshRoom();
refreshTimer = window.setInterval(refreshRoom, 1500);