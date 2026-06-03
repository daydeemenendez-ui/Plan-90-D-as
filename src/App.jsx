import { AuthProvider, useAuth } from "./AuthContext";
import Dashboard90Dias from "./Dashboard.jsx";
import Login from "./Login.jsx";
import Tutorial, { useTutorial } from "./Tutorial.jsx";

function AppContent() {
  const { user, loading } = useAuth();
  const { show: showTutorial, setShow: setShowTutorial, reset: resetTutorial } = useTutorial();

  if (loading) {
    return (
      <div
        className="min-h-screen bg-zinc-950 flex items-center justify-center"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="text-amber-400 font-black text-sm animate-pulse">🔥 Cargando...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <Dashboard90Dias onResetTutorial={resetTutorial} />
      {showTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
