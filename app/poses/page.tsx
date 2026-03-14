import { readdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PoseGalleryClient from "./PoseGalleryClient";

type Pose = {
  id: string;
  title: string;
  image: string;
};

const toTitle = (filename: string) =>
  filename
    .replace(/\.png$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getPoses = async (): Promise<Pose[]> => {
  const poseLibraryDirectory = path.join(process.cwd(), "public", "pose-library");
  const files = await readdir(poseLibraryDirectory);

  const jsonFiles = files
    .filter((file) => /\.json$/i.test(file))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));

  const poses: Pose[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(poseLibraryDirectory, file);
    const fileContent = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(fileContent) as { pose?: string };
    const poseId = file.replace(/\.json$/i, "");

    poses.push({
      id: poseId,
      title: toTitle(poseId),
      image: `/pose-library/${parsed.pose ?? `${poseId}.png`}`,
    });
  }

  return poses;
};

export default async function PosesPage() {
  const poses = await getPoses();

  return <PoseGalleryClient poses={poses} />;
}
