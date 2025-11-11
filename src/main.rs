const NOVA_REPO_URL: &str = "https://github.com/trynova/nova";
const NOVA_BUILD_DIR: &str = "nova-builds";
const NOVA_GIT_DIR: &str = "nova";
const BENCHMARKS_DIR: &str = "benchmarks";

fn main() {
    let commits: Vec<String> = std::env::args().skip(1).collect();

    if commits.is_empty() {
        eprintln!("No commits provided.");
        std::process::exit(1);
    }

    // Check if nova directory exists, if not clone it
    if !std::path::Path::new(NOVA_GIT_DIR).exists() {
        std::process::Command::new("git")
            .args(&["clone", NOVA_REPO_URL, NOVA_GIT_DIR])
            .status()
            .expect("Failed to clone Nova repository");
    }

    // Check if nova-builds directory exists, if not create it
    if !std::path::Path::new(NOVA_BUILD_DIR).exists() {
        std::fs::create_dir(NOVA_BUILD_DIR).expect("Failed to create build nova dir");
    }

    let mut artifact_paths = Vec::new();

    for commit in commits.iter() {
        // Build Nova
        std::process::Command::new("git")
            .args(&["checkout", commit])
            .current_dir(NOVA_GIT_DIR)
            .status()
            .expect("Failed to checkout commit");

        println!("Building Nova at commit: {}", commit);

        // Buld the nova-cli binary
        std::process::Command::new("cargo")
            .args(&["build", "--release", "-p", "nova_cli"])
            .current_dir(NOVA_GIT_DIR)
            .status()
            .expect("Failed to build Nova");

        // Move the build artifact to include the commit hash
        let artifact_path = format!("{}/nova-{}", NOVA_BUILD_DIR, commit);
        let nova_build_path = format!("{}/target/release/nova_cli", NOVA_GIT_DIR);
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
