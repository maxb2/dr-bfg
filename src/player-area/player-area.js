import React, { useRef, useState, useEffect, useCallback } from "react";
import produce from "immer";
import createPersistedState from "use-persisted-state";
import { PanZoom } from "../pan-zoom";
import Referentiel from "referentiel";
import useAsyncEffect from "@n1ru4l/use-async-effect";
import { loadImage, getOptimalDimensions } from "../util";
import { useLongPress } from "../hooks/use-long-press";
import { ObjectLayer } from "../object-layer";
import { Toolbar } from "../toolbar";
import styled from "@emotion/styled/macro";
import * as Icons from "../feather-icons";
import { useSocket } from "../socket";
import { AreaMarkerRenderer } from "../object-layer/area-marker-renderer";
import { TokenRenderer } from "../object-layer/token-renderer";
import { SplashScreen } from "../splash-screen";
import { AuthenticationScreen } from "../authentication-screen";
import { buildApiUrl } from "../public-url";
import { Modal } from "../modal";
import { ImageLightBoxModal } from "../image-lightbox-modal";
import { Chat } from "../chat";
import {
  RelayEnvironmentProvider,
  createEnvironment,
} from "../relay-environment";

const ToolbarContainer = styled.div`
  position: absolute;
  display: flex;
  justify-content: center;
  width: 100%;
  bottom: 0;
  bottom: 12px;
  pointer-events: none;
`;

const AbsoluteFullscreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const ChatToggleButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  height: 30px;
  width: 30px;
  background-color: white;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  border: none;
`;

const useShowChatState = createPersistedState("chat.state");

const reduceOffsetToMinimum = (offset, sideLength) => {
  const newOffset = offset - sideLength;
  if (newOffset > 0) return reduceOffsetToMinimum(newOffset, sideLength);
  return offset;
};

const drawGridToContext = (grid, dimensions, canvas, gridColor) => {
  if (!grid) return;
  const context = canvas.getContext("2d");
  context.strokeStyle = gridColor || "rgba(0, 0, 0, .5)";
  context.lineWidth = 2;

  const sideLength = grid.sideLength * dimensions.ratio;
  const offsetX = reduceOffsetToMinimum(grid.x * dimensions.ratio, sideLength);
  const offsetY = reduceOffsetToMinimum(grid.y * dimensions.ratio, sideLength);

  for (let i = 0; i < canvas.width / sideLength; i++) {
    context.beginPath();
    context.moveTo(offsetX + i * sideLength, 0);
    context.lineTo(offsetX + i * sideLength, canvas.height);
    context.stroke();
  }
  for (let i = 0; i < canvas.height / sideLength; i++) {
    context.beginPath();
    context.moveTo(0, offsetY + i * sideLength);
    context.lineTo(canvas.width, offsetY + i * sideLength);
    context.stroke();
  }
};

const PlayerMap = ({ fetch, pcPassword, socket }) => {
  const panZoomRef = useRef(null);
  const currentMapRef = useRef(null);
  const [currentMap, setCurrentMap] = useState(null);
  const [sharedMediaId, setSharedMediaId] = useState(false);

  const mapId = currentMap ? currentMap.id : null;
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

  const centerMap = (isAnimated = true) => {
    if (!panZoomRef.current) {
      return;
    }

    panZoomRef.current.autoCenter(0.8, isAnimated);
  };

  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const cacheBusterRef = useRef(0);

  useAsyncEffect(
    function* () {
      const onReceiveMap = async (data) => {
        if (!data) {
          return;
        }

        const context = mapCanvasRef.current.getContext("2d");

        if (pendingImageLoads.current) {
          pendingImageLoads.current.forEach((task) => {
            task.cancel();
          });
          pendingImageLoads.current = null;
        }

        /**
         * Hide map (show splashscreen)
         */
        if (!data.map) {
          currentMapRef.current = null;
          setCurrentMap(null);
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
        if (currentMapRef.current && currentMapRef.current.id === data.map.id) {
          const task = loadImage(
            buildApiUrl(
              `/map/${data.map.id}/fog-live?cache_buster=${cacheBusterRef.current}&authorization=${pcPassword}`
            )
          );
          cacheBusterRef.current = cacheBusterRef.current + 1;
          pendingImageLoads.current = [task];

          task.promise
            .then((fogImage) => {
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

              if (data.map.showGridToPlayers) {
                drawGridToContext(
                  data.map.grid,
                  mapCanvasDimensions.current,
                  mapCanvasRef.current,
                  data.map.gridColor
                );
              }

              context.drawImage(
                fogImage,
                0,
                0,
                mapCanvasRef.current.width,
                mapCanvasRef.current.height
              );
            })
            .catch((err) => {
              // @TODO: distinguish between network error (rertry?) and cancel error
              console.error(err);
            });
          return;
        }

        /**
         * Load new map
         */
        currentMapRef.current = data.map;

        const tasks = [
          loadImage(
            buildApiUrl(
              `/map/${data.map.id}/map?cache_buster=${cacheBusterRef.current}&authorization=${pcPassword}`
            )
          ),
          loadImage(
            buildApiUrl(
              `/map/${data.map.id}/fog-live?cache_buster=${cacheBusterRef.current}&authorization=${pcPassword}`
            )
          ),
        ];
        pendingImageLoads.current = tasks;

        Promise.all(tasks.map((task) => task.promise))
          .then(([map, fog]) => {
            pendingImageLoads.current = null;

            mapImageRef.current = map;
            const mapCanvas = mapCanvasRef.current;
            const objectSvg = objectSvgRef.current;
            const mapContainer = mapContainerRef.current;

            const mapContext = mapCanvas.getContext("2d");

            const canvasDimensions = getOptimalDimensions(
              map.width,
              map.height,
              9000,
              9000
            );

            mapCanvas.width = canvasDimensions.width;
            mapCanvas.height = canvasDimensions.height;
            objectSvg.setAttribute("width", canvasDimensions.width);
            objectSvg.setAttribute("height", canvasDimensions.height);

            mapCanvasDimensions.current = canvasDimensions;
            setCurrentMap(data.map);

            const widthPx = `${canvasDimensions.width}px`;
            const heightPx = `${canvasDimensions.height}px`;
            mapCanvas.style.width = mapContainer.style.width = objectSvg.style.width = widthPx;
            mapCanvas.style.height = mapContainer.style.height = objectSvg.style.height = heightPx;

            mapContext.drawImage(
              map,
              0,
              0,
              canvasDimensions.width,
              canvasDimensions.height
            );
            if (data.map.showGridToPlayers) {
              drawGridToContext(
                data.map.grid,
                canvasDimensions,
                mapCanvas,
                data.map.gridColor
              );
            }
            mapContext.drawImage(
              fog,
              0,
              0,
              canvasDimensions.width,
              canvasDimensions.height
            );

            centerMap(false);
            setShowSplashScreen(false);
          })
          .catch((err) => {
            // @TODO: distinguish between network error (rertry?) and cancel error
            console.error(err);
          });
      };

      const {
        data: { activeMap },
      } = yield fetch("/active-map").then((res) => res.json());

      if (activeMap) {
        yield onReceiveMap({ map: activeMap });
      }

      socket.on("mark area", async (data) => {
        setMarkedAreas((markedAreas) => [
          ...markedAreas,
          {
            id: data.id,
            x: data.x * mapCanvasDimensions.current.ratio,
            y: data.y * mapCanvasDimensions.current.ratio,
          },
        ]);
      });

      socket.on("share image", ({ id }) => {
        setSharedMediaId(id);
      });

      socket.on("map update", onReceiveMap);

      const contextmenuListener = (ev) => {
        ev.preventDefault();
      };
      window.addEventListener("contextmenu", contextmenuListener);

      return () => {
        socket.off("mark area");
        socket.off("map update");

        window.removeEventListener("contextmenu", contextmenuListener);
        if (pendingImageLoads.current) {
          pendingImageLoads.current.forEach((task) => {
            task.cancel();
          });
          pendingImageLoads.current = null;
        }
      };
    },
    [socket, fetch, pcPassword, refetchTrigger]
  );

  useEffect(() => {
    if (!mapId) return;
    const eventName = `token:mapId:${mapId}`;

    socket.on(eventName, ({ type, data }) => {
      if (type === "add") {
        setCurrentMap(
          produce((map) => {
            map.tokens.push(data.token);
          })
        );
      } else if (type === "update") {
        setCurrentMap(
          produce((map) => {
            map.tokens = map.tokens.map((token) => {
              if (token.id !== data.token.id) return token;
              return {
                ...token,
                ...data.token,
              };
            });
          })
        );
      } else if (type === "remove") {
        setCurrentMap(
          produce((map) => {
            map.tokens = map.tokens = map.tokens.filter(
              (token) => token.id !== data.tokenId
            );
          })
        );
      }
    });

    return () => socket.off(eventName);
  }, [socket, mapId]);

  useEffect(() => {
    const listener = () => {
      setRefetchTrigger((i) => i + 1);
    };

    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, []);

  // long press event for setting a map marker
  const longPressProps = useLongPress((ev) => {
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
    const ref = new Referentiel(panZoomRef.current.getDragContainer());
    const [x, y] = ref.global_to_local(input);
    const { ratio } = mapCanvasDimensions.current;
    socket.emit("mark area", { x: x / ratio, y: y / ratio });
  }, 500);

  return (
    <>
      <PanZoom
        style={{
          cursor: "grab",
          background: "black",
          height: "100vh",
        }}
        ref={panZoomRef}
        {...longPressProps}
      >
        <div ref={mapContainerRef}>
          <canvas
            ref={mapCanvasRef}
            style={{
              pointerEvents: "none",
              backfaceVisibility: "hidden",
              position: "absolute",
            }}
          />
          <ObjectLayer ref={objectSvgRef}>
            <TokenRenderer
              tokens={(currentMap && currentMap.tokens) || []}
              ratio={
                mapCanvasDimensions.current
                  ? mapCanvasDimensions.current.ratio
                  : 1
              }
            />

            <AreaMarkerRenderer
              markedAreas={markedAreas}
              setMarkedAreas={setMarkedAreas}
            />
          </ObjectLayer>
        </div>
      </PanZoom>
      {!showSplashScreen ? (
        <ToolbarContainer>
          <Toolbar horizontal>
            <Toolbar.Logo />
            <Toolbar.Group>
              <Toolbar.Item isActive>
                <Toolbar.Button
                  onClick={() => {
                    centerMap();
                  }}
                  onTouchStart={(ev) => {
                    ev.preventDefault();
                    centerMap();
                  }}
                >
                  <Icons.Compass />
                  <Icons.Label>Center Map</Icons.Label>
                </Toolbar.Button>
              </Toolbar.Item>
              <Toolbar.Item isActive>
                <Toolbar.LongPressButton
                  onClick={() => {
                    if (!panZoomRef.current) {
                      return;
                    }
                    panZoomRef.current.zoomIn();
                  }}
                  onLongPress={() => {
                    const interval = setInterval(() => {
                      panZoomRef.current.zoomIn();
                    }, 100);

                    return () => clearInterval(interval);
                  }}
                >
                  <Icons.ZoomIn />
                  <Icons.Label>Zoom In</Icons.Label>
                </Toolbar.LongPressButton>
              </Toolbar.Item>
              <Toolbar.Item isActive>
                <Toolbar.LongPressButton
                  onClick={() => {
                    if (!panZoomRef.current) {
                      return;
                    }
                    panZoomRef.current.zoomOut();
                  }}
                  onLongPress={() => {
                    const interval = setInterval(() => {
                      panZoomRef.current.zoomOut();
                    }, 100);

                    return () => clearInterval(interval);
                  }}
                >
                  <Icons.ZoomOut />
                  <Icons.Label>Zoom Out</Icons.Label>
                </Toolbar.LongPressButton>
              </Toolbar.Item>
            </Toolbar.Group>
          </Toolbar>
        </ToolbarContainer>
      ) : (
        <AbsoluteFullscreenContainer>
          <SplashScreen text="Ready." />
        </AbsoluteFullscreenContainer>
      )}
      {sharedMediaId ? (
        <ImageLightBoxModal
          src={buildApiUrl(`/images/${sharedMediaId}`)}
          close={() => setSharedMediaId(null)}
        />
      ) : null}
    </>
  );
};

const usePcPassword = createPersistedState("pcPassword");

export const PlayerArea = () => {
  const socket = useSocket();
  const [pcPassword, setPcPassword] = usePcPassword("");

  const [mode, setMode] = useState("LOADING");

  const localFetch = useCallback(
    (input, init = {}) => {
      return fetch(buildApiUrl(input), {
        ...init,
        headers: {
          Authorization: pcPassword ? `Bearer ${pcPassword}` : undefined,
          ...init.headers,
        },
      }).then((res) => {
        if (res.status === 401) {
          console.error("Unauthenticated access.");
          throw new Error("Unauthenticated access.");
        }
        return res;
      });
    },
    [pcPassword]
  );

  useAsyncEffect(
    function* () {
      const result = yield localFetch("/auth").then((res) => res.json());
      if (!result.data.role) {
        setMode("AUTHENTICATE");
        return;
      }
      setMode("READY");
    },
    [localFetch]
  );

  const [relayEnvironment, setRelayEnvironment] = React.useState(null);

  React.useEffect(() => {
    socket.emit("auth", { password: pcPassword });
    setRelayEnvironment(createEnvironment(socket));

    socket.on("reconnecting", function () {
      console.log("reconnecting to server");
    });

    socket.on("reconnect", function () {
      console.log("reconnected to server");
    });

    socket.on("reconnect_failed", function () {
      console.log("reconnect failed!");
    });

    socket.on("disconnect", function () {
      console.log("disconnected from server");
    });

    return () => {
      socket.off("connect");
      socket.off("reconnecting");
      socket.off("reconnect");
      socket.off("reconnect_failed");
      socket.off("disconnect");
    };
  }, [socket, pcPassword]);

  // "show" or "hidden"
  const [chatState, setShowChatState] = useShowChatState("show");

  if (mode === "LOADING") {
    return <SplashScreen text="Loading..." />;
  }
  if (mode === "AUTHENTICATE") {
    return (
      <AuthenticationScreen
        requiredRole="PC"
        fetch={localFetch}
        onAuthenticate={(password) => {
          setPcPassword(password);
        }}
      />
    );
  }

  if (mode === "READY") {
    return (
      <Modal.Provider>
        <div style={{ display: "flex", height: "100vh" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <PlayerMap
              fetch={localFetch}
              pcPassword={pcPassword}
              socket={socket}
            />
            <ChatToggleButton
              onClick={() =>
                setShowChatState((showChat) =>
                  showChat === "show" ? "hidden" : "show"
                )
              }
            >
              <Icons.MessageCircleIcon heightt={20} width={20} />
            </ChatToggleButton>
          </div>
          {chatState === "show" ? (
            <div style={{ flex: 1, maxWidth: 400 }}>
              {relayEnvironment ? (
                <RelayEnvironmentProvider value={relayEnvironment}>
                  <Chat />
                </RelayEnvironmentProvider>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal.Provider>
    );
  }

  throw new Error("Invalid mode.");
};
