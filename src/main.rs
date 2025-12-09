use comfy_table::{Cell, Color, Table, modifiers::UTF8_ROUND_CORNERS, presets::UTF8_FULL};
use std::collections::HashMap;

const NOVA_REPO_URL: &str = "https://github.com/trynova/nova";
const NOVA_BUILD_DIR: &str = "nova-builds";
const NOVA_GIT_DIR: &str = "nova";
const BENCHMARKS_DIR: &str = "benchmarks";

#[derive(Debug)]
struct BenchmarkResult {
    benchmark: String,
    commit: String,
    times: Vec<u128>,
}

impl BenchmarkResult {
    fn best(&self) -> u128 {
        self.times.iter().copied().min().unwrap_or(0)
    }

    fn worst(&self) -> u128 {
        self.times.iter().copied().max().unwrap_or(0)
    }

    fn median(&self) -> u128 {
        let mut sorted = self.times.clone();
        sorted.sort_unstable();
        let len = sorted.len();
        if len == 0 {
            return 0;
        }
        if len % 2 == 0 {
            (sorted[len / 2 - 1] + sorted[len / 2]) / 2
        } else {
            sorted[len / 2]
        }
    }

    fn average(&self) -> u128 {
        if self.times.is_empty() {
            return 0;
        }
        self.times.iter().sum::<u128>() / self.times.len() as u128
    }
}

fn main() {
    let commits: Vec<String> = std::env::args().skip(1).collect();

    if commits.is_empty() {
        eprintln!("No commits provided.");
        std::process::exit(1);
    }

    // Check if nova directory exists, if not clone it
    if !std::path::Path::new(NOVA_GIT_DIR).exists() {
        println!("Cloning Nova repository...");
        std::process::Command::new("git")
            .args(&["clone", NOVA_REPO_URL, NOVA_GIT_DIR])
            .status()
            .expect("Failed to clone Nova repository");
    }

    // Get the latest changes from the remote
    println!("Fetching latest changes...");
    std::process::Command::new("git")
        .args(&["fetch", "origin"])
        .current_dir(NOVA_GIT_DIR)
        .status()
        .expect("Failed to fetch latest changes");

    // Check if nova-builds directory exists, if not create it
    if !std::path::Path::new(NOVA_BUILD_DIR).exists() {
        println!("Creating build directory...");
        std::fs::create_dir(NOVA_BUILD_DIR).expect("Failed to create build nova dir");
    }

    let mut artifact_paths = Vec::new();

    for commit in commits.iter() {
        // Build Nova
        println!("Checking out commit: {}", commit);
        std::process::Command::new("git")
            .args(&["checkout", commit])
            .current_dir(NOVA_GIT_DIR)
            .status()
            .expect("Failed to checkout commit");

        // Check if build artifact already exists
        let artifact_path = format!("{}/nova-{}", NOVA_BUILD_DIR, commit);
        if std::path::Path::new(&artifact_path).exists() {
            println!(
                "Build artifact for commit {} already exists, skipping build.",
                commit
            );
            artifact_paths.push(artifact_path);
            continue;
        }

        // Build the nova-cli binary
        println!("Building Nova at commit: {}", commit);
        std::process::Command::new("cargo")
            .args(&["build", "--release", "-p", "nova_cli"])
            .current_dir(NOVA_GIT_DIR)
            .status()
            .expect("Failed to build Nova");

        // Move the build artifact to include the commit hash
        let artifact_path = format!("{}/nova-{}", NOVA_BUILD_DIR, commit);
        let nova_build_path = format!("{}/target/release/nova_cli", NOVA_GIT_DIR);
        println!("Copying build artifact to: {}", artifact_path);
        std::process::Command::new("cp")
            .args(&[nova_build_path.as_str(), artifact_path.as_str()])
            .status()
            .expect("Failed to copy Nova artifact");

        // Save build artifacts
        artifact_paths.push(artifact_path);
    }

    // Read JavaScript benchmark files
    let benchmarks: Vec<_> = std::fs::read_dir(BENCHMARKS_DIR)
        .expect("Failed to read benchmarks directory")
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().is_file() && entry.path().extension().map_or(false, |ext| ext == "js")
        })
        .collect();

    let mut all_results: Vec<BenchmarkResult> = Vec::new();

    for (idx, artifact_path) in artifact_paths.iter().enumerate() {
        let commit = &commits[idx];
        println!("Running benchmarks for commit: {}", commit);

        for benchmark in benchmarks.iter() {
            let benchmark_path = benchmark.path();
            let benchmark_name = benchmark_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            println!("  Running benchmark: {}", benchmark_name);

            let output = std::process::Command::new(artifact_path)
                .args(&["eval", benchmark_path.to_str().unwrap()])
                .output()
                .expect("Failed to run benchmark");

            if !output.status.success() {
                eprintln!("  Benchmark failed with status: {}", output.status);
                continue;
            }

            // Parse times from stdout
            let stdout = String::from_utf8_lossy(&output.stdout);
            let times: Vec<u128> = stdout
                .lines()
                .filter_map(|line| line.trim().parse::<u128>().ok())
                .collect();

            if !times.is_empty() {
                all_results.push(BenchmarkResult {
                    benchmark: benchmark_name.to_string(),
                    commit: commit.clone(),
                    times,
                });
            }
        }
    }

    // Print results in table format
    print_results_table(&all_results);
}

fn format_number(n: u128) -> String {
    let s = n.to_string();
    let mut result = String::new();
    let mut count = 0;

    for ch in s.chars().rev() {
        if count > 0 && count % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
        count += 1;
    }

    result.chars().rev().collect()
}

fn print_results_table(results: &[BenchmarkResult]) {
    if results.is_empty() {
        println!("\nNo results to display.");
        return;
    }

    // Group by commit and benchmark
    let mut grouped: HashMap<String, HashMap<String, &BenchmarkResult>> = HashMap::new();
    for result in results {
        grouped
            .entry(result.commit.clone())
            .or_insert_with(HashMap::new)
            .insert(result.benchmark.clone(), result);
    }

    // Get all unique benchmark names
    let mut benchmark_names: Vec<String> = results
        .iter()
        .map(|r| r.benchmark.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    benchmark_names.sort();

    // Sort commits to maintain consistent order
    let mut commits: Vec<String> = grouped.keys().cloned().collect();
    commits.sort();

    println!("\n");

    for commit in commits {
        let mut table = Table::new();
        table
            .load_preset(UTF8_FULL)
            .apply_modifier(UTF8_ROUND_CORNERS)
            .set_header(vec![
                Cell::new("Benchmark").fg(Color::Cyan),
                Cell::new("Best (ns)").fg(Color::Green),
                Cell::new("Worst (ns)").fg(Color::Red),
                Cell::new("Median (ns)").fg(Color::Yellow),
                Cell::new("Avg (ns)").fg(Color::Blue),
            ]);

        let commit_results = &grouped[&commit];
        for bench_name in &benchmark_names {
            if let Some(result) = commit_results.get(bench_name) {
                table.add_row(vec![
                    &result.benchmark,
                    &format_number(result.best()),
                    &format_number(result.worst()),
                    &format_number(result.median()),
                    &format_number(result.average()),
                ]);
            }
        }

        println!("Commit: {}", commit);
        println!("{}", table);
        println!();
    }
}
