import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Urgentic",
    short_name: "Urgentic",
    description: "Discreet safety communication when you need it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1a2332",
    theme_color: "#1a2332",
  };
}
