import type { Metadata } from "next";
import LocalizePage from "./LocalizeClient";

export const metadata: Metadata = {
  title: "Localize — LunarSync",
  description: "Upload a lunar image and get geographic coordinates via CNN+SIFT matching with outlier rejection.",
};

export default function Page() {
  return <LocalizePage />;
}
