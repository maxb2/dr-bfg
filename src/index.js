import React from "react";
import { render } from "react-dom";
import "./style.css";

const element = document.querySelector("#root");

//
// hack for disabling pinch zoom in Safari
// Unfortunately, Safari does ignore the following HTML meta tags...
// maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
  window.addEventListener(
    "touchstart",
    (ev) => {
      ev.preventDefault();
    },
    { passive: false }
  );
}

const main = async () => {
  let component = null;
  switch (window.location.pathname) {
    case "/dm": {
      const { DmArea } = await import("./dm-area");
      component = <DmArea />;
      break;
    }
    default: {
      const { PlayerArea } = await import("./player-area");
      component = <PlayerArea />;
    }
  }
  if (element) {
    render(component, element);
  }
};

main();
