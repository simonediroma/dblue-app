import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import axios from "axios";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  employment_type?: string;
  job_title?: string;
  contract_type?: string;
  contract_percentage?: number | null;
  mandatory_presence_days?: number | null;
  image_url?: string | null;
  space_access?: string[];
  login_method?: string;
  tool_access?: string[];
  app_access?: string[];
  status?: boolean;
}

interface AuthState {
  session: AuthUser | null;
  loading: boolean;
  isAuthorized: boolean;
  isUnavailable: boolean;
}

interface AuthContextValue extends AuthState {
  setSession: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  isAuthorized: false,
  isUnavailable: false,
  setSession: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    axios
      .get<{ success: boolean; user: AuthUser }>(
        `${import.meta.env.VITE_API_URL}/auth/me`,
        { withCredentials: true }
      )
      .then((res) => {
        setSession(res.data.user);
        setIsAuthorized(true);
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;

          if (status === 401) {
            // No valid session — show the login page (do NOT redirect to dblue-office)
            setLoading(false);
            return;
          }

          if (status === 403) {
            setIsAuthorized(false);
            setLoading(false);
            return;
          }

          if (status === 503) {
            setIsUnavailable(true);
            setLoading(false);
            return;
          }
        }
        setIsUnavailable(true);
        setLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, isAuthorized, isUnavailable, setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
