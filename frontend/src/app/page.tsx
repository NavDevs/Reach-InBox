"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Mail, Zap, ArrowRight, MousePointerClick } from "lucide-react";

// Spotlight Card Component
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-2xl overflow-hidden bg-glass-gradient border border-border-default shadow-card hover:shadow-card-hover hover:border-border-hover transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(94,106,210,0.12), transparent 40%)`,
        }}
      />
      {/* Top inner highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { scrollY } = useScroll();
  
  // Parallax effects
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95]);
  const heroY = useTransform(scrollY, [0, 400], [0, 100]);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 1, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } 
    }
  };

  return (
    <main className="flex flex-col items-center pt-32 pb-24 px-6 md:px-12 w-full max-w-[1400px] mx-auto">
      
      {/* Hero Section */}
      <motion.div 
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="w-full flex flex-col items-center text-center max-w-4xl z-10"
      >
        <motion.div 
          initial={{ opacity: 1, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-default bg-surface backdrop-blur-md mb-8"
        >
          <Sparkles className="w-4 h-4 text-accent-bright" />
          <span className="text-xs font-mono tracking-widest text-foreground-muted">NEXT-GEN AUTOMATION</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 1, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
          className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.03em] leading-tight text-gradient mb-6"
        >
          Intelligent scale for <br className="hidden md:block" />
          <span className="text-gradient-accent">cold outreach.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 1, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          className="text-lg md:text-xl text-foreground-muted max-w-2xl mb-12 leading-relaxed"
        >
          Precision scheduling, smart sequencing, and absolute control over your email delivery. Designed for teams that demand absolute performance.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 1, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          className="w-full max-w-md relative group"
        >
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full relative flex items-center justify-center gap-3 px-8 py-4 bg-accent text-white rounded-lg font-medium shadow-button-primary hover:bg-accent-bright transition-all duration-300 active:scale-[0.98] overflow-hidden"
          >
            {/* Hover shine effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]" />
            <svg className="w-5 h-5 relative z-10 bg-white rounded-full p-[2px]" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="relative z-10 text-[15px] font-medium tracking-wide">Continue with Google</span>
            <ArrowRight className="w-4 h-4 ml-2 relative z-10 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </motion.div>

      {/* Spacer */}
      <div className="h-32" />

      {/* Bento Grid Features */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="w-full grid grid-cols-1 md:grid-cols-6 gap-6 max-w-5xl z-10"
      >
        <motion.div variants={itemVariants} className="md:col-span-4 h-full">
          <SpotlightCard className="p-8 h-full min-h-[320px] flex flex-col justify-between group">
            <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center mb-6 group-hover:-translate-y-1 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <Zap className="w-6 h-6 text-accent-bright" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Lightning Fast Execution</h3>
              <p className="text-foreground-muted leading-relaxed">
                Our infrastructure is built for speed and reliability. Queue thousands of emails and let our distributed system handle the delivery with precision timing.
              </p>
            </div>
          </SpotlightCard>
        </motion.div>
        
        <motion.div variants={itemVariants} className="md:col-span-2 h-full">
          <SpotlightCard className="p-8 h-full min-h-[320px] flex flex-col justify-between group">
             <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center mb-6 group-hover:-translate-y-1 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <Mail className="w-6 h-6 text-accent-bright" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground mb-3">Smart Inbox</h3>
              <p className="text-foreground-muted leading-relaxed text-sm">
                Unified view of all your sequences. Never miss a reply again.
              </p>
            </div>
          </SpotlightCard>
        </motion.div>

        <motion.div variants={itemVariants} className="md:col-span-6 h-full mt-4">
          <SpotlightCard className="px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-8 group">
            <div className="max-w-xl">
              <h3 className="text-3xl font-semibold tracking-tight text-foreground mb-4">Ready to upgrade your workflow?</h3>
              <p className="text-foreground-muted leading-relaxed text-lg">
                Join thousands of teams already using ReachInbox to scale their outreach securely and effectively.
              </p>
            </div>
             <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="whitespace-nowrap px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-lg font-medium transition-all duration-300 active:scale-[0.98] flex items-center gap-2"
              >
                Get Started Today
              </button>
          </SpotlightCard>
        </motion.div>

      </motion.div>

    </main>
  );
}
