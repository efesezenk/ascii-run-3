/* Static rules for ASCII Run. Numbers match the design sheet. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ASCIIRun = Object.assign(root.ASCIIRun || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STARTER_DAMAGE = 10;
  const PLAYER_START_HEARTS = 5;

  const ENEMIES = [
    {
      name: "Slime", hp: 10, coin_drop: 1, role: "entry", levels: [1],
      is_boss: false, boss_level: null, move: "walk", speed: 2.4, hop: true,
      contact: true,
    },
    {
      name: "Bat", hp: 10, coin_drop: 1, role: "entry", levels: [2],
      is_boss: false, boss_level: null, move: "fly", speed: 4.2,
      contact: true,
    },
    {
      name: "Floating Eye", hp: 20, coin_drop: 2, role: "entry", levels: [3],
      is_boss: false, boss_level: null, move: "fly", speed: 2.6,
      contact: true, shoot: "bolt", shootEvery: 1.7, shootSpeed: 6.4,
    },
    {
      name: "Goblin", hp: 20, coin_drop: 2, role: "regular", levels: [1, 2],
      is_boss: false, boss_level: null, move: "walk", speed: 3.3,
      contact: true, shoot: "bullet", shootEvery: 1.85, shootSpeed: 6.6,
    },
    {
      name: "Ghost", hp: 30, coin_drop: 3, role: "regular", levels: [2, 3],
      is_boss: false, boss_level: null, move: "fly", speed: 2.8,
      contact: true, invis: true,
    },
    {
      name: "Skeleton", hp: 40, coin_drop: 4, role: "regular", levels: [2, 3],
      is_boss: false, boss_level: null, move: "walk", speed: 1.9,
      contact: true, shoot: "bone", shootEvery: 2.15, shootSpeed: 6.1,
    },
    {
      name: "Spider", hp: 150, coin_drop: 25, role: "boss", levels: [1],
      is_boss: true, boss_level: 1, move: "boss", speed: 3.4, contact: true,
    },
    {
      name: "Stone Golem", hp: 300, coin_drop: 40, role: "boss", levels: [2],
      is_boss: true, boss_level: 2, move: "boss", speed: 1.55, contact: true,
    },
    {
      name: "Demon Lord", hp: 500, coin_drop: 0, role: "boss", levels: [3],
      is_boss: true, boss_level: 3, move: "boss", speed: 2.8, contact: true,
    },
  ];

  const HITS_TO_KILL_WITH_STARTER = {
    "Slime": 1,
    "Bat": 1,
    "Floating Eye": 2,
    "Goblin": 2,
    "Ghost": 3,
    "Skeleton": 4,
    "Spider": 15,
    "Stone Golem": 30,
    "Demon Lord": 50,
  };

  const WEAPONS = [
    { name: "Rusty Sword", tier: "Starter", unlock_level: 0, damage: STARTER_DAMAGE, attack_delay: 0.35, range: "melee", sprite: "--|==>" },
    { name: "Iron Spear", tier: "Easy", unlock_level: 1, damage: 15, attack_delay: 0.45, range: "melee", sprite: "o-------->" },
    { name: "Crossbow", tier: "Medium", unlock_level: 2, damage: 25, attack_delay: 0.60, range: "ranged", sprite: "|-->" },
    { name: "Flame Blade", tier: "Hard", unlock_level: 3, damage: 40, attack_delay: 0.50, range: "melee", sprite: "~~|==>" },
  ];

  const POWER_UPS = [
    { name: "Heart Potion", kind: "consumable", price: 15, price_step: 0, max_owned: 3, unlock_level: 1, effect: "Restores 1 heart.", heal: 1 },
    { name: "Bubble Shield", kind: "consumable", price: 20, price_step: 0, max_owned: 2, unlock_level: 1, effect: "Blocks the next hit you take.", block: 1 },
    { name: "Rage Tonic", kind: "consumable", price: 30, price_step: 0, max_owned: 2, unlock_level: 2, effect: "x1.5 weapon damage for 15 seconds after you use it.", damage_mult: 1.5, duration: 15 },
    {
      name: "Bullet Dropper", kind: "consumable", price: 35, price_step: 0, max_owned: 2, unlock_level: 1,
      effect: "A shockwave ring of ASCII characters expands from you until it covers the screen. Every enemy projectile the ring passes over stops sideways and falls straight down onto the ground.",
    },
    {
      name: "Spin Ball", kind: "consumable", price: 40, price_step: 0, max_owned: 2, unlock_level: 1,
      effect: "Curl into a spinning ball for 5 seconds. It rolls on its own; you can steer and jump. Touching an enemy bounces you back for half a second and deals 15 damage. Enemy hits and bullets cannot harm you.",
      touch: 15, duration: 5,
    },
    { name: "Heart Container", kind: "permanent", price: 60, price_step: 30, max_owned: 3, unlock_level: 1, effect: "+1 max heart (and refills it).", hearts: 1 },
    { name: "Double Jump Boots", kind: "permanent", price: 80, price_step: 0, max_owned: 1, unlock_level: 2, effect: "Jump once more in mid-air." },
  ];

  const LEVELS = [
    { level: 1, name: "Dark Forest", entry_enemy: "Slime", enemies: ["Slime", "Goblin"], enemy_counts: { "Slime": 12, "Goblin": 8 }, placed_coins: 30, secret_coins: 10, boss: "Spider", weapon_reward: "Iron Spear" },
    { level: 2, name: "Forgotten Crypt", entry_enemy: "Bat", enemies: ["Bat", "Goblin", "Ghost", "Skeleton"], enemy_counts: { "Bat": 10, "Goblin": 6, "Ghost": 6, "Skeleton": 5 }, placed_coins: 40, secret_coins: 15, boss: "Stone Golem", weapon_reward: "Crossbow" },
    { level: 3, name: "Demon Castle", entry_enemy: "Floating Eye", enemies: ["Floating Eye", "Ghost", "Skeleton"], enemy_counts: { "Floating Eye": 10, "Ghost": 8, "Skeleton": 8 }, placed_coins: 50, secret_coins: 20, boss: "Demon Lord", weapon_reward: "Flame Blade" },
  ];

  const PHYSICS = {
    SPEED: 8.6,
    GRAVITY: 34,
    JUMP_V: -17.2,
    CLIMB: 7,
    MAX_FALL: 28,
    AXE_DAMAGE: 10,
    AXE_TIME: 0.44,
    IFRAME: 1.12,
    COYOTE: 0.1,
  };

  const BEST_TIME_PREFIX = "ascii-run:best:";

  function enemyByName(name) {
    return ENEMIES.find((e) => e.name === name);
  }

  function weaponByName(name) {
    return WEAPONS.find((w) => w.name === name);
  }

  function levelByNumber(n) {
    return LEVELS.find((l) => l.level === n);
  }

  return {
    STARTER_DAMAGE,
    PLAYER_START_HEARTS,
    ENEMIES,
    HITS_TO_KILL_WITH_STARTER,
    WEAPONS,
    POWER_UPS,
    LEVELS,
    PHYSICS,
    BEST_TIME_PREFIX,
    enemyByName,
    weaponByName,
    levelByNumber,
  };
});
