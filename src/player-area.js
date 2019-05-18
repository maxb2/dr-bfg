import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { PanZoom } from "react-easy-panzoom";
import Referentiel from "referentiel";
import { loadImage, useLongPress, getOptimalDimensions } from "./util";

/**
 * creates a function that takes the value t which is a number between 0 and 1
 * and maps those to a sin curve in order to produce values resembling a pulsating effect
 * @param {number} duration total duration of the effect in seconds
 * @param {number} interval interval of one pulse animate t from 0 -> 1 -> 0
 * @returns {function(number): number} pulsateFunction
 */
const createPulsateFunction = (duration = 10000, interval = 2000) => {
  const step = duration / interval;
  const modificator = step * 2 * Math.PI;
  return t => 0.5 * Math.sin(t * modificator - Math.PI / 2) + 0.5;
};

const createAnimation = ({ animate, duration, onFinish }) => {
  let id = null;
  let _start = 0;

  const cancel = () => {
    if (id !== null) {
      cancelAnimationFrame(id);
      return;
    }
  };

  const _animate = () => {
    if (id) {
      const t = Math.max(0, Math.min((Date.now() - _start) / duration, 1));
      animate(t);
      if (t >= 1) {
        if (onFinish) {
          onFinish();
        }
        return;
      }
    }
    id = requestAnimationFrame(_animate);
  };

  const start = () => {
    _start = Date.now();
    _animate();
  };

  return { cancel, start };
};

const MarkedArea = React.memo(({ x, y, onFinishAnimation }) => {
  const circleRef = useRef(null);
  const onFinishAnimationRef = useRef(onFinishAnimation);

  useEffect(() => {
    onFinishAnimationRef.current = onFinishAnimation;
  }, [onFinishAnimation]);

  useEffect(() => {
    const duration = 10500;
    const createValue = createPulsateFunction(duration, 10500 / 10);

    const animation = createAnimation({
      animate: t => {
        circleRef.current.setAttribute("r", 15 + 10 * createValue(t));
        if (t >= 0.9) {
          circleRef.current.setAttribute("opacity", 1 - (t - 0.9) / 0.1);
        }
      },
      duration,
      onFinish: () => {
        onFinishAnimationRef.current();
      }
    });

    animation.start();

    return () => {
      animation.cancel();
    };
  }, []);

  return (
    <circle
      cx={x}
      cy={y}
      r="15"
      strokeWidth="5"
      stroke="red"
      fill="transparent"
      opacity="1"
      ref={circleRef}
    />
  );
});

export const PlayerArea = () => {
  const panZoomRef = useRef(null);
  const currentMapId = useRef(null);
  const socketRef = useRef(null);
  const [showSplashScreen, setShowSplashScreen] = useState(true);

  /**
   * used for canceling pending requests in case there is a new update incoming.
   * should be either null or an array of tasks returned by loadImage
   */
  const pendingImageLoads = useRef(null);

  const mapContainerRef = useRef(null);
  const mapCanvasRef = useRef(null);
  const objectSvgRef = useRef(null);
  const mapCanvasDimensions = useRef(null);
  /**
   * reference to the image object of the currently loaded map
   */
  const mapImageRef = useRef(null);

  const [markedAreas, setMarkedAreas] = useState(() => []);

  const centerMap = (isInitial = false) => {
    if (panZoomRef.current) {
      // hacky approach for centering the map initially
      // (there is no API for react-native-panzoom to do the autofocus without a transition)
      if (isInitial) {
        const transition = panZoomRef.current.dragContainer.style.transition;
        panZoomRef.current.dragContainer.style.transition = "none";
        setTimeout(() => {
          panZoomRef.current.dragContainer.style.transition = transition;
        }, 500);
      }
      panZoomRef.current.autoCenter(0.8);
    }
  };

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", function() {
      console.log("connected to server");
    });

    socket.on("reconnecting", function() {
      console.log("reconnecting to server");
    });

    socket.on("reconnect", function() {
      console.log("reconnected to server");
    });

    socket.on("reconnect_failed", function() {
      console.log("reconnect failed!");
    });

    socket.on("disconnect", function() {
      console.log("disconnected from server");
    });

    socket.on("mark area", async data => {
      setMarkedAreas(markedAreas => [
        ...markedAreas,
        {
          id: data.id,
          x: data.x * mapCanvasDimensions.current.ratio,
          y: data.y * mapCanvasDimensions.current.ratio
        }
      ]);
    });

    socket.on("map update", async data => {
      if (!data) {
        return;
      }

      const context = mapCanvasRef.current.getContext("2d");

      if (pendingImageLoads.current) {
        pendingImageLoads.current.forEach(task => {
          task.cancel();
        });
        pendingImageLoads.current = null;
      }

      /**
       * Hide map (show splashscreen)
       */
      if (!data.mapId) {
        currentMapId.current = null;
        mapCanvasDimensions.current = null;
        mapImageRef.current = null;

        context.clearRect(
          0,
          0,
          mapCanvasRef.current.width,
          mapCanvasRef.current.height
        );
        setShowSplashScreen(true);
        return;
      }

      /**
       * Fog has updated
       */
      if (currentMapId.current === data.mapId) {
        const task = loadImage(data.image);
        pendingImageLoads.current = [task];

        task.promise
          .then(fogImage => {
            pendingImageLoads.current = null;

            context.clearRect(
              0,
              0,
              mapCanvasRef.current.width,
              mapCanvasRef.current.height
            );
            context.drawImage(
              mapImageRef.current,
              0,
              0,
              mapCanvasRef.current.width,
              mapCanvasRef.current.height
            );
            context.drawImage(
              fogImage,
              0,
              0,
              mapCanvasRef.current.width,
              mapCanvasRef.current.height
            );
          })
          .catch(err => {
            // @TODO: distinguish between network error (rertry?) and cancel error
            console.error(err);
          });
        return;
      }

      /**
       * Load new map
       */
      currentMapId.current = data.mapId;
      const tasks = [
        loadImage(`/map/${data.mapId}/map`),
        loadImage(`/map/${data.mapId}/fog`)
      ];
      pendingImageLoads.current = tasks;

      Promise.all(tasks.map(task => task.promise))
        .then(([map, fog]) => {
          pendingImageLoads.current = null;

          mapImageRef.current = map;
          const mapCanvas = mapCanvasRef.current;
          const objectSvg = objectSvgRef.current;
          const mapContainer = mapContainerRef.current;

          const mapContext = mapCanvas.getContext("2d");

          const dimensions = getOptimalDimensions(
            map.width,
            map.height,
            window.innerWidth,
            window.innerHeight
          );

          const cavasDimensions = getOptimalDimensions(
            map.width,
            map.height,
            3000,
            9000
          );

          mapCanvas.width = cavasDimensions.width;
          mapCanvas.height = cavasDimensions.height;
          objectSvg.setAttribute("width", cavasDimensions.width);
          objectSvg.setAttribute("height", cavasDimensions.height);

          mapCanvasDimensions.current = dimensions;

          const widthPx = `${dimensions.width}px`;
          const heightPx = `${dimensions.height}px`;
          mapCanvas.style.width = mapContainer.style.width = objectSvg.style.width = widthPx;
          mapCanvas.style.height = mapContainer.style.height = objectSvg.style.height = heightPx;

          mapContext.drawImage(
            map,
            0,
            0,
            cavasDimensions.width,
            cavasDimensions.height
          );
          mapContext.drawImage(
            fog,
            0,
            0,
            cavasDimensions.width,
            cavasDimensions.height
          );

          centerMap(true);
          setShowSplashScreen(false);
        })
        .catch(err => {
          // @TODO: distinguish between network error (rertry?) and cancel error
          console.error(err);
        });
    });

    const contextmenuListener = ev => {
      ev.preventDefault();
    };
    window.addEventListener("contextmenu", contextmenuListener);

    return () => {
      window.removeEventListener("contextmenu", contextmenuListener);

      if (pendingImageLoads.current) {
        pendingImageLoads.current.forEach(task => {
          task.cancel();
        });
        pendingImageLoads.current = null;
      }

      socket.close();
    };
  }, []);

  /**
   * long press event for setting a map marker
   */
  useLongPress(ev => {
    if (!mapCanvasDimensions.current) {
      return;
    }

    let input = null;
    // ev can be a touch or click event
    if (ev.touches) {
      input = [ev.touches[0].pageX, ev.touches[0].pageY];
    } else {
      input = [ev.pageX, ev.pageY];
    }

    // calculate coordinates relative to the canvas
    const ref = new Referentiel(panZoomRef.current.dragContainer);
    const [x, y] = ref.global_to_local(input);
    const { ratio } = mapCanvasDimensions.current;

    socketRef.current.emit("mark area", { x: x / ratio, y: y / ratio });
  }, 500);

  return (
    <>
      {showSplashScreen ? (
        <div id="splash" className="splash splash-js">
          <a id="dm-link" href="/dm">
            Dungeon Master ↝
          </a>
          <h1 className="title-text">Dungeon Revealer</h1>
        </div>
      ) : null}
      <PanZoom
        style={{
          cursor: "grab",
          background: "black",
          height: "100vh",
          width: "100vw"
        }}
        ref={panZoomRef}
      >
        <div ref={mapContainerRef}>
          <canvas
            ref={mapCanvasRef}
            style={{
              pointerEvents: "none",
              backfaceVisibility: "hidden",
              position: "absolute"
            }}
          />
          <svg
            ref={objectSvgRef}
            style={{
              pointerEvents: "none",
              backfaceVisibility: "hidden",
              position: "absolute",
              overflow: "visible"
            }}
          >
            {markedAreas.map(markedArea => (
              <MarkedArea
                {...markedArea}
                onFinishAnimation={() => {
                  setMarkedAreas(markedAreas =>
                    markedAreas.filter(area => area.id !== markedArea.id)
                  );
                }}
                key={markedArea.id}
              />
            ))}
          </svg>
        </div>
      </PanZoom>
      {!showSplashScreen ? (
        <div id="dm-toolbar" className="toolbar-wrapper">
          <div className="btn-toolbar">
            <div className="btn-group">
              <button
                className="btn btn-default"
                onClick={() => {
                  centerMap();
                }}
              >
                Center
              </button>
              <button
                className="btn btn-default"
                onClick={() => {
                  if (!panZoomRef.current) {
                    return;
                  }
                  panZoomRef.current.zoomIn();
                }}
              >
                Zoom in
              </button>
              <button
                className="btn btn-default"
                onClick={() => {
                  if (!panZoomRef.current) {
                    return;
                  }
                  panZoomRef.current.zoomOut();
                }}
              >
                Zoom out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
