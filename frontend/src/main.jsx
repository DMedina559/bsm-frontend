import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { getApiProxyBasePath } from "./utils/basePath";

// Dynamically determine the router basename
const baseProxyPath = getApiProxyBasePath();
const routerBasename = baseProxyPath ? `${baseProxyPath}/app` : "/app";

const router = createBrowserRouter([{ path: "*", element: <App /> }], {
  basename: routerBasename,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
