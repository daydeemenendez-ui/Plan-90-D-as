import { useState } from "react";
import { supabase } from "./supabase";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Cuenta creada. Revisa tu email para confirmar.");
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 relative"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔥</div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            PLAN <span className="text-amber-400">90</span> DÍAS
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Transformación Total</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 shadow-2xl"
             style={{ backdropFilter: "blur(16px)" }}>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-800/80 rounded-2xl p-1 mb-6">
            {["login", "register"].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  tab === t
                    ? "bg-amber-500 text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 font-black uppercase tracking-widest block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 font-black uppercase tracking-widest block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {tab === "register" && (
                <p className="text-xs text-zinc-600 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-2"
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all ${
                loading
                  ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-amber-500 text-zinc-900 hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              }`}
            >
              {loading
                ? "Cargando..."
                : tab === "login"
                ? "⚡ Entrar"
                : "🚀 Crear cuenta"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
