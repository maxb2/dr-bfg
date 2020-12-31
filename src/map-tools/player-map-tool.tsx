import * as React from "react";
import { MapTool } from "./map-tool";
import { MarkAreaToolContext } from "./mark-area-map-tool";
import { usePinchWheelZoom } from "./drag-pan-zoom-map-tool";

export const PlayerMapTool: MapTool = {
  id: "player-map-tool",
  Component: (props) => {
    const markAreaContext = React.useContext(MarkAreaToolContext);
    usePinchWheelZoom(props.mapContext);

    const timeoutRef = React.useRef<null | (() => void)>(null);

    props.useMapGesture({
      onPointerUp: () => {
        timeoutRef.current?.();
      },
      onPointerDown: () => {
        const timeout = setTimeout(() => {
          const position = props.mapContext.pointerPosition.get();
          markAreaContext.onMarkArea(
            props.mapContext.helper.coordinates.canvasToImage(
              props.mapContext.helper.coordinates.threeToCanvas([
                position[0],
                position[1],
              ])
            )
          );
        }, 300);
        timeoutRef.current = () => clearTimeout(timeout);
      },
      onDrag: ({ movement, memo, event, tap }) => {
        if (tap) {
          return;
        }
        timeoutRef.current?.();
        event.stopPropagation();
        memo = memo ?? props.mapContext.mapState.position.get();
        props.mapContext.setMapState({
          position: [
            memo[0] + movement[0] / props.mapContext.viewport.factor,
            memo[1] - movement[1] / props.mapContext.viewport.factor,
            0,
          ],
          immediate: true,
        });

        return memo;
      },
    });
    return null;
  },
};
