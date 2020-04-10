import React, { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { disableBodyScroll, enableBodyScroll } from "body-scroll-lock";
import FocusTrap from "focus-trap-react";
import styled from "@emotion/styled/macro";
import { useStaticRef } from "../hooks/use-static-ref";

const modalRoot = document.getElementById("modal");
if (!modalRoot) {
  throw new TypeError("Modal Root was not found.");
}
const bodyElement = document.getElementById("body");
if (!bodyElement) {
  throw new TypeError("Body Element was not found.");
}
type EscapeHandlerType = (ev: KeyboardEvent) => void;

type ModalRegistration = {
  escapeHandler: EscapeHandlerType;
};

type CreateModalRegistrationResult = {
  setEscapeHandler: (escapeHandler: EscapeHandlerType) => void;
  destroy: () => void;
};

type CreateModalRegistrationFunction = (
  escapeHandler: EscapeHandlerType
) => CreateModalRegistrationResult;

const Context = React.createContext<CreateModalRegistrationFunction>(
  null as any
);

/**
 * Provider should be mounted once on top of the application
 * The main task of the provider is to orcastrate escape key events.
 */
const Provider: React.FC<{}> = ({ children }) => {
  const registeredModals = useStaticRef<ModalRegistration[]>(() => []);

  const createModalRegistration: CreateModalRegistrationFunction = useCallback(
    (escapeHandler) => {
      const modalRegistration = {
        escapeHandler,
      };

      const prevLength = registeredModals.length;

      registeredModals.unshift(modalRegistration);

      const postLength = registeredModals.length;

      if (prevLength === 0 && postLength > 0) {
        disableBodyScroll(bodyElement);
      }

      return {
        setEscapeHandler: (handler) => {
          modalRegistration.escapeHandler = handler;
        },
        destroy: () => {
          const index = registeredModals.findIndex(
            (registration) => registration === modalRegistration
          );
          if (index === -1) {
            throw new Error("Inconsistent state.");
          }
          registeredModals.splice(index, 1);
          if (registeredModals.length === 0) {
            enableBodyScroll(bodyElement);
          }
        },
      };
    },
    [registeredModals]
  );

  // register escape event listener
  useEffect(() => {
    const keydownListener = (ev: KeyboardEvent) => {
      if (ev.keyCode === 27) {
        for (const registeredModal of registeredModals) {
          // only handle the first escapeHandler that occures.
          if (registeredModal.escapeHandler) {
            registeredModal.escapeHandler(ev);
            break;
          }
        }
      }
    };

    window.addEventListener("keydown", keydownListener);

    return () => {
      window.removeEventListener("keydown", keydownListener);
    };
  }, [registeredModals]);

  return (
    <Context.Provider value={createModalRegistration}>
      {children}
    </Context.Provider>
  );
};

const ModalBackground: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    styles?: React.CSSProperties;
  }
> = ({ children, styles, ...props }) => (
  <FocusTrap>
    <div
      onClick={(ev) => {
        ev.stopPropagation();
        if (props.onClick) props.onClick(ev);
      }}
      onMouseDown={(ev) => {
        ev.stopPropagation();
      }}
      onDoubleClick={(ev) => {
        ev.stopPropagation();
      }}
      onTouchStart={(ev) => {
        ev.stopPropagation();
      }}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        position: "fixed",
        height: "100%",
        width: "100%",
        top: 0,
        left: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        ...styles,
      }}
      {...props}
    >
      {children}
    </div>
  </FocusTrap>
);

const ModalPortal: React.FC<{
  onClickOutside?: () => void;
  onPressEscape: () => void;
  backgroundStyles?: any;
}> = ({ children, onClickOutside, onPressEscape, backgroundStyles }) => {
  const createModalRegistration = React.useContext(Context);
  const modalElement = useStaticRef(() => document.createElement("div"));
  const modalRegistration = React.useRef<CreateModalRegistrationResult | null>(
    null
  );

  useEffect(() => {
    modalRoot.append(modalElement);
    modalRegistration.current = createModalRegistration(onPressEscape);

    return () => {
      modalRoot.removeChild(modalElement);
      if (!modalRegistration.current) {
        return;
      }
      modalRegistration.current.destroy();
    };
    // modalElement will never change
    // onPressEscape is omitted because the registration should only be done once.
    // further changes should be handled by the useEffect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalElement]);

  useEffect(() => {
    if (!modalRegistration.current) {
      return;
    }
    modalRegistration.current.setEscapeHandler(onPressEscape);
  }, [onPressEscape]);

  return createPortal(
    <ModalBackground onClick={onClickOutside} styles={backgroundStyles}>
      {children}
    </ModalBackground>,
    modalElement
  );
};

// TODO: convert to const enum once all consumers use ts
export enum ModalDialogSize {
  "DEFAULT" = "DEFAULT",
  "SMALL" = "SMALL",
}

// TODO: convert to const enum once all consumers use ts
export enum DialogSizeMappings {
  "DEFAULT" = 1024,
  "SMALL" = 512,
}

const Dialog: React.FC<
  React.FormHTMLAttributes<HTMLFormElement> & {
    size?: ModalDialogSize.SMALL;
  }
> = ({
  children,
  size = ModalDialogSize.DEFAULT,
  onSubmit: onSubmitOuter,
  ...props
}) => {
  const onSubmit: (
    event: React.FormEvent<HTMLFormElement>
  ) => void = useCallback(
    (ev) => {
      ev.preventDefault();
      if (onSubmitOuter) {
        onSubmitOuter(ev);
      }
    },
    [onSubmitOuter]
  );
  return (
    <form
      onSubmit={onSubmit}
      role="dialog"
      style={{
        width: "100%",
        //@ts-ignore
        maxWidth: DialogSizeMappings[size],
        backgroundColor: "white",
        borderRadius: 5,
        marginLeft: 8,
        marginRight: 8,
      }}
      onClick={(ev) => {
        ev.stopPropagation();
      }}
      {...props}
    >
      {children}
    </form>
  );
};

const Header: React.FC<{ style?: React.CSSProperties }> = ({
  children,
  style,
  ...props
}) => {
  return (
    <div
      {...props}
      style={{
        width: "100%",
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottom: "1px solid rgba(0,0,0,.1)",
        display: "flex",
        alignItems: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Heading2 = styled.h2`
  margin: 0;
`;

const Heading3 = styled.h3`
  margin: 0;
`;

const Body = styled.div<{ noPadding?: boolean }>`
  width: 100%;
  padding: ${(p) => (p.noPadding ? null : `20px 20px 20px 20px`)};
`;

const Aside = styled.div`
  display: flex;
  flex-direction: column;
  overflow: scroll;
  max-width: 30%;
  width: 100%;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
`;

const Footer = styled.div`
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 20px;
  padding-bottom: 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const ActionGroup = styled.div`
  margin-left: 20px;
  > button {
    margin-left: 18px;
  }
`;

export const Modal = Object.assign(ModalPortal, {
  Dialog,
  Header,
  Heading2,
  Heading3,
  Body,
  Aside,
  Footer,
  Content,
  Actions,
  ActionGroup,
  Provider,
});
