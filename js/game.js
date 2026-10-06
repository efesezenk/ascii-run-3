/* ASCII Run — full-viewport canvas platformer. */
(function () {
  "use strict";

  const AR = ASCIIRun;
  const P = AR.PHYSICS;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const down = new Set();
  const pressed = new Set();
  let pointer = { x: -1, y: -1, inside: false };
  let click = null;
  let hot = [];

  let viewW = 800;
  let viewH = 600;
  let cellW = 10;
  let cellH = 16;
  let camX = 0;
  let camY = 0;
  let shx = 0;
  let shy = 0;
  let shade = 0;
  let shake = 0;

  let state = "title";
  let uiTime = 0;
  let simTime = 0;
  let timer = 0;
  let menuIndex = 0;
  let weaponIndex = 0;
  let pendingLevel = 1;
  let pendingSeed = 1;
  let level = null;
  let player = null;
  let snapshot = null;
  let enemies = [];
  let coins = [];
  let trees = [];
  let projectiles = [];
  let particles = [];
  let floaters = [];
  let shockwaves = [];
  let bossFight = false;
  let gateDone = false;
  let cleared = false;
  let bossWait = 0;
  let bannerT = 0;
  let toastText = "";
  let toastT = 0;
  let shopMsg = "";
  let shopMsgT = 0;
  let clearInfo = null;
  let swingSerial = 1;
  let fatal = "";
  let titleIndex = 0;
  let bookPage = 0;
  let bookFlip = 0;
  let bookFlipT = 0;
  let bookNext = 0;
  let storeReturn = "play";
  let gateIndex = 0;
  let trails = [];
  let combo = { n: 0, t: 0, pop: 0 };
  let wipe = null;
  let hitStop = 0;
  const DASH_DIST = 15;
  const DASH_TIME = 0.24;
  const SWING_BEATS = [
    { dur: 0.04, hit: false, stop: false, frame: 0 },
    { dur: 0.03, hit: false, stop: false, frame: 1 },
    { dur: 0.03, hit: false, stop: false, frame: 2 },
    { dur: 0.03, hit: true, stop: false, frame: 3 },
    { dur: 0.05, hit: true, stop: true, frame: 4 },
    { dur: 0.04, hit: false, stop: false, frame: 5 },
    { dur: 0.04, hit: false, stop: false, frame: 6 },
    { dur: 0.06, hit: false, stop: false, frame: 7 },
  ];

  const arcade = {};
  function loadArcade(key, src) {
    const img = new Image();
    img.onload = function () {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 28 && d[i + 1] < 28 && d[i + 2] < 28) d[i + 3] = 0;
      }
      g.putImageData(data, 0, 0);
      arcade[key] = c;
    };
    img.src = src;
  }
  loadArcade("heart", "img/heart.jpg");
  loadArcade("heartEmpty", "img/heart-empty.jpg");
  loadArcade("Heart Potion", "img/potion.jpg");
  loadArcade("Bubble Shield", "img/shield.jpg");
  loadArcade("Rage Tonic", "img/rage.jpg");
  loadArcade("Bullet Dropper", "img/dropper.jpg");
  loadArcade("Heart Container", "img/container.jpg");
  loadArcade("Double Jump Boots", "img/boots.jpg");
  loadArcade("Spin Ball", "img/spinball.jpg");

  const BLOCK_KEYS = new Set([
    "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab",
    "KeyW", "KeyA", "KeyS", "KeyD",
  ]);

  window.addEventListener("keydown", (e) => {
    if (BLOCK_KEYS.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());
  window.addEventListener("resize", resize);
  canvas.addEventListener("mousemove", (e) => {
    const p = eventPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.inside = true;
  });
  canvas.addEventListener("mouseleave", () => { pointer.inside = false; });
  canvas.addEventListener("mousedown", (e) => {
    click = eventPos(e);
    canvas.focus();
  });

  function eventPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(viewW * dpr));
    canvas.height = Math.max(1, Math.floor(viewH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutFont();
  }

  function layoutFont() {
    const rows = 32;
    cellH = viewH / rows;
    let size = cellH * 0.98;
    ctx.font = 'bold ' + size + 'px "Courier New", ui-monospace, monospace';
    cellW = ctx.measureText("M").width || cellH * 0.6;
  }

  let audioCtx = null;
  function blip(freq, dur, type, vol) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.value = vol || 0.03;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (err) { /* audio is optional */ }
  }

  function makePlayer() {
    return {
      x: 5, foot: 42, vx: 0, vy: 0, facing: 1,
      hearts: AR.PLAYER_START_HEARTS,
      maxHearts: AR.PLAYER_START_HEARTS,
      coins: 0,
      weapons: ["Rusty Sword"],
      weapon: "Rusty Sword",
      stock: {},
      belt: [],
      perm: {},
      boots: false,
      shield: false,
      rage: 0,
      iframe: 0,
      axeT: 0,
      axeDur: 0,
      axeSwing: 0,
      axeDid: false,
      axeAlt: 1,
      axeStop: false,
      atkT: 0,
      atkCd: 0,
      atkDur: 0.2,
      atkDid: false,
      jumpsLeft: 0,
      climbing: false,
      grounded: false,
      coyote: 0,
      climbLock: 0,
      spawnX: 5,
      spawnFoot: 42,
      prevX: 5,
      prevFoot: 42,
      prevVy: 0,
      stompRise: 0,
      spin: 0,
      spinBounce: 0,
      walkDist: 0,
      walkTime: 0,
      safeT: 0,
      aim: "side",
      axeHold: false,
      spawnGrace: 0,
      jumpHold: false,
      jumpBuffer: 0,
      launchFoot: 42,
      downGap: 0,
      dashT: 0,
      dashCd: 0,
      dashLeft: 0,
      dashDir: 0,
      dashFrom: 5,
      dashAfter: 0,
      dashSwing: 0,
      slideT: 0,
      swingAlt: 1,
      swingStop: false,
      crouch: false,
      pounding: false,
      poundHit: false,
      landed: false,
      wpnExtend: 0,
    };
  }

  function takeSnapshot() {
    return {
      coins: player.coins,
      hearts: player.hearts,
      maxHearts: player.maxHearts,
      weapons: player.weapons.slice(),
      weapon: player.weapon,
      stock: Object.assign({}, player.stock),
      belt: player.belt.slice(),
      perm: Object.assign({}, player.perm),
      boots: player.boots,
      shield: player.shield,
      rage: player.rage,
      number: level.number,
      seed: level.seed,
    };
  }

  function restoreSnapshot(snap) {
    player.coins = snap.coins;
    player.hearts = snap.hearts;
    player.maxHearts = snap.maxHearts;
    player.weapons = snap.weapons.slice();
    player.weapon = snap.weapon;
    player.stock = Object.assign({}, snap.stock);
    player.belt = snap.belt.slice();
    player.perm = Object.assign({}, snap.perm);
    player.boots = snap.boots;
    player.shield = !!snap.shield;
    player.rage = snap.rage || 0;
    player.spin = 0;
    player.spinBounce = 0;
    player.iframe = 0;
    player.axeT = 0;
    player.atkT = 0;
    player.atkCd = 0;
    player.vx = 0;
    player.vy = 0;
  }

  function randSeed() {
    return (Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0xfffffff)) >>> 0;
  }

  function grantLevelWeapon(n) {
    const name = AR.levelByNumber(n).weapon_reward;
    if (!player.weapons.includes(name)) player.weapons.push(name);
  }

  function spawnEnemy(spec, isBoss) {
    const info = AR.enemyByName(spec.name);
    const frame = AR.ENEMY_VISUALS[spec.name].frames[0];
    const w = frame[0].length;
    const h = frame.length;
    const flyer = info.move === "fly";
    const inset = info.is_boss ? 0.3 : flyer ? 0.32 : 0.38;
    return {
      name: spec.name,
      x: spec.x,
      foot: spec.foot,
      homeX: spec.homeX || spec.x,
      homeY: spec.homeY || spec.foot,
      floor: spec.floor || spec.foot,
      dir: spec.dir || 1,
      hp: info.hp,
      maxHp: info.hp,
      hw: Math.max(0.65, w * inset),
      hh: Math.max(0.75, h * (info.is_boss ? 0.78 : 0.86)),
      vy: 0,
      t: Math.random() * 8,
      shootT: 0.8 + Math.random() * 0.6,
      specialT: 1.4 + Math.random(),
      hopT: 0.3 + Math.random() * 0.4,
      dashT: 0,
      dashV: 0,
      hidden: false,
      dead: false,
      deathT: 0,
      flash: 0,
      grounded: true,
      isBoss: !!isBoss,
      hitSwing: -1,
    };
  }

  function loadLevel(n, seed) {
    let built = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        built = AR.generateLevel(n, (seed + attempt * 9973) >>> 0);
        break;
      } catch (err) {
        lastErr = err;
        built = null;
      }
    }
    if (!built) throw lastErr;
    level = built;
    enemies = level.enemies.map((e) => spawnEnemy(e, false));
    coins = level.coins.map((c) => ({
      x: c.x, y: c.y, secret: !!c.secret, loose: false, fromBoss: false, vx: 0, vy: 0, settled: true,
    }));
    trees = level.trees.map((t) => ({
      type: t.type, x: t.x, foot: t.foot, hp: t.hp, maxHp: t.maxHp,
      blocks: t.blocks, phase: t.phase, flash: 0, hitSwing: -1, gone: false,
    }));
    projectiles = [];
    particles = [];
    floaters = [];
    shockwaves = [];
    bossFight = false;
    gateDone = false;
    cleared = false;
    bossWait = 0;
    player.x = level.spawn.x;
    player.foot = level.spawn.foot;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.climbing = false;
    player.spawnX = player.x;
    player.spawnFoot = player.foot;
    player.jumpsLeft = extraJumps();
    player.spawnGrace = 1.25;
    player.aim = "side";
    player.axeHold = false;
    player.spin = 0;
    player.spinBounce = 0;
    player.jumpHold = false;
    player.jumpBuffer = 0;
    player.launchFoot = player.foot;
    player.downGap = 0;
    player.dashT = 0;
    player.dashCd = 0;
    player.dashLeft = 0;
    player.dashDir = 0;
    player.dashFrom = player.x;
    player.dashAfter = 0;
    player.dashSwing = 0;
    player.slideT = 0;
    player.swingStop = false;
    hitStop = 0;
    player.crouch = false;
    player.pounding = false;
    player.poundHit = false;
    player.landed = false;
    player.wpnExtend = 0;
    combo = { n: 0, t: 0, pop: 0 };
    trails = [];
    separateSpawn();
    camX = player.x - 12;
    camY = Math.max(0, player.foot - 22);
  }

  function idx(x, y) {
    return y * level.width + x;
  }

  function inMap(x, y) {
    return x >= 0 && y >= 0 && x < level.width && y < level.height;
  }

  function solidAt(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!inMap(tx, ty)) return false;
    return level.solid[idx(tx, ty)] === 1;
  }

  function ladderAt(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!inMap(tx, ty)) return false;
    return level.ladder[idx(tx, ty)] === 1;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function playerBox(px, foot) {
    const w = 0.78;
    const h = 2.35;
    return { x: (px == null ? player.x : px) - w / 2, y: (foot == null ? player.foot : foot) - h, w: w, h: h };
  }

  function spinBox() {
    return { x: player.x - 1.2, y: player.foot - 2.35, w: 2.4, h: 2.35 };
  }

  function hitsSolid(box) {
    const x0 = Math.floor(box.x + 1e-4);
    const x1 = Math.floor(box.x + box.w - 1e-4);
    const y0 = Math.floor(box.y + 1e-4);
    const y1 = Math.floor(box.y + box.h - 1e-4);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (inMap(x, y) && level.solid[idx(x, y)] === 1) return true;
      }
    }
    return false;
  }

  function enemyBox(e) {
    return { x: e.x - e.hw, y: e.foot - e.hh, w: e.hw * 2, h: e.hh };
  }

  function treeDef(tree) {
    return AR.TREES.find((t) => t.name === tree.type);
  }

  function treeBox(tree) {
    const def = treeDef(tree);
    const w = def.rows[0].length;
    const h = def.rows.length;
    return { x: tree.x - w / 2, y: tree.foot - h, w: w, h: h };
  }

  function attackBox(reach) {
    const aim = player.aim || "side";
    if (aim === "up") return { x: player.x - 0.85, y: player.foot - 2.35 - reach, w: 1.7, h: reach };
    if (aim === "down") return { x: player.x - 1.05, y: player.foot - 0.15, w: 2.1, h: reach };
    const h = 1.55;
    const y = player.foot - 2.05;
    if (player.facing >= 0) return { x: player.x + 0.15, y: y, w: reach, h: h };
    return { x: player.x - 0.15 - reach, y: y, w: reach, h: h };
  }

  function separateSpawn() {
    const px = player.x;
    const wide = playerBox();
    wide.x -= 1.4;
    wide.w += 2.8;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!overlap(wide, enemyBox(e)) && Math.abs(e.x - px) >= 5.5) continue;
      let nx = e.x >= px ? px + 9 : px - 9;
      if (nx < 3 || nx > level.width - 3) nx = px + 9;
      e.x = nx;
      e.homeX = e.x;
    }
  }

  function landingIsFree() {
    for (let dx = -4; dx <= 4; dx++) {
      if (Math.abs(dx) < 1) continue;
      const x = player.x + dx;
      const col = Math.floor(x);
      if (!solidAt(col + 0.5, player.foot + 0.15)) continue;
      if (solidAt(col + 0.5, player.foot - 0.45) || solidAt(col + 0.5, player.foot - 1.5)) continue;
      let blocked = false;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.dead || e.hidden) continue;
        const b = enemyBox(e);
        const body = { x: x - 0.45, y: player.foot - 2.35, w: 0.9, h: 2.35 };
        if (overlap(body, b)) blocked = true;
      }
      if (!blocked) return true;
    }
    return false;
  }

  function weaponAim() {
    const aimUp = holding("KeyW");
    const down = holding("KeyS", "ArrowDown");
    if (aimUp) return "up";
    if (down) return "down";
    return "side";
  }

  function theme() {
    if (!level || level.number === 1) {
      return { top: '"', topC: "#3caf4a", fill: "#", fillC: "#6a4124", alt: "%", altC: "#54351c", ladder: "#e6c27a", prop: "#2f8f45" };
    }
    if (level.number === 2) {
      return { top: "=", topC: "#c5bfb4", fill: "#", fillC: "#555c66", alt: ":", altC: "#3e444c", ladder: "#d9d3c5", prop: "#aeb4bc" };
    }
    return { top: "=", topC: "#a33b3b", fill: "#", fillC: "#3d2428", alt: ":", altC: "#2a181c", ladder: "#e0c48a", prop: "#8a1e1e" };
  }

  function holding(code, alt) {
    return down.has(code) || (!!alt && down.has(alt));
  }

  function edge(code, alt) {
    return pressed.has(code) || (!!alt && pressed.has(alt));
  }

  function weaponNow() {
    return AR.weaponByName(player.weapon);
  }

  function weaponDamage() {
    const w = weaponNow();
    const mult = player.rage > 0 ? 1.5 : 1;
    return w.damage * mult;
  }

  function shopList() {
    return AR.POWER_UPS.filter((item) => item.unlock_level <= (level ? level.number : 1));
  }

  function ownedCount(item) {
    if (item.kind === "permanent") return player.perm[item.name] || 0;
    return player.stock[item.name] || 0;
  }

  function priceOf(item) {
    const n = item.kind === "permanent" ? (player.perm[item.name] || 0) : 0;
    return item.price + item.price_step * n;
  }

  function readBest(n) {
    try {
      const v = localStorage.getItem(AR.BEST_TIME_PREFIX + n);
      if (v == null || v === "") return null;
      const num = parseFloat(v);
      return Number.isFinite(num) ? num : null;
    } catch (err) {
      return null;
    }
  }

  function writeBest(n, time) {
    try {
      localStorage.setItem(AR.BEST_TIME_PREFIX + n, time.toFixed(3));
    } catch (err) { /* private mode */ }
  }

  function formatTime(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const th = Math.floor((t * 10) % 10);
    return m + ":" + String(s).padStart(2, "0") + "." + th;
  }

  function toast(msg, dur) {
    toastText = msg;
    toastT = dur || 2.4;
  }

  function spawnText(x, y, str, color) {
    floaters.push({ x: x, y: y, str: str, color: color, life: 0.7, vy: -1.6 });
    if (floaters.length > 24) floaters.shift();
  }

  function spawnParticle(ch, color, x, y, vx, vy, life) {
    if (particles.length > 200) particles.shift();
    particles.push({ ch: ch, color: color, x: x, y: y, vx: vx, vy: vy, life: life, max: life });
  }

  function burstFrame(frame, footX, footY, colorFn) {
    const h = frame.length;
    const w = frame[0].length;
    const left = footX - w / 2;
    const top = footY - h;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const ch = frame[r][c];
        if (ch === " ") continue;
        if ((r + c) % 2 === 0) continue;
        spawnParticle(
          AR.degrade(ch, 0.4),
          colorFn(ch, r, c),
          left + c,
          top + r,
          (Math.random() - 0.5) * 7,
          -2 - Math.random() * 5,
          0.35 + Math.random() * 0.35
        );
      }
    }
  }

  function spawnCoins(x, y, count, fromBoss) {
    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.45;
      coins.push({
        x: x + spread,
        y: y,
        vx: spread * 1.4,
        vy: -5 - (i % 3),
        loose: true,
        settled: false,
        secret: false,
        fromBoss: !!fromBoss,
      });
    }
  }

  function spawnProjectile(spec) {
    if (projectiles.length > 70) projectiles.shift();
    projectiles.push({
      x: spec.x, y: spec.y, vx: spec.vx || 0, vy: spec.vy || 0,
      life: spec.life == null ? 3.2 : spec.life,
      gravity: !!spec.gravity,
      gravScale: spec.gravScale == null ? 1 : spec.gravScale,
      arm: spec.arm || 0,
      dropThrough: spec.dropThrough || 0,
      dropped: false,
      hostile: !!spec.hostile,
      friendly: !!spec.friendly,
      damage: spec.damage || 1,
      ch: spec.ch || "*",
      color: spec.color || "#ffffff",
      w: 0.7,
      h: 0.7,
    });
  }

  function hurt(fromX) {
    if (state !== "play" || player.iframe > 0 || player.spawnGrace > 0) return;
    if (player.spin > 0 && fromX != null) return;
    if (player.dashT > 0 || player.slideT > 0 || player.dashAfter > 0) return;
    if (fromX != null) breakCombo();
    if (player.shield) {
      player.shield = false;
      player.iframe = 0.45;
      toast("Shield broke");
      blip(520, 0.08, "triangle", 0.04);
      shake = Math.max(shake, 5);
      return;
    }
    player.hearts -= 1;
    player.iframe = P.IFRAME;
    player.grounded = false;
    player.climbing = false;
    player.climbLock = 0.12;
    if (fromX != null) {
      player.vx = (player.x < fromX ? -1 : 1) * 6.5;
      player.vy = -6.5;
    }
    shake = Math.max(shake, 8);
    blip(70, 0.12, "sawtooth", 0.05);
    spawnText(player.x, player.foot - 2.6, "-1", "#ff4455");
    if (player.hearts <= 0) {
      player.hearts = 0;
      state = "dead";
      menuIndex = 0;
    }
  }

  function damageEnemy(e, dmg, swing) {
    if (!e || e.dead || e.hidden) return;
    if (swing != null && e.hitSwing === swing) return;
    if (swing != null) e.hitSwing = swing;
    noteCombo();
    e.hp -= dmg;
    e.flash = 1;
    spawnText(e.x, e.foot - e.hh - 0.3, "-" + Math.round(dmg), "#ff5a4a");
    blip(160 + Math.min(180, dmg * 3), 0.05, "square", 0.028);
    for (let i = 0; i < 4; i++) {
      spawnParticle("*", "#ff3b30", e.x, e.foot - e.hh * 0.6, (Math.random() - 0.5) * 6, -2 - Math.random() * 3, 0.25);
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    e.deathT = 0.65;
    const info = AR.enemyByName(e.name);
    const vis = AR.enemyFrame(e.name, e.t);
    burstFrame(vis.frame, e.x, e.foot, vis.color);
    spawnCoins(e.x, e.foot - 1.2, info.coin_drop, e.isBoss);
    blip(90, 0.1, "triangle", 0.04);
  }

  function chopTree(tree, swing) {
    if (!tree || tree.gone) return;
    if (tree.hitSwing === swing) return;
    tree.hitSwing = swing;
    tree.hp -= 1;
    tree.flash = 1;
    blip(110, 0.07, "sawtooth", 0.04);
    const def = treeDef(tree);
    for (let i = 0; i < 6; i++) {
      spawnParticle(i % 2 ? "#" : "%", AR.damageColor("#8a5a2b", 1 - tree.hp / tree.maxHp), tree.x, tree.foot - 2, (Math.random() - 0.5) * 5, -2 - Math.random() * 3, 0.35);
    }
    if (tree.hp <= 0) {
      tree.gone = true;
      AR.clearTree(level, tree);
      burstFrame(def.rows, tree.x, tree.foot, def.color);
      spawnCoins(tree.x, tree.foot - 2.2, 1, false);
      spawnText(tree.x, tree.foot - 3, "+1", "#ffe14d");
    } else {
      spawnText(tree.x, tree.foot - 3, "CHOP", "#ffb020");
    }
  }

  function touchingLadder() {
    const xs = [player.x - 0.25, player.x, player.x + 0.25];
    const ys = [player.foot + 0.12, player.foot - 0.2, player.foot - 1.05, player.foot - 1.9];
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < ys.length; j++) {
        if (ladderAt(xs[i], ys[j])) return true;
      }
    }
    return false;
  }

  function ladderColumn() {
    const xs = [player.x, player.x - 0.35, player.x + 0.35];
    const ys = [player.foot - 0.4, player.foot - 1.2, player.foot - 1.8];
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < ys.length; j++) {
        if (ladderAt(xs[i], ys[j])) return Math.floor(xs[i]) + 0.5;
      }
    }
    return null;
  }

  function feetSupported() {
    const box = playerBox();
    if (hitsSolid(box)) return false;
    return hitsSolid({ x: box.x, y: box.y + 0.06, w: box.w, h: box.h });
  }

  function extraJumps() {
    return player.boots ? 2 : 1;
  }

  function tryJump(force) {
    if (force || player.grounded || player.coyote > 0 || feetSupported()) {
      player.vy = P.JUMP_V;
      player.grounded = false;
      player.coyote = 0;
      player.climbing = false;
      player.jumpsLeft = extraJumps();
      player.jumpHold = true;
      player.jumpBuffer = 0;
      player.launchFoot = player.foot;
      player.pounding = false;
      blip(420, 0.06, "square", 0.03);
      return true;
    }
    if (player.jumpsLeft > 0) {
      player.vy = P.JUMP_V;
      player.jumpsLeft -= 1;
      player.climbing = false;
      player.jumpHold = true;
      player.jumpBuffer = 0;
      player.launchFoot = player.foot;
      player.pounding = false;
      blip(520, 0.06, "square", 0.03);
      return true;
    }
    return false;
  }

  /* Same-height hops never fall clearly below the takeoff surface while still airborne. */
  function tryPound() {
    if (player.spin > 0 || player.climbing || player.grounded) return;
    if (player.vy <= 0.4) return;
    if (player.foot <= player.launchFoot + 0.55) return;
    player.pounding = true;
    player.jumpHold = false;
    if (player.dashT > 0) finishDash();
    player.vy = 46;
    blip(90, 0.05, "sawtooth", 0.035);
  }

  function groundImpact() {
    const y = player.foot - 0.4;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.hidden) continue;
      const dx = e.x - player.x;
      const dy = (e.foot - e.hh * 0.5) - y;
      if (Math.hypot(dx, dy) <= 10) damageEnemy(e, 7, null);
    }
    shockwaves.push({
      x: player.x, y: player.foot - 0.15, r: 0.4, prev: 0, max: 10, speed: 10 / 0.36, drops: false, tiny: false, pound: true,
    });
    shake = Math.max(shake, 6);
    blip(70, 0.07, "square", 0.04);
  }

  function noteCombo() {
    if (combo.t <= 0) combo.n = 0;
    combo.n += 1;
    combo.t = 2;
    combo.pop = 0.14;
  }

  function breakCombo() {
    combo.n = 0;
    combo.t = 0;
    combo.pop = 0;
  }

  function cashCombo() {
    const n = combo.n;
    combo.n = 0;
    combo.t = 0;
    if (n <= 0 || !player) return;
    spawnCoins(player.x, player.foot - 1.2, n, true);
  }

  function updateCombo(dt) {
    if (combo.pop > 0) combo.pop = Math.max(0, combo.pop - dt);
    if (combo.t <= 0) return;
    combo.t -= dt;
    if (combo.t <= 0) cashCombo();
  }

  function weaponString(w) {
    const ext = player.wpnExtend || 0;
    const full = w.sprite;
    if (w.name === "Iron Spear") {
      const dashes = ext < 0.08 ? 2 : Math.round(2 + ext * 6);
      const n = Math.max(2, Math.min(8, dashes));
      return "o" + "-".repeat(n) + ">";
    }
    if (w.name === "Rusty Sword") {
      if (ext < 0.34) return "|>";
      if (ext < 0.67) return "-|>";
      return full;
    }
    if (w.name === "Flame Blade") {
      if (ext < 0.34) return "~|>";
      if (ext < 0.67) return "~~|>";
      return full;
    }
    if (w.name === "Crossbow") {
      if (ext < 0.45) return "|->";
      return full;
    }
    return full;
  }

  function trailStyle(name) {
    if (name === "Rusty Sword") return { glyphs: "/-~", colors: ["#8a5a2b", "#c4924a"] };
    if (name === "Iron Spear") return { glyphs: "=-", colors: ["#c5ccd6", "#8d97a3"] };
    if (name === "Flame Blade") return { glyphs: "~*^", colors: ["#ff7a18", "#ffd24a"] };
    return { glyphs: "~", colors: ["#e6ebf2"] };
  }

  function spawnSwingTrail(w) {
    const style = trailStyle(w.name);
    const aim = player.aim || "side";
    const reach = Math.max(2, weaponString(w).length);
    const p = player.atkDur > 0 ? 1 - player.atkT / player.atkDur : 0.5;
    for (let k = 0; k < 2; k++) {
      const along = (0.3 + Math.random() * 0.7) * reach * 0.42;
      let x = player.x + player.facing * (0.7 + along);
      let y = player.foot - 1.5 + Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 1.05;
      if (aim === "up") {
        x = player.x + (Math.random() - 0.5) * 0.8;
        y = player.foot - 2.05 - along;
      } else if (aim === "down") {
        x = player.x + (Math.random() - 0.5) * 0.8;
        y = player.foot - 0.15 + along * 0.65;
      } else {
        y += (Math.random() - 0.5) * 0.35;
      }
      const color = style.colors[(k + Math.floor(simTime * 24)) % style.colors.length];
      const ch = style.glyphs[Math.floor(Math.random() * style.glyphs.length)];
      trails.push({
        x: x, y: y, ch: ch, color: color, life: 0.2, max: 0.2,
        vx: aim === "side" ? player.facing * 2.2 : (Math.random() - 0.5) * 1.5,
        vy: aim === "up" ? -1.4 : aim === "down" ? 1.6 : (Math.random() - 0.5) * 1.2,
      });
    }
    if (trails.length > 80) trails.splice(0, trails.length - 80);
  }

  function updateTrails(dt) {
    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      t.life -= dt;
      t.x += (t.vx || 0) * dt;
      t.y += (t.vy || 0) * dt;
    }
    trails = trails.filter((t) => t.life > 0);
  }

  function spawnHitRipple(x, y) {
    shockwaves.push({
      x: x, y: y, r: 0.18, prev: 0, max: 1.15, speed: 6.4, drops: false, tiny: true,
    });
  }

  function startAxe() {
    player.axeDur = P.AXE_TIME;
    player.axeT = P.AXE_TIME;
    player.axeSwing = ++swingSerial;
    player.axeDid = false;
    player.axeAlt = player.axeAlt === 0 ? 1 : 0;
    player.axeStop = false;
    blip(240, 0.04, "square", 0.02);
  }

  function finishDash() {
    player.dashT = 0;
    player.dashLeft = 0;
    player.dashDir = 0;
    player.dashAfter = 0.15;
  }

  function beatAt(alt, dur, remaining) {
    const order = alt === 1 ? [6, 5, 4, 3, 2, 1, 0, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
    const scale = dur > 0 ? dur / 0.32 : 1;
    let elapsed = dur - remaining;
    if (elapsed < 0) elapsed = 0;
    for (let i = 0; i < order.length; i++) {
      const beat = SWING_BEATS[order[i]];
      const span = beat.dur * scale;
      if (elapsed < span || i === order.length - 1) return beat;
      elapsed -= span;
    }
    return SWING_BEATS[order[order.length - 1]];
  }

  function swingPose() {
    return beatAt(player.swingAlt, player.atkDur, player.atkT);
  }

  function axePose() {
    const dur = player.axeDur > 0 ? player.axeDur : P.AXE_TIME;
    return beatAt(player.axeAlt, dur, player.axeT);
  }

  function upCrescentBox() {
    const pose = swingPose();
    const src = pose.frame < AR.SWORD_UP.length ? AR.SWORD_UP[pose.frame] : AR.SWORD_UP_READY;
    const rows = player.facing < 0 ? src.map(AR.mirrorLine) : src;
    let ar = 0;
    let ac = 0;
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].indexOf("@");
      if (c >= 0) { ar = r; ac = c; break; }
    }
    let minC = -1;
    let maxC = -1;
    let top = ar;
    for (let r = 0; r < ar; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === " ") continue;
        if (minC < 0 || c < minC) minC = c;
        if (c > maxC) maxC = c;
        if (r < top) top = r;
      }
    }
    if (top === ar || minC < 0) return { x: player.x - 1.2, y: player.foot - 6.2, w: 2.4, h: 3.6 };
    return {
      x: player.x + (minC - ac) - 0.45,
      y: player.foot - 2 + (top - ar) - 0.2,
      w: (maxC - minC) + 1.9,
      h: (ar - top) + 0.05,
    };
  }

  function swordBox() {
    const aim = player.aim || "side";
    if (aim === "up") return upCrescentBox();
    if (aim === "down") return { x: player.x - 1.5, y: player.foot - 0.3, w: 3, h: 7.2 };
    const h = 3.4;
    const y = player.foot - 3.2;
    if (player.facing >= 0) return { x: player.x + 0.15, y: y, w: 7.6, h: h };
    return { x: player.x - 0.15 - 7.6, y: y, w: 7.6, h: h };
  }

  function resolveDashHits() {
    const x0 = Math.min(player.prevX, player.x) - 0.75;
    const x1 = Math.max(player.prevX, player.x) + 0.75;
    const top = player.foot - 2.45;
    const bot = player.foot + 0.2;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.hidden) continue;
      const b = enemyBox(e);
      if (b.x + b.w < x0 || b.x > x1) continue;
      if (b.y + b.h < top || b.y > bot) continue;
      damageEnemy(e, 5, player.dashSwing);
    }
  }

  function startWeapon() {
    const w = weaponNow();
    player.aim = weaponAim();
    player.atkDid = false;
    player.atkSwing = ++swingSerial;
    if (w.range === "melee") {
      player.atkT = 0.32;
      player.atkDur = 0.32;
      player.atkCd = Math.max(w.attack_delay, 0.32);
      player.swingAlt = player.swingAlt === 0 ? 1 : 0;
      player.swingStop = false;
    } else {
      player.atkCd = w.attack_delay;
      player.atkT = Math.min(0.26, w.attack_delay);
      player.atkDur = Math.max(0.12, player.atkT);
    }
    blip(w.range === "ranged" ? 680 : 300, 0.05, "square", 0.03);
    if (w.range === "ranged") {
      player.atkDid = true;
      const face = player.facing >= 0 ? 1 : -1;
      let x = player.x + face * 1.2;
      let y = player.foot - 1.55;
      let vx = face * 22;
      let vy = 0;
      let ch = face > 0 ? ">" : "<";
      let dropThrough = 0;
      if (player.aim === "up") {
        x = player.x;
        y = player.foot - 2.55;
        vx = 0;
        vy = -22;
        ch = "^";
      } else if (player.aim === "down") {
        x = player.x;
        y = player.foot - 0.35;
        vx = 0;
        vy = 22;
        ch = "v";
        dropThrough = 0.14;
      }
      spawnProjectile({
        x: x, y: y, vx: vx, vy: vy,
        friendly: true,
        damage: weaponDamage(),
        ch: ch,
        color: "#f7f7f7",
        life: 1.5,
        dropThrough: dropThrough,
      });
    }
  }

  function resolveAxe() {
    const box = attackBox(3.2);
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.hidden) continue;
      if (overlap(box, enemyBox(e))) damageEnemy(e, P.AXE_DAMAGE, player.axeSwing);
    }
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (tree.gone) continue;
      if (overlap(box, treeBox(tree))) chopTree(tree, player.axeSwing);
    }
  }

  function resolveWeapon() {
    const w = weaponNow();
    if (w.range !== "melee") return;
    const box = swordBox();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead || e.hidden) continue;
      if (overlap(box, enemyBox(e))) damageEnemy(e, weaponDamage(), player.atkSwing);
    }
    if (w.name === "Flame Blade") {
      for (let i = 0; i < 3; i++) {
        spawnParticle("~", i % 2 ? "#ffd24a" : "#ff6a1a", box.x + Math.random() * box.w, box.y + box.h * 0.5, player.facing * 2, -0.4, 0.2);
      }
    }
  }

  function useConsumable(slot) {
    const name = player.belt[slot];
    if (!name) return;
    const item = AR.POWER_UPS.find((p) => p.name === name);
    if (!item) return;
    if (item.name === "Heart Potion") {
      if (player.hearts >= player.maxHearts) {
        toast("Hearts are already full");
        return;
      }
      player.hearts += 1;
      blip(660, 0.08, "sine", 0.04);
      spawnText(player.x, player.foot - 2.8, "+1", "#ff5577");
    } else if (item.name === "Bubble Shield") {
      if (player.shield) {
        toast("Shield already up");
        return;
      }
      player.shield = true;
      blip(740, 0.08, "sine", 0.04);
    } else if (item.name === "Rage Tonic") {
      player.rage = 15;
      blip(200, 0.1, "sawtooth", 0.04);
      toast("Rage x1.5 for 15s");
    } else if (item.name === "Bullet Dropper") {
      const maxR = coverRadius();
      shockwaves.push({
        x: player.x, y: player.foot - 1.2, r: 0.3, prev: 0, max: maxR, speed: maxR / 0.62, drops: true,
      });
      blip(180, 0.12, "square", 0.04);
    } else if (item.name === "Spin Ball") {
      player.spin = 5;
      player.spinBounce = 0;
      player.climbing = false;
      if (!player.facing) player.facing = 1;
      blip(360, 0.1, "square", 0.045);
      toast("Spin Ball 5s");
    } else {
      return;
    }
    player.stock[name] -= 1;
    if (player.stock[name] <= 0) {
      player.stock[name] = 0;
      const at = player.belt.indexOf(name);
      if (at >= 0) player.belt.splice(at, 1);
    }
  }

  function coverRadius() {
    const tilesX = viewW / cellW;
    const tilesY = viewH / cellH;
    const px = player.x - camX;
    const py = (player.foot - 1.2) - camY;
    const corners = [[0, 0], [tilesX, 0], [0, tilesY], [tilesX, tilesY]];
    let m = 0;
    for (let i = 0; i < corners.length; i++) {
      m = Math.max(m, Math.hypot(corners[i][0] - px, corners[i][1] - py));
    }
    return m + 1.5;
  }

  function buySelected() {
    const list = shopList();
    const item = list[menuIndex];
    if (!item) return;
    if (ownedCount(item) >= item.max_owned) {
      shopMsg = "Cannot carry any more";
      shopMsgT = 1.6;
      blip(80, 0.08, "square", 0.03);
      return;
    }
    const price = priceOf(item);
    if (player.coins < price) {
      shopMsg = "not enough coins";
      shopMsgT = 1.6;
      blip(80, 0.08, "square", 0.03);
      return;
    }
    player.coins -= price;
    if (item.kind === "permanent") {
      player.perm[item.name] = (player.perm[item.name] || 0) + 1;
      if (item.name === "Heart Container") {
        player.maxHearts += 1;
        player.hearts += 1;
      }
      if (item.name === "Double Jump Boots") {
        player.boots = true;
        player.jumpsLeft = Math.max(player.jumpsLeft, extraJumps());
      }
    } else {
      player.stock[item.name] = (player.stock[item.name] || 0) + 1;
      if (!player.belt.includes(item.name)) player.belt.push(item.name);
    }
    shopMsg = "Bought " + item.name;
    shopMsgT = 1.2;
    blip(880, 0.07, "square", 0.04);
  }

  function activateMenu() {
    const items = state === "dead"
      ? ["Retry Level", "Main Menu"]
      : ["Resume", "Retry Level", "Main Menu"];
    const choice = items[menuIndex];
    if (choice === "Resume") state = "play";
    else if (choice === "Retry Level") retryLevel();
    else toTitle();
  }

  function retryLevel() {
    if (!snapshot) return;
    restoreSnapshot(snapshot);
    loadLevel(snapshot.number, snapshot.seed);
    timer = 0;
    bannerT = 2.2;
    state = "play";
  }

  function toTitle() {
    state = "title";
    level = null;
    player = makePlayer();
    enemies = [];
    menuIndex = 0;
    titleIndex = 0;
  }

  function beginRun() {
    player = makePlayer();
    pendingLevel = 1;
    pendingSeed = randSeed();
    grantLevelWeapon(1);
    weaponIndex = player.weapons.length - 1;
    state = "weapon";
    combo = { n: 0, t: 0, pop: 0 };
    trails = [];
    blip(520, 0.08, "square", 0.04);
  }

  function startWipe(fn) {
    click = null;
    wipe = { t: 0, dur: 0.8, fn: fn, fired: false, from: state, back: state };
    state = "wipe";
  }

  function updateWipe(dt) {
    if (!wipe) {
      state = "title";
      return;
    }
    click = null;
    wipe.t += dt;
    if (!wipe.fired && wipe.t >= wipe.dur * 0.46) {
      wipe.fired = true;
      wipe.fn();
      wipe.back = state;
      state = "wipe";
    }
    if (wipe.t >= wipe.dur) {
      state = wipe.back || "title";
      wipe = null;
    }
  }

  function beginPlay() {
    player.weapon = player.weapons[weaponIndex];
    loadLevel(pendingLevel, pendingSeed);
    snapshot = takeSnapshot();
    timer = 0;
    bannerT = 3.5;
    simTime = 0;
    state = "play";
  }

  function finishLevel() {
    if (cleared) return;
    cleared = true;
    const prev = readBest(level.number);
    const record = prev == null || timer < prev;
    if (record) writeBest(level.number, timer);
    clearInfo = { time: timer, prev: prev, record: record, number: level.number, name: level.name };
    state = "clear";
    blip(720, 0.14, "triangle", 0.04);
  }

  function nextAfterClear() {
    if (clearInfo.number >= 3) {
      state = "win";
      menuIndex = 0;
      return;
    }
    pendingLevel = clearInfo.number + 1;
    pendingSeed = randSeed();
    grantLevelWeapon(pendingLevel);
    weaponIndex = player.weapons.length - 1;
    state = "weapon";
  }

  function blockedAhead(e, dir) {
    const ax = e.x + dir * 0.85;
    const ground = solidAt(ax, e.foot + 0.25);
    const wall = solidAt(ax, e.foot - 0.55) || solidAt(ax, e.foot - 1.3);
    return !ground || wall;
  }

  function updateWalker(e, dt, info) {
    e.vy = Math.min(P.MAX_FALL, e.vy + P.GRAVITY * dt);
    e.foot += e.vy * dt;
    if (e.vy >= 0 && solidAt(e.x, e.foot + 0.05)) {
      e.foot = Math.floor(e.foot + 0.05);
      e.vy = 0;
      e.grounded = true;
    } else {
      e.grounded = false;
    }
    // Near a player, face them. If that way is a lip or a wall, wait there.
    // Turning around and chasing again on the next step shakes the sprite on the near edge.
    const engaged = Math.abs(player.x - e.x) < 10 && Math.abs(player.foot - e.foot) < 4;
    if (engaged) {
      const want = Math.sign(player.x - e.x);
      if (want) e.dir = want;
    }
    const lip = e.grounded && blockedAhead(e, e.dir);
    if (lip) {
      if (!engaged && !blockedAhead(e, -e.dir)) e.dir *= -1;
    } else if (e.grounded) {
      e.x += e.dir * info.speed * dt;
    }
    if (info.hop) {
      e.hopT -= dt;
      if (e.grounded && e.hopT <= 0 && !solidAt(e.x, e.foot - 2.2)) {
        e.vy = -8.2;
        e.grounded = false;
        e.hopT = 0.75 + Math.random() * 0.35;
      }
    }
    if (e.isBoss) {
      if (e.x < level.arenaStart + 3) { e.x = level.arenaStart + 3; e.dir = 1; }
      if (e.x > level.arenaEnd - 4) { e.x = level.arenaEnd - 4; e.dir = -1; }
    }
  }

  function updateFlyer(e, dt, info) {
    e.t += dt;
    const hover = e.homeY + Math.sin(e.t * 2.5 + e.homeX) * 0.8;
    const engaged = Math.abs(player.x - e.homeX) < 9 && Math.abs(player.foot - e.floor) < 8;
    if (engaged) {
      const want = Math.sign(player.x - e.x);
      if (want) e.dir = want;
    } else if (Math.abs(e.x - e.homeX) > 5.1) {
      e.dir = e.x > e.homeX ? -1 : 1;
    }
    const nx = e.x + e.dir * info.speed * dt;
    const offLeash = Math.abs(nx - e.homeX) > 5.5;
    const hitSolid = solidAt(nx, hover) || solidAt(nx, hover - 0.8);
    // Same lip bug as walkers: reversing toward the player, then back, flickers on the near block.
    if (!offLeash && !hitSolid) e.x = nx;
    else if (!engaged) e.dir *= -1;
    e.foot = hover;
    if (info.invis) e.hidden = (e.t % 4.6) > 3.05;
    else e.hidden = false;
  }

  function shootAtPlayer(e, info) {
    const dir = Math.sign(player.x - e.x) || e.dir;
    e.dir = dir;
    const originY = e.foot - Math.max(0.8, e.hh * 0.55);
    const dy = (player.foot - 1.2) - originY;
    const muzzle = e.x + dir * (e.hw * 0.65);
    if (info.shoot === "bullet") {
      spawnProjectile({
        x: muzzle, y: originY, vx: dir * info.shootSpeed,
        vy: Math.max(-2.1, Math.min(2.1, dy * 0.25)),
        hostile: true, ch: dir > 0 ? ">" : "<", color: "#f3f3f3",
      });
    } else if (info.shoot === "bone") {
      spawnProjectile({
        x: muzzle, y: originY, vx: dir * info.shootSpeed, vy: -2.4,
        gravity: true, hostile: true, ch: "~", color: "#efe6cf",
      });
    } else if (info.shoot === "bolt") {
      const len = Math.hypot(player.x - e.x, dy) || 1;
      spawnProjectile({
        x: e.x, y: originY,
        vx: ((player.x - e.x) / len) * info.shootSpeed,
        vy: (dy / len) * info.shootSpeed,
        hostile: true, ch: "*", color: "#35d0ff",
      });
    }
    spawnParticle("*", "#ffe9a0", muzzle, originY, dir * 2, 0, 0.12);
  }

  function launchBossShot(ox, oy, aimX, aimY, speed, ch, color) {
    const dx = aimX - ox;
    const dy = aimY - oy;
    const dist = Math.hypot(dx, dy) || 1;
    const t = Math.max(0.35, dist / speed);
    const gravScaleTry = 0.16;
    const g = P.GRAVITY * gravScaleTry;
    let vx = dx / t;
    let vy = (dy - 0.5 * g * t * t) / t;
    let gravScale = gravScaleTry;
    if (Math.hypot(vx, vy) > speed * 1.2) {
      vx = (dx / dist) * speed;
      vy = (dy / dist) * speed;
      gravScale = 0;
    }
    spawnProjectile({
      x: ox,
      y: oy,
      vx: vx,
      vy: vy,
      gravity: gravScale > 0,
      gravScale: gravScale,
      hostile: true,
      ch: ch,
      color: color,
      life: 3.6,
      arm: 0.14,
    });
  }

  function bossChase(e, dt, speed, hop) {
    const dir = Math.sign(player.x - e.x) || e.dir || 1;
    e.dir = dir;
    e.vy = Math.min(P.MAX_FALL, e.vy + P.GRAVITY * dt);
    e.foot += e.vy * dt;
    if (e.vy >= 0 && solidAt(e.x, e.foot + 0.05)) {
      e.foot = Math.floor(e.foot + 0.05);
      e.vy = 0;
      e.grounded = true;
    } else {
      e.grounded = false;
    }
    if (e.grounded && !blockedAhead(e, dir)) e.x += dir * speed * dt;
    else if (e.grounded && blockedAhead(e, dir)) {
      e.vy = -12.5;
      e.grounded = false;
    }
    if (hop && e.grounded) {
      e.hopT -= dt;
      if (e.hopT <= 0 && Math.abs(player.x - e.x) > 1.2) {
        e.vy = -11.5;
        e.grounded = false;
        e.hopT = 0.48 + Math.random() * 0.22;
      }
    }
    const left = 2.4;
    const right = level.width - 2.8;
    if (e.x < left) e.x = left;
    if (e.x > right) e.x = right;
  }

  function updateBoss(e, dt) {
    e.t += dt;
    e.shootT -= dt;
    e.specialT -= dt;
    if (e.name === "Demon Lord") {
      const tx = player.x;
      const ty = Math.max(4.5, Math.min(level.ground - 3.2, player.foot - 4.8));
      const dx = tx - e.x;
      e.dir = Math.sign(dx) || e.dir || -1;
      if (e.dashT > 0) {
        e.dashT -= dt;
        e.x += e.dashV * dt;
      } else {
        e.x += e.dir * 5.6 * dt;
      }
      e.foot += (ty - e.foot) * Math.min(1, dt * 3.4);
      if (e.x < 3) e.x = 3;
      if (e.x > level.width - 3.4) e.x = level.width - 3.4;
      if (e.foot > level.ground - 2.2) e.foot = level.ground - 2.2;
      if (e.foot < 4) e.foot = 4;
      if (e.shootT <= 0) {
        e.shootT = 0.78;
        const oy = e.foot - 1.5;
        launchBossShot(e.x, oy, player.x, player.foot - 1.65, 7.8, "@", "#ff5a1f");
        launchBossShot(e.x, oy, player.x, player.foot - 2.35, 6.4, "@", "#ffd24a");
        launchBossShot(e.x, oy + 0.3, player.x + (dx >= 0 ? 2.4 : -2.4), player.foot - 1.45, 8.5, "*", "#c6ff6a");
      }
      if (e.specialT <= 0) {
        e.specialT = 2.35;
        e.dashT = 0.36;
        e.dashV = (Math.sign(player.x - e.x) || e.dir) * 16;
        e.dir = Math.sign(e.dashV) || e.dir;
      }
      return;
    }
    if (e.name === "Spider") {
      bossChase(e, dt, 7.7, true);
      if (e.shootT <= 0) {
        e.shootT = 0.66;
        const ox = e.x + e.dir * 1.35;
        const oy = e.foot - 1.35;
        launchBossShot(ox, oy, player.x, player.foot - 1.7, 7.5, "*", "#c6ff6a");
        launchBossShot(ox, oy - 0.15, player.x, player.foot - 2.2, 8.8, "*", "#9dff4a");
        launchBossShot(ox - e.dir * 0.4, oy + 0.1, player.x, player.foot - 1.35, 6.3, "o", "#d6ff6a");
      }
      return;
    }
    bossChase(e, dt, 4.8, false);
    if (e.shootT <= 0) {
      e.shootT = 1.25;
      const ox = e.x + e.dir * 1.5;
      launchBossShot(ox, e.foot - 2.5, player.x, player.foot - 1.6, 7.4, "O", "#d5dbe3");
      launchBossShot(ox, e.foot - 1.9, player.x, player.foot - 2.05, 6.1, "O", "#ffb020");
    }
    if (e.specialT <= 0) {
      e.specialT = 2.05;
      const dir = Math.sign(player.x - e.x) || e.dir || 1;
      e.dir = dir;
      for (let i = 0; i < 3; i++) {
        spawnProjectile({
          x: e.x + dir * (1.5 + i * 0.85),
          y: e.foot - 1.6,
          vx: dir * (7.4 + i),
          vy: 0,
          hostile: true,
          ch: "=",
          color: i === 1 ? "#ffb020" : "#e7d7b1",
          life: 2.8,
          arm: 0.12,
        });
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) {
        e.deathT -= dt;
        continue;
      }
      e.flash = Math.max(0, e.flash - dt * 5);
      if (e.spinCd > 0) e.spinCd = Math.max(0, e.spinCd - dt);
      const info = AR.enemyByName(e.name);
      if (e.isBoss || info.move === "boss") updateBoss(e, dt);
      else if (info.move === "fly") updateFlyer(e, dt, info);
      else {
        e.t += dt;
        updateWalker(e, dt, info);
      }
      if (!e.dead && info.shoot && !e.hidden) {
        e.shootT -= dt;
        const dx = player.x - e.x;
        const dy = player.foot - e.foot;
        if (e.shootT <= 0 && Math.abs(dx) < 24 && Math.abs(dy) < 7) {
          e.shootT = info.shootEvery;
          shootAtPlayer(e, info);
        }
      }
      if (!e.dead && !e.hidden && player.spin > 0 && overlap(spinBox(), enemyBox(e))) {
        if ((e.spinCd || 0) <= 0) {
          e.spinCd = 0.5;
          const dir = player.x <= e.x ? -1 : 1;
          player.facing = dir;
          player.spinBounce = 0.5;
          if (player.vy > -4.2) player.vy = -4.2;
          player.grounded = false;
          player.climbing = false;
          damageEnemy(e, 15, null);
          blip(240, 0.06, "square", 0.03);
        }
      } else if (!e.dead && !e.hidden) {
        const box = enemyBox(e);
        if (feetLandedOn(box)) {
          damageEnemy(e, P.AXE_DAMAGE, null);
          spawnStompRipple(e.x, box.y + 0.3);
          bounceStomp();
        } else if (info.contact !== false && overlap(playerBox(), box)) {
          if (!(player.stompRise > 0 && player.vy < 0) && landingIsFree()) hurt(e.x);
        }
      }
    }
    const kept = [];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead && e.deathT <= 0 && !e.isBoss) continue;
      kept.push(e);
    }
    enemies = kept;
  }

  function updateProjectiles(dt) {
    for (let s = 0; s < shockwaves.length; s++) {
      const wave = shockwaves[s];
      const prev = wave.r;
      wave.r += wave.speed * dt;
      if (!wave.drops) continue;
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        if (!p.hostile || p.dropped) continue;
        const d = Math.hypot(p.x - wave.x, p.y - wave.y);
        if (d <= wave.r + 0.35 && d >= prev - 0.35) {
          p.dropped = true;
          p.vx = 0;
          p.gravity = true;
        }
      }
    }
    shockwaves = shockwaves.filter((w) => w.r < w.max);

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.dropped || p.gravity) {
        const scale = p.dropped ? 1 : (p.gravScale == null ? 1 : p.gravScale);
        p.vy = Math.min(P.MAX_FALL, p.vy + P.GRAVITY * scale * dt);
      }
      if (p.dropped) p.vx = 0;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.arm > 0) p.arm -= dt;
      if (p.dropThrough > 0) p.dropThrough -= dt;
      const box = { x: p.x - 0.35, y: p.y - 0.35, w: 0.7, h: 0.7 };
      const earlier = { x: box.x - p.vx * dt, y: box.y - p.vy * dt, w: box.w, h: box.h };
      const spun = player.spin > 0 && (overlap(box, spinBox()) || overlap(earlier, spinBox()) || overlap(box, playerBox()));
      if (p.life > 0 && p.hostile && p.arm <= 0 && spun) {
        p.life = 0;
      } else if (p.life > 0 && p.hostile && p.arm <= 0) {
        if (feetLandedOn(box) || feetLandedOn(earlier)) {
          noteCombo();
          bounceStomp();
          spawnStompRipple(p.x, p.y);
          p.life = 0;
        } else if (overlap(box, playerBox())) {
          hurt(p.x);
          p.life = 0;
        }
      } else if (p.life > 0 && p.friendly) {
        for (let k = 0; k < enemies.length; k++) {
          const e = enemies[k];
          if (e.dead || e.hidden) continue;
          if (overlap(box, enemyBox(e))) {
            damageEnemy(e, p.damage, null);
            spawnHitRipple(p.x, p.y);
            p.life = 0;
            break;
          }
        }
      }
      if (p.life > 0 && p.dropped && solidAt(p.x, p.y + 0.2)) p.life = 0;
      if (p.life > 0 && !p.dropped && p.dropThrough <= 0 && (solidAt(p.x, p.y) || solidAt(p.x, p.y + 0.25))) {
        if (p.friendly) spawnHitRipple(p.x, p.y);
        p.life = 0;
      }
    }
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  /* Sprite feet sit about a tile either side of the 0.78-wide body, so a stomp uses that span.
     Horizontal test is where the feet crossed the surface, so landing beside a tall enemy does not count. */
  function feetLandedOn(box) {
    if (!box) return false;
    const descended = player.foot > player.prevFoot + 0.08;
    if (!(player.prevVy > 0.35 || descended)) return false;
    const surface = box.y;
    if (player.prevFoot > surface + 0.55) return false;
    if (player.foot < surface - 0.2) return false;
    const drop = player.foot - player.prevFoot;
    let t = 1;
    if (drop > 0.001) t = (surface - player.prevFoot) / drop;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const crossX = player.prevX + (player.x - player.prevX) * t;
    const reach = 1.3;
    return crossX + reach > box.x && crossX - reach < box.x + box.w;
  }

  function bounceStomp() {
    player.vy = -9.4;
    player.grounded = false;
    player.climbing = false;
    player.coyote = 0;
    player.stompRise = 0.28;
    blip(720, 0.05, "square", 0.03);
  }

  function spawnStompRipple(x, y) {
    shockwaves.push({
      x: x, y: y, r: 0.36, prev: 0, max: 1.28, speed: 5.1, drops: false, tiny: true,
    });
  }

  function findSafeRespawn(deathX) {
    let best = null;
    let bestDist = 1e9;
    const limit = Math.min(level.width - 2, Math.ceil(deathX) + 42);
    const start = Math.max(2, Math.floor(deathX) - 42);
    for (let x = start; x <= limit; x++) {
      let surface = -1;
      for (let y = 2; y < level.height - 1; y++) {
        const solidHere = level.solid[idx(x, y)] === 1;
        const solidAbove = level.solid[idx(x, y - 1)] === 1;
        if (solidHere && !solidAbove) {
          if (surface < 0 || Math.abs(y - level.ground) < Math.abs(surface - level.ground)) surface = y;
        }
      }
      if (surface < 0) continue;
      if (solidAt(x + 0.2, surface - 1) || solidAt(x + 0.2, surface - 2)) continue;
      const body = playerBox(x + 0.5, surface);
      const wide = { x: body.x - 4, y: body.y - 0.6, w: body.w + 8, h: body.h + 1.2 };
      let crowded = false;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.dead || e.hidden) continue;
        if (overlap(wide, enemyBox(e))) crowded = true;
      }
      if (crowded) continue;
      const dist = Math.abs(x - deathX) + Math.abs(surface - level.ground) * 0.4;
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: x + 0.5, foot: surface };
      }
    }
    if (best) return best;
    return { x: level.spawn.x, foot: level.spawn.foot };
  }

  function updateCoins(dt) {
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.loose && !c.settled) {
        c.vy = Math.min(16, c.vy + P.GRAVITY * 0.65 * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.vy > 0 && solidAt(c.x, c.y + 0.15)) {
          c.y = Math.floor(c.y + 0.15) - 0.05;
          c.vy = 0;
          c.vx *= 0.2;
          c.settled = true;
        }
      }
      const magnet = c.fromBoss ? 7.5 : 1.35;
      const dx = player.x - c.x;
      const dy = (player.foot - 1.1) - c.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < magnet && dist > 0.2) {
        c.x += (dx / dist) * (c.fromBoss ? 10 : 3) * dt;
        c.y += (dy / dist) * (c.fromBoss ? 10 : 3) * dt;
        c.loose = true;
      }
      if (dist < 1.05) {
        player.coins += 1;
        coins.splice(i, 1);
        blip(990, 0.04, "square", 0.025);
        spawnText(player.x, player.foot - 2.4, "+1", "#ffe14d");
      }
    }
  }

  function updatePlayer(dt) {
    player.prevX = player.x;
    player.prevFoot = player.foot;
    player.prevVy = player.vy;
    if (player.stompRise > 0) player.stompRise = Math.max(0, player.stompRise - dt);
    const left = holding("KeyA", "ArrowLeft");
    const right = holding("KeyD", "ArrowRight");
    const jumpUp = holding("ArrowUp");
    const downKey = holding("KeyS", "ArrowDown");
    if (left && !right) player.facing = -1;
    if (right && !left) player.facing = 1;

    player.climbLock = Math.max(0, player.climbLock - dt);
    const onLad = touchingLadder();
    const grab = player.spin <= 0 && player.climbLock <= 0 && onLad && (jumpUp || downKey);
    if (grab) {
      player.climbing = true;
      player.grounded = false;
      player.jumpHold = false;
      player.pounding = false;
      player.vy = jumpUp && !downKey ? -P.CLIMB : downKey && !jumpUp ? P.CLIMB : 0;
      if (!left && !right) {
        const col = ladderColumn();
        if (col != null) player.x += (col - player.x) * Math.min(1, dt * 12);
      }
    } else if (player.climbing && onLad && !jumpUp && !downKey) {
      player.vy = 0;
    } else {
      player.climbing = false;
    }

    if (player.jumpBuffer > 0) player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    if (edge("Space") || (edge("ArrowUp") && !onLad)) {
      const fromLadder = player.climbing || onLad;
      if (fromLadder) {
        player.climbLock = 0.18;
        player.climbing = false;
      }
      if (!tryJump(fromLadder)) player.jumpBuffer = 0.1;
    }
    if (player.downGap > 0) player.downGap = Math.max(0, player.downGap - dt);
    if (edge("ArrowDown")) {
      if (player.downGap > 0) tryPound();
      player.downGap = 0.28;
    }

    player.vx = (right ? 1 : 0) - (left ? 1 : 0);
    if (player.spin > 0 && player.vx === 0) player.vx = player.facing || 1;
    if (player.spin > 0 && player.spinBounce > 0 && !left && !right) player.vx *= 1.28;
    player.vx *= P.SPEED;

    if (player.dashCd > 0) player.dashCd = Math.max(0, player.dashCd - dt);
    if (player.dashAfter > 0) player.dashAfter = Math.max(0, player.dashAfter - dt);
    let slideEnded = false;
    if (player.slideT > 0) {
      player.slideT = Math.max(0, player.slideT - dt);
      if (!holding("ArrowDown") && player.slideT < 0.22) player.slideT = 0;
      if (player.slideT <= 0) slideEnded = true;
    }
    if (slideEnded) player.dashAfter = 0.15;
    const shift = holding("ShiftLeft") || holding("ShiftRight");
    const dashDir = holding("ArrowRight") ? 1 : (holding("ArrowLeft") ? -1 : 0);
    const canDash = player.spin <= 0 && !player.climbing && !player.pounding && player.dashCd <= 0 && player.dashT <= 0 && player.slideT <= 0;
    if (canDash && shift && dashDir) {
      player.dashSwing = ++swingSerial;
      player.facing = dashDir;
      if (holding("ArrowDown") && player.grounded) {
        player.slideT = 0.34;
        player.dashCd = 0.48;
        player.dashFrom = player.x;
      } else if (!holding("ArrowDown")) {
        player.dashT = 1;
        player.dashLeft = DASH_DIST;
        player.dashDir = dashDir;
        player.dashFrom = player.x;
        player.dashCd = 0.55;
        player.dashAfter = 0;
        player.climbing = false;
      }
    }
    if (player.slideT > 0) player.vx = player.facing * P.SPEED * 2.15;
    else if (player.dashT > 0) {
      const step = DASH_DIST / DASH_TIME;
      const cap = dt > 0 ? player.dashLeft / dt : step;
      player.vx = player.dashDir * Math.min(step, Math.max(0, cap));
      player.climbing = false;
    }

    const wantCrouch = player.grounded && !player.climbing && player.spin <= 0 && player.dashT <= 0 && player.slideT <= 0 && holding("ArrowDown");
    player.crouch = wantCrouch;
    if (wantCrouch) player.vx *= 0.62;

    if (!player.climbing) {
      player.vy = Math.min(P.MAX_FALL, player.vy + P.GRAVITY * dt);
    }
    if (player.jumpHold) {
      const holdingJump = holding("Space") || holding("ArrowUp");
      if (player.vy >= 0 || !holdingJump) {
        if (player.vy < 0 && !holdingJump) player.vy *= 0.45;
        player.jumpHold = false;
      }
    }
    if (player.pounding) player.vy = 46;

    let leftTime = dt;
    const step = 1 / 180;
    while (leftTime > 0) {
      const h = Math.min(step, leftTime);
      integrate(h);
      leftTime -= h;
    }
    if (player.dashT > 0 || player.slideT > 0) resolveDashHits();
    if (player.dashT > 0 && dt > 0) {
      const moved = Math.max(0, (player.x - player.prevX) * player.dashDir);
      const budget = player.dashLeft;
      player.dashLeft = budget - moved;
      const planned = Math.min(budget, (DASH_DIST / DASH_TIME) * dt);
      if (player.dashLeft <= 0.05 || moved < planned * 0.4) finishDash();
    }
    if (player.poundHit) {
      player.poundHit = false;
      groundImpact();
    }
    if (player.landed && player.jumpBuffer > 0) {
      tryJump(true);
      player.jumpBuffer = 0;
    }
    player.landed = false;

    if (player.grounded) {
      player.coyote = P.COYOTE;
      player.safeT += dt;
      if (player.safeT > 0.18) {
        if (!bossFight || player.x > level.gateColumn + 1.5) {
          player.spawnX = player.x;
          player.spawnFoot = player.foot;
        }
      }
      if (Math.abs(player.vx) > 1) {
        player.walkDist += Math.abs(player.vx) * dt;
        player.walkTime += dt;
      }
    } else {
      player.coyote = Math.max(0, player.coyote - dt);
      player.safeT = 0;
    }

    if (player.x < 1.3) player.x = 1.3;
    if (player.x > level.arenaEnd - 1.2) player.x = level.arenaEnd - 1.2;
    if (player.foot < 1.5) {
      player.foot = 1.5;
      if (player.vy < 0) player.vy = 0;
    }

    player.axeHold = player.spin > 0 ? false : holding("KeyE");
    if (player.axeT > 0) {
      player.axeT = Math.max(0, player.axeT - dt);
      if (player.axeT > 0) {
        const pose = axePose();
        if (pose.hit) resolveAxe();
        if (pose.stop && !player.axeStop) {
          player.axeStop = true;
          hitStop = 0.048;
          shake = Math.max(shake, 3);
        }
      }
    }
    if (player.axeHold && player.axeT <= 0) startAxe();

    if (player.atkT <= 0) player.aim = weaponAim();
    if (player.atkCd > 0) player.atkCd -= dt;
    if (player.atkT > 0) player.atkT -= dt;
    if (player.spin <= 0 && player.atkCd <= 0 && holding("KeyF")) startWeapon();
    const wantExtend = player.atkT > 0 ? 1 : 0;
    const extendRate = player.atkT > 0 ? 14 : 9;
    player.wpnExtend += (wantExtend - player.wpnExtend) * Math.min(1, dt * extendRate);
    if (player.atkT > 0 && weaponNow().range === "melee") {
      const pose = swingPose();
      if (pose.hit) resolveWeapon();
      if (pose.stop && !player.swingStop) {
        player.swingStop = true;
        hitStop = 0.048;
        shake = Math.max(shake, 3);
      }
    }

    const slot = digitEdge();
    if (slot) useConsumable(slot - 1);

    if (player.rage > 0) player.rage = Math.max(0, player.rage - dt);
    if (player.spin > 0) player.spin = Math.max(0, player.spin - dt);
    if (player.spin <= 0) player.spinBounce = 0;
    else if (player.spinBounce > 0) player.spinBounce = Math.max(0, player.spinBounce - dt);
    if (player.iframe > 0) player.iframe -= dt;
    if (player.spawnGrace > 0) player.spawnGrace = Math.max(0, player.spawnGrace - dt);

    if (player.foot > level.height + 2) {
      const doomed = player.iframe <= 0 && player.spawnGrace <= 0;
      const spot = findSafeRespawn(player.x);
      player.x = spot.x;
      player.foot = spot.foot;
      player.prevX = spot.x;
      player.prevFoot = spot.foot;
      player.prevVy = 0;
      player.vx = 0;
      player.vy = 0;
      player.grounded = true;
      player.climbing = false;
      player.pounding = false;
      player.jumpHold = false;
      player.dashT = 0;
      player.dashLeft = 0;
      player.dashDir = 0;
      player.dashAfter = 0;
      player.slideT = 0;
      player.crouch = false;
      player.spawnX = spot.x;
      player.spawnFoot = spot.foot;
      if (doomed) hurt(null);
      player.spawnGrace = Math.max(player.spawnGrace, 0.85);
    }
  }

  function digitEdge() {
    for (let i = 1; i <= 5; i++) {
      if (pressed.has("Digit" + i) || pressed.has("Numpad" + i)) return i;
    }
    return 0;
  }

  function integrate(h) {
    player.x += player.vx * h;
    if (hitsSolid(playerBox())) {
      player.x -= player.vx * h;
      const dir = Math.sign(player.vx);
      if (dir) {
        for (let n = 0; n < 8; n++) {
          player.x += dir * 0.02;
          if (hitsSolid(playerBox())) {
            player.x -= dir * 0.02;
            break;
          }
        }
      }
      player.vx = 0;
    }

    const start = player.foot;
    player.foot += player.vy * h;
    if (hitsSolid(playerBox())) {
      player.foot = start;
      if (player.vy > 0) {
        for (let n = 0; n < 10; n++) {
          player.foot += 0.02;
          if (hitsSolid(playerBox())) {
            player.foot -= 0.02;
            break;
          }
          if (player.foot >= start + player.vy * h) break;
        }
        if (!player.grounded) player.landed = true;
        if (player.pounding) {
          player.poundHit = true;
          player.pounding = false;
        }
        player.grounded = true;
        player.vy = 0;
        player.jumpHold = false;
        player.jumpsLeft = extraJumps();
      } else if (player.vy < 0) {
        player.vy = 0;
        player.grounded = false;
      }
    } else if (!player.climbing && player.vy !== 0) {
      if (player.grounded && player.vy > 0 && !player.jumpHold) player.launchFoot = player.prevFoot;
      player.grounded = false;
    }
  }

  function updatePlay(dt) {
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt);
      return;
    }
    if (edge("Escape")) {
      state = "pause";
      menuIndex = 0;
      return;
    }
    if (edge("KeyK")) {
      if (bossFight) toast("The shop is closed during boss fights!");
      else openStore("play");
      return;
    }

    timer += dt;
    simTime += dt;
    if (bannerT > 0) bannerT -= dt;
    if (toastT > 0) toastT -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 28);

    updatePlayer(dt);
    if (state !== "play") return;
    for (let i = 0; i < trees.length; i++) {
      if (trees[i].flash > 0) trees[i].flash = Math.max(0, trees[i].flash - dt * 4);
    }
    updateEnemies(dt);
    updateProjectiles(dt);
    updateCoins(dt);
    updateTrails(dt);
    updateCombo(dt);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;
      p.vy += 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (let i = 0; i < floaters.length; i++) {
      floaters[i].life -= dt;
      floaters[i].y += floaters[i].vy * dt;
    }
    floaters = floaters.filter((f) => f.life > 0);

    if (state === "play" && !gateDone && !bossFight && level.doorX != null && player.x > level.doorX - 1.55) {
      state = "gate";
      gateIndex = 0;
      player.vx = 0;
      return;
    }

    const boss = bossAliveRecord();
    if (boss && boss.dead && boss.deathT <= 0 && !cleared) {
      const pending = coins.some((c) => c.fromBoss);
      if (!pending) finishLevel();
      else {
        bossWait += dt;
        if (bossWait > 4) {
          for (let i = 0; i < coins.length; i++) if (coins[i].fromBoss) player.coins += 1;
          coins = coins.filter((c) => !c.fromBoss);
          finishLevel();
        }
      }
    }

    const tilesX = viewW / cellW;
    const tilesY = viewH / cellH;
    if (level.bossRoom) {
      camX = (level.width - tilesX) / 2;
      camY = (level.height - tilesY) / 2;
    } else {
      let tx = player.x - tilesX * 0.38;
      let ty = player.foot - tilesY * 0.68;
      tx = Math.max(0, Math.min(tx, Math.max(0, level.width - tilesX)));
      ty = Math.max(0, Math.min(ty, Math.max(0, level.height - tilesY)));
      camX += (tx - camX) * Math.min(1, dt * 5);
      camY += (ty - camY) * Math.min(1, dt * 5);
    }
  }

  function buildBossRoom(src) {
    const cols = Math.max(22, Math.ceil(viewW / Math.max(1, cellW)));
    const rows = 32;
    const ground = rows - 5;
    const solid = new Uint8Array(cols * rows);
    const ladder = new Uint8Array(cols * rows);
    function set(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      solid[y * cols + x] = 1;
    }
    for (let x = 0; x < cols; x++) {
      set(x, 0);
      for (let y = ground; y < rows; y++) set(x, y);
    }
    for (let y = 0; y < rows; y++) {
      set(0, y);
      set(cols - 1, y);
    }
    const platY = ground - 4;
    const seg = Math.max(4, Math.min(9, Math.floor((cols - 14) / 2)));
    if (cols > 20) {
      for (let x = 4; x < 4 + seg; x++) set(x, platY);
      for (let x = cols - 5 - seg; x < cols - 5; x++) set(x, platY);
    }
    return {
      number: src.number,
      name: src.name,
      seed: src.seed,
      boss: src.boss,
      entry: src.entry,
      weaponReward: src.weaponReward,
      width: cols,
      height: rows,
      ground: ground,
      solid: solid,
      ladder: ladder,
      platforms: [],
      trees: [],
      enemies: [],
      coins: [],
      torches: [
        { x: 3, foot: ground, phase: 0.2 },
        { x: cols - 4, foot: ground, phase: 2.1 },
      ],
      props: [],
      gateColumn: -20,
      doorX: null,
      arenaStart: 2,
      arenaEnd: cols - 1,
      seal: [],
      spawn: { x: 5.5, foot: ground },
      bossRoom: true,
    };
  }

  function bossAliveRecord() {
    for (let i = 0; i < enemies.length; i++) if (enemies[i].isBoss) return enemies[i];
    return null;
  }

  function confirmGate() {
    gateDone = true;
    bossFight = true;
    const src = level;
    const room = buildBossRoom(src);
    level = room;
    enemies = [];
    projectiles = [];
    particles = [];
    shockwaves = [];
    coins = [];
    trees = [];
    const boss = spawnEnemy({
      name: room.boss,
      x: Math.max(12, room.width - 8),
      foot: room.boss === "Demon Lord" ? room.ground - 6 : room.ground,
      dir: -1,
      homeX: room.width * 0.62,
      homeY: room.ground - 6,
      floor: room.ground,
    }, true);
    boss.shootT = 0.4;
    boss.specialT = 0.9;
    enemies.push(boss);
    player.x = 5.5;
    player.foot = room.ground;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.climbing = false;
    player.spawnX = player.x;
    player.spawnFoot = player.foot;
    player.spawnGrace = Math.max(player.spawnGrace, 0.85);
    camX = 0;
    camY = 0;
    state = "play";
    toast(room.boss + " awakens");
  }

  function openStore(back) {
    storeReturn = back || "play";
    state = "store";
    menuIndex = 0;
    shopMsg = "";
    shopMsgT = 0;
  }

  function closeStore() {
    state = storeReturn || "play";
    menuIndex = 0;
  }

  function openBook() {
    state = "book";
    bookPage = 0;
    bookFlip = 0;
    bookFlipT = 0;
    bookNext = 0;
  }

  function updateMenus(dt) {
    if (shopMsgT > 0) shopMsgT -= dt;
    if (state === "title") {
      if (edge("KeyS", "ArrowDown") || edge("Tab")) titleIndex = Math.min(1, titleIndex + 1);
      if (edge("KeyW", "ArrowUp")) titleIndex = Math.max(0, titleIndex - 1);
      if (edge("Enter") || edge("Space")) {
        if (titleIndex === 0) startWipe(beginRun);
        else openBook();
      }
    } else if (state === "book") {
      updateBook(dt);
    } else if (state === "weapon") {
      const n = player.weapons.length;
      if (edge("KeyW", "ArrowUp")) weaponIndex = (weaponIndex - 1 + n) % n;
      if (edge("KeyS", "ArrowDown")) weaponIndex = (weaponIndex + 1) % n;
      if (edge("Enter") || edge("Space")) startWipe(beginPlay);
    } else if (state === "store") {
      const n = shopList().length;
      if (edge("KeyW", "ArrowUp")) menuIndex = (menuIndex - 1 + n) % n;
      if (edge("KeyS", "ArrowDown")) menuIndex = (menuIndex + 1) % n;
      if (edge("Enter")) buySelected();
      if (edge("KeyK") || edge("Escape")) closeStore();
    } else if (state === "pause" || state === "dead") {
      const n = state === "dead" ? 2 : 3;
      if (edge("Tab") || edge("KeyS", "ArrowDown")) menuIndex = (menuIndex + 1) % n;
      if (edge("KeyW", "ArrowUp")) menuIndex = (menuIndex - 1 + n) % n;
      if (edge("Enter") || edge("Space")) activateMenu();
      if (state === "pause" && edge("Escape")) state = "play";
    } else if (state === "gate") {
      if (edge("KeyS", "ArrowDown") || edge("Tab")) gateIndex = Math.min(1, gateIndex + 1);
      if (edge("KeyW", "ArrowUp")) gateIndex = Math.max(0, gateIndex - 1);
      if (edge("Enter") || edge("Space")) {
        if (gateIndex === 0) openStore("gate");
        else confirmGate();
      }
    } else if (state === "clear") {
      if (edge("Enter") || edge("Space")) startWipe(nextAfterClear);
    } else if (state === "win") {
      if (edge("Enter") || edge("Space") || edge("Escape")) toTitle();
    }
  }

  function handleClick() {
    if (!click) return;
    const at = click;
    click = null;
    for (let i = 0; i < hot.length; i++) {
      const h = hot[i];
      if (at.x >= h.x && at.x <= h.x + h.w && at.y >= h.y && at.y <= h.y + h.h) {
        h.action();
        return;
      }
    }
  }

  function drawChar(px, py, ch, color, alpha) {
    if (!ch || ch === " ") return;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, px + cellW * 0.5, py + cellH * 0.55);
  }

  function drawString(px, py, str, color) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(str, px, py);
  }

  function textWidth(str) {
    return ctx.measureText(str).width;
  }

  function fitText(str, maxPx) {
    const full = String(str);
    if (!(maxPx > 0)) return "";
    if (textWidth(full) <= maxPx) return full;
    const ell = "..";
    if (textWidth(ell) > maxPx) return "";
    let s = full;
    while (s.length > 0 && textWidth(s + ell) > maxPx) s = s.slice(0, -1);
    return s + ell;
  }

  function wrapPx(str, maxPx) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let cur = "";
    for (let i = 0; i < words.length; i++) {
      const next = cur ? cur + " " + words[i] : words[i];
      if (cur && textWidth(next) > maxPx) {
        lines.push(cur);
        cur = words[i];
      } else cur = next;
    }
    if (cur) lines.push(fitText(cur, maxPx));
    return lines;
  }

  /* rAF timestamps can sit a few ms behind performance.now(), and JS % keeps the sign of a negative dividend. */
  function animIndex(time, rate, count) {
    if (!count) return 0;
    let idx = Math.floor(time * rate) % count;
    if (!Number.isFinite(idx)) return 0;
    if (idx < 0) idx += count;
    return idx;
  }

  function paintFrame(frame, footX, footY, colorFn, opt) {
    opt = opt || {};
    if (!frame || !frame.length || frame[0] == null) return;
    const h = frame.length;
    const w = frame[0].length;
    const rows = opt.flip ? frame.map(AR.mirrorLine) : frame;
    const left = footX - w / 2 + (opt.ox || 0);
    const top = footY - h + (opt.oy || 0);
    const dmg = opt.damage || 0;
    for (let r = 0; r < h; r++) {
      const shift = opt.rowShift ? opt.rowShift(r) : 0;
      const line = rows[r];
      for (let c = 0; c < line.length; c++) {
        let ch = line[c];
        if (ch === " ") continue;
        if (opt.ghost) ch = ".";
        let color = opt.ghost ? "#3c4a66" : colorFn(ch, r, c);
        if (!opt.ghost && dmg > 0) {
          ch = AR.degrade(ch, dmg);
          color = AR.damageColor(color, dmg);
        }
        if (opt.flash > 0) color = AR.mixHex(color, "#ffffff", Math.min(1, opt.flash));
        if (shade > 0) color = AR.mixHex(color, "#000000", shade);
        const px = (left + c + shift - camX) * cellW + shx;
        const py = (top + r - camY) * cellH + shy;
        if (px < -cellW || py < -cellH || px > viewW || py > viewH) continue;
        drawChar(px, py, ch, color, opt.alpha);
      }
    }
  }

  function worldOrigin(tx, ty) {
    return [(tx - camX) * cellW + shx, (ty - camY) * cellH + shy];
  }

  function renderWorld() {
    const th = theme();
    const x0 = Math.max(0, Math.floor(camX) - 1);
    const y0 = Math.max(0, Math.floor(camY) - 1);
    const x1 = Math.min(level.width - 1, Math.ceil(camX + viewW / cellW) + 1);
    const y1 = Math.min(level.height - 1, Math.ceil(camY + viewH / cellH) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        let ch = "";
        let color = "#fff";
        if (level.ladder[i]) {
          ch = "H";
          color = th.ladder;
        } else if (level.solid[i]) {
          const seal = gateDone && x === level.gateColumn && y < level.ground && y >= level.ground - 18;
          const aboveSolid = y > 0 && level.solid[idx(x, y - 1)] === 1;
          if (seal) {
            ch = "#";
            color = "#f0e2b0";
          } else if (!aboveSolid) {
            ch = th.top;
            color = th.topC;
          } else if ((x * 17 + y * 13) % 7 === 0) {
            ch = th.alt;
            color = th.altC;
          } else {
            ch = th.fill;
            color = th.fillC;
          }
        } else if (!gateDone && x === level.gateColumn && y < level.ground && y >= level.ground - 18 && (y % 2 === 0)) {
          ch = ":";
          color = "#6a6430";
        }
        if (!ch) continue;
        if (shade > 0) color = AR.mixHex(color, "#000000", shade);
        const p = worldOrigin(x, y);
        if (p[0] < -cellW || p[1] < -cellH || p[0] > viewW || p[1] > viewH) continue;
        drawChar(p[0], p[1], ch, color, 1);
      }
    }

    if (!level.bossRoom && !gateDone && level.doorX != null) {
      const art = ["+-+", "| |", "| |", "|o|", "| |", "| |", "+-+"];
      const left = level.doorX - 2;
      const top = level.ground - art.length;
      for (let r = 0; r < art.length; r++) {
        for (let c = 0; c < art[r].length; c++) {
          const ch = art[r][c];
          if (ch === " ") continue;
          const p = worldOrigin(left + c, top + r);
          drawChar(p[0], p[1], ch, "#f0e2b0", 1);
        }
      }
    }

    for (let i = 0; i < level.props.length; i++) {
      const prop = level.props[i];
      for (let k = 0; k < prop.h; k++) {
        let ch = "|";
        let color = th.prop;
        if (prop.kind === "vine") ch = k === prop.h - 1 ? "v" : "|";
        if (prop.kind === "banner") {
          ch = k === 0 ? "=" : ">";
          color = "#c43636";
        }
        if (shade > 0) color = AR.mixHex(color, "#000000", shade);
        const p = worldOrigin(prop.x, prop.y + k);
        drawChar(p[0], p[1], ch, color, 1);
      }
    }

    for (let i = 0; i < level.torches.length; i++) {
      const torch = level.torches[i];
      const frames = AR.TORCH_FRAMES;
      const fi = animIndex(simTime + torch.phase / 7, 7, frames.length);
      paintFrame(frames[fi], torch.x + 0.2, torch.foot, AR.torchColor, {});
    }

    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      if (tree.gone) continue;
      const def = treeDef(tree);
      const ratio = 1 - tree.hp / tree.maxHp;
      paintFrame(def.rows, tree.x + 0.5, tree.foot, def.color, {
        damage: ratio,
        flash: tree.flash,
        rowShift: function (row) {
          if (row >= def.canopy) return 0;
          const gust = Math.sin(simTime * 0.55) > 0.86 ? 1.85 : 1;
          const amp = (0.22 + (def.canopy - row) * 0.05) * gust * (0.55 + 0.45 * (tree.hp / tree.maxHp));
          return Math.sin(simTime * 1.7 + tree.phase + row * 0.65) * amp;
        },
      });
    }

    const coinFrame = AR.COIN_FRAMES[animIndex(simTime, 6, AR.COIN_FRAMES.length)];
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      const bob = c.settled || !c.loose ? Math.sin(simTime * 4 + c.x) * 0.12 : 0;
      paintFrame([coinFrame], c.x + 0.2, c.y + 1 + bob, AR.coinColor, {});
    }

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      const vis = AR.enemyFrame(e.name, e.t);
      const hop = AR.enemyByName(e.name).hop && !e.grounded ? -0.35 : 0;
      paintFrame(vis.frame, e.x, e.foot + hop, vis.color, {
        flip: e.dir < 0 && e.name !== "Slime" && e.name !== "Bat" && e.name !== "Floating Eye" && e.name !== "Spider",
        damage: 1 - e.hp / e.maxHp,
        flash: e.flash,
        ghost: e.hidden,
        alpha: e.hidden ? 0.4 : 1,
      });
    }

    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      let ch = p.ch;
      if (p.dropped) ch = "*";
      if ((ch === ">" || ch === "<") && p.vx < 0) ch = "<";
      if ((ch === ">" || ch === "<") && p.vx > 0) ch = ">";
      const color = shade > 0 ? AR.mixHex(p.color, "#000000", shade) : p.color;
      const o = worldOrigin(p.x, p.y);
      if (!p.dropped && Math.abs(p.vx) + Math.abs(p.vy) > 5) {
        const tail = worldOrigin(p.x - Math.sign(p.vx || 1) * 0.7, p.y - Math.sign(p.vy) * 0.25);
        drawChar(tail[0], tail[1], p.gravity ? "." : "-", color, 0.8);
      }
      drawChar(o[0], o[1], ch, color, 1);
    }

    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      const color = shade > 0 ? AR.mixHex(t.color, "#000000", shade) : t.color;
      const o = worldOrigin(t.x, t.y);
      drawChar(o[0], o[1], t.ch, color, Math.max(0, t.life / t.max));
    }

    for (let i = 0; i < shockwaves.length; i++) drawShock(shockwaves[i]);

    drawPlayer();

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const color = shade > 0 ? AR.mixHex(p.color, "#000000", shade) : p.color;
      const o = worldOrigin(p.x, p.y);
      drawChar(o[0], o[1], p.ch, color, Math.max(0, p.life / p.max));
    }
    for (let i = 0; i < floaters.length; i++) {
      const f = floaters[i];
      const o = worldOrigin(f.x, f.y);
      drawString(o[0], o[1], f.str, f.color);
    }
  }

  function drawShock(wave) {
    const tiny = !!wave.tiny;
    const n = tiny ? 6 : Math.max(12, Math.floor((Math.PI * 2 * wave.r) / 1.45));
    const aspect = cellH > 0 ? cellW / cellH : 0.6;
    const ry = tiny ? wave.r * aspect : wave.r;
    const alpha = tiny ? Math.max(0.35, 1 - wave.r / wave.max) : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (tiny ? 0 : simTime);
      const x = wave.x + Math.cos(a) * wave.r;
      const y = wave.y + Math.sin(a) * ry;
      const ch = tiny ? "*o.+*o"[i] : "*+o."[i % 4];
      let color = tiny ? (i % 2 === 0 ? "#fff6d0" : "#ffe14d") : (i % 2 === 0 ? "#fff3b0" : "#ffe14d");
      if (shade > 0) color = AR.mixHex(color, "#000000", shade);
      const o = worldOrigin(x, y);
      if (o[0] < -cellW || o[1] < -cellH || o[0] > viewW || o[1] > viewH) continue;
      drawChar(o[0], o[1], ch, color, alpha);
    }
    if (wave.pound) {
      const reach = Math.min(wave.max, wave.r);
      const steps = Math.floor(reach);
      const alpha = Math.max(0.45, 1 - wave.r / (wave.max + 0.01));
      for (let i = -steps; i <= steps; i++) {
        const ch = Math.abs(i) === steps ? "*" : (Math.abs(i) % 2 ? "=" : "-");
        let color = Math.abs(i) > reach * 0.65 ? "#ffb020" : "#ffe14d";
        if (shade > 0) color = AR.mixHex(color, "#000000", shade);
        const o = worldOrigin(wave.x + i, wave.y);
        if (o[0] < -cellW || o[1] < -cellH || o[0] > viewW || o[1] > viewH) continue;
        drawChar(o[0], o[1], ch, color, alpha);
      }
    }
  }

  function drawSpinBall() {
    const frame = AR.SPIN_BALL[animIndex(simTime, 14, AR.SPIN_BALL.length)];
    paintFrame(frame, player.x, player.foot, AR.spinBallColor, {});
    const ang = simTime * 16;
    for (let i = 0; i < 3; i++) {
      const a = ang + i * (Math.PI * 2 / 3);
      const o = worldOrigin(player.x + Math.cos(a) * 1.05, player.foot - 1.15 + Math.sin(a) * 0.7);
      drawChar(o[0], o[1], i === 0 ? "*" : ".", i === 0 ? "#ff4455" : "#ffe14d", 0.9);
    }
  }

  function trailTint(name, index) {
    if (name === "Flame Blade") return index % 2 === 0 ? "#ff7a18" : "#ffd24a";
    if (name === "Iron Spear") return index % 2 === 0 ? "#c5ccd6" : "#8d97a3";
    return index % 2 === 0 ? "#8a5a2b" : "#c4924a";
  }

  function orientSword(frame) {
    let rows = frame;
    const aim = player.aim || "side";
    if (aim === "up") rows = AR.rotateFrame(rows, -1);
    else if (aim === "down") rows = AR.rotateFrame(rows, 1);
    else if (player.facing < 0) rows = rows.map(AR.mirrorLine);
    return rows;
  }

  function orientFacing(frame) {
    if (player.facing < 0) return frame.map(AR.mirrorLine);
    return frame;
  }

  function meleeFrame(pose) {
    const up = (player.aim || "side") === "up";
    if (up) {
      const src = pose && pose.frame < AR.SWORD_UP.length ? AR.SWORD_UP[pose.frame] : AR.SWORD_UP_READY;
      return orientFacing(src);
    }
    const src = pose && pose.frame < AR.SWORD_SWING.length ? AR.SWORD_SWING[pose.frame] : AR.PLAYER_READY;
    return orientSword(src);
  }

  function swordInk(frame, name) {
    let ac = 1;
    let ar = 0;
    for (let r = 0; r < frame.length; r++) {
      const c = frame[r].indexOf("@");
      if (c >= 0) { ac = c; ar = r; break; }
    }
    return function (ch, r, c) {
      if (ch === "@" || ch === "O") return "#ffd7a8";
      const body = Math.abs(c - ac) <= 1 && r > ar;
      if (body && (ch === "/" || ch === "\\" || ch === "|")) {
        return r > ar + 1 ? "#1d6fbe" : "#3aa0ff";
      }
      return trailTint(name, c + r);
    };
  }

  function axeInk(frame) {
    let ac = 1;
    let ar = 0;
    for (let r = 0; r < frame.length; r++) {
      const c = frame[r].indexOf("@");
      if (c >= 0) { ac = c; ar = r; break; }
    }
    return function (ch, r, c) {
      if (ch === "@" || ch === "O") return "#ffd7a8";
      const body = Math.abs(c - ac) <= 1 && r >= ar;
      if (body && (ch === "/" || ch === "\\" || ch === "|")) {
        return r > ar + 1 ? "#1d6fbe" : "#3aa0ff";
      }
      if (ch === "^" || ch === "v" || ch === ">" || ch === "<") return "#f4f7fb";
      if (ch === "+" || ch === "|") return "#c4924a";
      return (c + r) % 2 === 0 ? "#c5ccd6" : "#8d97a3";
    };
  }

  function paintAnchored(frame, colorFn, headDrop) {
    let ac = 0;
    let ar = 0;
    let found = false;
    for (let r = 0; r < frame.length; r++) {
      const c = frame[r].indexOf("@");
      if (c >= 0) { ac = c; ar = r; found = true; break; }
    }
    if (!found) {
      paintFrame(frame, player.x, player.foot, colorFn, {});
      return;
    }
    const w = frame[0].length;
    const h = frame.length;
    paintFrame(frame, player.x, player.foot, colorFn, {
      ox: w / 2 - ac,
      oy: h - ar - 2 + (headDrop || 0),
    });
  }

  function drawDashStreak() {
    if (!(player.dashT > 0 || player.slideT > 0 || player.dashAfter > 0)) return;
    const x0 = player.dashFrom;
    const x1 = player.x;
    const dir = Math.sign(x1 - x0) || player.facing || 1;
    const steps = Math.min(DASH_DIST, Math.floor(Math.abs(x1 - x0)));
    const fade = player.dashT > 0 || player.slideT > 0 ? 0.9 : Math.max(0, player.dashAfter / 0.15) * 0.7;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + dir * i;
      const o = worldOrigin(x, player.foot - 1.15);
      const ch = i % 3 === 0 ? "=" : "-";
      drawChar(o[0], o[1], ch, "#d5dbe3", fade * (0.35 + 0.65 * (i / Math.max(1, steps))));
    }
  }

  function drawPlayer() {
    if (player.spin > 0) {
      drawSpinBall();
      return;
    }
    if (player.iframe > 0 && Math.floor(simTime * 16) % 2 === 0) return;
    drawDashStreak();
    const melee = weaponNow().range === "melee";
    let frame = AR.PLAYER_WALK[0];
    let swordPose = false;
    let axePoseOn = false;
    let headDrop = 0;
    if (player.dashT > 0) {
      const traveled = DASH_DIST - Math.max(0, player.dashLeft);
      frame = orientFacing(AR.PLAYER_DASH[Math.floor(traveled * 1.5) % AR.PLAYER_DASH.length]);
    } else if (player.slideT > 0) {
      frame = orientFacing(AR.PLAYER_SLIDE[animIndex(simTime, 14, AR.PLAYER_SLIDE.length)]);
      headDrop = 1;
    } else if (player.atkT > 0 && melee) {
      frame = meleeFrame(swingPose());
      swordPose = true;
    } else if (player.atkT > 0) {
      const frames = AR.PLAYER_ATTACK;
      const p = player.atkDur > 0 ? 1 - player.atkT / player.atkDur : 1;
      const idx = Math.floor(Math.max(0, Math.min(0.999, p)) * frames.length);
      frame = orientFacing(frames[idx]);
    } else if (player.axeT > 0) {
      const pose = axePose();
      const src = pose.frame < AR.AXE_SWING.length ? AR.AXE_SWING[pose.frame] : AR.AXE_READY;
      frame = orientFacing(src);
      axePoseOn = true;
    } else if (player.crouch) {
      frame = orientFacing(AR.PLAYER_CROUCH);
      headDrop = 1;
    } else if (player.climbing) {
      frame = orientFacing(AR.PLAYER_CLIMB[Math.floor(simTime * 6) % 2]);
    } else if (!player.grounded) {
      frame = orientFacing(AR.PLAYER_JUMP);
    } else if (Math.abs(player.vx) > 1) {
      frame = orientFacing(AR.PLAYER_WALK[animIndex(player.walkTime, 1 / 0.11, AR.PLAYER_WALK.length)]);
    } else if (melee) {
      frame = meleeFrame(null);
      swordPose = true;
    } else {
      frame = orientFacing(AR.PLAYER_WALK[0]);
    }

    if (swordPose) paintAnchored(frame, swordInk(frame, weaponNow().name));
    else if (axePoseOn) paintAnchored(frame, axeInk(frame));
    else paintAnchored(frame, AR.playerColors, headDrop);

    if (!(swordPose || axePoseOn)) {
      paintFrame(["|"], player.x - player.facing * 0.15, player.foot - 0.35, function () { return "#c4924a"; }, {});
      if (!melee) {
        const wpn = weaponNow();
        let lunge = 0;
        if (player.atkT > 0) {
          const p = 1 - player.atkT / player.atkDur;
          lunge = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI) * 1.1;
        }
        drawHeldWeapon(wpn, player.aim || "side", lunge);
      }
    }

    if (player.shield) {
      const c = "#7ee0ff";
      const a = worldOrigin(player.x - 1.35, player.foot - 2.3);
      const b = worldOrigin(player.x + 0.7, player.foot - 2.3);
      drawChar(a[0], a[1], "(", c, 0.9);
      drawChar(a[0], a[1] + cellH, "(", c, 0.9);
      drawChar(b[0], b[1], ")", c, 0.9);
      drawChar(b[0], b[1] + cellH, ")", c, 0.9);
    }
  }

  function drawHeldWeapon(wpn, aim, lunge) {
    const sprite = weaponString(wpn);
    const colorOf = function (ch, c) { return AR.weaponColors(wpn.name, ch, c); };
    if (aim === "side") {
      const len = sprite.length;
      const base = player.facing > 0
        ? player.x + 0.35 + lunge + len / 2
        : player.x - 0.35 - lunge - len / 2;
      paintFrame([sprite], base, player.foot - 0.85, function (ch, r, c) {
        return colorOf(ch, c);
      }, { flip: player.facing < 0 });
      return;
    }
    const dir = aim === "up" ? -1 : 1;
    const origin = aim === "up" ? player.foot - 2.15 - lunge : player.foot + 0.05 + lunge * 0.35;
    for (let i = 0; i < sprite.length; i++) {
      let ch = sprite[player.facing < 0 ? sprite.length - 1 - i : i];
      if (aim === "up" && ch === ">") ch = "^";
      if (aim === "up" && ch === "<") ch = "^";
      if (aim === "down" && (ch === ">" || ch === "<")) ch = "v";
      if (ch === " ") continue;
      const o = worldOrigin(player.x - 0.15, origin + dir * i * 0.72);
      drawChar(o[0], o[1], ch, colorOf(ch, i), 1);
    }
  }

  function drawArcade(key, x, y, size) {
    const img = arcade[key];
    if (!img) return false;
    ctx.globalAlpha = 1;
    ctx.drawImage(img, x, y, size, size);
    return true;
  }

  function wrapText(str, max) {
    const words = String(str).split(/\s+/);
    const lines = [];
    let cur = "";
    for (let i = 0; i < words.length; i++) {
      const next = cur ? cur + " " + words[i] : words[i];
      if (next.length > max && cur) {
        lines.push(cur);
        cur = words[i];
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function statLines(item) {
    const lines = [];
    if (item.heal) lines.push("Heal: " + item.heal + " heart");
    if (item.block) lines.push("Blocks: " + item.block + " hit");
    if (item.damage_mult) lines.push("Weapon damage: x" + item.damage_mult);
    if (item.duration) lines.push("Duration: " + item.duration + " seconds");
    if (item.touch) lines.push("Damage: " + item.touch);
    if (item.hearts) lines.push("Max hearts: +" + item.hearts);
    if (item.name === "Double Jump Boots") lines.push("Extra jumps: 1");
    if (item.name === "Bullet Dropper") lines.push("Radius: the whole visible screen");
    lines.push("Held: " + ownedCount(item) + "/" + item.max_owned);
    return lines;
  }

  function renderHud() {
    const heartSize = Math.max(22, cellH * 1.65);
    for (let i = 0; i < player.maxHearts; i++) {
      const filled = i < player.hearts;
      const ox = 12 + i * (heartSize + 6);
      const key = filled ? "heart" : "heartEmpty";
      if (!drawArcade(key, ox, 8, heartSize)) {
        const heart = ["/v\\", "\\./"];
        const color = filled ? "#ff3355" : "#40262c";
        for (let r = 0; r < heart.length; r++) {
          for (let c = 0; c < heart[r].length; c++) {
            drawChar(ox + c * cellW, 8 + r * cellH, heart[r][c], color, 1);
          }
        }
      }
    }
    const coinY = 8 + cellH * 2.3;
    drawString(12, coinY, "($) " + player.coins, "#ffe14d");
    const timeStr = formatTime(timer);
    const title = level.name + "   " + timeStr;
    drawString((viewW - ctx.measureText(title).width) / 2, 10, title, "#f2f2f2");

    const wpn = weaponNow();
    const wLabel = wpn.sprite + "  " + wpn.name;
    drawString(viewW - 16 - ctx.measureText(wLabel).width, 10, wLabel, player.rage > 0 ? "#ff9a3c" : "#d5dbe3");
    if (player.rage > 0) {
      const rs = "x1.5  " + player.rage.toFixed(1) + "s";
      drawString(viewW - 16 - ctx.measureText(rs).width, 10 + cellH, rs, "#ff7a18");
    }
    if (player.spin > 0) {
      const ss = "SPIN " + player.spin.toFixed(1) + "s";
      const sy = 10 + cellH * (player.rage > 0 ? 2 : 1);
      drawString(viewW - 16 - ctx.measureText(ss).width, sy, ss, "#ffe14d");
    }
    if (combo.n > 0) {
      const comboY = Math.min(viewH * 0.42, viewH - cellH * 8);
      drawString(16, comboY, "COMBO", "#ffb14a");
      const numPx = Math.min(cellH * 2.15, 48) * (1 + (combo.pop || 0) * 0.85);
      withFont(numPx, function () {
        drawString(16, comboY + cellH * 1.2, String(combo.n), "#ffe14d");
      });
    }

    let hx = 12;
    const hy = viewH - cellH * 5.2;
    const spots = [];
    for (let i = 0; i < player.belt.length; i++) {
      const name = player.belt[i];
      const icon = AR.ICONS[name];
      const iconSize = Math.max(28, cellH * 2.15);
      drawString(hx, hy - cellH * 0.95, String(i + 1), "#ffe14d");
      let drawn = drawArcade(name, hx, hy, iconSize);
      if (!drawn) {
        for (let r = 0; r < icon.rows.length; r++) {
          for (let c = 0; c < icon.rows[r].length; c++) {
            const ch = icon.rows[r][c];
            if (ch === " ") continue;
            drawChar(hx + c * cellW, hy + r * cellH, ch, icon.color(ch, r, c), 1);
          }
        }
      }
      const count = "x" + (player.stock[name] || 0);
      const countY = hy + (drawn ? iconSize : icon.rows.length * cellH);
      drawString(hx, countY, count, "#f2f2f2");
      const spotW = drawn ? iconSize : Math.max(4, icon.rows[0].length) * cellW;
      const spotH = (drawn ? iconSize : icon.rows.length * cellH) + cellH * 2;
      spots.push({ x: hx, y: hy - cellH, w: spotW, h: spotH, name: name });
      hx += spotW + cellW * 1.4;
    }
    hx += cellW;
    for (let i = 0; i < AR.POWER_UPS.length; i++) {
      const item = AR.POWER_UPS[i];
      if (item.kind !== "permanent") continue;
      if (!player.perm[item.name]) continue;
      const icon = AR.ICONS[item.name];
      const iconSize = Math.max(28, cellH * 2.15);
      const drawn = drawArcade(item.name, hx, hy, iconSize);
      if (!drawn) {
        for (let r = 0; r < icon.rows.length; r++) {
          for (let c = 0; c < icon.rows[r].length; c++) {
            const ch = icon.rows[r][c];
            if (ch === " ") continue;
            drawChar(hx + c * cellW, hy + r * cellH, ch, icon.color(ch, r, c), 1);
          }
        }
      }
      const spotW = drawn ? iconSize : icon.rows[0].length * cellW;
      spots.push({
        x: hx, y: hy, w: spotW, h: drawn ? iconSize : icon.rows.length * cellH, name: item.name,
      });
      hx += spotW + cellW * 1.4;
    }

    if (pointer.inside) {
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        if (pointer.x >= s.x && pointer.x <= s.x + s.w && pointer.y >= s.y && pointer.y <= s.y + s.h) {
          const item = AR.POWER_UPS.find((p) => p.name === s.name);
          drawTooltip(item, pointer.x, pointer.y);
          break;
        }
      }
    }

    if (bannerT > 0 && level) {
      const a = level.name;
      const b = "New foe: " + level.entry;
      drawString((viewW - ctx.measureText(a).width) / 2, cellH * 3.2, a, "#fff6d0");
      drawString((viewW - ctx.measureText(b).width) / 2, cellH * 4.3, b, "#c9d4ea");
    }
    if (toastT > 0 && toastText) {
      const lines = wrapPx(toastText, Math.max(40, viewW - 36));
      let ty = viewH * 0.2;
      for (let i = 0; i < lines.length; i++) {
        const tw = ctx.measureText(lines[i]).width;
        drawString(Math.max(12, (viewW - tw) / 2), ty, lines[i], "#ffe14d");
        ty += cellH * 1.15;
      }
    }
    const boss = bossAliveRecord();
    if (bossFight && boss) {
      drawBossBar(boss);
    }
  }

  function drawBossBar(boss) {
    const label = boss.name + "  " + Math.max(0, Math.ceil(boss.hp)) + "/" + boss.maxHp;
    const widthChars = 28;
    const ratio = boss.maxHp ? boss.hp / boss.maxHp : 0;
    const filled = Math.round(widthChars * Math.max(0, ratio));
    let bar = "";
    for (let i = 0; i < widthChars; i++) bar += i < filled ? "#" : "-";
    const color = AR.damageColor("#8dffe0", 1 - ratio);
    const y = cellH * 2.4;
    drawString((viewW - ctx.measureText(label).width) / 2, y, label, "#f4f4f4");
    drawString((viewW - ctx.measureText(bar).width) / 2, y + cellH, bar, color);
  }

  function drawTooltip(item, mx, my) {
    const lines = [item.name].concat(wrapText(item.effect, 36)).concat(statLines(item));
    let widest = 0;
    for (let i = 0; i < lines.length; i++) widest = Math.max(widest, ctx.measureText(lines[i]).width);
    const w = widest + 24;
    const h = lines.length * cellH + 16;
    let x = mx + 16;
    let y = my + 16;
    if (x + w > viewW - 8) x = mx - w - 12;
    if (y + h > viewH - 8) y = my - h - 12;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#050505";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe14d";
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    for (let i = 0; i < lines.length; i++) {
      drawString(x + 12, y + 8 + i * cellH, lines[i], i === 0 ? "#ffe14d" : "#f4f4f4");
    }
  }

  function addHot(x, y, w, h, action) {
    hot.push({ x: x, y: y, w: w, h: h, action: action });
  }

  function panelRect(w, h) {
    return { x: (viewW - w) / 2, y: (viewH - h) / 2, w: w, h: h };
  }

  function fillPanel(rect) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#050505";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "#f0e2b0";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  }

  function bookPages() {
    function chunk(section, entries) {
      const out = [];
      for (let i = 0; i < entries.length; i += 3) out.push({ section: section, entries: entries.slice(i, i + 3) });
      return out;
    }
    const foes = AR.ENEMIES.filter(function (e) { return !e.is_boss; }).map(enemyNote);
    const bosses = AR.ENEMIES.filter(function (e) { return e.is_boss; }).map(enemyNote);
    const guns = AR.WEAPONS.map(function (w) {
      return {
        title: w.name,
        frame: [w.sprite],
        color: function (ch, r, c) { return AR.weaponColors(w.name, ch, c); },
        lines: [
          w.tier + "   " + w.range + "   dmg " + w.damage,
          "Swing delay " + w.attack_delay.toFixed(2) + "s",
          w.unlock_level === 0 ? "Carried from the first step." : "Given at the start of level " + w.unlock_level + ".",
        ],
      };
    });
    const powers = AR.POWER_UPS.map(function (p) {
      const icon = AR.ICONS[p.name];
      let line = p.effect;
      if (p.heal) line = "Restores " + p.heal + " heart.";
      else if (p.block) line = "Blocks the next hit.";
      else if (p.damage_mult) line = "Weapon damage x" + p.damage_mult + " for " + p.duration + "s. Not the axe.";
      else if (p.hearts) line = "+1 max heart, and that heart is filled.";
      else if (p.name === "Double Jump Boots") line = "One more jump in the air.";
      else if (p.name === "Bullet Dropper") line = "A ring drops enemy shots to the ground.";
      else if (p.name === "Spin Ball") line = "Spin for 5s. Bounce off enemies for 15 damage. Shots cannot harm you.";
      return {
        title: p.name,
        frame: icon.rows,
        color: icon.color,
        lines: [p.kind + "   " + p.price + "c   max " + p.max_owned, line],
      };
    });
    return chunk("ENEMIES", foes).concat(chunk("BOSSES", bosses), chunk("WEAPONS", guns), chunk("POWER-UPS", powers));
  }

  function enemyNote(e) {
    const vis = AR.ENEMY_VISUALS[e.name];
    const hits = AR.HITS_TO_KILL_WITH_STARTER[e.name];
    let habit = "Walks the roads.";
    if (e.move === "fly") habit = "Flies. Keep your feet under it to stomp a shot.";
    if (e.move === "boss") habit = "Boss of level " + e.boss_level + ". The shop closes after you step in.";
    if (e.invis) habit = "Fades out. An invisible ghost cannot be hit.";
    if (e.shoot) habit = "Fires a slow shot. Stomp it with your feet to bounce clear.";
    return {
      title: e.name,
      frame: vis.frames[0],
      color: vis.color,
      lines: [e.hp + " hp   " + hits + " starter hits   " + e.coin_drop + " coins", habit],
    };
  }

  function updateBook(dt) {
    const pages = bookPages();
    if (edge("Escape")) {
      state = "title";
      titleIndex = 1;
      bookFlip = 0;
      return;
    }
    if (bookFlip !== 0) {
      bookFlipT += dt;
      if (bookFlipT >= 0.46) {
        bookPage = bookNext;
        bookFlip = 0;
        bookFlipT = 0;
      }
      return;
    }
    if ((edge("ArrowRight") || edge("ArrowDown")) && bookPage < pages.length - 1) {
      bookFlip = 1;
      bookFlipT = 0;
      bookNext = bookPage + 1;
    } else if ((edge("ArrowLeft") || edge("ArrowUp")) && bookPage > 0) {
      bookFlip = -1;
      bookFlipT = 0;
      bookNext = bookPage - 1;
    }
    if (edge("Escape")) {
      state = "title";
      titleIndex = 1;
    }
  }

  function blitFrame(frame, x, y, colorFn) {
    if (!frame) return;
    for (let r = 0; r < frame.length; r++) {
      const line = frame[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (!ch || ch === " ") continue;
        drawChar(x + c * cellW, y + r * cellH * 0.82, ch, colorFn(ch, r, c), 1);
      }
    }
  }

  function drawBookFrame(rect) {
    const stepX = Math.max(8, Math.min(cellW, rect.w / 18));
    const stepY = Math.max(8, Math.min(cellH, rect.h / 22));
    const cols = Math.max(2, Math.floor(rect.w / stepX));
    const rows = Math.max(2, Math.floor(rect.h / stepY));
    for (let c = 0; c < cols; c++) {
      const x = rect.x + c * stepX;
      const ch = c === 0 || c === cols - 1 ? "+" : "=";
      drawGlyph(x, rect.y, stepX, stepY, ch, "#e6d3a3");
      drawGlyph(x, rect.y + rect.h - stepY, stepX, stepY, ch, "#e6d3a3");
    }
    for (let r = 1; r < rows - 1; r++) {
      const y = rect.y + r * stepY;
      drawGlyph(rect.x, y, stepX, stepY, "|", "#e6d3a3");
      drawGlyph(rect.x + rect.w - stepX, y, stepX, stepY, "|", "#e6d3a3");
    }
  }

  function drawBookEntry(x, y, w, h, entry) {
    const frame = entry.frame || [];
    const rows = Math.max(1, frame.length);
    const cols = Math.max(1, (frame[0] && frame[0].length) || 1);
    let gh = Math.min(26, Math.max(8, (h - 8) / rows));
    let gw = Math.max(6, gh * 0.62);
    const maxSpriteW = Math.max(28, w * 0.4);
    if (cols * gw > maxSpriteW) {
      gw = maxSpriteW / cols;
      gh = Math.min(gh, gw / 0.58);
    }
    const spriteW = cols * gw;
    const spriteH = rows * gh;
    const spriteY = y + Math.max(0, (h - spriteH) / 2);
    for (let r = 0; r < frame.length; r++) {
      const line = frame[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (!ch || ch === " ") continue;
        drawGlyph(x + 2, spriteY + r * gh, gw, gh, ch, entry.color(ch, r, c));
      }
    }
    let textX = x + spriteW + 14;
    let textW = Math.max(8, x + w - textX - 6);
    let textY = y + 2;
    let textH = Math.max(8, h - 4);
    if (textW < 64) {
      textX = x + 4;
      textW = Math.max(8, w - 8);
      textY = y + Math.min(h - 12, spriteH + 4);
      textH = Math.max(8, y + h - textY - 2);
    }
    const blocks = [entry.title].concat(entry.lines || []);
    let px = Math.min(20, Math.max(11, textH / (blocks.length + 1.5)));
    let laid = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      laid = withFont(px, function () {
        const lines = [];
        for (let i = 0; i < blocks.length; i++) {
          const wrapped = wrapPx(String(blocks[i]), textW);
          for (let k = 0; k < wrapped.length; k++) lines.push({ text: wrapped[k], title: i === 0 });
        }
        const step = px * 1.32;
        return { lines: lines, step: step, height: lines.length * step };
      });
      if (laid.height <= textH || px <= 11) break;
      px = Math.max(11, px * 0.86);
    }
    clipRect(textX - 1, textY, textW + 2, textH, function () {
      withFont(px, function () {
        let ty = textY;
        for (let i = 0; i < laid.lines.length; i++) {
          if (ty + px > textY + textH + 0.5) break;
          drawString(textX, ty, laid.lines[i].text, laid.lines[i].title ? "#ffe14d" : "#d7deea");
          ty += laid.step;
        }
      });
    });
  }

  function drawBookEntries(area, page) {
    if (!page || !page.entries || !page.entries.length) return;
    const n = page.entries.length;
    const gap = 6;
    const slotH = (area.h - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const slotY = area.y + i * (slotH + gap);
      clipRect(area.x, slotY, area.w, Math.max(1, slotH), function () {
        drawBookEntry(area.x, slotY, area.w, slotH, page.entries[i]);
      });
    }
  }

  function drawBookLeft(rect, mid, pages, pageIndex, page) {
    const frame = Math.max(16, Math.min(cellH, rect.h / 22));
    const x = rect.x + frame + 8;
    const maxW = Math.max(24, mid - x - 16);
    const top = rect.y + frame + 8;
    const bottom = rect.y + rect.h - frame - 8;
    const notes = [
      "Arrow keys turn the page.",
      "The leaf folds at the spine.",
      "Esc closes the book.",
      "Three entries to a page.",
      "Glyphs are the real bodies.",
    ];
    let px = Math.min(22, Math.max(12, rect.h / 34));
    let block = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      block = withFont(px, function () {
        const lines = [];
        function push(text, color) {
          const wrapped = wrapPx(text, maxW);
          for (let i = 0; i < wrapped.length; i++) lines.push({ text: wrapped[i], color: color });
        }
        push("ASCII RUN", "#ffe14d");
        push("FIELD NOTES", "#f4f4f4");
        push(page ? page.section : "", "#ffb020");
        push((pageIndex + 1) + "  /  " + pages.length, "#9aa4b8");
        lines.push({ text: "", color: "#b7c0aa" });
        for (let i = 0; i < notes.length; i++) push(notes[i], "#b7c0aa");
        lines.push({ text: "", color: "#6a6430" });
        push("left page  |  right page", "#6a6430");
        const step = Math.max(px * 1.4, px + 4);
        return { lines: lines, step: step, height: lines.length * step };
      });
      if (block.height <= bottom - top || px <= 11) break;
      px = Math.max(11, px * 0.88);
    }
    clipRect(rect.x + 6, top, Math.max(8, mid - rect.x - 10), Math.max(8, bottom - top), function () {
      withFont(px, function () {
        let y = top;
        for (let i = 0; i < block.lines.length; i++) {
          if (y + px > bottom) break;
          if (block.lines[i].text) drawString(x, y, block.lines[i].text, block.lines[i].color);
          y += block.step;
        }
      });
    });
  }

  function renderBook() {
    hot = [];
    shade = 0;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const pages = bookPages();
    const pageIndex = Math.max(0, Math.min(bookPage, pages.length - 1));
    const page = pages[pageIndex];
    const rect = { x: 0, y: 0, w: viewW, h: viewH };
    clipRect(0, 0, viewW, viewH, function () {
      drawBookFrame(rect);
      const leftW = Math.max(150, Math.min(viewW * 0.32, 460));
      const mid = leftW;
      const frame = Math.max(16, Math.min(cellH, viewH / 22));
      const spineStep = Math.max(10, Math.min(frame, 22));
      for (let y = frame; y < viewH - frame; y += spineStep) {
        drawGlyph(mid - spineStep * 0.15, y, spineStep * 0.8, spineStep * 0.8, "|", "#f0e2b0");
        drawGlyph(mid + spineStep * 0.7, y, spineStep * 0.8, spineStep * 0.8, "|", "#6a5430");
      }
      const shownIndex = bookFlip !== 0 && bookFlipT > 0.22 ? bookNext : pageIndex;
      const shown = pages[shownIndex] || page;
      drawBookLeft(rect, mid, pages, shownIndex, shown);
      const right = {
        x: mid + spineStep * 2.4,
        y: frame + 8,
        w: Math.max(40, viewW - mid - frame - spineStep * 2.4),
        h: Math.max(40, viewH - frame * 2 - 16),
      };
      if (bookFlip === 0) {
        drawBookEntries(right, page);
      } else {
        const t = Math.min(1, bookFlipT / 0.46);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const fold = bookFlip > 0 ? right.x + right.w * (1 - e) : right.x + right.w * e;
        const incoming = pages[bookNext];
        clipRect(right.x, right.y, Math.max(0, fold - right.x), right.h, function () {
          drawBookEntries(right, bookFlip > 0 ? page : incoming);
        });
        clipRect(fold, right.y, Math.max(0, right.x + right.w - fold), right.h, function () {
          drawBookEntries(right, bookFlip > 0 ? incoming : page);
        });
        const mark = Math.max(10, Math.min(18, right.h / 24));
        for (let y = right.y; y < right.y + right.h - mark; y += mark) {
          const ch = bookFlip > 0 ? "/" : "\\";
          drawGlyph(fold, y, mark, mark, ch, "#ffe14d");
          drawGlyph(fold + mark * 0.7, y, mark, mark, ":", "#8a7040");
        }
      }
    });
    addHot(0, 0, leftWHot(viewW), viewH, function () {
      if (bookFlip === 0 && bookPage > 0) {
        bookFlip = -1;
        bookFlipT = 0;
        bookNext = bookPage - 1;
      }
    });
    const midHot = leftWHot(viewW);
    addHot(midHot, 0, Math.max(0, viewW - midHot), viewH, function () {
      if (bookFlip === 0 && bookPage < pages.length - 1) {
        bookFlip = 1;
        bookFlipT = 0;
        bookNext = bookPage + 1;
      }
    });
  }

  function leftWHot(width) {
    return Math.max(150, Math.min(width * 0.32, 460));
  }

  function clipRect(x, y, w, h, fn) {
    if (w < 1 || h < 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function withFont(px, fn) {
    const prev = ctx.font;
    ctx.font = 'bold ' + px + 'px "Courier New", ui-monospace, monospace';
    const result = fn();
    ctx.font = prev;
    return result;
  }

  /* gw/gh is the cell the glyph must stay inside. Spacing uses the measured advance so neighbors do not collide. */
  function drawGlyph(px, py, gw, gh, ch, color) {
    if (!ch || ch === " " || gw < 1 || gh < 1) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold ' + gh + 'px "Courier New", ui-monospace, monospace';
    ctx.fillText(ch, px + gw * 0.5, py + gh * 0.5);
    ctx.restore();
  }

  function glyphAdvance(gh) {
    let w = gh * 0.6;
    withFont(gh, function () { w = ctx.measureText("M").width || w; });
    return Math.max(1, w);
  }

  function drawIconGrid(icon, x, y, gh) {
    const gw = glyphAdvance(gh);
    for (let r = 0; r < icon.rows.length; r++) {
      const row = icon.rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === " ") continue;
        drawGlyph(x + c * gw, y + r * gh, gw, gh, ch, icon.color(ch, r, c));
      }
    }
    return { w: gw * icon.rows[0].length, h: gh * icon.rows.length, gw: gw, gh: gh };
  }

  function renderTitle() {
    hot = [];
    camX = 0;
    camY = 0;
    shade = 0;
    ctx.globalAlpha = 1;
    layoutFont();
    const marginX = 28;
    const maxText = Math.max(48, viewW - marginX * 2);
    const helpSrc = [
      "Colored glyphs. Hits rewrite them toward red.",
      "A/D or arrows walk. Up or Space jumps, again in the air.",
      "On a ladder, Up and Down climb. Space jumps off.",
      "W aims up. S or Down aims down. F fires.",
      "Hold E for the axe. 1-5 items. K shop. Esc pause.",
      "Stomp a shot with your feet to bounce.",
      "Shift+arrows dash 15 tiles. Down crouches. Double-down pounds.",
    ];
    let big = Math.min(cellH * 2.05, viewW * 0.11, 68);
    const head = "ASCII RUN";
    ctx.font = 'bold ' + big + 'px "Courier New", ui-monospace, monospace';
    while (big > 10 && textWidth(head) > maxText) {
      big -= 1;
      ctx.font = 'bold ' + big + 'px "Courier New", ui-monospace, monospace';
    }
    if (textWidth(head) > maxText) big *= maxText / Math.max(1, textWidth(head));
    layoutFont();

    let lineH = Math.min(Math.max(14, cellH * 1.22), 30);
    function measureTitle() {
      const bodyPx = Math.min(cellH * 0.92, lineH * 0.78);
      return withFont(bodyPx, function () {
        const lines = [];
        for (let i = 0; i < helpSrc.length; i++) {
          const wrapped = wrapPx(helpSrc[i], maxText);
          for (let k = 0; k < wrapped.length; k++) {
            lines.push({ text: wrapped[k], color: i === 0 ? "#d7deea" : "#b7c0aa" });
          }
        }
        const hint = fitText("Up/Down choose    Enter select", maxText);
        const bests = [];
        for (let i = 0; i < AR.LEVELS.length; i++) {
          const L = AR.LEVELS[i];
          const raw = L.name + "   best " + (readBest(L.level) == null ? "--" : formatTime(readBest(L.level)));
          bests.push(fitText(raw, maxText));
        }
        const gap = Math.max(10, lineH * 0.5);
        let y = 12 + big + gap;
        y += lines.length * lineH;
        y += gap;
        const buttonH = Math.max(bodyPx + 6, lineH * 0.92);
        y += 2 * (buttonH + gap);
        y += lineH;
        y += bests.length * lineH;
        return { lines: lines, hint: hint, bests: bests, bodyPx: bodyPx, buttonH: buttonH, gap: gap, uiBottom: y + 8 };
      });
    }
    let built = measureTitle();
    for (let attempt = 0; attempt < 24 && built.uiBottom > viewH - 6; attempt++) {
      if (lineH > 10) lineH *= 0.9;
      else big = Math.max(8, big * 0.9);
      built = measureTitle();
    }

    const gap = built.gap;
    let y = 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffe14d";
    ctx.font = 'bold ' + big + 'px "Courier New", ui-monospace, monospace';
    const hw = textWidth(head);
    ctx.fillText(fitText(head, maxText), Math.max(marginX, (viewW - Math.min(hw, maxText)) / 2), y);
    y += big + gap;
    layoutFont();

    withFont(built.bodyPx, function () {
      for (let i = 0; i < built.lines.length; i++) {
        const line = built.lines[i].text;
        const lw = textWidth(line);
        drawString(Math.max(marginX, (viewW - lw) / 2), y, line, built.lines[i].color);
        y += lineH;
      }
      y += gap;
      const choices = ["> PLAY <", "> GAME BOOK <"];
      for (let i = 0; i < choices.length; i++) {
        const selected = i === titleIndex;
        const label = fitText(choices[i], maxText);
        const pw = textWidth(label);
        const px = Math.max(marginX, (viewW - pw) / 2);
        const boxW = Math.min(viewW - marginX * 2, pw + 28);
        const boxX = Math.max(marginX, Math.min(px - 14, viewW - marginX - boxW));
        if (selected) {
          ctx.fillStyle = "#ffe14d";
          ctx.fillRect(boxX, y, boxW, built.buttonH);
          drawString(px, y + Math.max(0, (built.buttonH - built.bodyPx) * 0.5), label, "#1a1408");
        } else {
          drawString(px, y + Math.max(0, (built.buttonH - built.bodyPx) * 0.5), label, "#9aa4b8");
        }
        addHot(boxX, y, boxW, built.buttonH, (function (index) {
          return function () {
            titleIndex = index;
            if (index === 0) startWipe(beginRun);
            else openBook();
          };
        })(i));
        y += built.buttonH + gap;
      }
      const hintW = textWidth(built.hint);
      drawString(Math.max(marginX, (viewW - hintW) / 2), y, built.hint, "#8a9078");
      y += lineH;
      for (let i = 0; i < built.bests.length; i++) {
        const line = built.bests[i];
        drawString(Math.max(marginX, (viewW - textWidth(line)) / 2), y, line, "#9aa4b8");
        y += lineH;
      }
    });
    const uiBottom = y + 12;

    const dioramaTop = uiBottom;
    const dioramaH = viewH - dioramaTop;
    if (dioramaH > cellH * 4.2) {
      clipRect(0, dioramaTop, viewW, dioramaH, function () {
        const groundPx = viewH - cellH * 2.15;
        const ground = groundPx / cellH;
        const span = Math.min(70, Math.floor(viewW / cellW) - 1);
        for (let x = 1; x < span; x++) {
          drawChar(x * cellW, ground * cellH, '"', "#1d6b32", 1);
          drawChar(x * cellW, (ground + 1) * cellH, "#", "#3a2414", 1);
        }
        function place(frame, footX, footTile, color, opt) {
          if (!frame || !frame.length) return;
          const top = (footTile - frame.length) * cellH;
          if (top < dioramaTop + 2) return;
          paintFrame(frame, footX, footTile, color, opt || {});
        }
        const tree = AR.TREES[0];
        place(tree.rows, 8, ground, tree.color, {
          rowShift: function (row) {
            if (row >= tree.canopy) return 0;
            return Math.sin(uiTime * 1.6 + row) * 0.35;
          },
        });
        const torchF = AR.TORCH_FRAMES[animIndex(uiTime, 7, AR.TORCH_FRAMES.length)];
        place(torchF, 16, ground, AR.torchColor, {});
        const walk = AR.PLAYER_WALK[animIndex(uiTime, 1 / 0.11, 4)];
        place(walk, 24, ground, AR.playerColors, {});
        place(["=|>"], 29.2, ground - 1, AR.axeColors, {});
        if (span > 40) {
          const slime = AR.enemyFrame("Slime", uiTime);
          place(slime.frame, 34, ground + Math.abs(Math.sin(uiTime * 4)) * -0.4, slime.color, {});
        }
        if (span > 52) {
          const bat = AR.enemyFrame("Bat", uiTime);
          place(bat.frame, 44, ground - 3 + Math.sin(uiTime * 3) * 0.4, bat.color, {});
        }
        if (span > 64) {
          const eye = AR.enemyFrame("Floating Eye", uiTime);
          place(eye.frame, 54, ground - 4.2, eye.color, {});
        }
      });
    }
    layoutFont();
  }

  function renderWeapon() {
    hot = [];
    const rect = panelRect(Math.min(viewW - 24, 860), Math.min(viewH - 24, 620));
    fillPanel(rect);
    clipRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, function () {
      const def = AR.levelByNumber(pendingLevel);
      const inner = Math.max(40, rect.w - 64);
      const list = player.weapons;
      let px = Math.min(22, Math.max(12, (rect.h - 80) / (list.length * 3.2)));
      withFont(px, function () {
        drawString(rect.x + 28, rect.y + 16, fitText(def.name, inner), "#fff6d0");
        const sub = wrapPx("Choose one weapon. It stays equipped for the whole level.", inner);
        for (let s = 0; s < sub.length; s++) drawString(rect.x + 28, rect.y + 16 + px * 1.4 + s * px * 1.3, sub[s], "#c5cdd8");
        const headerH = 16 + px * 1.4 + sub.length * px * 1.3 + 12;
        const footerH = px * 2.2;
        const bodyH = Math.max(px * 2, rect.h - headerH - footerH - 12);
        const rowH = bodyH / Math.max(1, list.length);
        for (let i = 0; i < list.length; i++) {
          const w = AR.weaponByName(list[i]);
          const y = rect.y + headerH + i * rowH;
          const selected = i === weaponIndex;
          const color = selected ? "#1a1408" : "#aeb6c2";
          const boxH = Math.max(0, rowH - 6);
          if (selected) {
            ctx.fillStyle = "#ffe14d";
            ctx.fillRect(rect.x + 20, y, rect.w - 40, boxH);
          }
          const mark = selected ? ">>" : "  ";
          const end = selected ? "<<" : "  ";
          const line = fitText(mark + "  " + w.sprite + "   " + w.name + "   " + end, inner);
          const meta = fitText(w.tier + "   dmg " + w.damage + "   delay " + w.attack_delay.toFixed(2) + "s   " + w.range, inner);
          const nameY = y + Math.max(2, (boxH - px * 2.4) / 2);
          drawString(rect.x + 32, nameY, line, color);
          if (boxH > px * 2) drawString(rect.x + 32, nameY + px * 1.25, meta, selected ? "#3a3010" : "#7e8794");
          addHot(rect.x + 20, y, rect.w - 40, boxH, (function (index) {
            return function () {
              weaponIndex = index;
              startWipe(beginPlay);
            };
          })(i));
        }
        drawString(rect.x + 28, rect.y + rect.h - footerH, fitText("W/S move    Space or Enter confirm", inner), "#8d98aa");
      });
    });
    layoutFont();
  }

  function renderStore() {
    const list = shopList();
    const rect = panelRect(
      Math.max(1, viewW - 8),
      Math.max(1, viewH - 8)
    );
    fillPanel(rect);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x + 3, rect.y + 3, Math.max(1, rect.w - 6), Math.max(1, rect.h - 6));
    ctx.clip();
    const pad = 18;
    const innerLeft = rect.x + pad;
    const innerRight = rect.x + rect.w - pad;
    const innerW = Math.max(40, innerRight - innerLeft);
    const uiPx = Math.min(cellH * 0.92, 22);
    const rowStep = uiPx * 1.28;

    const closeRaw = storeReturn === "gate" ? "K or Esc returns" : "K or Esc closes";
    const coinsLabel = "($) " + player.coins;
    let closeLabel = closeRaw;
    let coinsLine = coinsLabel;
    let headerRows = 1;
    withFont(uiPx, function () {
      closeLabel = fitText(closeRaw, innerW * 0.5);
      const titleW = textWidth("SHOP");
      const coinsW = textWidth(coinsLabel);
      const closeW = textWidth(closeLabel);
      if (titleW + coinsW + closeW + 48 > innerW) {
        headerRows = 2;
        coinsLine = fitText(coinsLabel, innerW);
        closeLabel = fitText(closeRaw, Math.max(20, innerW - titleW - 16));
      }
    });
    const headerH = 10 + headerRows * rowStep + 8;
    const hintRaw = "W/S choose    Enter buy";
    let footerRows = 1;
    let hint = hintRaw;
    let shopLine = "";
    if (shopMsgT > 0 && shopMsg) shopLine = shopMsg;
    withFont(uiPx, function () {
      hint = fitText(hintRaw, innerW);
      if (shopLine) {
        const side = textWidth(hint) + 18 + textWidth(shopLine) <= innerW;
        if (!side) {
          footerRows = 2;
          if (textWidth(shopLine) > innerW) shopLine = fitText(shopLine, innerW);
        }
      }
    });
    const footerH = 8 + footerRows * rowStep + 8;
    const bodyTop = rect.y + headerH;
    const bodyBottom = rect.y + rect.h - footerH;
    const bodyH = Math.max(0, bodyBottom - bodyTop);

    let split = Math.round(rect.w * 0.46);
    if (rect.w - split < 150) split = Math.max(96, rect.w - 150);
    const leftX = innerLeft;
    const leftW = Math.max(48, rect.x + split - leftX - 8);
    const rightX = rect.x + split + 10;
    const rightW = Math.max(36, innerRight - rightX);

    clipRect(rect.x + 4, rect.y + 4, rect.w - 8, headerH - 2, function () {
      withFont(uiPx, function () {
        const y0 = rect.y + 10;
        drawString(innerLeft, y0, "SHOP", "#ffe14d");
        const closeW = textWidth(closeLabel);
        drawString(innerRight - closeW, y0, closeLabel, "#9aa4b4");
        if (headerRows === 1) {
          drawString(innerLeft + textWidth("SHOP") + 16, y0, coinsLine, "#ffe14d");
        } else {
          drawString(innerLeft, y0 + rowStep, coinsLine, "#ffe14d");
        }
      });
    });

    const rows = Math.max(1, list.length);
    const rowH = bodyH / rows;
    clipRect(leftX - 4, bodyTop, leftW + 8, bodyH, function () {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const y = bodyTop + i * rowH;
        const boxH = Math.max(0, rowH - 4);
        clipRect(leftX, y, leftW, boxH, function () {
          const selected = i === menuIndex;
          const sold = ownedCount(item) >= item.max_owned;
          const color = selected ? "#1a1408" : sold ? "#6a707a" : "#e6e6e6";
          if (selected) {
            ctx.fillStyle = "#ffe14d";
            ctx.fillRect(leftX, y, leftW, boxH);
          }
          const icon = AR.ICONS[item.name];
          const iconRows = icon.rows.length;
          const iconCols = icon.rows[0].length;
          let textX = leftX + 6;
          let textMax = leftW - 10;
          const iconSize = Math.min(42, Math.max(18, boxH - 6));
          const iconY = y + Math.max(2, (boxH - iconSize) / 2);
          if (drawArcade(item.name, leftX + 4, iconY, iconSize)) {
            textX = leftX + 4 + iconSize + 8;
            textMax = leftX + leftW - 6 - textX;
          } else {
            const maxGh = Math.min(uiPx, Math.max(6, (boxH - 6) / iconRows));
            const gwGuess = maxGh * 0.62;
            if (boxH >= iconRows * 8 && leftW > iconCols * gwGuess + 36) {
              const drawn = drawIconGrid(icon, leftX + 4, y + Math.max(2, (boxH - iconRows * maxGh) / 2), maxGh);
              textX = leftX + 4 + drawn.w + 8;
              textMax = leftX + leftW - 6 - textX;
            }
          }
          const twoLine = boxH >= uiPx * 2.05 && textMax > 16;
          const linePx = twoLine ? Math.min(uiPx, (boxH - 4) / 2.25) : Math.min(uiPx, Math.max(8, boxH * 0.7));
          withFont(linePx, function () {
            const name = fitText(item.name, textMax);
            const block = twoLine ? linePx * 2.15 : linePx;
            const nameY = y + Math.max(1, (boxH - block) / 2);
            drawString(textX, nameY, name, color);
            if (twoLine) {
              const meta = fitText(priceOf(item) + "c   " + ownedCount(item) + "/" + item.max_owned, textMax);
              drawString(textX, nameY + linePx * 1.15, meta, selected ? "#3a3010" : "#9aa4b4");
            }
          });
          addHot(leftX, y, leftW, boxH, (function (index) {
            return function () { menuIndex = index; };
          })(i));
        });
      }
    });

    if (bodyH > 4 && rightW > 8) {
      ctx.fillStyle = "#3a3424";
      ctx.fillRect(rect.x + split, bodyTop + 4, 1, Math.max(0, bodyH - 8));
      clipRect(rightX, bodyTop, rightW, bodyH, function () {
        const item = list[Math.max(0, Math.min(list.length - 1, menuIndex))];
        if (!item) return;
        const detailPx = Math.min(uiPx, 20);
        withFont(detailPx, function () {
          let ty = bodyTop + 2;
          const name = fitText(item.name, rightW);
          if (ty + detailPx <= bodyBottom) {
            drawString(rightX, ty, name, "#ffe14d");
            ty += detailPx * 1.3;
          }
          const icon = AR.ICONS[item.name];
          const iconSize = Math.min(72, Math.max(28, rightW * 0.42));
          if (ty + iconSize <= bodyBottom - detailPx && drawArcade(item.name, rightX, ty, iconSize)) {
            ty += iconSize + detailPx * 0.35;
          } else {
            const gh = Math.min(detailPx, 16);
            const gw = glyphAdvance(gh);
            const iconW = gw * icon.rows[0].length;
            const iconH = gh * icon.rows.length;
            if (iconW <= rightW && ty + iconH <= bodyBottom - detailPx) {
              drawIconGrid(icon, rightX, ty, gh);
              ty += iconH + detailPx * 0.4;
            }
          }
          const bits = [item.kind + "   " + priceOf(item) + "c"].concat(wrapPx(item.effect, rightW)).concat(statLines(item));
          for (let i = 0; i < bits.length; i++) {
            const parts = wrapPx(bits[i], rightW);
            for (let n = 0; n < parts.length; n++) {
              if (ty + detailPx > bodyBottom) return;
              drawString(rightX, ty, parts[n], i === 0 ? "#f4f4f4" : "#d5dbe3");
              ty += detailPx * 1.2;
            }
          }
        });
      });
    }

    clipRect(rect.x + 4, rect.y + rect.h - footerH, rect.w - 8, footerH - 4, function () {
      withFont(uiPx, function () {
        const y0 = rect.y + rect.h - footerH + 8;
        drawString(innerLeft, y0, hint, "#9aa4b4");
        if (shopLine) {
          const color = shopMsg === "not enough coins" ? "#ff5a5a" : "#ffe14d";
          if (footerRows === 1) {
            drawString(innerRight - textWidth(shopLine), y0, shopLine, color);
          } else {
            drawString(innerLeft, y0 + rowStep, shopLine, color);
          }
        }
      });
    });
    ctx.restore();
    layoutFont();
  }

  function renderChoiceMenu(title, items) {
    const rect = panelRect(Math.min(560, viewW - 24), Math.min(380, viewH - 24));
    fillPanel(rect);
    clipRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, function () {
      const inner = Math.max(40, rect.w - 56);
      let px = Math.min(22, Math.max(13, rect.h / 14));
      withFont(px, function () {
        const titleLines = wrapPx(title, inner);
        let y = rect.y + 18;
        for (let i = 0; i < titleLines.length; i++) {
          drawString(rect.x + 24, y, titleLines[i], "#fff6d0");
          y += px * 1.35;
        }
        y += px * 0.6;
        const footer = px * 2.4;
        const bodyBottom = rect.y + rect.h - footer;
        const rowH = Math.max(px * 1.7, (bodyBottom - y) / Math.max(1, items.length));
        for (let i = 0; i < items.length; i++) {
          const rowY = y + i * rowH;
          if (rowY + px > bodyBottom) break;
          const selected = i === menuIndex;
          const label = fitText(selected ? ">>  " + items[i] + "  <<" : "    " + items[i], inner);
          const boxH = Math.min(rowH - 4, px * 1.7);
          if (selected) {
            ctx.fillStyle = "#ffe14d";
            ctx.fillRect(rect.x + 18, rowY, rect.w - 36, boxH);
            drawString(rect.x + 28, rowY + Math.max(0, (boxH - px) / 2), label, "#1a1408");
          } else {
            drawString(rect.x + 28, rowY + Math.max(0, (boxH - px) / 2), label, "#c5cdd8");
          }
          addHot(rect.x + 18, rowY, rect.w - 36, boxH, (function (index) {
            return function () {
              menuIndex = index;
              activateMenu();
            };
          })(i));
        }
        const hint = fitText("Tab or W/S move    Space or Enter select", inner);
        drawString(rect.x + 24, rect.y + rect.h - footer + 6, hint, "#8d98aa");
      });
    });
    layoutFont();
  }

  function renderGate() {
    const rect = panelRect(Math.min(720, viewW - 20), Math.min(460, viewH - 20));
    fillPanel(rect);
    clipRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, function () {
      const inner = Math.max(40, rect.w - 56);
      let px = Math.min(22, Math.max(13, rect.h / 18));
      const copy = [
        "Shop once more, or step through.",
        "After that the shop stays closed for the boss fight. Held items still work.",
      ];
      withFont(px, function () {
        const title = fitText("The point of no return", inner);
        const options = ["Last visit to the shop", "Step through"];
        const footer = px * 2.3;
        const rowH = px * 2.05;
        const optionsTop = rect.y + rect.h - footer - options.length * (rowH + 8);
        drawString(rect.x + 24, rect.y + 16, title, "#ff5a4a");
        let y = rect.y + 16 + px * 1.7;
        const copyBottom = optionsTop - 8;
        for (let i = 0; i < copy.length; i++) {
          const wrapped = wrapPx(copy[i], inner);
          for (let k = 0; k < wrapped.length; k++) {
            if (y + px > copyBottom) break;
            drawString(rect.x + 24, y, wrapped[k], "#f4f4f4");
            y += px * 1.38;
          }
          y += px * 0.3;
        }
        for (let i = 0; i < options.length; i++) {
          const rowY = optionsTop + i * (rowH + 8);
          const selected = i === gateIndex;
          const label = fitText(selected ? ">>  " + options[i] + "  <<" : "    " + options[i], inner);
          if (selected) {
            ctx.fillStyle = "#ffe14d";
            ctx.fillRect(rect.x + 18, rowY, rect.w - 36, rowH);
            drawString(rect.x + 28, rowY + Math.max(0, (rowH - px) / 2), label, "#1a1408");
          } else {
            drawString(rect.x + 28, rowY + Math.max(0, (rowH - px) / 2), label, "#c5cdd8");
          }
          addHot(rect.x + 18, rowY, rect.w - 36, rowH, (function (index) {
            return function () {
              gateIndex = index;
              if (index === 0) openStore("gate");
              else confirmGate();
            };
          })(i));
        }
        drawString(rect.x + 24, rect.y + rect.h - footer + 4, fitText("W/S move    Enter select", inner), "#8d98aa");
      });
    });
    layoutFont();
  }

  function renderClear() {
    const info = clearInfo;
    const lines = [
      info.name + " clear",
      "Time  " + formatTime(info.time),
    ];
    if (info.record) lines.push("NEW RECORD");
    else if (info.prev != null) lines.push("Best  " + formatTime(info.prev));
    lines.push("Coins  " + player.coins);
    lines.push(info.number >= 3 ? "[ Enter ]  see the ending" : "[ Enter ]  next weapon");
    const rect = panelRect(Math.min(640, viewW - 40), cellH * (lines.length + 5));
    fillPanel(rect);
    for (let i = 0; i < lines.length; i++) {
      let color = "#f4f4f4";
      if (lines[i] === "NEW RECORD") color = "#ffe14d";
      if (i === 0) color = "#b6ff8a";
      drawString(rect.x + 32, rect.y + 24 + i * cellH * 1.3, lines[i], color);
    }
    addHot(rect.x, rect.y, rect.w, rect.h, function () { startWipe(nextAfterClear); });
  }

  function renderWin() {
    hot = [];
    const lines = [
      "THE CASTLE FALLS",
      "The Demon Lord is gone.",
      "",
    ];
    for (let i = 1; i <= 3; i++) {
      const best = readBest(i);
      lines.push(AR.levelByNumber(i).name + "   " + (best == null ? "--" : formatTime(best)));
    }
    lines.push("");
    lines.push("[ Enter ]  main menu");
    const rect = panelRect(Math.min(700, viewW - 30), cellH * (lines.length + 4));
    fillPanel(rect);
    for (let i = 0; i < lines.length; i++) {
      drawString(rect.x + 32, rect.y + 24 + i * cellH * 1.25, lines[i], i === 0 ? "#ffe14d" : "#f4f4f4");
    }
    addHot(rect.x, rect.y, rect.w, rect.h, toTitle);
  }

  function drawWipe() {
    if (!wipe || cellW < 1 || cellH < 1) return;
    const u = Math.max(0, Math.min(1, wipe.t / wipe.dur));
    const cover = u < 0.46 ? u / 0.46 : 1 - (u - 0.46) / 0.54;
    const glyphs = "#%*+=|/\\";
    const cols = Math.ceil(viewW / cellW) + 1;
    const rows = Math.ceil(viewH / cellH) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sweep = (c / cols) * 0.72 + (r / rows) * 0.28;
        if (sweep > cover) continue;
        const edge = cover - sweep;
        const ch = glyphs[(c * 3 + r * 5 + Math.floor(uiTime * 16)) % glyphs.length];
        const alpha = edge < 0.07 ? Math.max(0.15, edge / 0.07) : 1;
        const color = edge < 0.14 ? "#ffe14d" : "#d5dbe3";
        drawChar(c * cellW, r * cellH, ch, color, alpha);
      }
    }
  }

  function render() {
    const view = (state === "wipe" && wipe) ? (wipe.fired ? wipe.back : wipe.from) : state;
    layoutFont();
    shade = (view === "play" || view === "title" || view === "weapon" || view === "win") ? 0 : 0.62;
    shx = 0;
    shy = 0;
    if (shake > 0 && view === "play") {
      shx = (Math.random() - 0.5) * shake;
      shy = (Math.random() - 0.5) * shake;
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, viewW, viewH);
    hot = [];
    if (view === "title") renderTitle();
    else if (view === "book") renderBook();
    else if (view === "weapon") renderWeapon();
    else if (view === "win") renderWin();
    else {
      if (level) renderWorld();
      if (view === "play" || view === "pause" || view === "store" || view === "gate" || view === "dead" || view === "clear") {
        if (player && level && view !== "clear") renderHud();
      }
      if (view === "store") renderStore();
      else if (view === "pause") renderChoiceMenu("Paused", ["Resume", "Retry Level", "Main Menu"]);
      else if (view === "dead") renderChoiceMenu("You fell", ["Retry Level", "Main Menu"]);
      else if (view === "gate") renderGate();
      else if (view === "clear") renderClear();
    }
    if (state === "wipe") drawWipe();
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    const raw = (now - last) / 1000;
    const dt = Number.isFinite(raw) ? Math.min(0.033, Math.max(0, raw)) : 0;
    last = Number.isFinite(now) ? now : performance.now();
    uiTime += dt;
    try {
      if (!fatal) {
        if (state === "wipe") {
          click = null;
          updateWipe(dt);
        } else {
          handleClick();
          if (state === "play") updatePlay(dt);
          else updateMenus(dt);
        }
        render();
      }
    } catch (err) {
      fatal = (err && err.stack) ? err.stack : String(err);
      console.error(err);
    }
    if (fatal) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.fillStyle = "#ff8080";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = "14px monospace";
      const lines = fatal.split("\n").slice(0, 14);
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 16, 16 + i * 18);
    }
    pressed.clear();
    let over = false;
    if (pointer.inside) {
      for (let i = 0; i < hot.length; i++) {
        const h = hot[i];
        if (pointer.x >= h.x && pointer.x <= h.x + h.w && pointer.y >= h.y && pointer.y <= h.y + h.h) over = true;
      }
    }
    canvas.style.cursor = over ? "pointer" : "default";
    requestAnimationFrame(frame);
  }

  player = makePlayer();
  resize();
  canvas.focus();
  requestAnimationFrame(frame);
})();
