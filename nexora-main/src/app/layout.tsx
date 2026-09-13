import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Nexora",
  description: "Votre intelligence financière — anticipez, sécurisez, pilotez et automatisez vos finances.",
  applicationName: "Nexora",
  appleWebApp: { capable: true, title: "Nexora", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/nexora-mark.png", apple: "/nexora-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className="app-html" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <Header />
          <div className="protected-app-shell">{children}</div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
