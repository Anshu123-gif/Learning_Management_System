import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { User, UserRole } from "../types";
import { INITIAL_USERS } from "../data/mockLmsData";
import { db } from "../lib/firebase";
import { doc, setDoc, getDocs, collection } from "firebase/firestore";

export interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  activeRole: UserRole | null;
  allUsers: User[];
  isAuthModalOpen: boolean;
  authModalMode: "login" | "signup";
  mongoStatus: { connected: boolean; configured: boolean };
  openAuthModal: (mode?: "login" | "signup", intendedAction?: () => void) => void;
  closeAuthModal: () => void;
  login: (emailOrPhone: string, password?: string, role?: UserRole) => Promise<{ success: boolean; message?: string }>;
  signup: (userData: { name: string; email: string; phone?: string; role: UserRole; password?: string }) => Promise<{ success: boolean; message?: string }>;
  quickDemoLogin: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  switchUser: (userId: string) => void;
  updateUserWishlist: (courseId: string) => void;
  isWishlisted: (courseId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem("edupulse_users");
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const active = localStorage.getItem("edupulse_active_user_id");
    if (!active || active === "guest") return null;
    return active;
  });

  const [mongoStatus, setMongoStatus] = useState<{ connected: boolean; configured: boolean }>({
    connected: false,
    configured: false,
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Check MongoDB Atlas status & sync users on initial mount
  useEffect(() => {
    const syncDatabaseUsers = async () => {
      // 1. Check MongoDB status
      try {
        const mongoRes = await fetch("/api/mongo/status");
        if (mongoRes.ok) {
          const status = await mongoRes.json();
          setMongoStatus(status);

          // If MongoDB is connected, fetch users from MongoDB Atlas
          if (status.connected) {
            const usersRes = await fetch("/api/mongo/users");
            if (usersRes.ok) {
              const usersData = await usersRes.json();
              if (usersData.success && Array.isArray(usersData.users) && usersData.users.length > 0) {
                const fetchedUsers: User[] = usersData.users.map((u: any) => ({
                  _id: u.userId || u._id,
                  name: u.name,
                  email: u.email,
                  phone: u.phone || "",
                  role: u.role || "student",
                  avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
                  bio: u.bio || "",
                  enrolledCourses: u.enrolledCourses || [],
                  wishlist: u.wishlist || [],
                  createdAt: u.createdAt || new Date().toISOString(),
                }));

                setUsers((prev) => {
                  const existingIds = new Set(fetchedUsers.map((x) => x._id));
                  return [...fetchedUsers, ...prev.filter((x) => !existingIds.has(x._id))];
                });
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn("MongoDB check error:", e);
      }

      // 2. Fallback / Synchronous Cloud Database Sync via Firestore
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        if (!querySnapshot.empty) {
          const dbUsers: User[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            dbUsers.push({
              _id: docSnap.id,
              name: data.name || "Learner",
              email: data.email || "",
              phone: data.phone || "",
              role: data.role || "student",
              avatar: data.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
              bio: data.bio || "Member of Sheryians Coding School",
              enrolledCourses: data.enrolledCourses || [],
              wishlist: data.wishlist || [],
              createdAt: data.createdAt || new Date().toISOString(),
            });
          });

          setUsers((prev) => {
            const existingIds = new Set(dbUsers.map((u) => u._id));
            return [...dbUsers, ...prev.filter((u) => !existingIds.has(u._id))];
          });
        }
      } catch (err) {
        console.warn("Firestore sync error:", err);
      }
    };

    syncDatabaseUsers();
  }, []);

  useEffect(() => {
    localStorage.setItem("edupulse_users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem("edupulse_active_user_id", currentUserId);
    } else {
      localStorage.removeItem("edupulse_active_user_id");
    }
  }, [currentUserId]);

  const currentUser = currentUserId ? users.find((u) => u._id === currentUserId) || null : null;
  const isAuthenticated = Boolean(currentUser);
  const activeRole: UserRole | null = currentUser?.role || null;

  const openAuthModal = (mode: "login" | "signup" = "login", intendedAction?: () => void) => {
    setAuthModalMode(mode);
    if (intendedAction) {
      pendingActionRef.current = intendedAction;
    } else {
      pendingActionRef.current = null;
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    pendingActionRef.current = null;
  };

  const executePendingAction = () => {
    if (pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      setTimeout(() => {
        try {
          action();
        } catch (err) {
          console.error("Error executing pending action after login:", err);
        }
      }, 100);
    }
  };

  // Helper to persist to both MongoDB Atlas & Firestore
  const persistUserToDatabases = async (user: User) => {
    // 1. Save to MongoDB Atlas via backend API
    try {
      await fetch("/api/mongo/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || "",
          role: user.role,
          avatar: user.avatar,
          bio: user.bio || "",
        }),
      });
    } catch (mErr) {
      console.warn("MongoDB Atlas persist attempt:", mErr);
    }

    // 2. Save to Firestore (Always active and verified)
    try {
      const userRef = doc(db, "users", user._id);
      await setDoc(userRef, {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        avatar: user.avatar,
        bio: user.bio || "",
        enrolledCourses: user.enrolledCourses || [],
        wishlist: user.wishlist || [],
        createdAt: user.createdAt,
      }, { merge: true });
    } catch (fErr) {
      console.warn("Firestore persist attempt:", fErr);
    }
  };

  // LOGIN METHOD: Authenticates against MongoDB with password comparison and JWT
  const login = async (emailOrPhone: string, password?: string, preferredRole?: UserRole) => {
    const cleanInput = emailOrPhone.trim().toLowerCase();

    // 1. If password is provided, perform primary authentication against MongoDB Atlas
    if (password) {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanInput,
            password: password,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success && data.user) {
          const authUser: User = {
            _id: data.user.userId || data.user._id,
            name: data.user.name,
            email: data.user.email,
            phone: data.user.phone || "",
            role: data.user.role || "student",
            avatar: data.user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
            bio: data.user.bio || "",
            enrolledCourses: data.user.enrolledCourses || [],
            wishlist: data.user.wishlist || [],
            createdAt: data.user.createdAt || new Date().toISOString(),
          };

          if (data.token) {
            localStorage.setItem("edupulse_jwt_token", data.token);
          }

          setUsers((prev) => {
            const filtered = prev.filter((u) => u._id !== authUser._id && u.email.toLowerCase() !== authUser.email.toLowerCase());
            return [authUser, ...filtered];
          });

          setCurrentUserId(authUser._id);
          setIsAuthModalOpen(false);
          executePendingAction();
          return { success: true, message: data.message || "Login successful!" };
        } else {
          return {
            success: false,
            message: data.message || "Invalid credentials. Please verify your email and password.",
          };
        }
      } catch (err: any) {
        console.error("MongoDB login error:", err);
        return {
          success: false,
          message: err.message || "Failed to reach MongoDB server. Please try again.",
        };
      }
    }

    // 2. Demo / Quick Login fallback for developer preview
    const cleanDigits = cleanInput.replace(/\D/g, "");
    let matchedUser = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.phone && u.phone.replace(/\D/g, "") === cleanDigits && cleanDigits.length >= 10)
    );

    if (matchedUser) {
      setCurrentUserId(matchedUser._id);
      setIsAuthModalOpen(false);
      executePendingAction();
      return { success: true };
    }

    const isEmail = cleanInput.includes("@");
    const newId = `usr_${Date.now()}`;
    const newUser: User = {
      _id: newId,
      name: isEmail ? cleanInput.split("@")[0] : `Learner ${cleanDigits.slice(-4)}`,
      email: isEmail ? cleanInput : `${cleanDigits}@sheryians.student.in`,
      phone: isEmail ? "" : cleanDigits,
      role: preferredRole || "student",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: "Aspiring developer at Sheryians Coding School.",
      enrolledCourses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };

    await persistUserToDatabases(newUser);
    setUsers((prev) => [newUser, ...prev]);
    setCurrentUserId(newId);
    setIsAuthModalOpen(false);
    executePendingAction();
    return { success: true };
  };

  // SIGNUP METHOD: Validates and saves new user to MongoDB with bcrypt hashed password
  const signup = async (userData: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    password?: string;
  }) => {
    const cleanEmail = userData.email.trim().toLowerCase();

    // 1. If password is provided, submit to MongoDB Atlas Signup API
    if (userData.password) {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userData.name.trim(),
            email: cleanEmail,
            password: userData.password,
            role: userData.role || "student",
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          if (data.user) {
            const newUser: User = {
              _id: data.user.userId || data.user._id,
              name: data.user.name,
              email: data.user.email,
              phone: data.user.phone || "",
              role: data.user.role || "student",
              avatar: data.user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
              bio: data.user.bio || "",
              enrolledCourses: data.user.enrolledCourses || [],
              wishlist: data.user.wishlist || [],
              createdAt: data.user.createdAt || new Date().toISOString(),
            };

            setUsers((prev) => {
              const filtered = prev.filter((u) => u._id !== newUser._id && u.email.toLowerCase() !== newUser.email.toLowerCase());
              return [newUser, ...filtered];
            });
          }

          return {
            success: true,
            message: data.message || "Account created successfully in MongoDB! Please log in.",
          };
        } else {
          return {
            success: false,
            message: data.message || "Failed to create account in MongoDB.",
          };
        }
      } catch (err: any) {
        console.error("MongoDB signup error:", err);
        return {
          success: false,
          message: err.message || "Network error while connecting to MongoDB authentication service.",
        };
      }
    }

    // Fallback registration if no password provided
    const newId = `usr_${Date.now()}`;
    const newUser: User = {
      _id: newId,
      name: userData.name.trim() || "New Learner",
      email: cleanEmail,
      phone: userData.phone?.replace(/\D/g, "") || "",
      role: userData.role || "student",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: "Member of Sheryians Coding School.",
      enrolledCourses: [],
      wishlist: [],
      createdAt: new Date().toISOString(),
    };

    await persistUserToDatabases(newUser);
    setUsers((prev) => [newUser, ...prev]);
    setCurrentUserId(newId);
    setIsAuthModalOpen(false);
    executePendingAction();
    return { success: true };
  };

  const quickDemoLogin = (role: UserRole) => {
    const demoUser = users.find((u) => u.role === role) || users[0];
    if (demoUser) {
      setCurrentUserId(demoUser._id);
      setIsAuthModalOpen(false);
      executePendingAction();
    }
  };

  const logout = () => {
    setCurrentUserId(null);
    localStorage.removeItem("edupulse_active_user_id");
    localStorage.removeItem("edupulse_jwt_token");
  };

  const switchRole = (role: UserRole) => {
    const targetUser = users.find((u) => u.role === role);
    if (targetUser) {
      setCurrentUserId(targetUser._id);
    } else if (currentUser) {
      const updated = users.map((u) => (u._id === currentUser._id ? { ...u, role } : u));
      setUsers(updated);
      persistUserToDatabases({ ...currentUser, role });
    }
  };

  const switchUser = (userId: string) => {
    if (users.some((u) => u._id === userId)) {
      setCurrentUserId(userId);
    }
  };

  const isWishlisted = (courseId: string) => {
    if (!currentUser) return false;
    return currentUser.wishlist?.includes(courseId) || false;
  };

  const updateUserWishlist = (courseId: string) => {
    if (!currentUser) {
      openAuthModal("login");
      return;
    }
    const updatedUsers = users.map((u) => {
      if (u._id !== currentUser._id) return u;
      const exists = u.wishlist?.includes(courseId);
      const newWishlist = exists
        ? u.wishlist.filter((id) => id !== courseId)
        : [...(u.wishlist || []), courseId];
      const updatedUser = { ...u, wishlist: newWishlist };
      persistUserToDatabases(updatedUser);
      return updatedUser;
    });
    setUsers(updatedUsers);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        activeRole,
        allUsers: users,
        isAuthModalOpen,
        authModalMode,
        mongoStatus,
        openAuthModal,
        closeAuthModal,
        login,
        signup,
        quickDemoLogin,
        logout,
        switchRole,
        switchUser,
        updateUserWishlist,
        isWishlisted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
