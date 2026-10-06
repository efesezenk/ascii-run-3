const DATA = require("../js/data.js");
const SPR = require("../js/sprites.js");
const LEVEL = require("../js/level.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  }
}

for (const enemy of DATA.ENEMIES) {
  const hits = DATA.HITS_TO_KILL_WITH_STARTER[enemy.name];
  assert(hits * DATA.STARTER_DAMAGE === enemy.hp, enemy.name + " hp " + enemy.hp + " vs hits " + hits);
  const frames = SPR.ENEMY_VISUALS[enemy.name].frames;
  frames.forEach((frame, fi) => {
    const w = frame[0].length;
    frame.forEach((row, ri) => {
      assert(row.length === w, enemy.name + " frame " + fi + " row " + ri + " width " + row.length + " != " + w + " [" + row + "]");
    });
  });
}

for (const group of SPR.allSpriteFrames()) {
  const [name, frames] = group;
  frames.forEach((frame, fi) => {
    const w = frame[0].length;
    frame.forEach((row, ri) => {
      assert(row.length === w, name + " f" + fi + " r" + ri + " w " + row.length + "!=" + w + " [" + row + "]");
    });
  });
}

for (const level of DATA.LEVELS) {
  const reward = DATA.weaponByName(level.weapon_reward);
  assert(reward && reward.unlock_level === level.level, "weapon unlock " + level.name);
  for (const name of Object.keys(level.enemy_counts)) {
    const enemy = DATA.enemyByName(name);
    assert(enemy.levels.includes(level.level), name + " not listed for level " + level.level);
  }
}

const heights = [];
const layoutSigs = { 1: new Set(), 2: new Set(), 3: new Set() };
for (let n = 1; n <= 3; n++) {
  for (let seed = 1; seed <= 8; seed++) {
    let level;
    try {
      level = LEVEL.generateLevel(n, seed);
    } catch (err) {
      failed++;
      console.error("FAIL generate", n, seed, err.message);
      continue;
    }
    const def = DATA.levelByNumber(n);
    const counts = {};
    for (const e of level.enemies) counts[e.name] = (counts[e.name] || 0) + 1;
    for (const [name, count] of Object.entries(def.enemy_counts)) {
      assert(counts[name] === count, "L" + n + " seed " + seed + " " + name + " " + counts[name] + " != " + count);
    }
    const placed = level.coins.filter((c) => !c.secret).length;
    const secret = level.coins.filter((c) => c.secret).length;
    assert(placed === def.placed_coins, "placed coins " + placed);
    assert(secret === def.secret_coins, "secret coins " + secret);
    assert(level.reach.boss, "boss unreachable L" + n + " seed " + seed);
    assert(level.reach.secrets, "secrets unreachable " + level.reach.secretHits + "/" + level.reach.secretTotal);
    const floors = new Set(level.platforms.filter((p) => p.y < level.ground).map((p) => level.ground - p.y));
    assert(floors.size >= 3, "floors " + [...floors].join(",") + " L" + n);
    let ladders = 0;
    for (let i = 0; i < level.ladder.length; i++) if (level.ladder[i]) ladders++;
    assert(ladders > 20, "ladders " + ladders);
    for (const tree of level.trees) {
      assert(tree.hp >= 2 && tree.hp <= 4, "tree hp " + tree.hp);
    }
    assert(level.trees.length >= 4, "trees " + level.trees.length + " L" + n + " seed " + seed);
    for (const e of level.enemies) {
      const x = Math.round(e.x);
      const y = Math.floor(e.foot - 0.2);
      const i = y * level.width + x;
      assert(level.solid[i] === 0, "enemy in solid " + e.name + " " + x + "," + y);
    }
    heights.push(level.width);
    const sig = level.platforms.map((p) => p.tag + "@" + p.y + "x" + p.x + "w" + p.w).join("|");
    layoutSigs[n].add(sig);
  }
}

for (let n = 1; n <= 3; n++) {
  assert(layoutSigs[n].size >= 6, "L" + n + " layouts only " + layoutSigs[n].size + " unique of 8 seeds");
}

let y = 0;
let vy = DATA.PHYSICS.JUMP_V;
let peak = 0;
for (let i = 0; i < 400; i++) {
  vy += DATA.PHYSICS.GRAVITY / 120;
  y += vy / 120;
  if (-y > peak) peak = -y;
}
assert(peak >= 4.15 && peak < 4.8, "jump height " + peak.toFixed(3));

if (failed) {
  console.error(failed + " failures");
  process.exit(1);
}
console.log("smoke ok", "widths", heights.join(","));
