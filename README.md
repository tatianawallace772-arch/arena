# Aurelia Zinc — Refinery Simulator

A clean, fully playable **roast–leach–electrowin (RLE)** zinc refinery. You sit the DCS: feed sphalerite concentrate, roast it to ZnO, make sulfuric acid from the SO₂, leach, purify with zinc dust, electrowin SHG metal, and cast ingots. The cellhouse, roaster, and pumps are generated in the browser with the Web Audio API — no sample pack.

## Run

Open `index.html` from any static server:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then use the live preview or visit `http://localhost:4173`.

Click **Enter control room** to unlock audio (browsers require a gesture). **Enter muted** skips the plant bed.

## Circuit

| Unit | What you are doing |
| --- | --- |
| Concentrate | ZnS feed, typically ~52% Zn |
| Roaster | `2 ZnS + 3 O₂ → 2 ZnO + 2 SO₂` · hold ~930 °C |
| Acid plant | Contact process, acid recycled to leach / cells |
| Leach | `ZnO + H₂SO₄ → ZnSO₄ + H₂O` · pH ~4.8 keeps iron out |
| Purification | Zinc dust cements Cu and Cd |
| Cellhouse | `Zn²⁺ + 2 e⁻ → Zn` · ~500 A/m², Faraday 1.2195 g/A·h |
| Casting | Melt cathodes, pour SHG ingots (≥ 99.995% Zn) |

Nameplate is about **15 t/h** cathode zinc (~120 kt/y). Specific energy should sit near 3,000–3,400 kWh/t when the circuit is on-spec.

## Controls

- **Space** start / pause
- **1–8** select units
- **M** mute
- **H** help
- Speed steps 1× → 4× → 16× → 60× plant time
- Emergency trip opens the rectifiers

Mis-set a unit and the plant will tell you: cold roast leaves sulfide, low pH dissolves iron, starved dust feed poisons current efficiency, and hot cells or dirty electrolyte drop you below SHG.

## Stack

Vanilla HTML, CSS, and ES modules. No build step, no dependencies.
