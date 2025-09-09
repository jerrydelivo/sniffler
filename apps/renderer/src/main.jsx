import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize React App
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
