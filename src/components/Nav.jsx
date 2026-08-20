import { Link } from "react-router-dom";
import { loadPlan } from "../lib/session.js";

export default function Nav({ solid }) {
  const plan = loadPlan();
  return (
    <header className="nav" style={solid ? { background: "#0c1016" } : undefined}>
      <Link to="/" className="brand">
        <img src="/brand/corex-mark.png" alt="Corex Code" />
        <span>
          Corex Code
          <small>by Core AI</small>
        </span>
      </Link>
      <nav className="nav-links">
        <Link className="hide-sm" to="/#models">
          Models
        </Link>
        <Link to="/plans">Plans</Link>
        <Link className="hide-sm" to="/workspace">
          Workspace
        </Link>
        {plan ? (
          <span className="ghost hide-sm" style={{ color: "var(--mint)" }}>
            {plan.planName} · •••• {plan.last4}
          </span>
        ) : null}
        <Link className="btn btn-mint" to="/workspace">
          Open Corex Code
        </Link>
      </nav>
    </header>
  );
}
