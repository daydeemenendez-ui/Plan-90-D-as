import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const COOKIE_KEY = "plan90_rt";
const AuthContext = createContext(null);

function saveRefreshCookie(token) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_KEY}=${token};expires=${expires};path=/;SameSite=Lax`;
}

function getRefreshCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  return match ? match[1] : null;
}

function clearRefreshCookie() {
  document.cookie = `${COOKIE_KEY}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session) {
          saveRefreshCookie(session.refresh_token);
          setUser(session.user);
          setLoading(false);
        } else {
          const rt = getRefreshCookie();
          if (rt) {
            const { data, error } = await supabase.auth.refreshSession({ refresh_token: rt });
            if (!error && data.session) {
              saveRefreshCookie(data.session.refresh_token);
              setUser(data.session.user);
            } else {
              clearRefreshCookie();
              setUser(null);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        }
      } else if (session) {
        setUser(session.user);
        saveRefreshCookie(session.refresh_token);
      } else {
        setUser(null);
        clearRefreshCookie();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
