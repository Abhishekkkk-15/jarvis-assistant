import { createRoot } from "react-dom/client";
import App from "./App";
import "./output.css";
import { setBaseUrl } from "@workspace/api-client-react";

if ((window as any).electronAPI) {
  setBaseUrl('http://localhost:4444');
}

createRoot(document.getElementById("root")!).render(<App />);
