/* Procedural side-view routes. The path is a chain of jumpable stairs,
   open roads, and ladder bridges tall enough that a jump cannot skip them.
   Counts of enemies and coins come from the design sheet exactly. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ASCIIRun = Object.assign(root.ASCIIRun || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const AR = typeof module !== "undefined" && module.exports
    ? null
    : null;

  function dataApi() {
    if (typeof module !== "undefined" && module.exports) {
      return require("./data.js");
    }
    return globalThis.ASCIIRun;
  }

  function spriteApi() {
    if (typeof module !== "undefined" && module.exports) {
      return require("./sprites.js");
    }
    return globalThis.ASCIIRun;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function key(x, y) {
    return x + "," + y;
  }

  const GROUND = 42;
  const MAP_H = 56;

  function generateLevel(levelNumber, seed) {
    const DATA = dataApi();
    const SPR = spriteApi();
    const def = DATA.levelByNumber(levelNumber);
    if (!def) throw new Error("Unknown level " + levelNumber);
    const rng = mulberry32(seed);
    const solid = new Set();
    const ladder = new Set();
    const platforms = [];
    let cursor = 2;

    function S(x, y) { return solid.has(key(x, y)); }
    function L(x, y) { return ladder.has(key(x, y)); }

    function paintGround(x, y, w, tag) {
      for (let i = 0; i < w; i++) {
        for (let dy = 0; dy < 8; dy++) {
          const yy = y + dy;
          if (yy >= MAP_H) break;
          if (!L(x + i, yy)) solid.add(key(x + i, yy));
        }
      }
      platforms.push({ x, y, w, tag });
    }

    function paintPlat(x, y, w, tag) {
      for (let i = 0; i < w; i++) {
        if (L(x + i, y)) continue;
        solid.add(key(x + i, y));
      }
      platforms.push({ x, y, w, tag });
    }

    function paintLadder(x, yTop, ySurface) {
      for (let y = yTop; y < ySurface; y++) {
        solid.delete(key(x, y));
        ladder.add(key(x, y));
      }
    }

    function standGap() {
      if (levelNumber === 1) return 4;
      if (levelNumber === 2) return 5;
      return 6;
    }

    function appendOpen(w, tag) {
      const extra = Math.floor(rng() * 11);
      const widthTiles = w + extra;
      paintGround(cursor, GROUND, widthTiles, tag || "ground");
      cursor += widthTiles;
    }

    function ri(n) { return Math.floor(rng() * n); }

    function appendGapRoad(w) {
      const hole = 2 + ri(levelNumber === 1 ? 2 : 3);
      cursor += hole;
      appendOpen(w, "ground");
    }

    function appendStairs() {
      const rise = 3;
      const steps = 2 + ri(2);
      const run = 6 + ri(3);
      const gap = 1;
      const base = 8 + ri(5);
      paintGround(cursor, GROUND, base, "ground");
      let x = cursor + base + gap;
      let prevEnd = cursor + base;
      for (let s = 1; s <= steps; s++) {
        const y = GROUND - rise * s;
        paintPlat(x, y, run, "path");
        prevEnd = x + run;
        x = prevEnd + gap;
      }
      const land = 10 + ri(6);
      paintGround(prevEnd, GROUND, land, "ground");
      cursor = prevEnd + land;
    }

    function appendBridge() {
      const pad = 12 + ri(4);
      const span = 18 + ri(6);
      paintGround(cursor, GROUND, pad, "ground");
      const top = GROUND - 16;
      const ladX = cursor + pad - 1;
      paintLadder(ladX, top, GROUND);
      paintPlat(ladX + 1, top, span, "path");
      const lad2 = ladX + 1 + span;
      paintLadder(lad2, top, GROUND);
      const tail = 12 + ri(5);
      paintGround(lad2, GROUND, tail, "ground");
      cursor = lad2 + tail;
    }

    function appendShelf() {
      const base = 14 + ri(6);
      paintGround(cursor, GROUND, base, "ground");
      const run = 5 + ri(3);
      const inset = 2;
      if (inset + run < base - 2) paintPlat(cursor + inset, GROUND - 4, run, "path");
      cursor += base;
    }

    function columnClear(x, y0, y1) {
      for (let y = y0; y < y1; y++) {
        if (S(x, y) || L(x, y)) return false;
      }
      return true;
    }

    function appendSecret() {
      const width = 8 + ri(5);
      const top = GROUND - 16;
      const grounds = platforms.filter((p) => (p.tag === "ground" || p.tag === "start" || p.tag === "grove") && p.y === GROUND && p.w >= width + 6);
      if (!grounds.length) return false;
      const p = grounds[ri(grounds.length)];
      const x0 = p.x + 2;
      const x1 = p.x + p.w - width - 3;
      if (x1 < x0) return false;
      const start = x0 + ri(x1 - x0 + 1);
      for (let attempt = 0; attempt <= x1 - x0; attempt++) {
        const x = x0 + ((start - x0 + attempt) % (x1 - x0 + 1));
        if (Math.abs(x - 8) < 6) continue;
        if (!columnClear(x, top, GROUND)) continue;
        let open = true;
        for (let i = 0; i < width; i++) {
          const sx = x + 1 + i;
          if (S(sx, top) || L(sx, top) || S(sx, top - 1) || L(sx, top - 1)) open = false;
        }
        if (!open) continue;
        paintLadder(x, top, GROUND);
        paintPlat(x + 1, top, width, "secret");
        return true;
      }
      return false;
    }

    appendOpen(14 + ri(10), "start");
    const kinds = ["stairs", "gap", "bridge", "shelf", "open", "gap", "stairs"];
    if (levelNumber >= 2) kinds.push("bridge", "gap", "shelf", "open");
    if (levelNumber >= 3) kinds.push("stairs", "bridge", "gap", "shelf");
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = ri(i + 1);
      const tmp = kinds[i];
      kinds[i] = kinds[j];
      kinds[j] = tmp;
    }
    let bridges = 0;
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      if (k === "stairs") appendStairs();
      else if (k === "gap") appendGapRoad(10 + ri(8));
      else if (k === "shelf") appendShelf();
      else if (k === "bridge") { appendBridge(); bridges++; }
      else appendOpen(10 + ri(10), "ground");
    }
    if (bridges < 1) appendBridge();

    const trunkCols = new Set();
    const need = countNeeded(def);
    let guard = 0;
    while (secretCapacity() < def.secret_coins && guard < 16) {
      if (!appendSecret()) appendOpen(18, "ground");
      guard++;
    }

    function wideGrounds() {
      return platforms.filter((p) => (p.tag === "ground" || p.tag === "start" || p.tag === "grove") && p.y === GROUND && p.w >= 12);
    }
    guard = 0;
    while (wideGrounds().length < 3 && guard < 4) {
      appendOpen(18, "grove");
      guard++;
    }
    const trees = placeTrees(rng, SPR);
    if (trees.length < 4) {
      appendOpen(20, "grove");
      const more = placeTrees(rng, SPR);
      for (let i = 0; i < more.length; i++) trees.push(more[i]);
    }

    guard = 0;
    while ((walkSpots().length < need.walk || flySpots().length < need.fly) && guard < 40) {
      appendOpen(16, "pad");
      guard++;
    }
    guard = 0;
    while (coinSpotCount() < def.placed_coins && guard < 14) {
      appendOpen(12, "pad");
      guard++;
    }

    const approach = cursor;
    const porch = 14;
    paintGround(cursor, GROUND, porch, "approach");
    const arenaStart = cursor + 1;
    const arenaEnd = cursor + porch;
    const gateColumn = arenaEnd - 2;
    const doorX = arenaEnd - 1;
    for (let y = 0; y < MAP_H; y++) solid.add(key(arenaEnd, y));
    for (let y = 0; y < MAP_H; y++) solid.add(key(0, y));
    cursor = arenaEnd + 1;

    const sealCells = [];
    for (let y = GROUND - 18; y < GROUND; y++) sealCells.push({ x: gateColumn, y });

    const width = cursor + 2;
    const enemies = placeEnemies(def, rng);
    const coins = placeCoins(def, rng);
    const torches = placeTorches(rng);
    const props = placeProps(levelNumber);

    const grid = bake(width);

    const level = {
      number: levelNumber,
      name: def.name,
      seed,
      boss: def.boss,
      entry: def.entry_enemy,
      weaponReward: def.weapon_reward,
      width,
      height: MAP_H,
      ground: GROUND,
      solid: grid.solid,
      ladder: grid.ladder,
      platforms,
      trees,
      enemies,
      coins,
      torches,
      props,
      gateColumn,
      doorX,
      arenaStart,
      arenaEnd,
      seal: sealCells,
      spawn: { x: 8, foot: GROUND },
      approach,
    };

    const reach = analyzeReachability(level);
    level.reach = reach;
    if (!reach.boss || !reach.secrets) {
      throw new Error("Unreachable layout L" + levelNumber + " seed " + seed + " boss=" + reach.boss + " secrets=" + reach.secretHits + "/" + reach.secretTotal);
    }
    return level;

    function walkSpots() {
      const spots = [];
      for (const p of platforms) {
        if (p.tag === "secret" || p.tag === "arena" || p.tag === "approach") continue;
        if (p.w < 6) continue;
        for (let x = p.x + 2; x <= p.x + p.w - 3; x += 4) {
          if (trunkCols.has(x)) continue;
          if (!columnAir(x, p.y, 3)) continue;
          if (L(x, p.y - 1)) continue;
          // Spawn sits at x=8. A walker hitbox is several tiles wide, so the opening spot must not cover it.
          if (p.y === GROUND && Math.abs(x - 8) < 8) continue;
          spots.push({ x, foot: p.y, surface: p.y });
        }
      }
      return spots;
    }

    function flySpots() {
      const spots = [];
      for (const p of platforms) {
        if (p.tag === "secret" || p.tag === "arena" || p.tag === "approach") continue;
        if (p.w < 6) continue;
        for (let x = p.x + 2; x <= p.x + p.w - 3; x += 6) {
          if (trunkCols.has(x)) continue;
          if (!columnAir(x, p.y, 7)) continue;
          if (p.y === GROUND && Math.abs(x - 8) < 8) continue;
          spots.push({ x, foot: p.y - 3.2, homeX: x, homeY: p.y - 3.2, floor: p.y });
        }
      }
      return spots;
    }

    function columnAir(x, surface, n) {
      for (let i = 1; i <= n; i++) {
        if (S(x, surface - i) || L(x, surface - i)) return false;
      }
      return true;
    }

    function secretPlatforms() {
      return platforms.filter((p) => p.tag === "secret");
    }

    function secretCapacity() {
      let n = 0;
      for (const p of secretPlatforms()) n += Math.max(0, p.w - 2);
      return n;
    }

    function coinSpotCount() {
      let n = 0;
      for (const p of platforms) {
        if (p.tag === "secret" || p.tag === "arena" || p.tag === "approach") continue;
        for (let x = p.x + 1; x < p.x + p.w - 1; x += 2) {
          if (L(x, p.y - 1) || !columnAir(x, p.y, 2)) continue;
          let trunk = false;
          for (let t = 0; t < trees.length; t++) {
            if (trees[t].x === x && Math.abs(trees[t].foot - p.y) < 0.1) trunk = true;
          }
          if (!trunk) n++;
        }
      }
      return n;
    }

    function placeTrees(rngFn, sprites) {
      const placed = [];
      const used = new Set();
      const grounds = platforms.filter((p) => (p.tag === "ground" || p.tag === "start" || p.tag === "grove") && p.w >= 12 && p.y === GROUND);
      for (const p of grounds) {
        const trunkXs = [p.x + 2, p.x + p.w - 4];
        for (const tx of trunkXs) {
          if (trunkCols.has(tx) || used.has(tx) || L(tx, p.y - 1)) continue;
          const type = sprites.TREES[Math.floor(rngFn() * sprites.TREES.length)];
          const h = type.rows.length;
          let blocked = false;
          for (let dy = 1; dy <= h; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
              if (S(tx + dx, p.y - dy)) blocked = true;
            }
          }
          if (blocked) continue;
          const hp = 2 + Math.floor(rngFn() * 3);
          const blocks = [];
          for (let dy = 1; dy <= 4; dy++) blocks.push({ x: tx, y: p.y - dy });
          trunkCols.add(tx);
          placed.push({
            type: type.name,
            x: tx,
            foot: p.y,
            hp,
            maxHp: hp,
            blocks,
            phase: rngFn() * Math.PI * 2,
          });
          used.add(tx);
          used.add(tx - 1);
          used.add(tx + 1);
        }
      }
      return placed;
    }

    function placeEnemies(defObj, rngFn) {
      const walkers = [];
      const flyers = [];
      for (const [name, count] of Object.entries(defObj.enemy_counts)) {
        const info = DATA.enemyByName(name);
        const list = info.move === "fly" ? flyers : walkers;
        for (let i = 0; i < count; i++) list.push(name);
      }
      const entry = defObj.entry_enemy;
      function shuffle(arr, rand) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          const tmp = arr[i];
          arr[i] = arr[j];
          arr[j] = tmp;
        }
      }
      const ws = walkSpots().sort((a, b) => a.x - b.x);
      const fs = flySpots().sort((a, b) => a.x - b.x);
      shuffle(walkers, rngFn);
      shuffle(flyers, rngFn);
      // The level's new enemy shows up in the opening stretch of the road.
      function pullEntry(names) {
        const lead = names.filter((n) => n === entry);
        const rest = names.filter((n) => n !== entry);
        names.length = 0;
        for (const n of lead) names.push(n);
        for (const n of rest) names.push(n);
      }
      pullEntry(walkers);
      pullEntry(flyers);
      if (ws.length < walkers.length || fs.length < flyers.length) {
        throw new Error("Not enough spots L" + levelNumber + " walk " + ws.length + "/" + walkers.length + " fly " + fs.length + "/" + flyers.length);
      }
      const placed = [];
      const taken = new Set();
      function take(spots, names) {
        const usable = spots.filter((s) => !taken.has(s.x + "@" + s.foot));
        const step = Math.max(1, Math.floor(usable.length / names.length));
        for (let i = 0; i < names.length; i++) {
          const spot = usable[Math.min(usable.length - 1, i * step)];
          taken.add(spot.x + "@" + spot.foot);
          placed.push({
            name: names[i],
            x: spot.x,
            foot: spot.foot,
            homeX: spot.homeX || spot.x,
            homeY: spot.homeY || spot.foot,
            floor: spot.floor || spot.foot,
            dir: rngFn() < 0.5 ? -1 : 1,
          });
        }
      }
      take(ws, walkers);
      take(fs, flyers);
      return placed;
    }

    function placeCoins(defObj, rngFn) {
      const coins = [];
      const reserved = new Set(enemies.map((e) => Math.round(e.x) + "@" + Math.round(e.foot)));
      function free(x, foot) {
        if (reserved.has(x + "@" + foot)) return false;
        if (L(x, foot - 1)) return false;
        for (const tree of trees) {
          if (tree.x === x && Math.abs(tree.foot - foot) < 0.1) return false;
        }
        return columnAir(x, foot, 2);
      }
      const main = [];
      for (const p of platforms) {
        if (p.tag === "secret" || p.tag === "arena") continue;
        for (let x = p.x + 1; x < p.x + p.w - 1; x += 2) {
          if (free(x, p.y)) main.push({ x, y: p.y - 1.05, secret: false });
        }
      }
      if (main.length < defObj.placed_coins) {
        throw new Error("Not enough coin spots " + main.length + " < " + defObj.placed_coins);
      }
      const step = main.length / defObj.placed_coins;
      for (let i = 0; i < defObj.placed_coins; i++) {
        coins.push(main[Math.min(main.length - 1, Math.floor(i * step))]);
      }
      const secretSpots = [];
      for (const p of secretPlatforms()) {
        for (let x = p.x + 1; x < p.x + p.w - 1; x++) {
          if (columnAir(x, p.y, 2)) secretSpots.push({ x, y: p.y - 1.05, secret: true });
        }
      }
      if (secretSpots.length < defObj.secret_coins) {
        throw new Error("Not enough secret coins " + secretSpots.length);
      }
      const sStep = secretSpots.length / defObj.secret_coins;
      for (let i = 0; i < defObj.secret_coins; i++) {
        coins.push(secretSpots[Math.min(secretSpots.length - 1, Math.floor(i * sStep + rngFn() * 0.01))]);
      }
      return coins;
    }

    function placeTorches(rngFn) {
      const torches = [];
      for (const p of platforms) {
        if (p.tag === "secret" || p.w < 8) continue;
        const x = p.x + 1 + Math.floor(rngFn() * Math.max(1, p.w - 3));
        if (!columnAir(x, p.y, 5)) continue;
        if (trees.some((t) => Math.abs(t.x - x) < 2 && Math.abs(t.foot - p.y) < 0.2)) continue;
        torches.push({ x, foot: p.y, phase: rngFn() * 4 });
      }
      return torches.filter((_, i) => i % 2 === 0).slice(0, 14);
    }

    function placeProps(levelNum) {
      const props = [];
      for (const p of platforms) {
        if (p.tag === "arena" || p.y > GROUND - 6) continue;
        if (p.w < 6) continue;
        props.push({
          kind: levelNum === 1 ? "vine" : levelNum === 2 ? "chain" : "banner",
          x: p.x + 2,
          y: p.y + 1,
          h: 3,
        });
      }
      return props.slice(0, 10);
    }

    function bake(w) {
      const solidArr = new Uint8Array(w * MAP_H);
      const ladderArr = new Uint8Array(w * MAP_H);
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (solid.has(key(x, y))) solidArr[i] = 1;
          if (ladder.has(key(x, y))) ladderArr[i] = 1;
        }
      }
      return { solid: solidArr, ladder: ladderArr };
    }

  }

  function countNeeded(def) {
    const DATA = dataApi();
    let walk = 0;
    let fly = 0;
    for (const [name, count] of Object.entries(def.enemy_counts)) {
      const info = DATA.enemyByName(name);
      if (info.move === "fly") fly += count;
      else walk += count;
    }
    return { walk, fly };
  }

  function analyzeReachability(level) {
    const w = level.width;
    const h = level.height;
    const solid = level.solid;
    const ladder = level.ladder;
    const seen = new Uint8Array(w * h);
    function idx(x, y) { return y * w + x; }
    function blocked(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      return solid[idx(x, y)] === 1;
    }
    function isLadder(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return ladder[idx(x, y)] === 1;
    }
    function standable(x, y) {
      if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) return false;
      if (blocked(x, y) || blocked(x, y - 1)) return false;
      if (blocked(x, y + 1)) return true;
      if (isLadder(x, y) || isLadder(x, y + 1)) return true;
      return false;
    }
    const startX = Math.round(level.spawn.x);
    const startY = level.ground - 1;
    const q = [startX, startY];
    const reach = new Uint8Array(w * h);
    if (standable(startX, startY)) {
      seen[idx(startX, startY)] = 1;
      reach[idx(startX, startY)] = 1;
    }
    const jumps = [];
    for (let dx = -6; dx <= 6; dx++) {
      for (let up = 0; up <= 4; up++) {
        const ad = Math.abs(dx);
        if (up >= 4 && ad > 5) continue;
        if (up >= 2 && ad > 6) continue;
        jumps.push([dx, -up]);
      }
      for (let down = 1; down <= 3; down++) {
        if (Math.abs(dx) > 5) continue;
        jumps.push([dx, down]);
      }
    }
    for (let qi = 0; qi < q.length; qi += 2) {
      const x = q[qi];
      const y = q[qi + 1];
      const opts = [
        [x - 1, y],
        [x + 1, y],
        [x - 1, y - 1],
        [x + 1, y - 1],
      ];
      if (isLadder(x, y) || isLadder(x, y + 1)) {
        opts.push([x, y - 1], [x, y + 1]);
      }
      for (const j of jumps) opts.push([x + j[0], y + j[1]]);
      for (let dx = -1; dx <= 1; dx++) {
        let yy = y + 1;
        let guard = 0;
        while (yy < h - 2 && guard < 22) {
          if (blocked(x + dx, yy) || blocked(x + dx, yy - 1)) break;
          if (standable(x + dx, yy)) {
            opts.push([x + dx, yy]);
            break;
          }
          yy++;
          guard++;
        }
      }
      for (const [nx, ny] of opts) {
        if (!standable(nx, ny)) continue;
        const id = idx(nx, ny);
        if (seen[id]) continue;
        if (ny < y) {
          const up = y - ny;
          const climbing = isLadder(x, y) || isLadder(x, y + 1) || isLadder(nx, ny) || isLadder(nx, ny + 1);
          if (up > 1 && up <= 4 && !climbing) {
            if (!jumpClear(x, y, nx, ny)) continue;
          } else if (up > 4 && !climbing) {
            continue;
          }
        } else if (Math.abs(nx - x) > 1 && !jumpClear(x, y, nx, ny)) {
          continue;
        }
        seen[id] = 1;
        reach[id] = 1;
        q.push(nx, ny);
      }
    }

    function jumpClear(x, y, nx, ny) {
      const dx = nx - x;
      const dy = ny - y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = Math.round(x + dx * t);
        const py = Math.round(y + dy * t - Math.sin(Math.PI * t) * 1);
        if (blocked(px, py) || blocked(px, py - 1)) return false;
      }
      return true;
    }

    let boss = false;
    for (let x = level.arenaStart + 2; x < level.arenaEnd - 1; x++) {
      if (reach[idx(x, level.ground - 1)]) boss = true;
    }
    const secretCoins = level.coins.filter((c) => c.secret);
    let secretHits = 0;
    for (const c of secretCoins) {
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      if (reach[idx(x, y)] || reach[idx(x, y + 1)] || reach[idx(x, y - 1)]) secretHits++;
    }
    return {
      boss,
      secrets: secretHits === secretCoins.length,
      secretHits,
      secretTotal: secretCoins.length,
      reach,
    };
  }

  function debugSlice(level, x0, x1) {
    let s = "";
    for (let y = GROUND - 22; y < GROUND + 3; y++) {
      let row = String(y).padStart(2, " ") + " ";
      for (let x = x0; x < x1; x++) {
        const i = y * level.width + x;
        if (level.ladder[i]) row += "H";
        else if (level.solid[i]) row += "#";
        else row += ".";
      }
      s += row + "\n";
    }
    return s;
  }

  function clearTree(level, tree) {
    for (const b of tree.blocks) {
      const i = b.y * level.width + b.x;
      if (i >= 0 && i < level.solid.length) level.solid[i] = 0;
    }
  }

  return {
    mulberry32,
    generateLevel,
    analyzeReachability,
    GROUND,
    MAP_H,
    clearTree,
    debugSlice,
  };
});
