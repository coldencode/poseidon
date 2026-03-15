import fs from "fs/promises";
import path from "path";
import Results from "./results";

export default async function ResultsPage() {
  const pose1Path = path.join(process.cwd(), "public/pose-library/ankle_hurt_pose.json");
  const pose2Path = path.join(process.cwd(), "public/pose-library/baddie_pose.json");

  const [pose1, pose2] = await Promise.all([
    fs.readFile(pose1Path, "utf8").then((csv) => JSON.parse(csv)),
    fs.readFile(pose2Path, "utf8").then((csv) => JSON.parse(csv)),
  ]);

  const photo1 = "/pose-library/ankle_hurt_pose.png";
  const photo2 = "/pose-library/baddie_pose.png";

  return (
    <>
      <Results
        pose={pose2}
        referencePose={pose1}
        photo={photo2}
        referencePhoto={photo1}
      />
    </>
  );
}
