"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getScheduledEmails, getSentEmails } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  type: "scheduled" | "sent";
  onCountUpdate?: (count: number) => void;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono tracking-widest bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        <Clock className="w-3 h-3" /> SCHEDULED
      </span>
    );
  }
  if (status === "sending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Loader2 className="w-3 h-3 animate-spin" /> SENDING
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-3 h-3" /> SENT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-3 h-3" /> FAILED
    </span>
  );
}

export default function EmailsTable({ type, onCountUpdate }: Props) {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const prevEmailsJsonRef = useRef<string>("");

  useEffect(() => {
    if (session?.user?.email) {
      fetchEmails(true);
    }
    const interval = setInterval(() => {
      if (session?.user?.email) fetchEmails(false);
    }, 1500);
    return () => clearInterval(interval);
  }, [type, session?.user?.email]);

  const fetchEmails = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const userEmail = session?.user?.email || undefined;
      const data = type === "scheduled" ? await getScheduledEmails(userEmail) : await getSentEmails(userEmail);
      const filtered = (data || []).filter((email: any) => 
        type === "scheduled" 
          ? email.status === "scheduled" || email.status === "sending"
          : email.status === "sent" || email.status === "failed"
      );

      // Fast shallow check before updating state to avoid UI lag/re-rendering
      const jsonStr = JSON.stringify(filtered.map((e: any) => `${e.id}-${e.status}-${e.sent_at}`));
      if (jsonStr !== prevEmailsJsonRef.current) {
        prevEmailsJsonRef.current = jsonStr;
        setEmails(filtered);
      }
      
      // Always update count even if json string hasn't changed structure
      if (onCountUpdate) {
        onCountUpdate(filtered.length);
      }
      
      setError("");
    } catch (err) {
      console.error(err);
      const errMsg = "Failed to fetch emails. Backend might not be running.";
      setError(errMsg);
      if (isInitial) toast.error(errMsg);
      setEmails([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Memoized sorted list
  const sortedEmails = useMemo(() => {
    return [...emails].sort((a: any, b: any) => {
      const timeA = a.sent_at ? new Date(a.sent_at).getTime() : new Date(a.scheduled_at).getTime();
      const timeB = b.sent_at ? new Date(b.sent_at).getTime() : new Date(b.scheduled_at).getTime();
      return type === "sent" ? timeB - timeA : timeA - timeB;
    });
  }, [emails, type]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedEmails.length / pageSize));
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEmails.slice(start, start + pageSize);
  }, [sortedEmails, currentPage, pageSize]);

  // Adjust page if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  if (loading) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-surface border border-border-default rounded-xl">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 border border-red-500/30 bg-red-500/5 text-red-400 rounded-xl text-sm flex items-center gap-3">
        <XCircle className="w-5 h-5 text-red-500" />
        {error}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="w-full h-48 flex flex-col items-center justify-center bg-surface border border-border-default rounded-xl text-foreground-muted gap-3">
        {type === "sent" ? <CheckCircle2 className="w-8 h-8 opacity-20" /> : <Clock className="w-8 h-8 opacity-20" />}
        <p className="text-sm">No {type} emails yet.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full rounded-2xl overflow-hidden bg-glass-gradient border border-border-default shadow-card relative"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface/50 border-b border-border-default text-left text-xs uppercase tracking-wider text-foreground-muted">
            <tr>
              <th className="px-6 py-4 font-medium w-16">Sl No</th>
              <th className="px-6 py-4 font-medium">Subject</th>
              <th className="px-6 py-4 font-medium">Recipient</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">{type === "sent" ? "Sent At" : "Scheduled At"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default/50">
            {paginatedEmails.map((email: any, idx: number) => {
              const globalIndex = (currentPage - 1) * pageSize + idx + 1;
              const isDelayed = type === "scheduled" && new Date(email.scheduled_at).getTime() > Date.now() + 60000;

              return (
                <tr 
                  key={email.id}
                  className={`transition-colors duration-150 group relative ${
                    isDelayed ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-surface-hover'
                  }`}
                >
                  <td className="px-6 py-3.5 font-medium text-foreground-muted">
                    {globalIndex}
                  </td>
                  <td className="px-6 py-3.5 font-medium text-foreground max-w-[220px] truncate group-hover:text-white transition-colors">
                    {email.subject}
                  </td>
                  <td className="px-6 py-3.5 text-foreground-subtle group-hover:text-foreground-muted transition-colors">
                    {email.recipient || "—"}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={email.status} />
                  </td>
                  <td className="px-6 py-3.5 text-foreground-subtle whitespace-nowrap font-mono text-xs group-hover:text-foreground-muted transition-colors">
                    <div className="flex flex-col">
                      <span>
                        {email.sent_at
                          ? new Date(email.sent_at).toLocaleString()
                          : email.scheduled_at
                          ? new Date(email.scheduled_at).toLocaleString()
                          : "—"}
                      </span>
                      {isDelayed && (
                        <span className="text-[10px] text-amber-500/80 font-semibold mt-0.5 tracking-wider uppercase">
                          Rate Limited (Delayed)
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Optimized Bottom Pagination & Counter Bar */}
      <div className="px-6 py-3.5 text-xs text-foreground-subtle border-t border-border-default bg-background-base flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-foreground font-mono">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-foreground font-mono">{Math.min(currentPage * pageSize, sortedEmails.length)}</strong> of <strong className="text-foreground font-mono">{sortedEmails.length}</strong> emails
          </span>
          <span className="hidden sm:inline text-border-default">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-foreground-muted">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-surface border border-border-default rounded px-2 py-0.5 text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-refresh 1.5s
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded bg-surface hover:bg-surface-hover border border-border-default text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-foreground text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded bg-surface hover:bg-surface-hover border border-border-default text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
