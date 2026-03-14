import Spline from '@splinetool/react-spline/next';
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-slate-950 font-sans md:overflow-hidden">
      {/* Video background - darkened and blurred */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm"
      >
        <source src="/ocean.mp4" type="video/mp4" />
      </video>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-slate-950/60" />
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.15),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415512_1px,transparent_1px),linear-gradient(to_bottom,#33415512_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      {/* Spline container - mobile: scrollable to see full scene, desktop: original */}
      <div
        className="fixed left-0 right-0 top-0 w-full overflow-x-auto overflow-y-hidden md:overflow-hidden"
        style={{ height: "90%", marginBottom: "-15%", transformOrigin: "top center" }}
      >
        <div className="flex h-full min-w-full justify-center md:min-w-0 md:overflow-hidden">
          <div className="h-full min-w-[150vw] shrink-0 scale-[0.55] translate-x-[10%] md:min-w-0 md:shrink md:scale-110 md:translate-x-[120px] md:w-full">
            <Spline scene="https://prod.spline.design/qMRygh2Rcm1RQVZD/scene.splinecode" />
          </div>
        </div>
        <Link
          href="/poses"
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-xl px-10 py-3 font-semibold text-white shadow-lg transition hover:brightness-90"
          style={{ backgroundColor: "#93B5F4" }}
        >
          Start
        </Link>
      </div>
    </div>
  );
}

