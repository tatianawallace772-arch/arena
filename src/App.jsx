import { Navigate, Route, Routes } from "react-router-dom";
import Checkout from "./pages/Checkout.jsx";
import Landing from "./pages/Landing.jsx";
import Plans from "./pages/Plans.jsx";
import Success from "./pages/Success.jsx";
import Workspace from "./pages/Workspace.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/success" element={<Success />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
