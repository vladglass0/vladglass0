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

// Material 3 colours taken from the Expressive Profile cards (seed #B36CFF), plus red/yellow pieces in the same tones.
const THEMES = {
  light: {
    bg: '#fbf0ff', tile: '#efe5f3', hole: '#eadfed', text: '#1f1924', sub: '#4c4452',
    primary: '#8700ec', onPrimary: '#ffffff',
    R: '#ba1a1a', onR: '#ffffff', Y: '#f2b705', onY: '#3d2e00',
  },
  dark: {
    bg: '#1f1924', tile: '#2d2832', hole: '#38323d', text: '#eadfed', sub: '#cec2d4',
    primary: '#dcb8ff', onPrimary: '#480082',
    R: '#ff8a80', onR: '#690005', Y: '#ffd65c', onY: '#3d2e00',
  },
};
const NAME = { R: 'Red', Y: 'Yellow' };
const ASSETS = 'game/assets';
const W = 840;
const CELL = W / COLS; // column buttons above the board use the same width, so they line up
const PITCH = 100;
const TOP = 120;

// Reuse the Expressive Profile font so the board matches the other cards; falls back to system fonts.
function profileFont() {
  try {
    return fs.readFileSync('assets/hero-light.svg', 'utf8').match(/@font-face\{[^}]*\}/)[0];
  } catch {
    return '';
  }
}

function svg(w, h, label, body, font = '') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>` +
    `<style>${font}text{font-family:G,'Google Sans','Segoe UI',Roboto,sans-serif;font-variation-settings:'ROND' 100}` +
    `.up{animation:up .8s cubic-bezier(.05,.7,.1,1) both}` +
    `.pop{transform-box:fill-box;transform-origin:center;animation:pop .6s cubic-bezier(.34,1.56,.64,1) .3s both}` +
    `@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}` +
    `@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}` +
    `@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>${body}</svg>\n`
  );
}

function boardSvg(state, t, font) {
  const g = state.game;
  let status;
  if (g.status === 'won') status = `${NAME[g.winner]} wins! Start a new game above.`;
  else if (g.status === 'draw') status = `It's a draw. Start a new game above.`;
  else status = `${NAME[g.turn]}'s turn. Anyone can play, pick a column above.`;

  // Score chips, right-aligned in the header.
  const chips = [
    [`<circle cx="22" cy="20" r="8" fill="${t.R}"/>`, state.wins.R, 80],
    [`<circle cx="22" cy="20" r="8" fill="${t.Y}"/>`, state.wins.Y, 80],
    [`<text x="16" y="26" fill="${t.sub}" style="font-size:15px;font-weight:500">Draws</text>`, state.draws, 104],
  ];
  let x = W - 32 - chips.reduce((s, c) => s + c[2] + 8, -8);
  let header = '';
  for (const [icon, n, w] of chips) {
    header += `<g transform="translate(${x} 34)"><rect width="${w}" height="40" rx="20" fill="${t.tile}"/>${icon}<text x="${w - 18}" y="27" fill="${t.text}" text-anchor="end" style="font-size:18px;font-weight:700">${n}</text></g>`;
    x += w + 8;
  }

  const last = g.history[g.history.length - 1];
  const lastRow = last ? g.board.findIndex((row) => row[last.col] !== '_') : -1;
  let cells = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = CELL * c + CELL / 2;
      const cy = TOP + 12 + PITCH * r + PITCH / 2;
      const p = g.board[r][c];
      if (p === '_') {
        cells += `<circle cx="${cx}" cy="${cy}" r="40" fill="${t.hole}"/>`;
      } else if (last && r === lastRow && c === last.col) {
        cells += `<g class="pop"><circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="${t.primary}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="36" fill="${t[p]}"/></g>`;
      } else {
        cells += `<circle cx="${cx}" cy="${cy}" r="40" fill="${t[p]}"/>`;
      }
    }
  }

  const h = TOP + PITCH * ROWS + 24 + 16;
  return svg(
    W,
    h,
    `Connect Four. ${status}`,
    `<rect width="${W}" height="${h}" rx="32" fill="${t.bg}"/>` +
      `<text x="32" y="54" fill="${t.text}" class="up" style="font-size:24px;font-weight:600">Community Connect Four</text>` +
      `<text x="32" y="84" fill="${t.sub}" class="up" style="font-size:15px;font-weight:500;animation-delay:.1s">${status}</text>` +
      header +
      `<g class="up" style="animation-delay:.15s"><rect x="8" y="${TOP}" width="${W - 16}" height="${PITCH * ROWS + 24}" rx="28" fill="${t.tile}"/>${cells}</g>`,
    font,
  );
}

// One column button: a pill in the colour of the player to move, or a muted one when the column can't be played.
function columnSvg(t, color) {
  const fill = color ? t[color] : t.tile;
  const ink = color ? t[`on${color}`] : t.sub;
  const cx = CELL / 2;
  return svg(
    CELL,
    64,
    color ? 'Drop a piece here' : 'Column unavailable',
    `<rect x="12" y="8" width="${CELL - 24}" height="48" rx="24" fill="${fill}"${color ? '' : ' opacity=".6"'}/>` +
      `<path d="M${cx} 21v20m-8-8l8 8l8-8" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"${color ? '' : ' opacity=".5"'}/>`,
  );
}

function newGameSvg(t, font) {
  return svg(
    240,
    56,
    'Start a new game',
    `<g class="pop"><rect width="240" height="56" rx="28" fill="${t.primary}"/><path d="M40 28h16m-8-8v16" stroke="${t.onPrimary}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<text x="72" y="34" fill="${t.onPrimary}" style="font-size:17px;font-weight:600">Start a new game</text></g>`,
    font,
  );
}

function writeAssets(state) {
  const g = state.game;
  const font = profileFont();
  fs.mkdirSync(ASSETS, { recursive: true });
  for (const [mode, t] of Object.entries(THEMES)) {
    fs.writeFileSync(`${ASSETS}/board-${mode}.svg`, boardSvg(state, t, font));
    fs.writeFileSync(`${ASSETS}/new-game-${mode}.svg`, newGameSvg(t, font));
    for (let c = 0; c < COLS; c++) {
      const open = g.status === 'playing' && g.board[0][c] === '_';
      fs.writeFileSync(`${ASSETS}/col-${c + 1}-${mode}.svg`, columnSvg(t, open && g.turn));
    }
  }
}

function picture(name, width, alt) {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${ASSETS}/${name}-dark.svg"><img src="${ASSETS}/${name}-light.svg" width="${width}" alt="${alt}"></picture>`;
}

function render(state) {
  const g = state.game;
  writeAssets(state);

  // No whitespace between the buttons, so the 7 images sit exactly over the 7 board columns.
  let controls;
  if (g.status === 'playing') {
    controls = Array.from({ length: COLS }, (_, c) => {
      const pic = picture(`col-${c + 1}`, '14.285%', `Column ${c + 1}`);
      return g.board[0][c] === '_' ? `<a href="${issueUrl(`c4|move|${c + 1}|${g.id}`)}">${pic}</a>` : pic;
    }).join('');
  } else {
    controls = `<a href="${issueUrl(`c4|new|${g.id}`)}">${picture('new-game', 'auto', 'Start a new game')}</a>`;
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
    controls,
    '',
    picture('board', '100%', 'Connect Four board'),
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
