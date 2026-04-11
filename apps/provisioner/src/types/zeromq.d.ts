declare module "zeromq" {
  interface Socket {
    connect(address: string): void;
    close(): void;
    subscribe(filter: string): void;
    on(event: "message", callback: (data: Buffer) => void): this;
    on(event: "error", callback: (error: Error) => void): this;
  }

  function socket(type: "sub" | "pub" | "req" | "rep" | "push" | "pull"): Socket;
}
