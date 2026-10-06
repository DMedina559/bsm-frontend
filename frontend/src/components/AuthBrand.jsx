import React from "react";
import { getApiProxyBasePath } from "../utils/basePath";
export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <img
        src={`${getApiProxyBasePath()}/app/image/icon/favicon-96x96.png`}
        alt="Bedrock Server Manager"
      />
      <div>
        <strong>Bedrock Server Manager</strong>
        <span>4.0</span>
      </div>
    </div>
  );
}
