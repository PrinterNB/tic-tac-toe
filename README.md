# Tic‑Tac‑Toe

## Overview

test

This is a simple browser‑based Tic‑Tac‑Toe game written in plain HTML, CSS and JavaScript.  The project demonstrates:

* A 3×3 grid rendered with a table.
* Two‑player turn logic.
* Win/draw detection.
* Basic styling and responsive layout.

The code is intentionally lightweight so it can be used as a teaching example or a starting point for more advanced projects.

## Getting Started

1. Clone or download the repository.
2. Open `index.html` in a web browser.

No build step is required – the game runs entirely in the browser.

## Project Structure

```
├─ index.html      # The game board and UI
├─ script.js       # Game logic and event handling
├─ styles.css      # Layout and visual styling
└─ README.md       # This documentation
```

## How It Works

### index.html
The HTML file contains a 3×3 table with `data-row` and `data-col` attributes.  Each cell has a click listener that calls `handleCellClick` from `script.js`.

### script.js
The script keeps track of the current player (`'X'` or `'O'`) and the board state in a 2‑D array.  After each move it:

1. Updates the cell text.
2. Checks for a win or draw.
3. Switches the player.

The win check iterates over rows, columns and diagonals.  If a win is found, an alert is shown and the board is reset.

### styles.css
The CSS uses a simple grid layout with a fixed size for the cells.  The `:hover` pseudo‑class gives a visual cue when a cell is clickable.

## Extending the Project

* **Add AI** – Replace the second player with a simple minimax algorithm.
* **Persist state** – Store the board in `localStorage` to survive page reloads.
* **Add animations** – Use CSS transitions for a smoother experience.

## License

This project is released under the MIT License.

---

Happy coding!