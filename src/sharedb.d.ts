declare module 'sharedb' {
  class DB {
    commit(
      collection: string,
      id: string,
      op: any,
      snapshot: any,
      options: any,
      callback: (err?: Error) => void
    ): void;

    getSnapshot(
      collection: string,
      id: string,
      fields: any,
      options: any,
      callback: (err: Error | null, snapshot?: any) => void
    ): void;

    getOps(
      collection: string,
      id: string,
      from: number,
      to: number,
      options: any,
      callback: (err: Error | null, ops?: any[]) => void
    ): void;
  }

  class ShareDB {
    static DB: typeof DB;
    constructor(options?: { db?: DB; presence?: boolean });
    connect(): any;
    listen(stream: any, req?: any): void;
    use(action: string, handler: (context: any, callback: any) => void): void;
  }

  export = ShareDB;
}

declare module 'sharedb/lib/client' {
  class Presence {
    subscribe(callback?: (err?: Error) => void): void;
    create(id?: string): LocalPresence;
    remotePresences: { [id: string]: any };
    on(event: 'receive', listener: (id: string, value: any) => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
  }

  class LocalPresence {
    submit(value: any, callback?: (err?: Error) => void): void;
    destroy(): void;
  }

  export class Connection {
    constructor(socket: any);
    get(collection: string, id: string): any;
    getPresence(channel: string): Presence;
    close(): void;
  }
}

declare module '@teamwork/websocket-json-stream' {
  import { WebSocket } from 'ws';
  class WebSocketJSONStream {
    constructor(ws: WebSocket);
  }
  export = WebSocketJSONStream;
}

declare module 'sharedb-string-binding' {
  export default class StringBinding {
    constructor(element: HTMLTextAreaElement, doc: any, path: string[]);
    setup(): void;
  }
}

declare module 'reconnecting-websocket' {
  export default class ReconnectingWebSocket {
    constructor(url: string, protocols?: string[], options?: any);
    addEventListener(event: string, listener: (event: any) => void): void;
    send(data: string): void;
  }
}
