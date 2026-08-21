"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import EmailsTable from "@/components/EmailsTable";
import ComposeModal from "@/components/ComposeModal";
import SandboxBanner from "@/components/SandboxBanner";
import { PenSquare, Send, Clock, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0 });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-base">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl w-full z-10">
        <SandboxBanner />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">Campaigns</h1>
            <p className="text-foreground-muted">Manage your email sequences and monitor delivery.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Are you sure you want to wipe all emails and queues? This will reset the database.")) return;
                try {
                  const { api } = await import('@/lib/api');
                  const res = await api.delete("/api/wipe");
                  if (res.status === 200) {
                    toast.success("Database and queues wiped successfully! Refreshing...");
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    toast.error("Failed to wipe data.");
                  }
                } catch (e) {
                  toast.error("Error wiping data.");
                }
              }}
              className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg font-medium shadow-[0_2px_12px_rgba(239,68,68,0.05),inset_0_1px_0_0_rgba(255,255,255,0.02)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.15),inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all duration-300 active:scale-[0.98] overflow-hidden"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-red-500/10 to-transparent skew-x-[-20deg]" />
              <Trash2 className="w-4 h-4 relative z-10 transition-transform group-hover:scale-110" />
              <span className="relative z-10">Wipe Data</span>
            </button>
            
            <button 
              onClick={() => setIsComposeOpen(true)}
              className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium shadow-button-primary hover:bg-accent-bright transition-all duration-300 active:scale-[0.98] overflow-hidden"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]" />
              <PenSquare className="w-4 h-4 relative z-10" />
              <span className="relative z-10">New Sequence</span>
            </button>
          </div>
        </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
          <div className="flex items-center justify-between w-full relative z-0 mb-4">
            <div className="flex items-center gap-2 p-1 bg-surface border border-border-default rounded-xl w-fit">
              <button 
                className={`relative flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-colors duration-300 ${activeTab === "scheduled" ? "text-foreground" : "text-foreground-muted hover:text-foreground"}`}
                onClick={() => setActiveTab("scheduled")}
              >
                {activeTab === "scheduled" && (
                  <motion.div
                    layoutId="dashboard-tab"
                    className="absolute inset-0 bg-surface-hover border border-border-hover rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Clock className={`w-4 h-4 ${activeTab === "scheduled" ? "text-accent" : ""}`} />
                Scheduled
              </button>
              <button 
                className={`relative flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-colors duration-300 ${activeTab === "sent" ? "text-foreground" : "text-foreground-muted hover:text-foreground"}`}
                onClick={() => setActiveTab("sent")}
              >
                {activeTab === "sent" && (
                  <motion.div
                    layoutId="dashboard-tab"
                    className="absolute inset-0 bg-surface-hover border border-border-hover rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Send className={`w-4 h-4 ${activeTab === "sent" ? "text-accent" : ""}`} />
                Sent
              </button>
            </div>
            
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-semibold text-accent tracking-wide uppercase">
                {activeTab === "scheduled" ? `Processing Queue (${counts.scheduled})` : `Completed (${counts.sent})`}
              </span>
            </div>
          </div>
          
          <div className="w-full relative z-0">
            <EmailsTable 
              key={`${activeTab}-${refreshKey}`} 
              type={activeTab} 
              onCountUpdate={(count) => setCounts(prev => ({ ...prev, [activeTab]: count }))}
            />
          </div>
          </motion.div>
      </main>

      {isComposeOpen && (
        <ComposeModal 
          onClose={() => setIsComposeOpen(false)} 
          onSuccess={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
