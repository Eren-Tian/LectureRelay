fn main() {
    tauri_build::build();
    // Library test executables do not inherit the GUI binary's Win32 manifest.
    // Wry's TaskDialogIndirect import requires Common Controls v6 even without a webview.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("tests/windows-test.manifest")
                .display()
        );
        println!("cargo:rerun-if-changed=tests/windows-test.manifest");
    }
}
