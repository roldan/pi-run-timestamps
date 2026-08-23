import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Loader } from "@earendil-works/pi-tui";

const PATCH_VERSION = 1;
const PATCH_VERSION_KEY = Symbol.for("pi-run-timestamps.loader-patch-version");

const loaderStartTimes = new WeakMap<object, number>();

type LoaderInternals = {
  frames: string[];
  currentFrame: number;
  renderIndicatorVerbatim: boolean;
  spinnerColorFn(text: string): string;
  message: string;
  messageColorFn(text: string): string;
  setText(text: string): void;
  ui: { requestRender(): void } | null;
};

type LoaderPrototype = {
  start?: () => void;
  stop?: () => void;
  updateDisplay?: () => void;
};

type PatchState = typeof globalThis & {
  [PATCH_VERSION_KEY]?: number;
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${remainingSeconds}s`;
}

function updateLoaderDisplay(loader: Loader): void {
  const internals = loader as unknown as LoaderInternals;
  const frame = internals.frames[internals.currentFrame] ?? "";
  let indicator = internals.spinnerColorFn(frame);
  if (internals.renderIndicatorVerbatim === true) indicator = frame;
  if (frame.length > 0) indicator += " ";

  const startedAt = loaderStartTimes.get(loader) ?? Date.now();
  loaderStartTimes.set(loader, startedAt);
  const elapsed = Math.floor(Math.max(0, Date.now() - startedAt) / 1000);
  const message = `${internals.message} (${formatElapsed(elapsed)})`;
  internals.setText(`${indicator}${internals.messageColorFn(message)}`);
  internals.ui?.requestRender();
}

function patchLoader(): void {
  const state = globalThis as PatchState;
  if ((state[PATCH_VERSION_KEY] ?? 0) >= PATCH_VERSION) return;

  const prototype = Loader.prototype as unknown as LoaderPrototype;
  const originalStart = prototype.start;
  const originalStop = prototype.stop;
  const originalUpdateDisplay = prototype.updateDisplay;

  if (
    typeof originalStart !== "function" ||
    typeof originalStop !== "function" ||
    typeof originalUpdateDisplay !== "function"
  ) {
    return;
  }

  prototype.start = function patchedStart(this: Loader): void {
    loaderStartTimes.set(this, Date.now());
    originalStart.call(this);
  };

  prototype.stop = function patchedStop(this: Loader): void {
    loaderStartTimes.delete(this);
    originalStop.call(this);
  };

  prototype.updateDisplay = function patchedUpdateDisplay(this: Loader): void {
    updateLoaderDisplay(this);
  };

  state[PATCH_VERSION_KEY] = PATCH_VERSION;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${seconds}s`;
}

export default function piRunTimestamps(pi: ExtensionAPI): void {
  patchLoader();

  let taskStartedAt: number | undefined;

  pi.on("agent_start", async () => {
    taskStartedAt ??= Date.now();
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "user" || event.message.timestamp === undefined) return;
    if (ctx.hasUI === true) {
      ctx.ui.notify(`Sent ${formatTime(event.message.timestamp)}`, "info");
    }
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const startedAt = taskStartedAt;
    taskStartedAt = undefined;
    if (startedAt === undefined || ctx.hasUI !== true) return;

    const endedAt = Date.now();
    ctx.ui.notify(
      `Done at ${formatTime(endedAt)} · ${formatDuration(endedAt - startedAt)}`,
      "info",
    );
  });

  pi.on("session_shutdown", async () => {
    taskStartedAt = undefined;
  });
}
