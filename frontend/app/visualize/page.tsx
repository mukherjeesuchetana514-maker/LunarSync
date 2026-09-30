import type { Metadata } from "next";
import VisualizePage from "./VisualizeClient";

export const metadata: Metadata = {
  title: "Visualize — LunarSync",
  description: "Point-to-point matching visualization with outlier rejection and top matches table.",
};

export default function Page() {
  return <VisualizePage />;
}
