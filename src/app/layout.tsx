import type { ReactNode } from "react";

export const metadata = {
  title: "Kydos Connect",
  description: "Connect your website to any AI assistant.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "48px 24px", maxWidth: 720, marginInline: "auto", lineHeight: 1.6 }}>
        {children}
      </body>
    </html>
  );
}
