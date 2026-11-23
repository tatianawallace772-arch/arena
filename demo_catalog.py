"""Bundled demo catalog for SpotAPIfy.

Used when Spotify is unreachable (or SPOTAPI_MODE=demo). The data is
deterministic so IDs stay stable across restarts; track previews are
synthesized on demand by audio_synth.py.
"""

from __future__ import annotations

import hashlib

ARTISTS = [
    {
        "id": "ar_neon_coastline",
        "name": "Neon Coastline",
        "genres": ["synthwave", "chillwave", "electronic", "retrowave"],
        "listeners": 2845113,
        "blurb": "Analog synths, palm trees and endless night drives.",
    },
    {
        "id": "ar_velvet_static",
        "name": "Velvet Static",
        "genres": ["indie", "rock", "alternative"],
        "listeners": 1932740,
        "blurb": "Basement-recorded indie rock with a fuzz pedal heart.",
    },
    {
        "id": "ar_luna_reyes",
        "name": "Luna Reyes",
        "genres": ["pop", "dance", "synth-pop"],
        "listeners": 5120988,
        "blurb": "Chart-ready pop with glitter on the chorus.",
    },
    {
        "id": "ar_midnight_circuit",
        "name": "Midnight Circuit",
        "genres": ["techno", "electronic", "house"],
        "listeners": 1456209,
        "blurb": "Warehouse-tested techno for the afterhours.",
    },
    {
        "id": "ar_golden_hour",
        "name": "Golden Hour Collective",
        "genres": ["lo-fi", "jazz", "chill"],
        "listeners": 987445,
        "blurb": "Sun-soaked lo-fi jazz recorded in one take.",
    },
    {
        "id": "ar_atlas_north",
        "name": "Atlas North",
        "genres": ["ambient", "post-rock", "instrumental"],
        "listeners": 673112,
        "blurb": "Slow-moving soundscapes from the far north.",
    },
]

# (title, duration in seconds)
ALBUMS = [
    {"id": "al_chrome_waves", "name": "Chrome Waves", "artist_id": "ar_neon_coastline", "year": 2023, "tracks": [
        ("Midnight Overdrive", 214), ("Neon Palms", 187), ("Chrome Waves", 243),
        ("Sunset Grid", 201), ("Tokyo Rain", 226), ("Afterglow Avenue", 195)]},
    {"id": "al_night_drive", "name": "Night Drive FM", "artist_id": "ar_neon_coastline", "year": 2024, "tracks": [
        ("Night Drive FM", 208), ("Laser Highway", 232), ("Palm Static", 179),
        ("Cruise Control", 197), ("Violet Skies", 221), ("3AM Rendezvous", 246)]},
    {"id": "al_paper_moons", "name": "Paper Moons", "artist_id": "ar_velvet_static", "year": 2022, "tracks": [
        ("Paper Moons", 233), ("Rust & Honey", 205), ("Basement Tapes", 188),
        ("Half-Remembered", 241), ("Satellite Heart", 219), ("Quiet Machines", 254)]},
    {"id": "al_static_bloom", "name": "Static Bloom", "artist_id": "ar_velvet_static", "year": 2024, "tracks": [
        ("Static Bloom", 198), ("Glass Orchard", 224), ("Feedback Loop", 181),
        ("Wildflowers & Wires", 236), ("Slow Earthquake", 259), ("Porcelain", 213)]},
    {"id": "al_gravity", "name": "Gravity", "artist_id": "ar_luna_reyes", "year": 2023, "tracks": [
        ("Gravity", 192), ("Sticky Sweet", 176), ("Orbit", 201),
        ("Cherry Cola", 184), ("Constellations", 228), ("Text Me Back", 169)]},
    {"id": "al_heartbeats", "name": "Heartbeats in Neon", "artist_id": "ar_luna_reyes", "year": 2025, "tracks": [
        ("Heartbeats in Neon", 195), ("Glitter Crush", 182), ("Ultraviolet", 209),
        ("Dance Alone", 188), ("Midnight Confetti", 203), ("Neon Honeymoon", 217)]},
    {"id": "al_voltage", "name": "Voltage", "artist_id": "ar_midnight_circuit", "year": 2021, "tracks": [
        ("Voltage", 244), ("Surge Protector", 231), ("Binary Sunset", 262),
        ("Copper Wire", 218), ("Overclocked", 205), ("Blackout Protocol", 271)]},
    {"id": "al_afterhours", "name": "Afterhours Protocol", "artist_id": "ar_midnight_circuit", "year": 2024, "tracks": [
        ("Afterhours Protocol", 238), ("Warehouse Hymn", 256), ("Strobe", 199),
        ("Deep Current", 282), ("Last Train Home", 224), ("Exit Signs", 247)]},
    {"id": "al_sunroom", "name": "Sunroom Sessions", "artist_id": "ar_golden_hour", "year": 2022, "tracks": [
        ("Sunroom", 186), ("Amber Afternoon", 212), ("Vinyl & Coffee", 174),
        ("Window Seat", 235), ("Dusty Grooves", 190), ("Golden Hour", 249)]},
    {"id": "al_latitudes", "name": "Latitudes", "artist_id": "ar_atlas_north", "year": 2020, "tracks": [
        ("Latitudes", 264), ("Glacier", 301), ("North of Here", 227),
        ("Tidal Patterns", 289), ("The Long Light", 342), ("Aurora", 255)]},
]

PLAYLISTS = [
    {"id": "pl_daily_mix", "name": "Daily Mix", "owner": "SpotAPIfy",
     "description": "Neon Coastline, Luna Reyes, Velvet Static and more",
     "tags": ["mix", "discover"], "tracks": [
        "t_chrome_waves_01", "t_gravity_01", "t_paper_moons_02", "t_night_drive_02",
        "t_heartbeats_02", "t_static_bloom_01", "t_sunroom_06", "t_voltage_03",
        "t_latitudes_01", "t_heartbeats_04"]},
    {"id": "pl_chill_vibes", "name": "Chill Vibes", "owner": "SpotAPIfy",
     "description": "Lo-fi jazz and slow ambient for winding down",
     "tags": ["chill", "lo-fi", "ambient", "sleep"], "tracks": [
        "t_sunroom_01", "t_sunroom_03", "t_latitudes_04", "t_chrome_waves_05",
        "t_sunroom_04", "t_latitudes_06", "t_night_drive_05", "t_sunroom_06"]},
    {"id": "pl_workout", "name": "Workout Energy", "owner": "SpotAPIfy",
     "description": "High-BPM techno and pop to keep the pace up",
     "tags": ["workout", "electronic", "energy"], "tracks": [
        "t_voltage_01", "t_afterhours_03", "t_gravity_04", "t_voltage_05",
        "t_heartbeats_01", "t_afterhours_01", "t_gravity_02", "t_night_drive_02"]},
    {"id": "pl_deep_focus", "name": "Deep Focus", "owner": "SpotAPIfy",
     "description": "Instrumental ambient and lo-fi for deep work",
     "tags": ["focus", "ambient", "instrumental", "study"], "tracks": [
        "t_latitudes_01", "t_latitudes_02", "t_sunroom_02", "t_latitudes_05",
        "t_sunroom_04", "t_afterhours_04", "t_latitudes_03", "t_voltage_03"]},
    {"id": "pl_evening_drive", "name": "Evening Drive", "owner": "SpotAPIfy",
     "description": "Synthwave for golden-hour highways",
     "tags": ["synthwave", "drive", "chill"], "tracks": [
        "t_night_drive_01", "t_chrome_waves_01", "t_night_drive_04", "t_chrome_waves_03",
        "t_night_drive_06", "t_chrome_waves_06", "t_afterhours_05", "t_night_drive_03"]},
    {"id": "pl_indie_radar", "name": "Indie Radar", "owner": "SpotAPIfy",
     "description": "Fresh fuzz from Velvet Static",
     "tags": ["indie", "rock", "alternative"], "tracks": [
        "t_paper_moons_01", "t_static_bloom_02", "t_paper_moons_04", "t_static_bloom_04",
        "t_paper_moons_05", "t_static_bloom_06", "t_paper_moons_03", "t_static_bloom_05"]},
    {"id": "pl_pop_rising", "name": "Pop Rising", "owner": "SpotAPIfy",
     "description": "Luna Reyes and the shiniest hooks around",
     "tags": ["pop", "dance"], "tracks": [
        "t_heartbeats_01", "t_gravity_01", "t_heartbeats_02", "t_gravity_04",
        "t_heartbeats_03", "t_gravity_03", "t_heartbeats_06", "t_gravity_06"]},
    {"id": "pl_slow_sunday", "name": "Slow Sunday", "owner": "SpotAPIfy",
     "description": "Coffee, sunlight through blinds, nothing urgent",
     "tags": ["chill", "jazz", "morning"], "tracks": [
        "t_sunroom_06", "t_latitudes_05", "t_sunroom_02", "t_paper_moons_06",
        "t_sunroom_05", "t_latitudes_03", "t_static_bloom_05", "t_sunroom_04"]},
]


def _plays(track_id: str) -> int:
    return int(hashlib.md5(track_id.encode()).hexdigest()[:8], 16) % 9_000_000 + 400_000


def _build():
    artists = {a["id"]: dict(a) for a in ARTISTS}
    albums = {}
    tracks = {}
    for al in ALBUMS:
        artist = artists[al["artist_id"]]
        slug = al["id"][3:]
        track_ids = []
        for n, (title, secs) in enumerate(al["tracks"], 1):
            tid = f"t_{slug}_{n:02d}"
            track_ids.append(tid)
            tracks[tid] = {
                "id": tid,
                "name": title,
                "album_id": al["id"],
                "artist_ids": [al["artist_id"]],
                "duration_ms": secs * 1000,
                "track_number": n,
                "plays": _plays(tid),
                "genres": list(artist["genres"]),
            }
        albums[al["id"]] = {
            "id": al["id"],
            "name": al["name"],
            "artist_id": al["artist_id"],
            "year": al["year"],
            "track_ids": track_ids,
        }
    playlists = {p["id"]: dict(p) for p in PLAYLISTS}
    return artists, albums, tracks, playlists


ARTIST_MAP, ALBUM_MAP, TRACK_MAP, PLAYLIST_MAP = _build()
