import * as React from "react";
import { Modal, ModalDialogSize } from "../../modal";
import * as Icon from "../../feather-icons";
import * as Button from "../../button";
import { ISendRequestTask, sendRequest } from "../../http-request";
import useAsyncEffect from "@n1ru4l/use-async-effect";
import { buildApiUrl } from "../../public-url";
import { useGetIsMounted } from "../../hooks/use-get-is-mounted";
import { useInvokeOnScrollEnd } from "../../hooks/use-invoke-on-scroll-end";
import styled from "@emotion/styled/macro";
import { ImageLightBoxModal } from "../../image-lightbox-modal";
import { useShareImageAction } from "../../hooks/use-share-image-action";
import { InputGroup } from "../../input";

type MediaLibraryProps = {
  onClose: () => void;
};

type MediaLibraryItem = {
  id: string;
  path: string;
  title: string;
};

type MediaLibraryState =
  | {
      mode: "LOADING";
      items: null;
      selectedFileId: string | null;
    }
  | {
      mode: "LOADED";
      items: Array<MediaLibraryItem>;
      selectedFileId: string | null;
    }
  | {
      mode: "LOADING_MORE";
      items: Array<MediaLibraryItem>;
      selectedFileId: string | null;
    };

type MediaLibraryAction =
  | {
      type: "LOAD_INITIAL_RESULT";
      data: {
        items: Array<MediaLibraryItem>;
      };
    }
  | {
      type: "LOAD_MORE_RESULT";
      data: {
        items: Array<MediaLibraryItem>;
      };
    };
const stateReducer: React.Reducer<MediaLibraryState, MediaLibraryAction> = (
  state,
  action
) => {
  switch (action.type) {
    case "LOAD_INITIAL_RESULT": {
      return {
        ...state,
        mode: "LOADED",
        items: action.data.items,
      };
    }
    case "LOAD_MORE_RESULT": {
      if (state.mode === "LOADING") return state;
      return {
        ...state,
        mode: "LOADED",
        items: [...state.items, ...action.data.items],
      };
    }
  }
};

const initialState: MediaLibraryState = {
  mode: "LOADING",
  items: null,
  selectedFileId: null,
};

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ onClose }) => {
  const [state, dispatch] = React.useReducer(stateReducer, initialState);
  const getIsMounted = useGetIsMounted();

  useAsyncEffect(function* (onCancel, cast) {
    const task = sendRequest({
      method: "GET",
      headers: {},
      url: buildApiUrl("/images"),
    });
    onCancel(task.abort);
    const result = yield* cast(task.done);
    if (result.type === "success") {
      const jsonResponse = JSON.parse(result.data);
      dispatch({
        type: "LOAD_INITIAL_RESULT",
        data: {
          items: jsonResponse.data.list,
        },
      });
    }
  }, []);

  const fetchMoreTask = React.useRef<ISendRequestTask | null>(null);
  React.useEffect(() => fetchMoreTask?.current?.abort, []);

  const fetchMore = React.useCallback(() => {
    if (state.mode !== "LOADED") return;
    fetchMoreTask.current?.abort();

    const task = sendRequest({
      method: "GET",
      headers: {},
      url: buildApiUrl(`/images?offset=${state.items.length}`),
    });
    fetchMoreTask.current = task;

    task.done.then((result) => {
      if (getIsMounted() === false) return;
      if (result.type === "success") {
        const jsonResponse = JSON.parse(result.data);
        dispatch({
          type: "LOAD_MORE_RESULT",
          data: {
            items: jsonResponse.data.list,
          },
        });
      }
    });
  }, [state]);

  const onScroll = useInvokeOnScrollEnd(
    React.useCallback(() => {
      if (state.mode === "LOADED") {
        fetchMore();
      }
    }, [state])
  );

  return (
    <Modal onClickOutside={onClose} onPressEscape={onClose}>
      <Content onClick={(ev) => ev.stopPropagation()} tabIndex={1}>
        <Modal.Header>
          <Modal.Heading2>
            <Icon.ImageIcon
              width={28}
              height={28}
              style={{ marginBottom: -2, marginRight: 16 }}
            />{" "}
            Media Library
          </Modal.Heading2>
          <div style={{ flex: 1, textAlign: "right" }}>
            <Button.Tertiary
              tabIndex={1}
              style={{ marginLeft: 8 }}
              onClick={onClose}
            >
              Close
            </Button.Tertiary>
          </div>
        </Modal.Header>
        <Modal.Body
          style={{ flex: 1, overflowY: "scroll" }}
          onScroll={onScroll}
        >
          <Grid>
            {state.mode === "LOADING"
              ? null
              : state.items.map((item) => <Item item={item} key={item.id} />)}
          </Grid>
        </Modal.Body>
      </Content>
    </Modal>
  );
};

const Item: React.FC<{ item: MediaLibraryItem }> = ({ item }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [showLightboxImage, setShowLightBoxImage] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const shareImage = useShareImageAction();

  return (
    <ListItem
      onMouseEnter={() => {
        setShowMenu(true);
      }}
      onMouseLeave={() => {
        setShowMenu(false);
      }}
    >
      <ListItemImage src={buildApiUrl(`/images/${item.id}`)} />
      <ListItemTitle>{item.title}</ListItemTitle>
      {showMenu ? (
        <Menu>
          <Button.Primary
            small
            title="Edit"
            iconOnly
            onClick={() => setShowEditModal(true)}
          >
            <Icon.EditIcon height={16} />
          </Button.Primary>
          <Button.Primary
            small
            title="Share with Players"
            iconOnly
            onClick={() => shareImage(item.id)}
          >
            <Icon.Share height={16} />
          </Button.Primary>
          <Button.Primary
            small
            title="Maximize"
            iconOnly
            onClick={() => setShowLightBoxImage(true)}
          >
            <Icon.Maximize height={16} />
          </Button.Primary>
        </Menu>
      ) : null}
      {showLightboxImage ? (
        <ImageLightBoxModal
          src={buildApiUrl(`/images/${item.id}`)}
          close={() => setShowLightBoxImage(false)}
        />
      ) : null}
      {showEditModal ? (
        <EditImageModal
          title={item.title}
          onClose={() => setShowEditModal(false)}
          onConfirm={() => {}}
        />
      ) : null}
    </ListItem>
  );
};

const EditImageModal: React.FC<{
  title: string;
  onClose: () => void;
  onConfirm: (opts: { title: string }) => void;
}> = ({ title, onClose, onConfirm }) => {
  const [inputValue, setInputValue] = React.useState(title);

  const onChangeInputValue = React.useCallback(
    (ev) => {
      setInputValue(ev.target.value);
    },
    [setInputValue]
  );

  return (
    <Modal onClickOutside={onClose} onPressEscape={onClose}>
      <Modal.Dialog size={ModalDialogSize.SMALL}>
        <Modal.Header>
          <Modal.Heading3>Edit Image</Modal.Heading3>
        </Modal.Header>
        <Modal.Body>
          <InputGroup
            autoFocus
            placeholder="Map title"
            value={inputValue}
            onChange={onChangeInputValue}
            error={null}
          />
        </Modal.Body>
        <Modal.Footer>
          <Modal.Actions>
            <Modal.ActionGroup left>
              <div>
                <Button.Tertiary onClick={onClose} type="button" danger>
                  <Icon.TrashIcon height={18} width={18} />
                  <span>Delete</span>
                </Button.Tertiary>
              </div>
            </Modal.ActionGroup>
            <Modal.ActionGroup>
              <div>
                <Button.Tertiary onClick={onClose} type="button">
                  <span>Close</span>
                </Button.Tertiary>
              </div>
              <div>
                <Button.Primary
                  type="submit"
                  onClick={() => {
                    onConfirm({ title: inputValue });
                  }}
                >
                  <span>Save</span>
                </Button.Primary>
              </div>
            </Modal.ActionGroup>
          </Modal.Actions>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal>
  );
};

const Menu = styled.span`
  display: block;
  position: absolute;
  top: 0;
  right: 0;
  margin-top: 4px;
  margin-right: 4px;
  > * {
    margin-left: 8px;
  }
`;

const Content = styled.div`
  width: 90vw;
  height: 90vh;
  background-color: #fff;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const ListItem = styled.div`
  position: relative;
  border: none;
  display: block;
  width: calc(100% / 4);
  padding: 16px;
  text-align: center;
  margin-bottom: 16px;

  background-color: #fff;
`;

const ListItemImage = styled.img`
  max-width: 100%;
  max-height: 150px;
`;

const ListItemTitle = styled.div`
  padding-top: 8px;
`;
