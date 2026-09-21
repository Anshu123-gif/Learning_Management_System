import React, { useState } from "react";
import {
  GraduationCap,
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  Code2,
  Search,
  UserCheck,
  ChevronDown,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLms } from "../context/LmsContext";
import { UserRole } from "../types";

export type NavTab = "catalog" | "my-learning" | "my-courses" | "instructor" | "teacher" | "admin";

export interface NavbarProps {
  currentTab?: NavTab;
  setCurrentTab?: (tab: NavTab) => void;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onSearchChange?: (q: string) => void;
  onOpenDossier?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentPage,
  onNavigate,
  searchQuery = "",
  setSearchQuery,
  onSearchChange,
  onOpenDossier,
}) => {
  const { currentUser, isAuthenticated, activeRole, logout, openAuthModal } = useAuth();
  const { certificates } = useLms();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Normalize active tab
  const activeTab: NavTab =
    currentTab ||
    (currentPage === "my-courses" ? "my-learning" : currentPage === "teacher" ? "instructor" : (currentPage as NavTab)) ||
    "catalog";

  const handleTabChange = (tab: NavTab) => {
    if (typeof setCurrentTab === "function") {
      setCurrentTab(tab);
    }
    if (typeof onNavigate === "function") {
      onNavigate(tab);
    }
  };

  const handleSearch = (q: string) => {
    if (typeof setSearchQuery === "function") {
      setSearchQuery(q);
    }
    if (typeof onSearchChange === "function") {
      onSearchChange(q);
    }
  };

  const studentCertCount = currentUser
    ? certificates.filter((c) => c.studentId === currentUser._id).length
    : 0;

  return (
    <header className="sticky top-0 z-40 bg-[#0b0b0c]/90 backdrop-blur-md border-b border-neutral-800/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Brand: Sheryians Coding School */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabChange("catalog")}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              {/* Sheryians Brand Icon */}
              <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-white shadow-sm group-hover:border-[#E84A27]/60 transition-all">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 fill-white group-hover:fill-[#E84A27] transition-colors"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span
                  id="brand-logo-title"
                  className="text-lg font-bold tracking-tight text-white leading-tight font-display"
                >
                  Sheryians
                </span>
                <span className="text-[11px] font-medium text-neutral-400 tracking-wider">
                  Coding School
                </span>
              </div>
            </button>
          </div>

          {/* Center Capsule Navigation Pill from Sheryians UI */}
          <div className="hidden md:flex items-center bg-neutral-900/90 border border-neutral-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => handleTabChange("catalog")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "catalog"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                handleTabChange("catalog");
                const el = document.getElementById("sheryians-courses-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              Courses
            </button>
            <button
              onClick={() => {
                handleTabChange("catalog");
                const el = document.getElementById("sheryians-courses-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              Bootcamp
            </button>
            <button
              onClick={() => {
                if (onOpenDossier) onOpenDossier();
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-all cursor-pointer"
            >
              Offline Programs
            </button>

            {/* Student "My Learning" only for students */}
            {isAuthenticated && (!activeRole || activeRole === "student") && (
              <button
                onClick={() => handleTabChange("my-learning")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "my-learning" || activeTab === "my-courses"
                    ? "bg-[#E84A27] text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                My Learning
              </button>
            )}

            {/* Teacher Dashboard if authenticated */}
            {isAuthenticated && activeRole === "teacher" && (
              <button
                onClick={() => handleTabChange("instructor")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "instructor" || activeTab === "teacher"
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Teacher Studio
              </button>
            )}

            {/* Admin Dashboard if authenticated */}
            {isAuthenticated && activeRole === "admin" && (
              <button
                onClick={() => handleTabChange("admin")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-amber-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Admin
              </button>
            )}
          </div>

          {/* Right Action Buttons: "Request Call" Pill + "Sign In" */}
          <nav className="flex items-center gap-3">
            {/* Request Call Pill Button */}
            <button
              onClick={() => {
                if (onOpenDossier) onOpenDossier();
              }}
              className="px-4 py-2 rounded-full border border-[#E84A27]/40 bg-neutral-900/60 hover:bg-[#E84A27]/10 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 fill-[#E84A27]"
              >
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
              </svg>
              <span>Request Call</span>
            </button>

            {/* If Logged In: Role Switcher & Profile Dropdown */}
            {isAuthenticated && currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full border border-neutral-700 bg-neutral-900 shadow-sm hover:border-[#E84A27] transition-all text-xs font-semibold cursor-pointer text-white"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full object-cover border border-[#E84A27]/60"
                  />
                  <div className="text-left hidden sm:block">
                    <div className="text-[11px] font-bold text-neutral-200 leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-[#E84A27] capitalize font-medium">
                      {activeRole}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white">
                    <div className="px-3 pb-2 border-b border-neutral-800">
                      <div className="text-xs font-bold text-white">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {currentUser.email}
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Account Role</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-800 text-[#E84A27] border border-neutral-700">
                          {activeRole}
                        </span>
                      </div>

                      {activeRole === "teacher" && (
                        <button
                          onClick={() => {
                            setRoleDropdownOpen(false);
                            handleTabChange("instructor");
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 hover:bg-neutral-800 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Teacher Studio</span>
                          <span className="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-1.5 py-0.5 rounded">Go</span>
                        </button>
                      )}

                      {activeRole === "admin" && (
                        <button
                          onClick={() => {
                            setRoleDropdownOpen(false);
                            handleTabChange("admin");
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-neutral-800 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Admin Control Panel</span>
                          <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-1.5 py-0.5 rounded">Go</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-2 mt-1 border-t border-neutral-800 px-1.5">
                      <button
                        onClick={() => {
                          logout();
                          setRoleDropdownOpen(false);
                          handleTabChange("catalog");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Sign In Link / Button from Sheryians UI */
              <button
                id="pw-navbar-login-btn"
                onClick={() => openAuthModal("login")}
                className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer px-2 py-1"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
