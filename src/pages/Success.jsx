import { Link, useLocation } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import { loadPlan } from "../lib/session.js";

export default function Success() {
  const loc = useLocation();
  const order = loc.state?.order || loadPlan();

  return (
    <>
      <div className="site-bg" />
      <Nav />
      <div className="success">
        <div className="kicker">Payment confirmed</div>
        <h1>You’re on Corex {order?.planName || "Code"}</h1>
        <p className="lede" style={{ margin: "0 auto" }}>
          Order {order?.id || "CX-LOCAL"} charged to {order?.brand || "card"} ••••{" "}
          {order?.last4 || "4242"}. Receipt sent to {order?.email || "your inbox"}.
        </p>
        <div className="cta-row" style={{ justifyContent: "center" }}>
          <Link className="btn btn-mint" to="/workspace">
            Start generating
          </Link>
          <Link className="btn btn-line" to="/plans">
            View plans
          </Link>
        </div>
      </div>
    </>
  );
}
