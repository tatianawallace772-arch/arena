import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import { fetchPlans } from "../lib/api.js";
import { FALLBACK_PLANS, priceFor } from "../lib/session.js";

export default function Plans() {
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
      <section className="section">
        <h2>Corex Code plans</h2>
        <p className="sub">
          Individual coding plans modeled on Z Code: Lite for small repos, Pro for daily mid-size
          work, Max for long-horizon agents.
        </p>
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
                Continue to secure checkout
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
