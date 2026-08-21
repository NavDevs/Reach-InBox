"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SandboxBanner from "@/components/SandboxBanner";
import { getAllEmails } from "@/lib/api";
import { CheckCircle2, Clock, XCircle, Loader2, Inbox, Search, Filter, Hash, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const prevEmailsJsonRef = useRef<string>("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetchAll(true);
      const interval = setInterval(() => fetchAll(false), 1500);
      return () => clearInterval(interval);
    }
  }, [status, session?.user?.email]);

  const fetchAll = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const userEmail = session?.user?.email || undefined;
      const data = await getAllEmails(userEmail);
      const list = data || [];
      const jsonStr = JSON.stringify(list.map((e: any) => `${e.id}-${e.status}-${e.sent_at}`));
      if (jsonStr !== prevEmailsJsonRef.current) {
        prevEmailsJsonRef.current = jsonStr;
        setEmails(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return emails.filter(e => {
      const matchesStatus = filter === "all" || e.status === filter;
      const matchesSearch = search === "" ||
        e.subject?.toLowerCase().includes(search.toLowerCase()) ||
        e.recipient?.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [emails, filter, search]);

  const counts = useMemo(() => ({
    all: emails.length,
    scheduled: emails.filter(e => e.status === "scheduled").length,
    sent: emails.filter(e => e.status === "sent").length,
    failed: emails.filter(e => e.status === "failed").length,
  }), [emails]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-base">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
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
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">Email History</h1>
            <p className="text-foreground-muted">Complete log of all scheduled, sent, and failed emails.</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-foreground-subtle font-mono border border-border-default bg-surface px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            LIVE SYNC
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Emails", key: "all" as const, color: "text-foreground", icon: Inbox },
            { label: "Scheduled", key: "scheduled" as const, color: "text-yellow-500", icon: Clock },
            { label: "Sent", key: "sent" as const, color: "text-green-400", icon: CheckCircle2 },
            { label: "Failed", key: "failed" as const, color: "text-red-400", icon: XCircle },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div 
                key={s.key} 
                className="bg-glass-gradient border border-border-default rounded-2xl p-6 shadow-card flex flex-col justify-between h-32 relative overflow-hidden group hover:border-border-hover transition-all duration-200"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex justify-between items-start relative z-10">
                  <p className="text-xs font-mono tracking-widest text-foreground-muted uppercase group-hover:text-foreground-subtle transition-colors">{s.label}</p>
                  <Icon className={`w-4 h-4 ${s.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </div>
                <p className={`text-4xl font-semibold tracking-tight ${s.color} relative z-10`}>{counts[s.key]}</p>
              </div>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search by subject or recipient..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-3 bg-[#0F0F12] border border-border-default rounded-xl text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <select
              value={filter}
              onChange={e => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-10 py-3 bg-[#0F0F12] border border-border-default rounded-xl text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
              ▼
            </div>
          </div>
        </div>

        {/* Optimized Table */}
        <div className="w-full rounded-2xl overflow-hidden bg-glass-gradient border border-border-default shadow-card relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
          
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-foreground-muted gap-3">
              <Inbox className="w-8 h-8 opacity-20" />
              <p className="text-sm">No emails found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground-muted bg-background-elevated border-b border-border-default uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 font-medium w-16"><Hash className="w-3 h-3" /></th>
                      <th className="px-6 py-4 font-medium">Subject</th>
                      <th className="px-6 py-4 font-medium">Recipient</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Scheduled</th>
                      <th className="px-6 py-4 font-medium">Sent At</th>
                      <th className="px-6 py-4 font-medium text-center">Att</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50">
                    {paginatedList.map((email: any, i: number) => (
                      <tr 
                        key={email.id || i} 
                        className="hover:bg-surface-hover transition-colors duration-150 group"
                      >
                        <td className="px-6 py-3.5 text-foreground-subtle font-mono text-xs group-hover:text-foreground-muted transition-colors">
                          {(currentPage - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-foreground max-w-[200px] truncate group-hover:text-white transition-colors">
                          {email.subject}
                        </td>
                        <td className="px-6 py-3.5 text-foreground-subtle group-hover:text-foreground-muted transition-colors">
                          {email.recipient}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusBadge status={email.status} />
                        </td>
                        <td className="px-6 py-3.5 text-foreground-subtle whitespace-nowrap font-mono text-xs group-hover:text-foreground-muted transition-colors">
                          {email.scheduled_at ? new Date(email.scheduled_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-foreground-subtle whitespace-nowrap font-mono text-xs group-hover:text-foreground-muted transition-colors">
                          {email.sent_at ? new Date(email.sent_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-foreground-subtle text-center font-mono text-xs group-hover:text-foreground-muted transition-colors">
                          {email.attempts ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar */}
              <div className="px-6 py-3.5 text-xs text-foreground-subtle border-t border-border-default bg-background-base flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span>
                    Showing <strong className="text-foreground font-mono">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-foreground font-mono">{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong className="text-foreground font-mono">{filtered.length}</strong> emails
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
