# Tic Tac Toe

A modern, self-contained browser Tic Tac Toe game with both local multiplayer and single-player (AI) modes. The project is lightweight (no build step or external dependencies) and responsive, designed to run by opening `index.html` in any recent web browser.

## Key Features

- Clean main menu with a mobile-friendly responsive layout
- Two play modes: local Human vs Human and Human vs AI
- Board sizes: 3x3, 4x4, 5x5, and 6x6 (see notes on AI below)
- Adaptive winning rules: variable "in-a-row" length depending on board size
- Three AI difficulty settings: Easy (random), Medium (mixed), Hard (minimax)
- Controls: reset game and back-to-menu navigation on every game screen

## Quick Start

1. Open `index.html` in your browser.
2. Choose a mode: Human vs Human or Human vs AI.
3. (Human vs Human) Select board size from the dropdown (3–6).
4. (Human vs AI) Select difficulty (Easy, Medium, Hard) then play.
5. Use the `Reset Game` button to restart and `Back to Menu` to return.

## Board Sizes & Winning Rules

- 3x3 → 3 in a row to win
- 4x4 → 4 in a row to win
- 5x5 → 4 in a row to win
- 6x6 → 5 in a row to win

Note: the Human vs AI HTML/UI does not include a board-size selector and the AI script defaults to a 3x3 board (`ai-game-script.js` currently sets `boardSize = 3`). The AI logic includes safeguards to limit recursion depth on larger boards, but the default AI mode is best experienced on 3x3.

## AI Behaviour

- Easy: picks a random available move.
- Medium: mixes random and minimax choices (roughly 50/50), so it is challenging but not perfect.
- Hard: uses a minimax implementation with a depth cap to choose optimal moves; on small boards this is effectively unbeatable, but performance may be limited on larger boards.

## Files

- `index.html` — Main menu and navigation
- `human-vs-human.html` — Local two-player game UI
- `human-vs-ai.html` — Single-player UI (difficulty controls)
- `styles.css` — Styling for menu and game screens
- `script.js` — Main menu interactions and navigation
- `game-script.js` — Human vs Human game logic (board rendering, win/draw logic, board-size selector)
- `ai-game-script.js` — Human vs AI logic (minimax, difficulty modes, AI move handling)

## Notes for Developers

- The win/draw logic is implemented to support variable board sizes and an adjustable `winningLength` derived from the selected `boardSize`.
- `ai-game-script.js` contains a `minimax` function with a depth guard (returns a neutral score when depth > 10) to prevent excessive recursion on larger boards.
- The `ai-game-script.js` sets `boardSize = 3` by default; to enable AI on larger boards you can add a selector to the AI UI and wire it to the script (see `game-script.js` for a reference implementation).

## Live Demo

The game has been hosted at: http://tictactoe.parkerbrown.photos

## Browser Support

Works in modern browsers (Chrome, Firefox, Safari, Edge). No build tools are required — open `index.html` directly.

## Customization

- Visual tweaks: edit `styles.css`.
- Gameplay rules or board sizes: edit `game-script.js` and `ai-game-script.js`.
- Add features like score tracking or online multiplayer by extending the JavaScript logic and adding persistent storage or networking.

## Contributing

Contributions are welcome. Please open issues or pull requests with clear descriptions of changes.

---
_Minimal, dependency-free project intended for learning and quick demos._