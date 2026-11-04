import React from "react";
import { getScopeCategory } from "../utils/scopeCategory";

/**
 * Color-coordinated badge component for permission scopes, roles, and checks.
 */
export default function ScopeBadge({
  scope,
  as: Component = "li",
  icon: Icon,
  className = "",
  children,
  present,
  ...props
}) {
  const category = getScopeCategory(scope);
  const isMissing = present === false;

  return (
    <Component
      className={`scope-badge scope-badge-${category} ${isMissing ? "ae-capability-missing" : ""} ${className}`.trim()}
      data-scope={scope}
      data-category={category}
      {...props}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      <code>{children ?? scope}</code>
    </Component>
  );
}
