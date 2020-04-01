"use strict";

const express = require("express");
const path = require("path");
const favicon = require("serve-favicon");
const logger = require("morgan");
const bodyParser = require("body-parser");
const createUniqueId = require("uuid/v4");
const fs = require("fs-extra");
const os = require("os");
const http = require("http");
const createSocketIOServer = require("socket.io");
const busboy = require("connect-busboy");
const { Maps } = require("./maps");
const { Notes } = require("./notes");
const { Settings } = require("./settings");
const { getDataDirectory } = require("./util");
const env = require("./env");

const app = express();
const apiRouter = express.Router();
const server = (app.http = http.createServer(app));
const io = createSocketIOServer(server, {
  path: "/api/socket.io",
});

fs.mkdirpSync(getDataDirectory());

const maps = new Maps();
const notes = new Notes();
const settings = new Settings();

app.use(busboy());

// Not sure if this is needed, Chrome seems to grab the favicon just fine anyway
// Maybe for cross-browser support
app.use(logger("dev"));
app.use(favicon(path.resolve(env.PUBLIC_PATH, "favicon.ico")));

// Needed to handle JSON posts, size limit of 50mb
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const getRole = (password) => {
  let role = null;
  if (env.PC_PASSWORD) {
    if (password === env.PC_PASSWORD) {
      role = "PC";
    }
  } else {
    role = "PC";
  }
  if (env.DM_PASSWORD) {
    if (password === env.DM_PASSWORD) {
      role = "DM";
    }
  } else {
    role = "DM";
  }
  return role;
};

const authorizationMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const authParam = req.query.authorization;
  let token = null;

  if (authHeader) {
    token = req.headers.authorization.split(" ")[1];
  } else if (authParam) {
    token = authParam;
  }

  req.role = getRole(token);
  next();
};

const requiresPcRole = (req, res, next) => {
  if (req.role === "DM" || req.role === "PC") {
    next();
    return;
  }
  res.status(401).json({
    data: null,
    error: {
      message: "Unauthenticated Access",
      code: "ERR_UNAUTHENTICATED_ACCESS",
    },
  });
};

const requiresDmRole = (req, res, next) => {
  if (req.role === "DM") {
    next();
    return;
  }
  res.status(401).json({
    data: null,
    error: {
      message: "Unauthenticated Access",
      code: "ERR_UNAUTHENTICATED_ACCESS",
    },
  });
};

app.use(authorizationMiddleware);

apiRouter.get("/auth", (req, res) => {
  return res.status(200).json({
    data: {
      role: req.role,
    },
  });
});

apiRouter.get("/map/:id/map", requiresPcRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  } else if (!map.mapPath) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not have a map image yet.`,
        code: "ERR_MAP_NO_IMAGE",
      },
    });
  }

  const basePath = maps.getBasePath(map);

  return res.sendFile(path.join(basePath, map.mapPath));
});

apiRouter.get("/map/:id/fog", requiresPcRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  } else if (!map.fogProgressPath) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not have a fog image yet.`,
        code: "ERR_MAP_NO_FOG",
      },
    });
  }
  return res.sendFile(path.join(maps.getBasePath(map), map.fogProgressPath));
});

apiRouter.get("/map/:id/fog-live", requiresPcRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  } else if (!map.fogLivePath) {
    return res.status(404).json({
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not have a fog image yet.`,
        code: "ERR_MAP_NO_FOG",
      },
    });
  }
  return res.sendFile(path.join(maps.getBasePath(map), map.fogLivePath));
});

apiRouter.post("/map/:id/map", requiresPcRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.send(404);
  }
  req.pipe(req.busboy);
  req.busboy.once("file", (fieldname, file, filename) => {
    const extension = filename.split(".").pop();
    maps
      .updateMapImage(req.params.id, { fileStream: file, extension })
      .then((map) => {
        res.json({ success: true, data: map });
      })
      .catch((err) => {
        res.status(404).json({ data: null, error: err });
      });
  });
});

apiRouter.post("/map/:id/fog", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.send(404);
  }

  req.pipe(req.busboy);
  req.busboy.once("file", (fieldname, file, filename) => {
    maps.updateFogProgressImage(req.params.id, file).then((map) => {
      res.json({ success: true, data: map });
    });
  });
});

apiRouter.post("/map/:id/send", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.send(404);
  }
  req.pipe(req.busboy);
  req.busboy.once("file", (fieldname, file, filename) => {
    maps.updateFogLiveImage(req.params.id, file).then((map) => {
      settings.set("currentMapId", map.id);
      res.json({ success: true, data: map });
      io.emit("map update", {
        map,
        image: req.body.image,
      });
    });
  });
});

apiRouter.delete("/map/:id", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.send(404);
  }

  maps.deleteMap(map.id);

  res.status(200).json({
    success: true,
  });
});

apiRouter.get("/active-map", requiresPcRole, (req, res) => {
  let activeMap = null;
  const activeMapId = settings.get("currentMapId");
  if (activeMapId) {
    activeMap = maps.get(activeMapId);
  }

  return res.status(200).json({
    success: true,
    data: {
      activeMap,
    },
  });
});

apiRouter.post("/active-map", requiresDmRole, (req, res) => {
  const mapId = req.body.mapId;
  if (mapId === undefined) {
    res.status(404).json({
      error: {
        message: "Missing param 'mapId' in body.",
        code: "ERR_MISSING_MAP_ID",
      },
    });
  }
  settings.set("currentMapId", mapId);
  io.emit("map update", {
    map: null,
    image: null,
  });
  res.json({
    success: true,
  });
});

apiRouter.get("/map", requiresPcRole, (req, res) => {
  res.json({
    success: true,
    data: {
      currentMapId: settings.get("currentMapId"),
      maps: maps.getAll(),
    },
  });
});

apiRouter.post("/map", requiresDmRole, (req, res) => {
  req.pipe(req.busboy);

  const data = {};

  req.busboy.on("file", (fieldname, stream, filename) => {
    const extension = filename.split(".").pop();
    const saveTo = path.join(os.tmpDir(), path.basename(fieldname));
    data.file = {
      path: saveTo,
      extension,
    };
    stream.pipe(fs.createWriteStream(saveTo));
  });
  req.busboy.on("field", (fieldname, value) => {
    if (fieldname === "title") {
      data[fieldname] = value;
    }
  });

  req.busboy.on("finish", () => {
    const map = maps.createMap(data);
    res.status(200).json({ success: true, data: { map } });
  });
});

apiRouter.patch("/map/:id", requiresDmRole, (req, res) => {
  let map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  }
  const updates = {};

  if (req.body.title) {
    updates.title = req.body.title;
  }
  if (req.body.grid) {
    updates.grid = req.body.grid;
    updates.showGrid = true;
  }
  if ({}.hasOwnProperty.call(req.body, "showGrid")) {
    updates.showGrid = req.body.showGrid;
  }
  if ({}.hasOwnProperty.call(req.body, "showGridToPlayers")) {
    updates.showGridToPlayers = req.body.showGridToPlayers;
  }
  if ({}.hasOwnProperty.call(req.body, "gridColor")) {
    updates.gridColor = req.body.gridColor;
  }

  if (Object.keys(updates).length) {
    map = maps.updateMapSettings(map.id, updates);
  }

  res.json({
    success: true,
    data: {
      map,
    },
  });
});

apiRouter.post("/map/:id/token", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  }

  const { token } = maps.addToken(map.id, {
    x: req.body.x,
    y: req.body.y,
    color: req.body.color,
    label: req.body.label,
    radius: req.body.radius,
  });

  res.json({
    success: true,
    data: {
      token,
    },
  });

  io.emit(`token:mapId:${map.id}`, {
    type: "add",
    data: { token },
  });
});

apiRouter.delete("/map/:id/token/:tokenId", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  }

  const updatedMap = maps.removeToken(map.id, req.params.tokenId);
  res.json({
    success: true,
    data: {
      map: updatedMap,
    },
  });

  io.emit(`token:mapId:${map.id}`, {
    type: "remove",
    data: { tokenId: req.params.tokenId },
  });
});

apiRouter.patch("/map/:id/token/:tokenId", requiresDmRole, (req, res) => {
  const map = maps.get(req.params.id);
  if (!map) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Map with id '${req.params.id}' does not exist.`,
        code: "ERR_MAP_DOES_NOT_EXIST",
      },
    });
  }

  const result = maps.updateToken(map.id, req.params.tokenId, {
    type: req.body.type,
    label: req.body.label,
    x: req.body.x,
    y: req.body.y,
    color: req.body.color,
    radius: req.body.radius,
    isVisibleForPlayers: req.body.isVisibleForPlayers,
    isLocked: req.body.isLocked,
    title: req.body.title,
    description: req.body.description,
    reference: req.body.reference,
  });

  res.json({
    success: true,
    data: {
      map: result.map,
    },
  });

  io.emit(`token:mapId:${map.id}`, {
    type: "update",
    data: { token: result.token },
  });
});

apiRouter.get("/notes", requiresDmRole, ({ req, res }) => {
  const allNotes = notes.getAll();

  return res.json({
    success: true,
    data: {
      notes: allNotes,
    },
  });
});

apiRouter.post("/notes", requiresDmRole, (req, res) => {
  const title = req.body.title || "New note";
  const note = notes.createNote({ title, content: "" });

  return res.json({
    success: true,
    data: {
      note,
    },
  });
});

apiRouter.patch("/notes/:id", requiresDmRole, (req, res) => {
  let note = notes.getById(req.params.id);
  if (!note) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Note with id '${req.params.id}' does not exist.`,
        code: "ERR_NOTE_DOES_NOT_EXIST",
      },
    });
  }

  const title = req.body.title;
  const content = req.body.content;
  const changes = {};

  if (typeof title === "string") {
    changes.title = title;
  }
  if (typeof content === "string") {
    changes.content = content;
  }

  note = notes.updateNote(note.id, changes);

  res.json({
    success: true,
    data: {
      note,
    },
  });
});

apiRouter.delete("/notes/:id", requiresDmRole, (req, res) => {
  const note = notes.getById(req.params.id);
  if (!note) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Note with id '${req.params.id}' does not exist.`,
        code: "ERR_NOTE_DOES_NOT_EXIST",
      },
    });
  }

  notes.deleteNote(note.id);

  // update tokens that link a certain note
  maps
    .getAll()
    .map((map) => ({
      mapId: map.id,
      affectedTokens: map.tokens.filter(
        (token) =>
          token.reference &&
          token.reference.type === "note" &&
          token.reference.id === note.id
      ),
    }))
    .forEach(({ mapId, affectedTokens }) => {
      affectedTokens.forEach(({ id }) => {
        const result = maps.updateToken(mapId, id, { reference: null });

        io.emit(`token:mapId:${mapId}`, {
          type: "update",
          data: { token: result.token },
        });
      });
    });

  res.json({
    success: true,
    data: {
      deletedNoteId: note.id,
    },
  });
});

apiRouter.get("/notes/:id", requiresDmRole, (req, res) => {
  const note = notes.getById(req.params.id);

  if (!note) {
    return res.status(404).json({
      success: false,
      data: null,
      error: {
        message: `Note with id '${req.params.id}' does not exist.`,
        code: "ERR_NOTE_DOES_NOT_EXIST",
      },
    });
  }

  res.json({
    success: true,
    data: {
      note,
    },
  });
});

app.use("/api", apiRouter);

const indexHtml = path.join(env.PUBLIC_PATH, "index.html");
const indexHtmlContent = fs
  .readFileSync(indexHtml, "utf-8")
  .replace(/__PUBLIC_URL_PLACEHOLDER__/g, env.PUBLIC_URL);

app.get("/", (req, res) => {
  res.send(indexHtmlContent);
});

app.get("/dm", (req, res) => {
  res.send(indexHtmlContent);
});

// Consider all URLs under /public/ as static files, and return them raw.
app.use(express.static(path.join(env.PUBLIC_PATH)));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use((err, req, res) => {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res) => {
  console.log(err);
  res.status(err.status || 500);
  res.render("error", {
    message: err.message,
    error: {},
  });
});

const authenticatedSockets = new Set();

io.on("connection", (socket) => {
  console.log(`WS client ${socket.handshake.address} ${socket.id} connected`);

  socket.on("auth", ({ password }) => {
    socket.removeAllListeners();

    const role = getRole(password);
    if (role === null) {
      console.log(
        `WS ${socket.handshake.address} ${socket.id} client authenticate failed`
      );
      return;
    }

    console.log(
      `WS client ${socket.handshake.address} ${socket.id} authenticate ${role}`
    );

    authenticatedSockets.add(socket);

    socket.on("mark area", (data) => {
      Array.from(authenticatedSockets).forEach((socket) => {
        socket.emit("mark area", {
          id: createUniqueId(),
          ...data,
        });
      });
    });

    if (role !== "DM") return;

    socket.on("remove token", (msg) => {
      Array.from(authenticatedSockets).forEach((socket) => {
        socket.emit("remove token", {
          ...msg,
        });
      });
    });
  });

  socket.once("disconnect", function () {
    authenticatedSockets.delete(socket);
  });
});

module.exports = app;
