import * as React from "react";
import styled from "@emotion/styled/macro";
import { useMessageAddMutation } from "./message-add-mutation";
import { usePersistedState } from "../hooks/use-persisted-state";

const Container = styled.form`
  display: flex;
  padding-top: 8px;
  margin-top: auto;
`;

const TextArea = styled.textarea`
  display: block;
  width: 100%;
  resize: none;
  font-size: inherit;
  font-family: inherit;
  letter-spacing: 0.2px;
  padding: 4px;
`;

const useRawChatHistory = () =>
  usePersistedState<Array<string>>("chat.history", {
    encode: (value) => JSON.stringify(value),
    decode: (rawValue) => {
      if (typeof rawValue !== "string") {
        return [];
      }
      try {
        const value = JSON.parse(rawValue);
        if (
          Array.isArray(value) &&
          value.every((value) => typeof value === "string")
        ) {
          return value;
        }
      } catch (err) {}
      return [];
    },
  });

const useChatHistory = (size = 10): [string[], (text: string) => void] => {
  const [data, setData] = useRawChatHistory();

  const pushValue = React.useCallback(
    (text) => {
      setData((data) => {
        const newData = [text, ...data];
        if (newData.length > size) {
          newData.splice(size, newData.length - size);
        }
        return newData;
      });
    },
    [size]
  );

  return [data, pushValue];
};

export const ChatTextArea: React.FC<{}> = () => {
  const [value, setValue] = React.useState("");
  const [chatHistory, pushToHistory] = useChatHistory();
  const offset = React.useRef(-1);

  const messageAdd = useMessageAddMutation();

  const onChange = React.useCallback(
    (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(ev.currentTarget.value);
    },
    []
  );

  const onSubmit = React.useCallback(() => {
    if (value.trim() === "") return;
    messageAdd({
      rawContent: value,
    });
    setValue("");
    pushToHistory(value);
    offset.current = -1;
  }, [messageAdd, value]);

  const onKeyPress = React.useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "Enter" && ev.shiftKey === false) {
        onSubmit();
        ev.preventDefault();
      }
    },
    [onSubmit, chatHistory, value]
  );

  const onKeyDown = React.useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "ArrowUp" && ev.shiftKey === true) {
        offset.current = Math.min(offset.current + 1, chatHistory.length - 1);
        setValue((value) => chatHistory[offset.current] || value);
      } else if (ev.key === "ArrowDown" && ev.shiftKey === true) {
        offset.current = Math.max(offset.current - 1, -1);
        if (offset.current === -1) {
          setValue("");
        } else {
          setValue((value) => chatHistory[offset.current] || value);
        }
      }
    },
    [value]
  );

  return (
    <Container
      onSubmit={onSubmit}
      onKeyPress={onKeyPress}
      onKeyDown={onKeyDown}
    >
      <TextArea value={value} onChange={onChange} rows={5} />
    </Container>
  );
};
