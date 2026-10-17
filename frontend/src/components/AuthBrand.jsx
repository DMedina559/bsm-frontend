import React from "react";
import { resolveAppAssetUrl } from "../utils/basePath";
export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <div>
        <strong>Bedrock Server Manager</strong>
      </div>
      <img
        src={resolveAppAssetUrl("image/icon/web-app-manifest-512x512.png")}
        alt="Bedrock Server Manager"
      />
    </div>
  );
}
