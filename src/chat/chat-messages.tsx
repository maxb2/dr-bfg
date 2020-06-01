import React from "react";
import { createPaginationContainer } from "react-relay";
import styled from "@emotion/styled/macro";
import graphql from "babel-plugin-relay/macro";
import * as ReactVirtualized from "react-virtualized";
import { chatMessages_chat } from "./__generated__/chatMessages_chat.graphql";
import { ChatMessage } from "./chat-message";
import { useStaticRef } from "../hooks/use-static-ref";

const height = "400px";
const width = "500px";

const ChatMessageContainer = styled.div<{ disableScrollbar: boolean }>`
  position: relative;
  height: ${height};
  width: ${width};

  .react-virtualized-list::-webkit-scrollbar {
    width: ${(p) => (p.disableScrollbar ? "0 !important" : null)};
  }
`;

const ChatMessagesRenderer: React.FC<{ chat: chatMessages_chat }> = ({
  chat: { chat },
}) => {
  const [follow, setFollow] = React.useState(true);
  const listRef = React.useRef<ReactVirtualized.List | null>(null);

  React.useEffect(() => {
    if (follow === true) {
      listRef.current?.scrollToRow(chat.edges.length - 1);
    }
  }, [chat.edges, follow]);

  // TODO: Is there a better way to start the list at the end?
  React.useEffect(() => {
    setTimeout(() => listRef.current?.scrollToRow(chat.edges.length - 1));
  }, []);

  const cache = useStaticRef(
    () =>
      new ReactVirtualized.CellMeasurerCache({
        fixedWidth: true,
      })
  );

  return (
    <ChatMessageContainer disableScrollbar={follow}>
      {/* Virtualization based on https://github.com/bvaughn/react-virtualized/blob/master/playground/chat.js */}
      <ReactVirtualized.AutoSizer>
        {(autoSizerParams) => {
          // TODO: Resize chat and stuff
          // if (mostRecentWidth && mostRecentWidth !== autoSizerParams.width) {
          //   cache.clearAll();
          //   list.recomputeRowHeights();
          // }

          return (
            <ReactVirtualized.List
              className="react-virtualized-list"
              ref={listRef}
              deferredMeasurementCache={cache}
              height={autoSizerParams.height}
              rowCount={chat.edges.length}
              rowHeight={cache.rowHeight}
              width={autoSizerParams.width}
              // TODO: Why do I need to add the type definition
              onScroll={(target: ReactVirtualized.OnScrollParams) => {
                // we still want to follow in case the content is not scrollable yet.
                if (target.scrollHeight < target.clientHeight) return;
                if (
                  target.scrollTop !==
                  target.scrollHeight - target.clientHeight
                ) {
                  setFollow(false);
                } else {
                  setFollow(true);
                }
              }}
              rowRenderer={(params) => {
                return (
                  <ReactVirtualized.CellMeasurer
                    cache={cache}
                    columnIndex={0}
                    key={params.key}
                    parent={params.parent}
                    rowIndex={params.index}
                    width={undefined}
                  >
                    <div style={params.style} key={params.key}>
                      <ChatMessage message={chat.edges[params.index].node} />
                    </div>
                  </ReactVirtualized.CellMeasurer>
                );
              }}
            />
          );
        }}
      </ReactVirtualized.AutoSizer>
    </ChatMessageContainer>
  );
};

// Fetching more is not implemented yet. These all are just dummy values.
// We used a connection becaue it is easier documented how to add edges.
export const ChatMessages = createPaginationContainer(
  ChatMessagesRenderer,
  {
    chat: graphql`
      fragment chatMessages_chat on Query
        @argumentDefinitions(
          count: { type: "Int", defaultValue: 10 }
          cursor: { type: "ID" }
        ) {
        chat(first: $count, after: $cursor)
          @connection(key: "chatMessages_chat") {
          edges {
            node {
              ...chatMessage_message
            }
          }
        }
      }
    `,
  },
  {
    getVariables: () => ({ count: 0, cursor: "NOT_IMPLEMENTED_YET" }),
    query: graphql`
      query chatMessagesQuery($count: Int!, $cursor: ID) {
        ...chatMessages_chat @arguments(count: $count, cursor: $cursor)
      }
    `,
  }
);
