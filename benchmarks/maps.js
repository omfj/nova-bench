const maps = [];

for (let i = 0; i < 100_000; i++) {
  const m = new Map();
  maps.push(m);
}

const times = [];

for (const map of maps) {
  const start = now();
  map.size;
  const end = now();
  times.push(end - start);
}

const best = times.reduce(
  (a, b) => (a < b ? a : b),
  BigInt(Number.MAX_SAFE_INTEGER)
);
print(`Best time to get size of Map: ${best} ns`);

const avg = times.reduce((a, b) => a + b, 0n) / BigInt(times.length);
print(`Average time to get size of Map: ${avg} ns`);

const worst = times.reduce((a, b) => (a > b ? a : b), 0n);
print(`Worst time to get size of Map: ${worst} ns`);
