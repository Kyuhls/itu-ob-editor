import React, { useRef, useCallback } from 'react';
import { useDrag, XYCoord, useDrop, DropTargetMonitor } from 'react-dnd';
import { IconName, Icon } from '@blueprintjs/core';
import styles from './dnd-sortable.scss';


interface DragItem {
  index: number
  type: string
}
interface SortableProps {
  idx: number
  itemType: string
  canReorder?: boolean
  onReorder: (from: number, to: number) => void 
  className?: string
  draggingClassName?: string
  droppableClassName?: string
  handleClassName?: string
  handleIcon?: IconName
}
export const Sortable: React.FC<SortableProps> =
function ({ idx, canReorder, onReorder, className, droppableClassName, draggingClassName, children, itemType, handleClassName, handleIcon }) {
  const reorderable = canReorder !== false;

  const ref = useRef<HTMLDivElement>(null);

  const dragHandle = useCallback(node => {
    if (node !== null && node.querySelector !== undefined) {
      const svg: SVGElement = node.querySelector('svg');
      if (svg) {
        svg.addEventListener('dragover', (e) => { e.preventDefault() });
      }
    }
  }, []);

  const [{ canDrop }, drop] = useDrop({
    accept: itemType,
    collect: (monitor: any) => ({
      canDrop: monitor.canDrop(),
    }),
    hover(item: DragItem, monitor: DropTargetMonitor) {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = idx;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current!.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onReorder(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    item: { type: itemType, idx },
    collect: (monitor: any) => ({
      isDragging: reorderable && monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return <div
      className={`
        ${styles.sortable}
        ${className || ''}
        ${isDragging ? styles.sortableDragged : ''}
        ${(draggingClassName && isDragging) ? draggingClassName : ''}
        ${(canDrop ? styles.sortableOver : '')}
        ${(droppableClassName && canDrop) ? droppableClassName : ''}
      `}
      ref={handleIcon ? preview : ref}>
    {reorderable && handleIcon
      ? <div
            ref={ref}
            className={`${styles.sortableDragHandle} ${handleClassName || ''}`}
            title="Hold and drag to reorder.">
          <div ref={dragHandle}>
            <Icon ref={dragHandle} icon={handleIcon} />
          </div>
        </div>
      : undefined}
    {children}
  </div>;

};


export default Sortable;