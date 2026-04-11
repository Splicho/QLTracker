declare module "zeromq" {
  interface Socket {
    connect(address: string): void;
    close(): void;
    monitor(interval?: number, numOfEvents?: number): this;
    subscribe(filter: string): void;
    on(event: "message", callback: (data: Buffer) => void): this;
    on(event: "error", callback: (error: Error) => void): this;
    on(
      event:
        | "connect"
        | "connect_delay"
        | "connect_retry"
        | "disconnect",
      callback: (eventValue: unknown, endpoint?: string, error?: Error) => void,
    ): this;
    on(event: "monitor_error", callback: (error: Error) => void): this;
  }

  function socket(type: "sub" | "pub" | "req" | "rep" | "push" | "pull"): Socket;
}
