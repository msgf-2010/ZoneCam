export function watchConnection(onConnected: () => void) {
  const notify = () => {
    if (navigator.onLine) onConnected();
  };
  window.addEventListener("online", notify);
  return () => window.removeEventListener("online", notify);
}
