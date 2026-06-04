import React from "react";
import Link from "next/link";
import { Terminal, Sparkles, Play, Code, Database, Bell, ArrowRight, ShieldCheck, Download } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden bg-[#070709] py-12">
      {/* Dynamic light glows */}
      <div className="glow-bg top-[-100px] left-1/4 scale-90" />
      <div className="glow-bg-blue bottom-[-100px] right-1/4 scale-75" />

      {/* Header navbar */}
      <header className="relative z-10 max-w-[1200px] w-full flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center border border-violet-500/20 shadow-lg shadow-violet-500/10">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5 font-outfit">
            ZeroCode <span className="text-violet-400 font-normal">AI</span>
          </h1>
        </div>

        <Link
          href="/login"
          className="px-4 py-2 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition shadow-sm"
        >
          Sign In
        </Link>
      </header>

      {/* Hero section */}
      <main className="relative z-10 max-w-[900px] w-full mx-auto text-center my-16 space-y-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-950/20 border border-violet-800/20 text-violet-300 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-inner">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Full-Stack Runtime Sandbox
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-black text-white leading-tight font-outfit tracking-tight">
            Turn JSON Configs Into <br />
            <span className="text-gradient">Production-Grade Apps</span>
          </h2>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Create entities, define schema validation constraints, establish workflow trigger calculations, and immediately launch dynamic app sandboxes. Export compiled standalone Next.js & Prisma projects with a single click.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 btn-gradient text-sm text-white font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
          >
            Launch Sandbox <Play className="w-4 h-4 fill-current" />
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto px-6 py-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-sm font-bold text-slate-300 hover:text-white transition flex items-center justify-center gap-2"
          >
            Sign Up Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-12 text-left">
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2.5">
            <div className="w-8 h-8 bg-violet-950/40 border border-violet-900/30 rounded-lg flex items-center justify-center">
              <Code className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Metadata Runtime</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Dynamically compiles sidebars, charts, detail panels, and interactive database grids from unified JSON specifications.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2.5">
            <div className="w-8 h-8 bg-blue-950/40 border border-blue-900/30 rounded-lg flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Dynamic Meta-Model</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Stores user configurations and entity entries dynamically in serialized relational tables. Zero migrations required.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2.5">
            <div className="w-8 h-8 bg-emerald-950/40 border border-emerald-900/30 rounded-lg flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Workflow Calculations</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Evaluates algebraic equations on save and triggers context-aware notification cards inside custom user dashboards.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2.5">
            <div className="w-8 h-8 bg-amber-950/40 border border-amber-900/30 rounded-lg flex items-center justify-center">
              <Download className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Next.js Zip Exporter</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Downloads complete generated projects with distinct endpoints, Tailwind styling, and Prisma schemas.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center border-t border-white/5 pt-6 max-w-[1200px] w-full mx-auto text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© 2026 ZeroCode AI. Built for the Full-Stack Internship Assignment.</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-violet-500" /> Secure Sandbox Environment</span>
        </div>
      </footer>
    </div>
  );
}
