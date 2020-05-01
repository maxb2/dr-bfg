type ISendRequestOptions = {
  url: string;
  headers: {
    [headerName: string]: string | null;
  };
} & (
  | {
      method: "POST";
      body: FormData;
    }
  | {
      method: "GET";
    }
);

type IResult =
  | {
      type: "error";
    }
  | {
      type: "abort";
    }
  | {
      type: "success";
      data: string;
    };

export type ISendRequestTask = {
  abort: () => void;
  done: Promise<IResult>;
};

/**
 * Utility for sending HTTP requests with XMLHttpRequest
 *
 * 1. Fetch + AbortController Cancelation has bad browser support
 * 2. try/catch and promises swallows type information
 *
 */
export const sendRequest = (options: ISendRequestOptions): ISendRequestTask => {
  const request = new XMLHttpRequest();

  let _resolve = (_value: IResult) => {};

  const done = new Promise<IResult>((resolve) => {
    _resolve = resolve;
  });

  request.addEventListener("abort", () => {
    _resolve({
      type: "abort",
    });
  });
  request.addEventListener("error", () => {
    _resolve({
      type: "error",
    });
  });
  request.addEventListener("load", () => {
    _resolve({
      type: "success",
      data: request.responseText,
    });
  });

  request.open(options.method, options.url, true);
  for (const [header, value] of Object.entries(options.headers)) {
    if (!value) continue;
    request.setRequestHeader(header, value);
  }

  request.send(options.method === "GET" ? undefined : options.body);

  return {
    abort: () => request.abort(),
    done,
  };
};
