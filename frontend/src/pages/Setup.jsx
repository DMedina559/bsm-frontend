import AuthBrand from "../components/AuthBrand";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { request } from "../api";
const Setup = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { checkUser } = useAuth();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await request("/api/setup/create-first-user", {
        method: "POST",
        body: {
          username,
          password,
        },
      });
      // Setup successful
      // Refresh auth state since the backend logs us in
      await checkUser();
      // Redirect to dashboard or login
      navigate("/");
    } catch (error) {
      setError(error.message || "An error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      className="container auth-page"
      style={{
        maxWidth: "500px",
        marginTop: "50px",
      }}
    >
      <AuthBrand />
      <div
        className="header"
        style={{
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h1>Setup Bedrock Server Manager</h1>
        <p>Create your administrator account to get started.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="form-group"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <div>
          <label htmlFor="username" className="form-label">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoComplete="username"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="form-label">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="form-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="message message-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="button button-primary"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
};
export default Setup;
