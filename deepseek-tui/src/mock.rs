//! The "mock brain" — a keyword-matching reply engine that stands in for a
//! real LLM. Everything is local: no network, no API key, no model weights.
//!
//! To teach the simulator new tricks, add a `const` reply and a branch in
//! [`reply`].

use crate::app::truncate_chars;
use crate::rng::Rng;

const GREETING: &str = "Hey! 👋 I'm DeepSeek — well, a simulated terminal version of it, running entirely on canned responses and good intentions.\n\nAsk me about Rust, code, jokes, haiku, or DeepSeek itself. Everything you see is generated locally — no network required.";

const WHO: &str = "I'm a terminal-simulator recreation of DeepSeek, built with Rust + ratatui. Under the hood there's no model at all — just a keyword matcher in src/mock.rs streaming words with fake latency so the UI feels alive.\n\nThink of me as a stage set: convincing from the audience, hollow behind the scenes.";

const HOWAREYOU: &str = "Running at a crisp 60 frames per second with zero context-window anxiety — so, pretty great!\n\nHow about you? (I'm listening, in a purely decorative sense.)";

const ABOUT: &str = "DeepSeek is an AI research lab known for its DeepSeek-V3 and R1 model families — strong reasoning and coding models that became famous for their efficiency and open weights.\n\nThis app, however, is just a fan-made TUI homage: DeepSeek-blue branding, chat sessions, streaming replies… and zero actual intelligence. All responses come from src/mock.rs.";

const RUST: &str = "Ah, you're asking about Rust — excellent choice.\n\nRust is a systems programming language that guarantees memory safety without a garbage collector. Ownership moves values by default, borrows let you reference them, and the borrow checker enforces the rules at compile time.\n\nThe classic beginner roadblocks:\n• fighting the borrow checker (it's usually right)\n• lifetime annotations on structs\n• String vs &str confusion\n\nOnce it clicks, you'll never look at segfaults the same way.";

const CODE: &str = "Here's a classic — iterative Fibonacci in Rust:\n\nfn fib(n: u64) -> u64 {\n    let (mut a, mut b) = (0, 1);\n    for _ in 0..n {\n        (a, b) = (b, a + b);\n    }\n    a\n}\n\nNo recursion, no allocation, and no overflow until n = 94. Rust's destructuring assignment makes the swap elegant — though the borrow checker is still happy to keep you humble.";

const JOKE: &str = "Why do Rust developers never get lost?\n\nBecause the compiler refuses to let them proceed down an undefined path. 🥁\n\nBonus: a SQL query walks into a bar, approaches two tables, and asks — mind if I join you?";

const HAIKU: &str = "Here's one:\n\nblue cursor blinking —\nwords stream across the silence\nthe whale hums in code";

const WEATHER: &str = "I'm simulated, offline, and living in a terminal — so my weather report would be:\n\n• today: dark mode, 100% humidity of electrons\n• tomorrow: more dark mode\n\nFor real forecasts you'll want an internet-connected assistant.";

const HELP: &str = "Happy to help! This TUI is fully keyboard-driven:\n\n• Enter — send a message\n• Tab — switch between the input and the chats panel\n• ↑/↓ — recall sent messages, or pick a chat in the sidebar\n• PgUp/PgDn or mouse wheel — scroll the conversation\n• Ctrl+N — new chat · d — delete chat (sidebar)\n• F1 — this help panel\n\nTry asking for a joke, some Rust code, or about DeepSeek itself.";

const THANKS: &str = "You're welcome! That's exactly what simulated gratitude circuits were built for. 🐋\n\nAnything else — code, jokes, more fake wisdom?";

const BYE: &str = "Goodbye! 👋 This chat will keep floating in the sidebar, conserving electrons until you return.\n\nPress Esc or Ctrl+C whenever you want to close the terminal for real.";

const FALLBACKS: [&str; 3] = [
    "Interesting — tell me more about \"{q}\".\n\nI'd love to unpack that properly, but my brain is a keyword matcher in src/mock.rs and \"{q}\" isn't in its vocabulary. Try asking about Rust, code, jokes, DeepSeek — or just type help.",
    "Here's my honest take on \"{q}\": it sounds like a great question for a real LLM.\n\nAs a simulator, I'll do what any good mock would do — acknowledge the input, stream some plausible-looking words, and let the UI shine. ✨\n\nTry \"joke\", \"rust\", \"code\", or \"help\" for the good stuff.",
    "Hmm, \"{q}\" — noted and appreciated.\n\nMy mock cortex offers this universal answer: it depends. But seriously — ask me for a haiku, a joke, or to explain Rust, and watch the streaming magic happen.",
];

/// Pick a reply for `prompt`. `rng` selects among fallback variants.
pub fn reply(prompt: &str, rng: &mut Rng) -> String {
    let p = prompt.to_lowercase();
    let quote = truncate_chars(prompt.replace('\n', " ").trim(), 44);

    let selected: &str = if contains_any(&p, &["help", "usage", "command"]) {
        HELP
    } else if is_greeting(&p) {
        GREETING
    } else if contains_any(&p, &["who are you", "what are you", "your name", "introduce"]) {
        WHO
    } else if contains_any(&p, &["how are you", "how's it going", "hows it going", "how you doing"])
    {
        HOWAREYOU
    } else if p.contains("deepseek") {
        ABOUT
    } else if contains_any(&p, &["haiku", "poem", "poetry"]) {
        HAIKU
    } else if contains_any(&p, &["joke", "funny", "make me laugh"]) {
        JOKE
    } else if contains_any(&p, &["weather", "forecast", "rain", "temperature"]) {
        WEATHER
    } else if p.contains("rust") {
        RUST
    } else if contains_any(&p, &["code", "function", "fibonacci", "algorithm", "program", "python"])
    {
        CODE
    } else if p.contains("thank") {
        THANKS
    } else if contains_any(&p, &["bye", "goodbye", "see you", "good night", "farewell"]) {
        BYE
    } else {
        FALLBACKS[(rng.next_u64() % FALLBACKS.len() as u64) as usize]
    };

    selected.replace("{q}", &quote)
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| haystack.contains(n))
}

fn is_greeting(p: &str) -> bool {
    p == "hi" || p == "yo" || p == "hello" || p == "hey" || p == "sup" || {
        contains_any(
            p,
            &[
                "hello ",
                "hi ",
                "hey ",
                "good morning",
                "good evening",
                "greetings",
                "what's up",
                "whats up",
            ],
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replies_are_nonempty_and_fully_substituted() {
        let mut rng = Rng::from_entropy();
        for prompt in ["hello", "write me some rust code", "tell me a joke", "zzz?"] {
            let r = reply(prompt, &mut rng);
            assert!(!r.is_empty());
            assert!(!r.contains("{q}"), "unsubstituted placeholder in reply");
        }
    }

    #[test]
    fn keywords_route_to_expected_topics() {
        let mut rng = Rng::from_entropy();
        assert!(reply("what is rust", &mut rng).contains("borrow checker"));
        assert!(reply("tell me a joke", &mut rng).contains("SQL query"));
        assert!(reply("hello there", &mut rng).contains("simulated terminal version"));
    }
}
