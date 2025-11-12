const maps = [];

for (let i = 0; i < 100000; i++) {
  const m = new Map();
  maps.push(m);
}

for (const map of maps) {
  const start = now();
  map.size;
  print(`Elapsed: ${now() - start}`);
}
