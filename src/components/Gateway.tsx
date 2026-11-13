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
  ShieldCheck,
  Building2,
  Check,
  AlertCircle,
  LogOut,
  X,
  Plus,
  Trash2,
  Sparkles
} from "lucide-react";
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

      setRegSuccess(`Akun "${newAcc.name}" berhasil dibuat & langsung aktif!`);
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
    <div className="min-h-screen bg-[#070709] text-gray-200 flex flex-col justify-between p-6 select-none relative overflow-hidden">
      {/* Decorative Blur Spheres (Strict Blue, Green, Red) */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[45%] h-[45%] rounded-full bg-green-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[30%] w-[45%] h-[45%] rounded-full bg-red-600/15 blur-[120px] pointer-events-none" />

      {/* Header / Logo */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center z-10 py-4">
        <div className="flex items-center space-x-3">
          <AppLogo className="w-10 h-10" showText={false} bgWhiteSquare={true} />
          <div className="text-left hidden sm:block">
            <span className="font-mono text-[9px] font-black tracking-[0.25em] text-blue-500 uppercase">
              System Gateway
            </span>
            <h1 className="text-sm font-black text-white tracking-widest uppercase -mt-0.5">
              Church Presenter
            </h1>
          </div>
        </div>
        
        {/* Active Account Header Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 bg-blue-950/60 border border-blue-500/30 rounded-full text-[10px] font-black text-blue-300 flex items-center gap-2 shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-green-400" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">{activeAccount.name}</span>
            <span className="text-[9px] text-blue-400/80 font-mono">@{activeAccount.username}</span>
          </div>
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-bold text-gray-400 uppercase tracking-widest hidden md:block">
            Multi-User v7v2.5
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto my-auto py-6 z-10 flex flex-col items-center justify-center">
        {/* Animated Headline */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-none mb-3 uppercase">
            Sistem Presentasi Gereja
          </h2>
          <p className="text-xs md:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed font-mono font-normal no-underline">
            Sistem dimuat per akun. Lagu, Alkitab, jadwal ibadah, dan proyektor akun tidak akan saling tercampur dengan akun lainnya.
          </p>
        </motion.div>

        {/* Main Single Centered Card */}
        <div className="w-full max-w-md mx-auto">
          {/* Card: Login Operator & Gateway */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`relative bg-[#111118]/90 backdrop-blur-md rounded-2xl border ${
              showPinForm
                ? "border-blue-500/60 shadow-xl shadow-blue-500/10"
                : "border-blue-500/25 hover:border-blue-500/40 hover:bg-[#141422]"
            } p-7 transition-all flex flex-col justify-between overflow-hidden group min-h-[400px] shadow-2xl`}
          >
            {/* Background Glow */}
            <div
              className={`absolute top-0 right-0 w-40 h-40 rounded-full filter blur-[60px] opacity-25 pointer-events-none transition-all ${
                showPinForm ? "bg-blue-600" : "bg-blue-500"
              }`}
            />

            <AnimatePresence mode="wait">
              {!showPinForm ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[#2880ff] flex items-center justify-center mb-5 border border-blue-500/30 shadow-lg shadow-blue-600/20">
                      <Sliders className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                        Login Operator
                      </h3>
                      <span className="p-1 bg-blue-500/10 border border-blue-500/30 rounded text-[8px] text-blue-400 font-extrabold flex items-center gap-1 uppercase tracking-wider">
                        <Lock className="w-2 h-2" /> Protected
                      </span>
                    </div>

                    <div className="mt-3.5 p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                          Akun Operator Aktif:
                        </span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-blue-500/25 text-blue-200 rounded uppercase border border-blue-400/20">
                          Aktif
                        </span>
                      </div>
                      <div className="text-base font-black text-white mt-1 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate">{activeAccount.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-blue-300/80 mt-0.5">
                        ID: @{activeAccount.username}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-3.5 leading-relaxed">
                      Dashboard utama operator untuk mengatur lagu, alkitab, jadwal ibadah, layout slide, dan media background khusus akun <strong>{activeAccount.name}</strong>.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-2.5">
                    <button
                      onClick={() => {
                        setShowPinForm(true);
                        setPin("");
                      }}
                      className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 cursor-pointer group-hover:scale-[1.01] active:scale-95"
                    >
                      Masuk Menu Operator <ArrowRight className="w-3.5 h-3.5 bg-blue-700 p-0.5 rounded-full" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountPortalModal(true);
                        setActiveAccountTab("info");
                      }}
                      className="py-3 bg-[#0d1424] hover:bg-[#121f38] border border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/40 cursor-pointer active:scale-95"
                    >
                      <Users className="w-4 h-4 text-blue-400" />
                      Portal Akun
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pin-form"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="h-full flex flex-col justify-between"
                >
                  <form onSubmit={handleOperatorAccess} className="flex-1 flex flex-col justify-between text-left">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-blue-400 font-black tracking-widest uppercase">
                          Validasi PIN Operator ({activeAccount.name})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPinForm(false)}
                          className="text-[9px] text-gray-500 hover:text-white uppercase font-black tracking-widest cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>

                      <p className="text-xs text-gray-400 leading-normal mb-4">
                        Masukkan PIN untuk masuk ke akun <strong>{activeAccount.name}</strong>.
                      </p>

                      <div className="relative">
                        <input
                          type={showPinText ? "text" : "password"}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="••••"
                          autoFocus
                          className={`w-full tracking-[1.5em] text-center font-black text-2xl py-3.5 bg-[#070709] border ${
                            hasPinError
                              ? "border-red-500/70 focus:border-red-500 bg-red-950/20 text-red-500"
                              : "border-blue-500/30 focus:border-blue-500 text-white"
                          } rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPinText(!showPinText)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {showPinText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {hasPinError && (
                        <p className="text-[9px] text-red-500 font-black uppercase tracking-widest text-center mt-2 animate-bounce">
                          PIN / Password Salah! Silahkan coba lagi.
                        </p>
                      )}

                      {/* Mode Ekstend EasyWorship Toggle */}
                      <div
                        onClick={() => setAutoExtend(!autoExtend)}
                        className="mt-3.5 p-3 bg-blue-950/30 border border-blue-500/30 hover:border-blue-500/60 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          {autoExtend ? (
                            <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <div className="text-left">
                            <div className="text-[10px] font-black text-white uppercase tracking-wider">
                              Mode Ekstend EasyWorship
                            </div>
                            <div className="text-[9px] text-gray-400 leading-tight">
                              Otomatis buka layar proyektor di Monitor 2 (InFocus)
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            autoExtend ? "bg-blue-500/30 text-blue-300" : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {autoExtend ? "Aktif" : "Mati"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(!showForgotPassword)}
                          className="text-[9px] font-black text-gray-500 hover:text-blue-400 transition-colors uppercase tracking-widest cursor-pointer"
                        >
                          {showForgotPassword ? "Tutup Bantuan" : "Lupa PIN?"}
                        </button>

                        <AnimatePresence>
                          {showForgotPassword && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="mt-2.5 bg-[#070709] border border-[#2A2A2E]/60 rounded-xl p-3 text-left w-full relative z-10"
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <KeyRound className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] font-black text-white uppercase tracking-widest">
                                    Pemulihan PIN Mandiri
                                  </span>
                                  <p className="text-[9px] text-gray-500 leading-normal mt-0.5">
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
                                className="w-full text-center py-2 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
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
                        className="py-3.5 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/40 disabled:text-gray-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/25 cursor-pointer active:scale-95"
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
                        className="py-3 w-full bg-[#0d1424] hover:bg-[#121f38] border border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/40 cursor-pointer active:scale-95"
                      >
                        <Users className="w-4 h-4 text-blue-400" />
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-[#0d1424]/95 backdrop-blur-md rounded-2xl border border-blue-500/30 p-6 sm:p-7 transition-all flex flex-col justify-between overflow-hidden group max-w-lg w-full shadow-2xl shadow-blue-950/50 max-h-[90vh] overflow-y-auto text-left"
              >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-blue-600/15 filter blur-[60px] pointer-events-none" />

                <div>
                  {/* Header & Tabs */}
                  <div className="flex items-center justify-between mb-5 border-b border-blue-500/15 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center border border-blue-400/40 shadow-md shadow-blue-600/25">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">
                          Portal Akun Gereja
                        </h3>
                        <span className="text-[9.5px] text-blue-300/80 font-mono">
                          Kelola & Pindah Akun Multi-Tenant
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAccountPortalModal(false)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-1.5 bg-[#060b14] p-1.5 rounded-xl border border-blue-500/20 mb-5">
                    <button
                      onClick={() => setActiveAccountTab("info")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                        activeAccountTab === "info"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Status Akun
                    </button>
                    <button
                      onClick={() => setActiveAccountTab("create")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        activeAccountTab === "create"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat Akun
                    </button>
                    <button
                      onClick={() => setActiveAccountTab("switch")}
                      className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        activeAccountTab === "switch"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                          : "text-slate-400 hover:text-white"
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
                      <div className="p-4 bg-blue-950/40 border border-blue-500/30 rounded-xl relative shadow-inner">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            Akun Terhubung
                          </span>
                          <span className="text-[8.5px] font-black px-2 py-0.5 bg-blue-500/25 text-blue-200 rounded uppercase border border-blue-400/20">
                            Aktif Saat Ini
                          </span>
                        </div>
                        <div className="text-lg font-black text-white mt-1.5 flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
                          <span className="truncate">{activeAccount.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-blue-300/80 mt-0.5">
                          Username ID: @{activeAccount.username}
                        </div>
                      </div>

                      <div className="bg-[#070d18] p-3.5 rounded-xl border border-blue-500/15 space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold">
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Lagu, Alkitab, dan Jadwal khusus akun ini</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200 font-semibold">
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Layar proyektor hanya menampilkan slide akun ini</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setAccountToDelete(activeAccount)}
                          className="text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 px-3 py-2 rounded-xl border border-rose-500/30 transition-all font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" /> Hapus Akun Ini
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAccountTab("switch")}
                          className="text-xs text-blue-300 hover:text-white px-3.5 py-2 rounded-xl border border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/20 transition-all font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-blue-400" /> Kelola Semua Akun ({accounts.length})
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Tab Content 2: Create Account Form */}
                  {activeAccountTab === "create" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">
                          Buat Akun Gereja Baru
                        </h3>
                        <span className="text-[10px] text-blue-400 font-mono font-bold">
                          Akun #{accounts.length + 1}
                        </span>
                      </div>

                      <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
                        <div>
                          <label className="text-[9.5px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                            Nama Gereja / Pos Pelayanan
                          </label>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Contoh: HKBP Kebayoran / Pemuda GKI"
                            className="w-full px-3.5 py-2.5 bg-[#070d18] border border-blue-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[9.5px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                              Username ID
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-mono">@</span>
                              <input
                                type="text"
                                required
                                value={regUsername}
                                onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                placeholder="hkbp_kebayoran"
                                className="w-full pl-6 pr-2 py-2.5 bg-[#070d18] border border-blue-500/20 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9.5px] font-black text-slate-300 uppercase tracking-wider block mb-1">
                              PIN Operator
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              value={regPin}
                              onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ""))}
                              placeholder="1234"
                              className="w-full px-3 py-2.5 bg-[#070d18] border border-blue-500/20 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500 text-center font-bold tracking-widest"
                            />
                          </div>
                        </div>

                        {regError && (
                          <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{regError}</span>
                          </div>
                        )}

                        {regSuccess && (
                          <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 shrink-0 text-blue-400" />
                            <span>{regSuccess}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 mt-2 cursor-pointer active:scale-95"
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
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">
                          Daftar Akun Terdaftar ({accounts.length})
                        </h3>
                        <button
                          onClick={() => setActiveAccountTab("create")}
                          className="text-[10px] font-black text-blue-400 hover:underline uppercase flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah Baru
                        </button>
                      </div>

                      {deleteSuccessMsg && (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{deleteSuccessMsg}</span>
                        </div>
                      )}

                      {deleteErrorMsg && (
                        <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{deleteErrorMsg}</span>
                        </div>
                      )}

                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                        {accounts.map((acc) => {
                          const isCurrent = acc.id === activeAccount.id;
                          return (
                            <div
                              key={acc.id}
                              className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                                isCurrent
                                  ? "bg-blue-950/40 border-blue-500/50 text-white shadow-sm shadow-blue-950/50"
                                  : "bg-[#070d18] border-blue-500/15 hover:border-blue-500/35 text-slate-300"
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-black truncate flex items-center gap-1.5">
                                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                                  <span className="truncate">{acc.name}</span>
                                  {isCurrent && (
                                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/25 text-blue-300 rounded font-mono uppercase border border-blue-400/20">
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
                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                  >
                                    Ganti Akun
                                  </button>
                                ) : (
                                  <span className="text-[9.5px] font-extrabold text-blue-400 px-2 py-1 bg-blue-500/15 rounded-lg border border-blue-500/20">
                                    Sedang Dipakai
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAccountToDelete(acc);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 rounded-lg border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
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
                      <div className="bg-[#0b1322] border border-blue-500/30 rounded-2xl p-5 max-w-sm w-full text-left shadow-2xl">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <h4 className="text-sm font-black text-white uppercase">
                              Masuk ke {selectedAccForSwitch.name}
                            </h4>
                          </div>
                          <button
                            onClick={() => setSelectedAccForSwitch(null)}
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-slate-300 mb-4">
                          Masukkan PIN Operator atau Password untuk berpindah ke akun <strong>@{selectedAccForSwitch.username}</strong>.
                        </p>

                        <form onSubmit={handleSwitchAccountSubmit} className="space-y-3">
                          <input
                            type="password"
                            autoFocus
                            value={switchPassword}
                            onChange={(e) => setSwitchPassword(e.target.value)}
                            placeholder="PIN / Password Akun"
                            className="w-full px-3 py-2.5 bg-[#070d18] border border-blue-500/25 rounded-xl text-center text-lg font-black tracking-widest text-white focus:outline-none focus:border-blue-500"
                          />

                          {switchError && (
                            <p className="text-[10px] text-rose-400 font-bold text-center">
                              {switchError}
                            </p>
                          )}

                          <button
                            type="submit"
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-600/30"
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
                      <div className="bg-[#0b1322] border border-blue-500/40 rounded-2xl p-6 max-w-md w-full text-left shadow-2xl relative">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                              <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-base font-black text-white uppercase tracking-tight">
                                {accounts.length <= 1 ? "Tidak Dapat Menghapus Akun" : "Konfirmasi Hapus Akun"}
                              </h4>
                              <span className="text-[10px] text-blue-400 font-mono font-bold">
                                @{accountToDelete.username}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setAccountToDelete(null)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {accounts.length <= 1 ? (
                          <div className="space-y-4">
                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed">
                              Akun <strong>"{accountToDelete.name}"</strong> adalah satu-satunya akun yang terdaftar dalam sistem. Sistem memerlukan minimal 1 akun aktif untuk beroperasi.
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Jika ingin menghapus atau mengganti akun ini, silakan buat akun baru terlebih dahulu melalui tab <strong>"Buat Akun"</strong>.
                            </p>
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAccountToDelete(null);
                                  setActiveAccountTab("create");
                                }}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-600/30"
                              >
                                Buat Akun Baru
                              </button>
                              <button
                                type="button"
                                onClick={() => setAccountToDelete(null)}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Tutup
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-3.5 bg-slate-900/90 border border-blue-500/30 rounded-xl">
                              <div className="text-xs text-slate-300 mb-1">
                                Anda akan menghapus akun gereja:
                              </div>
                              <div className="text-sm font-black text-white flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="truncate">{accountToDelete.name}</span>
                              </div>
                              <div className="text-[10px] text-blue-300 font-mono mt-0.5">
                                Username ID: @{accountToDelete.username}
                              </div>
                            </div>

                            <div className="text-xs text-slate-400 space-y-1.5 bg-[#070d18] p-3 rounded-xl border border-white/5">
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
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={confirmDeleteAccount}
                                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
                <div className="mt-5 pt-3.5 border-t border-blue-500/15 flex items-center justify-between text-[10px] text-slate-400">
                  <button
                    onClick={() => setActiveAccountTab(activeAccountTab === "create" ? "switch" : "create")}
                    className="font-bold text-blue-400 hover:underline flex items-center gap-1 uppercase cursor-pointer"
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

                  <div className="text-[9.5px] text-slate-500 font-mono">
                    Multi-Tenant Isolated Data
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider z-10 py-4 border-t border-white/5 gap-4">
        <div className="flex items-center space-x-4">
          <div className="text-zinc-400">Church Presenter System</div>
          <div className="text-zinc-600 hidden sm:inline">|</div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#000000] border border-red-500/20 text-red-500 rounded-md text-[8.5px] font-extrabold shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
            <Copy className="w-3 h-3 text-red-500" />
            <span className="text-zinc-300 font-black">DILARANG MENDUPLIKAT APLIKASI</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-[9px] text-zinc-500">
          <span>App Developer :</span>
          <span className="text-blue-400 font-black uppercase tracking-tight text-[10px]">
            Pirma Siahaan
          </span>
          <span className="text-zinc-700 hidden sm:inline">|</span>
          <span className="text-zinc-400 font-mono lowercase">
            Email : pirmasiahaan1234@gmail.com
          </span>
        </div>

        <div className="text-zinc-500 text-[9px]">
          All rights reserved &copy; 2026
        </div>
      </footer>
    </div>
  );
}
