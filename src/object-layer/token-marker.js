import React, { useRef, useEffect } from "react";
import { darken } from "polished";
import { useSpring, animated, interpolate } from "react-spring";

export const TokenMarker = React.memo(
  React.forwardRef(
    (
      {
        x,
        y,
        id,
        radius,
        color,
        label,
        isVisibleForPlayers,
        onClick,
        onMouseDown,
        onContextMenu,
        ratio = 1,
        isAnimated = true,
        ...props
      },
      ref
    ) => {
      const gRef = useRef(null);
      const circleRef = useRef(null);
      const textRef = useRef(null);
      const ratioRef = useRef(ratio);

      const {
        x: animatedX,
        y: animatedY,
        radius: animatedRadius,
        color: animatedColor
      } = useSpring({
        to: { x, y, radius, color },
        immediate: !isAnimated
      });

      useEffect(() => {
        ratioRef.current = ratio;
        if (ref && !ref.current) {
          ref.current = {
            setTransform: (x, y) => {
              gRef.current.setAttribute(
                "transform",
                `translate(${x * ratio}, ${y * ratio})`
              );
            },
            setRadius: radius => {
              circleRef.current.setAttribute("r", radius * ratio);
              circleRef.current.setAttribute(
                "stroke-width",
                radius * ratio * 0.05
              );
              textRef.current.setAttribute("font-size", radius * ratio);
            }
          };
        }
      });

      const realRadius = animatedRadius.interpolate(r => r * ratio);

      return (
        <animated.g
          ref={gRef}
          transform={interpolate(
            [animatedX, animatedY],
            (x, y) => `translate(${x * ratio}, ${y * ratio})`
          )}
          opacity={isVisibleForPlayers ? 1 : 0.7}
          {...props}
        >
          <animated.circle
            ref={circleRef}
            r={realRadius}
            strokeWidth={realRadius.interpolate(val => val * 0.05)}
            stroke={animatedColor.interpolate(value => darken(0.1, value))}
            fill={animatedColor}
            opacity="1"
            onClick={onClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
          />

          <animated.text
            ref={textRef}
            pointerEvents="none"
            textAnchor="middle"
            stroke="black"
            fontSize={realRadius}
            dy=".3em"
          >
            {label}
          </animated.text>
        </animated.g>
      );
    }
  )
);
