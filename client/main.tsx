import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

// Ensure we only create root once
let root = (window as any).__reactRoot;
if (!root) {
  root = createRoot(rootElement);
  (window as any).__reactRoot = root;
}

root.render(<App />);

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept("./App", () => {
    // Re-render when App changes during HMR
    import("./App").then((module) => {
      root.render(<module.default />);
    });
  });
}
