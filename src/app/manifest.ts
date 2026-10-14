import type { MetadataRoute } from "next";

// The installable app is for hosts. Viewers, participants
// and sponsors use plain web pages and are never asked to install.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/studio",
    name: "StreetPlay",
    short_name: "StreetPlay",
    description: "Run street games, pay winners on camera, and let your Live audience play along.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fdc52d",
    theme_color: "#131211",
    categories: ["entertainment", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New episode", url: "/studio/episodes/new" },
      { name: "Wallet", url: "/studio/wallet" },
      { name: "Fund wallet", url: "/studio/wallet/fund" },
    ],
  };
}
