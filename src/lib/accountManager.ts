/**
 * Account Manager & Storage Isolator for Church Presenter
 * Manages multi-account registration, login, switching, and scoped LocalStorage isolation.
 */

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  password?: string;
  operatorPin: string;
  createdAt: string;
}

const STORAGE_ACCOUNTS_KEY = "cp_registered_accounts";
const STORAGE_ACTIVE_ACCOUNT_KEY = "cp_active_account_id";

export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: "acc_default",
    name: "Gereja Utama",
    username: "admin",
    password: "123",
    operatorPin: "1234",
    createdAt: new Date().toISOString()
  }
];

export function getAccounts(): UserAccount[] {
  if (typeof window === "undefined") return DEFAULT_ACCOUNTS;
  try {
    const d = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (d) {
      const parsed = JSON.parse(d);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading accounts:", e);
  }
  // Initialize default account if none saved
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
  } catch {}
  return DEFAULT_ACCOUNTS;
}

export function saveAccounts(accounts: UserAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accounts)
    }).catch(() => {});
  } catch (e) {
    console.error("Failed to save accounts:", e);
  }
}

export function getActiveAccountId(): string {
  if (typeof window === "undefined") return "acc_default";
  const id = localStorage.getItem(STORAGE_ACTIVE_ACCOUNT_KEY);
  if (id) return id;
  const accounts = getAccounts();
  const firstId = accounts[0]?.id || "acc_default";
  localStorage.setItem(STORAGE_ACTIVE_ACCOUNT_KEY, firstId);
  return firstId;
}

export function setActiveAccountId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ACTIVE_ACCOUNT_KEY, id);
}

export function getActiveAccount(): UserAccount {
  const id = getActiveAccountId();
  const accounts = getAccounts();
  return accounts.find(a => a.id === id) || accounts[0] || DEFAULT_ACCOUNTS[0];
}

export function createAccount(data: { name: string; username: string; password?: string; operatorPin?: string }): UserAccount {
  const accounts = getAccounts();
  const cleanUsername = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
  
  if (!cleanUsername) {
    throw new Error("Username ID tidak boleh kosong!");
  }

  // Check duplicate username
  const existing = accounts.find(a => a.username.toLowerCase() === cleanUsername);
  if (existing) {
    throw new Error(`Username "@${cleanUsername}" sudah digunakan! Silahkan gunakan username ID lain.`);
  }

  const newAccount: UserAccount = {
    id: "acc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    name: data.name.trim() || "Gereja Baru",
    username: cleanUsername,
    password: data.password || "123456",
    operatorPin: data.operatorPin || "1234",
    createdAt: new Date().toISOString()
  };

  const updated = [...accounts, newAccount];
  saveAccounts(updated);
  setActiveAccountId(newAccount.id);
  return newAccount;
}

export function updateAccountPin(accountId: string, newPin: string): void {
  const accounts = getAccounts();
  const updated = accounts.map(a => a.id === accountId ? { ...a, operatorPin: newPin } : a);
  saveAccounts(updated);
}

export function deleteAccount(accountId: string): UserAccount[] {
  const accounts = getAccounts();
  if (accounts.length <= 1) {
    throw new Error("Minimal harus ada 1 akun aktif dalam sistem.");
  }
  const updated = accounts.filter(a => a.id !== accountId);
  saveAccounts(updated);

  // Clean up all localStorage keys associated with this account
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      const prefix = `cp_acc_${accountId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  // If the deleted account was the active account, switch to first available account
  const activeId = getActiveAccountId();
  if (activeId === accountId && updated.length > 0) {
    setActiveAccountId(updated[0].id);
  }

  return updated;
}

/**
 * Generates account-scoped LocalStorage key to ensure Account 2
 * NEVER sees Account 1's songs, schedules, or configuration.
 */
export function getAccountStorageKey(key: string, accountId?: string): string {
  const accId = accountId || getActiveAccountId();
  return `cp_acc_${accId}_${key}`;
}

export function getItemAccount(key: string, accountId?: string): string | null {
  if (typeof window === "undefined") return null;
  const targetAccId = accountId || getActiveAccountId();
  const scopedKey = `cp_acc_${targetAccId}_${key}`;
  const val = localStorage.getItem(scopedKey);
  if (val !== null) return val;

  // Fallback to non-scoped legacy key ONLY if default account and legacy key exists
  if (targetAccId === "acc_default") {
    return localStorage.getItem(key);
  }
  return null;
}

export function setItemAccount(key: string, value: string, accountId?: string): void {
  if (typeof window === "undefined") return;
  const targetAccId = accountId || getActiveAccountId();
  const scopedKey = `cp_acc_${targetAccId}_${key}`;
  localStorage.setItem(scopedKey, value);
}

export function removeItemAccount(key: string, accountId?: string): void {
  if (typeof window === "undefined") return;
  const targetAccId = accountId || getActiveAccountId();
  const scopedKey = `cp_acc_${targetAccId}_${key}`;
  localStorage.removeItem(scopedKey);
}
