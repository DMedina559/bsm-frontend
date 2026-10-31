import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Save, User, Settings2 } from "lucide-react";
import { useSensitiveMutation } from "../app/publicRequests";
import { callOperation } from "../api/operations";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import AccountSecurity from "../components/access/AccountSecurity";
import IntegrationTokens from "../components/access/IntegrationTokens";
import "../styles/access.css";
import "../styles/frontend-settings.css";
export default function Account() {
  const { user, sessionGeneration } = useAuth();
  const { addToast } = useToast();
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState(null);
  const passwordWrite = useSensitiveMutation(
    "account-password",
    (passwords, { session }) =>
      callOperation("change_password", { body: passwords, session }),
  );
  const passwordSaving = passwordWrite.isPending;
  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwordSaving) return;
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordError(null);
    try {
      await passwordWrite.mutateAsync({
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
      });
      addToast("Password updated successfully.", "success");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordError(error.message || "Failed to update password.");
    }
  };
  const fields = [
    [
      "currentPassword",
      "current-password",
      "Current Password",
      "current-password",
    ],
    ["newPassword", "new-password", "New Password", "new-password"],
    [
      "confirmPassword",
      "confirm-password",
      "Confirm New Password",
      "new-password",
    ],
  ];
  const passwordPanel = (
    <section className="settings-panel">
      <div className="section-heading">
        <Save size={20} />
        <div>
          <h2>Change Password</h2>
          <p>
            Use a unique passphrase of at least 15 characters. Spaces are
            welcome.
          </p>
        </div>
      </div>
      <form
        onSubmit={handlePasswordChange}
        className="password-form"
        aria-busy={passwordSaving}
      >
        <input
          className="form-input"
          type="text"
          name="username"
          value={user?.username || ""}
          autoComplete="username"
          hidden
          readOnly
        />
        {fields.map(([key, id, label, autoComplete]) => (
          <div className="form-group" key={key}>
            <label className="form-label" htmlFor={id}>
              {label}
            </label>
            <input
              className="form-input"
              id={id}
              name={id}
              type="password"
              minLength={key === "currentPassword" ? 1 : 15}
              maxLength={1024}
              value={passwords[key]}
              onChange={(event) =>
                setPasswords({
                  ...passwords,
                  [key]: event.target.value,
                })
              }
              required
              autoComplete={autoComplete}
              disabled={passwordSaving}
              aria-invalid={
                key === "confirmPassword" && passwordError ? true : undefined
              }
              aria-describedby={passwordError ? "password-error" : undefined}
            />
          </div>
        ))}
        {passwordError && (
          <p className="validation-error" role="alert" id="password-error">
            {passwordError}
          </p>
        )}
        <div className="form-actions">
          <button
            type="submit"
            className="action-button primary-button"
            disabled={passwordSaving}
          >
            <Save size={16} />
            {passwordSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </section>
  );
  return (
    <div className="container account-page">
      <header className="account-heading">
        <div>
          <p className="workspace-eyebrow">YOUR ACCOUNT</p>
          <h1>My Account</h1>
          <p className="form-help-text">
            Manage your profile, sign-ins, and account security.
          </p>
        </div>
        <Link className="action-button secondary" to="/frontend-settings">
          <Settings2 size={16} />
          Frontend settings
        </Link>
      </header>
      <section className="account-identity" aria-label="Profile">
        <User size={22} aria-hidden="true" />
        <dl className="profile-details">
          <div>
            <dt>Username</dt>
            <dd>{user?.username}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              <span className="badge">{user?.role}</span>
            </dd>
          </div>
        </dl>
      </section>
      {user?.permissions?.includes("sessions:manage") ? (
        <AccountSecurity key={`${user.id}:${sessionGeneration}`}>
          {passwordPanel}
        </AccountSecurity>
      ) : (
        <>
          {user?.permissions?.includes("tokens:manage") && (
            <IntegrationTokens key={`${user.id}:${sessionGeneration}`} />
          )}
          {(!Array.isArray(user?.permissions) ||
            user.permissions.includes("account:manage")) &&
            passwordPanel}
        </>
      )}
    </div>
  );
}
