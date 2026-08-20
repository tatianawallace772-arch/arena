import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Nav from "../components/Nav.jsx";
import { checkout, fetchPlans } from "../lib/api.js";
import { dueNow, FALLBACK_PLANS, priceFor, savePlan } from "../lib/session.js";

function formatCard(v) {
  return v
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planId = params.get("plan") || "pro";
  const billing = params.get("billing") === "monthly" ? "monthly" : "yearly";
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
    country: "United States",
    postal: "",
  });

  useEffect(() => {
    fetchPlans()
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans(FALLBACK_PLANS));
  }, []);

  const plan = useMemo(
    () => plans.find((p) => p.id === planId) || plans[1] || plans[0],
    [plans, planId]
  );
  const amount = plan ? dueNow(plan, billing) : 0;
  const monthly = plan ? priceFor(plan, billing) : 0;

  function set(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!plan) return;
    setErr("");
    setBusy(true);
    try {
      const order = await checkout({
        planId: plan.id,
        billing,
        ...form,
        cardNumber: form.cardNumber.replace(/\s/g, ""),
      });
      savePlan(order);
      navigate("/success", { state: { order } });
    } catch (ex) {
      setErr(ex.message || "Payment was declined.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="site-bg" />
      <Nav />
      <div className="checkout">
        <form className="box" onSubmit={onSubmit}>
          <div className="secure">
            <span className="lock" />
            Encrypted checkout · TLS 1.3 · AES-256
          </div>
          <h2>Pay with card</h2>
          <p className="sub">Core Pay never stores the full pan. No account required.</p>

          <label className="field">
            Name on card
            <input
              autoComplete="cc-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </label>
          <label className="field">
            Receipt email
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </label>
          <label className="field">
            Card number
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="ACCT-000003"
              value={form.cardNumber}
              onChange={(e) => set("cardNumber", formatCard(e.target.value))}
              required
            />
          </label>
          <div className="row2">
            <label className="field">
              Expiry
              <input
                placeholder="MM / YY"
                autoComplete="cc-exp"
                value={
                  form.expMonth
                    ? `${form.expMonth}${form.expYear ? " / " + form.expYear : ""}`
                    : ""
                }
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setForm((s) => ({
                    ...s,
                    expMonth: d.slice(0, 2),
                    expYear: d.slice(2, 4),
                  }));
                }}
                required
              />
            </label>
            <label className="field">
              CVC
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
                value={form.cvc}
                onChange={(e) => set("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
              />
            </label>
          </div>
          <div className="row2">
            <label className="field">
              Country
              <select value={form.country} onChange={(e) => set("country", e.target.value)}>
                {["United States", "United Kingdom", "Canada", "Germany", "Singapore", "Japan"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  )
                )}
              </select>
            </label>
            <label className="field">
              Postal code
              <input
                autoComplete="postal-code"
                value={form.postal}
                onChange={(e) => set("postal", e.target.value)}
                required
              />
            </label>
          </div>
          {err ? <div className="err">{err}</div> : null}
          <button className="btn btn-mint" style={{ marginTop: 18, width: "100%" }} disabled={busy}>
            {busy ? (
              <>
                <span className="spin" /> Authorizing…
              </>
            ) : (
              <>
                <span className="lock" style={{ borderColor: "#062018" }} />
                Pay ${amount} {billing === "yearly" ? "today" : "now"}
              </>
            )}
          </button>
          <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 12 }}>
            By paying you agree to Corex Code terms. Charges appear as CORE AI / COREX CODE.
            Use a Luhn-valid test card such as 4242 4242 4242 4242.
          </p>
        </form>

        <aside className="box">
          <h2>Order</h2>
          {!plan ? (
            <p className="sub">Loading plan…</p>
          ) : (
            <>
              <div className="order-line">
                <span>Corex {plan.name}</span>
                <span>${amount}</span>
              </div>
              <div className="order-line">
                <span>Billing</span>
                <span>{billing}</span>
              </div>
              <div className="order-line">
                <span>Credits</span>
                <span>{plan.usageLabel}</span>
              </div>
              <div className="order-line">
                <span>Models</span>
                <span>GLM-5.3 / Turbo / 4.7</span>
              </div>
              <div className="total">
                <span>Due now</span>
                <span>${amount}</span>
              </div>
              <p className="sub" style={{ marginTop: 16 }}>
                {plan.tagline}
              </p>
              <Link to="/plans" style={{ color: "var(--mint)", fontSize: 13 }}>
                Change plan
              </Link>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
