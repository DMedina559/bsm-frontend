import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

const SortableItem = ({ id, children, itemClassName }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${itemClassName || ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", display: "flex", alignItems: "center" }}
        className="drag-handle"
      >
        <GripVertical size={20} color="#888" />
      </div>
      <div style={{ flex: 1, width: "100%" }}>{children}</div>
    </div>
  );
};

const DraggableList = ({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={`draggable-list ${className || ""}`}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              id={item.id}
              itemClassName={itemClassName}
            >
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DraggableList;
