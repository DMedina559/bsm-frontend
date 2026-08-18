import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { getApiProxyBasePath } from "./utils/basePath";

// Dynamically determine the router basename
const baseProxyPath = getApiProxyBasePath();
const routerBasename = baseProxyPath ? `${baseProxyPath}/app` : "/app";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
