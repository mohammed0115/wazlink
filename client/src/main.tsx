/** نقطة دخول «wazlink» — React 19 فوق نفس طبقة النطاق والأنماط المعتمدة في V1. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index";

const container = document.getElementById("app");
if (!container) throw new Error('لم يُعثر على عنصر التطبيق "#app" في index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
