"use client";
import { useState, useEffect } from "react";
import { Mail, Key, ExternalLink, Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { getCredentials } from "@/lib/api";

export default function SandboxBanner() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; pass: string; loginUrl: string }>({
    email: "elrcpqw4wyg4hgio@ethereal.email",
    pass: "rTahX9dGwjm3Cse9PK",
    loginUrl: "https://ethereal.email/login"
  });

  useEffect(() => {
    let isMounted = true;
    getCredentials()
      .then((data) => {
        if (isMounted && data && data.email && data.pass) {
          setCredentials({
            email: data.email,
            pass: data.pass,
            loginUrl: data.loginUrl || "https://ethereal.email/login"
          });
        }
      })
      .catch((err) => {
        console.error("Could not fetch dynamic sandbox credentials:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="w-full mb-8 rounded-2xl bg-gradient-to-r from-accent/10 via-surface to-accent/5 border border-accent/20 p-5 shadow-card relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                Evaluator Sandbox
              </span>
              <span className="text-xs text-foreground-subtle font-mono">Live Ethereal SMTP</span>
            </div>
            <p className="text-sm text-foreground-muted max-w-2xl leading-relaxed">
              Sent emails are delivered to our sandbox inbox. Use these credentials to inspect live email payloads, headers, and delivery timestamps:
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Dynamic Email badge */}
          <button
            type="button"
            onClick={() => copyToClipboard(credentials.email, "Email")}
            className="group flex items-center gap-2 px-3.5 py-2 bg-background-base/80 hover:bg-surface border border-border-default hover:border-accent/40 rounded-lg text-xs font-mono transition-all text-foreground"
            title="Click to copy email"
          >
            <Mail className="w-3.5 h-3.5 text-accent" />
            <span className="text-foreground-muted group-hover:text-foreground transition-colors">
              {credentials.email}
            </span>
            {copiedField === "Email" ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-foreground-subtle group-hover:text-foreground transition-colors" />
            )}
          </button>

          {/* Dynamic Password badge */}
          <button
            type="button"
            onClick={() => copyToClipboard(credentials.pass, "Password")}
            className="group flex items-center gap-2 px-3.5 py-2 bg-background-base/80 hover:bg-surface border border-border-default hover:border-accent/40 rounded-lg text-xs font-mono transition-all text-foreground"
            title="Click to copy password"
          >
            <Key className="w-3.5 h-3.5 text-accent" />
            <span className="text-foreground-muted group-hover:text-foreground transition-colors">
              {credentials.pass}
            </span>
            {copiedField === "Password" ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-foreground-subtle group-hover:text-foreground transition-colors" />
            )}
          </button>


          {/* Direct Link */}
          <a
            href={credentials.loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-bright text-white rounded-lg text-xs font-medium transition-all shadow-button-primary"
          >
            <span>Open Ethereal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
