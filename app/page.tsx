import Spline from '@splinetool/react-spline/next';
import Link from "next/link";
export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 font-sans">
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
      {/* Spline container */}
      <div
        style={{
          position:"fixed",
          width: "100%",
          height: "90%",
          marginBottom: "-15%",
          transform: "scale(1.1) translateX(120px)",
          transformOrigin: "top center",
        }}
      >
        <Spline scene="https://prod.spline.design/qMRygh2Rcm1RQVZD/scene.splinecode" />
        {/* Button near bottom of Spline */}
        <Link
          href="/pose"
          className="absolute bottom-16 left-[42%] -translate-x-1/2 z-10 rounded-xl px-10 py-3 text-white font-semibold shadow-lg hover:brightness-90 transition"
          style={{ backgroundColor: "#93B5F4" }}
        >
          Start
        </Link>
      </div>
    </div>
  );
}