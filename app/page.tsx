import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-rose-50 px-4 py-6 text-slate-900">
      <main className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-sm flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
        <div>
          <p className="text-xs tracking-[0.24em] text-sky-600 uppercase">POSE COACHING APP</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Welcome to <span className="bg-gradient-to-r from-sky-500 to-fuchsia-500 bg-clip-text text-transparent">Poseidon</span>
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Learn better poses with guided practice and real-time feedback.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">Creator Mode</span>
            <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 font-medium text-fuchsia-700">Social Ready</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Email Sign Up
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-sky-300 transition focus:border-sky-300 focus:ring-2"
            />
            <button
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:opacity-95"
            >
              Get Started
            </button>
          </div>

          <Link
            href="/poses"
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
          >
            Continue as Guest
          </Link>
        </div>
      </main>
    </div>
  );
}
