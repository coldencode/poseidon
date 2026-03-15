"use client";

type LiveAIOutputProps = {
  text: string | null;
  visible: boolean;
  fading: boolean;
};

export default function LiveAIOutput({ text, visible, fading }: LiveAIOutputProps) {
  if (!text) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none mx-auto w-[min(92%,900px)] rounded-2xl bg-slate-950/86 px-6 py-4 text-center text-xl font-semibold leading-tight text-white shadow-lg transition-opacity duration-700 sm:text-2xl ${
        visible ? (fading ? "opacity-25" : "opacity-100") : "opacity-0"
      }`}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {text}
    </div>
  );
}
