// Game state
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;

// Winning combinations
const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// DOM elements
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// Initialize game
function initGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    updateStatus();
    renderBoard();
}

// Render the board
function renderBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = board[index];
        cell.className = 'cell';
        if (board[index]) {
            cell.classList.add('taken');
            cell.classList.add(board[index].toLowerCase());
        }
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
    return winningCombinations.some(combination => {
        return combination.every(index => {
            return board[index] === currentPlayer;
        });
    });
}

// Reset game
function resetGame() {
    initGame();
}

// Event listeners
boardElement.addEventListener('click', handleCellClick);
resetBtn.addEventListener('click', resetGame);
document.getElementById('backBtn')?.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Start the game
initGame();