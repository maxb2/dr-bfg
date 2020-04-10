import React, { useMemo } from "react";
import { useUniqueId } from "./use-unique-id";

// hook that returns a tuple with two jsx nodes
// the first node is the pattern definition which must be located inside the <defs></defs> section of an svg
// the second node is a rect which uses the pattern definition. It must be placed inside the svg element.
export const useSvgGrid = (grid, dimensions, showGrid, gridColor) => {
  const { width, height, ratio = 1 } = dimensions || {};
  const id = useUniqueId();
  const patternDefinition = useMemo(() => {
    // in case there is no grid we don't need the type definitions.
    if (
      !grid ||
      !grid.sideLength ||
      typeof grid.x !== "number" ||
      typeof grid.y !== "number" ||
      !showGrid
    ) {
      return null;
    }
    return (
      <pattern
        id={id}
        width={grid.sideLength * ratio}
        height={grid.sideLength * ratio}
        patternUnits="userSpaceOnUse"
        x={grid.x * ratio}
        y={grid.y * ratio}
      >
        <path
          d={`M ${grid.sideLength * ratio} 0 L 0 0 0 ${
            grid.sideLength * ratio
          }`}
          fill="none"
          stroke={gridColor}
          strokeWidth="2"
        />
      </pattern>
    );
  }, [id, grid, ratio, showGrid, gridColor]);

  const gridRect = useMemo(() => {
    // in case there is no grid we don't need to show a grid.
    if (!grid || !showGrid) return null;
    return (
      <rect width={width} height={height} fill={`url(#${id})`} x={0} y={0} />
    );
  }, [id, grid, width, height, showGrid]);

  return [patternDefinition, gridRect];
};
