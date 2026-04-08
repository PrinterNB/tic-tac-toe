// Game state
let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let isAITurn = false;
let difficulty = 'hard';

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
const difficultyButtons = document.querySelectorAll('.difficulty-btn');

// Initialize game
function initGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    isAITurn = false;
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
    
    if (isAITurn) {
        statusElement.textContent = "AI is thinking... 🤔";
    } else {
        statusElement.textContent = `Player ${currentPlayer}'s turn`;
    }
}

// Handle cell click
function handleCellClick(event) {
    // Only process clicks on actual cells, not on whitespace
    if (!event.target.classList.contains('cell')) {
        return;
    }
    
    const cell = event.target;
    const index = parseInt(cell.getAttribute('data-index'));

    if (board[index] || !gameActive || isAITurn) {
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
    
    // If it's AI's turn, make AI move
    if (currentPlayer === 'O' && gameActive) {
        isAITurn = true;
        updateStatus();
        setTimeout(makeAIMove, 500); // Small delay for better UX
    } else {
        updateStatus();
    }
}

// Check for winner
function checkWinner() {
    return winningCombinations.some(combination => {
        return combination.every(index => {
            return board[index] === currentPlayer;
        });
    });
}

// Minimax algorithm for AI
function minimax(newBoard, player) {
    // Check for terminal states
    const winner = checkWinnerForBoard(newBoard);
    if (winner === 'O') {
        return { score: 10 };
    } else if (winner === 'X') {
        return { score: -10 };
    } else if (newBoard.every(cell => cell !== '')) {
        return { score: 0 };
    }

    // Collect all available moves
    const moves = [];
    for (let i = 0; i < newBoard.length; i++) {
        if (newBoard[i] === '') {
            const move = {};
            move.index = i;
            newBoard[i] = player;
            
            const result = minimax(newBoard, player === 'X' ? 'O' : 'X');
            move.score = result.score;
            
            newBoard[i] = '';
            moves.push(move);
        }
    }

    // Choose the best move
    let bestMove;
    if (player === 'O') {
        let bestScore = -Infinity;
        for (let i = 0; i < moves.length; i++) {
            if (moves[i].score > bestScore) {
                bestScore = moves[i].score;
                bestMove = i;
            }
        }
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < moves.length; i++) {
            if (moves[i].score < bestScore) {
                bestScore = moves[i].score;
                bestMove = i;
            }
        }
    }
    
    return moves[bestMove];
}

// Check winner for minimax function
function checkWinnerForBoard(boardState) {
    for (let i = 0; i < winningCombinations.length; i++) {
        const [a, b, c] = winningCombinations[i];
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            return boardState[a];
        }
    }
    return null;
}

// Make AI move
function makeAIMove() {
    if (!gameActive || !isAITurn) return;
    
    let moveIndex;
    
    // Different difficulty levels
    if (difficulty === 'easy') {
        // Easy: Random move
        const availableMoves = board.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
        moveIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else if (difficulty === 'medium') {
        // Medium: 50% chance of making a smart move, 50% random
        if (Math.random() > 0.5) {
            const result = minimax(board, 'O');
            moveIndex = result.index;
        } else {
            const availableMoves = board.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
            moveIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
    } else {
        // Hard: Always make the best move using minimax
        const result = minimax(board, 'O');
        moveIndex = result.index;
    }
    
    // Make the move
    board[moveIndex] = 'O';
    const cells = document.querySelectorAll('.cell');
    cells[moveIndex].textContent = 'O';
    cells[moveIndex].classList.add('taken');
    cells[moveIndex].classList.add('o');
    
    // Check for winner
    currentPlayer = 'O';
    if (checkWinner()) {
        gameActive = false;
        statusElement.textContent = "AI wins! 🤖";
        isAITurn = false;
        return;
    }
    
    // Check for draw
    if (board.every(cell => cell !== '')) {
        gameActive = false;
        statusElement.textContent = "It's a draw! 🤝";
        isAITurn = false;
        return;
    }
    
    // Switch back to player
    currentPlayer = 'X';
    isAITurn = false;
    updateStatus();
}

// Reset game
function resetGame() {
    initGame();
}

// Handle difficulty change
function handleDifficultyChange(newDifficulty) {
    difficulty = newDifficulty;
    resetGame();
}

// Set up difficulty buttons
difficultyButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        difficultyButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');
        // Handle difficulty change
        handleDifficultyChange(button.dataset.difficulty);
    });
});

// Initialize active button
difficultyButtons.forEach(button => {
    if (button.dataset.difficulty === 'hard') {
        button.classList.add('active');
    }
});

// Event listeners
boardElement.addEventListener('click', handleCellClick);
resetBtn.addEventListener('click', resetGame);
document.getElementById('backBtn')?.addEventListener('click', function() {
    window.location.href = 'index.html';
});

// Start the game
initGame();