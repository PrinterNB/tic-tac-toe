// Game state
let board = [];
let currentPlayer = 'X';
let gameActive = true;
let isAITurn = false;
let difficulty = 'hard';
let boardSize = 3;  // Fixed to 3x3 for AI mode only
let winningLength = 3;

// DOM elements
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');

// Initialize game
function initGame() {
    // Reset board based on selected size
    board = Array(boardSize * boardSize).fill('');
    currentPlayer = 'X';
    gameActive = true;
    isAITurn = false;
    
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
    updateBoardSize();
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
    boardContainer.setAttribute('data-size', boardSize);
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
        } else {
            fontSize = `${Math.max(14, 20 - (boardSize * 1))}px`;
        }
        cell.style.fontSize = fontSize;
    });
    
    // Center the board container
    const boardWidth = boardSize * cellSize + (boardSize - 1) * 5;
    boardContainer.style.maxWidth = `${boardWidth}px`;
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
    
    // If it's AI's turn, make AI move with 0.5 second delay
    if (currentPlayer === 'O' && gameActive) {
        isAITurn = true;
        updateStatus();
        statusElement.textContent = "AI is thinking... 🤔";
        setTimeout(makeAIMoveWithTimeout, 500); // 0.5 second delay
    } else {
        updateStatus();
    }
}

// Check for win
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

// Minimax algorithm for AI
function minimax(newBoard, player, depth = 0) {
    // Prevent excessive recursion depth for large boards
    if (depth > 10) {
        return { score: 0 };
    }
    
    // Check for terminal states
    const winner = checkWinnerForBoard(newBoard);
    if (winner === 'O') {
        return { score: 10 - depth };
    } else if (winner === 'X') {
        return { score: -10 + depth };
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
            
            const result = minimax(newBoard, player === 'X' ? 'O' : 'X', depth + 1);
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
    // Check rows
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = i * boardSize + j + k;
                if (boardState[index] === 'O') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'O';
            }
        }
    }

    // Check columns
    for (let j = 0; j < boardSize; j++) {
        for (let i = 0; i <= boardSize - winningLength; i++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j;
                if (boardState[index] === 'O') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'O';
            }
        }
    }

    // Check diagonals (top-left to bottom-right)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j + k;
                if (boardState[index] === 'O') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'O';
            }
        }
    }

    // Check diagonals (top-right to bottom-left)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = boardSize - 1; j >= winningLength - 1; j--) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j - k;
                if (boardState[index] === 'O') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'O';
            }
        }
    }

    // Check for player win
    // Check rows
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = i * boardSize + j + k;
                if (boardState[index] === 'X') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'X';
            }
        }
    }

    // Check columns
    for (let j = 0; j < boardSize; j++) {
        for (let i = 0; i <= boardSize - winningLength; i++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j;
                if (boardState[index] === 'X') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'X';
            }
        }
    }

    // Check diagonals (top-left to bottom-right)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = 0; j <= boardSize - winningLength; j++) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j + k;
                if (boardState[index] === 'X') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'X';
            }
        }
    }

    // Check diagonals (top-right to bottom-left)
    for (let i = 0; i <= boardSize - winningLength; i++) {
        for (let j = boardSize - 1; j >= winningLength - 1; j--) {
            let count = 0;
            for (let k = 0; k < winningLength; k++) {
                const index = (i + k) * boardSize + j - k;
                if (boardState[index] === 'X') {
                    count++;
                } else {
                    break;
                }
            }
            if (count === winningLength) {
                return 'X';
            }
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
    
    // Check for winner - check if AI (O) has won
    currentPlayer = 'O';
    if (checkWinnerForBoard(board) === 'O') {
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

// Add a timeout to prevent freezing on large boards
function makeAIMoveWithTimeout() {
    setTimeout(makeAIMove, 10);
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