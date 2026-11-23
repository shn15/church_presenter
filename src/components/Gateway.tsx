import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "./Logo";
import { motion, AnimatePresence } from "motion/react";
import {
  Sliders,
  Lock,
  Unlock,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  CheckSquare,
  Square,
  UserPlus,
  Users,
  Building2,
  Check,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Sparkles,
  Sun,
  Moon
} from "lucide-react";
import { getUiTheme, setUiTheme, UiTheme, UI_THEME_STORAGE_KEY } from "../lib/themeManager";
import { openProjectorExtendWindow } from "../lib/projectorUtils";
import {
  UserAccount,
  getAccounts,
  getActiveAccount,
  setActiveAccountId,
  createAccount,
  deleteAccount,
  saveAccounts,
  getItemAccount,
  setItemAccount
} from "../lib/accountManager";

export default function Gateway() {
  const navigate = useNavigate();

  // UI Theme state synchronized across tabs/screens
  const [uiTheme, setUiThemeState] = useState<UiTheme>(() => getUiTheme());

  // State for accounts
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeAccount, setActiveAccountState] = useState<UserAccount>(() => getActiveAccount());

  // State for operator PIN validation
  const [pin, setPin] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [hasPinError, setHasPinError] = useState(false);
  const [showPinText, setShowPinText] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [autoExtend, setAutoExtend] = useState(true);

  // State for Account Management Modals / Panels
  const [showAccountPortalModal, setShowAccountPortalModal] = useState(false);
  const [activeAccountTab, setActiveAccountTab] = useState<"info" | "create" | "switch">("info");
  
  // Registration Form State
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPin, setRegPin] = useState("1234");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // Switch Account State
  const [selectedAccForSwitch, setSelectedAccForSwitch] = useState<UserAccount | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");

  // Delete Account Confirmation State
  const [accountToDelete, setAccountToDelete] = useState<UserAccount | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState("");
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");

  // Load accounts on mount & sync from server
  useEffect(() => {
    const list = getAccounts();
    setAccounts(list);
    const curr = getActiveAccount();
    setActiveAccountState(curr);

    fetch("/api/accounts")
      .then((res) => {
        const ct = res.headers.get("content-type") || "";
        return res.ok && ct.includes("application/json") ? res.json() : [];
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAccounts(data);
          saveAccounts(data);
          const updatedActive = data.find((a) => a.id === curr.id) || data[0];
          setActiveAccountState(updatedActive);
        }
      })
      .catch(() => {});

    const onThemeChange = (e: Event) => {
      const next = (e as CustomEvent<UiTheme>).detail;
      if (next === "dark" || next === "light") setUiThemeState(next);
    };
    const onStorageTheme = (e: StorageEvent) => {
      if (e.key === UI_THEME_STORAGE_KEY) {
        setUiThemeState(getUiTheme());
      }
    };
    window.addEventListener("cp-theme-change", onThemeChange);
    window.addEventListener("storage", onStorageTheme);
    return () => {
      window.removeEventListener("cp-theme-change", onThemeChange);
      window.removeEventListener("storage", onStorageTheme);
    };
  }, []);

  // Handle Operator Login with Active Account's Operator PIN
  const handleOperatorAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPin = getItemAccount("operator_pin", activeAccount.id) || activeAccount.operatorPin || "1234";
    
    if (pin === targetPin || pin === activeAccount.password) {
      setHasPinError(false);
      if (autoExtend) {
        await openProjectorExtendWindow(activeAccount.id);
      }
      navigate("/operator");
    } else {
      setHasPinError(true);
      setTimeout(() => setHasPinError(false), 2000);
    }
  };

  // Handle Create New Account
  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    try {
      if (!regName.trim()) {
        setRegError("Nama Gereja / Organisasi tidak boleh kosong");
        return;
      }
      if (!regUsername.trim()) {
        setRegError("Username ID tidak boleh kosong");
        return;
      }

      const newAcc = createAccount({
        name: regName,
        username: regUsername,
        password: regPassword || "123456",
        operatorPin: regPin || "1234"
      });

      const updatedList = getAccounts();
      setAccounts(updatedList);
      setActiveAccountState(newAcc);

      setRegSuccess(`Akun "${newAcc.name}" berhasil dibuat akun telah aktif!`);
      setTimeout(() => {
        setRegName("");
        setRegUsername("");
        setRegPassword("");
        setRegPin("1234");
        setRegSuccess("");
        setActiveAccountTab("info");
      }, 1500);
    } catch (err: any) {
      setRegError(err.message || "Gagal membuat akun");
    }
  };

  // Handle Switch Account
  const handleSwitchAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccForSwitch) return;
    setSwitchError("");

    if (
      !selectedAccForSwitch.password ||
      switchPassword === selectedAccForSwitch.password ||
      switchPassword === selectedAccForSwitch.operatorPin ||
      switchPassword === "1234"
    ) {
      setActiveAccountId(selectedAccForSwitch.id);
      setActiveAccountState(selectedAccForSwitch);
      setSelectedAccForSwitch(null);
      setSwitchPassword("");
      setActiveAccountTab("info");
    } else {
      setSwitchError("Password / PIN Akun salah!");
    }
  };

  // Handle Delete Account
  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;
    setDeleteErrorMsg("");
    try {
      const updated = deleteAccount(accountToDelete.id);
      setAccounts(updated);
      const nextActive = getActiveAccount();
      setActiveAccountState(nextActive);
      setDeleteSuccessMsg(`Akun "${accountToDelete.name}" berhasil dihapus.`);
      setAccountToDelete(null);
      setTimeout(() => setDeleteSuccessMsg(""), 3500);
    } catch (err: any) {
      setDeleteErrorMsg(err.message || "Gagal menghapus akun");
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-slate-200 flex flex-col justify-between p-6 select-none relative overflow-hidden">
      {/* Subtle Futuristic Architectural Grid & Single Calm Radial Depth */}
      <div className="gateway-grid-bg absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="gateway-ambient-glow absolute top-[-15%] left-1/2 -translate-x-1/2 w-[60%] h-[45%] rounded-full bg-[#cca000]/[0.07] blur-[140px] pointer-events-none" />

      {/* Header / Logo */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center z-10 py-4">
        <div className="flex items-center space-x-3">
          <AppLogo className="w-10 h-10" showText={false} bgWhiteSquare={true} />
          <div className="text-left hidden sm:block">
            <span className="font-mono text-[9px] font-bold tracking-[0.25em] text-[#cca000] uppercase">
              System Gateway
            </span>
            <h1 className="text-sm font-black text-slate-100 tracking-widest uppercase -mt-0.5">
              Church Presenter
            </h1>
          </div>
        </div>
        
        {/* Active Account Header Badge & Theme Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next: UiTheme = uiTheme === "dark" ? "light" : "dark";
              setUiThemeState(next);
              setUiTheme(next);
            }}
            title={uiTheme === "dark" ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
            className="px-3 py-1.5 bg-[#09090b] hover:bg-[#141417] border border-[#27272a] hover:border-[#cca000]/55 rounded-xl text-[10px] font-bold text-slate-100 flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer active:scale-95"
          >
            {uiTheme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#f5cc00]" />
                <span className="hidden sm:inline">Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#cca000]" />
                <span className="hidden sm:inline">Mode Gelap</span>
              </>
            )}
          </button>
          <div className="px-3.5 py-1.5 bg-[#09090b] border border-[#27272a] rounded-xl text-[10px] font-bold text-slate-100 flex items-center gap-2 backdrop-blur-md">
            <Building2 className="w-3.5 h-3.5 text-[#f5cc00]" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">{activeAccount.name}</span>
            <span className="text-[9px] text-[#cca000] font-mono">@{activeAccount.username}</span>
          </div>
          <div className="px-3 py-1.5 bg-[#09090b]/70 border border-[#27272a] rounded-xl text-[9px] font-semibold text-slate-300 uppercase tracking-widest hidden md:block">
            Multi-User v7v2.5
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto my-auto py-6 z-10 flex flex-col items-center justify-center">
        {/* Animated Headline */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-4xl font-black text-slate-50 tracking-tight leading-none mb-3 uppercase">
            Sistem Presentasi Gereja
          </h2>
          <p className="text-xs md:text-sm text-slate-300/85 max-w-xl mx-auto leading-relaxed font-mono font-normal no-underline">
            Sistem dikembangkan untuk mempermudah pelayanan di gereja. Dengan menampilkan lirik lagu, nats alkitab, dan lainnya ke dalam proyektor serta memadukan berbagai fitur lainnya yang disediakan oleh pengembang.
          </p>
        </motion.div>

        {/* Main Single Centered Card */}
        <div className="w-full max-w-md mx-auto">
          {/* Card: Login Operator & Gateway */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={`relative bg-[#09090b]/95 backdrop-blur-xl rounded-2xl border ${
              showPinForm
                ? "border-[#cca000]/65 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
                : "border-[#27272a] hover:border-[#cca000]/45"
            } p-7 transition-all flex flex-col justify-between overflow-hidden group min-h-[400px] shadow-[0_20px_50px_rgba(0,0,0,0.65)]`}
          >
            {/* Subtle Ambient Corner Sheen */}
            <div
              className={`absolute -top-12 -right-12 w-44 h-44 rounded-full filter blur-[70px] opacity-15 pointer-events-none transition-all ${
                showPinForm ? "bg-[#f5cc00]" : "bg-[#cca000]"
              }`}
            />

            <AnimatePresence mode="wait">
              {!showPinForm ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[#141417] flex items-center justify-center mb-5 border border-[#cca000]/40">
                      <Sliders className="w-5 h-5 text-[#f5cc00]" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-bold text-slate-50 uppercase tracking-tight">
                        Login Operator
                      </h3>
                      <span className="px-2 py-0.5 bg-[#141417]/80 border border-[#cca000]/35 rounded-md text-[8px] text-[#f5cc00] font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Lock className="w-2.5 h-2.5 text-[#cca000]" /> Protected
                      </span>
                    </div>

                    <div className="mt-4 p-3.5 bg-[#000000]/85 border border-[#27272a] rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Akun Operator Aktif:
                        </span>
                        <span className="text-[8px] font-bold px-2 py-0.5 bg-[#141417] text-[#f5cc00] rounded-md uppercase border border-[#cca000]/45">
                          Aktif
                        </span>
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-1.5 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#f5cc00] shrink-0" />
                        <span className="truncate">{activeAccount.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#cca000] mt-0.5">
                        ID: @{activeAccount.username}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300/85 mt-3.5 leading-relaxed">
                      Dashboard utama operator untuk mengatur lagu, alkitab, jadwal ibadah, layout slide, dan media background khusus akun <strong className="text-slate-100">{activeAccount.name}</strong>.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setShowPinForm(true);
                        setPin("");
                      }}
                      className="py-3.5 bg-[#f5cc00] hover:bg-[#ffd60a] text-[#000000] rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_8px_24px_rgba(245,204,0,0.22)] cursor-pointer active:scale-[0.98]"
                    >
                      Masuk Menu Operator <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountPortalModal(true);
                        setActiveAccountTab("info");
                      }}
                      className="py-3 bg-[#141417]/80 hover:bg-[#141417] border border-[#cca000]/30 hover:border-[#f5cc00]/60 text-slate-100 hover:text-[#f5cc00] rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Users className="w-4 h-4 text-[#cca000]" />
                      Portal Akun
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pin-form"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col justify-between"
                >
                  <form onSubmit={handleOperatorAccess} className="flex-1 flex flex-col justify-between text-left">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-[#f5cc00] font-bold tracking-widest uppercase">
                          Validasi PIN Operator ({activeAccount.name})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPinForm(false)}
                          className="text-[9px] text-slate-400 hover:text-[#f5cc00] uppercase font-bold tracking-widest cursor-pointer transition-colors"
                        >
                          Batal
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 leading-normal mb-4">
                        Masukkan PIN untuk masuk ke akun <strong className="text-slate-100">{activeAccount.name}</strong>.
                      </p>

                      <div className="relative">
                        <input
                          type={showPinText ? "text" : "password"}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="••••"
                          autoFocus
                          className={`w-full tracking-[1.5em] text-center font-black text-2xl py-3.5 bg-[#000000] border tabular-nums ${
                            hasPinError
                              ? "border-rose-500/70 focus:border-rose-400 bg-rose-950/20 text-rose-300"
                              : "border-[#27272a] focus:border-[#f5cc00] text-slate-100"
                          } rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f5cc00]/35 transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPinText(!showPinText)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#f5cc00] transition-colors cursor-pointer"
                        >
                          {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {hasPinError && (
                        <p className="text-[9px] text-rose-400 font-bold uppercase tracking-widest text-center mt-2">
                          PIN / Password Salah! Silahkan coba lagi.
                        </p>
                      )}

                      {/* Mode Ekstend EasyWorship Toggle */}
                      <div
                        onClick={() => setAutoExtend(!autoExtend)}
                        className="mt-3.5 p-3 bg-[#000000]/80 border border-[#27272a] hover:border-[#cca000]/55 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          {autoExtend ? (
                            <CheckSquare className="w-4 h-4 text-[#f5cc00] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <div className="text-left">
                            <div className="text-[10px] font-bold text-slate-100 uppercase tracking-wider">
                              Mode Ekstend EasyWorship
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">
                              Otomatis buka layar proyektor di Monitor 2 (InFocus)
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                            autoExtend
                              ? "bg-[#141417] text-[#f5cc00] border-[#cca000]/50"
                              : "bg-[#09090b] text-slate-400 border-[#27272a]"
                          }`}
                        >
                          {autoExtend ? "Aktif" : "Mati"}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(!showForgotPassword)}
                          className="text-[9px] font-bold text-slate-400 hover:text-[#f5cc00] transition-colors uppercase tracking-widest cursor-pointer"
                        >
                          {showForgotPassword ? "Tutup Bantuan" : "Lupa PIN?"}
                        </button>

                        <AnimatePresence>
                          {showForgotPassword && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.97 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              className="mt-2.5 bg-[#000000] border border-[#27272a] rounded-xl p-3 text-left w-full relative z-10"
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <KeyRound className="w-3.5 h-3.5 text-[#f5cc00] shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] font-bold text-slate-100 uppercase tracking-widest">
                                    Pemulihan PIN Mandiri
                                  </span>
                                  <p className="text-[9px] text-slate-400 leading-normal mt-0.5">
                                    Gunakan Password Akun Anda untuk masuk, atau setel ulang PIN operator ke "1234".
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setItemAccount("operator_pin", "1234", activeAccount.id);
                                  setPin("1234");
                                  setShowForgotPassword(false);
                                }}
                                className="w-full text-center py-2 bg-[#141417] hover:bg-[#202024] border border-[#cca000]/45 text-[#f5cc00] rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                              >
                                Setel Ulang PIN ke Bawaan "1234"
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2.5">
                      <button
                        type="submit"
                        disabled={pin.length < 3}
                        className={`py-3.5 w-full bg-[#f5cc00] hover:bg-[#ffd60a] ${
                          uiTheme === "light"
                            ? "disabled:bg-slate-200 disabled:text-slate-400 disabled:border disabled:border-slate-300 disabled:shadow-none"
                            : "disabled:bg-[#141417]/40 disabled:text-slate-500 disabled:border disabled:border-[#27272a] disabled:shadow-none"
                        } text-[#000000] rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_8px_24px_rgba(245,204,0,0.22)] cursor-pointer active:scale-[0.98]`}
                      >
                        Konfirmasi & Masuk Operator <Unlock className="w-3.5 h-3.5" />
                      </button>

                      {/* Tombol Portal Akun di bawah tombol konfirmasi & masuk operator */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountPortalModal(true);
                          setActiveAccountTab("info");
                        }}
                        className="py-3 w-full bg-[#141417]/80 hover:bg-[#141417] border border-[#cca000]/30 hover:border-[#f5cc00]/60 text-slate-100 hover:text-[#f5cc00] rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <Users className="w-4 h-4 text-[#cca000]" />
                        Portal Akun
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Modal Portal Akun */}
        <AnimatePresence>
          {showAccountPortalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                className="relative bg-[#09090b]/95 backdrop-blur-xl rounded-2xl border border-[#27272a] p-6 sm:p-7 transition-all flex flex-col justify-between overflow-hidden group max-w-lg w-full shadow-[0_24px_70px_rgba(0,0,0,0.85)] max-h-[90vh] overflow-y-auto text-left"
              >
                {/* Background Glow */}
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#cca000]/[0.1] filter blur-[60px] pointer-events-none" />

                <div>
                  {/* Header & Tabs */}
                  <div className="flex items-center justify-between mb-5 border-b border-[#27272a] pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#141417] flex items-center justify-center border border-[#cca000]/45">
                        <Users className="w-5 h-5 text-[#f5cc00]" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-100 uppercase tracking-tight">
                          Portal Akun Gereja
                        </h3>
                        <span className="text-[9.5px] text-[#cca000] font-mono">
                          Kelola & Pindah Akun Multi-Tenant
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAccountPortalModal(false)}
                      className="p-1.5 text-slate-400 hover:text-[#f5cc00] rounded-lg hover:bg-[#141417] transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-1.5 bg-[#000000] p-1.5 rounded-xl border border-[#27272a] mb-5">
                    <button
                      onClick={() => setActiveAccountTab("info")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                        activeAccountTab === "info"
                          ? "bg-[#141417] text-[#f5cc00] border border-[#cca000]/55"
                          : "text-slate-400 hover:text-slate-100 border border-transparent"
                      }`}
                    >
                      Status Akun
                    </button>
                    <button
                      onClick={() => setActiveAccountTab("create")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        activeAccountTab === "create"
                          ? "bg-[#141417] text-[#f5cc00] border border-[#cca000]/55"
                          : "text-slate-400 hover:text-slate-100 border border-transparent"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat Akun
                    </button>
                    <button
                      onClick={() => setActiveAccountTab("switch")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        activeAccountTab === "switch"
                          ? "bg-[#141417] text-[#f5cc00] border border-[#cca000]/55"
                          : "text-slate-400 hover:text-slate-100 border border-transparent"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Pilih ({accounts.length})
                    </button>
                  </div>

                  {/* Tab Content 1: Active Account Status */}
                  {activeAccountTab === "info" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3.5"
                    >
                      <div className="p-4 bg-[#000000]/85 border border-[#27272a] rounded-xl relative">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Akun Terhubung
                          </span>
                          <span className="text-[8.5px] font-bold px-2 py-0.5 bg-[#141417] text-[#f5cc00] rounded-md uppercase border border-[#cca000]/45">
                            Aktif Saat Ini
                          </span>
                        </div>
                        <div className="text-lg font-bold text-slate-100 mt-1.5 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-[#f5cc00] shrink-0" />
                          <span className="truncate">{activeAccount.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-[#cca000] mt-0.5">
                          Username ID: @{activeAccount.username}
                        </div>
                      </div>

                      <div className="bg-[#000000] p-3.5 rounded-xl border border-[#27272a] space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-slate-200 font-medium">
                          <Check className="w-4 h-4 text-[#f5cc00] shrink-0" />
                          <span>Lagu, Alkitab, dan Jadwal khusus akun ini</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200 font-medium">
                          <Check className="w-4 h-4 text-[#f5cc00] shrink-0" />
                          <span>Layar proyektor hanya menampilkan slide akun ini</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountToDelete(activeAccount)}
                          className="text-xs text-rose-300/90 hover:text-rose-200 hover:bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 transition-all font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" /> Hapus Akun Ini
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAccountTab("switch")}
                          className="text-xs text-[#f5cc00] hover:text-[#000000] px-3.5 py-2 rounded-xl border border-[#cca000]/50 bg-[#141417] hover:bg-[#f5cc00] transition-all font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-4 h-4" /> Kelola Semua Akun ({accounts.length})
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Tab Content 2: Create Account Form */}
                  {activeAccountTab === "create" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-tight">
                          Buat Akun Gereja Baru
                        </h3>
                        <span className="text-[10px] text-[#f5cc00] font-mono font-bold tabular-nums">
                          Akun #{accounts.length + 1}
                        </span>
                      </div>

                      <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
                        <div>
                          <label className="text-[9.5px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                            Nama Gereja / Pos Pelayanan
                          </label>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Contoh: HKBP Kebayoran / Pemuda GKI"
                            className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#27272a] rounded-xl text-xs text-slate-100 focus:outline-none focus:border-[#f5cc00] font-medium placeholder:text-slate-600"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[9.5px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                              Username ID
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#cca000] text-xs font-mono">@</span>
                              <input
                                type="text"
                                required
                                value={regUsername}
                                onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                placeholder="hkbp_kebayoran"
                                className="w-full pl-6 pr-2 py-2.5 bg-[#000000] border border-[#27272a] rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-[#f5cc00] placeholder:text-slate-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9.5px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                              PIN Operator
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              value={regPin}
                              onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ""))}
                              placeholder="1234"
                              className="w-full px-3 py-2.5 bg-[#000000] border border-[#27272a] rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-[#f5cc00] text-center font-bold tracking-widest tabular-nums"
                            />
                          </div>
                        </div>

                        {regError && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{regError}</span>
                          </div>
                        )}

                        {regSuccess && (
                          <div className="p-2.5 bg-[#141417] border border-[#cca000]/50 rounded-xl text-xs text-[#f5cc00] font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 shrink-0 text-[#f5cc00]" />
                            <span>{regSuccess}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-3 bg-[#f5cc00] hover:bg-[#ffd60a] text-[#000000] rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_8px_24px_rgba(245,204,0,0.22)] flex items-center justify-center gap-1.5 mt-2 cursor-pointer active:scale-[0.98]"
                        >
                          <UserPlus className="w-4 h-4" /> Buat & Aktifkan Akun
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {/* Tab Content 3: Switch Account List */}
                  {activeAccountTab === "switch" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-tight">
                          Daftar Akun Terdaftar ({accounts.length})
                        </h3>
                        <button
                          onClick={() => setActiveAccountTab("create")}
                          className="text-[10px] font-bold text-[#f5cc00] hover:underline uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Baru
                        </button>
                      </div>

                      {deleteSuccessMsg && (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{deleteSuccessMsg}</span>
                        </div>
                      )}

                      {deleteErrorMsg && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{deleteErrorMsg}</span>
                        </div>
                      )}

                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {accounts.map((acc) => {
                          const isCurrent = acc.id === activeAccount.id;
                          return (
                            <div
                              key={acc.id}
                              className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                                isCurrent
                                  ? "bg-[#141417]/80 border-[#cca000]/60 text-slate-100"
                                  : "bg-[#000000] border-[#27272a] hover:border-[#cca000]/45 text-slate-300"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                  <Building2 className="w-4 h-4 text-[#f5cc00] shrink-0" />
                                  <span className="truncate">{acc.name}</span>
                                  {isCurrent && (
                                    <span className="text-[8px] px-1.5 py-0.5 bg-[#09090b] text-[#f5cc00] rounded font-mono uppercase border border-[#cca000]/45">
                                      Aktif
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  @{acc.username}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isCurrent ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAccForSwitch(acc);
                                      setSwitchPassword("");
                                      setSwitchError("");
                                    }}
                                    className="px-3 py-1.5 bg-[#141417] hover:bg-[#f5cc00] border border-[#cca000]/50 text-[#f5cc00] hover:text-[#000000] rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                  >
                                    Ganti Akun
                                  </button>
                                ) : (
                                  <span className="text-[9.5px] font-bold text-[#f5cc00] px-2 py-1 bg-[#09090b] rounded-lg border border-[#cca000]/35">
                                    Sedang Dipakai
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAccountToDelete(acc);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/25 transition-all cursor-pointer"
                                  title={`Hapus Akun ${acc.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Password Modal for Switch Account */}
                  {selectedAccForSwitch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-5 max-w-sm w-full text-left shadow-2xl">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#f5cc00]" />
                            <h4 className="text-sm font-bold text-slate-100 uppercase">
                              Masuk ke {selectedAccForSwitch.name}
                            </h4>
                          </div>
                          <button
                            onClick={() => setSelectedAccForSwitch(null)}
                            className="p-1 text-slate-400 hover:text-[#f5cc00] cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 mb-4">
                          Masukkan PIN Operator atau Password untuk berpindah ke akun <strong className="text-[#f5cc00]">@{selectedAccForSwitch.username}</strong>.
                        </p>

                        <form onSubmit={handleSwitchAccountSubmit} className="space-y-3">
                          <input
                            type="password"
                            autoFocus
                            value={switchPassword}
                            onChange={(e) => setSwitchPassword(e.target.value)}
                            placeholder="PIN / Password Akun"
                            className="w-full px-3 py-2.5 bg-[#000000] border border-[#27272a] rounded-xl text-center text-lg font-black tracking-widest text-slate-100 focus:outline-none focus:border-[#f5cc00]"
                          />

                          {switchError && (
                            <p className="text-[10px] text-rose-400 font-bold text-center">
                              {switchError}
                            </p>
                          )}

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-[#f5cc00] hover:bg-[#ffd60a] text-[#000000] rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
                          >
                            Konfirmasi Pindah Akun
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Delete Account Confirmation Modal */}
                  {accountToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
                      <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-6 max-w-md w-full text-left shadow-2xl relative">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                              <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-slate-100 uppercase tracking-tight">
                                {accounts.length <= 1 ? "Tidak Dapat Menghapus Akun" : "Konfirmasi Hapus Akun"}
                              </h4>
                              <span className="text-[10px] text-[#cca000] font-mono font-semibold">
                                @{accountToDelete.username}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setAccountToDelete(null)}
                            className="p-1.5 text-slate-400 hover:text-[#f5cc00] rounded-lg hover:bg-[#141417] transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {accounts.length <= 1 ? (
                          <div className="space-y-4">
                            <div className="p-3.5 bg-[#141417]/60 border border-[#cca000]/40 rounded-xl text-[#f5cc00] text-xs leading-relaxed">
                              Akun <strong>"{accountToDelete.name}"</strong> adalah satu-satunya akun yang terdaftar dalam sistem. Sistem memerlukan minimal 1 akun aktif untuk beroperasi.
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Jika ingin menghapus atau mengganti akun ini, silakan buat akun baru terlebih dahulu melalui tab <strong>"Buat Akun"</strong>.
                            </p>
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAccountToDelete(null);
                                  setActiveAccountTab("create");
                                }}
                                className="flex-1 py-2.5 bg-[#f5cc00] hover:bg-[#ffd60a] text-[#000000] rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Buat Akun Baru
                              </button>
                              <button
                                type="button"
                                onClick={() => setAccountToDelete(null)}
                                className="px-4 py-2.5 bg-[#141417]/80 hover:bg-[#141417] border border-[#27272a] text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Tutup
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-3.5 bg-[#000000] border border-[#27272a] rounded-xl">
                              <div className="text-xs text-slate-400 mb-1">
                                Anda akan menghapus akun gereja:
                              </div>
                              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#f5cc00] shrink-0" />
                                <span className="truncate">{accountToDelete.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Username ID: @{accountToDelete.username}
                              </div>
                            </div>

                            <div className="text-xs text-slate-400 space-y-1.5 bg-[#000000] p-3 rounded-xl border border-[#27272a]">
                              <div className="text-rose-400 font-bold flex items-center gap-1.5 text-[11px]">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Perhatian: Tindakan ini permanen!
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                Seluruh koleksi lagu kustom, daftar jadwal ibadah, pengaturan layout proyektor, dan PIN operator untuk akun ini akan dihapus dari sistem.
                              </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setAccountToDelete(null)}
                                className="flex-1 py-2.5 bg-[#141417]/80 hover:bg-[#141417] border border-[#27272a] text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={confirmDeleteAccount}
                                className="flex-1 py-2.5 bg-rose-600/85 hover:bg-rose-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" /> Ya, Hapus Akun
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="mt-5 pt-3.5 border-t border-[#27272a] flex items-center justify-between text-[10px] text-slate-400">
                  <button
                    onClick={() => setActiveAccountTab(activeAccountTab === "create" ? "switch" : "create")}
                    className="font-bold text-[#f5cc00] hover:underline flex items-center gap-1 uppercase cursor-pointer"
                  >
                    {activeAccountTab === "create" ? (
                      <>
                        <Users className="w-3.5 h-3.5" /> Lihat Daftar Akun ({accounts.length})
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Buat Akun Baru
                      </>
                    )}
                  </button>

                  <div className="text-[9.5px] text-slate-400 font-mono">
                    Multi-Tenant Isolated Data
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider z-10 py-4 border-t border-[#27272a]/80 gap-4">
        <div className="flex items-center space-x-4">
          <div className="text-slate-300">Church Presenter System</div>
          <div className="text-[#27272a] hidden sm:inline">|</div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#09090b] border border-[#27272a] text-slate-300 rounded-md text-[8.5px] font-bold">
            <Copy className="w-3 h-3 text-[#cca000]" />
            <span className="text-slate-200 font-bold">DILARANG MENDUPLIKAT APLIKASI</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[9px] text-slate-400">
          <span>App Developer :</span>
          <span className="text-[#f5cc00] font-bold uppercase tracking-tight text-[10px]">
            Pirma Siahaan
          </span>
          <span className="text-[#27272a] hidden sm:inline">|</span>
          <span className="text-slate-300 font-mono lowercase">
            Email : pirmasiahaan1234@gmail.com
          </span>
        </div>

        <div className="text-slate-400 text-[9px]">
          All rights reserved &copy; 2026
        </div>
      </footer>
    </div>
  );
}
