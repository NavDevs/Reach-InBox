"use client";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navLink = (href: string, label: string, Icon: any) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`relative flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-300 ${
          isActive
            ? "text-foreground"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="header-active-tab"
            className="absolute inset-0 bg-surface-hover border border-border-hover rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : ''}`} />
          {label}
        </span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-border-default bg-[#050506]/60 backdrop-blur-xl">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-surface border border-white/10 flex items-center justify-center group-hover:border-accent/50 transition-colors">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
          </div>
          <div className="font-semibold text-lg tracking-tight text-foreground">ReachInbox</div>
        </Link>
        {session && (
          <nav className="flex gap-2">
            {navLink("/dashboard", "Dashboard", LayoutDashboard)}
            {navLink("/history", "History", History)}
          </nav>
        )}
      </div>
      
      {session?.user && (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-surface pl-4 pr-1 py-1 rounded-full border border-border-default">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">{session.user.name}</span>
            </div>
            {session.user.image && (
              <Image
                src={session.user.image}
                alt="Avatar"
                width={32}
                height={32}
                className="rounded-full border border-border-default"
              />
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-foreground-muted hover:text-red-400 font-medium transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
