import Spline from "@splinetool/react-spline/next";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden font-sans">

      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm -z-20"
      >
        <source src="/ocean.mp4" type="video/mp4" />
      </video>

      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.15),transparent)] -z-10" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415512_1px,transparent_1px),linear-gradient(to_bottom,#33415512_1px,transparent_1px)] bg-[size:4rem_4rem] -z-10" />

      {/* Spline scene */}
      <div className="absolute inset-0 z-0">
        <Spline scene="https://prod.spline.design/bDJOcNEVMiAlLDy1/scene.splinecode" />
      </div>

      {/* Title */}
      <div className="absolute bottom-44 left-1/2 z-10 -translate-x-1/2 text-center drop-shadow-lg">
        <h1
          className="text-5xl font-black tracking-[0.35em] bg-gradient-to-r from-sky-400 via-indigo-400 to-blue-600 bg-clip-text text-transparent md:text-7xl"
          style={{
            textShadow: "0 4px 12px rgba(0,0,0,0.25)",
            backgroundImage:
              "linear-gradient(150deg,#7fdbff,#93B5F4,#3b82f6,#1d4ed8)",
          }}
        >
          POSEIDON
        </h1>
      </div>

      {/* Start button */}
      <Link
        href="/poses"
        className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-xl px-10 py-3 font-semibold text-white shadow-lg transition duration-200 ease-out hover:brightness-90 hover:scale-105"
        style={{ backgroundColor: "#93B5F4" }}
      >
        Start
      </Link>

      {/* Footer text */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-center text-xs font-semibold text-[#93B5F4]">
        UNIHACK 2026
      </div>
    </div>
  );
}


