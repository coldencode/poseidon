import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415512_1px,transparent_1px),linear-gradient(to_bottom,#33415512_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <span className="mb-8 text-sm font-medium tracking-[0.3em] text-cyan-400/80 uppercase">
          UNIHACK 2026
        </span>
        <h1 className="max-w-2xl text-center text-5xl font-bold tracking-tight text-white sm:text-7xl">
          Get Started with{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
            Poseidon
          </span>
        </h1>
        <div className="mt-12 flex gap-3">
          <div className="h-1 w-12 rounded-full bg-cyan-500/60" />
          <div className="h-1 w-8 rounded-full bg-blue-500/40" />
          <div className="h-1 w-16 rounded-full bg-indigo-500/50" />
        </div>
      </main>
    </div>
  );
}
