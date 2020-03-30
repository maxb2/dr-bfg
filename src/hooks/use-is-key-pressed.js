import { useState, useRef, useEffect } from "react";

export const useIsKeyPressed = (key) => {
  const [isPressed, setIsPressed] = useState(false);
  const keyRef = useRef(key);

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === keyRef.current) setIsPressed(true);
    };
    const onKeyUp = (ev) => {
      if (ev.key === keyRef.current) setIsPressed(false);
    };
    const onBlur = () => {
      setIsPressed(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return isPressed;
};
