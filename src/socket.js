import io from "socket.io-client";
import { useRef, useEffect } from "react";
import { getPublicUrl } from "./public-url";

// hook that creates a websocket instance once
// websocket instance is destroyed upon component unmounting
export const useSocket = () => {
  const ref = useRef(null);
  if (!ref.current) {
    const url = new URL(getPublicUrl());
    ref.current = io(`${url.protocol}//${url.host}`, {
      path: `${url.pathname}/socket.io`,
    });
  }

  useEffect(
    () => () => {
      if (ref.current) ref.current.close();
    },
    []
  );
  return ref.current;
};
