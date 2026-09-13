import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXORA",
    short_name: "NEXORA",
    description: "Pilotage personnel des finances et assistant LIA.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [{ src: "/nexora-mark.png", sizes: "455x415", type: "image/png", purpose: "any" }],
  };
}
