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
        {/* Grid overlay - background */}
        <div
          className="absolute inset-0 z-0 rounded-3xl opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />
        {/* Spline scene - full size */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
          <Spline scene="https://prod.spline.design/bDJOcNEVMiAlLDy1/scene.splinecode" />
        </div>

        {/* Title - viewfinder-style backdrop */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {/* Viewfinder frame with corner brackets - smaller on mobile */}
          <div
            className="relative rounded-sm px-5 py-4 text-center backdrop-blur-md md:px-10 md:py-8"
            style={{
              backgroundColor: "rgba(0,0,0,0.4)",
              border: "2px solid rgba(255,255,255,0.25)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.3), 0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            {/* Traffic light buttons - decorative */}
            <div className="pointer-events-none absolute right-3 top-3 flex gap-1.5 md:right-4 md:top-4 md:gap-2">
              <div className="h-2 w-2 rounded-full bg-[#ff5f57] md:h-2.5 md:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-[#febc2e] md:h-2.5 md:w-2.5" />
              <div className="h-2 w-2 rounded-full bg-[#28c840] md:h-2.5 md:w-2.5" />
            </div>
            {/* Corner brackets - viewfinder style */}
            <div className="pointer-events-none absolute -left-1 -top-1 h-4 w-4 border-l-2 border-t-2 border-white/60 md:h-6 md:w-6" />
            <div className="pointer-events-none absolute -right-1 -top-1 h-4 w-4 border-r-2 border-t-2 border-white/60 md:h-6 md:w-6" />
            <div className="pointer-events-none absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-white/60 md:h-6 md:w-6" />
            <div className="pointer-events-none absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-white/60 md:h-6 md:w-6" />
            <h1
              className="text-2xl font-extrabold tracking-[0.2em] text-white md:text-5xl md:tracking-[0.4em] lg:text-6xl"
              style={{
                textIndent: "0.1em",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
              }}
            >
              POSEIDON
            </h1>
            <p className="mt-1 text-xs font-medium tracking-widest text-white/95 md:mt-2 md:text-sm" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>Pose perfect</p>
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
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center text-xs font-semibold text-[#93B5F4]">
          UNIHACK 2026
        </div>
      </div>
    </div>
  );
}


