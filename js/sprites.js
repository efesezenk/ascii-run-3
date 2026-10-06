/* ASCII sprites. The first frame of each enemy is the design-sheet pose.
   Later frames move limbs, wings, flames, and canopies. Colors are assigned
   per body part, not per random cell. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ASCIIRun = Object.assign(root.ASCIIRun || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MIRROR = {
    "/": "\\", "\\": "/", "(": ")", ")": "(", "<": ">", ">": "<",
    "[": "]", "]": "[", "{": "}", "}": "{", "`": "'", "'": "`",
  };

  function mirrorLine(line) {
    let out = "";
    for (let i = line.length - 1; i >= 0; i--) {
      const ch = line[i];
      out += MIRROR[ch] || ch;
    }
    return out;
  }

  function padRight(rows, width) {
    return rows.map((row) => row.length >= width ? row : row + " ".repeat(width - row.length));
  }

  const DEGRADE = {
    "#": ["#", "#", "%", "*", ":"],
    "O": ["O", "O", "o", "°", "."],
    "o": ["o", "o", "·", ".", "."],
    "(": ["(", "(", "{", "/", "."],
    ")": [")", ")", "}", "\\", "."],
    "[": ["[", "[", "|", ":", "."],
    "]": ["]", "]", "|", ":", "."],
    "|": ["|", "|", "!", ":", "."],
    "/": ["/", "/", "/", ",", "."],
    "\\": ["\\", "\\", "\\", ",", "."],
    "_": ["_", "_", "~", "-", "."],
    "-": ["-", "-", "~", ".", "."],
    "=": ["=", "=", "~", "-", "."],
    "+": ["+", "+", "x", "*", "."],
    "^": ["^", "^", "`", ".", "."],
    "v": ["v", "v", ".", ".", "."],
    "~": ["~", "~", "-", ".", "."],
    "@": ["@", "@", "o", "·", "."],
    "<": ["<", "<", "(", ".", "."],
    ">": [">", ">", ")", ".", "."],
    ",": [",", ",", ".", ".", "."],
    "'": ["'", "'", ".", ".", "."],
    ".": [".", ".", "·", ".", "."],
    "*": ["*", "*", "+", ".", "."],
    "H": ["H", "H", "I", ":", "."],
  };

  function degrade(ch, ratio) {
    if (ch === " " || ratio <= 0) return ch;
    const seq = DEGRADE[ch] || [ch, ch, "*", "+", "."];
    const i = Math.min(seq.length - 1, Math.floor(ratio * seq.length));
    return seq[i];
  }

  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  /* Five visible stops from the healthy color toward red. */
  function damageColor(base, ratio) {
    if (ratio <= 0) return base;
    const stops = [0, 0.22, 0.42, 0.62, 0.82, 1];
    let t = ratio;
    for (let i = 0; i < stops.length; i++) {
      if (ratio <= stops[i]) {
        t = stops[i];
        break;
      }
    }
    if (ratio > 0 && t === 0) t = stops[1];
    return mixHex(base, "#ff1c1c", t);
  }

  /* Walk sheet. Head and torso stay in one column. Idle is frame 1. */
  const PLAYER_WALK = [
    padFrame(["  @", " /|\\", " / \\"]),
    padFrame(["  @", " /|\\", "  |\\"]),
    padFrame(["  @", " /|\\", " / \\"]),
    padFrame(["  @", " /|\\", " /|"]),
  ];
  const PLAYER_IDLE = PLAYER_WALK[0];
  const PLAYER_JUMP = ["\\@/", "/|\\", "/ \\"];
  const PLAYER_CLIMB = [
    [" @ ", "-|-", "/ \\"],
    [" @ ", "-| ", "/| "],
  ];
  const PLAYER_LUNGE = [" @ ", "/|>", "/ \\"];
  const PLAYER_CROUCH = [" @ ", "/_\\"];
  const PLAYER_DASH = [
    padFrame(["  @>>", " /|\\", " / \\"]),
    padFrame(["  @==", " /|>", " /\\"]),
    padFrame(["  @--", " /|\\", " / \\"]),
  ];
  const PLAYER_SLIDE = [
    padFrame(["  @->", " /_\\"]),
    padFrame(["  @=>", " /_\\"]),
  ];
  const PLAYER_ATTACK = [
    padFrame([" @ ", "/| ", "/ \\"]),
    padFrame(["\\@ ", " |>", "/ \\"]),
    padFrame([" @/", "/| ", " \\/"]),
    padFrame(["\\@ ", "|> ", "/ \\"]),
  ];

  function padFrame(rows) {
    let w = 0;
    for (let i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    return padRight(rows, w);
  }

  /* Ready stance from the swing sheet. The short blade sits in the pose itself. */
  const PLAYER_READY = padFrame([
    "   @   /",
    "  /|\\_/",
    "  / \\",
  ]);

  /* Top-to-bottom arc. Frames 2 through 8. Frame 5 and 6 are the live crescent. */
  const SWORD_SWING = [
    padFrame([
      " \\",
      "  \\@",
      "  +|\\",
      "  / \\",
    ]),
    padFrame([
      "    |  .",
      "   @| '",
      "  /|+",
      "  / \\",
    ]),
    padFrame([
      "      _.-.",
      "   @ /    `.",
      "  /|+       \\",
      "  / \\",
    ]),
    padFrame([
      "      _.--._",
      "   @  ___  `.",
      "  /|+====`.  \\",
      "  / \\      )  )",
      "         .'  /",
    ]),
    padFrame([
      "      _.--._",
      "   @  ___   `.",
      "  /|\\     `.   \\",
      "  / \\+      )   )",
      "      \\   .'   /",
      "       '   _.-'",
    ]),
    padFrame([
      "   @",
      "  /|\\",
      "  / \\+          )",
      "      \\       .'",
      "       '   _.-'",
    ]),
    padFrame([
      "   @",
      "  /|\\",
      "  / \\+",
      "      \\      .",
      "       '  .'",
    ]),
  ];

  /* Overhead slash. The body stays in the ready-stance columns; only the blade and trail move. */
  const SWORD_UP_READY = padFrame([
    "         @   /",
    "        /|\\_/",
    "        / \\",
  ]);
  const SWORD_UP = [
    padFrame([
      "         @",
      "        /|\\_",
      "        / \\  \\",
    ]),
    padFrame([
      "              .",
      "            .'",
      "         @ /",
      "        /|+",
      "        / \\",
    ]),
    padFrame([
      "             .-.",
      "            /   `.",
      "           /      :",
      "         @/",
      "        /|+",
      "        / \\",
    ]),
    padFrame([
      "          _.--._",
      "          |  _. `.",
      "          | '  `. \\",
      "          |      ) :",
      "         @+",
      "        /|\\",
      "        / \\",
    ]),
    padFrame([
      "       _.--''--._",
      "     .'  _.--._  `.",
      "    /  .'      `.  \\",
      "   :  /\\         \\  :",
      "        +@",
      "        /|\\",
      "        / \\",
    ]),
    padFrame([
      "       _.--'",
      "     .'  _.-'",
      "    /  .'",
      "   :  /",
      "        +@",
      "        /|\\",
      "        / \\",
    ]),
    padFrame([
      "     .-'",
      "    / .'",
      "   '",
      "        +@",
      "        /|\\",
      "        / \\",
    ]),
  ];

  /* Same arc as the sword sheet. Only the weapon glyphs change. */
  const AXE_READY = padFrame([
    "   @   ^",
    "  /|\\  |",
    "  / \\",
  ]);
  const AXE_SWING = [
    padFrame([
      " ^",
      "  |@",
      "  +|\\",
      "  / \\",
    ]),
    padFrame([
      "    ^  .",
      "   @| '",
      "  /|+",
      "  / \\",
    ]),
    padFrame([
      "      _.-.",
      "   @ ^    `.",
      "  /|+       \\",
      "  / \\",
    ]),
    padFrame([
      "      _.--._",
      "   @  ___  `.",
      "  /|+--^>`.  \\",
      "  / \\      )  )",
      "         .'  /",
    ]),
    padFrame([
      "      _.--._",
      "   @  ___   `.",
      "  /|\\     `.   \\",
      "  / \\+      )   )",
      "      v   .'   /",
      "       '   _.-'",
    ]),
    padFrame([
      "   @             ",
      "  /|\\            ",
      "  / \\+          )",
      "      v       .' ",
      "       '   _.-'  ",
    ]),
    padFrame([
      "   @",
      "  /|\\",
      "  / \\+",
      "      v      .",
      "       '  .'",
    ]),
  ];
  const PLAYER_AXE_RAISE = AXE_SWING[0];
  const PLAYER_AXE_STRIKE = AXE_SWING[3];

  const GLYPH_CW = {
    "/": "\\", "\\": "/", "-": "|", "|": "-", "_": "|",
    "`": "'", "'": ".", ">": "v", "<": "^", "^": ">", "v": "<",
  };
  const GLYPH_CCW = {
    "/": "\\", "\\": "/", "-": "|", "|": "-", "_": "-",
    "`": ".", "'": "`", ">": "^", "<": "v", "^": "<", "v": ">",
  };
  const GLYPH_V = {
    "/": "\\", "\\": "/", "'": ".", "`": "'", "^": "v", "v": "^", "_": "-",
  };

  function spinGlyph(ch, dir) {
    const map = dir < 0 ? GLYPH_CCW : GLYPH_CW;
    return map[ch] || ch;
  }

  function rotateFrame(frame, dir) {
    const h = frame.length;
    const w = frame[0].length;
    const cw = dir > 0;
    const rows = [];
    for (let r = 0; r < w; r++) {
      let line = "";
      for (let c = 0; c < h; c++) {
        const sr = cw ? h - 1 - c : c;
        const sc = cw ? r : w - 1 - r;
        line += spinGlyph(frame[sr][sc], cw ? 1 : -1);
      }
      rows.push(line);
    }
    return rows;
  }

  function flipFrameVertical(frame) {
    const rows = [];
    for (let r = frame.length - 1; r >= 0; r--) {
      let line = "";
      const src = frame[r];
      for (let i = 0; i < src.length; i++) line += GLYPH_V[src[i]] || src[i];
      rows.push(line);
    }
    return rows;
  }

  function playerColors(ch, row) {
    if (ch === "O" || ch === "@") return "#ffd7a8";
    if (ch === ">" || ch === "<" || ch === "=" || ch === "-") return "#d5dbe3";
    if (row <= 1) return "#3aa0ff";
    return "#1d6fbe";
  }

  function weaponColors(name, ch, index) {
    if (name === "Flame Blade" && (ch === "~")) {
      return index % 2 === 0 ? "#ff7a18" : "#ffd24a";
    }
    if (name === "Iron Spear" && ch === "o") return "#e7edf4";
    if (name === "Crossbow" && ch === "|") return "#8d5a32";
    if (ch === "-" && (name === "Rusty Sword" || name === "Iron Spear")) return "#b8894a";
    if (ch === "-" && name === "Crossbow") return "#d5dbe3";
    if (ch === "|") return "#c9ced6";
    if (ch === "=") return "#e6ebf2";
    if (ch === ">") return "#f4f7fb";
    if (ch === "~") return "#ff8a1e";
    return "#e6ebf2";
  }

  function axeColors(ch) {
    if (ch === "-" || ch === "|") return "#c4924a";
    if (ch === "^") return "#f2f5f8";
    if (ch === "=" || ch === ">") return "#d5dbe3";
    return "#e8eef5";
  }

  const ENEMY_VISUALS = {
    "Slime": {
      fps: 3.2,
      frames: [
        ["   __   ", " _(oo)_ ", "(______)"],
        ["        ", " ______ ", "(_(oo)_)"],
        ["   __   ", "_( oo )_", "(______)"],
        ["  __    ", " _(oo)_ ", "(______)"],
      ],
      color(ch) {
        if (ch === "o") return "#f4fff2";
        if (ch === "_") return "#b6ff8a";
        if (ch === "(" || ch === ")") return "#1e8f45";
        return "#5dcc62";
      },
    },
    "Bat": {
      fps: 7,
      frames: [
        ["^(oo)^"],
        ["-(oo)-"],
        ["v(oo)v"],
        ["-(oo)-"],
      ],
      color(ch) {
        if (ch === "o") return "#ff3355";
        if (ch === "(" || ch === ")") return "#6a3d9a";
        if (ch === "^" || ch === "v" || ch === "-") return "#d48bff";
        return "#b06adf";
      },
    },
    "Floating Eye": {
      fps: 2.4,
      frames: [
        [" .---. ", "( (@) )", " '---' "],
        [" .---. ", "( ( @))", " '---' "],
        [" .---. ", "((@)  )", " '---' "],
        [" .---. ", "( (-) )", " '---' "],
      ],
      color(ch) {
        if (ch === "@") return "#35d0ff";
        if (ch === "-" && false) return "#dfe7ff";
        if (ch === "(" || ch === ")") return "#f7f7ff";
        if (ch === "." || ch === "'" || ch === "-") return "#c5d0ea";
        return "#f7f7ff";
      },
    },
    "Goblin": {
      fps: 5,
      frames: [
        ["  ,_,  ", " (>_<) ", " /|\\--+", " / \\   "],
        ["  ,_,  ", " (>_<) ", " /|\\--+", "/  \\   "],
        ["  ,_,  ", " (>_<) ", "  |\\--+", " /  \\  "],
        ["  ,_,  ", " (>_<) ", " /| --+", "   / \\ "],
      ],
      color(ch, row) {
        if (row === 2 && (ch === "-" || ch === "+")) return ch === "+" ? "#f0f3f7" : "#d27a3a";
        if (ch === ">" || ch === "<") return "#ffe14d";
        if (ch === "," || ch === "_") return "#d6f7b0";
        if (ch === "(" || ch === ")") return "#8ed36a";
        return "#3f8f3a";
      },
    },
    "Ghost": {
      fps: 3.5,
      frames: [
        [" .-. ", "(o o)", "| O |", "'~~~'"],
        [" .-. ", "(o o)", "| O |", "~'~'~"],
        [" .-. ", "(o o)", "| O |", "'~'~'"],
        [" .-. ", "(o o)", "| O |", "~~~'~"],
      ],
      color(ch) {
        if (ch === "o" || ch === "O") return "#141b28";
        if (ch === "~" || ch === "'") return "#9eb6e8";
        return "#e7f0ff";
      },
    },
    "Skeleton": {
      fps: 4,
      frames: [
        [" .-. ", "(x x)", " |=| ", " / \\ "],
        [" .-. ", "(x x)", " |=| ", "/   \\"],
        [" .-. ", "(x x)", ">|=| ", " / \\ "],
        [" .-. ", "(x x)", " |=|>", "\\   /"],
      ],
      color(ch, row) {
        if (ch === "x") return "#ff3b30";
        if (ch === "=" || (row === 2 && ch === "|")) return "#9aa3ad";
        if (ch === ">") return "#e8e0c8";
        return "#efe6cf";
      },
    },
    "Spider": {
      fps: 6,
      frames: [
        ["\\\\ _ //", " -(OO)-", " // \\\\ "],
        ["// _ \\\\", " -(OO)-", " \\\\ // "],
        ["\\\\ _ //", " -(OO)-", "//   \\\\"],
        ["// _ \\\\", " -(OO)-", "\\\\   //"],
      ],
      color(ch) {
        if (ch === "O") return "#39ff14";
        if (ch === "/" || ch === "\\") return "#e10600";
        return "#f4f4f4";
      },
    },
    "Stone Golem": {
      fps: 2.2,
      frames: [
        ["  _[]_  ", " [O__O] ", " /|##|\\ ", "  |  |  ", " _|  |_ "],
        ["  _[]_  ", " [o__o] ", " /|##|\\ ", "  |  |  ", "_|    |_"],
        [" _[]_   ", " [O__O] ", "/ |##| \\", "  |  |  ", " _|  |_ "],
        ["  _[]_  ", " [O__O] ", " /|##|\\ ", "  |  |  ", "  |  |  "],
      ],
      color(ch) {
        if (ch === "O" || ch === "o") return "#ffe66d";
        if (ch === "#") return "#ff9f1c";
        if (ch === "/" || ch === "\\") return "#8b949e";
        return "#aeb6c2";
      },
    },
    "Demon Lord": {
      fps: 3,
      frames: padDemon([
        ["       __/\\__", "  ___ ( O  O )___", " <   \\  \\/\\/  /  >", "  \\___\\______/__/", "      /|    |\\"],
        ["       __/\\__", "  ___ ( O  O )___", "<    \\  /\\/\\  /   >", "  \\___\\______/__/", "      /|    |\\"],
        ["       __/\\__", "  ___ ( o  o )___", " <   \\  \\/\\/  /  >", "  \\___\\______/__/", "     / |    | \\"],
        ["       __/\\__", "  ___ ( O  O )___", "<     \\  \\/\\/  /  >", "  \\___\\______/__/", "      /|    |\\"],
      ]),
      color(ch, row) {
        if (ch === "O" || ch === "o") return "#ffe566";
        if (row === 0) return "#ffd166";
        if (ch === "<" || ch === ">") return "#6a040f";
        if (row === 2 && (ch === "/" || ch === "\\")) return "#ff7b00";
        if (row === 4) return "#ffd166";
        if (ch === "(" || ch === ")") return "#d00000";
        if (ch === "_") return "#ffd166";
        return "#c1121f";
      },
    },
  };

  function padDemon(frames) {
    return frames.map((rows) => {
      const width = Math.max(...rows.map((r) => r.length));
      return rows.map((r) => r + " ".repeat(width - r.length));
    });
  }

  const TREES = [
    {
      name: "oak",
      canopy: 5,
      trunkCol: 4,
      rows: [
        "   _-_   ",
        "  (   )  ",
        " ( * * ) ",
        "(  * *  )",
        " (_____) ",
        "   |#|   ",
        "   |#|   ",
      ],
      color(ch, row) {
        if (row >= 5) return ch === "#" ? "#6b4423" : "#8a5a2b";
        if (ch === "*") return "#9be05a";
        if (ch === "_") return "#6fbf73";
        return "#2f7d38";
      },
    },
    {
      name: "pine",
      canopy: 4,
      trunkCol: 4,
      rows: [
        "    ^    ",
        "   /#\\   ",
        "  /###\\  ",
        " /#####\\ ",
        "    |    ",
        "    |    ",
        "   / \\   ",
      ],
      color(ch, row) {
        if (row >= 4 && ch === "|") return "#6d4c2f";
        if (row >= 4) return "#6d4c2f";
        if (ch === "#") return "#3ea85a";
        return "#1f7a46";
      },
    },
    {
      name: "willow",
      canopy: 4,
      trunkCol: 4,
      rows: [
        "  ~~~~~  ",
        " ~~~~~~~ ",
        "~~~~~~~~~",
        " ~~| |~~ ",
        "   | |   ",
        "   | |   ",
        "   |_|   ",
      ],
      color(ch, row) {
        if (ch === "|") return "#7a5230";
        if (ch === "_") return "#6a4528";
        if (row >= 4) return "#7a5230";
        return "#7dcea0";
      },
    },
    {
      name: "snag",
      canopy: 4,
      trunkCol: 3,
      rows: [
        "    __   ",
        "   /  \\  ",
        "  /    ) ",
        " |   _/  ",
        " |  |    ",
        " |  |    ",
        "|   |    ",
      ],
      color(ch) {
        if (ch === "_" || ch === "/") return "#b08968";
        if (ch === "\\") return "#b08968";
        return "#7a624c";
      },
    },
    {
      name: "autumn",
      canopy: 5,
      trunkCol: 4,
      rows: [
        "  .oOo.  ",
        " .oOOOo. ",
        " oOOOOOo ",
        ".oOO#OOo.",
        " .oOOOo. ",
        "   |#|   ",
        "   |#|   ",
      ],
      color(ch, row) {
        if (row >= 5) return "#6b3a22";
        if (ch === "#" && row >= 5) return "#6b3a22";
        if (ch === "O") return "#e07a2f";
        if (ch === "o") return "#f2c14e";
        if (ch === ".") return "#ffd27a";
        if (ch === "#") return "#c45a1a";
        return "#f0a040";
      },
    },
  ];

  const TORCH_FRAMES = [
    ["  .  ", " ( ) ", " ( ) ", "  |  ", "  |  "],
    [" .   ", " ( ) ", "( )  ", "  |  ", "  |  "],
    ["   ' ", "  ( )", " ( ) ", "  |  ", "  |  "],
    ["  '  ", " . . ", "(   )", "  |  ", "  |  "],
    ["  .  ", "  '  ", " ( ) ", "  |  ", " _|_ "],
  ];

  function torchColor(ch, row) {
    if (row === 0) return "#fff4c2";
    if (row === 1) return "#ffd15c";
    if (row === 2) return "#ff8a1e";
    if (ch === "_") return "#9a7048";
    return "#c8c8d0";
  }

  const ICONS = {
    "Heart Potion": {
      rows: [" _ ", "|~|", "|_|"],
      color(ch) { return ch === "~" ? "#ff5d73" : "#f2f2f2"; },
    },
    "Bubble Shield": {
      rows: [".---.", "( ~ )", " '-' "],
      color(ch) { return ch === "~" ? "#dff8ff" : "#7ee0ff"; },
    },
    "Rage Tonic": {
      rows: [" \\~/ ", " |!| ", " |#| "],
      color(ch) {
        if (ch === "~" || ch === "\\") return "#ffb020";
        if (ch === "/" ) return "#ffb020";
        if (ch === "!") return "#ffe14d";
        if (ch === "#") return "#ff5a1f";
        return "#e8e8e8";
      },
    },
    "Bullet Dropper": {
      rows: [" )|( ", "(.+.)", " )|( "],
      color(ch) { return ch === "+" ? "#fff1a8" : "#ffe14d"; },
    },
    "Heart Container": {
      rows: ["/v\\", "\\+/", "   "],
      color(ch) { return ch === "+" ? "#fff4f4" : "#ff3355"; },
    },
    "Double Jump Boots": {
      rows: [" ___ ", "|  o|", "|___|"],
      color(ch) {
        if (ch === "o") return "#ffe14d";
        if (ch === "_") return "#e6c07a";
        return "#a56b32";
      },
    },
    "Spin Ball": {
      rows: [" _ ", "(o)", " - "],
      color(ch) {
        if (ch === "o") return "#ff4455";
        if (ch === "(" || ch === ")") return "#f4f7fb";
        return "#ffe14d";
      },
    },
  };

  const SPIN_BALL = [
    [" _ ", "(o)", " ` "],
    [" . ", "(@)", " . "],
    [" ` ", "(O)", " _ "],
    [" . ", "(@)", " . "],
    [" - ", "(*)", " - "],
    [" . ", "(@)", " . "],
  ];

  function spinBallColor(ch) {
    if (ch === "o" || ch === "O" || ch === "@" || ch === "*") return "#ff4455";
    if (ch === "(" || ch === ")") return "#f7f7f7";
    if (ch === "_" || ch === "-" || ch === "`") return "#ffe14d";
    return "#fff6d0";
  }

  const COIN_FRAMES = ["($)", "(o)", "($)", "(|)"];

  function coinColor(ch) {
    if (ch === "(" || ch === ")") return "#e2b43a";
    return "#ffe14d";
  }

  function heartRow(filled) {
    return filled ? ["/\\", "\\/"] : ["/\\", "\\/"];
  }

  function enemyFrame(name, time) {
    const vis = ENEMY_VISUALS[name];
    const frames = vis.frames;
    let idx = Math.floor(time * vis.fps) % frames.length;
    if (!Number.isFinite(idx)) idx = 0;
    else if (idx < 0) idx += frames.length;
    return { frame: frames[idx], color: vis.color, vis };
  }

  function allSpriteFrames() {
    const groups = [];
    groups.push(["player-walk", PLAYER_WALK]);
    groups.push(["player-climb", PLAYER_CLIMB]);
    groups.push(["player-jump", [PLAYER_JUMP]]);
    groups.push(["player-axe", [PLAYER_AXE_RAISE, PLAYER_AXE_STRIKE]]);
    groups.push(["axe-ready", [AXE_READY]]);
    groups.push(["axe-swing", AXE_SWING]);
    groups.push(["player-crouch", [PLAYER_CROUCH]]);
    groups.push(["player-dash", PLAYER_DASH]);
    groups.push(["player-slide", PLAYER_SLIDE]);
    groups.push(["player-attack", PLAYER_ATTACK]);
    groups.push(["player-ready", [PLAYER_READY]]);
    groups.push(["sword-swing", SWORD_SWING]);
    groups.push(["sword-up-ready", [SWORD_UP_READY]]);
    groups.push(["sword-up", SWORD_UP]);
    for (const [name, vis] of Object.entries(ENEMY_VISUALS)) groups.push([name, vis.frames]);
    for (const tree of TREES) groups.push(["tree:" + tree.name, [tree.rows]]);
    groups.push(["torch", TORCH_FRAMES]);
    for (const [name, icon] of Object.entries(ICONS)) groups.push(["icon:" + name, [icon.rows]]);
    groups.push(["spin-ball", SPIN_BALL]);
    return groups;
  }

  return {
    MIRROR,
    mirrorLine,
    degrade,
    mixHex,
    damageColor,
    PLAYER_WALK,
    PLAYER_IDLE,
    PLAYER_JUMP,
    PLAYER_CLIMB,
    PLAYER_AXE_RAISE,
    PLAYER_AXE_STRIKE,
    PLAYER_LUNGE,
    PLAYER_CROUCH,
    PLAYER_DASH,
    PLAYER_SLIDE,
    PLAYER_ATTACK,
    PLAYER_READY,
    SWORD_SWING,
    SWORD_UP_READY,
    SWORD_UP,
    AXE_READY,
    AXE_SWING,
    rotateFrame,
    flipFrameVertical,
    playerColors,
    weaponColors,
    axeColors,
    ENEMY_VISUALS,
    TREES,
    TORCH_FRAMES,
    torchColor,
    ICONS,
    SPIN_BALL,
    spinBallColor,
    COIN_FRAMES,
    coinColor,
    heartRow,
    enemyFrame,
    allSpriteFrames,
  };
});
