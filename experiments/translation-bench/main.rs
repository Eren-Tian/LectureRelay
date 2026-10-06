//! Research only: offline CPU inference with independently acquired Mozilla files.
//! This is not a shipped application dependency or a Python requirement.
use fxtranslate::engine::Engine;
use std::io::{self, BufRead, Write};
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 5 {
        return Err(
            "Expected model, source vocab, target vocab and lexical shortlist paths".into(),
        );
    }
    let loading = Instant::now();
    let engine = Engine::load_mmapped(&args[1], &args[2], &args[3])?
        .with_shortlist_bytes(&std::fs::read(&args[4])?);
    println!(
        "{}",
        serde_json::json!({"ready":true,"loadMs":loading.elapsed().as_secs_f64()*1000.0})
    );
    io::stdout().flush()?;
    for line in io::stdin().lock().lines() {
        let input: serde_json::Value = serde_json::from_str(&line?)?;
        let text = input["text"].as_str().ok_or("Missing text")?;
        if text.len() > 16384 {
            return Err("Research input exceeds limit".into());
        }
        let started = Instant::now();
        let translated = engine.translate_long(text);
        println!(
            "{}",
            serde_json::json!({"id":input["id"],"text":translated,"computeMs":started.elapsed().as_secs_f64()*1000.0})
        );
        io::stdout().flush()?;
    }
    Ok(())
}
