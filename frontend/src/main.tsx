import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/surface-enhancements.css";
import "./styles/feedback.css";
import "./styles/auth.css";
import "./styles/modal.css";
import "./styles/chart-enhancements.css";
import "./styles/page-shells.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
