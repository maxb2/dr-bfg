import { Router } from "express";
import { schema, GraphQLContextType } from "../graphql";
import { createChat } from "../chat";
import { createUser } from "../user";
import type { Database } from "sqlite";
import type {
  SocketSessionStore,
  SocketSessionRecord,
} from "../socket-session-store";
import { registerSocketIOGraphQLServer } from "@n1ru4l/socket-io-graphql-server";

type Dependencies = {
  roleMiddleware: any;
  socketSessionStore: SocketSessionStore;
  db: Database;
  socketServer: SocketIO.Server;
};

export default ({ socketServer, socketSessionStore, db }: Dependencies) => {
  const chat = createChat();
  const user = createUser({
    sendUserConnectedMessage: ({ name }) =>
      chat.addOperationalMessage({ content: `**${name}** connected.` }),
    sendUserDisconnectedMessage: ({ name }) =>
      chat.addOperationalMessage({ content: `**${name}** disconnected.` }),
  });

  const router = Router();

  const getSession = (socket: SocketIO.Socket): SocketSessionRecord => {
    const session = socketSessionStore.get(socket);
    if (!session) {
      throw new Error("Unexpected error occurred. WebSocket has no session.");
    }
    return session;
  };

  const socketIOGraphQLServer = registerSocketIOGraphQLServer({
    socketServer,
    isLazy: true,
    getExecutionParameter: ({ socket }) => ({
      graphQLExecutionParameter: {
        schema,
        contextValue: {
          chat,
          user,
          db,
          session: getSession(socket),
        } as GraphQLContextType,
      },
    }),
  });

  return { router, socketIOGraphQLServer };
};
