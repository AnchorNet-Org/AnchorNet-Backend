import { createShutdownHandler } from "./shutdown";

type CloseCallback = (err?: Error) => void;

function makeServer(closeImpl: (cb: CloseCallback) => void) {
  return { close: jest.fn(closeImpl) };
}

describe("createShutdownHandler", () => {
  it("closes the server and exits 0 on a clean close", () => {
    const server = makeServer((cb) => cb());
    const exit = jest.fn();
    const handler = createShutdownHandler(server, { exit });

    handler("SIGTERM");

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits 1 when the server reports a close error", () => {
    const server = makeServer((cb) => cb(new Error("boom")));
    const exit = jest.fn();
    const handler = createShutdownHandler(server, { exit });

    handler("SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("invokes onShutdown exactly once and ignores a repeated signal", () => {
    const server = makeServer(() => {
      /* never calls back, simulating an in-flight close */
    });
    const exit = jest.fn();
    const onShutdown = jest.fn();
    const handler = createShutdownHandler(server, { exit, onShutdown });

    handler("SIGTERM");
    handler("SIGINT");

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(onShutdown).toHaveBeenCalledWith("SIGTERM");
  });

  it("forces an exit if the server does not close before the timeout", () => {
    jest.useFakeTimers();
    const server = makeServer(() => {
      /* hang forever */
    });
    const exit = jest.fn();
    const handler = createShutdownHandler(server, { exit, timeoutMs: 50 });

    handler("SIGTERM");
    jest.advanceTimersByTime(50);

    expect(exit).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });

  it("clears the forceExit timer even if the shutdown callback throws", () => {
    jest.useFakeTimers();
    // Simulate server.close callback that throws
    const server = {
      close: (cb: CloseCallback) => {
        cb(); // Callback executes
      }
    };
    
    // We want exit to throw, interrupting the callback flow.
    const exit = jest.fn(() => {
        throw new Error("exit failed");
    });
    
    // Create handler. Timeout is 100ms.
    const handler = createShutdownHandler(server, { exit, timeoutMs: 100 });

    // This should trigger server.close callback -> exit -> throws
    expect(() => handler("SIGTERM")).toThrow("exit failed");

    // Advance time. Since the error was caught and finally was run,
    // the forceExit timer should have been cleared.
    jest.advanceTimersByTime(100);

    // exit should have been called EXACTLY once (the one that threw)
    expect(exit).toHaveBeenCalledTimes(1);
    
    // If it WASN'T cleared, forceExit would have fired exit(1) again
    // after the timers advanced, making total calls = 2.
    // So verifying it is 1 means it was cleared.
    expect(exit).toHaveBeenCalledTimes(1);
    
    jest.useRealTimers();
  });
});
