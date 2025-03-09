import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { enableSimpleRideMatching } from "./lib/rideMatchingIntegration";

import { TempoDevtools } from "tempo-devtools";
TempoDevtools.init();

// Enable the simplified matching system
enableSimpleRideMatching();

const basename = import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
