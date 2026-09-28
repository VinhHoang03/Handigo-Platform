export async function withAgentTimeout<T>(operation: Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  if (combined.aborted) {
    void operation.catch(() => undefined);
    throw new Error("Đã vượt thời gian xử lý.");
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Đã vượt thời gian xử lý."));
    combined.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => combined.removeEventListener("abort", onAbort));
  });
}
