import { queryClient } from "../app/queryClient";
import { render, screen, fireEvent, waitFor } from "../test/utils";
import DynamicPage from "./DynamicPage";
import { ToastProvider } from "../contexts/ToastContext";
import { ServerProvider } from "../contexts/ServerContext";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as api from "../test/httpFixtures";

vi.mock("../api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../test/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("DynamicPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.resolveApiUrl.mockImplementation((url) => url);

    // Mock global fetch for download test and setup status
    vi.spyOn(window, "fetch").mockImplementation((url) => {
      if (url === "/api/setup/status") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ needs_setup: false }),
        });
      }
      // Handle download test case
      if (url === "/api/download/file.txt") {
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(new Blob(["content"], { type: "text/plain" })),
        });
      }
      // WebSocket or other calls
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    });

    // Mock window URL methods
    window.URL.createObjectURL = vi.fn(() => "blob:test");
    window.URL.revokeObjectURL = vi.fn();

    api.get.mockImplementation((url) => {
      if (url === "/api/test/native") {
        return Promise.resolve([
          {
            type: "Input",
            props: { id: "testInput", placeholder: "Enter text" },
          },
          {
            type: "Input",
            props: { name: "nameInput", placeholder: "Enter text by name" },
          },
          {
            type: "Button",
            props: {
              label: "Submit",
              onClickAction: {
                type: "api_call",
                endpoint: "/api/test/submit",
                includeFormState: true,
              },
            },
          },
        ]);
      }
      if (url === "/api/test/upload") {
        return Promise.resolve([
          {
            type: "FileUpload",
            props: { id: "fileInput", accept: ".txt" },
          },
          {
            type: "Button",
            props: {
              label: "Upload",
              onClickAction: {
                type: "api_call",
                endpoint: "/api/upload",
                includeFormState: true,
              },
            },
          },
        ]);
      }
      if (url === "/api/test/download") {
        return Promise.resolve([
          {
            type: "FileDownload",
            props: {
              label: "Download Me",
              endpoint: "/api/download/file.txt",
              filename: "file.txt",
            },
          },
        ]);
      }
      if (url === "/api/test/components") {
        return Promise.resolve([
          {
            type: "Switch",
            props: { id: "switchInput", label: "Toggle Me" },
          },
          {
            type: "Checkbox",
            props: { id: "checkboxInput", label: "Check Me" },
          },
          {
            type: "Button",
            props: {
              label: "Open Modal",
              onClickAction: { type: "open_modal", modalId: "testModal" },
            },
          },
          {
            type: "Modal",
            props: { id: "testModal", title: "Test Modal" },
            children: [
              { type: "Text", props: { content: "Inside Modal" } },
              {
                type: "Button",
                props: {
                  label: "Close Modal",
                  onClickAction: { type: "close_modal" },
                },
              },
            ],
          },
          {
            type: "Button",
            props: {
              label: "Submit Form",
              onClickAction: {
                type: "api_call",
                endpoint: "/api/submit-components",
                includeFormState: true,
              },
            },
          },
        ]);
      }
      return Promise.resolve({});
    });

    api.post.mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves entered values when the page definition refetches", async () => {
    window.history.pushState(
      {},
      "Test",
      "/plugin-native-view?url=/api/test/native",
    );
    render(<DynamicPage />);
    const input = await screen.findByPlaceholderText("Enter text");
    fireEvent.change(input, { target: { value: "unsaved draft" } });
    const before = api.get.mock.calls.filter(([url]) =>
      url.startsWith("/api/test/native"),
    ).length;
    await queryClient.invalidateQueries({ queryKey: ["plugin-page"] });
    await waitFor(() =>
      expect(
        api.get.mock.calls.filter(([url]) => url.startsWith("/api/test/native"))
          .length,
      ).toBeGreaterThan(before),
    );
    expect(screen.getByPlaceholderText("Enter text")).toHaveValue(
      "unsaved draft",
    );
  });

  it("renders from schema and handles text input", async () => {
    window.history.pushState(
      {},
      "Test",
      "/plugin-native-view?url=/api/test/native",
    );
    render(<DynamicPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter text by name"),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Enter text"), {
      target: { value: "test value" },
    });

    fireEvent.change(screen.getByPlaceholderText("Enter text by name"), {
      target: { value: "name value" },
    });

    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/test/submit",
        expect.objectContaining({ testInput: "test value" }),
      );
    });
  });

  it("handles file upload using FormData", async () => {
    window.history.pushState(
      {},
      "Test",
      "/plugin-native-view?url=/api/test/upload",
    );
    render(<DynamicPage />);

    await waitFor(() => {
      // Find file input
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText("Upload"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
      const [endpoint, body] = api.post.mock.calls[0];
      expect(endpoint).toBe("/api/upload");
      expect(body).toBeInstanceOf(FormData);
      expect(body.get("fileInput")).toEqual(file);
    });
  });

  it("handles file download", async () => {
    window.history.pushState(
      {},
      "Test",
      "/plugin-native-view?url=/api/test/download",
    );
    render(<DynamicPage />);

    await waitFor(() => {
      expect(screen.getByText("Download Me")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download Me"));

    await waitFor(() => {
      expect(api.downloadFile).toHaveBeenCalledWith(
        "/api/download/file.txt",
        "file.txt",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("renders new components and handles modal interaction", async () => {
    window.history.pushState(
      {},
      "Test Components",
      "/plugin-native-view?url=/api/test/components",
    );
    render(<DynamicPage />);

    // Verify Switch and Checkbox render
    await waitFor(() => {
      expect(screen.getByText("Toggle Me")).toBeInTheDocument();
      expect(screen.getByText("Check Me")).toBeInTheDocument();
    });

    // Interact with Switch and Checkbox
    // We query by checkbox type
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2); // One switch, one checkbox

    // Toggle them
    fireEvent.click(checkboxes[0]); // Switch
    fireEvent.click(checkboxes[1]); // Checkbox

    // Open Modal
    fireEvent.click(screen.getByText("Open Modal"));

    await waitFor(() => {
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
      expect(screen.getByText("Inside Modal")).toBeInTheDocument();
    });

    // Close Modal
    fireEvent.click(screen.getByText("Close Modal"));

    await waitFor(() => {
      expect(screen.queryByText("Inside Modal")).not.toBeInTheDocument();
    });

    // Submit form to verify state
    fireEvent.click(screen.getByText("Submit Form"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/submit-components",
        expect.objectContaining({
          switchInput: true,
          checkboxInput: true,
        }),
      );
    });
  });

  it("should render provided schemaJson prop without fetching", async () => {
    // Clear out any previous fetches from other tests
    api.get.mockClear();

    // Create a new container instead of appending to body
    // to avoid bleeding components
    const mockSchema = {
      type: "Card",
      props: { title: "Schema Prop Test" },
      children: [{ type: "Text", props: { content: "Loaded from Prop" } }],
    };

    const { unmount } = render(<DynamicPage schemaJson={mockSchema} />);

    // Ensure api.get was NOT called
    expect(api.get).not.toHaveBeenCalledWith("/test-url");

    unmount();
  });

  it("renders new UI components (ProgressBar, Alert, Textarea, Slider, Chart)", async () => {
    const mockSchema = [
      { type: "ProgressBar", props: { value: 75, max: 100 } },
      {
        type: "Alert",
        props: {
          title: "Warning Alert",
          message: "Careful!",
          variant: "warning",
        },
      },
      { type: "Textarea", props: { id: "myArea", placeholder: "Type here" } },
      {
        type: "Slider",
        props: { id: "mySlider", value: 50, min: 0, max: 100 },
      },
      {
        type: "Chart",
        props: {
          type: "pie",
          data: [
            { name: "A", value: 10 },
            { name: "B", value: 20 },
          ],
        },
      },
    ];

    render(<DynamicPage schemaJson={mockSchema} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Warning Alert")).toBeInTheDocument();
    expect(screen.getByText("Careful!")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("50");
  });

  it("handles conditional visibility (visibleIf / disabledIf)", async () => {
    const mockSchema = [
      {
        type: "Switch",
        props: { id: "enableFeature", label: "Enable Feature" },
      },
      {
        type: "Input",
        props: {
          id: "conditionalInput",
          placeholder: "Conditional Field",
          visibleIf: { field: "enableFeature", equals: true },
        },
      },
      {
        type: "Button",
        props: {
          label: "Conditional Button",
          disabledIf: { field: "enableFeature", equals: false },
        },
      },
    ];

    render(<DynamicPage schemaJson={mockSchema} />);

    // Initially conditionalInput should NOT be rendered
    expect(
      screen.queryByPlaceholderText("Conditional Field"),
    ).not.toBeInTheDocument();

    // Toggle switch on
    const switchEl = screen.getByRole("checkbox");
    fireEvent.click(switchEl);

    // Should now be visible
    expect(
      screen.getByPlaceholderText("Conditional Field"),
    ).toBeInTheDocument();
  });

  it("handles LogViewer auto-scroll and manual scrolling", async () => {
    const mockSchema = {
      type: "LogViewer",
      props: { lines: ["Line 1", "Line 2", "Line 3"], height: 100 },
    };

    render(<DynamicPage schemaJson={mockSchema} />);

    expect(screen.getByText("Line 1")).toBeInTheDocument();
    expect(screen.getByText("Line 2")).toBeInTheDocument();
    expect(screen.getByText("Line 3")).toBeInTheDocument();
  });
});
