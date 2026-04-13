import React from "react";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <p>
        <a
          href="https://bedrock-server-manager.readthedocs.io/en/latest/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </a>{" "}
        |{" "}
        <a href="/docs" target="_blank" rel="noopener noreferrer">
          HTTP API
        </a>{" "}
        |{" "}
        <a
          href="https://github.com/dmedina559"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
};

export default Footer;
