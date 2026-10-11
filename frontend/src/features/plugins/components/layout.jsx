import Modal from "../../../components/Modal";
import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import DraggableList from "../../../components/DraggableList";
import { PluginIcon } from "./icons";
export const layoutComponents = {
  Container: ({ children, className = "" }) => (
    <div className={`container ${className}`}>{children}</div>
  ),
  Card: ({ title, children, className = "" }) => (
    <div className={`server-card ${className}`}>
      {title && (
        <div className="server-card-header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="server-card-body">{children}</div>
    </div>
  ),
  Row: ({ children, gap = "10px", className = "" }) => (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  ),
  Column: ({ children, gap = "10px", className = "", flex = 1 }) => (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        flex,
      }}
    >
      {children}
    </div>
  ),
  Divider: ({ className = "" }) => <hr className={`divider ${className}`} />,
  Accordion: ({ title, children, defaultOpen = false, className = "" }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className={`accordion ${className}`}>
        <button
          type="button"
          className="accordion-header"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          {title}
          <PluginIcon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} />
        </button>
        {isOpen && <div className="accordion-body">{children}</div>}
      </div>
    );
  },
  Modal: ({ isOpen, onClose, title, children, className = "" }) => (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className={className}
    >
      {children}
    </Modal>
  ),
  Tabs: ({ children, activeTab, onTabChange, className = "" }) => {
    const [localActive, setLocalActive] = useState(activeTab || 0);

    // If activeTab changes from prop (e.g. schema re-fetch with new default), update state
    useEffect(() => {
      if (activeTab !== undefined) {
        setLocalActive(activeTab);
      }
    }, [activeTab]);

    // If children is not an array, make it one
    const childArray = React.Children.toArray(children);
    const tabHeaders = childArray.map((child, index) => {
      return {
        id: child.props.id || index,
        label: child.props.label || `Tab ${index + 1}`,
      };
    });
    const isControlled = onTabChange !== undefined;
    const currentTabId =
      isControlled && activeTab !== undefined ? activeTab : localActive;
    const handleTabClick = (id) => {
      if (!isControlled) {
        setLocalActive(id);
      }
      if (onTabChange) onTabChange(id);
    };
    return (
      <div className={`tabs-container ${className}`}>
        <div
          className="tabs-header"
          style={{
            display: "flex",
            gap: "calc(10px * var(--bsm-spacing-scale))",
            borderBottom: "1px solid var(--border-color)",
            marginBottom: "calc(15px * var(--bsm-spacing-scale))",
          }}
        >
          {tabHeaders.map((header) => (
            <button
              key={header.id}
              className={`tab-button ${currentTabId === header.id ? "active" : ""}`}
              onClick={() => handleTabClick(header.id)}
              style={{
                padding:
                  "calc(8px * var(--bsm-spacing-scale)) calc(16px * var(--bsm-spacing-scale))",
                background: "transparent",
                border: "none",
                borderBottom:
                  currentTabId === header.id
                    ? "2px solid var(--primary-color, #007bff)"
                    : "2px solid transparent",
                cursor: "pointer",
                fontWeight: currentTabId === header.id ? "bold" : "normal",
                color: "inherit",
              }}
              type="button"
              aria-pressed={currentTabId === header.id}
            >
              {header.label}
            </button>
          ))}
        </div>
        <div className="tabs-content">
          {childArray.map((child) => {
            const childId = child.props.id || childArray.indexOf(child);
            if (childId !== currentTabId) return null;
            return <div key={childId}>{child}</div>;
          })}
        </div>
      </div>
    );
  },
  Tab: ({ children, className = "" }) => (
    <div className={`tab-panel ${className}`}>{children}</div>
  ),
  DraggableList: ({
    items,
    onReorder,
    renderItem,
    className,
    itemClassName,
  }) => (
    <DraggableList
      items={items}
      onReorder={onReorder}
      renderItem={renderItem}
      className={className}
      itemClassName={itemClassName}
    />
  ),
};
