import { readdir } from "node:fs/promises";
import path from "node:path";
import PoseGalleryClient from "./PoseGalleryClient";

type Pose = {
  id: number;
  title: string;
  image: string;
};

const toTitle = (filename: string) =>
  filename
    .replace(/\.png$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getPoses = async (): Promise<Pose[]> => {
  const posesDirectory = path.join(process.cwd(), "public", "poses");
  const files = await readdir(posesDirectory);

  const pngFiles = files
    .filter((file) => /\.png$/i.test(file))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));

  return pngFiles.map((file, index) => ({
    id: index + 1,
    title: toTitle(file),
    image: `/poses/${file}`,
  }));
};

export default async function PosesPage() {
  const poses = await getPoses();

  return <PoseGalleryClient poses={poses} />;
}
