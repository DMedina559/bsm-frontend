import React from "react";
import { getApiProxyBasePath } from "../utils/basePath";
export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <div>
        <strong>Bedrock Server Manager</strong>
      </div>
      <img
        src={`${getApiProxyBasePath()}/app/image/icon/web-app-manifest-512x512.png`}
        alt="Bedrock Server Manager"
      />
    </div>
  );
}
