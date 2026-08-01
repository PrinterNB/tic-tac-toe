const API_BASE = '/api';
const clientIdKey = 'ttt-online-client-id';
const usernameKey = 'ttt-online-username';
const boardSizeKey = 'ttt-online-board-size';

const usernameCard = document.getElementById('username-card');
const lobbyCard = document.getElementById('lobby-card');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');
const boardSizeInput = document.getElementById('board-size-input');
const roomBoardSize = document.getElementById('room-board-size');
const usersList = document.getElementById('users-list');
const invitesList = document.getElementById('invites-list');
const lobbyStatus = document.getElementById('lobby-status');
const usernameError = document.getElementById('username-error');
const lobbySummary = document.getElementById('lobby-summary');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinCodeBtn = document.getElementById('join-code-btn');
const joinCodeInput = document.getElementById('join-code-input');
const generatedCodeBox = document.getElementById('generated-code-box');
const copyInviteLinkBtn = document.getElementById('copy-invite-link-btn');
const inviteLinkStatus = document.getElementById('invite-link-status');
const inviteBanner = document.getElementById('invite-banner');
const inviteBannerTitle = document.getElementById('invite-banner-title');
const inviteBannerSubtitle = document.getElementById('invite-banner-subtitle');
const inviteBannerAccept = document.getElementById('invite-banner-accept');
const inviteBannerDecline = document.getElementById('invite-banner-decline');

const pendingJoinCode = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase() || '';
let activeBannerInviteId = null;

let clientId = getClientId();
let username = localStorage.getItem(usernameKey) || '';
let pollTimer = null;
let heartbeatTimer = null;
let lobbySocket = null;
let registered = false;

function getClientId() {
    let value = localStorage.getItem(clientIdKey);
    if (!value) {
        value = crypto.randomUUID();
        localStorage.setItem(clientIdKey, value);
    }
    return value;
}

function getBoardSize() {
    return parseInt(roomBoardSize.value, 10) || parseInt(boardSizeInput.value, 10) || 3;
}

function syncBoardSizeSelection(value = null) {
    const selectedValue = String(value ?? localStorage.getItem(boardSizeKey) ?? 3);
    if (boardSizeInput) {
        boardSizeInput.value = selectedValue;
    }
    if (roomBoardSize) {
        roomBoardSize.value = selectedValue;
    }
    localStorage.setItem(boardSizeKey, selectedValue);
}

function setLobbyMessage(message, error = false) {
    lobbyStatus.textContent = message;
    lobbyStatus.classList.toggle('error', error);
}

function setInviteLinkStatus(message, error = false) {
    if (!inviteLinkStatus) {
        return;
    }
    inviteLinkStatus.textContent = message;
    inviteLinkStatus.classList.toggle('error', error);
}

function showUsernameError(message) {
    usernameError.textContent = message;
    usernameError.classList.toggle('error', Boolean(message));
}

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

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
}

function setRegisteredUi(isRegistered) {
    usernameCard.classList.toggle('hidden', isRegistered);
    lobbyCard.classList.toggle('hidden', !isRegistered);
}

function getInviteLink(code) {
    return `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(code)}`;
}

function renderInviteBanner(invites) {
    if (!inviteBanner || !inviteBannerTitle || !inviteBannerSubtitle || !inviteBannerAccept || !inviteBannerDecline) {
        return;
    }

    const invite = invites[0];
    if (!invite) {
        inviteBanner.classList.add('hidden');
        activeBannerInviteId = null;
        return;
    }

    activeBannerInviteId = invite.id;
    inviteBannerTitle.textContent = `Invite from ${invite.fromUsername}`;
    inviteBannerSubtitle.textContent = `Board ${invite.boardSize}x${invite.boardSize}. Accept it now or scroll to see all invites.`;
    inviteBanner.classList.remove('hidden');
    inviteBannerAccept.onclick = () => respondToInvite(invite.id, true);
    inviteBannerDecline.onclick = () => respondToInvite(invite.id, false);
}

function connectLobbySocket() {
    if (lobbySocket) {
        try {
            lobbySocket.close();
        } catch {
            // ignore
        }
    }

    try {
        const socketUrl = new URL(`${window.location.origin}/api/lobby/subscribe`);
        socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        socketUrl.searchParams.set('clientId', clientId);

        lobbySocket = new WebSocket(socketUrl.toString());
        lobbySocket.addEventListener('message', (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload?.type === 'lobby-updated') {
                    refreshLobby();
                }
            } catch {
                refreshLobby();
            }
        });
        lobbySocket.addEventListener('close', () => {
            lobbySocket = null;
        });
        lobbySocket.addEventListener('error', () => {
            lobbySocket = null;
        });
    } catch {
        lobbySocket = null;
    }
}

function ensureGameRedirect(state) {
    if (state?.activeRoomId) {
        const params = new URLSearchParams({ roomId: state.activeRoomId, clientId });
        window.location.href = `online-game.html?${params.toString()}`;
        return true;
    }
    return false;
}

function renderUsers(users) {
    if (!users.length) {
        usersList.innerHTML = '<div class="empty-state">No one else is online yet.</div>';
        return;
    }

    usersList.innerHTML = users.map((user) => {
        const statusText = user.roomLabel ? ` · ${user.roomLabel}` : '';
        const isSelf = user.clientId === clientId;
        const boardSizeLabel = `Board ${user.boardSize || 3}x${user.boardSize || 3}`;
        return `
            <div class="list-row">
                <div>
                    <strong>${escapeHtml(user.username)}</strong>
                    <div class="row-subtitle">${isSelf ? 'You' : 'Online'}${statusText} · ${boardSizeLabel}</div>
                </div>
                ${isSelf ? '<span class="pill">You</span>' : `<button class="ghost-btn invite-btn" data-client-id="${escapeHtml(user.clientId)}">Invite</button>`}
            </div>
        `;
    }).join('');

    document.querySelectorAll('.invite-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const targetClientId = button.getAttribute('data-client-id');
            await invitePlayer(targetClientId);
        });
    });
}

function renderInvites(invites) {
    renderInviteBanner(invites);

    if (!invites.length) {
        invitesList.innerHTML = '<div class="empty-state">No pending invites.</div>';
        return;
    }

    invitesList.innerHTML = invites.map((invite) => {
        return `
            <div class="list-row">
                <div>
                    <strong>${escapeHtml(invite.fromUsername)}</strong>
                    <div class="row-subtitle">Board ${invite.boardSize}x${invite.boardSize}</div>
                </div>
                <div class="row-actions">
                    <button class="ghost-btn accept-invite-btn" data-invite-id="${escapeHtml(invite.id)}">Accept</button>
                    <button class="ghost-btn secondary-invite-btn" data-invite-id="${escapeHtml(invite.id)}">Decline</button>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.accept-invite-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const inviteId = button.getAttribute('data-invite-id');
            await respondToInvite(inviteId, true);
        });
    });

    document.querySelectorAll('.secondary-invite-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const inviteId = button.getAttribute('data-invite-id');
            await respondToInvite(inviteId, false);
        });
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function registerUsername(event) {
    event.preventDefault();
    const candidate = usernameInput.value.trim();
    if (!candidate) {
        showUsernameError('Enter a username to continue.');
        return;
    }

    try {
        await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({
                clientId,
                username: candidate,
                boardSize: getBoardSize()
            })
        });

        username = candidate;
        localStorage.setItem(usernameKey, username);
        syncBoardSizeSelection(getBoardSize());
        showUsernameError('');
        setRegisteredUi(true);
        setLobbyMessage(`Signed in as ${username}.`);
        connectLobbySocket();
        await refreshLobby();
        if (pendingJoinCode) {
            joinCodeInput.value = pendingJoinCode;
        }
        startPolling();
    } catch (error) {
        showUsernameError(error.message);
    }
}

async function refreshLobby() {
    if (!registered) {
        return;
    }

    try {
        const state = await apiFetch(`/state?clientId=${encodeURIComponent(clientId)}`);
        lobbySummary.textContent = `Signed in as ${username}. ${state.users.length} player${state.users.length === 1 ? '' : 's'} online.`;
        syncBoardSizeSelection(localStorage.getItem(boardSizeKey) || String(state.defaultBoardSize || 3));
        renderUsers(state.users.filter((user) => user.clientId !== clientId));
        renderInvites(state.incomingInvites);

        if (ensureGameRedirect(state)) {
            return;
        }

        if (state.outgoingInvites.length) {
            const activeInvite = state.outgoingInvites[0];
            setLobbyMessage(`Waiting for ${activeInvite.toUsername} to respond to your invite.`);
        } else {
            setLobbyMessage(`Signed in as ${username}. Pick a player or generate a private code.`);
        }
    } catch (error) {
        setLobbyMessage(error.message, true);
    }
}

async function invitePlayer(targetClientId) {
    try {
        const response = await apiFetch('/invite', {
            method: 'POST',
            body: JSON.stringify({
                fromClientId: clientId,
                toClientId: targetClientId,
                boardSize: getBoardSize()
            })
        });

        setLobbyMessage(`Invite sent. Waiting for ${response.toUsername} to accept.`);
        await refreshLobby();
    } catch (error) {
        setLobbyMessage(error.message, true);
    }
}

async function respondToInvite(inviteId, accept) {
    try {
        const response = await apiFetch('/invite/respond', {
            method: 'POST',
            body: JSON.stringify({
                clientId,
                inviteId,
                accept
            })
        });

        if (accept) {
            const params = new URLSearchParams({ roomId: response.roomId, clientId });
            window.location.href = `online-game.html?${params.toString()}`;
            return;
        }

        setLobbyMessage('Invite declined.');
        await refreshLobby();
    } catch (error) {
        setLobbyMessage(error.message, true);
    }
}

async function createRoom() {
    try {
        const response = await apiFetch('/room/create', {
            method: 'POST',
            body: JSON.stringify({
                clientId,
                boardSize: getBoardSize()
            })
        });

        generatedCodeBox.textContent = `Code: ${response.code}`;
        setInviteLinkStatus(`Invite link ready.`);
        setLobbyMessage(`Room created with code ${response.code}. Share it or wait for someone to join.`);
        const params = new URLSearchParams({ roomId: response.roomId, clientId });
        window.location.href = `online-game.html?${params.toString()}`;
    } catch (error) {
        setLobbyMessage(error.message, true);
    }
}

async function joinRoomByCode() {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) {
        setLobbyMessage('Enter a code to join a match.', true);
        return;
    }

    try {
        const response = await apiFetch('/room/join', {
            method: 'POST',
            body: JSON.stringify({
                clientId,
                code
            })
        });

        const params = new URLSearchParams({ roomId: response.roomId, clientId });
        window.location.href = `online-game.html?${params.toString()}`;
    } catch (error) {
        setLobbyMessage(error.message, true);
    }
}

async function copyInviteLink() {
    const code = generatedCodeBox.textContent.replace('Code: ', '').trim();
    if (!code) {
        setInviteLinkStatus('Generate a code first to get an invite link.', true);
        return;
    }

    const link = getInviteLink(code);
    try {
        await navigator.clipboard.writeText(link);
        setInviteLinkStatus('Invite link copied to clipboard.');
    } catch {
        setInviteLinkStatus(link);
    }
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
    }

    pollTimer = window.setInterval(refreshLobby, 2500);
    heartbeatTimer = window.setInterval(async () => {
        try {
            await apiFetch('/heartbeat', {
                method: 'POST',
                body: JSON.stringify({ clientId })
            });
        } catch {
            // Best-effort keepalive.
        }
    }, 10000);
}

function resetSession() {
    localStorage.removeItem(usernameKey);
    username = '';
    registered = false;
    setRegisteredUi(false);
    usernameInput.value = '';
    usernameError.textContent = '';
    generatedCodeBox.textContent = '';
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (lobbySocket) {
        try {
            lobbySocket.close();
        } catch {
            // ignore
        }
        lobbySocket = null;
    }
}

async function attemptAutoRegister() {
    if (!username) {
        return;
    }

    usernameInput.value = username;
    roomBoardSize.value = localStorage.getItem(boardSizeKey) || '3';
    boardSizeInput.value = roomBoardSize.value;
    try {
        await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({
                clientId,
                username,
                boardSize: getBoardSize()
            })
        });
        registered = true;
        setRegisteredUi(true);
        setLobbyMessage(`Signed in as ${username}.`);
        connectLobbySocket();
        await refreshLobby();
        startPolling();
    } catch {
        resetSession();
    }
}

[boardSizeInput, roomBoardSize].filter(Boolean).forEach((select) => {
    select.addEventListener('change', async () => {
        syncBoardSizeSelection(select.value);

        if (!registered || !username) {
            return;
        }

        try {
            await apiFetch('/register', {
                method: 'POST',
                body: JSON.stringify({
                    clientId,
                    username,
                    boardSize: getBoardSize()
                })
            });
            await refreshLobby();
        } catch {
            // Best-effort; the next lobby refresh will recover.
        }
    });
});

usernameForm.addEventListener('submit', registerUsername);
createRoomBtn.addEventListener('click', createRoom);
joinCodeBtn.addEventListener('click', joinRoomByCode);
copyInviteLinkBtn?.addEventListener('click', copyInviteLink);
leaveLobbyBtn.addEventListener('click', () => {
    resetSession();
    setLobbyMessage('Choose a new username to rejoin.');
});

document.addEventListener('DOMContentLoaded', () => {
    syncBoardSizeSelection(localStorage.getItem(boardSizeKey) || '3');
    usernameInput.value = username;
    if (pendingJoinCode) {
        joinCodeInput.value = pendingJoinCode;
        setLobbyMessage(`Invite link detected. Join code ${pendingJoinCode} is ready.`);
    }
    if (username) {
        attemptAutoRegister();
    }
});