import { AuthProvider, useAuth } from "./AuthContext";
import Dashboard90Dias from "./Dashboard.jsx";
import Login from "./Login.jsx";

function AppContent() {
  const { user, loading } = useAuth();

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

  return user ? <Dashboard90Dias /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
