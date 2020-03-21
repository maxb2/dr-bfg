import React from "react";
import { Converter as HtmlConverter } from "showdown";
import styled from "@emotion/styled/macro";
import "react-mde/lib/styles/css/react-mde-all.css";
import { MarkdownEditor } from "../note-editor/note-editor";
import * as Button from "../../button";
import * as Icon from "../../feather-icons";
import { Input } from "../../input";
import { useOvermind } from "../../hooks/use-overmind";
import { HtmlContainer } from "../components/html-container";

const Container = styled.div`
  display: flex;
  align-items: center;
  position: absolute;
  height: 100%;
  top: 0;
  right: 0;
  max-width: 500px;
  width: 100%;
  padding-right: 16px;
  padding-left: 16px;
  pointer-events: none;
`;

const Window = styled.div`
  display: flex;
  flex-direction: column;

  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
  background-color: white;
  border-radius: 5px;
  width: 100%;
  height: 60vh;
  padding: 20px;
  pointer-events: all;
`;

export const TokenInfoAside: React.FC<{}> = () => {
  const { actions, state } = useOvermind();
  if (!state.tokenInfoAside.isVisible) return null;

  switch (state.tokenInfoAside.activeToken.mode) {
    case "loading":
    case "notFound":
      return null;
    case "loaded":
      return (
        <NoteReference
          activeToken={state.tokenInfoAside.activeToken}
          isEditMode={state.tokenInfoAside.isEditMode}
          enterEditMode={() => actions.tokenInfoAside.setEditMode(true)}
          exitEditMode={() => actions.tokenInfoAside.setEditMode(false)}
          close={actions.tokenInfoAside.close}
          updateNoteTitle={actions.tokenInfoAside.updateActiveNoteTitle}
          updateNoteContent={actions.tokenInfoAside.updateActiveNoteContent}
        />
      );
  }
};

const NoteReference: React.FC<{
  close: () => void;
  isEditMode: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;
  activeToken: Extract<
    ReturnType<typeof useOvermind>["state"]["tokenInfoAside"]["activeToken"],
    { mode: "loaded" }
  >;
  updateNoteTitle: (value: string) => void;
  updateNoteContent: (value: string) => void;
}> = ({
  close,
  isEditMode,
  enterEditMode,
  exitEditMode,
  activeToken,
  updateNoteTitle,
  updateNoteContent
}) => {
  useOvermind();

  const note = activeToken.reference;
  return (
    <Container>
      <Window
        onKeyDown={ev => {
          ev.stopPropagation();
          if (ev.key !== "Escape") return;
          if (!isEditMode) close();
        }}
      >
        <div
          style={{
            display: "flex",
            marginBottom: 16,
            width: "100%"
          }}
        >
          {isEditMode ? (
            <Input
              value={note.title}
              onChange={ev => updateNoteTitle(ev.target.value)}
              placeholder="Title"
            />
          ) : (
            <>
              <h3
                style={{
                  flexGrow: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {note.title}
              </h3>
              <div style={{ flexShrink: 0, display: "flex" }}>
                <div style={{ paddingLeft: 8, marginLeft: "auto" }}>
                  <Button.Tertiary
                    iconOnly
                    small
                    onClick={() => enterEditMode()}
                  >
                    <Icon.EditIcon height={16} />
                  </Button.Tertiary>
                </div>
                <div style={{ paddingLeft: 8 }}>
                  <Button.Tertiary iconOnly small onClick={close}>
                    <Icon.XIcon height={16} />
                  </Button.Tertiary>
                </div>
              </div>
            </>
          )}
        </div>
        {isEditMode ? (
          <div
            style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}
          >
            <MarkdownEditor value={note.content} onChange={updateNoteContent} />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16
              }}
            >
              <div>
                <Button.Tertiary small onClick={exitEditMode}>
                  <Icon.XIcon />
                  <span>Close Editor</span>
                </Button.Tertiary>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowY: "scroll", overflowX: "hidden" }}>
            <HtmlContainer
              dangerouslySetInnerHTML={{
                __html: new HtmlConverter().makeHtml(note.content)
              }}
            />
          </div>
        )}
      </Window>
    </Container>
  );
};
