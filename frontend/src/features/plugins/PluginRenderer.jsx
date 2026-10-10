import { ComponentRegistry } from "./componentRegistry";
import {
  ChartWrapper,
  LogViewerWrapper,
  StatCardWrapper,
} from "./StreamComponents";
import { logger } from "../../utils/logger";
export default function PluginRenderer({
  schema,
  selectedServer,
  socketData,
  formState,
  handleAction,
  handleInputChange,
  activeModalId,
  setActiveModalId,
}) {
  const renderNode = (node, key) => {
    if (!node) return null;
    if (typeof node === "string") return node;
    const Component = ComponentRegistry[node.type];
    if (!Component) {
      logger.warn(`[DynamicPage] Unknown component type`, {
        nodeType: node.type,
        node,
      });
      return (
        <div
          key={key}
          style={{
            color: "red",
            border: "1px dashed red",
            padding: "calc(5px * var(--bsm-spacing-scale))",
          }}
        >
          Unknown component: {node.type}
        </div>
      );
    }
    const props = {
      ...node.props,
    };

    // Inject Socket Data if needed
    if (props.socketTopic) {
      const topic = props.socketTopic.replace("{server}", selectedServer || "");
      const latestMsg = socketData[topic];
      props.latestSocketMessage = latestMsg;
    }

    // Wrapper for Chart to handle internal state for history
    if (node.type === "Chart") {
      return <ChartWrapper key={key} {...props} />;
    }

    // Wrapper for LogViewer
    if (node.type === "LogViewer") {
      return <LogViewerWrapper key={key} {...props} />;
    }

    // Wrapper for StatCard
    if (node.type === "StatCard") {
      return <StatCardWrapper key={key} {...props} />;
    }

    // Dynamic evaluation for visibleIf and disabledIf
    const evaluateRule = (rule) => {
      if (!rule) return undefined;
      const { field, equals, notEquals, in: inArray } = rule;
      if (!field) return undefined;
      const fieldValue = formState[field];
      if (equals !== undefined) return fieldValue === equals;
      if (notEquals !== undefined) return fieldValue !== notEquals;
      if (Array.isArray(inArray)) return inArray.includes(fieldValue);
      return !!fieldValue;
    };
    if (props.visibleIf) {
      const isVisible = evaluateRule(props.visibleIf);
      if (isVisible === false) return null;
    }
    if (props.disabledIf) {
      const isDisabled = evaluateRule(props.disabledIf);
      if (isDisabled !== undefined) {
        props.disabled = isDisabled;
      }
    }

    // Handle input binding
    if (
      node.type === "Input" ||
      node.type === "Textarea" ||
      node.type === "Slider" ||
      node.type === "Select" ||
      node.type === "Switch" ||
      node.type === "Checkbox"
    ) {
      const formKey = props.id || props.name;
      if (formKey) {
        const stateValue = formState[formKey];

        // For Switch and Checkbox, value is boolean
        if (node.type === "Switch" || node.type === "Checkbox") {
          props.value =
            stateValue !== undefined
              ? stateValue
              : props.checked || props.defaultChecked || false;
        } else {
          props.value =
            stateValue !== undefined
              ? stateValue
              : props.value || props.defaultValue || "";
        }
        props.onChange = (val) => {
          handleInputChange(formKey, val);
          if (props.onChangeAction) {
            const action = {
              ...props.onChangeAction,
            };

            // If it's a navigation action, we might want to dynamically set a param based on the value
            if (action.type === "navigate" && action.dynamicParam) {
              if (!action.params) action.params = {};
              action.params[action.dynamicParam] = val;
            }
            handleAction(action);
          }
        };
      } else {
        if (node.type === "Input") props.readOnly = true;
      }
    }
    if (node.type === "FileUpload") {
      const formKey = props.id || props.name;
      if (formKey) {
        props.onChange = (file) => handleInputChange(formKey, file);
      }
    }
    if (node.type === "FileDownload") {
      props.onClick = () =>
        handleAction({
          type: "download_file",
          endpoint: props.endpoint,
          filename: props.filename,
        });
    }

    // Modal specific props
    if (node.type === "Modal") {
      props.isOpen = activeModalId === props.id;
      props.onClose = () => setActiveModalId(null);
    }
    if (node.type === "DraggableList") {
      props.onReorder = (newItems) => {
        if (props.onReorderAction) {
          const action = {
            ...props.onReorderAction,
          };
          action.payload = {
            ...action.payload,
            items: newItems,
          };
          handleAction(action);
        }
      };
      props.renderItem = (item, index) => {
        // Expect props.itemTemplate to be a function that takes an item and returns a node
        if (props.itemTemplate && typeof props.itemTemplate === "function") {
          return renderNode(
            props.itemTemplate(item, index),
            `draggable-item-${item.id}`,
          );
        }
        return <div>{item.name || item.id}</div>;
      };
    }

    // Special handling for Table rows to recursively render cells
    if (node.type === "Table" && Array.isArray(props.rows)) {
      props.rows = props.rows.map((row, rIndex) =>
        Array.isArray(row)
          ? row.map((cell, cIndex) => {
              if (cell && typeof cell === "object" && cell.type) {
                // Recursively render the cell if it looks like a component node
                return renderNode(cell, `row-${rIndex}-cell-${cIndex}`);
              }
              return cell;
            })
          : row,
      );
    }

    // Handle actions
    if (props.onClickAction) {
      props.onClick = () => handleAction(props.onClickAction);
      // delete props.onClickAction; // keep it or remove it, doesn't matter much for HTML props unless it leaks
    }
    const children = node.children
      ? node.children.map((child, i) => renderNode(child, i))
      : null;
    return (
      <Component key={key} {...props}>
        {children}
      </Component>
    );
  };

  return Array.isArray(schema)
    ? schema.map((node, i) => renderNode(node, i))
    : renderNode(schema, 0);
}
