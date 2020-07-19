import * as React from "react";
import styled from "@emotion/styled/macro";
import { animated, useSpring } from "react-spring";
import { useDrag, useGesture } from "react-use-gesture";
import * as Icon from "./feather-icons";
import * as Button from "./button";

const WindowContainer = styled(animated.div)`
  position: absolute;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: white;
  position: absolute;
  z-index: 100;
  user-select: text;
`;

const WindowHeader = styled.div`
  display: flex;
  padding: 8px 12px;
  border-bottom: 1px solid lightgray;
  cursor: grab;
  align-items: center;
  justify-content: flex-end;
`;

const WindowBody = styled(animated.div)`
  height: 400px;
  width: 100%;
  overflow: hidden;
`;

const WindowsResizeHandle = styled.button`
  all: unset;
  position: absolute;
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
  height: 15px;
  width: 15px;
`;

export const DraggableWindow = ({
  headerContent,
  bodyContent,
  onKeyDown,
  onMouseDown,
  close,
  style,
  headerLeftContent = null,
  options = [],
  onDidResize,
}: {
  headerContent: React.ReactNode;
  bodyContent: React.ReactNode;
  onKeyDown: React.ComponentProps<"div">["onKeyDown"];
  onMouseDown: React.ComponentProps<"div">["onMouseDown"];
  close: () => void;
  style?: Pick<React.CSSProperties, "top" | "left" | "right">;
  headerLeftContent?: React.ReactNode;
  options?: {
    title: string;
    onClick: (ev: React.MouseEvent) => void;
    Icon: (p: { height?: number }) => React.ReactElement;
  }[];
  onDidResize?: () => void;
}): JSX.Element => {
  const [props, set] = useSpring(() => ({
    x: 0,
    y: 0,
    width: 500,
    height: window.innerHeight / 2,
  }));

  // In case the component un-mounts before the drag finished we need to remove the use-select-disabled class from body
  const onUnmountRef = React.useRef<() => void>();
  React.useEffect(() => () => onUnmountRef.current?.(), []);

  const bind = useGesture({
    onDrag: ({ offset: [mx, my], memo = [props.x.get(), props.y.get()] }) => {
      set({
        x: mx,
        y: my,
        immediate: true,
      });
      return memo;
    },
    onMouseDown: (ev) => {
      // on desktop we want to disable user-select while dragging
      if (ev.target && ev.target instanceof HTMLElement) {
        ev.target.hasAttribute("data-draggable");
        window.document.body.classList.add("user-select-disabled");
        const onUnmount = () => {
          window.document.body.classList.remove("user-select-disabled");
          window.removeEventListener("mouseup", onUnmount);
        };
        window.addEventListener("mouseup", onUnmount);
        onUnmountRef.current = onUnmount;
      }
    },
  });

  const dimensionDragBind = useDrag(
    ({ movement: [mx, my], down }) => {
      set({
        width: Math.max(mx, 300),
        height: my,
        immediate: true,
      });
      if (down === false) {
        onDidResize?.();
      }
    },
    {
      initial: () => [props.width.get(), props.height.get()],
    }
  );

  return (
    <WindowContainer
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onContextMenu={(ev) => {
        ev.stopPropagation();
      }}
      style={{
        ...style,
        x: props.x,
        y: props.y,
        width: props.width,
      }}
    >
      <WindowHeader {...bind()} data-draggable>
        {headerLeftContent ? (
          <div style={{ flexShrink: 0 }}>{headerLeftContent}</div>
        ) : null}
        <div
          style={{
            fontWeight: "bold",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginLeft: 4,
            marginRight: 4,
            width: "100%",
          }}
        >
          {headerContent}
        </div>
        {options.map(({ title, onClick, Icon }) => (
          <div style={{ marginRight: 4 }} key={title}>
            <Button.Tertiary small iconOnly onClick={onClick} title={title}>
              <Icon height={16} />
            </Button.Tertiary>
          </div>
        ))}
        <div style={{ marginRight: 0 }}>
          <Button.Tertiary small iconOnly onClick={close} title="Close">
            <Icon.XIcon height={16} />
          </Button.Tertiary>
        </div>
      </WindowHeader>
      <WindowBody
        style={{
          height: props.height,
        }}
      >
        {bodyContent}
      </WindowBody>
      <WindowsResizeHandle {...dimensionDragBind()} />
    </WindowContainer>
  );
};
