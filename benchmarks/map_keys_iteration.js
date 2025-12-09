// Benchmark: Iterating across MANY Maps accessing their keys/values arrays
// This tests SoAVec's benefit: when MapHeapData is in SoAVec, the keys/values Vec pointers
// are stored contiguously, improving cache locality when iterating across many Maps.
/*
const NUM_MAPS = 5000;  // Many maps to stress cache
const ENTRIES_PER_MAP = 100;  // Small maps so we iterate through many of them
const ITERATIONS = 10;
const RUNS = 5;

function runBenchmark() {
    // Setup: Create MANY maps with entries
    // Use MASSIVE string values to stress cache - each value is ~10KB
    const maps = [];
    const VALUE_SIZE = 10000;  // Characters per value string (~10KB each)
    for (let i = 0; i < NUM_MAPS; i++) {
        const m = new Map();
        for (let j = 0; j < ENTRIES_PER_MAP; j++) {
            // Create massive string value: "value_<i>_<j>_<huge padding>"
            const valueStr = `value_${i}_${j}_${"x".repeat(VALUE_SIZE - 20)}`;
            m.set(i * ENTRIES_PER_MAP + j, valueStr);
        }
        maps.push(m);
    }

    // Benchmark 1: Iterate keys across ALL maps sequentially
    // SoAVec benefit: MapHeapData structs are contiguous, so keys Vec pointers are contiguous
    // This means better cache locality when accessing keys[i] across many maps
    const keysAcrossMapsTimes = [];
    let keysSumResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalSum = 0;
        for (const map of maps) {
            for (const key of map.keys()) {
                totalSum += key;  // Keys are still integers
            }
        }
        keysSumResult = totalSum;  // Use result
        const elapsed = now() - start;
        keysAcrossMapsTimes.push(elapsed);
    }
    const sumKeysAcross = keysAcrossMapsTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 2: Iterate values across ALL maps sequentially
    // Large string values stress cache - SoAVec benefit: values Vec pointers are contiguous
    const valuesAcrossMapsTimes = [];
    let valuesLengthResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalLength = 0;
        for (const map of maps) {
            for (const val of map.values()) {
                totalLength += val.length;  // Access string length to touch the value
            }
        }
        valuesLengthResult = totalLength;  // Use result
        const elapsed = now() - start;
        valuesAcrossMapsTimes.push(elapsed);
    }
    const sumValuesAcross = valuesAcrossMapsTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 3: Count keys matching condition across all maps
    const filterKeysAcrossTimes = [];
    let filterKeysCountResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalCount = 0;
        for (let i = 0; i < maps.length; i++) {
            const map = maps[i];
            const threshold = i * ENTRIES_PER_MAP + ENTRIES_PER_MAP / 2;
            for (const key of map.keys()) {
                if (key > threshold) totalCount++;
            }
        }
        filterKeysCountResult = totalCount;  // Use result
        const elapsed = now() - start;
        filterKeysAcrossTimes.push(elapsed);
    }
    const sumFilterKeysAcross = filterKeysAcrossTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 4: Count values matching condition across all maps
    // Accessing large string values stresses cache
    const filterValuesAcrossTimes = [];
    let filterValuesCountResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalCount = 0;
        for (const map of maps) {
            for (const val of map.values()) {
                if (val.length > 50) totalCount++;  // Check string length
            }
        }
        filterValuesCountResult = totalCount;  // Use result
        const elapsed = now() - start;
        filterValuesAcrossTimes.push(elapsed);
    }
    const sumFilterValuesAcross = filterValuesAcrossTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 5: Get size of all maps (touches map_data field)
    const sizeAllMapsTimes = [];
    let sizeSumResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalSize = 0;
        for (const map of maps) {
            totalSize += map.size;
        }
        sizeSumResult = totalSize;  // Use result
        const elapsed = now() - start;
        sizeAllMapsTimes.push(elapsed);
    }
    const sumSizeAll = sizeAllMapsTimes.reduce((a, b) => a + b, 0n);

    return {
        keysAcross: sumKeysAcross,
        valuesAcross: sumValuesAcross,
        filterKeysAcross: sumFilterKeysAcross,
        filterValuesAcross: sumFilterValuesAcross,
        sizeAll: sumSizeAll,
        // Return results to prevent optimization
        keysSumResult,
        valuesLengthResult,
        filterKeysCountResult,
        filterValuesCountResult,
        sizeSumResult,
    };
}

// Statistics helpers
function avg(arr) {
    return arr.reduce((a, b) => a + b, 0n) / BigInt(arr.length);
}

function min(arr) {
    let m = arr[0];
    for (const v of arr) if (v < m) m = v;
    return m;
}

function max(arr) {
    let m = arr[0];
    for (const v of arr) if (v > m) m = v;
    return m;
}

function formatRow(name, arr) {
    const a = avg(arr);
    const mn = min(arr);
    const mx = max(arr);
    return `${name.padEnd(20)} ${String(a).padStart(12)} ns  [${String(mn).padStart(12)} - ${String(mx).padStart(12)}]`;
}

// Collect results
const results = {
    keysAcross: [],
    valuesAcross: [],
    filterKeysAcross: [],
    filterValuesAcross: [],
    sizeAll: [],
};

print(`Map Cross-Container Iteration Benchmark (MASSIVE String Values ~10KB each)`);
print(`Maps: ${NUM_MAPS} x ${ENTRIES_PER_MAP} entries | Iterations: ${ITERATIONS} | Runs: ${RUNS}`);
print(`This tests SoAVec benefit when iterating across MANY Maps with huge values`);
print(`Running ${RUNS} iterations...`);

    // Store results to prevent optimization
let lastKeysSum = 0;
let lastValuesLength = 0;
let lastFilterKeysCount = 0;
let lastFilterValuesCount = 0;
let lastSizeSum = 0;

for (let run = 0; run < RUNS; run++) {
    print(`  Run ${run + 1}/${RUNS}`);
    const r = runBenchmark();
    results.keysAcross.push(r.keysAcross);
    results.valuesAcross.push(r.valuesAcross);
    results.filterKeysAcross.push(r.filterKeysAcross);
    results.filterValuesAcross.push(r.filterValuesAcross);
    results.sizeAll.push(r.sizeAll);
    // Store results from last run
    lastKeysSum = r.keysSumResult;
    lastValuesLength = r.valuesLengthResult;
    lastFilterKeysCount = r.filterKeysCountResult;
    lastFilterValuesCount = r.filterValuesCountResult;
    lastSizeSum = r.sizeSumResult;
}

print(`\n${"Operation".padEnd(20)} ${"Average".padStart(12)}      ${"Min".padStart(12)}   ${"Max".padStart(12)}`);
print(`─`.repeat(76));
print(formatRow("keys (all maps)", results.keysAcross));
print(formatRow("values (all maps)", results.valuesAcross));
print(formatRow("filter keys (all)", results.filterKeysAcross));
print(formatRow("filter values (all)", results.filterValuesAcross));
print(formatRow("size (all maps)", results.sizeAll));
// Prevent optimization by referencing results
if (lastKeysSum + lastValuesLength + lastFilterKeysCount + lastFilterValuesCount + lastSizeSum === -1) {
    print("This should never print");
}
*/