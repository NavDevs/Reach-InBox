import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/Provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "ReachInbox Scheduler",
  description: "Schedule your emails efficiently",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="text-foreground min-h-screen relative overflow-x-hidden selection:bg-accent/30 font-sans">
        {/* Background Layers */}
        <div className="fixed inset-0 z-[-1] pointer-events-none">
          {/* Layer 1: Base Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0a0a0f_0%,#050506_50%,#020203_100%)]" />
          
          {/* Layer 2: Grid Overlay */}
          <div className="absolute inset-0 bg-grid opacity-50" />
          
          {/* Layer 3: Animated Blobs */}
          <div className="absolute top-[-20%] left-[20%] w-[900px] h-[900px] bg-accent/10 rounded-full blur-[150px] animate-float" />
          <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[800px] bg-purple-500/10 rounded-full blur-[120px] animate-float-delayed" />
          <div className="absolute top-[30%] left-[-10%] w-[500px] h-[700px] bg-blue-500/10 rounded-full blur-[100px] animate-float-reverse" />
          
          {/* Layer 4: Noise Texture */}
          <div className="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay" />
        </div>

        <Provider>
            {children}
            <Toaster position="top-right" theme="dark" />
        </Provider>
      </body>
    </html>
  );
}
