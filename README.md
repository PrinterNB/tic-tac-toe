# Tic Tac Toe Menu System

A complete, self-contained tic-tac-toe menu system with both human vs human and human vs AI game modes, featuring responsive design, difficulty levels (Easy, Medium, Hard), and intuitive navigation with back buttons to return to the main menu.

## Features

- **Main Menu**: Clean, modern interface with gradient background and glass-morphism container
- **Game Modes**:
  - Human vs Human: Two-player local gameplay
  - Human vs AI: Play against computer with three difficulty levels (Easy, Medium, Hard)
- **Navigation**: Back buttons on all game screens to return to the main menu
- **Responsive Design**: Works on mobile and desktop devices
- **Visual Enhancements**: 
  - White rectangle with curved edges (glass-morphism effect)
  - Smooth animations and hover effects
  - Color-coded X and O symbols

## AI Difficulty Levels

The Human vs AI game mode features three distinct difficulty levels:

- **Easy Mode**: The AI makes random moves, providing a good starting challenge for beginners. It will occasionally make suboptimal moves to give the player a chance to win.

- **Medium Mode**: The AI uses a combination of strategies, making it more challenging than Easy mode. It will block winning moves by the player and attempt to create its own winning opportunities, but may still make occasional mistakes.

- **Hard Mode**: The AI implements the minimax algorithm to make optimal moves, making it extremely challenging. It will never lose and will always either win or force a draw against a human player.

## Files Included

- `index.html`: Main menu screen
- `human-vs-human.html`: Human vs Human game screen
- `human-vs-ai.html`: Human vs AI game screen
- `styles.css`: All styling for the application
- `script.js`: Main menu JavaScript functionality
- `game-script.js`: Human vs Human game logic
- `ai-game-script.js`: Human vs AI game logic

## How to Use

1. Open `index.html` in any modern web browser
2. Select either "Human vs Human" or "Human vs AI" to start a game
3. Play the game and use the "Back to Menu" button to return to the main screen at any time
4. For AI games, select difficulty level before starting

## Live Version

The game is currently hosted and accessible at: [tictactoe.parkerbrown.photos](http://tictactoe.parkerbrown.photos)

## Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- No external dependencies - all files are self-contained

## Customization

The application can be easily customized by modifying:
- `styles.css` for visual changes
- Game logic in `game-script.js` and `ai-game-script.js`
- Menu options in `index.html`