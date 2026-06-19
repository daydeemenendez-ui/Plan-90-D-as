import { useState, useEffect, useRef } from "react";
import { loadStateFromDB, saveStateToDB, supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────

const STORAGE_KEY = "plan90dias_v1";

// Estructura semanal por defecto del plan de entrenamiento
const DEFAULT_WEEKLY_SCHEDULE = [
  { day: "Lunes",     icon: "💪", activity: "Fuerza (pecho + tríceps o tren superior)" },
  { day: "Martes",    icon: "🚶", activity: "Caminar 30 min" },
  { day: "Miércoles", icon: "💪", activity: "Fuerza o tren inferior" },
  { day: "Jueves",    icon: "🧘", activity: "Movilidad + abdominales" },
  { day: "Viernes",   icon: "💪", activity: "Espalda + hombro" },
  { day: "Sábado",    icon: "🚶", activity: "Caminata ligera" },
  { day: "Domingo",   icon: "😴", activity: "Descanso total" },
];

const INITIAL_STATE = {
  currentDay: 1,
  currentWeek: 1,
  planCompleted: false,
  xp: 0,
  level: 1,
  streak: 0,
  coins: 0,
  todayChecks: {
    goals: false,
    reading: false,
    podcast: false,
    focus: false,
    training: false,
    walk: false,
    ads: false,
    content: false,
  },
  monthlyRevenue: [0, 0, 0],
  monthlyTargets: [1000, 2000, 3000],
  // weeklyIncomes: distribuidos proporcionalmente para que cada mes sume exactamente su meta
  // Mes 1 (S1-S4): pesos 100,160,240,360 → suma 860 → escala a 1000
  // Mes 2 (S5-S8): pesos 400,500,600,700 → suma 2200 → escala a 2000
  // Mes 3 (S9-S12): pesos 700,800,900,1000 → suma 3400 → escala a 3000
  weeklyIncomes: [
    Math.round(100/860*1000), Math.round(160/860*1000), Math.round(240/860*1000), Math.round(360/860*1000),
    Math.round(400/2200*2000), Math.round(500/2200*2000), Math.round(600/2200*2000), Math.round(700/2200*2000),
    Math.round(700/3400*3000), Math.round(800/3400*3000), Math.round(900/3400*3000), Math.round(1000/3400*3000),
  ],
  pdfPrice: 20,
  weeklySales: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  achievements: [],
  books: [
    { title: "Libro 1", pagesRead: 0, totalPages: 270, done: false },
    { title: "Libro 2", pagesRead: 0, totalPages: 280, done: false },
    { title: "Libro 3", pagesRead: 0, totalPages: 260, done: false },
  ],
  podcastsThisWeek: 0,
  trainingsThisWeek: 0,
  walksThisWeek: 0,
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
  userName: "",
  userSubtitle: "",
  keyTasks: [
    { id: "kt1", label: "Tarea clave 1", done: false },
    { id: "kt2", label: "Tarea clave 2", done: false },
    { id: "kt3", label: "Tarea clave 3", done: false },
  ],
  customHabits: [],
  hiddenHabits: [],
  habitOverrides: {},
  habitSchedules: {},
  rewards: [
    { id: "r1", label: "", redeemed: false },
    { id: "r2", label: "", redeemed: false },
    { id: "r3", label: "", redeemed: false },
  ],
  selectedAvatar: null,
  mainGoal: "",
  monthGoal: "",
  planStarted: false,
  planStartDate: null,
  weekStartDate: null,
  weekUnlockedNotified: false,
  notes: [],
  campaigns: [],
  lastHabitResetDate: null,  // "YYYY-MM-DD" del último reset diario
  lastWeekResetNum: 0,       // número de semana del último reset semanal
};

const XP_PER_ACTION = {
  goals: 10,
  reading: 10,
  podcast: 10,
  focus: 10,
  training: 10,
  walk: 10,
  ads: 10,
  content: 10,
};

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1850, 2400, 3000, 4000];

const ACHIEVEMENT_LIST = [
  { id: "first_sale", icon: "💰", label: "Primera Venta", desc: "Vende tu primer PDF" },
  { id: "week1", icon: "🔥", label: "Semana 1 Completa", desc: "Completa todos los hábitos de la semana 1" },
  { id: "streak7", icon: "⚡", label: "Racha de 7 días", desc: "7 días consecutivos con todos los hábitos" },
  { id: "book1", icon: "📚", label: "Lector Nivel 1", desc: "Termina el libro 1" },
  { id: "rev1000", icon: "🏆", label: "$1,000 Generados", desc: "Alcanza el objetivo del mes 1" },
  { id: "rev2000", icon: "🚀", label: "$2,000 Generados", desc: "Alcanza el objetivo del mes 2" },
  { id: "rev3000", icon: "👑", label: "Meta 90 Días", desc: "Genera $3,000 en el mes 3" },
  { id: "train30", icon: "💪", label: "Guerrero Físico", desc: "Completa 30 entrenamientos" },
];

const WEEK_TARGETS = [
  { week: 1, sales: 5, investment: 35, income: 100 },
  { week: 2, sales: 8, investment: 56, income: 160 },
  { week: 3, sales: 12, investment: 84, income: 240 },
  { week: 4, sales: 18, investment: 126, income: 360 },
  { week: 5, sales: 20, investment: 175, income: 400 },
  { week: 6, sales: 25, investment: 245, income: 500 },
  { week: 7, sales: 30, investment: 315, income: 600 },
  { week: 8, sales: 35, investment: 420, income: 700 },
  { week: 9, sales: 35, investment: 490, income: 700 },
  { week: 10, sales: 40, investment: 595, income: 800 },
  { week: 11, sales: 45, investment: 700, income: 900 },
  { week: 12, sales: 50, investment: 840, income: 1000 },
];

const HABITS = [
  { id: "goals", icon: "📓", label: "Escribir metas del día (5 min)", category: "mente" },
  { id: "reading", icon: "📖", label: "10+ páginas de lectura", category: "mente" },
  { id: "podcast", icon: "🎧", label: "Podcast (negocios/mentalidad)", category: "mente" },
  { id: "focus", icon: "📵", label: "1 hora modo enfoque (sin distracciones)", category: "mente" },
  { id: "training", icon: "💪", label: "Entrenamiento / Caminata 30+ min", category: "cuerpo" },
  { id: "walk", icon: "🚶", label: "Actividad ligera adicional", category: "cuerpo" },
  { id: "ads", icon: "📣", label: "Revisar y optimizar anuncios", category: "negocio" },
  { id: "content", icon: "✍️", label: "Crear contenido / nuevo anuncio", category: "negocio" },
];

const AVATARS = [
  { id: 0, src: "/img/3.webp",  name: "Guerrero"      },
  { id: 1, src: "/img/4.webp",  name: "Mentalidad"    },
  { id: 2, src: "/img/5.webp",  name: "Planificación" },
  { id: 3, src: "/img/6.webp",  name: "Entrenamiento" },
  { id: 4, src: "/img/7.webp",  name: "Negocio"       },
  { id: 5, src: "/img/8.webp",  name: "Zen"           },
  { id: 6, src: "/img/9.webp",  name: "Corredora"     },
  { id: 7, src: "/img/10.webp", name: "Fitness"       },
];

const MOTIVATIONAL_QUOTES = [
  { text: "El éxito no es el final, el fracaso no es fatal: lo que cuenta es el coraje de continuar.", author: "Winston Churchill" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "La disciplina es el puente entre metas y logros.", author: "Jim Rohn" },
  { text: "El dolor que sientes hoy será la fuerza que sentirás mañana.", author: "Arnold Schwarzenegger" },
  { text: "No esperes la oportunidad perfecta. Tómala y hazla perfecta.", author: "Gary Vaynerchuk" },
  { text: "Cada día es una nueva oportunidad de cambiar tu vida.", author: "Anónimo" },
  { text: "La constancia no se trata de ser perfecto, se trata de seguir adelante.", author: "Tony Robbins" },
  { text: "Tu único límite eres tú mismo.", author: "Anónimo" },
  { text: "Haz hoy lo que otros no harán para vivir mañana como otros no pueden.", author: "Jerry Rice" },
  { text: "Los campeones siguen jugando hasta que lo hacen bien.", author: "Billie Jean King" },
  { text: "No te rindas. Sufrir ahora y vivir el resto de tu vida como campeón.", author: "Muhammad Ali" },
  { text: "El trabajo duro supera al talento cuando el talento no trabaja duro.", author: "Tim Notke" },
  { text: "Sueña en grande. Trabaja duro. Mantén el enfoque.", author: "Anónimo" },
  { text: "La motivación te pone en marcha. El hábito te mantiene en movimiento.", author: "Jim Ryun" },
  { text: "No midas tu riqueza por el dinero que tienes, sino por lo que perderías si lo perdieras todo.", author: "Anónimo" },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// Devuelve el número de PDFs cuyo resultado (pdfs * price) se acerca más al ingreso objetivo.
// Compara floor y ceil y elige el más cercano; en empate elige el menor.
function closestPdfs(income, price) {
  if (!price || price <= 0) return 0;
  const floor = Math.floor(income / price);
  const ceil  = Math.ceil(income / price);
  if (floor === ceil) return floor;
  const diffFloor = Math.abs(income - floor * price);
  const diffCeil  = Math.abs(income - ceil  * price);
  return diffCeil <= diffFloor ? ceil : floor;
}

function getLevelFromXP(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getXPProgress(xp, level) {
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  if (next === current) return 100;
  const pct = ((xp - current) / (next - current)) * 100;
  return Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Migra datos de localStorage a Supabase si existen y aún no se han migrado
async function migrateLocalStorage() {
  const local = loadSavedState();
  if (!local) return null;
  await saveStateToDB(local);
  localStorage.removeItem(STORAGE_KEY);
  return local;
}

function mergeState(initial, saved) {
  if (!saved) return initial;
  return {
    ...initial,
    ...saved,
    xp:    isNaN(saved.xp)    ? 0 : (saved.xp    ?? 0),
    coins: isNaN(saved.coins) ? 0 : (saved.coins  ?? 0),
    todayChecks: { ...initial.todayChecks, ...(saved.todayChecks || {}) },
    books: saved.books && saved.books.length === initial.books.length
      ? saved.books
      : initial.books,
    weeklySchedule: saved.weeklySchedule && saved.weeklySchedule.length > 0
      ? saved.weeklySchedule
      : initial.weeklySchedule,
    keyTasks: saved.keyTasks && saved.keyTasks.length > 0
      ? saved.keyTasks
      : initial.keyTasks,
    customHabits: saved.customHabits || [],
    hiddenHabits: saved.hiddenHabits || [],
    habitOverrides: saved.habitOverrides || {},
    habitSchedules: saved.habitSchedules || {},
    rewards: saved.rewards && saved.rewards.length === 3
      ? saved.rewards
      : initial.rewards,
    selectedAvatar: saved.selectedAvatar ?? null,
    mainGoal: saved.mainGoal || "",
    monthGoal: saved.monthGoal || "",
    planCompleted: saved.planCompleted ?? false,
    planStarted: saved.planStarted ?? false,
    planStartDate: saved.planStartDate ?? null,
    weekStartDate: saved.weekStartDate ?? null,
    weekUnlockedNotified: saved.weekUnlockedNotified ?? false,
    notes: saved.notes ?? [],
    campaigns: saved.campaigns ?? [],
    lastHabitResetDate: saved.lastHabitResetDate ?? null,
    lastWeekResetNum: saved.lastWeekResetNum ?? 0,
    userName: saved.userName || "",
    userSubtitle: saved.userSubtitle || "",
    monthlyTargets: saved.monthlyTargets && saved.monthlyTargets.length === 3
      ? saved.monthlyTargets
      : initial.monthlyTargets,
    weeklyIncomes: (() => {
      if (!saved.weeklyIncomes || saved.weeklyIncomes.length !== 12) return initial.weeklyIncomes;
      // Si los valores guardados son los viejos sin escalar, migrar a los nuevos
      const OLD_INCOMES = [100,160,240,360,400,500,600,700,700,800,900,1000];
      const isOld = OLD_INCOMES.every((v, i) => saved.weeklyIncomes[i] === v);
      return isOld ? initial.weeklyIncomes : saved.weeklyIncomes;
    })(),
    pdfPrice: saved.pdfPrice ?? 20,
  };
}

function checkNewAchievements(state) {
  const earned = [...state.achievements];
  const totalRevenue = state.monthlyRevenue.reduce((a, b) => a + b, 0);
  const totalSales = state.weeklySales.reduce((a, b) => a + b, 0);

  const conditions = {
    first_sale: totalSales >= 1,
    week1: state.currentWeek >= 2,
    streak7: state.streak >= 7,
    book1: state.books[0]?.done,
    rev1000: state.monthlyRevenue[0] >= 1000,
    rev2000: state.monthlyRevenue[1] >= 2000,
    rev3000: state.monthlyRevenue[2] >= 3000,
    train30: state.trainingsThisWeek >= 30,
  };

  let changed = false;
  for (const [id, met] of Object.entries(conditions)) {
    if (met && !earned.includes(id)) {
      earned.push(id);
      changed = true;
    }
  }
  return changed ? earned : null;
}

// ─────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────

function StatCard({ icon, label, value, sub, color = "amber" }) {
  const border = {
    amber:  "border-amber-500/25 bg-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/8",
    teal:   "border-teal-500/25 bg-teal-500/5 hover:border-teal-500/40 hover:bg-teal-500/8",
    rose:   "border-rose-500/25 bg-rose-500/5 hover:border-rose-500/40 hover:bg-rose-500/8",
    violet: "border-violet-500/25 bg-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/8",
  };
  const text = {
    amber: "text-amber-400", teal: "text-teal-400",
    rose: "text-rose-400", violet: "text-violet-400",
  };
  const glow = {
    amber: "hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]",
    teal:  "hover:shadow-[0_0_24px_rgba(20,184,166,0.1)]",
    rose:  "hover:shadow-[0_0_24px_rgba(244,63,94,0.1)]",
    violet:"hover:shadow-[0_0_24px_rgba(139,92,246,0.1)]",
  };
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`rounded-2xl border p-3 sm:p-4 transition-all duration-300 cursor-default ${border[color]} ${glow[color]}`}
      style={{ backdropFilter: "blur(8px)" }}
    >
      <div className="text-xl sm:text-2xl mb-1">{icon}</div>
      <motion.div
        key={value}
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={`text-lg sm:text-2xl font-black truncate ${text[color]}`}
      >{value}</motion.div>
      <div className="text-xs text-zinc-400 font-medium leading-tight">{label}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5 truncate leading-tight">{sub}</div>}
    </motion.div>
  );
}

function HabitRow({ id, icon, label, pts, checked, onToggle, onEdit }) {
  const [coins, setCoins] = useState([]);
  const handleToggle = () => {
    if (!checked) {
      const id_ = Date.now();
      setCoins((c) => [...c, id_]);
      setTimeout(() => setCoins((c) => c.filter((x) => x !== id_)), 900);
    }
    onToggle(id);
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative w-full flex items-center gap-3 p-3 rounded-xl border transition-colors duration-200 group ${
        checked
          ? "border-amber-500/40 bg-amber-500/8 shadow-[0_0_16px_rgba(245,158,11,0.08)]"
          : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-900/60 hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
      }`}
    >
      {/* Monedas flotantes */}
      <AnimatePresence>
        {coins.map((cid) => (
          <motion.span
            key={cid}
            initial={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            animate={{ opacity: 0, y: -50, scale: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.22,1,0.36,1] }}
            className="absolute left-8 top-1 text-sm pointer-events-none z-10 select-none"
          >+🪙</motion.span>
        ))}
      </AnimatePresence>

      <motion.button
        onClick={handleToggle}
        whileTap={{ scale: 0.85 }}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
          checked
            ? "border-amber-400 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            : "border-zinc-600 hover:border-zinc-400"
        }`}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="w-3 h-3 text-zinc-900"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      <span className="text-base sm:text-lg flex-shrink-0">{icon}</span>
      <span className={`flex-1 text-xs sm:text-sm font-medium transition-all duration-200 truncate min-w-0 ${
        checked ? "line-through text-zinc-500" : "text-zinc-200"
      }`}>
        {label}
      </span>
      <span className={`text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition-all duration-200 flex-shrink-0 ${
        checked
          ? "text-amber-400 bg-amber-500/20 shadow-[0_0_6px_rgba(245,158,11,0.2)]"
          : "text-zinc-500 bg-zinc-800/80"
      }`}>
        +{pts} XP
      </span>
      <motion.button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="sm:opacity-0 sm:group-hover:opacity-100 opacity-30 transition-opacity text-zinc-600 hover:text-zinc-300 active:text-zinc-300 flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-700/50 touch-manipulation"
        title="Editar hábito"
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
      </motion.button>
    </motion.div>
  );
}

function ProgressBar({ value, max, color = "amber", height = "h-2" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className={`w-full bg-zinc-800/80 rounded-full ${height} overflow-hidden progress-premium`}
         style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)" }}>
      <motion.div
        className={`${height} rounded-full bar-${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekNumFromPlanStart(planStartDate) {
  if (!planStartDate) return 1;
  const elapsed = Math.floor((Date.now() - planStartDate) / (24 * 60 * 60 * 1000));
  return Math.min(12, Math.max(1, Math.ceil((elapsed + 1) / 7)));
}

// ─────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────

export default function Dashboard90Dias({ onResetTutorial }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => mergeState(INITIAL_STATE, loadSavedState()));
  const isDBLoaded = useRef(false);
  const [activeTab, setActiveTab] = useState("today");
  const [salesInput, setSalesInput] = useState("");
  const [bookPage, setBookPage] = useState(["", "", ""]);
  const [notification, setNotification] = useState(null);
  // Estado para edición de días del plan de entrenamiento
  const [editingDayIdx, setEditingDayIdx] = useState(null);
  const [editingDayValue, setEditingDayValue] = useState("");
  // Calculadora de PDFs — inputs locales (no necesitan persistirse)
  const [calcIncome, setCalcIncome] = useState("");
  const [calcPrice, setCalcPrice] = useState("");
  const [calcIncomeApplied, setCalcIncomeApplied] = useState("");
  const [calcPriceApplied, setCalcPriceApplied] = useState("");
  // Modal de avatares
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [congratsOpen, setCongratsOpen] = useState(false);
  // Edición inline de metas del perfil
  const [editingMainGoal, setEditingMainGoal] = useState(false);
  const [editingMonthGoal, setEditingMonthGoal] = useState(false);
  const [mainGoalInput, setMainGoalInput] = useState("");
  const [monthGoalInput, setMonthGoalInput] = useState("");
  // Modal de nuevo hábito
  const [habitModal, setHabitModal] = useState(null); // null | "mente" | "cuerpo" | "negocio"
  const [habitModalName, setHabitModalName] = useState("");
  const [habitModalEmoji, setHabitModalEmoji] = useState("");
  const [habitModalTime, setHabitModalTime] = useState("");
  const [habitModalRepeat, setHabitModalRepeat] = useState("daily"); // "daily" | "specific" | "once"
  const [habitModalDays, setHabitModalDays] = useState([]); // ["L","M","X","J","V","S","D"]
  const [habitModalDate, setHabitModalDate] = useState(""); // YYYY-MM-DD
  // Modal de quitar hábito
  const [removeModal, setRemoveModal] = useState(null); // null | "mente" | "cuerpo" | "negocio"
  const [removeSelected, setRemoveSelected] = useState(null); // id del hábito a quitar
  // Modal de editar hábito
  const [editHabitModal, setEditHabitModal] = useState(null); // { id, isFixed, category } | null
  const [editHabitName, setEditHabitName] = useState("");
  const [editHabitEmoji, setEditHabitEmoji] = useState("");
  const [editHabitTime, setEditHabitTime] = useState("");
  const [editHabitRepeat, setEditHabitRepeat] = useState("daily");
  const [editHabitDays, setEditHabitDays] = useState([]);
  const [editHabitDate, setEditHabitDate] = useState("");
  // Edición inline de perfil
  const [editingName, setEditingName] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [subtitleInput, setSubtitleInput] = useState("");
  // Edición inline de tareas clave
  const [editingTaskIdx, setEditingTaskIdx] = useState(null);
  const [editingTaskValue, setEditingTaskValue] = useState("");
  // Selección y edición de meta de mes (negocio)
  const [selectedMonthCard, setSelectedMonthCard] = useState(null); // null | 0 | 1 | 2
  const [editingMonthTarget, setEditingMonthTarget] = useState(false);
  const [monthTargetInput, setMonthTargetInput] = useState("");
  // Precio global por PDF (persiste en UI, afecta toda la calculadora)
  const [pdfPrice, setPdfPrice] = useState(() => {
    const saved = loadSavedState();
    return saved?.pdfPrice ?? 20;
  });
  const [pdfPriceInput, setPdfPriceInput] = useState(() => {
    const saved = loadSavedState();
    return String(saved?.pdfPrice ?? 20);
  });
  // Ingreso custom por semana dentro de la tabla del mes seleccionado
  const [editingWeekIncome, setEditingWeekIncome] = useState(null); // weekIdx 0-based | null
  const [weekIncomeInput, setWeekIncomeInput] = useState("");
  // Frases motivadoras — rotan cada 8 segundos
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  // Notas
  const [noteInput, setNoteInput] = useState("");
  const [noteToDelete, setNoteToDelete] = useState(null);
  // ── Cargar estado desde Supabase al montar (con migración de localStorage)
  useEffect(() => {
    if (!user) return;
    async function init() {
      let dbState = await loadStateFromDB(user.id);
      if (!dbState) {
        dbState = await migrateLocalStorage();
        if (dbState) await saveStateToDB(user.id, dbState);
      }
      if (dbState) {
        // Migrar habitOverrides → habitSchedules si aún no existe
        if (dbState.habitOverrides && !dbState.habitSchedules) {
          dbState.habitSchedules = {};
          Object.entries(dbState.habitOverrides).forEach(([id, ov]) => {
            if (ov.repeat) dbState.habitSchedules[id] = { repeat: ov.repeat, days: ov.days || [], date: ov.date || null };
          });
        }
        // Migrar customHabits con repeat → habitSchedules
        if (dbState.customHabits) {
          dbState.habitSchedules = dbState.habitSchedules || {};
          dbState.customHabits.forEach((h) => {
            if (h.repeat && !dbState.habitSchedules[h.id]) {
              dbState.habitSchedules[h.id] = { repeat: h.repeat, days: h.days || [], date: h.date || null };
            }
          });
        }
        setState(mergeState(INITIAL_STATE, dbState));
        const price = dbState.pdfPrice ?? 20;
        setPdfPrice(price);
        setPdfPriceInput(String(price));
      }
      isDBLoaded.current = true;
    }
    init();
  }, [user]);

  // ── Auto-save en Supabase (debounced 1s)
  useEffect(() => {
    if (!isDBLoaded.current || !user) return;
    const timer = setTimeout(() => {
      saveStateToDB(user.id, state);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, user]);

  // ── Rotar frases motivadoras cada 8 s
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx((i) => (i + 1) % MOTIVATIONAL_QUOTES.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // ── Valores derivados
  const safeXP = isNaN(state.xp) ? 0 : (state.xp || 0);
  const level = getLevelFromXP(safeXP);
  const xpProgress = getXPProgress(safeXP, level);

  // Filtro de visibilidad por frecuencia del hábito
  const DAY_LETTERS = ["D","L","M","X","J","V","S"];
  const todayWeekday = DAY_LETTERS[new Date().getDay()];
  const todayDateStr = new Date().toISOString().split("T")[0];
  const isHabitVisibleToday = (h) => {
    const sched = (state.habitSchedules || {})[h.id] || h;
    if (!sched.repeat || sched.repeat === "daily") return true;
    if (sched.repeat === "specific") return (sched.days || []).includes(todayWeekday);
    if (sched.repeat === "once") return sched.date === todayDateStr;
    return true;
  };

  const hiddenSet = new Set(state.hiddenHabits || []);
  const totalChecked = Object.entries(state.todayChecks).filter(([id, v]) => v && !hiddenSet.has(id)).length;
  const visibleFixedCount = HABITS.filter((h) => {
    if (hiddenSet.has(h.id)) return false;
    const ov = (state.habitOverrides || {})[h.id];
    return isHabitVisibleToday(ov ? { ...h, ...ov } : h);
  }).length;
  const totalHabits = visibleFixedCount + state.customHabits.filter(isHabitVisibleToday).length;
  const currentWeekTarget = WEEK_TARGETS[state.currentWeek - 1] || WEEK_TARGETS[0];
  const totalRevenue = state.monthlyRevenue.reduce((a, b) => a + b, 0);
  const totalSales = state.weeklySales.reduce((a, b) => a + b, 0);
  const currentMonth = Math.ceil(state.currentWeek / 4);
  const monthRevenue = state.monthlyRevenue[currentMonth - 1] || 0;
  const monthTarget = (state.monthlyTargets || [1000, 2000, 3000])[currentMonth - 1] || 1000;

  // Día actual calculado dinámicamente desde planStartDate para que avance cada día real
  const currentDay = state.planStarted && state.planStartDate
    ? Math.min(90, Math.max(1, Math.floor((Date.now() - state.planStartDate) / (24 * 60 * 60 * 1000)) + 1))
    : state.currentDay;

  const phase = state.currentWeek <= 4 ? 1 : state.currentWeek <= 8 ? 2 : 3;
  const phaseLabels = ["Adaptación", "Progreso", "Intensidad"];
  const phaseColors = ["teal", "amber", "rose"];

  const menteHabits = HABITS.filter((h) => h.category === "mente");
  const cuerpoHabits = HABITS.filter((h) => h.category === "cuerpo");
  const negocioHabits = HABITS.filter((h) => h.category === "negocio");

  // ── Helpers UI
  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Semana desbloqueada: han pasado 7 días desde el inicio de la semana
  const weekUnlocked =
    state.planStarted &&
    !state.planCompleted &&
    state.weekStartDate != null &&
    Date.now() >= state.weekStartDate + 7 * 24 * 60 * 60 * 1000;

  // ── Revisar desbloqueo de semana cada minuto y notificar al usuario
  useEffect(() => {
    const check = () => {
      setState((s) => {
        if (!s.planStarted || s.planCompleted || s.weekUnlockedNotified || !s.weekStartDate) return s;
        if (Date.now() >= s.weekStartDate + 7 * 24 * 60 * 60 * 1000) {
          setTimeout(() => showNotification("🔓 ¡Semana completada! Ya puedes avanzar a la siguiente 🚀"), 300);
          return { ...s, weekUnlockedNotified: true };
        }
        return s;
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Reset automático de hábitos (diario) y podcasts (semanal) sin tocar XP ni monedas
  useEffect(() => {
    const check = () => {
      setState((s) => {
        if (!s.planStarted) return s;
        const today = getTodayDateStr();
        const weekNum = getWeekNumFromPlanStart(s.planStartDate);
        let next = s;

        // Reset diario: si cambió el día, desmarcar hábitos y tareas clave
        if (s.lastHabitResetDate !== today) {
          next = {
            ...next,
            todayChecks: Object.fromEntries(Object.keys(s.todayChecks).map((k) => [k, false])),
            customHabits: s.customHabits.map((h) => ({ ...h, checked: false })),
            keyTasks: s.keyTasks.map((t) => ({ ...t, done: false })),
            lastHabitResetDate: today,
          };
        }

        // Reset semanal: si cambió la semana, reiniciar contador de podcasts
        if (s.lastWeekResetNum !== weekNum) {
          next = {
            ...next,
            podcastsThisWeek: 0,
            lastWeekResetNum: weekNum,
          };
        }

        return next === s ? s : next;
      });
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const applyAchievements = (nextState) => {
    const newAchievements = checkNewAchievements(nextState);
    if (newAchievements) {
      const newIds = newAchievements.filter((id) => !nextState.achievements.includes(id));
      if (newIds.length > 0) {
        const label = ACHIEVEMENT_LIST.find((a) => a.id === newIds[0])?.label;
        setTimeout(() => showNotification(`🏆 Logro desbloqueado: ${label}!`), 500);
      }
      return { ...nextState, achievements: newAchievements };
    }
    return nextState;
  };

  // ── Acciones
  // ── Iniciar el plan (guarda la medianoche del día actual como inicio de semana)
  const startPlan = () => {
    const d = new Date();
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    setState((s) => ({
      ...s,
      planStarted: true,
      planStartDate: Date.now(),
      weekStartDate: midnight,
      weekUnlockedNotified: false,
    }));
    showNotification("🚀 ¡Plan de 90 días iniciado! A por ello 🔥");
  };

  const toggleHabit = (id) => {
    setState((s) => {
      const wasChecked = s.todayChecks[id];
      const xpPerAction = XP_PER_ACTION[id] ?? 10; // hábitos custom valen 10 XP
      const safeCurrentXP = isNaN(s.xp) ? 0 : (s.xp || 0);
      const xpChange = wasChecked ? -xpPerAction : xpPerAction;
      const newXP = Math.max(0, safeCurrentXP + xpChange);
      const newChecks = { ...s.todayChecks, [id]: !wasChecked };

      // allDone: todos los hábitos visibles (fixed no ocultos + custom) están marcados
      const hiddenIds = new Set(s.hiddenHabits || []);
      const allFixedChecked = HABITS.filter((h) => !hiddenIds.has(h.id)).every((h) => newChecks[h.id]);
      const allCustomChecked = (s.customHabits || []).filter(isHabitVisibleToday).every((h) => newChecks[h.id]);
      const allDone = allFixedChecked && allCustomChecked;

      // Bonus si completa todo el día
      const bonusXP = !wasChecked && allDone ? 100 : 0;

      // Actualizar contadores semanales para training/walk
      let trainingsThisWeek = s.trainingsThisWeek;
      let walksThisWeek = s.walksThisWeek;
      if (id === "training") trainingsThisWeek += wasChecked ? -1 : 1;
      if (id === "walk") walksThisWeek += wasChecked ? -1 : 1;

      const totalXP = newXP + bonusXP;
      const next = {
        ...s,
        xp: totalXP,
        level: getLevelFromXP(totalXP),
        todayChecks: newChecks,
        coins: !wasChecked ? (isNaN(s.coins) ? 5 : s.coins + 5) : Math.max(0, (isNaN(s.coins) ? 0 : s.coins) - 5),
        trainingsThisWeek: Math.max(0, trainingsThisWeek),
        walksThisWeek: Math.max(0, walksThisWeek),
      };

      if (!wasChecked) {
        setTimeout(() => showNotification(`+${xpPerAction} XP +5 🪙 ganados! 🔥`), 0);
        if (allDone) setTimeout(() => showNotification("⚡ DÍA PERFECTO! +100 XP BONUS"), 1000);
      }

      return applyAchievements(next);
    });
  };

  const addSales = () => {
    const n = parseInt(salesInput);
    if (!n || n <= 0) return;
    setState((s) => {
      const newWeeklySales = [...s.weeklySales];
      newWeeklySales[s.currentWeek - 1] = (newWeeklySales[s.currentWeek - 1] || 0) + n;
      const price = s.pdfPrice ?? 20;
      const revenue = n * price;
      const month = Math.ceil(s.currentWeek / 4) - 1;
      const newMonthlyRevenue = [...s.monthlyRevenue];
      newMonthlyRevenue[month] = (newMonthlyRevenue[month] || 0) + revenue;

      const next = {
        ...s,
        weeklySales: newWeeklySales,
        monthlyRevenue: newMonthlyRevenue,
        xp: (isNaN(s.xp) ? 0 : s.xp) + n * 5,
        coins: (isNaN(s.coins) ? 0 : s.coins) + n * 10,
      };
      setTimeout(() => showNotification(`+${n} ventas! 💰 +$${revenue} registrados`), 0);
      return applyAchievements(next);
    });
    setSalesInput("");
  };

  const updateBookPages = (idx) => {
    const pages = parseInt(bookPage[idx]);
    if (!pages || pages < 0) return;
    setState((s) => {
      const newBooks = [...s.books];
      newBooks[idx] = {
        ...newBooks[idx],
        pagesRead: Math.min(pages, newBooks[idx].totalPages),
        done: pages >= newBooks[idx].totalPages,
      };
      const next = { ...s, books: newBooks, xp: (isNaN(s.xp) ? 0 : s.xp) + 10 };
      if (newBooks[idx].done) setTimeout(() => showNotification("📚 ¡Libro terminado! +10 XP"), 0);
      return applyAchievements(next);
    });
    const newBookPage = [...bookPage];
    newBookPage[idx] = "";
    setBookPage(newBookPage);
  };

  const advanceWeek = () => {
    if (state.planCompleted || !weekUnlocked) return;
    const isLastWeek = state.currentWeek === 12;
    const d = new Date();
    const newWeekStartMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    setState((s) => {
      const allChecked = Object.values(s.todayChecks).every(Boolean);
      const newStreak = allChecked ? s.streak + 1 : s.streak;
      const isMonth3 = s.currentWeek >= 9;

      // Bono por racha múltiplo de 7
      let bonusXP = 0, bonusCoins = 0;
      if (allChecked && newStreak > 0 && newStreak % 7 === 0) {
        bonusXP    = isMonth3 ? 50  : 30;
        bonusCoins = isMonth3 ? 100 : 50;
        setTimeout(() => showNotification(
          `${isMonth3 ? "👑" : "⚡"} ¡Racha ${newStreak} semanas! +${bonusXP} XP +${bonusCoins} 🪙`
        ), 600);
      }

      const next = {
        ...s,
        currentWeek:     isLastWeek ? 12 : s.currentWeek + 1,
        currentDay:      isLastWeek ? 90 : s.currentDay + 7,
        planCompleted:   isLastWeek ? true : s.planCompleted,
        todayChecks:     Object.fromEntries(Object.keys(s.todayChecks).map((k) => [k, false])),
        podcastsThisWeek: 0,
        walksThisWeek:   0,
        streak:          newStreak,
        xp:              (isNaN(s.xp) ? 0 : s.xp) + 50 + bonusXP,
        coins:           (isNaN(s.coins) ? 0 : s.coins) + 20 + bonusCoins,
        keyTasks:        s.keyTasks.map((t) => ({ ...t, done: false })),
        weekStartDate:   isLastWeek ? s.weekStartDate : newWeekStartMidnight,
        weekUnlockedNotified: false,
      };

      if (isLastWeek) {
        setTimeout(() => setCongratsOpen(true), 400);
      } else {
        setTimeout(() => showNotification(`Semana ${s.currentWeek + 1} comenzada! +50 XP 🚀`), 0);
      }

      return applyAchievements(next);
    });
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_STATE);
    setResetModalOpen(false);
    showNotification("Progreso reiniciado 🔄");
  };

  // ── Modal helpers
  const HABIT_EMOJIS = {
    mente: ["🧠","📓","📖","🎧","📵","🐇","💡","🎯","🔔","⏰","📋","🔍","🖥️","☕","🎓","📚","🏅","📝"],
    cuerpo: ["💪","🏋️","🏃","🚶","🚴","🧘","🥗","💧","🥦","🍎","🌍","🤸","🏊","🥊","🛌","😴","🏆","🥇","🏅","🤾","🏌️","🎽"],
    negocio: ["💼","💰","📣","🤝","📊","📈","🔖","🛒","🎯","💡","💻","📞","🤝","📋","💳","🔥","🚀","📱","🖥️","💧","⚡","🌐","📦","🏦","📅","🧠","🎬","🪙"],
  };

  const openHabitModal = (category) => {
    const defaults = { mente: "🧠", cuerpo: "💪", negocio: "💼" };
    setHabitModalName("");
    setHabitModalEmoji(defaults[category]);
    setHabitModalTime("");
    setHabitModalRepeat("daily");
    setHabitModalDays([]);
    setHabitModalDate("");
    setHabitModal(category);
  };

  const closeHabitModal = () => setHabitModal(null);

  const openRemoveModal = (category) => {
    setRemoveSelected(null);
    setRemoveModal(category);
  };
  const closeRemoveModal = () => { setRemoveModal(null); setRemoveSelected(null); };

  const confirmRemoveHabit = () => {
    if (!removeSelected) return;
    setState((s) => {
      // Si es hábito fijo (está en HABITS), lo ocultamos
      const isFixed = HABITS.some((h) => h.id === removeSelected);
      if (isFixed) {
        return {
          ...s,
          hiddenHabits: [...(s.hiddenHabits || []), removeSelected],
        };
      }
      // Si es custom, lo eliminamos definitivamente
      const { [removeSelected]: _, ...restChecks } = s.todayChecks;
      return {
        ...s,
        customHabits: s.customHabits.filter((h) => h.id !== removeSelected),
        todayChecks: restChecks,
      };
    });
    showNotification("Hábito eliminado 🗑️");
    closeRemoveModal();
  };

  // ── Editar hábito existente
  const openEditHabit = (habit) => {
    const isFixed = HABITS.some((h) => h.id === habit.id);
    setEditHabitModal({ id: habit.id, isFixed, category: habit.category });
    setEditHabitName(habit.label);
    setEditHabitEmoji(habit.icon);
    setEditHabitTime(habit.time || "");
    setEditHabitRepeat(habit.repeat || "daily");
    setEditHabitDays(habit.days || []);
    setEditHabitDate(habit.date || "");
  };
  const closeEditHabit = () => setEditHabitModal(null);

  const confirmEditHabit = () => {
    if (!editHabitName.trim() || !editHabitModal) return;
    const scheduleEntry = {
      repeat: editHabitRepeat,
      days: editHabitRepeat === "specific" ? editHabitDays : [],
      date: editHabitRepeat === "once" ? editHabitDate : null,
    };
    setState((s) => {
      const newSchedules = {
        ...(s.habitSchedules || {}),
        [editHabitModal.id]: scheduleEntry,
      };
      if (editHabitModal.isFixed) {
        return {
          ...s,
          habitSchedules: newSchedules,
          habitOverrides: {
            ...(s.habitOverrides || {}),
            [editHabitModal.id]: {
              label: editHabitName.trim(),
              icon: editHabitEmoji,
              time: editHabitTime || null,
              ...scheduleEntry,
            },
          },
        };
      } else {
        return {
          ...s,
          habitSchedules: newSchedules,
          customHabits: s.customHabits.map((h) =>
            h.id === editHabitModal.id
              ? { ...h, label: editHabitName.trim(), icon: editHabitEmoji, time: editHabitTime || null, ...scheduleEntry }
              : h
          ),
        };
      }
    });
    showNotification(`Hábito actualizado ✅`);
    closeEditHabit();
  };

  const confirmAddHabit = () => {
    if (!habitModalName.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newSchedule = {
      repeat: habitModalRepeat,
      days: habitModalRepeat === "specific" ? habitModalDays : [],
      date: habitModalRepeat === "once" ? habitModalDate : null,
    };
    setState((s) => ({
      ...s,
      habitSchedules: { ...(s.habitSchedules || {}), [newId]: newSchedule },
      customHabits: [
        ...s.customHabits,
        {
          id: newId,
          icon: habitModalEmoji,
          label: habitModalName.trim(),
          category: habitModal,
          pts: 10,
          checked: false,
          time: habitModalTime || null,
          ...newSchedule,
        },
      ],
    }));
    showNotification(`Hábito "${habitModalName.trim()}" agregado ✅`);
    closeHabitModal();
  };

  // ────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Fondo dinámico */}
      <div className="bg-premium" aria-hidden="true" />

      {/* ── Notificación flotante */}
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.msg}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-3 right-3 left-3 sm:left-auto sm:top-4 sm:right-4 z-[100] bg-zinc-900 border border-amber-500/40 text-zinc-100 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm sm:max-w-xs shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.15)]"
            style={{ backdropFilter: "blur(16px)" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)] flex-shrink-0" />
              {notification.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal nuevo hábito */}
      {habitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeHabitModal(); }}
        >
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-white text-base">
                Nuevo hábito{" "}
                <span className={
                  habitModal === "mente" ? "text-teal-400" :
                  habitModal === "cuerpo" ? "text-rose-400" : "text-amber-400"
                }>
                  · {habitModal === "mente" ? "Mentalidad" : habitModal === "cuerpo" ? "Entrenamiento" : "Negocio"}
                </span>
              </h2>
              <button
                onClick={closeHabitModal}
                className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
              >×</button>
            </div>

            {/* Nombre */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Nombre del hábito</div>
              <input
                autoFocus
                type="text"
                value={habitModalName}
                onChange={(e) => setHabitModalName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmAddHabit(); if (e.key === "Escape") closeHabitModal(); }}
                placeholder="Ej: Meditar 10 min"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Emoji */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Elige un emoji</div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-3 grid grid-cols-9 gap-1">
                {(HABIT_EMOJIS[habitModal] || []).map((em) => (
                  <button
                    key={em}
                    onClick={() => setHabitModalEmoji(em)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      habitModalEmoji === em
                        ? habitModal === "mente"
                          ? "bg-teal-500/30 border border-teal-500/60"
                          : habitModal === "cuerpo"
                          ? "bg-rose-500/30 border border-rose-500/60"
                          : "bg-amber-500/30 border border-amber-500/60"
                        : "hover:bg-zinc-700"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Hora */}
            <div className="mb-4">
              <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Hora (opcional)</div>
              <input
                type="time"
                value={habitModalTime}
                onChange={(e) => setHabitModalTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Repetición */}
            <div className="mb-5">
              <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Repetición</div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  { id: "daily",    label: "Todos los días" },
                  { id: "specific", label: "Días específicos" },
                  { id: "once",     label: "Fecha única" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setHabitModalRepeat(opt.id)}
                    className={`flex-1 py-2 px-1 rounded-2xl text-xs font-bold transition-all text-center ${
                      habitModalRepeat === opt.id
                        ? "bg-amber-500 text-zinc-900"
                        : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Panel: Días específicos */}
              {habitModalRepeat === "specific" && (
                <div className="mt-3">
                  <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Días de la semana</div>
                  <div className="flex gap-1.5">
                    {[
                      { id: "D", label: "D" },
                      { id: "L", label: "L" },
                      { id: "M", label: "M" },
                      { id: "X", label: "X" },
                      { id: "J", label: "J" },
                      { id: "V", label: "V" },
                      { id: "S", label: "S" },
                    ].map((d) => {
                      const active = habitModalDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() =>
                            setHabitModalDays((prev) =>
                              active ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                            )
                          }
                          className={`flex-1 h-10 rounded-xl text-sm font-black transition-all ${
                            active
                              ? "bg-amber-500 text-zinc-900"
                              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Panel: Fecha única */}
              {habitModalRepeat === "once" && (
                <div className="mt-3">
                  <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Fecha</div>
                  <input
                    type="date"
                    value={habitModalDate}
                    onChange={(e) => setHabitModalDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                  />
                </div>
              )}

              <div className="text-xs text-zinc-600 mt-3">
                Recompensa fija: <span className="text-amber-400 font-bold">+10 XP</span> + <span className="text-violet-400 font-bold">+5 🪙</span> por completar
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={closeHabitModal}
                className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-400 font-black text-sm hover:border-zinc-500 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddHabit}
                disabled={!habitModalName.trim()}
                className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${
                  habitModalName.trim()
                    ? "bg-amber-500 text-zinc-900 hover:bg-amber-400 active:scale-95"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                }`}
              >
                Agregar hábito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal quitar hábito */}
      {removeModal && (() => {
        const catLabel = removeModal === "mente" ? "Mentalidad" : removeModal === "cuerpo" ? "Entrenamiento" : "Negocio";
        const catColor = removeModal === "mente" ? "text-teal-400" : removeModal === "cuerpo" ? "text-rose-400" : "text-amber-400";
        const fixedList = HABITS.filter((h) => h.category === removeModal && !(state.hiddenHabits || []).includes(h.id));
        const customList = state.customHabits.filter((h) => h.category === removeModal);
        const allHabits = [...fixedList, ...customList];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeRemoveModal(); }}
          >
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-white text-base">
                  Quitar hábito{" "}
                  <span className={catColor}>· {catLabel}</span>
                </h2>
                <button onClick={closeRemoveModal} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">×</button>
              </div>

              {/* Lista */}
              {allHabits.length === 0 ? (
                <div className="text-xs text-zinc-600 text-center py-6">No hay hábitos en esta sección.</div>
              ) : (
                <div className="space-y-2 mb-5 max-h-72 overflow-y-auto pr-1">
                  {allHabits.map((h) => {
                    const isFixed = HABITS.some((f) => f.id === h.id);
                    const selected = removeSelected === h.id;
                    return (
                      <button
                        key={h.id}
                        onClick={() => setRemoveSelected(selected ? null : h.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          selected
                            ? "border-rose-500/60 bg-rose-500/10"
                            : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                        }`}
                      >
                        {/* Selector */}
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          selected ? "border-rose-400 bg-rose-400" : "border-zinc-600"
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-zinc-900" />}
                        </div>
                        <span className="text-base flex-shrink-0">{h.icon}</span>
                        <span className={`flex-1 text-sm font-medium ${selected ? "text-rose-300" : "text-zinc-300"}`}>
                          {h.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg font-bold flex-shrink-0 ${
                          isFixed ? "bg-zinc-800 text-zinc-600" : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {isFixed ? "fijo" : "custom"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Nota */}
              <div className="text-xs text-zinc-600 mb-4">
                Los hábitos <span className="text-zinc-500 font-bold">fijos</span> se ocultarán y podrás restaurarlos. Los <span className="text-rose-500 font-bold">custom</span> se eliminarán permanentemente.
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={closeRemoveModal}
                  className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-400 font-black text-sm hover:border-zinc-500 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemoveHabit}
                  disabled={!removeSelected}
                  className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${
                    removeSelected
                      ? "bg-rose-500 text-white hover:bg-rose-400 active:scale-95"
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  Quitar hábito
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal editar hábito */}
      {editHabitModal && (() => {
        const cat = editHabitModal.category;
        const catLabel = cat === "mente" ? "Mentalidad" : cat === "cuerpo" ? "Entrenamiento" : "Negocio";
        const catColor = cat === "mente" ? "text-teal-400" : cat === "cuerpo" ? "text-rose-400" : "text-amber-400";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) closeEditHabit(); }}
          >
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-white text-base">
                  Editar hábito <span className={catColor}>· {catLabel}</span>
                </h2>
                <button onClick={closeEditHabit} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">×</button>
              </div>

              {/* Nombre */}
              <div className="mb-4">
                <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Nombre del hábito</div>
                <input
                  autoFocus
                  type="text"
                  value={editHabitName}
                  onChange={(e) => setEditHabitName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEditHabit(); if (e.key === "Escape") closeEditHabit(); }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Emoji */}
              <div className="mb-4">
                <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Elige un emoji</div>
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-3 grid grid-cols-9 gap-1">
                  {(HABIT_EMOJIS[cat] || []).map((em) => (
                    <button
                      key={em}
                      onClick={() => setEditHabitEmoji(em)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                        editHabitEmoji === em
                          ? cat === "mente" ? "bg-teal-500/30 border border-teal-500/60"
                          : cat === "cuerpo" ? "bg-rose-500/30 border border-rose-500/60"
                          : "bg-amber-500/30 border border-amber-500/60"
                          : "hover:bg-zinc-700"
                      }`}
                    >{em}</button>
                  ))}
                </div>
              </div>

              {/* Hora */}
              <div className="mb-4">
                <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Hora (opcional)</div>
                <input
                  type="time"
                  value={editHabitTime}
                  onChange={(e) => setEditHabitTime(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                />
              </div>

              {/* Repetición */}
              <div className="mb-5">
                <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Repetición</div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {[{ id: "daily", label: "Todos los días" }, { id: "specific", label: "Días específicos" }, { id: "once", label: "Fecha única" }].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEditHabitRepeat(opt.id)}
                      className={`flex-1 py-2 px-1 rounded-2xl text-xs font-bold transition-all text-center ${
                        editHabitRepeat === opt.id ? "bg-amber-500 text-zinc-900" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>

                {editHabitRepeat === "specific" && (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Días de la semana</div>
                    <div className="flex gap-1.5">
                      {["D","L","M","X","J","V","S"].map((d) => {
                        const active = editHabitDays.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() => setEditHabitDays((prev) => active ? prev.filter((x) => x !== d) : [...prev, d])}
                            className={`flex-1 h-10 rounded-xl text-sm font-black transition-all ${active ? "bg-amber-500 text-zinc-900" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}
                          >{d}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {editHabitRepeat === "once" && (
                  <div className="mt-3">
                    <div className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">Fecha</div>
                    <input
                      type="date"
                      value={editHabitDate}
                      onChange={(e) => setEditHabitDate(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button onClick={closeEditHabit} className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-400 font-black text-sm hover:border-zinc-500 hover:text-white transition-all">
                  Cancelar
                </button>
                <button
                  onClick={confirmEditHabit}
                  disabled={!editHabitName.trim()}
                  className={`flex-1 py-3 rounded-2xl font-black text-sm transition-all ${editHabitName.trim() ? "bg-amber-500 text-zinc-900 hover:bg-amber-400 active:scale-95" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal felicitaciones 90 días */}
      <AnimatePresence>
        {congratsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-zinc-900 border border-amber-500/40 rounded-3xl p-6 shadow-[0_0_60px_rgba(245,158,11,0.2)] text-center"
            >
              {/* Corona */}
              <div className="text-6xl mb-3">👑</div>

              {/* Título */}
              <h2 className="text-2xl font-black text-amber-400 mb-1">
                ¡LO LOGRASTE!
              </h2>
              <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
                {state.userName ? `${state.userName}, completaste` : "Completaste"} los{" "}
                <span className="text-white font-black">90 días</span> del plan.
                Eso no lo hace todo el mundo. 🔥
              </p>

              {/* Stats finales */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-zinc-800/80 rounded-2xl p-3 border border-zinc-700">
                  <div className="text-xl font-black text-amber-400">{safeXP}</div>
                  <div className="text-xs text-zinc-500">XP total</div>
                </div>
                <div className="bg-zinc-800/80 rounded-2xl p-3 border border-zinc-700">
                  <div className="text-xl font-black text-violet-400">{state.coins}</div>
                  <div className="text-xs text-zinc-500">🪙 monedas</div>
                </div>
                <div className="bg-zinc-800/80 rounded-2xl p-3 border border-zinc-700">
                  <div className="text-xl font-black text-teal-400">${totalRevenue.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">generados</div>
                </div>
                <div className="bg-zinc-800/80 rounded-2xl p-3 border border-zinc-700">
                  <div className="text-xl font-black text-rose-400">{state.streak}</div>
                  <div className="text-xs text-zinc-500">racha máx.</div>
                </div>
              </div>

              <p className="text-xs text-zinc-600 mb-5">
                Nivel <span className="text-amber-400 font-black">{level}</span> ·{" "}
                <span className="text-amber-400 font-black">{state.achievements.length}</span> logros desbloqueados ·{" "}
                <span className="text-teal-400 font-black">{totalSales}</span> PDFs vendidos
              </p>

              <button
                onClick={() => setCongratsOpen(false)}
                className="w-full py-3 rounded-2xl bg-amber-500 text-zinc-900 font-black text-sm hover:bg-amber-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              >
                ¡A por los próximos 90 días! 🚀
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal confirmación reset */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setResetModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-zinc-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-rose-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v5M8 11v1"/>
                  <circle cx="8" cy="8" r="7"/>
                </svg>
              </div>
              <div>
                <h2 className="font-black text-white text-base">¿Reiniciar progreso?</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Se eliminará todo tu progreso: XP, monedas, hábitos, ventas, logros y recompensas. Volverás al <span className="text-white font-bold">Día 1</span>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetModalOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-zinc-700 text-zinc-400 font-black text-sm hover:border-zinc-500 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-black text-sm hover:bg-rose-400 active:scale-95 transition-all"
              >
                Sí, reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal selección de avatar */}
      {avatarModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAvatarModalOpen(false); }}
        >
          <div className="w-full max-w-sm sm:max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-white text-base">Elige tu avatar</h2>
              <button onClick={() => setAvatarModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-8 gap-3">
              {AVATARS.map((av) => (
                <button
                  key={av.id}
                  onClick={() => {
                    setState((s) => ({ ...s, selectedAvatar: av.id }));
                    setAvatarModalOpen(false);
                  }}
                  className={`rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                    state.selectedAvatar === av.id
                      ? "border-amber-400 shadow-lg shadow-amber-500/20"
                      : "border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  <img src={av.src} alt={av.name} className="w-full aspect-square object-cover object-top" />
                  <div className={`py-1.5 text-xs font-black text-center ${
                    state.selectedAvatar === av.id ? "bg-amber-500 text-zinc-900" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {av.name}
                  </div>
                </button>
              ))}
            </div>
            {state.selectedAvatar !== null && (
              <button
                onClick={() => { setState((s) => ({ ...s, selectedAvatar: null })); setAvatarModalOpen(false); }}
                className="w-full mt-4 py-2 rounded-xl border border-zinc-700 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 text-xs font-bold transition-all"
              >
                Quitar avatar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Header sticky */}
      <div className="header-glass sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 pt-2.5 pb-2">
          {/* Fila superior */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
            {/* Izquierda: logo + subtítulo */}
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white leading-none">
                🔥 <span className="text-amber-400">PLAN 90</span> DÍAS
              </h1>
              {editingSubtitle ? (
                <input
                  autoFocus
                  value={subtitleInput}
                  onChange={(e) => setSubtitleInput(e.target.value)}
                  onBlur={() => {
                    setState((s) => ({ ...s, userSubtitle: subtitleInput.trim() || "Transformación Total" }));
                    setEditingSubtitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setState((s) => ({ ...s, userSubtitle: subtitleInput.trim() || "Transformación Total" }));
                      setEditingSubtitle(false);
                    }
                  }}
                  className="text-xs bg-transparent border-b border-amber-500/50 text-amber-400 outline-none w-full max-w-[160px] sm:max-w-[200px] mt-0.5"
                />
              ) : (
                <p
                  className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors group flex items-center gap-1 mt-0.5 truncate"
                  onClick={() => { setSubtitleInput(state.userSubtitle || "Transformación Total"); setEditingSubtitle(true); }}
                >
                  <span className="truncate">{state.userSubtitle || "Transformación Total"}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-zinc-700 transition-opacity flex-shrink-0">
                    <svg className="w-2 h-2" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                  </span>
                </p>
              )}
            </div>

            {/* Derecha: Día, Sem y cerrar sesión */}
            <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
              {onResetTutorial && (
                <button
                  onClick={onResetTutorial}
                  title="Ver tutorial"
                  className="text-zinc-600 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-amber-500/10"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => supabase.auth.signOut()}
                title="Cerrar sesión"
                className="text-zinc-600 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
              <div className="text-right">
                <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-bold">Día</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 leading-none">{currentDay}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-bold">Sem</div>
                <div className="text-xl sm:text-2xl font-black text-white leading-none">{state.currentWeek}<span className="text-sm sm:text-base text-zinc-500">/12</span></div>
              </div>
            </div>
          </div>

          {/* Barra LVL full-width */}
          <div className="flex items-center gap-2 sm:gap-3 mt-1.5">
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 flex-shrink-0">LVL {level}</span>
            <div className="flex-1 bg-zinc-800/80 rounded-full h-1 overflow-hidden progress-premium"
                 style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}>
              <motion.div
                className="h-1 rounded-full bar-amber"
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1, ease: [0.22,1,0.36,1] }}
              />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 flex-shrink-0">{safeXP} XP</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* ── Hero: Empezar Plan (solo visible antes de iniciar) */}
        {!state.planStarted && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-4 sm:mb-6 rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-violet-500/8 p-5 sm:p-7 text-center relative overflow-hidden"
            style={{ boxShadow: "0 0 60px rgba(245,158,11,0.12), 0 8px 32px rgba(0,0,0,0.5)" }}
          >
            {/* Orbs decorativos */}
            <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full bg-violet-500/8 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="text-4xl sm:text-5xl mb-3">🔥</div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-1 tracking-tight">
                ¿Listo para los{" "}
                <span className="text-amber-400">90 días</span>?
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mb-3 max-w-xs mx-auto leading-relaxed">
                El plan comienza a las{" "}
                <span className="text-amber-400 font-bold">00:00 de hoy</span>.
                El contador de días y semanas se sincroniza con el tiempo real.
              </p>

              {/* Checklist previa */}
              <div className="bg-zinc-900/70 border border-amber-500/20 rounded-2xl px-4 py-3 mb-5 text-left max-w-sm mx-auto">
                <p className="text-[11px] sm:text-xs font-black text-amber-400 uppercase tracking-widest mb-2">
                  ⚠️ Antes de empezar, configura tu dashboard:
                </p>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    <span>Escribe tu <span className="text-zinc-200 font-bold">nombre, meta principal y meta del mes</span> en el perfil de arriba.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    <span>Ve a la pestaña <span className="text-zinc-200 font-bold">📋 Hoy</span> y revisa los hábitos — agrega o quita los que no sean para ti.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    <span>Ve a <span className="text-zinc-200 font-bold">💼 Negocio</span> y ajusta las metas de ingreso mensual a tu realidad.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    <span>Ve a <span className="text-zinc-200 font-bold">🏆 Logros</span> y configura tus recompensas para mantenerte motivado.</span>
                  </li>
                </ul>
                <p className="text-[10px] text-zinc-600 mt-2.5">Una vez listo, presiona el botón. No podrás avanzar de semana hasta que pasen 7 días reales.</p>
              </div>
              <motion.button
                onClick={startPlan}
                whileTap={{ scale: 0.96 }}
                className="btn-start-glow btn-premium w-full sm:w-auto sm:min-w-[260px] py-4 sm:py-5 px-8 rounded-2xl text-base sm:text-lg font-black tracking-wide transition-all duration-200"
              >
                ⚡ EMPEZAR PLAN AHORA
              </motion.button>
              <p className="text-[10px] sm:text-xs text-zinc-600 mt-3">
                Podrás avanzar de semana cada 7 días reales.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Phase Banner */}
        <div
          className={`mb-4 sm:mb-6 rounded-2xl border p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 ${
            phase === 1
              ? "border-teal-500/30 bg-teal-500/5"
              : phase === 2
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-rose-500/30 bg-rose-500/5"
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs text-zinc-500 uppercase tracking-widest">Fase {phase} de 3</div>
            <div
              className={`text-lg sm:text-xl font-black ${
                phase === 1 ? "text-teal-400" : phase === 2 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {phaseLabels[phase - 1].toUpperCase()}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed break-words">
              {phase === 1 && "Semanas 1–4 · Aprende técnica. Crea el hábito."}
              {phase === 2 && "Semanas 5–8 · Sube el peso. Reinvierte. Registra."}
              {phase === 3 && "Semanas 9–12 · Intensidad máxima. Mide cambios."}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-zinc-500">Progreso</div>
            <div className="text-xl sm:text-2xl font-black text-white">
              {Math.round((currentDay / 90) * 100)}%
            </div>
            <div className="w-16 sm:w-24 mt-1">
              <ProgressBar
                value={currentDay}
                max={90}
                color={phaseColors[phase - 1]}
                height="h-2"
              />
            </div>
          </div>
        </div>

        {/* ── Perfil de usuario */}
        <div className="mb-4 sm:mb-6 glass-card rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          {/* Avatar clickeable */}
          <button
            onClick={() => setAvatarModalOpen(true)}
            className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden hover:border-amber-500/60 transition-all group relative"
            title="Cambiar avatar"
          >
            {state.selectedAvatar !== null ? (
              <img
                src={AVATARS[state.selectedAvatar].src}
                alt="avatar"
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <span className="text-2xl font-black text-amber-400 select-none">
                {state.userName ? state.userName[0].toUpperCase() : "?"}
              </span>
            )}
            <div className="absolute inset-0 bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
            </div>
          </button>

          <div className="flex-1 min-w-0">
            {/* Nombre editable */}
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => { setState((s) => ({ ...s, userName: nameInput.trim() })); setEditingName(false); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { setState((s) => ({ ...s, userName: nameInput.trim() })); setEditingName(false); } }}
                placeholder="Pon tu nombre aquí..."
                className="text-sm font-black bg-transparent border-b border-amber-500/50 text-white outline-none w-full"
              />
            ) : (
              <div
                className="text-sm font-black text-white cursor-pointer hover:text-amber-400 transition-colors flex items-center gap-1.5 group"
                onClick={() => { setNameInput(state.userName); setEditingName(true); }}
              >
                {state.userName || <span className="text-zinc-600">Toca para escribir tu nombre...</span>}
                <span className="text-xs opacity-0 group-hover:opacity-60 transition-opacity text-zinc-600">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                </span>
              </div>
            )}

            {/* Meta principal editable */}
            <div className="flex items-center gap-1 mt-1 min-w-0 overflow-hidden">
              <span className="text-xs text-zinc-600 flex-shrink-0">🏅</span>
              {editingMainGoal ? (
                <input
                  autoFocus
                  value={mainGoalInput}
                  onChange={(e) => setMainGoalInput(e.target.value)}
                  onBlur={() => { setState((s) => ({ ...s, mainGoal: mainGoalInput.trim() })); setEditingMainGoal(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { setState((s) => ({ ...s, mainGoal: mainGoalInput.trim() })); setEditingMainGoal(false); } }}
                  placeholder="Meta principal 90 días..."
                  className="text-xs bg-transparent border-b border-amber-500/40 text-amber-400 outline-none flex-1"
                />
              ) : (
                <span
                  className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors group flex items-center gap-1 min-w-0 overflow-hidden"
                  onClick={() => { setMainGoalInput(state.mainGoal); setEditingMainGoal(true); }}
                >
                  <span className="truncate">{state.mainGoal || <span className="text-zinc-700">Meta principal 90 días...</span>}</span>
                  <span className="opacity-0 group-hover:opacity-60 text-zinc-600 transition-opacity flex-shrink-0">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                  </span>
                </span>
              )}
            </div>

            {/* Meta del mes editable */}
            <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
              <span className="text-xs text-zinc-600 flex-shrink-0">💰</span>
              {editingMonthGoal ? (
                <input
                  autoFocus
                  value={monthGoalInput}
                  onChange={(e) => setMonthGoalInput(e.target.value)}
                  onBlur={() => { setState((s) => ({ ...s, monthGoal: monthGoalInput.trim() })); setEditingMonthGoal(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { setState((s) => ({ ...s, monthGoal: monthGoalInput.trim() })); setEditingMonthGoal(false); } }}
                  placeholder="Meta del mes..."
                  className="text-xs bg-transparent border-b border-amber-500/40 text-amber-400 outline-none flex-1"
                />
              ) : (
                <span
                  className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors group flex items-center gap-1 min-w-0 overflow-hidden"
                  onClick={() => { setMonthGoalInput(state.monthGoal); setEditingMonthGoal(true); }}
                >
                  <span className="truncate">{state.monthGoal || <span className="text-zinc-700">Meta del mes...</span>}</span>
                  <span className="opacity-0 group-hover:opacity-60 text-zinc-600 transition-opacity flex-shrink-0">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tareas clave del día */}
        <div className="mb-6 bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-zinc-400 font-black uppercase tracking-widest">
              ⚡ Tareas clave del día
            </h3>
            <span className="text-xs text-zinc-600 font-bold">
              {state.keyTasks.filter((t) => t.done).length}/{state.keyTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {state.keyTasks.map((task, idx) => (
              <div key={task.id} className="flex items-center gap-2 group">
                {/* Checkbox */}
                <button
                  onClick={() => setState((s) => {
                    const newTasks = s.keyTasks.map((t, i) => i === idx ? { ...t, done: !t.done } : t);
                    const prevDone = s.keyTasks.filter((t) => t.done).length;
                    const nextDone = newTasks.filter((t) => t.done).length;

                    // Recompensas escalonadas: solo se aplican al cruzar el umbral
                    const rewards = { xp: 0, coins: 0 };
                    const thresholds = [
                      { count: 1, xp: 10,  coins: 5  },
                      { count: 2, xp: 30,  coins: 15 },
                      { count: 3, xp: 50,  coins: 20 },
                    ];

                    for (const tier of thresholds) {
                      const crossing = !task.done
                        ? prevDone < tier.count && nextDone >= tier.count   // marcando
                        : prevDone >= tier.count && nextDone < tier.count;  // desmarcando
                      if (crossing) {
                        const prev = thresholds[tier.count - 2];
                        rewards.xp    += !task.done ? (tier.xp    - (prev?.xp    || 0)) : -(tier.xp    - (prev?.xp    || 0));
                        rewards.coins += !task.done ? (tier.coins  - (prev?.coins || 0)) : -(tier.coins - (prev?.coins || 0));
                      }
                    }

                    if (!task.done && nextDone === 3) {
                      setTimeout(() => showNotification("⚡ 3 tareas clave! +50 XP +20 🪙"), 0);
                    } else if (!task.done && nextDone === 2) {
                      setTimeout(() => showNotification("✅ 2 tareas clave! +30 XP +15 🪙"), 0);
                    } else if (!task.done && nextDone === 1) {
                      setTimeout(() => showNotification("✅ 1 tarea clave! +10 XP +5 🪙"), 0);
                    }

                    return {
                      ...s,
                      keyTasks: newTasks,
                      xp: Math.max(0, (isNaN(s.xp) ? 0 : s.xp) + rewards.xp),
                      coins: Math.max(0, (isNaN(s.coins) ? 0 : s.coins) + rewards.coins),
                    };
                  })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    task.done ? "border-amber-400 bg-amber-400" : "border-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {task.done && (
                    <svg className="w-2.5 h-2.5 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {/* Texto editable */}
                {editingTaskIdx === idx ? (
                  <input
                    autoFocus
                    value={editingTaskValue}
                    onChange={(e) => setEditingTaskValue(e.target.value)}
                    onBlur={() => {
                      setState((s) => ({ ...s, keyTasks: s.keyTasks.map((t, i) => i === idx ? { ...t, label: editingTaskValue.trim() || t.label } : t) }));
                      setEditingTaskIdx(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setState((s) => ({ ...s, keyTasks: s.keyTasks.map((t, i) => i === idx ? { ...t, label: editingTaskValue.trim() || t.label } : t) }));
                        setEditingTaskIdx(null);
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent border-b border-amber-500/40 text-sm text-white outline-none"
                  />
                ) : (
                  <span
                    className={`flex-1 min-w-0 text-sm cursor-pointer transition-colors break-words ${
                      task.done ? "line-through text-zinc-600" : "text-zinc-300 hover:text-white"
                    }`}
                    onClick={() => { setEditingTaskIdx(idx); setEditingTaskValue(task.label); }}
                  >
                    {task.label}
                  </span>
                )}
                <span className="text-xs text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon="⚡" label="Nivel" value={`LVL ${level}`} sub={`${safeXP} XP total`} color="amber" />
          <StatCard icon="🔥" label="Racha" value={`${state.streak}d`} sub="días consecutivos" color="rose" />
          <StatCard
            icon="💰"
            label="Ingresos"
            value={`$${totalRevenue.toLocaleString()}`}
            sub={`${totalSales} PDFs vendidos`}
            color="teal"
          />
          <StatCard icon="🏅" label="Monedas" value={state.coins} sub="para canjear" color="violet" />
        </div>

        {/* ── Tabs */}
        <div className="mb-4 sm:mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="flex gap-1 p-1 rounded-2xl min-w-max sm:min-w-0"
               style={{ background: "rgba(24,24,27,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" }}>
            {[
              { id: "today",   label: "📋 Hoy" },
              { id: "negocio", label: "💼 Negocio" },
              { id: "mente",   label: "🧠 Mente" },
              { id: "cuerpo",  label: "🏋️ Cuerpo" },
              { id: "logros",  label: "🏆 Logros" },
              { id: "resumen", label: "📝 Notas" },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.95 }}
                className={`relative whitespace-nowrap py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-amber-500 text-zinc-900 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            TAB: HOY
        ══════════════════════════════════════ */}
        {activeTab === "today" && (
          <motion.div
            key="today"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Progreso del día */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="font-black text-white text-sm sm:text-base min-w-0">Hábitos del Día {currentDay}</h2>
                <span
                  className={`text-sm font-bold px-3 py-1 rounded-xl ${
                    totalChecked === totalHabits
                      ? "bg-amber-500 text-zinc-900"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {totalChecked}/{totalHabits}
                </span>
              </div>
              <ProgressBar value={totalChecked} max={totalHabits} color="amber" height="h-3" />
              {totalChecked === totalHabits && (
                <div className="mt-3 text-center text-amber-400 font-black text-sm animate-pulse">
                  ⚡ DÍA PERFECTO! +100 XP BONUS ⚡
                </div>
              )}
            </div>

            {/* Hábitos — Mentalidad */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-teal-400 font-black uppercase tracking-widest">🧠 Mentalidad</h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openHabitModal("mente")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:border-teal-500/50 hover:text-teal-400 transition-all"
                  >+ Agregar</button>
                  <button
                    onClick={() => openRemoveModal("mente")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500 hover:border-rose-500/30 hover:text-rose-400 transition-all"
                  >− Quitar</button>
                </div>
              </div>
              <div className="space-y-2">
                {[...menteHabits.filter((h) => !(state.hiddenHabits || []).includes(h.id) && isHabitVisibleToday(h)),
                  ...state.customHabits.filter((h) => h.category === "mente" && isHabitVisibleToday(h))].map((h) => {
                  const ov = (state.habitOverrides || {})[h.id];
                  const displayH = ov ? { ...h, ...ov } : h;
                  return (
                    <HabitRow
                      key={h.id}
                      id={h.id}
                      icon={displayH.icon}
                      label={displayH.label}
                      pts={XP_PER_ACTION[h.id] ?? 10}
                      checked={state.todayChecks[h.id] || false}
                      onToggle={toggleHabit}
                      onEdit={() => openEditHabit(displayH)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Hábitos — Entrenamiento */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-rose-400 font-black uppercase tracking-widest">💪 Entrenamiento</h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openHabitModal("cuerpo")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:border-rose-500/50 hover:text-rose-400 transition-all"
                  >+ Agregar</button>
                  <button
                    onClick={() => openRemoveModal("cuerpo")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500 hover:border-rose-500/30 hover:text-rose-400 transition-all"
                  >− Quitar</button>
                </div>
              </div>
              <div className="space-y-2">
                {[...cuerpoHabits.filter((h) => !(state.hiddenHabits || []).includes(h.id) && isHabitVisibleToday(h)),
                  ...state.customHabits.filter((h) => h.category === "cuerpo" && isHabitVisibleToday(h))].map((h) => {
                  const ov = (state.habitOverrides || {})[h.id];
                  const displayH = ov ? { ...h, ...ov } : h;
                  return (
                    <HabitRow
                      key={h.id}
                      id={h.id}
                      icon={displayH.icon}
                      label={displayH.label}
                      pts={XP_PER_ACTION[h.id] ?? 10}
                      checked={state.todayChecks[h.id] || false}
                      onToggle={toggleHabit}
                      onEdit={() => openEditHabit(displayH)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Hábitos — Negocio */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-amber-400 font-black uppercase tracking-widest">🔥 Negocio</h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openHabitModal("negocio")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:border-amber-500/50 hover:text-amber-400 transition-all"
                  >+ Agregar</button>
                  <button
                    onClick={() => openRemoveModal("negocio")}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-zinc-700 text-zinc-500 hover:border-rose-500/30 hover:text-rose-400 transition-all"
                  >− Quitar</button>
                </div>
              </div>
              <div className="space-y-2">
                {[...negocioHabits.filter((h) => !(state.hiddenHabits || []).includes(h.id) && isHabitVisibleToday(h)),
                  ...state.customHabits.filter((h) => h.category === "negocio" && isHabitVisibleToday(h))].map((h) => {
                  const ov = (state.habitOverrides || {})[h.id];
                  const displayH = ov ? { ...h, ...ov } : h;
                  return (
                    <HabitRow
                      key={h.id}
                      id={h.id}
                      icon={displayH.icon}
                      label={displayH.label}
                      pts={XP_PER_ACTION[h.id] ?? 10}
                      checked={state.todayChecks[h.id] || false}
                      onToggle={toggleHabit}
                      onEdit={() => openEditHabit(displayH)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Penalizaciones diarias */}
            {(() => {
              const penaltyActive = state.currentWeek >= 5;
              const incumplidos = Math.min(5, totalHabits - totalChecked);
              const xpLoss   = incumplidos * 5;
              const coinLoss = incumplidos * 3;
              return (
                <div className={`rounded-2xl border p-5 ${penaltyActive ? "border-rose-500/30 bg-rose-500/5" : "border-zinc-800 bg-zinc-900"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">⚠️</span>
                    <h3 className="text-xs text-rose-400 font-black uppercase tracking-widest">
                      Penalización diaria
                    </h3>
                  </div>
                  {penaltyActive ? (
                    <>
                      <div className="text-xs text-zinc-400 mb-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>Sin cumplir: <span className="text-white font-bold">{totalHabits - totalChecked}</span></span>
                        <span>Penalización: <span className="text-rose-400 font-black">-{xpLoss} XP</span></span>
                        <span className="text-amber-400 font-bold">-{coinLoss} 🪙</span>
                      </div>
                      <div className="text-xs text-zinc-600">
                        -5 XP y -3 monedas por cada hábito sin completar · cada día desde la semana 5.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-zinc-500">
                        Las penalizaciones se activan a partir de la{" "}
                        <span className="text-amber-400 font-bold">semana 5</span>.
                        Estás en la semana {state.currentWeek} — aún en período de adaptación.
                      </div>
                      <div className="text-xs text-zinc-600 mt-2">
                        Cada hábito sin cumplir restará{" "}
                        <span className="text-rose-400 font-bold">-5 XP</span>
                        {" "}y{" "}
                        <span className="text-amber-400 font-bold">-5 🪙</span>
                        {" "}por día — activo desde la semana 5.
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`text-sm font-black ${totalHabits - totalChecked === 0 ? "text-zinc-600" : "text-rose-400"}`}>
                          {totalHabits - totalChecked === 0 ? "0 XP" : `-${(totalHabits - totalChecked) * 5} XP`}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className={`text-sm font-black ${totalHabits - totalChecked === 0 ? "text-zinc-600" : "text-amber-400"}`}>
                          {totalHabits - totalChecked === 0 ? "0 🪙" : `-${(totalHabits - totalChecked) * 5} 🪙`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Avanzar semana */}
            {(() => {
              const isCompleted = state.planCompleted;
              const notStarted = !state.planStarted;
              const locked = state.planStarted && !weekUnlocked && !isCompleted;
              const ready = weekUnlocked && !isCompleted;

              // Tiempo restante hasta desbloqueo (para mostrar en el botón bloqueado)
              let daysLeft = null;
              if (locked && state.weekStartDate) {
                const msLeft = (state.weekStartDate + 7 * 24 * 60 * 60 * 1000) - Date.now();
                daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
              }

              return (
                <motion.button
                  onClick={advanceWeek}
                  disabled={isCompleted || locked || notStarted}
                  whileTap={ready ? { scale: 0.97 } : {}}
                  className={`w-full py-3 sm:py-4 rounded-2xl text-sm font-bold transition-all duration-300 btn-premium ${
                    isCompleted
                      ? "border border-zinc-700 text-zinc-500 opacity-60 cursor-not-allowed"
                      : notStarted
                      ? "border border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed"
                      : locked
                      ? "border border-zinc-700 text-zinc-600 cursor-not-allowed opacity-70"
                      : "btn-week-ready border-0 cursor-pointer"
                  }`}
                >
                  {isCompleted
                    ? "🏆 Plan completado — ¡Lo lograste!"
                    : notStarted
                    ? "🔒 Inicia el plan para desbloquear"
                    : locked
                    ? `🔒 Bloqueado — faltan ${daysLeft === 1 ? "1 día" : `${daysLeft} días`} para avanzar`
                    : state.currentWeek === 12
                    ? "🏆 ¡Finalizar Plan 90 Días!"
                    : `🚀 Completar semana ${state.currentWeek} y avanzar`}
                </motion.button>
              );
            })()}
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB: NEGOCIO
        ══════════════════════════════════════ */}
        {activeTab === "negocio" && (
          <motion.div key="negocio" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3, ease:"easeOut" }} className="space-y-4 sm:space-y-6">
            {/* Objetivos mensuales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { month: 1, label: "MES 1" },
                { month: 2, label: "MES 2" },
                { month: 3, label: "MES 3" },
              ].map((m) => {
                const idx = m.month - 1;
                const rev = state.monthlyRevenue[idx] || 0;
                const target = (state.monthlyTargets || [1000, 2000, 3000])[idx];
                const isActive = m.month === currentMonth;
                const isDone = rev >= target;
                const isSelected = selectedMonthCard === idx;
                return (
                  <div
                    key={m.month}
                    onClick={() => {
                      if (selectedMonthCard === idx) {
                        setSelectedMonthCard(null);
                        setEditingMonthTarget(false);
                      } else {
                        setSelectedMonthCard(idx);
                        setEditingMonthTarget(false);
                      }
                    }}
                    className={`rounded-2xl border p-4 transition-all cursor-pointer select-none ${
                      isDone
                        ? isSelected
                          ? "border-amber-400 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.18)]"
                          : "border-amber-500/50 bg-amber-500/10 hover:border-amber-400/70"
                        : isSelected
                        ? "border-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                        : isActive
                        ? "border-teal-500/30 bg-teal-500/5 hover:border-teal-400/60"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                    }`}
                  >
                    {/* Label + indicador seleccionado */}
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-xs font-black uppercase tracking-widest ${
                        isDone ? "text-amber-400" : isSelected ? "text-teal-300" : isActive ? "text-teal-400" : "text-zinc-600"
                      }`}>
                        {m.label}
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-black text-teal-400 bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded-lg uppercase tracking-widest">
                          seleccionado
                        </span>
                      )}
                    </div>

                    {/* Ingresos actuales */}
                    <div className={`text-xl font-black ${isDone ? "text-amber-400" : "text-white"}`}>
                      ${rev.toLocaleString()}
                    </div>

                    {/* Meta — editable si está seleccionado */}
                    <div className="text-xs text-zinc-500 mb-2 mt-0.5">
                      {isSelected && editingMonthTarget ? (
                        <div
                          className="flex items-center gap-1.5 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-zinc-400">Meta: $</span>
                          <input
                            autoFocus
                            type="number"
                            min="1"
                            value={monthTargetInput}
                            onChange={(e) => setMonthTargetInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = Math.max(1, parseInt(monthTargetInput) || 1);
                                setState((s) => {
                                  const newT = [...(s.monthlyTargets || [1000, 2000, 3000])];
                                  newT[idx] = val;
                                  // Redistribuir weeklyIncomes de las 4 semanas del mes proporcionalmente
                                  const newIncomes = [...s.weeklyIncomes];
                                  const baseSum = [0,1,2,3].reduce((sum, off) => sum + WEEK_TARGETS[idx*4+off].income, 0);
                                  [0,1,2,3].forEach((off) => {
                                    const wi = idx*4 + off;
                                    newIncomes[wi] = Math.round(WEEK_TARGETS[wi].income / baseSum * val);
                                  });
                                  return { ...s, monthlyTargets: newT, weeklyIncomes: newIncomes };
                                });
                                showNotification(`🎯 Meta Mes ${m.month} → $${val.toLocaleString()}`);
                                setEditingMonthTarget(false);
                              }
                              if (e.key === "Escape") setEditingMonthTarget(false);
                            }}
                            className="w-24 bg-zinc-800 border border-teal-500/60 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-teal-400 transition-colors"
                          />
                          <button
                            onClick={() => {
                              const val = Math.max(1, parseInt(monthTargetInput) || 1);
                              setState((s) => {
                                const newT = [...(s.monthlyTargets || [1000, 2000, 3000])];
                                newT[idx] = val;
                                // Redistribuir weeklyIncomes de las 4 semanas del mes proporcionalmente
                                const newIncomes = [...s.weeklyIncomes];
                                const baseSum = [0,1,2,3].reduce((sum, off) => sum + WEEK_TARGETS[idx*4+off].income, 0);
                                [0,1,2,3].forEach((off) => {
                                  const wi = idx*4 + off;
                                  newIncomes[wi] = Math.round(WEEK_TARGETS[wi].income / baseSum * val);
                                });
                                return { ...s, monthlyTargets: newT, weeklyIncomes: newIncomes };
                              });
                              showNotification(`🎯 Meta Mes ${m.month} → $${val.toLocaleString()}`);
                              setEditingMonthTarget(false);
                            }}
                            className="px-2 py-0.5 bg-teal-500 text-zinc-900 rounded-lg font-black text-xs hover:bg-teal-400 transition-colors"
                          >✓</button>
                          <button
                            onClick={() => setEditingMonthTarget(false)}
                            className="px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded-lg font-black text-xs hover:bg-zinc-600 transition-colors"
                          >✕</button>
                        </div>
                      ) : (
                        <span
                          className={`flex items-center gap-1 ${isSelected ? "group/meta cursor-pointer" : ""}`}
                          onClick={isSelected ? (e) => {
                            e.stopPropagation();
                            setMonthTargetInput(target.toString());
                            setEditingMonthTarget(true);
                          } : undefined}
                          title={isSelected ? "Clic para editar la meta" : undefined}
                        >
                          Meta: ${target.toLocaleString()}
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover/meta:text-teal-400 transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
                            </svg>
                          )}
                        </span>
                      )}
                    </div>

                    <ProgressBar
                      value={rev}
                      max={target}
                      color={isDone ? "amber" : "teal"}
                      height="h-2"
                    />
                    {isDone && (
                      <div className="text-xs text-amber-400 mt-1 font-bold">✓ COMPLETADO</div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Hint cuando hay un mes seleccionado */}
            {selectedMonthCard !== null && !([
              state.monthlyRevenue[selectedMonthCard] || 0
            ][0] >= (state.monthlyTargets || [1000,2000,3000])[selectedMonthCard]) && (
              <p className="text-xs text-zinc-600 -mt-1 text-center">
                Toca <span className="text-teal-400 font-bold">Meta: $…</span> para cambiar el objetivo del mes {selectedMonthCard + 1} · Toca el card de nuevo para deseleccionar
              </p>
            )}

            {/* Objetivo semana actual */}
            {(() => {
              const price = pdfPrice;
              const weekIncome = state.weeklyIncomes[state.currentWeek - 1] ?? currentWeekTarget.income;
              const pdfsNeeded = closestPdfs(weekIncome, price);
              return (
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-amber-400 font-black uppercase tracking-widest mb-4">
                Semana {state.currentWeek} — Objetivo
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                <div>
                  <div className="text-xs text-zinc-500">Meta ventas</div>
                  <div className="text-xl sm:text-2xl font-black text-white">{pdfsNeeded}</div>
                  <div className="text-xs text-teal-400">PDFs</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Inv/día</div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    ${Math.round(currentWeekTarget.investment / 7)}
                  </div>
                  <div className="text-xs text-zinc-500">en ads</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Meta</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400">${weekIncome}</div>
                  <div className="text-xs text-zinc-500">esta sem.</div>
                </div>
              </div>
              <div className="text-xs text-zinc-500 mb-2">
                Ventas actuales:{" "}
                <span className="text-white font-bold">{state.weeklySales[state.currentWeek - 1] || 0}</span>{" "}
                / {pdfsNeeded}
              </div>
              <ProgressBar
                value={state.weeklySales[state.currentWeek - 1] || 0}
                max={pdfsNeeded}
                color="amber"
                height="h-3"
              />
            </div>
              );
            })()}

            {/* ── Detalle de semanas del mes seleccionado */}
            <AnimatePresence>
              {selectedMonthCard !== null && (() => {
                const m = selectedMonthCard;
                const firstWeekIdx = m * 4;
                const price = pdfPrice;

                // Ingresos de las 4 semanas del mes (custom o por defecto)
                const weekIncomes = [0,1,2,3].map((offset) => {
                  const wi = firstWeekIdx + offset;
                  return state.weeklyIncomes[wi] ?? WEEK_TARGETS[wi].income;
                });
                const totalIncome = weekIncomes.reduce((a, b) => a + b, 0);

                const weeks = [0,1,2,3].map((offset) => {
                  const wi = firstWeekIdx + offset;
                  const base = WEEK_TARGETS[wi];
                  const income = weekIncomes[offset];
                  return {
                    weekNum:     wi + 1,
                    weekIdx:     wi,
                    sales:       closestPdfs(income, price),
                    investment:  base.investment,
                    invDay:      Math.round(base.investment / 7),
                    income,
                    actualSales: state.weeklySales[wi] || 0,
                    isCurrent:   wi === state.currentWeek - 1,
                  };
                });

                return (
                  <motion.div
                    key={`month-detail-${m}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs text-teal-400 font-black uppercase tracking-widest">
                        📅 MES {m + 1} — Semanas {firstWeekIdx + 1} a {firstWeekIdx + 4}
                      </h3>
                      <span className="text-xs text-zinc-500 font-bold">
                        Meta total: <span className="text-teal-300 font-black">${totalIncome.toLocaleString()}</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mb-4">Toca cualquier valor de <span className="text-teal-400">Meta $</span> para editar · el total del mes se actualiza solo</p>

                    {/* Cabecera de columnas */}
                    <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-2 px-1">
                      <div className="text-[9px] sm:text-[10px] text-zinc-600 font-black uppercase tracking-wide sm:tracking-widest">Sem</div>
                      <div className="text-[9px] sm:text-[10px] text-zinc-600 font-black uppercase tracking-wide sm:tracking-widest text-center">PDFs</div>
                      <div className="text-[9px] sm:text-[10px] text-zinc-600 font-black uppercase tracking-wide sm:tracking-widest text-center">Inv/d</div>
                      <div className="text-[9px] sm:text-[10px] text-zinc-600 font-black uppercase tracking-wide sm:tracking-widest text-center">Meta $</div>
                      <div className="text-[9px] sm:text-[10px] text-zinc-600 font-black uppercase tracking-wide sm:tracking-widest text-center">Real</div>
                    </div>

                    {/* Filas de semanas */}
                    <div className="space-y-1.5">
                      {weeks.map((w) => {
                        const done = w.actualSales >= w.sales;
                        const isEditingThisWeek = editingWeekIncome === w.weekIdx;
                        return (
                          <div
                            key={w.weekNum}
                            className={`grid grid-cols-5 gap-1 sm:gap-2 items-center px-2 sm:px-3 py-2.5 rounded-xl border transition-all ${
                              w.isCurrent
                                ? "border-amber-500/40 bg-amber-500/8"
                                : done && w.actualSales > 0
                                ? "border-teal-500/30 bg-teal-500/5"
                                : "border-zinc-800 bg-zinc-900/60"
                            }`}
                          >
                            {/* Semana */}
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-black ${w.isCurrent ? "text-amber-400" : "text-zinc-400"}`}>
                                S{w.weekNum}
                              </span>
                              {w.isCurrent && (
                                <span className="text-[8px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded uppercase tracking-wider leading-none">hoy</span>
                              )}
                            </div>
                            {/* PDFs — se recalcula con precio */}
                            <div className={`text-xs sm:text-sm font-black text-center ${w.isCurrent ? "text-white" : "text-zinc-300"}`}>
                              {w.sales}
                            </div>
                            {/* Inv/día */}
                            <div className={`text-xs sm:text-sm font-bold text-center ${w.isCurrent ? "text-white" : "text-zinc-400"}`}>
                              ${w.invDay}
                            </div>
                            {/* Meta $ — editable */}
                            <div className="text-center">
                              {isEditingThisWeek ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="1"
                                  value={weekIncomeInput}
                                  onChange={(e) => setWeekIncomeInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = Math.max(1, parseInt(weekIncomeInput) || 1);
                                      setState((s) => {
                                        const newIncomes = [...s.weeklyIncomes];
                                        newIncomes[w.weekIdx] = val;
                                        // recalcular meta del mes
                                        const mIdx = Math.floor(w.weekIdx / 4);
                                        const newMonthTotal = [0,1,2,3].reduce((sum, off) => sum + (newIncomes[mIdx*4+off] ?? WEEK_TARGETS[mIdx*4+off].income), 0);
                                        const newTargets = [...(s.monthlyTargets || [1000,2000,3000])];
                                        newTargets[mIdx] = newMonthTotal;
                                        return { ...s, weeklyIncomes: newIncomes, monthlyTargets: newTargets };
                                      });
                                      setEditingWeekIncome(null);
                                    }
                                    if (e.key === "Escape") setEditingWeekIncome(null);
                                  }}
                                  onBlur={() => {
                                    const val = Math.max(1, parseInt(weekIncomeInput) || 1);
                                    setState((s) => {
                                      const newIncomes = [...s.weeklyIncomes];
                                      newIncomes[w.weekIdx] = val;
                                      const mIdx = Math.floor(w.weekIdx / 4);
                                      const newMonthTotal = [0,1,2,3].reduce((sum, off) => sum + (newIncomes[mIdx*4+off] ?? WEEK_TARGETS[mIdx*4+off].income), 0);
                                      const newTargets = [...(s.monthlyTargets || [1000,2000,3000])];
                                      newTargets[mIdx] = newMonthTotal;
                                      return { ...s, weeklyIncomes: newIncomes, monthlyTargets: newTargets };
                                    });
                                    setEditingWeekIncome(null);
                                  }}
                                  className="w-full bg-zinc-800 border border-teal-500/60 rounded-lg px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-teal-400 transition-colors"
                                />
                              ) : (
                                <button
                                  onClick={() => { setEditingWeekIncome(w.weekIdx); setWeekIncomeInput(String(w.income)); }}
                                  className={`text-xs sm:text-sm font-black w-full text-center rounded hover:bg-teal-500/10 transition-colors px-0.5 ${w.isCurrent ? "text-amber-400" : "text-zinc-300 hover:text-teal-300"}`}
                                  title="Toca para editar"
                                >
                                  ${w.income.toLocaleString()}
                                </button>
                              )}
                            </div>
                            {/* Real */}
                            <div className={`text-xs sm:text-sm font-bold text-center ${
                              done && w.actualSales > 0 ? "text-teal-400" : w.actualSales > 0 ? "text-zinc-400" : "text-zinc-700"
                            }`}>
                              {w.actualSales > 0 ? w.actualSales : "—"}
                              {done && w.actualSales > 0 && <span className="ml-0.5 text-[10px]">✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total del mes */}
                    <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-y-1">
                      <span className="text-xs text-zinc-500 font-bold">Total mes</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-xs text-zinc-400">
                          <span className="text-white font-black">{weeks.reduce((a, w) => a + w.sales, 0)}</span> PDFs
                        </span>
                        <span className="text-xs text-zinc-400">
                          <span className="text-teal-300 font-black">${totalIncome.toLocaleString()}</span> meta
                        </span>
                        <span className="text-xs text-zinc-400">
                          <span className="text-amber-400 font-black">{weeks.reduce((a, w) => a + w.actualSales, 0)}</span> reales
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Registrar ventas */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <h3 className="text-xs text-teal-400 font-black uppercase tracking-widest flex-shrink-0">
                  Registrar Ventas
                </h3>
                <span className="text-xs text-zinc-500 flex-shrink-0">
                  Precio: <span className="text-violet-400 font-black">${pdfPrice}</span>/PDF
                </span>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="1"
                  value={salesInput}
                  onChange={(e) => setSalesInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSales()}
                  placeholder="# de PDFs vendidos"
                  className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={addSales}
                  className="px-5 py-2.5 bg-amber-500 text-zinc-900 rounded-xl font-black text-sm hover:bg-amber-400 transition-colors active:scale-95"
                >
                  +
                </button>
              </div>
              {/* Preview del ingreso */}
              {salesInput && parseInt(salesInput) > 0 ? (
                <p className="text-xs text-zinc-400 mt-2">
                  {parseInt(salesInput)} PDFs × <span className="text-violet-400 font-bold">${pdfPrice}</span> = <span className="text-amber-400 font-black">${(parseInt(salesInput) * pdfPrice).toLocaleString()}</span>
                </p>
              ) : (
                <p className="text-xs text-zinc-600 mt-2">
                  Precio por PDF: <span className="text-violet-400/70 font-bold">${pdfPrice}</span> · cámbialo en la calculadora ⚙️
                </p>
              )}
            </div>

            {/* ── Calculadora de PDFs */}
            {(() => {
              const weekIncome = state.weeklyIncomes[state.currentWeek - 1] ?? currentWeekTarget.income;

              // Función que aplica los 3 valores y propaga cambios
              const applyCalc = (newIncome, newPrice, newPdfs, source) => {
                let income = newIncome;
                let price  = newPrice;
                // Recalcular el tercero según cuál fue la fuente
                if (source === "income" || source === "price") {
                  // income y price dados → PDFs se actualiza solo (no hay que hacer nada extra)
                } else if (source === "pdfs") {
                  // PDFs y precio dados → recalcular ingreso
                  income = newPdfs * price;
                }
                // Guardar precio globalmente
                setPdfPrice(price);
                setPdfPriceInput(String(price));
                // Guardar ingreso en weeklyIncomes y recalcular meta del mes
                setState((s) => {
                  const newIncomes = [...s.weeklyIncomes];
                  newIncomes[s.currentWeek - 1] = income;
                  const mIdx = Math.floor((s.currentWeek - 1) / 4);
                  const newMonthTotal = [0,1,2,3].reduce((sum, off) =>
                    sum + (newIncomes[mIdx*4+off] ?? WEEK_TARGETS[mIdx*4+off].income), 0);
                  const newTargets = [...(s.monthlyTargets || [1000,2000,3000])];
                  newTargets[mIdx] = newMonthTotal;
                  return { ...s, weeklyIncomes: newIncomes, monthlyTargets: newTargets, pdfPrice: price };
                });
                showNotification(`⚙️ Ingreso S${state.currentWeek}: $${income} · Precio: $${price} · PDFs: ${closestPdfs(income, price)}`);
              };

              const currentPdfs = closestPdfs(weekIncome, pdfPrice);

              return (
                <div className="bg-zinc-900 rounded-2xl border border-violet-500/30 p-5">
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <span className="text-base flex-shrink-0">⚙️</span>
                    <h3 className="text-xs text-violet-400 font-black uppercase tracking-wide truncate">
                      Calculadora · Mes {currentMonth} · S{state.currentWeek}
                    </h3>
                  </div>
                  <p className="text-[10px] text-zinc-600 mb-4">
                    Edita cualquier campo y presiona <span className="text-violet-400">OK</span> o <span className="text-violet-400">Enter</span> — los demás se recalculan solos
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">

                    {/* Columna 1 — Ingreso */}
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500 mb-1.5">
                        Ingreso S{state.currentWeek}
                        <span className="text-zinc-700 ml-1">(actual <span className="text-amber-400/70">${weekIncome}</span>)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={calcIncome}
                          onChange={(e) => setCalcIncome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && calcIncome !== "") {
                              const inc = Math.max(1, parseInt(calcIncome) || 1);
                              applyCalc(inc, pdfPrice, null, "income");
                              setCalcIncome("");
                            }
                          }}
                          placeholder={`${weekIncome}`}
                          className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (calcIncome === "") return;
                            const inc = Math.max(1, parseInt(calcIncome) || 1);
                            applyCalc(inc, pdfPrice, null, "income");
                            setCalcIncome("");
                          }}
                          className="w-12 h-10 sm:w-14 sm:h-11 rounded-2xl bg-amber-500 text-zinc-900 font-black text-sm hover:bg-amber-400 transition-colors active:scale-95 flex-shrink-0"
                        >OK</button>
                      </div>
                    </div>

                    {/* Columna 2 — Precio */}
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500 mb-1.5">
                        Precio por PDF
                        <span className="text-zinc-700 ml-1">(actual <span className="text-violet-400/70">${pdfPrice}</span>)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={pdfPriceInput}
                          onChange={(e) => setPdfPriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const price = Math.max(1, parseInt(pdfPriceInput) || 1);
                              // Precio nuevo + ingreso actual → recalcula PDFs
                              applyCalc(weekIncome, price, null, "price");
                            }
                          }}
                          placeholder="20"
                          className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <button
                          onClick={() => {
                            const price = Math.max(1, parseInt(pdfPriceInput) || 1);
                            applyCalc(weekIncome, price, null, "price");
                          }}
                          className="w-12 h-10 sm:w-14 sm:h-11 rounded-2xl bg-violet-500 text-white font-black text-sm hover:bg-violet-400 transition-colors active:scale-95 flex-shrink-0"
                        >OK</button>
                      </div>
                    </div>

                    {/* Columna 3 — PDFs (editable) */}
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500 mb-1.5">
                        PDFs necesarios
                        <span className="text-zinc-700 ml-1">(actual <span className="text-violet-400/70">{currentPdfs}</span>)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={calcPrice}
                          onChange={(e) => setCalcPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && calcPrice !== "") {
                              const pdfs = Math.max(1, parseInt(calcPrice) || 1);
                              // PDFs × precio → nuevo ingreso
                              applyCalc(null, pdfPrice, pdfs, "pdfs");
                              setCalcPrice("");
                            }
                          }}
                          placeholder={`${currentPdfs}`}
                          className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (calcPrice === "") return;
                            const pdfs = Math.max(1, parseInt(calcPrice) || 1);
                            applyCalc(null, pdfPrice, pdfs, "pdfs");
                            setCalcPrice("");
                          }}
                          className="w-12 h-10 sm:w-14 sm:h-11 rounded-2xl bg-violet-500 text-white font-black text-sm hover:bg-violet-400 transition-colors active:scale-95 flex-shrink-0"
                        >OK</button>
                      </div>
                    </div>
                  </div>

                  {/* Resumen live */}
                  <div className="mt-4 p-3 bg-zinc-800/50 rounded-xl flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-500">S{state.currentWeek}:</span>
                    <span className="text-zinc-400">Ingreso <span className="text-amber-400 font-black">${weekIncome}</span></span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-400">Precio <span className="text-violet-400 font-black">${pdfPrice}</span></span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-400">PDFs <span className="text-white font-black">{currentPdfs}</span></span>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => {
                        setCalcIncome(""); setCalcPrice("");
                        setCalcIncomeApplied(""); setCalcPriceApplied("");
                        setPdfPrice(20); setPdfPriceInput("20");
                        setState((s) => ({
                          ...s,
                          weeklyIncomes: [
                            Math.round(100/860*1000), Math.round(160/860*1000), Math.round(240/860*1000), Math.round(360/860*1000),
                            Math.round(400/2200*2000), Math.round(500/2200*2000), Math.round(600/2200*2000), Math.round(700/2200*2000),
                            Math.round(700/3400*3000), Math.round(800/3400*3000), Math.round(900/3400*3000), Math.round(1000/3400*3000),
                          ],
                          monthlyTargets: [1000,2000,3000],
                          pdfPrice: 20,
                        }));
                        showNotification("Calculadora reseteada ↺");
                      }}
                      className="text-zinc-600 hover:text-rose-400 transition-colors font-bold"
                    >↺ resetear</button>
                  </div>
                </div>
              );
            })()}

            {/* Gráfico semanal */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-4">
                Ventas Semana a Semana
              </h3>
              <div className="flex items-end gap-1.5" style={{ height: "96px" }}>
                {state.weeklySales.map((sales, i) => {
                  const target = WEEK_TARGETS[i]?.sales || 1;
                  const pct = Math.min(100, (sales / target) * 100);
                  const isActive = i === state.currentWeek - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-zinc-800 rounded-t-md overflow-hidden flex flex-col justify-end"
                        style={{ height: "72px" }}
                      >
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isActive
                              ? "bg-amber-400"
                              : sales >= target
                              ? "bg-teal-400"
                              : "bg-zinc-600"
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          isActive ? "text-amber-400" : "text-zinc-600"
                        }`}
                      >
                        S{i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reglas del negocio */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-rose-400 font-black uppercase tracking-widest mb-3">
                📌 Reglas del Negocio
              </h3>
              <div className="space-y-2">
                {[
                  "Crear 2 anuncios nuevos por semana",
                  "Nunca subir presupuesto de golpe",
                  "Si bajan ventas, NO entrar en pánico",
                  "Siempre reinvertir parte de las ganancias",
                ].map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <span className="text-amber-500 font-black flex-shrink-0">{i + 1}.</span>
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB: MENTE
        ══════════════════════════════════════ */}
        {activeTab === "mente" && (
          <motion.div key="mente" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3, ease:"easeOut" }} className="space-y-4 sm:space-y-6">
            {/* Libros */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-teal-400 font-black uppercase tracking-widest">
                  📚 Libros (3 en 90 días)
                </h3>
                <button
                  onClick={() => {
                    if (!window.confirm("¿Reiniciar progreso de todos los libros?")) return;
                    setState((s) => ({
                      ...s,
                      books: s.books.map((b) => ({ ...b, pagesRead: 0, done: false })),
                    }));
                  }}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400 transition-all flex items-center gap-1"
                >
                  ↺ Reset
                </button>
              </div>
              <div className="space-y-4">
                {state.books.map((book, i) => {
                  const weekRanges = ["S1–S4", "S5–S8", "S9–S12"];
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border overflow-hidden ${
                        book.done
                          ? "border-teal-500/40 bg-teal-500/5"
                          : "border-zinc-800 bg-zinc-950"
                      }`}
                    >
                      {/* Header libro */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{book.title}</span>
                          <span className="text-xs text-zinc-600 font-medium">({weekRanges[i]})</span>
                        </div>
                        {book.done && (
                          <span className="text-xs text-teal-400 font-black">✓ TERMINADO</span>
                        )}
                      </div>

                      {/* Páginas leídas + input total */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-zinc-500">
                          {book.pagesRead} / {book.totalPages} páginas
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">Total:</span>
                          <input
                            type="number"
                            min="1"
                            value={book.totalPages}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setState((s) => {
                                const newBooks = [...s.books];
                                newBooks[i] = {
                                  ...newBooks[i],
                                  totalPages: val,
                                  done: newBooks[i].pagesRead >= val,
                                };
                                return { ...s, books: newBooks };
                              });
                            }}
                            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 text-center focus:outline-none focus:border-teal-500 transition-colors"
                          />
                        </div>
                      </div>

                      <ProgressBar
                        value={book.pagesRead}
                        max={book.totalPages}
                        color="teal"
                        height="h-2"
                      />

                      {!book.done && (
                        <div className="flex gap-2 mt-3">
                          <input
                            type="number"
                            min="0"
                            value={bookPage[i]}
                            onChange={(e) => {
                              const nb = [...bookPage];
                              nb[i] = e.target.value;
                              setBookPage(nb);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && updateBookPages(i)}
                            placeholder="Página actual"
                            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                          <button
                            onClick={() => updateBookPages(i)}
                            className="px-4 py-1.5 bg-teal-500 text-zinc-900 rounded-lg font-black text-xs hover:bg-teal-400 transition-colors active:scale-95"
                          >
                            Guardar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plan semanal mentalidad */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-violet-400 font-black uppercase tracking-widest mb-4">
                📆 Plan Semanal Mentalidad
              </h3>
              <div className="space-y-3">
                {[
                  {
                    weeks: "1–2",
                    focus: "Construir hábito",
                    detail:
                      "10 páginas diarias. Escribir metas. 3 podcasts. 1 reflexión semanal.",
                  },
                  {
                    weeks: "3–4",
                    focus: "Aumentar enfoque",
                    detail: "12 páginas. Empezar notas del libro. Resumen libro 1.",
                  },
                  {
                    weeks: "5–6",
                    focus: "Segundo libro",
                    detail: "Aplicar ideas del libro 1. Metas más específicas.",
                  },
                  {
                    weeks: "7–8",
                    focus: "Profundidad",
                    detail: "15 páginas. Mini ensayo de lo aprendido.",
                  },
                  {
                    weeks: "9–10",
                    focus: "Tercer libro",
                    detail: "Comparar ideas entre libros. Identidad: 'soy disciplinado'.",
                  },
                  {
                    weeks: "11–12",
                    focus: "Cierre fuerte",
                    detail:
                      "Resumen libro 3. Documento final de aprendizajes. Redefinir próximos 90 días.",
                  },
                ].map((item, i) => {
                  const blockWeek = (i + 1) * 2;
                  const isPast = blockWeek < state.currentWeek;
                  const isCurrent = Math.ceil(state.currentWeek / 2) === i + 1;
                  return (
                    <div
                      key={i}
                      className={`flex gap-4 p-3 rounded-xl transition-all ${
                        isCurrent
                          ? "border border-violet-500/30 bg-violet-500/5"
                          : isPast
                          ? "opacity-40"
                          : "border border-zinc-800"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isPast
                            ? "bg-zinc-700 text-zinc-400"
                            : isCurrent
                            ? "bg-violet-500 text-white"
                            : "bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        {isPast ? "✓" : i + 1}
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Sem {item.weeks}</div>
                        <div
                          className={`text-sm font-bold ${
                            isCurrent ? "text-violet-400" : "text-zinc-300"
                          }`}
                        >
                          {item.focus}
                        </div>
                        <div className="text-xs text-zinc-600 mt-0.5">{item.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Podcasts */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-amber-400 font-black uppercase tracking-widest mb-3">
                🎧 Podcasts esta semana
              </h3>
              <div className="flex gap-3 mb-3">
                {["Negocios", "Mentalidad", "Disciplina"].map((label, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      setState((s) => {
                        const wasActive = i < s.podcastsThisWeek;
                        const newCount = wasActive ? i : Math.min(3, i + 1);
                        const gaining = !wasActive;
                        if (gaining) setTimeout(() => showNotification(`🎧 Podcast completado! +5 XP +3 🪙`), 0);
                        return {
                          ...s,
                          podcastsThisWeek: newCount,
                          xp: gaining ? (isNaN(s.xp) ? 5 : s.xp + 5) : Math.max(0, isNaN(s.xp) ? 0 : s.xp - 5),
                          coins: gaining ? (isNaN(s.coins) ? 3 : s.coins + 3) : Math.max(0, isNaN(s.coins) ? 0 : s.coins - 3),
                        };
                      })
                    }
                    className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all duration-200 ${
                      i < state.podcastsThisWeek
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                        : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ProgressBar value={state.podcastsThisWeek} max={3} color="amber" height="h-2" />
              <p className="text-xs text-zinc-600 mt-1">
                {state.podcastsThisWeek}/3 esta semana · Meta: 3 por semana
              </p>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB: CUERPO
        ══════════════════════════════════════ */}
        {activeTab === "cuerpo" && (
          <motion.div key="cuerpo" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3, ease:"easeOut" }} className="space-y-4 sm:space-y-6">

            {/* Encabezado — Fase actual */}
            <div className="bg-zinc-900 rounded-2xl border border-rose-500/30 p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💪</span>
                <div>
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">Parte {phase}</div>
                  <h2 className="text-xl font-black text-rose-400">
                    ENTRENAMIENTO{" "}
                    <span className="text-zinc-500 text-sm font-medium">(90 días)</span>
                  </h2>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Objetivo:{" "}
                <span className="text-zinc-300">
                  {phase === 1 && "energía alta · disciplina física"}
                  {phase === 2 && "fuerza progresiva · consistencia"}
                  {phase === 3 && "intensidad máxima · mide tu cambio"}
                </span>
              </p>
            </div>

            {/* Base semanal obligatoria */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-rose-400 font-black uppercase tracking-widest mb-4">
                Base semanal obligatoria
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: "🏋️", count: "3 días", label: "fuerza o entrenamiento intenso" },
                  { icon: "🚶", count: "2 días", label: "actividad ligera (caminar 30–45 min)" },
                  { icon: "🧘", count: "1 día",  label: "movilidad/estiramiento" },
                  { icon: "😴", count: "1 día",  label: "descanso" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center"
                  >
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="text-sm font-black text-rose-400">{item.count}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 leading-tight">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estructura semanal tipo — editable */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-zinc-400 font-black uppercase tracking-widest">
                  Estructura semanal tipo
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        weeklySchedule: [
                          ...s.weeklySchedule,
                          { day: "Nuevo día", icon: "💪", activity: "Actividad" },
                        ],
                      }));
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-rose-500/50 hover:text-rose-400 transition-all"
                  >
                    + Agregar
                  </button>
                  <button
                    onClick={() => {
                      if (state.weeklySchedule.length <= 1) return;
                      setState((s) => ({
                        ...s,
                        weeklySchedule: s.weeklySchedule.slice(0, -1),
                      }));
                      if (editingDayIdx === state.weeklySchedule.length - 1) {
                        setEditingDayIdx(null);
                      }
                    }}
                    disabled={state.weeklySchedule.length <= 1}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:border-rose-500/30 hover:text-rose-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    − Quitar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {state.weeklySchedule.map((entry, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
                  >
                    {editingDayIdx === idx ? (
                      /* ── Modo edición */
                      <div className="p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editingDayValue}
                            onChange={(e) => setEditingDayValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setState((s) => {
                                  const ns = [...s.weeklySchedule];
                                  ns[idx] = { ...ns[idx], activity: editingDayValue };
                                  return { ...s, weeklySchedule: ns };
                                });
                                setEditingDayIdx(null);
                              }
                              if (e.key === "Escape") setEditingDayIdx(null);
                            }}
                            placeholder="Describe la actividad..."
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
                          />
                          <button
                            onClick={() => {
                              setState((s) => {
                                const ns = [...s.weeklySchedule];
                                ns[idx] = { ...ns[idx], activity: editingDayValue };
                                return { ...s, weeklySchedule: ns };
                              });
                              setEditingDayIdx(null);
                            }}
                            className="px-3 py-1.5 bg-rose-500 text-white rounded-lg font-black text-xs hover:bg-rose-400 transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingDayIdx(null)}
                            className="px-3 py-1.5 bg-zinc-700 text-zinc-400 rounded-lg font-black text-xs hover:bg-zinc-600 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Selector de icono */}
                        <div className="flex gap-1 flex-wrap">
                          {["💪", "🚶", "🧘", "😴", "🏃", "🚴", "🏊", "⚽", "🥊", "🧗"].map((em) => (
                            <button
                              key={em}
                              onClick={() =>
                                setState((s) => {
                                  const ns = [...s.weeklySchedule];
                                  ns[idx] = { ...ns[idx], icon: em };
                                  return { ...s, weeklySchedule: ns };
                                })
                              }
                              className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                                entry.icon === em
                                  ? "bg-rose-500/30 border border-rose-500/50"
                                  : "bg-zinc-800 hover:bg-zinc-700"
                              }`}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* ── Modo visualización */
                      <button
                        onClick={() => {
                          setEditingDayIdx(idx);
                          setEditingDayValue(entry.activity);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-900 transition-colors group"
                      >
                        <span className="text-xl flex-shrink-0">{entry.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-500 font-bold">{entry.day}</div>
                          <div className="text-sm text-zinc-200 truncate">{entry.activity}</div>
                        </div>
                        <span className="text-zinc-700 group-hover:text-zinc-500 flex-shrink-0 transition-colors">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-zinc-600 mt-3">
                Toca cualquier día para editar · Cambia el ícono en el selector de emojis
              </p>
            </div>

            {/* Progresión por fases */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-zinc-400 font-black uppercase tracking-widest mb-4">
                Progresión por fases
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    num: 1,
                    label: "Semanas 1–4 (adaptación)",
                    detail: "Aprender técnica. No busques peso máximo. Crear hábito.",
                    color: "teal",
                  },
                  {
                    num: 2,
                    label: "Semanas 5–8 (progreso)",
                    detail: "Subir peso gradualmente. Registrar entrenamientos. Mejorar alimentación.",
                    color: "amber",
                  },
                  {
                    num: 3,
                    label: "Semanas 9–12 (intensidad)",
                    detail: "Añadir cardio post-entreno. Ver cambio físico. Mejorar resistencia.",
                    color: "rose",
                  },
                ].map((ph) => {
                  const isActive = ph.num === phase;
                  const isPast = ph.num < phase;
                  const borderMap = {
                    teal:  isActive ? "border-teal-500/40 bg-teal-500/5"  : "border-zinc-800",
                    amber: isActive ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800",
                    rose:  isActive ? "border-rose-500/40 bg-rose-500/5"   : "border-zinc-800",
                  };
                  const textMap = {
                    teal: "text-teal-400", amber: "text-amber-400", rose: "text-rose-400",
                  };
                  const numBgMap = {
                    teal:  isActive ? "bg-teal-500 text-white"        : isPast ? "bg-zinc-700 text-zinc-400" : "bg-zinc-800 text-zinc-600",
                    amber: isActive ? "bg-amber-500 text-zinc-900"    : isPast ? "bg-zinc-700 text-zinc-400" : "bg-zinc-800 text-zinc-600",
                    rose:  isActive ? "bg-rose-500 text-white"        : isPast ? "bg-zinc-700 text-zinc-400" : "bg-zinc-800 text-zinc-600",
                  };
                  return (
                    <div
                      key={ph.num}
                      className={`rounded-xl border p-4 transition-all ${borderMap[ph.color]} ${!isActive && !isPast ? "opacity-50" : ""}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black mb-3 ${numBgMap[ph.color]}`}>
                        {isPast ? "✓" : ph.num}
                      </div>
                      <div className={`text-xs font-black mb-1 ${isActive ? textMap[ph.color] : isPast ? "text-zinc-500" : "text-zinc-600"}`}>
                        {ph.label}
                      </div>
                      <div className="text-xs text-zinc-600 leading-relaxed">{ph.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB: LOGROS
        ══════════════════════════════════════ */}
        {activeTab === "logros" && (
          <motion.div key="logros" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3, ease:"easeOut" }} className="space-y-4 sm:space-y-6">
            {/* Grid de logros */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-amber-400 font-black uppercase tracking-widest mb-4">
                🏆 Logros ({state.achievements.length}/{ACHIEVEMENT_LIST.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {ACHIEVEMENT_LIST.map((ach, i) => {
                  const earned = state.achievements.includes(ach.id);
                  return (
                    <motion.div
                      key={ach.id}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
                      className={`p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                        earned
                          ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                          : "border-zinc-800 bg-zinc-950 opacity-50"
                      }`}
                    >
                      <div className="text-2xl sm:text-3xl mb-1.5">{earned ? ach.icon : "🔒"}</div>
                      <div className={`text-xs sm:text-sm font-bold leading-tight ${earned ? "text-amber-400" : "text-zinc-500"}`}>
                        {ach.label}
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5 leading-tight">{ach.desc}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Progreso de nivel */}
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <h3 className="text-xs text-violet-400 font-black uppercase tracking-widest mb-4">
                ⚡ Tu Progreso
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <span className="text-2xl font-black text-amber-400">{level}</span>
                </div>
                <div className="flex-1">
                  <div className="text-white font-black text-lg">Nivel {level}</div>
                  <div className="text-xs text-zinc-500 mb-2">
                    {safeXP} XP · Próx: {LEVEL_THRESHOLDS[level] ? `${LEVEL_THRESHOLDS[level]} XP` : "MAX"}
                  </div>
                  <ProgressBar value={xpProgress} max={100} color="amber" height="h-3" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="text-center p-2 sm:p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-lg sm:text-xl font-black text-teal-400">
                    {state.books.filter((b) => b.done).length}
                  </div>
                  <div className="text-xs text-zinc-500">Libros</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-lg sm:text-xl font-black text-rose-400">
                    {state.trainingsThisWeek}
                  </div>
                  <div className="text-xs text-zinc-500">Entrenos</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-lg sm:text-xl font-black text-amber-400">{totalSales}</div>
                  <div className="text-xs text-zinc-500">PDFs</div>
                </div>
              </div>
            </div>

            {/* Recompensas */}
            <div className="bg-zinc-900 rounded-2xl border border-amber-500/20 p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🎁</span>
                <h3 className="text-sm text-amber-400 font-black uppercase tracking-widest">Recompensas</h3>
              </div>
              <p className="text-xs text-zinc-500 mb-5">
                Una recompensa por cada mes. Mes 1: <span className="text-amber-400 font-black">1,000</span> 🪙 · Mes 2: <span className="text-amber-400 font-black">2,000</span> 🪙 · Mes 3: <span className="text-amber-400 font-black">5,000</span> 🪙
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {state.rewards.map((reward, idx) => {
                  const cost = [1000, 2000, 5000][idx];
                  const canRedeem = state.coins >= cost && !reward.redeemed;
                  return (
                    <div
                      key={reward.id}
                      className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all ${
                        reward.redeemed
                          ? "border-amber-500/50 bg-amber-500/10"
                          : "border-zinc-700 bg-zinc-950"
                      }`}
                    >
                      {/* Header tarjeta */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                          Mes {idx + 1}
                        </span>
                        <span className="text-xl">{reward.redeemed ? "✅" : "🎁"}</span>
                      </div>

                      {/* Input nombre — editable si no está canjeada */}
                      {reward.redeemed ? (
                        <div className="text-sm font-bold text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2 min-h-[2.5rem] flex items-center">
                          {reward.label || <span className="text-zinc-500 font-normal italic">Sin nombre</span>}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={reward.label}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              rewards: s.rewards.map((r, i) =>
                                i === idx ? { ...r, label: e.target.value } : r
                              ),
                            }))
                          }
                          placeholder="Ej: comprar tenis nuevos"
                          maxLength={40}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      )}

                      {/* Progreso monedas */}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black ${reward.redeemed ? "text-amber-400" : state.coins >= cost ? "text-amber-400" : "text-zinc-500"}`}>
                          {reward.redeemed ? "300" : Math.min(state.coins, cost)} / {cost}
                        </span>
                        <span className="text-sm">🪙</span>
                      </div>
                      {!reward.redeemed && (
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${Math.min(100, (state.coins / cost) * 100)}%` }}
                          />
                        </div>
                      )}

                      {/* Botón canjear */}
                      {reward.redeemed ? (
                        <div className="w-full py-2.5 rounded-xl bg-amber-500/20 text-amber-400 font-black text-xs text-center tracking-widest">
                          ✓ CANJEADA
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!canRedeem) return;
                            setState((s) => ({
                              ...s,
                              coins: s.coins - cost,
                              rewards: s.rewards.map((r, i) =>
                                i === idx ? { ...r, redeemed: true } : r
                              ),
                            }));
                            showNotification(`🎁 ¡Recompensa del Mes ${idx + 1} canjeada!`);
                          }}
                          disabled={!canRedeem}
                          className={`w-full py-2.5 rounded-xl font-black text-xs tracking-wide sm:tracking-widest transition-all ${
                            canRedeem
                              ? "bg-amber-500 text-zinc-900 hover:bg-amber-400 active:scale-95"
                              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                          }`}
                        >
                          <span className="truncate block">CANJEAR ({cost.toLocaleString()} 🪙)</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resultado esperado día 90 */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="text-amber-400 font-black text-sm mb-3">
                🎯 Resultado esperado al día 90
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { icon: "📚", val: "3", label: "libros leídos" },
                  { icon: "💪", val: "36", label: "entrenos de fuerza" },
                  { icon: "🎧", val: "36", label: "podcasts escuchados" },
                  { icon: "💰", val: "$3K", label: "mensuales" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 p-2 bg-zinc-900 rounded-xl border border-zinc-800"
                  >
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <div className="font-black text-amber-400">{item.val}</div>
                      <div className="text-xs text-zinc-500">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset */}
            {(() => {
              const planCompleted = state.planCompleted || state.currentWeek >= 12;
              return (
                <div className="relative">
                  <button
                    onClick={() => planCompleted && setResetModalOpen(true)}
                    disabled={!planCompleted}
                    className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      planCompleted
                        ? "border-zinc-700 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400 cursor-pointer"
                        : "border-zinc-800 text-zinc-700 cursor-not-allowed opacity-60"
                    }`}
                  >
                    {planCompleted ? (
                      <>↺ Reiniciar todo el progreso</>
                    ) : (
                      <>
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="7" width="10" height="8" rx="1.5"/>
                          <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
                        </svg>
                        Reiniciar bloqueado — disponible al día 90
                      </>
                    )}
                  </button>
                  {!planCompleted && (
                    <div className="text-xs text-zinc-700 text-center mt-1">
                      Semana {state.currentWeek} / 12
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ══════════════════════════════════════
            TAB: RESUMEN
        ══════════════════════════════════════ */}
        {activeTab === "resumen" && (
          <motion.div
            key="resumen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* ── Frase motivadora */}
            <div
              className="relative rounded-2xl border border-amber-500/20 overflow-hidden p-4 sm:p-5"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.04) 100%)" }}
            >
              <div className="absolute top-3 right-4 text-3xl opacity-10 select-none">"</div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={quoteIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <p className="text-sm sm:text-base font-bold text-zinc-100 leading-relaxed pr-6 italic">
                    "{MOTIVATIONAL_QUOTES[quoteIdx].text}"
                  </p>
                  <p className="text-xs text-amber-400 font-black mt-2">— {MOTIVATIONAL_QUOTES[quoteIdx].author}</p>
                </motion.div>
              </AnimatePresence>
              <div className="flex gap-1 mt-3">
                {MOTIVATIONAL_QUOTES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setQuoteIdx(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${i === quoteIdx ? "bg-amber-400 w-5" : "bg-zinc-700 w-1.5 hover:bg-zinc-500"}`}
                  />
                ))}
              </div>
            </div>

            {/* ── Notas */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 mt-4 sm:mt-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-zinc-400 font-black uppercase tracking-widest">📝 Mis notas</h3>
                <span className="text-xs text-zinc-600 font-bold">{state.notes.length} nota{state.notes.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Input nueva nota */}
              <div className="flex gap-2 mb-4">
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!noteInput.trim()) return;
                      const now = new Date();
                      const label = `${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")} ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
                      setState((s) => ({
                        ...s,
                        notes: [{ id: Date.now(), text: noteInput.trim(), date: label, week: s.currentWeek, day: currentDay }, ...s.notes],
                      }));
                      setNoteInput("");
                    }
                  }}
                  placeholder="Escribe una nota… (Enter para guardar, Shift+Enter para salto de línea)"
                  rows={2}
                  className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed"
                />
                <button
                  onClick={() => {
                    if (!noteInput.trim()) return;
                    const now = new Date();
                    const label = `${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")} ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
                    setState((s) => ({
                      ...s,
                      notes: [{ id: Date.now(), text: noteInput.trim(), date: label, week: s.currentWeek, day: currentDay }, ...s.notes],
                    }));
                    setNoteInput("");
                  }}
                  className="w-11 h-11 self-end rounded-xl bg-amber-500 text-zinc-900 font-black text-lg hover:bg-amber-400 active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"
                >+</button>
              </div>

              {/* Lista de notas */}
              {state.notes.length === 0 ? (
                <div className="text-center py-8 text-zinc-700 text-sm">
                  <div className="text-3xl mb-2">📋</div>
                  Aún no hay notas. ¡Escribe la primera!
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {state.notes.map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.95 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className={`group relative rounded-xl border p-3 transition-all ${
                          noteToDelete === note.id
                            ? "border-rose-500/50 bg-rose-500/8"
                            : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                        }`}
                      >
                        <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap pr-8">{note.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-zinc-600 font-bold">{note.date}</span>
                          <span className="text-[10px] text-zinc-700">·</span>
                          <span className="text-[10px] text-zinc-700">Sem {note.week} · Día {note.day}</span>
                        </div>
                        {/* Botón eliminar */}
                        {noteToDelete === note.id ? (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => {
                                setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }));
                                setNoteToDelete(null);
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-black hover:bg-rose-400 transition-colors active:scale-95"
                            >Sí, eliminar</button>
                            <button
                              onClick={() => setNoteToDelete(null)}
                              className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-bold hover:border-zinc-500 hover:text-white transition-colors"
                            >Cancelar</button>
                          </div>
                        ) : (
                          <motion.button
                            onClick={() => setNoteToDelete(note.id)}
                            whileTap={{ scale: 0.85 }}
                            className="absolute top-3 right-3 opacity-40 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-zinc-800 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-500 flex items-center justify-center text-xs"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4"/>
                            </svg>
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
