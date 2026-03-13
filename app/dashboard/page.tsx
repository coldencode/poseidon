import Spline from "@splinetool/react-spline";
import PoseDashboard from "./dashboard";
import styles from "./dashboard.module.css";

export default function Dashboard() {
  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
      }}
    >
      <div className={styles.dashboardBackground}>
        {/* Spline background */}
        <div
          style={{
            position:"fixed",
            width: "100%",
            height: "115%", // make taller than viewport
            marginBottom: "-15%", // push bottom (watermark) out of view
            transform: "scale(1.1)", // zoom in slightly to fill gaps
            transformOrigin: "top center",
          }}
        >
          <Spline scene="https://prod.spline.design/cfVPry73sZ2W998U/scene.splinecode" />
        </div>
        <div className={styles.splineOverlay} />

        <div style={{ position: "relative", zIndex: 10, marginBottom: "-10%"}}>
          <PoseDashboard />
        </div>
      </div>
    </main>
  );
}
