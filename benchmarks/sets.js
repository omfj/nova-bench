const sets = [];

for (let i = 0; i < 800_000; i++) {
  const s = new Set();
  sets.push(s);
}

const times = [];

for (const set of sets) {
  const start = now();
  set.size;
  const end = now();
  times.push(end - start);
}

const best = times.reduce(
  (a, b) => (a < b ? a : b),
  BigInt(Number.MAX_SAFE_INTEGER)
);
print(`Best time to get size of Set: ${best} ns`);

const avg = times.reduce((a, b) => a + b, 0n) / BigInt(times.length);
print(`Average time to get size of Set: ${avg} ns`);

const worst = times.reduce((a, b) => (a > b ? a : b), 0n);
print(`Worst time to get size of Set: ${worst} ns`);
