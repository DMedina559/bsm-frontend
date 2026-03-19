import { render, screen, fireEvent, waitFor } from "../test/utils";
import Playground from "./Playground";
import { vi, describe, it, expect } from "vitest";

// Mock the entire DynamicPage to see what props it gets, to avoid nested fetch loops
vi.mock("../components/DynamicPage", () => {
  return {
    default: ({ schemaJson }) => (
      <div data-testid="mock-dynamic-page">
        {schemaJson && <span>Mock Rendered</span>}
      </div>
    ),
  };
});

describe("Playground", () => {
  it("renders with default json and handles rendering", async () => {
    render(<Playground />);

    // Check title
    expect(screen.getByText("Developer Playground")).toBeInTheDocument();

    // The text area should have the default JSON
    const textarea = screen.getByRole("textbox");
    expect(textarea.value).toContain("Welcome to the Playground");

    // Click render
    const renderButton = screen.getByRole("button", { name: /Render Page/i });
    fireEvent.click(renderButton);

    // Wait for DynamicPage to be rendered
    await waitFor(() => {
      expect(screen.getByTestId("mock-dynamic-page")).toBeInTheDocument();
      expect(screen.getByText("Mock Rendered")).toBeInTheDocument();
    });
  });

  it("shows error toast on invalid json", async () => {
    render(<Playground />);

    const textarea = screen.getByRole("textbox");

    // Type invalid JSON
    fireEvent.change(textarea, { target: { value: "{ invalid json" } });

    // Click render
    const renderButton = screen.getByRole("button", { name: /Render Page/i });
    fireEvent.click(renderButton);

    // ToastProvider would normally show it.
    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON or Object:/i)).toBeInTheDocument();
    });
  });

  it("handles python-like dictionaries successfully", async () => {
    render(<Playground />);

    const textarea = screen.getByRole("textbox");

    // Type python dict
    const pythonDict = `
    {
      'type': 'Card',
      'props': { 'title': 'Python Style', 'active': True },
      'children': [
        { 'type': 'Text', 'props': { 'visible': False, 'empty': None } }
      ]
    }
    `;
    fireEvent.change(textarea, { target: { value: pythonDict } });

    // Click render
    const renderButton = screen.getByRole("button", { name: /Render Page/i });
    fireEvent.click(renderButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Schema \(Python\/JS format\) rendered successfully/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId("mock-dynamic-page")).toBeInTheDocument();
    });
  });

  it("prevents arbitrary code execution (XSS)", async () => {
    render(<Playground />);

    const textarea = screen.getByRole("textbox");

    // Attempt to execute code by using an immediately invoked function expression (IIFE)
    // or injecting malicious code. In a vulnerable 'new Function' scenario, this could execute.
    const maliciousPayload = `
    {
      "type": "Card",
      "props": {
        "title": (function() { throw new Error("XSS Executed"); return "Exploit"; })()
      }
    }
    `;
    fireEvent.change(textarea, { target: { value: maliciousPayload } });

    // Click render
    const renderButton = screen.getByRole("button", { name: /Render Page/i });
    fireEvent.click(renderButton);

    // If json5 is used, it should throw a parsing error instead of executing the function
    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON or Object:/i)).toBeInTheDocument();
    });
  });
});
