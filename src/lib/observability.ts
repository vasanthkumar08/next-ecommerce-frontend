type Tags = Record<string, string | number | boolean | null | undefined>;

type BrowserSentry = {
  captureException?: (error: unknown, context?: unknown) => void;
  captureMessage?: (message: string, context?: unknown) => void;
};

const getSentry = (): BrowserSentry | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Sentry?: BrowserSentry }).Sentry;
};

export const captureFrontendException = (
  error: unknown,
  tags: Tags = {}
): void => {
  getSentry()?.captureException?.(error, { tags });

  if (process.env.NODE_ENV !== "production") {
    console.warn("frontend_exception", { error, tags });
  }
};

export const captureFrontendMessage = (
  message: string,
  tags: Tags = {}
): void => {
  getSentry()?.captureMessage?.(message, { tags });

  if (process.env.NODE_ENV !== "production") {
    console.info("frontend_event", { message, tags });
  }
};

