export function getDynamicBasePath() {
  const path = window.location.pathname;
  const routes = [
    "/login",
    "/setup",
    "/register",
    "/monitor",
    "/backups",
    "/server-properties",
    "/server-config",
    "/access-control",
    "/online-players",
    "/bsm-settings",
    "/content",
    "/plugins",
    "/users",
    "/global-players",
    "/audit-log",
    "/account",
    "/server-install",
    "/plugin-native-view",
    "/playground",
  ];

  for (const route of routes) {
    if (path.endsWith(route)) {
      return path.slice(0, path.length - route.length);
    }
    if (path.includes(route + "/")) {
      return path.slice(0, path.indexOf(route + "/"));
    }
  }

  // Default fallback
  if (path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function getApiProxyBasePath() {
  let basePath = getDynamicBasePath();
  if (basePath.endsWith("/app")) {
    basePath = basePath.slice(0, -4);
  } else if (basePath === "/app") {
    basePath = "";
  }
  return basePath;
}
