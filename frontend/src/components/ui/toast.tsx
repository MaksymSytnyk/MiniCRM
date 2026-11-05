import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
type Message = { id: number; text: string; type: "success" | "error" };
let sequence = 0;
function show(text: string, type: Message["type"]) {
  window.dispatchEvent(
    new CustomEvent("folio-toast", { detail: { id: ++sequence, text, type } }),
  );
}
export const toast = {
  success: (text: string) => show(text, "success"),
  error: (text: string) => show(text, "error"),
};
export function Toaster() {
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const listener = (event: Event) => {
      const message = (event as CustomEvent<Message>).detail;
      setMessages((items) => [...items.slice(-3), message]);
      const timer = setTimeout(() => {
        setMessages((items) => items.filter((m) => m.id !== message.id));
        timers.delete(timer);
      }, 6000);
      timers.add(timer);
    };
    window.addEventListener("folio-toast", listener);
    return () => {
      window.removeEventListener("folio-toast", listener);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`toast-message ${m.type}`}
          role={m.type === "error" ? "alert" : "status"}
        >
          {m.type === "success" ? (
            <CheckCircle2 size={17} />
          ) : (
            <AlertCircle size={17} />
          )}
          <span>{m.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() =>
              setMessages((items) => items.filter((i) => i.id !== m.id))
            }
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
