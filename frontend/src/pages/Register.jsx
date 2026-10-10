import { callOperation } from "../api/operations";
import AuthBrand from "../components/AuthBrand";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../ToastContext";

const Register = () => {
  const { token } = useParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);
  const { addToast } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    const validateToken = async () => {
      if (!token) return;
      try {
        await callOperation("validate_registration_token", {
          path: { token: token },
        });
        setTokenValid(true);
      } catch {
        setTokenValid(false);
      }
    };
    validateToken();
  }, [token]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!username || !password || !confirmPassword) {
      addToast("All fields are required", "error");
      return;
    }
    if (password !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }
    if (!token || !tokenValid) {
      addToast("Invalid registration link.", "error");
      return;
    }
    setLoading(true);
    try {
      await callOperation("register_user", {
        path: { token: token },
        body: {
          username,
          password,
        },
      });
      addToast("Registration successful! Please login.", "success");
      navigate("/login");
    } catch (error) {
      addToast(error.message || "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };
  if (!token) {
    return (
      <div
        className="container auth-page"
        style={{
          marginTop: "100px",
          textAlign: "center",
        }}
      >
        <div className="message-box message-error" role="alert">
          Invalid registration link. Token is missing.
        </div>
      </div>
    );
  }
  if (tokenValid === false) {
    return (
      <div
        className="container auth-page"
        style={{
          marginTop: "100px",
          textAlign: "center",
        }}
      >
        <div className="message-box message-error" role="alert">
          Invalid or expired registration link.
        </div>
      </div>
    );
  }
  if (tokenValid === null) {
    return (
      <div
        className="container auth-page"
        style={{
          marginTop: "100px",
          textAlign: "center",
        }}
      >
        <div
          className="spinner"
          style={{
            display: "inline-block",
            marginRight: "10px",
          }}
        ></div>{" "}
        Checking registration link...
      </div>
    );
  }
  return (
    <div
      className="container auth-page"
      style={{
        maxWidth: "400px",
        marginTop: "100px",
      }}
    >
      <AuthBrand />
      <div className="header">
        <h1>Register</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-group">
        <div
          style={{
            marginBottom: "15px",
          }}
        >
          <label className="form-label" htmlFor="username">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            disabled={loading}
          />
        </div>

        <div
          style={{
            marginBottom: "15px",
          }}
        >
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <label className="form-label" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="form-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="action-button"
          disabled={loading}
          style={{
            width: "100%",
            justifyContent: "center",
          }}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
};
export default Register;
