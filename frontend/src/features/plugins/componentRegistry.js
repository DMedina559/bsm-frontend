import { layoutComponents } from "./components/layout";
import { formsComponents } from "./components/forms";
import { chartsComponents } from "./components/charts";
import { displayComponents } from "./components/display";
import { PluginIcon } from "./components/icons";
export const ComponentRegistry = {
  ...layoutComponents,
  ...formsComponents,
  ...chartsComponents,
  ...displayComponents,
  Icon: PluginIcon,
};
