const sets = [];

for (let i = 0; i < 800_000; i++) {
  const s = new Set();
  sets.push(s);
}

for (const set of sets) {
  const start = now();
  set.size;
  const end = now();
  print(end - start);
}
