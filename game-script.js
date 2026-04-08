// Game state
let board = [];
let currentPlayer = 'X';
let gameActive = true;
let boardSize = 3;
let winningLength = 3;

// DOM elements
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const boardSizeSelector = document.getElementById('board-size');

// Initialize game
function initGame() {
    // Reset board based on selected size
    board = Array(boardSize * boardSize).fill('');
    currentPlayer = 'X';
    gameActive = true;
    
    // Update winning length based on board size
    if (boardSize === 3) {
        winningLength = 3;
    } else if (boardSize === 6) {
        winningLength = 5;
    } else {
        winningLength = 4;
    }
    
    updateStatus();
    renderBoard();
}

// Render the board
function renderBoard() {
    // Clear existing cells
    boardElement.innerHTML = '';
    
    // Create new cells based on board size
    for (let i = 0; i < boardSize * boardSize; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-index', i);
        cell.textContent = board[i];
        if (board[i]) {
            cell.classList.add('taken');
            cell.classList.add(board[i].toLowerCase());
        }
        boardElement.appendChild(cell);
    }
    
    // Update board size styling
    updateBoardSize();
}

// Update board size styling
function updateBoardSize() {
    const boardContainer = document.getElementById('board');
    boardContainer.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
    
    // Adjust cell size based on board size
    const cellSize = Math.max(40, 100 - (boardSize * 5));
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        // Adjust font size to match tic-tac-toe-menu project
        let fontSize;
        if (boardSize === 3) {
            fontSize = '3rem';
        } else if (boardSize === 4) {
            fontSize = '2.5rem';
        } else if (boardSize === 5) {
            fontSize = '2rem';
        } else if (boardSize === 6) {
            fontSize = '1.5rem';
        } else {
            fontSize = `${Math.max(14, 20 - (boardSize * 1))}px`;
        }
        cell.style.fontSize = fontSize;
    });
}

// Update status message
function updateStatus() {
    if (!gameActive) {
        return;
    }
    
    statusElement.textContent = `Player ${currentPlayer}'s turn`;
}

// Handle cell click
function handleCellClick(event) {
    // Only process clicks on actual cells, not on whitespace
    if (!event.target.classList.contains('cell')) {
        return;
    }
    
    const cell = event.target;
    const index = parseInt(cell.getAttribute('data-index'));

    if (board[index] || !gameActive) {
        return;
    }

    // Make move
    board[index] = currentPlayer;
    cell.textContent = currentPlayer;
    cell.classList.add('taken');
    cell.classList.add(currentPlayer.toLowerCase());

    // Check for winner
    if (checkWinner()) {
        gameActive = false;
        statusElement.textContent = `Player ${currentPlayer} wins! 🎉`;
        return;
    }

    // Check for draw
    if (board.every(cell => cell !== '')) {
        gameActive = false;
        statusElement.textContent = "It's a draw! 🤝";
        return;
    }

    // Switch player
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateStatus();
}

// Check for winner
function checkWinner() {
    // Check rows
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = i * boardSize + j + k;
                if (board[index] === currentPlayer) {
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

    // Check columns
    for (let j = 0; j < boardSize; j++) {
        for (let i = 0; i <= boardSize - winningLength; i++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j;
                if (board[index] === currentPlayer) {
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

    // Check diagonals (top-left to bottom-right)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j + k;
                if (board[index] === currentPlayer) {
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

    // Check diagonals (top-right to bottom-left)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = boardSize - 1; j >= winningLength - 1; j--) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j - k;
                if (board[index] === currentPlayer) {
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

// Reset game
function resetGame() {
    initGame();
}

// Handle board size change
function handleBoardSizeChange() {
    boardSize = parseInt(boardSizeSelector.value);
    initGame();
}

// Event listeners
boardElement.addEventListener('click', handleCellClick);
resetBtn.addEventListener('click', resetGame);
boardSizeSelector.addEventListener('change', handleBoardSizeChange);
document.getElementById('backBtn')?.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Start the game
initGame();