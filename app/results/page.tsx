import Results from "./results";

import pose1 from "../../public/pose-library/pose1.json";
import pose2 from "../../public/pose-library/pose2.json";

import photo1 from "../../public/pose-library/pose1.png";
import photo2 from "../../public/pose-library/pose2.png";

export default function ResultsPage() {
  return (
    <>
    <Results
      pose={pose1}
      referencePose={pose2}
      photo={photo1}
      referencePhoto={photo2}
    />
    </>
  );
}
