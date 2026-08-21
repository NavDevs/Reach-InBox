"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import { scheduleEmails } from "@/lib/api";
import { toast } from "sonner";
import { X, Upload, Calendar, Clock, Send, Users, Activity, ChevronDown, Loader2 } from "lucide-react";

/**
 * Generates smart rate-limit dropdown options based on total recipient count.
 * - For small counts (≤ 10): returns every integer from 1 to count.
 * - For larger counts (> 10): returns meaningful fractions (count/10, count/5,
 *   count/4, count/2) plus the total count itself. All values are deduplicated,
 *   filtered to be ≥ 1, and sorted ascending.
 */
function generateRateLimitOptions(count: number): number[] {
  if (count <= 0) return [];

  if (count <= 10) {
    // For small counts, offer every integer from 1 to count
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  // For larger counts, generate meaningful fractions
  const rawOptions = new Set<number>();
  rawOptions.add(Math.floor(count / 10));  // 10%
  rawOptions.add(Math.floor(count / 5));   // 20%
  rawOptions.add(Math.floor(count / 4));   // 25%
  rawOptions.add(Math.floor(count / 2));   // 50%
  rawOptions.add(count);                    // 100%

  // Filter out zeros, deduplicate, and sort ascending
  return Array.from(rawOptions)
    .filter((v) => v >= 1)
    .sort((a, b) => a - b);
}

export default function ComposeModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { data: session } = useSession();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delay, setDelay] = useState(1);
  const [hourlyLimit, setHourlyLimit] = useState(0);
  
  const [csvData, setCsvData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Dynamically compute dropdown options whenever the CSV count changes
  const rateLimitOptions = useMemo(
    () => generateRateLimitOptions(csvData.length),
    [csvData.length]
  );

  // Auto-select the largest option (= total count) whenever options change
  useEffect(() => {
    if (rateLimitOptions.length > 0) {
      setHourlyLimit(rateLimitOptions[rateLimitOptions.length - 1]);
    } else {
      setHourlyLimit(0);
    }
  }, [rateLimitOptions]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
           toast.error("Some rows could not be parsed.");
        }
        if (results.data.length > 0) {
           setCsvData(results.data);
           toast.success(`Successfully parsed ${results.data.length} recipients`);
        } else {
           toast.error("CSV file is empty or invalid format.");
        }
      },
      error: (error: any) => {
        toast.error("Failed to parse CSV");
        console.error(error);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !body || csvData.length === 0) {
      toast.error("Please fill all required fields and upload a valid CSV");
      return;
    }

    setIsUploading(true);
    try {
      await scheduleEmails({
        subject,
        body,
        recipients: csvData,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delay,
        hourlyLimit,
        userEmail: session?.user?.email || ''
      });
      toast.success("Emails scheduled successfully!");
      onSuccess();
      handleClose();
    } catch (err) {
      toast.error("Failed to schedule emails. Ensure backend is running.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const InputLabel = ({ children, icon: Icon }: { children: React.ReactNode, icon?: any }) => (
    <label className="flex items-center gap-2 text-xs font-mono tracking-widest text-foreground-muted mb-2 uppercase">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </label>
  );

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-[#050506]/80 backdrop-blur-sm" onClick={handleClose} />
      
      <div 
        className={`relative w-full max-w-2xl bg-background-elevated rounded-2xl shadow-card border border-border-default overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-default bg-transparent">
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-accent" />
            New Sequence
          </h2>
          <button 
            onClick={handleClose} 
            disabled={isUploading}
            className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {isUploading ? (
          <div className="p-6 flex flex-col items-center justify-center min-h-[400px] flex-1 animate-in fade-in zoom-in-95 duration-500">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full animate-pulse" />
                <Loader2 className="w-12 h-12 text-accent animate-spin relative z-10" />
             </div>
             <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">Queueing Sequence...</h3>
             <p className="text-sm text-foreground-muted text-center max-w-[280px]">
               Securely processing your data and scheduling {csvData.length} recipients for delivery.
             </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 scrollbar-thin">
            <div>
              <InputLabel>Subject</InputLabel>
              <input 
                type="text" 
                required
                placeholder="e.g. Quick question about {company}"
                className="w-full px-4 py-2.5 bg-[#0F0F12] border border-white/10 rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div>
              <InputLabel>Email Body</InputLabel>
              <textarea 
                required
                rows={5}
                placeholder="Hi {first_name}, I noticed that..."
                className="w-full px-4 py-3 bg-[#0F0F12] border border-white/10 rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 resize-y min-h-[120px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="p-5 rounded-xl border border-border-default bg-transparent flex flex-col gap-5">
              <div>
                <InputLabel icon={Users}>Recipients (CSV)</InputLabel>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`w-full px-4 py-4 border-2 border-dashed ${csvData.length > 0 ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-[#0F0F12] hover:bg-surface-hover hover:border-accent/50'} rounded-lg flex flex-col items-center justify-center gap-2 transition-all duration-300 group`}>
                    {csvData.length > 0 ? (
                      <>
                        <Users className="w-6 h-6 text-green-400" />
                        <span className="text-sm font-medium text-green-400">{csvData.length} recipients loaded</span>
                        <span className="text-xs text-foreground-subtle">Click to replace file</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-foreground-muted" />
                        <span className="text-sm font-medium text-foreground">Click to upload CSV</span>
                        <span className="text-xs text-foreground-subtle">Must include email column</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                 <div>
                  <InputLabel icon={Calendar}>Start Time</InputLabel>
                  <input 
                    type="datetime-local" 
                    className="w-full px-4 py-2.5 bg-[#0F0F12] border border-white/10 rounded-lg text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 [color-scheme:dark]"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <p className="text-[10px] text-foreground-subtle mt-1.5">Leave blank to start immediately</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <InputLabel icon={Clock}>Delay (s)</InputLabel>
                    <input 
                      type="number" 
                      min="1"
                      required
                      className="w-full px-4 py-2.5 bg-[#0F0F12] border border-white/10 rounded-lg text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                      value={delay}
                      onChange={(e) => setDelay(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <InputLabel icon={Activity}>Max / hr</InputLabel>
                    <div className="relative">
                      <select 
                        required
                        disabled={csvData.length === 0}
                        className="w-full px-4 py-2.5 bg-[#0F0F12] border border-white/10 rounded-lg text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200 appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        value={hourlyLimit}
                        onChange={(e) => setHourlyLimit(Number(e.target.value))}
                      >
                        {csvData.length === 0 ? (
                          <option value={0}>Upload CSV</option>
                        ) : (
                          rateLimitOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))
                        )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button" 
                onClick={handleClose}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-surface border border-transparent hover:border-border-default transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isUploading || csvData.length === 0}
                className="group relative overflow-hidden px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium shadow-button-primary hover:bg-accent-bright transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] pointer-events-none" />
                <Send className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Schedule Sequence</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
