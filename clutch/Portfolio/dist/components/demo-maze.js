// Maze generator + solver
// DFS backtracking gen, arrow/WASD to navigate from top-left to bottom-right
function MazeGame({
  accent,
  theme
}) {
  const [size, setSize] = React.useState(12);
  const [seed, setSeed] = React.useState(1);
  const [grid, setGrid] = React.useState(null);
  const [player, setPlayer] = React.useState({
    x: 0,
    y: 0
  });
  const [visited, setVisited] = React.useState({});
  const [won, setWon] = React.useState(false);
  const [moves, setMoves] = React.useState(0);
  const [showSolve, setShowSolve] = React.useState(false);
  const [solution, setSolution] = React.useState([]);

  // generate
  React.useEffect(() => {
    const cells = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        row.push({
          x,
          y,
          walls: {
            n: true,
            e: true,
            s: true,
            w: true
          },
          visited: false
        });
      }
      cells.push(row);
    }
    // dfs
    const stack = [cells[0][0]];
    cells[0][0].visited = true;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const neighbors = [];
      const {
        x,
        y
      } = cur;
      if (y > 0 && !cells[y - 1][x].visited) neighbors.push(['n', cells[y - 1][x]]);
      if (x < size - 1 && !cells[y][x + 1].visited) neighbors.push(['e', cells[y][x + 1]]);
      if (y < size - 1 && !cells[y + 1][x].visited) neighbors.push(['s', cells[y + 1][x]]);
      if (x > 0 && !cells[y][x - 1].visited) neighbors.push(['w', cells[y][x - 1]]);
      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }
      const [dir, next] = neighbors[Math.floor(Math.random() * neighbors.length)];
      cur.walls[dir] = false;
      const opp = {
        n: 's',
        e: 'w',
        s: 'n',
        w: 'e'
      };
      next.walls[opp[dir]] = false;
      next.visited = true;
      stack.push(next);
    }
    setGrid(cells);
    setPlayer({
      x: 0,
      y: 0
    });
    setVisited({
      '0,0': true
    });
    setMoves(0);
    setWon(false);
    setShowSolve(false);
    setSolution([]);
  }, [size, seed]);

  // keyboard
  React.useEffect(() => {
    if (!grid) return;
    const onKey = e => {
      const k = e.key.toLowerCase();
      const moves = {
        arrowup: 'n',
        w: 'n',
        arrowright: 'e',
        d: 'e',
        arrowdown: 's',
        s: 's',
        arrowleft: 'w',
        a: 'w'
      };
      const dir = moves[k];
      if (!dir) return;
      e.preventDefault();
      movePlayer(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, player, won]);
  const movePlayer = dir => {
    if (won || !grid) return;
    const cell = grid[player.y][player.x];
    if (cell.walls[dir]) return;
    const d = {
      n: [0, -1],
      e: [1, 0],
      s: [0, 1],
      w: [-1, 0]
    }[dir];
    const np = {
      x: player.x + d[0],
      y: player.y + d[1]
    };
    setPlayer(np);
    setVisited(v => ({
      ...v,
      [`${np.x},${np.y}`]: true
    }));
    setMoves(m => m + 1);
    if (np.x === size - 1 && np.y === size - 1) setWon(true);
  };

  // BFS solve
  const solve = () => {
    if (!grid) return;
    const q = [{
      x: 0,
      y: 0,
      path: []
    }];
    const seen = new Set(['0,0']);
    while (q.length) {
      const cur = q.shift();
      if (cur.x === size - 1 && cur.y === size - 1) {
        setSolution([...cur.path, {
          x: cur.x,
          y: cur.y
        }]);
        setShowSolve(true);
        return;
      }
      const cell = grid[cur.y][cur.x];
      const dirs = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
      for (const [d, dx, dy] of dirs) {
        if (cell.walls[d]) continue;
        const nx = cur.x + dx,
          ny = cur.y + dy;
        const k = `${nx},${ny}`;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({
          x: nx,
          y: ny,
          path: [...cur.path, {
            x: cur.x,
            y: cur.y
          }]
        });
      }
    }
  };
  if (!grid) return null;
  const cell = 22;
  const W = size * cell + 2;
  const H = size * cell + 2;
  const fg = theme === 'dark' ? '#ebe4d7' : '#1a1814';
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-body maze",
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("div", {
    className: "demo-hud"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "MOVES"), /*#__PURE__*/React.createElement("span", {
    className: "mono num"
  }, String(moves).padStart(3, '0'))), /*#__PURE__*/React.createElement("div", {
    className: "hud-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono tiny dim"
  }, "SIZE"), /*#__PURE__*/React.createElement("select", {
    className: "hud-select mono",
    value: size,
    onChange: e => setSize(Number(e.target.value))
  }, /*#__PURE__*/React.createElement("option", {
    value: 8
  }, "8\xD78"), /*#__PURE__*/React.createElement("option", {
    value: 12
  }, "12\xD712"), /*#__PURE__*/React.createElement("option", {
    value: 16
  }, "16\xD716"), /*#__PURE__*/React.createElement("option", {
    value: 20
  }, "20\xD720"))), /*#__PURE__*/React.createElement("div", {
    className: "hud-group right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "hud-btn",
    onClick: () => setSeed(s => s + 1)
  }, "NEW MAZE"), /*#__PURE__*/React.createElement("button", {
    className: "hud-btn",
    onClick: solve
  }, "SOLVE"))), /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    style: {
      maxWidth: '100%'
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: 0,
    y: 0,
    width: W,
    height: H,
    fill: "transparent"
  }), Object.keys(visited).map(k => {
    const [x, y] = k.split(',').map(Number);
    return /*#__PURE__*/React.createElement("rect", {
      key: k,
      x: 1 + x * cell,
      y: 1 + y * cell,
      width: cell,
      height: cell,
      fill: accent,
      opacity: 0.08
    });
  }), showSolve && solution.map((p, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: 1 + p.x * cell + cell / 2,
    cy: 1 + p.y * cell + cell / 2,
    r: 3,
    fill: accent,
    opacity: 0.5
  })), grid.flat().map(c => {
    const x = 1 + c.x * cell,
      y = 1 + c.y * cell;
    return /*#__PURE__*/React.createElement("g", {
      key: `${c.x}-${c.y}`
    }, c.walls.n && /*#__PURE__*/React.createElement("line", {
      x1: x,
      y1: y,
      x2: x + cell,
      y2: y,
      stroke: fg,
      strokeWidth: 1.5
    }), c.walls.e && /*#__PURE__*/React.createElement("line", {
      x1: x + cell,
      y1: y,
      x2: x + cell,
      y2: y + cell,
      stroke: fg,
      strokeWidth: 1.5
    }), c.walls.s && /*#__PURE__*/React.createElement("line", {
      x1: x,
      y1: y + cell,
      x2: x + cell,
      y2: y + cell,
      stroke: fg,
      strokeWidth: 1.5
    }), c.walls.w && /*#__PURE__*/React.createElement("line", {
      x1: x,
      y1: y,
      x2: x,
      y2: y + cell,
      stroke: fg,
      strokeWidth: 1.5
    }));
  }), /*#__PURE__*/React.createElement("rect", {
    x: 1 + (size - 1) * cell + 4,
    y: 1 + (size - 1) * cell + 4,
    width: cell - 8,
    height: cell - 8,
    fill: accent
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 1 + player.x * cell + cell / 2,
    cy: 1 + player.y * cell + cell / 2,
    r: cell / 2 - 4,
    fill: fg,
    style: {
      transition: 'cx .12s, cy .12s'
    }
  }), won && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: 0,
    y: H / 2 - 20,
    width: W,
    height: 40,
    fill: "rgba(0,0,0,0.55)"
  }), /*#__PURE__*/React.createElement("text", {
    x: W / 2,
    y: H / 2 + 5,
    textAnchor: "middle",
    fill: accent,
    style: {
      font: '600 18px "Instrument Serif", serif'
    }
  }, "SOLVED \xB7 ", moves, " moves"))), /*#__PURE__*/React.createElement("div", {
    className: "demo-foot mono tiny dim"
  }, "arrow keys or WASD \xB7 click maze first to focus"));
}
window.MazeGame = MazeGame;