# Tic Tac Toe

A modern, self-contained browser Tic Tac Toe game with local multiplayer, single-player AI, and an online multiplayer mode backed by Cloudflare Workers. The project is lightweight, with no build step or external dependencies for the local modes, and it can run as a static site or behind Wrangler for online play.

## Key Features

- Clean main menu with a mobile-friendly responsive layout
- Three play modes: local Human vs Human, Human vs AI, and Online Multiplayer
- Board sizes: 3x3, 4x4, 5x5, and 6x6 (see notes on AI below)
- Adaptive winning rules with variable "in-a-row" lengths based on board size
- Three AI difficulty settings: Easy (random), Medium (mixed), and Hard (minimax)
- Controls for resetting the game and returning to the menu on every game screen

## Quick Start

1. Open `index.html` in your browser.
2. Choose a mode: Human vs Human or Human vs AI.
3. In Human vs Human, select a board size from the dropdown (3-6).
4. In Human vs AI, select a difficulty level (Easy, Medium, Hard) and play.
5. Use `Reset Game` to restart and `Back to Menu` to return.
6. In Online Multiplayer, enter a unique username, invite a player from the live list, or generate a code that someone else can use to join your room.

## Board Sizes & Winning Rules

- 3x3 -> 3 in a row to win
- 4x4 -> 4 in a row to win
- 5x5 -> 4 in a row to win
- 6x6 -> 5 in a row to win

Note: the Human vs AI HTML/UI does not include a board-size selector, and the AI script defaults to a 3x3 board (`ai-game-script.js` currently sets `boardSize = 3`). The AI logic includes safeguards to limit recursion depth on larger boards, but the default AI mode is best experienced on 3x3.

## AI Behaviour

- Easy: picks a random available move.
- Medium: mixes random and minimax choices, roughly 50/50, so it is challenging but not perfect.
- Hard: uses a minimax implementation with a depth cap to choose optimal moves; on small boards this is effectively unbeatable, but performance may be limited on larger boards.

## Files

- `index.html` - Main menu and navigation
- `human-vs-human.html` - Local two-player game UI
- `human-vs-ai.html` - Single-player UI with difficulty controls
- `online-multiplayer.html` - Online lobby for usernames, invites, and room codes
- `online-game.html` - Online match board view
- `styles.css` - Styling for menu and game screens
- `script.js` - Main menu interactions and navigation
- `game-script.js` - Human vs Human game logic, including board rendering, win/draw logic, and the board-size selector
- `ai-game-script.js` - Human vs AI logic, including minimax, difficulty modes, and AI move handling
- `online-multiplayer-script.js` - Lobby registration, presence polling, invite flow, and room-code creation/joining
- `online-game-script.js` - Online match rendering and turn submission
- `worker.js` - Cloudflare Worker and Durable Object lobby/game state handler

## Notes for Developers

- The win/draw logic supports variable board sizes and uses an adjustable `winningLength` derived from the selected `boardSize`.
- `ai-game-script.js` contains a `minimax` function with a depth guard that returns a neutral score when depth > 10 to prevent excessive recursion on larger boards.
- `ai-game-script.js` sets `boardSize = 3` by default. To enable AI on larger boards, add a selector to the AI UI and wire it to the script, using `game-script.js` as a reference implementation.

## Live Demo

The game is currently hosted at: http://tictactoe.parkerbrown.photos

## Browser Support

Works in modern browsers, including Chrome, Firefox, Safari, and Edge. No build tools are required; open `index.html` directly.

## Customization

- Visual tweaks: edit `styles.css`.
- Gameplay rules or board sizes: edit `game-script.js` and `ai-game-script.js`.
- Add features like score tracking or online multiplayer by extending the JavaScript logic and adding persistent storage or networking.
- Online multiplayer now uses a Cloudflare Durable Object binding named `LOBBY` and the static asset bundle is served through `worker.js` when running under Wrangler.

## Online Multiplayer Notes

- Username values must be unique among currently connected players.
- Clicking a player in the live lobby creates a pending invite.
- Generating a code creates a one-time private room.
- The online match board currently uses the same board-size rules as the local Human vs Human mode.
- For local development and deployment, use Wrangler so the Worker and Durable Object bindings are available.

## Contributing

Contributions are welcome. Please open issues or pull requests with clear descriptions of changes.

---
_Minimal, dependency-free project intended for learning and quick demos._
