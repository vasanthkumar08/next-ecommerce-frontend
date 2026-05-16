export const perfEnabled =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production";

type PerfDetail = Record<string, string | number | boolean | null | undefined>;

export function markPerf(name: string, detail: PerfDetail = {}) {
  if (!perfEnabled) return;

  performance.mark(name);
  console.info("frontend_perf", {
    event: "mark",
    name,
    at: Math.round(performance.now()),
    ...detail,
  });
}

export function measurePerf(
  name: string,
  startMark: string,
  endMark: string,
  detail: PerfDetail = {}
) {
  if (!perfEnabled) return;

  try {
    performance.measure(name, startMark, endMark);
    const entries = performance.getEntriesByName(name);
    const latest = entries.at(-1);

    console.info("frontend_perf", {
      event: "measure",
      name,
      durationMs: latest ? Math.round(latest.duration) : null,
      ...detail,
    });
  } catch {
    console.info("frontend_perf", {
      event: "measure_failed",
      name,
      ...detail,
    });
  }
}

export function countRender(name: string, detail: PerfDetail = {}) {
  if (!perfEnabled) return;

  const key = `__render_count_${name}`;
  const windowWithCounters = window as typeof window & Record<string, number>;
  windowWithCounters[key] = (windowWithCounters[key] ?? 0) + 1;

  console.info("frontend_render", {
    component: name,
    count: windowWithCounters[key],
    at: Math.round(performance.now()),
    ...detail,
  });
}
