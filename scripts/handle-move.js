// Connect Four on a GitHub profile README.
// No dependencies. Node 18+.
//
// Issue title format:
//   c4|move|<column 1-7>|<gameId>
//   c4|new|<gameId>
// With no ISSUE_TITLE the script only re-renders the README (workflow_dispatch).

const fs = require('fs');
const path = require('path');

const ROWS = 6;
const COLS = 7;
const repo = process.env.GITHUB_REPOSITORY || 'vladglass0/vladglass0';
const title = (process.env.ISSUE_TITLE || '').trim();
const author = (process.env.ISSUE_AUTHOR || '').trim();

const STATE_FILE = 'game/state.json';
const README_FILE = 'README.md';
const COMMENT_FILE = process.env.COMMENT_FILE || 'comment.md';

const START = '<!-- GAME:START -->';
const END = '<!-- GAME:END -->';
const EMOJI = { R: '🔴', Y: '🟡', _: '⚪' };

function newId() {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function newGame() {
  return {
    id: newId(),
    board: Array.from({ length: ROWS }, () => Array(COLS).fill('_')),
    turn: 'R',
    status: 'playing', // playing | won | draw
    winner: null,
    history: [], // last moves of this game
  };
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { game: newGame(), wins: { R: 0, Y: 0 }, draws: 0, players: {} };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function isWin(board, r, c, p) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === p) {
        count++;
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function issueUrl(t) {
  const body = "Just press 'Submit new issue'. You don't need to do anything else.";
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(t)}&body=${encodeURIComponent(body)}`;
}

function render(state) {
  const g = state.game;
  const playing = g.status === 'playing';

  let statusLine;
  if (g.status === 'won') {
    statusLine = `**Game over. ${EMOJI[g.winner]} wins!** [Start a new game](${issueUrl(`c4|new|${g.id}`)})`;
  } else if (g.status === 'draw') {
    statusLine = `**Game over. It's a draw.** [Start a new game](${issueUrl(`c4|new|${g.id}`)})`;
  } else {
    statusLine = `**Game in progress.** It's ${EMOJI[g.turn]}'s turn. Anyone can play the next move, just pick a column below.`;
  }

  const header = [];
  for (let c = 0; c < COLS; c++) {
    const full = g.board[0][c] !== '_';
    if (playing && !full) {
      header.push(`[**${c + 1}**](${issueUrl(`c4|move|${c + 1}|${g.id}`)})`);
    } else {
      header.push(`${c + 1}`);
    }
  }

  const lines = [];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${Array(COLS).fill(':-:').join(' | ')} |`);
  for (let r = 0; r < ROWS; r++) {
    lines.push(`| ${g.board[r].map((x) => EMOJI[x]).join(' | ')} |`);
  }

  const recent = g.history.slice(-5).reverse();
  const recentTable = recent.length
    ? ['| Move | Who |', '| --- | --- |']
        .concat(recent.map((m) => `| ${EMOJI[m.color]} column ${m.col + 1} | [@${m.by}](https://github.com/${m.by}) |`))
        .join('\n')
    : '_No moves yet._';

  const top = Object.entries(state.players)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topTable = top.length
    ? ['| Moves | Who |', '| --- | --- |']
        .concat(top.map(([u, n]) => `| ${n} | [@${u}](https://github.com/${u}) |`))
        .join('\n')
    : '_Nobody yet. Be the first!_';

  return [
    START,
    '## Community Connect Four',
    '',
    statusLine,
    '',
    lines.join('\n'),
    '',
    `Score: 🔴 ${state.wins.R} · 🟡 ${state.wins.Y} · draws ${state.draws}`,
    '',
    '<details>',
    '<summary>How this works</summary>',
    '',
    `Clicking a column opens a pre-filled GitHub Issue. Press "Submit new issue", and a GitHub Actions workflow plays the move and updates this README.`,
    '',
    '</details>',
    '',
    '**Last moves**',
    '',
    recentTable,
    '',
    '**Top players**',
    '',
    topTable,
    END,
  ].join('\n');
}

function writeReadme(block) {
  let readme = fs.existsSync(README_FILE) ? fs.readFileSync(README_FILE, 'utf8') : '';
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (re.test(readme)) {
    readme = readme.replace(re, () => block);
  } else {
    // No markers (Expressive Profile rewrote the README): insert after the hero banner, else after the first line.
    const idx = readme.indexOf('\n', Math.max(readme.indexOf('</picture>'), 0));
    if (idx === -1) {
      readme = readme + '\n\n' + block + '\n';
    } else {
      readme = readme.slice(0, idx + 1) + '\n' + block + '\n' + readme.slice(idx + 1);
    }
  }
  fs.writeFileSync(README_FILE, readme);
}

function comment(text) {
  fs.writeFileSync(COMMENT_FILE, text + '\n');
}

function main() {
  const state = loadState();

  if (!title) {
    // Render only.
    saveState(state);
    writeReadme(render(state));
    comment('Rendered.');
    return;
  }

  const parts = title.split('|');
  if (parts[0] !== 'c4') {
    comment('❌ Not a game issue.');
    return;
  }
  const action = parts[1];
  const g = state.game;

  if (action === 'new') {
    const id = parts[2];
    if (g.status === 'playing') {
      comment('❌ The current game is still in progress.');
      return;
    }
    if (id !== g.id) {
      comment('❌ This link is outdated. A new game was already started.');
      return;
    }
    state.game = newGame();
    saveState(state);
    writeReadme(render(state));
    comment(`✅ New game started by @${author}. Have fun!`);
    return;
  }

  if (action === 'move') {
    const col = Number(parts[2]) - 1;
    const id = parts[3];
    if (!Number.isInteger(col) || col < 0 || col >= COLS) {
      comment('❌ Invalid column.');
      return;
    }
    if (id !== g.id) {
      comment('❌ This link is outdated. Someone already moved. Please use the links in the README.');
      return;
    }
    if (g.status !== 'playing') {
      comment('❌ The game is over. Start a new one from the README.');
      return;
    }

    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (g.board[r][col] === '_') {
        row = r;
        break;
      }
    }
    if (row === -1) {
      comment('❌ That column is full.');
      return;
    }

    const color = g.turn;
    g.board[row][col] = color;
    g.history.push({ col, by: author, color });
    if (g.history.length > 20) g.history = g.history.slice(-20);
    state.players[author] = (state.players[author] || 0) + 1;

    if (isWin(g.board, row, col, color)) {
      g.status = 'won';
      g.winner = color;
      state.wins[color] += 1;
    } else if (g.board[0].every((x) => x !== '_')) {
      g.status = 'draw';
      state.draws += 1;
    } else {
      g.turn = color === 'R' ? 'Y' : 'R';
    }

    // The game id changes on every move, so old links stop working.
    g.id = newId();

    saveState(state);
    writeReadme(render(state));
    comment(`✅ Move accepted: ${EMOJI[color]} column ${col + 1}. Thanks @${author}!`);
    return;
  }

  comment('❌ Unknown action.');
}

main();
