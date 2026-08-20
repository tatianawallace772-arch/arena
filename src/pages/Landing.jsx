import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import { fetchPlans } from "../lib/api.js";
import { FALLBACK_PLANS, priceFor } from "../lib/session.js";

export default function Landing() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [billing, setBilling] = useState("yearly");

  useEffect(() => {
    fetchPlans()
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans(FALLBACK_PLANS));
  }, []);

  return (
    <>
      <div className="site-bg" />
      <Nav />
      <section className="hero">
        <div>
          <div className="kicker">Official harness for GLM-5.3</div>
          <h1 className="display">
            Simple, fast,
            <br />
            agent‑ready.
          </h1>
          <p className="lede">
            Corex Code by Core AI pairs frontier GLM models with a workspace that can plan,
            write, review, and preview — without an account.
          </p>
          <div className="cta-row">
            <Link className="btn btn-mint" to="/workspace">
              Open workspace
            </Link>
            <Link className="btn btn-line" to="/plans">
              View Corex plans
            </Link>
          </div>
          <div className="meta-row">
            <span>No login</span>
            <span>Secure checkout</span>
            <span>GLM-5.3 · Turbo · 4.7</span>
          </div>
        </div>
        <div className="hero-frame">
          <div className="bar">
            <span className="dot r" />
            <span className="dot y" />
            <span className="dot g" />
            <span style={{ marginLeft: 8 }}>corex · gomoku-ai</span>
          </div>
          <div className="hero-body">
            <div className="hero-side">
              <div className="on">Tasks</div>
              <div>gomoku-ai</div>
              <div>notes-api</div>
              <div>corex-site</div>
            </div>
            <div className="hero-chat">
              <p style={{ color: "var(--mint)", marginTop: 0 }}>Goal · 3m 1s</p>
              <p>
                I’m inspecting the workspace, then I’ll implement a 15×15 Gomoku board with
                heuristic AI and win detection.
              </p>
              <div>
                <span className="chip">Wrote index.html</span>
                <span className="chip">Wrote app.js</span>
                <span className="chip">Wrote styles.css</span>
              </div>
              <p style={{ color: "var(--faint)" }}>GLM-5.3 · Max effort · Preview ready</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="models">
        <h2>Stay on the frontier</h2>
        <p className="sub">
          Corex is tuned for z.ai’s latest GLM coding stack — long-horizon Goals, multi-file
          edits, and a live preview loop.
        </p>
        <div className="cards">
          <article className="card">
            <h3>GLM-5.3</h3>
            <p>
              Flagship coding model. 1M-context route, thinking effort low / high / max, built
              for multi-step software engineering.
            </p>
          </article>
          <article className="card">
            <h3>GLM-5-Turbo</h3>
            <p>
              Speed-first coding. Same Corex tools, lower latency — ideal for tight iteration
              on UI and scripts.
            </p>
          </article>
          <article className="card">
            <h3>GLM-4.7</h3>
            <p>
              Efficient everyday generation. Keep shipping while Max-tier work runs on 5.3.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>Code with Corex plans</h2>
        <p className="sub">Same shape as Z Code / GLM Coding plans — Lite, Pro, and Max.</p>
        <div className="seg">
          <button className={billing === "monthly" ? "on" : ""} onClick={() => setBilling("monthly")}>
            Monthly
          </button>
          <button className={billing === "yearly" ? "on" : ""} onClick={() => setBilling("yearly")}>
            Yearly −30%
          </button>
        </div>
        <div className="plan-grid">
          {plans.map((p) => (
            <article key={p.id} className={"plan" + (p.popular ? " popular" : "")}>
              {p.popular ? <span className="badge">Popular</span> : null}
              <div className="kicker" style={{ width: "fit-content" }}>
                Corex Coding
              </div>
              <h3>{p.name}</h3>
              <p className="sub">{p.tagline}</p>
              <div className="price">
                ${priceFor(p, billing)}
                {billing === "yearly" ? <s>${p.monthly}</s> : null}
              </div>
              <div style={{ color: "var(--faint)", fontSize: 13 }}>
                / month{billing === "yearly" ? " billed annually" : ""} · {p.usageLabel}
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link className="btn btn-mint" to={`/checkout?plan=${p.id}&billing=${billing}`}>
                Subscribe
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Core AI · Corex Code</span>
        <span>Powered by z.ai GLM models</span>
      </footer>
    </>
  );
}
