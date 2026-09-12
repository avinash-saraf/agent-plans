import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { isDemo, slugFromPath } from "./slug.ts";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App slug={slugFromPath(window.location.pathname)} demo={isDemo(window.location.search)} />
  </StrictMode>,
);
