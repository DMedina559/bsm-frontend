import { useQueries } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { getPreferenceIdentity } from "./backendIdentity";
import { getBlob } from "../api/transport";
import { BUILT_IN_THEMES, themeStylesheetUrl } from "../utils/theme";
import builtInPreviews from "../utils/themePreviews.json";
import { extractCustomThemePreview } from "../utils/customThemePreview";

export function useThemePreviews(themes, mode) {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const custom = themes.filter((theme) => !BUILT_IN_THEMES.includes(theme));
  const results = useQueries({
    queries: custom.map((theme) => ({
      queryKey: ["theme-css-preview", identity, sessionGeneration, theme],
      enabled: identity !== null,
      queryFn: async ({ signal }) => {
        const blob = await getBlob(themeStylesheetUrl(theme, ""), {
          signal,
          timeout: 10000,
        });
        const css = blob ? await blob.text() : "";
        signal.throwIfAborted();
        return css;
      },
      select: (css) => extractCustomThemePreview(css, theme, mode),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  return Object.fromEntries([
    ...Object.entries(builtInPreviews),
    ...custom.flatMap((theme, index) =>
      results[index].data ? [[theme, results[index].data]] : [],
    ),
  ]);
}
