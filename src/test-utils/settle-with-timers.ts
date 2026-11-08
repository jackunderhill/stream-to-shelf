/** Wait for a promise that depends on fake timers, running them until it settles */
export async function settleWithTimers<T>(promise: Promise<T>): Promise<T> {
  let settled = false;
  const markSettled = () => { settled = true; };
  promise.then(markSettled, markSettled);

  while (!settled) {
    await jest.advanceTimersByTimeAsync(500);
  }
  return promise;
}
