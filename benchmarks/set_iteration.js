// Benchmark: Iterating across MANY Sets accessing their values arrays
// This tests SoAVec's benefit: when SetHeapData is in SoAVec, the values Vec pointers
// are stored contiguously, improving cache locality when iterating across many Sets.

const NUM_SETS = 50;  // Many sets to stress cache
const ENTRIES_PER_SET = 100;  // Small sets so we iterate through many of them
const ITERATIONS = 10;
const RUNS = 5;

function runBenchmark() {
    // Setup: Create MANY sets with entries
    const sets = [];
    for (let i = 0; i < NUM_SETS; i++) {
        const s = new Set();
        for (let j = 0; j < ENTRIES_PER_SET; j++) {
            s.add("A".repeat(1000000)); // 1KB string
        }
        sets.push(s);
    }

    // Benchmark 1: Iterate values across ALL sets sequentially
    // SoAVec benefit: SetHeapData structs are contiguous, so values Vec pointers are contiguous
    // This means better cache locality when accessing values[i] across many sets
    const valuesAcrossSetsTimes = [];
    let valuesSumResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalSum = 0;
        for (const set of sets) {
            for (const val of set.values()) {
                totalSum += val;
            }
        }
        valuesSumResult = totalSum;  // Use result
        const elapsed = now() - start;
        valuesAcrossSetsTimes.push(elapsed);
    }
    const sumValuesAcross = valuesAcrossSetsTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 2: Count values matching condition across all sets
    const filterValuesAcrossTimes = [];
    let filterValuesCountResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalCount = 0;
        for (let i = 0; i < sets.length; i++) {
            const set = sets[i];
            const threshold = i * ENTRIES_PER_SET + ENTRIES_PER_SET / 2;
            for (const val of set.values()) {
                if (val > threshold) totalCount++;
            }
        }
        filterValuesCountResult = totalCount;  // Use result
        const elapsed = now() - start;
        filterValuesAcrossTimes.push(elapsed);
    }
    const sumFilterValuesAcross = filterValuesAcrossTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 3: Find max value across all sets
    const maxValueAcrossTimes = [];
    let maxValueResult = -Infinity;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let globalMax = -Infinity;
        for (const set of sets) {
            for (const val of set.values()) {
                if (val > globalMax) globalMax = val;
            }
        }
        maxValueResult = globalMax;  // Use result
        const elapsed = now() - start;
        maxValueAcrossTimes.push(elapsed);
    }
    const sumMaxValueAcross = maxValueAcrossTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 4: Count even values across all sets
    const countEvenAcrossTimes = [];
    let countEvenResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalCount = 0;
        for (const set of sets) {
            for (const val of set.values()) {
                if (val % 2 === 0) totalCount++;
            }
        }
        countEvenResult = totalCount;  // Use result
        const elapsed = now() - start;
        countEvenAcrossTimes.push(elapsed);
    }
    const sumCountEvenAcross = countEvenAcrossTimes.reduce((a, b) => a + b, 0n);

    // Benchmark 5: Get size of all sets (touches set_data field)
    const sizeAllSetsTimes = [];
    let sizeSumResult = 0;  // Store result to prevent optimization
    for (let iter = 0; iter < ITERATIONS; iter++) {
        const start = now();
        let totalSize = 0;
        for (const set of sets) {
            totalSize += set.size;
        }
        sizeSumResult = totalSize;  // Use result
        const elapsed = now() - start;
        sizeAllSetsTimes.push(elapsed);
    }
    const sumSizeAll = sizeAllSetsTimes.reduce((a, b) => a + b, 0n);

    return {
        valuesAcross: sumValuesAcross,
        filterValuesAcross: sumFilterValuesAcross,
        maxValueAcross: sumMaxValueAcross,
        countEvenAcross: sumCountEvenAcross,
        sizeAll: sumSizeAll,
        // Return results to prevent optimization
        valuesSumResult,
        filterValuesCountResult,
        maxValueResult,
        countEvenResult,
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
    valuesAcross: [],
    filterValuesAcross: [],
    maxValueAcross: [],
    countEvenAcross: [],
    sizeAll: [],
};

print(`Set Cross-Container Iteration Benchmark`);
print(`Sets: ${NUM_SETS} x ${ENTRIES_PER_SET} entries | Iterations: ${ITERATIONS} | Runs: ${RUNS}`);
print(`This tests SoAVec benefit when iterating across MANY Sets`);
print(`Running ${RUNS} iterations...`);

// Store results to prevent optimization
let lastValuesSum = 0;
let lastFilterValuesCount = 0;
let lastMaxValue = -Infinity;
let lastCountEven = 0;
let lastSizeSum = 0;

for (let run = 0; run < RUNS; run++) {
    print(`  Run ${run + 1}/${RUNS}`);
    const r = runBenchmark();
    results.valuesAcross.push(r.valuesAcross);
    results.filterValuesAcross.push(r.filterValuesAcross);
    results.maxValueAcross.push(r.maxValueAcross);
    results.countEvenAcross.push(r.countEvenAcross);
    results.sizeAll.push(r.sizeAll);
    // Store results from last run
    lastValuesSum = r.valuesSumResult;
    lastFilterValuesCount = r.filterValuesCountResult;
    lastMaxValue = r.maxValueResult;
    lastCountEven = r.countEvenResult;
    lastSizeSum = r.sizeSumResult;
}

print(`\n${"Operation".padEnd(20)} ${"Average".padStart(12)}      ${"Min".padStart(12)}   ${"Max".padStart(12)}`);
print(`─`.repeat(76));
print(formatRow("values (all sets)", results.valuesAcross));
print(formatRow("filter values (all)", results.filterValuesAcross));
print(formatRow("max value (all)", results.maxValueAcross));
print(formatRow("count even (all)", results.countEvenAcross));
print(formatRow("size (all sets)", results.sizeAll));
// Prevent optimization by referencing results
if (lastValuesSum + lastFilterValuesCount + lastMaxValue + lastCountEven + lastSizeSum === -1) {
    print("This should never print");
}
