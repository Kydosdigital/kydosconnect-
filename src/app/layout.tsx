import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: { default: "Kydos Connect", template: "%s | Kydos Connect" },
  description: "Connect your website to Claude, ChatGPT and other AI assistants.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
