import Spline from "@splinetool/react-spline/next";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden font-sans">

      {/* Background image */}
      {/* <div className="absolute inset-0 -z-20 bg-cover bg-center" style={{ backgroundImage: "url('/background.jpg')" }} /> */}

      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.15),transparent)] -z-10" />

      {/* Centered rounded rectangle with drop shadow - matches poses/camera page background */}
      <div className="relative h-[812px] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-violet-50 via-white to-sky-50 shadow-2xl shadow-black/30">
        {/* Spline scene - full size */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
          <Spline scene="https://prod.spline.design/bDJOcNEVMiAlLDy1/scene.splinecode" />
        </div>
        {/* Dark overlay - above Spline, behind grid */}
        <div className="pointer-events-none absolute inset-0 z-[1] rounded-3xl bg-black/25" />
        {/* Grid overlay - above dark overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-[2] rounded-3xl opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.14) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Hero content - clean, readable (Granola-style) */}
        <div className="absolute left-1/2 top-1/2 z-10 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 px-2 sm:w-full">
          <div className="flex flex-col items-center rounded-2xl px-8 py-10 text-center sm:px-12 sm:py-12 md:px-16 md:py-14">
            {/* Slogan - pill-style, subtle */}
            <span className="inline-block rounded-full bg-white/30 px-4 py-1.5 text-sm font-medium text-white sm:text-base backdrop-blur-sm">
              Picture your <span className="font-semibold italic" style={{ fontFamily: "var(--font-dancing)" }}>best</span> self with...
            </span>

            {/* Title - dominant, clear hierarchy */}
            <h1
              className="mt-6 text-5xl font-extrabold leading-tight sm:mt-8 sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                fontFamily: "var(--font-nunito)",
                background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              }}
            >
              POSEIDON
            </h1>

            {/* Subtitle - supporting, readable */}
            <p className="mt-5 max-w-md text-base leading-relaxed text-white sm:mt-6 sm:text-lg" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              Your personal photo-taking coach that will detect your pose and provide{" "}
              <span className="font-semibold">real-time feedback</span>!
            </p>
          </div>
        </div>

        {/* Start button */}
        <Link
          href="/poses"
          className="absolute bottom-44 left-1/2 z-10 -translate-x-1/2 rounded-xl px-10 py-3 font-semibold text-white shadow-lg transition duration-200 ease-out hover:brightness-90 hover:scale-105"
          style={{ backgroundColor: "#93B5F4" }}
        >
          Start
        </Link>

        {/* Footer text */}
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center text-xs font-semibold text-black">
          UNIHACK 2026
        </div>
      </div>
    </div>
  );
}


