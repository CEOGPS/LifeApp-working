// Tiny promise timeout helper for Music Hub network calls.
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => { window.clearTimeout(t); resolve(v); },
      (e) => { window.clearTimeout(t); reject(e); },
    );
  });
}

export async function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await withTimeout(promise, ms);
  } catch {
    return null;
  }
}