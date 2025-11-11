const NOVA_REPO_URL: &str = "https://github.com/trynova/nova";
const NOVA_DIR: &str = "nova-builds";
const BENCHMARKS_DIR: &str = "benchmarks";

fn main() {
    let commits: Vec<String> = std::env::args().skip(1).collect();

    if commits.is_empty() {
        eprintln!("No commits provided.");
        std::process::exit(1);
    }

    // Check if nova directory exists, if not clone it
    if !std::path::Path::new(NOVA_DIR).exists() {
        std::process::Command::new("git")
            .args(&["clone", NOVA_REPO_URL, NOVA_DIR])
            .status()
            .expect("Failed to clone Nova repository");
    }

    let mut artifact_paths = Vec::new();

    for commit in commits.iter() {
        // Build Nova
        std::process::Command::new("git")
            .args(&["checkout", commit])
            .current_dir("nova")
            .status()
            .expect("Failed to checkout commit");

        println!("Building Nova at commit: {}", commit);

        // Buld the nova-cli binary
        std::process::Command::new("cargo")
            .args(&["build", "--release", "-p", "nova_cli"])
            .current_dir("nova")
            .status()
            .expect("Failed to build Nova");

        // Move the build artifact to include the commit hash
        let artifact_path = format!("{}/nova-{}", NOVA_DIR, commit);
        std::process::Command::new("cp")
            .args(&["nova/target/release/nova_cli", artifact_path.as_str()])
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

    for artifact_path in artifact_paths.iter() {
        println!("Running benchmarks for artifact: {}", artifact_path);

        for benchmark in benchmarks.iter() {
            let benchmark_path = benchmark.path();
            println!("  Running benchmark: {}", benchmark_path.display());

            let status = std::process::Command::new(artifact_path)
                .args(&["eval", benchmark_path.to_str().unwrap()])
                .status()
                .expect("Failed to run benchmark");

            if !status.success() {
                eprintln!("  Benchmark failed with status: {}", status);
            }
        }
    }
}
