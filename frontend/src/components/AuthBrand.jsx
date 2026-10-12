import React from "react";
import { getApiProxyBasePath } from "../utils/basePath";
export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <img
        src={`${getApiProxyBasePath()}/app/image/icon/web-app-manifest-512x512.png`}
        alt="Bedrock Server Manager"
      />
      <div>
        <strong>Bedrock Server Manager</strong>
      </div>
    </div>
  );
}
