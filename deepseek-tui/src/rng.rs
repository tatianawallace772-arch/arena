//! Tiny xorshift64* PRNG — std-only, so the crate keeps zero dependencies
//! beyond `ratatui` and `crossterm`.

use std::time::{SystemTime, UNIX_EPOCH};

/// Small, fast, deterministic-enough random number generator used for
/// streaming delays and mock-reply selection.
#[derive(Debug, Clone)]
pub struct Rng(u64);

impl Rng {
    /// Seed from the wall clock (nanosecond precision). Never returns an
    /// all-zero state, which xorshift cannot escape from.
    pub fn from_entropy() -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9E37_79B9_7F4A_7C15);
        Rng(nanos | 1)
    }

    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    /// Uniform float in `[0, 1)`.
    pub fn f32(&mut self) -> f32 {
        (self.next_u64() >> 40) as f32 / (1u64 << 24) as f32
    }

    /// Uniform integer in `[lo, hi]` (inclusive).
    pub fn range_u16(&mut self, lo: u16, hi: u16) -> u16 {
        if hi <= lo {
            return lo;
        }
        lo + (self.next_u64() % (hi as u64 - lo as u64 + 1)) as u16
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_is_inclusive_and_bounded() {
        let mut rng = Rng(0x1234_5678_9ABC_DEF1);
        for _ in 0..10_000 {
            let v = rng.range_u16(3, 7);
            assert!((3..=7).contains(&v));
        }
        assert_eq!(rng.range_u16(5, 5), 5);
        assert_eq!(rng.range_u16(9, 2), 9);
    }

    #[test]
    fn f32_stays_in_unit_range() {
        let mut rng = Rng(42);
        for _ in 0..10_000 {
            let f = rng.f32();
            assert!((0.0..1.0).contains(&f));
        }
    }
}
