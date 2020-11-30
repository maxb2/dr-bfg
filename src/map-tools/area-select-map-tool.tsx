import * as React from "react";
import { animated, SpringValue } from "@react-spring/three";
import type { MapTool } from "./map-tool";
import { ThreeLine, ThreeLine2 } from "../three-line";
import { BrushToolContextValue, BrushToolContext } from "./brush-map-tool";
import { applyFogRectangle } from "../canvas-draw-utilities";
import { useFrame } from "react-three-fiber";

const Rectangle = (props: {
  p1: SpringValue<[number, number, number]>;
  p2: SpringValue<[number, number, number]>;
}): React.ReactElement => {
  const getPoints = React.useCallback<
    () => Array<[number, number, number]>
  >(() => {
    const p1 = props.p1.get();
    const p2 = props.p2.get();
    return [p1, [p2[0], p1[1], 0], p2, [p1[0], p2[1], 0], p1];
  }, [props.p1, props.p2]);

  const points = React.useMemo<Array<[number, number, number]>>(getPoints, [
    props.p1,
    props.p2,
  ]);
  const ref = React.useRef<null | ThreeLine2>(null);

  useFrame(() => {
    if (ref.current) {
      const points = getPoints();
      ref.current.geometry.setPositions(points.flat());
    }
  });
  return <ThreeLine points={points} color="red" ref={ref} transparent />;
};

export const AreaSelectMapTool: MapTool<
  {
    lastCursorPosition: null | SpringValue<[number, number, number]>;
    cursorPosition: SpringValue<[number, number, number]>;
  },
  BrushToolContextValue
> = {
  id: "area-select-map-tool",
  Context: BrushToolContext,
  createLocalState: () => ({
    lastCursorPosition: null,
    cursorPosition: new SpringValue<[number, number, number]>({
      to: [0, 0, 0],
    }),
  }),
  Component: (props) => {
    const fadeWidth = 0.05;

    return props.localState.state.lastCursorPosition ? (
      <Rectangle
        p1={props.localState.state.lastCursorPosition}
        p2={props.localState.state.cursorPosition}
      />
    ) : (
      <animated.group position={props.localState.state.cursorPosition}>
        <>
          <ThreeLine
            color="red"
            points={[
              [-fadeWidth, 0, 0],
              [fadeWidth, 0, 0],
            ]}
            transparent
            lineWidth={0.5}
          />
          <ThreeLine
            color="red"
            points={[
              [0, fadeWidth, 0],
              [0, -fadeWidth, 0],
            ]}
            transparent
            lineWidth={0.5}
          />
        </>
      </animated.group>
    );
  },
  onPointerMove: (event, context, localState) => {
    const position = context.mapState.position.get();
    const scale = context.mapState.scale.get();

    localState.state.cursorPosition.set([
      (event.point.x - position[0]) / scale[0],
      (event.point.y - position[1]) / scale[1],
      0,
    ]);
  },
  onPointerDown: (event, context, localState) => {
    const position = context.mapState.position.get();
    const scale = context.mapState.scale.get();

    localState.setState((state) => ({
      ...state,
      lastCursorPosition: new SpringValue({
        from: [
          (event.point.x - position[0]) / scale[0],
          (event.point.y - position[1]) / scale[1],
          0,
        ] as [number, number, number],
      }),
    }));
  },
  onPointerUp: (_, context, localState, contextState) => {
    if (localState.state.lastCursorPosition) {
      const fogCanvasContext = context.fogCanvas.getContext("2d")!;
      const p1 = localState.state.cursorPosition.get();
      const p2 = localState.state.lastCursorPosition.get();

      applyFogRectangle(
        contextState.state.fogMode,
        context.helper.coordinates.threeToCanvas([p1[0], p1[1]]),
        context.helper.coordinates.threeToCanvas([p2[0], p2[1]]),
        fogCanvasContext
      );
      context.fogTexture.needsUpdate = true;
      contextState.handlers.onDrawEnd(context.fogCanvas);
    }

    localState.setState((state) => ({
      ...state,
      lastCursorPosition: null,
    }));
  },
};
