export type HarHeader = {
  name: string;
  value: string;
};

export type HarRequest = {
  method: string;
  url: string;
  headers: HarHeader[];
  postData?: {
    text?: string;
    mimeType?: string;
  };
};

export type HarResponse = {
  status: number;
  headers: HarHeader[];
  content: {
    text?: string;
    size: number;
    mimeType?: string;
    encoding?: string;
  };
};

export type HarEntry = {
  request: HarRequest;
  response?: HarResponse;
  time: number;
};

export type HarLog = {
  log: {
    version: string;
    entries: HarEntry[];
  };
};
