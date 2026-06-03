import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TUTORIAL_KEY = "plan90_tutorial_done";

// ─── Detectar plataforma ───────────────────────────────────────────────────
function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  return "pc";
}

// ─── Pasos del tutorial ────────────────────────────────────────────────────
function buildSteps(platform) {
  const installStep = {
    ios: {
      id: "install",
      icon: "📲",
      title: "Instala la app en tu iPhone",
      subtitle: "Acceso rápido desde tu pantalla de inicio",
      color: "from-blue-500/20 to-cyan-500/10",
      accent: "#38bdf8",
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400 text-center mb-4">
            Sigue estos 3 pasos en <span className="text-blue-400 font-bold">Safari</span>
          </p>
          {[
            {
              num: "1",
              icon: "⬆️",
              text: (
                <>
                  Toca el botón de{" "}
                  <span className="text-blue-400 font-bold">Compartir</span>{" "}
                  (la cajita con la flecha) en la barra inferior de Safari
                </>
              ),
            },
            {
              num: "2",
              icon: "➕",
              text: (
                <>
                  Desplázate hacia abajo y toca{" "}
                  <span className="text-blue-400 font-bold">
                    "Agregar a pantalla de inicio"
                  </span>
                </>
              ),
            },
            {
              num: "3",
              icon: "✅",
              text: (
                <>
                  Toca{" "}
                  <span className="text-blue-400 font-bold">"Agregar"</span>{" "}
                  en la esquina superior derecha
                </>
              ),
            },
          ].map((s) => (
            <div
              key={s.num}
              className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
            >
              <span className="text-xl mt-0.5">{s.icon}</span>
              <p className="text-zinc-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mt-2">
            <p className="text-xs text-blue-400 text-center">
              ⚠️ Solo funciona desde <strong>Safari</strong>. Chrome en iPhone no permite instalar PWA.
            </p>
          </div>
        </div>
      ),
    },
    android: {
      id: "install",
      icon: "📲",
      title: "Instala la app en Android",
      subtitle: "Acceso rápido desde tu pantalla de inicio",
      color: "from-green-500/20 to-emerald-500/10",
      accent: "#34d399",
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400 text-center mb-4">
            Sigue estos pasos en{" "}
            <span className="text-green-400 font-bold">Chrome</span>
          </p>
          {[
            {
              num: "1",
              icon: "⋮",
              text: (
                <>
                  Toca los{" "}
                  <span className="text-green-400 font-bold">3 puntos</span> (⋮)
                  en la esquina superior derecha del navegador
                </>
              ),
            },
            {
              num: "2",
              icon: "📥",
              text: (
                <>
                  Toca{" "}
                  <span className="text-green-400 font-bold">
                    "Agregar a pantalla principal"
                  </span>{" "}
                  o{" "}
                  <span className="text-green-400 font-bold">
                    "Instalar aplicación"
                  </span>
                </>
              ),
            },
            {
              num: "3",
              icon: "✅",
              text: (
                <>
                  Confirma tocando{" "}
                  <span className="text-green-400 font-bold">"Instalar"</span>{" "}
                  o <span className="text-green-400 font-bold">"Agregar"</span>
                </>
              ),
            },
          ].map((s) => (
            <div
              key={s.num}
              className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
            >
              <span className="text-xl font-black text-green-400 mt-0.5 w-6 text-center">
                {s.icon}
              </span>
              <p className="text-zinc-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mt-2">
            <p className="text-xs text-green-400 text-center">
              💡 También puede aparecer un banner automático en la parte inferior de Chrome invitándote a instalar.
            </p>
          </div>
        </div>
      ),
    },
    pc: {
      id: "install",
      icon: "💻",
      title: "Instala la app en tu PC",
      subtitle: "Disponible para Windows y Mac",
      color: "from-violet-500/20 to-purple-500/10",
      accent: "#a78bfa",
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400 text-center mb-4">
            Compatible con{" "}
            <span className="text-violet-400 font-bold">Chrome</span> y{" "}
            <span className="text-violet-400 font-bold">Edge</span>
          </p>
          {[
            {
              icon: "🔲",
              text: (
                <>
                  Busca el ícono de{" "}
                  <span className="text-violet-400 font-bold">instalar</span> (
                  <span className="font-mono">⊕</span>) en la barra de
                  direcciones del navegador
                </>
              ),
            },
            {
              icon: "🖱️",
              text: (
                <>
                  O haz clic en los{" "}
                  <span className="text-violet-400 font-bold">3 puntos</span> del
                  menú → "Instalar Plan 90 Días"
                </>
              ),
            },
            {
              icon: "✅",
              text: (
                <>
                  Confirma con{" "}
                  <span className="text-violet-400 font-bold">"Instalar"</span>{" "}
                  y se abrirá como app independiente
                </>
              ),
            },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
            >
              <span className="text-xl mt-0.5">{s.icon}</span>
              <p className="text-zinc-300 leading-relaxed">{s.text}</p>
            </div>
          ))}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mt-2">
            <p className="text-xs text-violet-400 text-center">
              💡 Una vez instalada tendrás acceso directo desde el escritorio o el menú inicio.
            </p>
          </div>
        </div>
      ),
    },
  };

  return [
    // ── Paso 0: Bienvenida ──────────────────────────────────────────────────
    {
      id: "welcome",
      icon: "🔥",
      title: "¡Bienvenido a Plan 90 Días!",
      subtitle: "Tu transformación empieza hoy",
      color: "from-amber-500/20 to-orange-500/10",
      accent: "#f59e0b",
      content: (
        <div className="space-y-4 text-sm text-center">
          <p className="text-zinc-300 leading-relaxed text-base">
            Este es tu sistema completo de{" "}
            <span className="text-amber-400 font-bold">transformación total</span>{" "}
            en 90 días.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { icon: "💼", label: "Negocio", desc: "Seguimiento de ingresos" },
              { icon: "🧠", label: "Mente", desc: "Libros y meditación" },
              { icon: "🏋️", label: "Cuerpo", desc: "Rutina de entrenamiento" },
              { icon: "🏆", label: "Logros", desc: "Recompensas y retos" },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-zinc-800/60 rounded-xl p-3 text-left"
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="font-black text-white text-xs">{item.label}</div>
                <div className="text-zinc-500 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-zinc-500 text-xs mt-3">
            Este tutorial te llevará por cada sección en 2 minutos ⚡
          </p>
        </div>
      ),
    },

    // ── Paso 1: Instalar app (según plataforma) ─────────────────────────────
    installStep[platform],

    // ── Paso 2: Perfil ──────────────────────────────────────────────────────
    {
      id: "profile",
      icon: "👤",
      title: "Personaliza tu perfil",
      subtitle: "Ponle tu nombre y elige tu avatar",
      color: "from-amber-500/20 to-yellow-500/10",
      accent: "#f59e0b",
      content: (
        <div className="space-y-3 text-sm">
          <div className="bg-zinc-800/60 rounded-2xl p-4 space-y-3">
            {[
              {
                icon: "🖼️",
                title: "Avatar",
                desc: "Toca el círculo de perfil para elegir tu imagen entre 8 opciones",
              },
              {
                icon: "✏️",
                title: "Nombre",
                desc: 'Toca "Tu nombre" para editarlo y personalizarlo',
              },
              {
                icon: "🎯",
                title: "Meta principal",
                desc: "Define tu objetivo más importante de los 90 días",
              },
              {
                icon: "📅",
                title: "Meta del mes",
                desc: "Establece qué quieres lograr este mes específicamente",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 3: Tab Hoy ─────────────────────────────────────────────────────
    {
      id: "today",
      icon: "📋",
      title: "Tab: Hoy",
      subtitle: "Tu checklist diaria de hábitos",
      color: "from-amber-500/20 to-orange-500/10",
      accent: "#f59e0b",
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400 text-center">
            Aquí vives el día a día del plan
          </p>
          <div className="space-y-2">
            {[
              {
                icon: "☑️",
                title: "Checklist diaria",
                desc: "Marca cada hábito completado: lectura, podcast, entrenamiento, enfoque…",
              },
              {
                icon: "⚡",
                title: "Tareas clave",
                desc: "3 tareas prioritarias del día que no puedes dejar sin hacer",
              },
              {
                icon: "🔥",
                title: "Racha y XP",
                desc: "Cada día completado suma XP y mantiene tu racha activa",
              },
              {
                icon: "➕",
                title: "Hábitos extra",
                desc: "Puedes agregar tus propios hábitos personalizados",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
              >
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 4: Tab Negocio ─────────────────────────────────────────────────
    {
      id: "negocio",
      icon: "💼",
      title: "Tab: Negocio",
      subtitle: "Seguimiento de ingresos y ventas",
      color: "from-blue-500/20 to-cyan-500/10",
      accent: "#38bdf8",
      content: (
        <div className="space-y-3 text-sm">
          <p className="text-zinc-400 text-center">
            Controla tu crecimiento financiero mes a mes
          </p>
          <div className="space-y-2">
            {[
              {
                icon: "📈",
                title: "Metas mensuales",
                desc: "Mes 1: $1,000 · Mes 2: $2,000 · Mes 3: $3,000 (editables)",
              },
              {
                icon: "💵",
                title: "Ingresos semanales",
                desc: "Registra cuánto ganaste cada semana para ver tu progreso",
              },
              {
                icon: "📄",
                title: "Calculadora de PDFs",
                desc: "¿Vendes infoproductos? Calcula cuántos necesitas vender para llegar a tu meta",
              },
              {
                icon: "📊",
                title: "Gráficas",
                desc: "Visualiza tu evolución de ingresos con barras de progreso",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
              >
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 5: Tab Mente ───────────────────────────────────────────────────
    {
      id: "mente",
      icon: "🧠",
      title: "Tab: Mente",
      subtitle: "Alimenta tu mentalidad ganadora",
      color: "from-violet-500/20 to-purple-500/10",
      accent: "#a78bfa",
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            {[
              {
                icon: "📚",
                title: "Lecturas",
                desc: "Registra los libros que vas leyendo y tu avance de páginas",
              },
              {
                icon: "🎙️",
                title: "Podcasts",
                desc: "Lleva la cuenta de los episodios escuchados en la semana",
              },
              {
                icon: "🧘",
                title: "Meditación",
                desc: "Registra tus minutos de meditación diaria",
              },
              {
                icon: "📓",
                title: "Diario",
                desc: "Espacio para reflexiones, aprendizajes y notas personales",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
              >
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 6: Tab Cuerpo ──────────────────────────────────────────────────
    {
      id: "cuerpo",
      icon: "🏋️",
      title: "Tab: Cuerpo",
      subtitle: "Tu rutina de entrenamiento",
      color: "from-rose-500/20 to-orange-500/10",
      accent: "#fb7185",
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            {[
              {
                icon: "📅",
                title: "Estructura semanal",
                desc: "Lunes a domingo con tipo de actividad: fuerza, cardio, descanso…",
              },
              {
                icon: "✏️",
                title: "Editable",
                desc: "Personaliza cada día con tu propio tipo de entrenamiento",
              },
              {
                icon: "📏",
                title: "Medidas corporales",
                desc: "Registra peso, cintura, pecho y otras medidas para ver tu cambio físico",
              },
              {
                icon: "🎯",
                title: "Objetivos físicos",
                desc: "Define tu objetivo de transformación: bajar de peso, ganar músculo…",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
              >
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 7: Tab Logros ──────────────────────────────────────────────────
    {
      id: "logros",
      icon: "🏆",
      title: "Tab: Logros",
      subtitle: "Gana medallas y canjea recompensas",
      color: "from-yellow-500/20 to-amber-500/10",
      accent: "#fbbf24",
      content: (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            {[
              {
                icon: "🥇",
                title: "Logros automáticos",
                desc: "Se desbloquean solos al alcanzar metas: primera semana, 10 días de racha…",
              },
              {
                icon: "🪙",
                title: "Monedas",
                desc: "Ganas monedas completando días. Úsalas para canjear recompensas",
              },
              {
                icon: "🎁",
                title: "Recompensas",
                desc: "Define tus propias recompensas y canjéalas cuando las merezcas",
              },
              {
                icon: "⭐",
                title: "Niveles XP",
                desc: "Sube de nivel acumulando XP con cada hábito completado",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 bg-zinc-800/60 rounded-xl p-3"
              >
                <span className="text-lg mt-0.5">{item.icon}</span>
                <div>
                  <p className="font-bold text-white text-xs">{item.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── Paso 8: ¡Listo! ─────────────────────────────────────────────────────
    {
      id: "done",
      icon: "🚀",
      title: "¡Todo listo!",
      subtitle: "Tu transformación empieza ahora",
      color: "from-amber-500/20 to-orange-500/10",
      accent: "#f59e0b",
      content: (
        <div className="space-y-4 text-sm text-center">
          <p className="text-zinc-300 leading-relaxed text-base">
            Tienes <span className="text-amber-400 font-black">90 días</span> para
            transformar tu vida. Cada día cuenta.
          </p>
          <div className="bg-zinc-800/60 rounded-2xl p-4 space-y-2">
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
              Recuerda siempre
            </p>
            {[
              "✅ Marca tus hábitos cada día",
              "📈 Registra tus ingresos semanales",
              "🔥 Mantén tu racha sin romperse",
              "🏆 Canjea tus recompensas ganadas",
            ].map((tip) => (
              <p key={tip} className="text-zinc-300 text-sm">
                {tip}
              </p>
            ))}
          </div>
          <p className="text-zinc-500 text-xs">
            Puedes volver a ver este tutorial desde el menú de ajustes ⚙️
          </p>
        </div>
      ),
    },
  ];
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function Tutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const platform = detectPlatform();
  const steps = buildSteps(platform);
  const total = steps.length;
  const current = steps[step];

  const go = (delta) => {
    setDirection(delta);
    setStep((s) => Math.min(Math.max(s + delta, 0), total - 1));
  };

  const finish = () => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    onDone();
  };

  const isLast = step === total - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-md"
         style={{ fontFamily: "'JetBrains Mono', monospace" }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10 flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* ── Progreso ── */}
        <div className="flex gap-1.5 mb-4 px-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background:
                  i <= step
                    ? current.accent
                    : "rgba(63,63,70,0.6)",
              }}
            />
          ))}
        </div>

        {/* ── Card ── */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className={`bg-gradient-to-b ${current.color} bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col`}
              style={{ maxHeight: "72vh" }}
            >
              {/* Header */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">{current.icon}</div>
                <h2 className="text-xl font-black text-white">{current.title}</h2>
                <p className="text-xs text-zinc-500 mt-1">{current.subtitle}</p>
              </div>

              {/* Contenido scrollable */}
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
                {current.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Botones de navegación ── */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button
              onClick={() => go(-1)}
              className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-bold transition-all"
            >
              ← Anterior
            </button>
          )}

          {isLast ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={finish}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-zinc-900 shadow-lg transition-all"
              style={{
                background: `linear-gradient(135deg, #f59e0b, #ef4444)`,
                boxShadow: "0 0 24px rgba(245,158,11,0.4)",
              }}
            >
              🚀 ¡Empezar Plan!
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => go(1)}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-zinc-900 transition-all"
              style={{
                background: current.accent,
                boxShadow: `0 0 20px ${current.accent}55`,
              }}
            >
              Siguiente →
            </motion.button>
          )}
        </div>

        {/* Saltar tutorial */}
        {!isLast && (
          <button
            onClick={finish}
            className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center w-full py-1"
          >
            Saltar tutorial
          </button>
        )}

        {/* Contador de pasos */}
        <p className="text-center text-zinc-700 text-xs mt-2">
          {step + 1} / {total}
        </p>
      </div>
    </div>
  );
}

// ─── Hook para controlar cuándo mostrar el tutorial ────────────────────────
export function useTutorial() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TUTORIAL_KEY);
    if (!done) setShow(true);
  }, []);

  const reset = () => {
    localStorage.removeItem(TUTORIAL_KEY);
    setShow(true);
  };

  return { show, setShow, reset };
}
