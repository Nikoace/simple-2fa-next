import { useEffect, useState } from "react";

import { type AccountWithCode, addAccount, getAccounts } from "@/lib/tauri";
import { useVaultStore } from "@/stores/vault";

function App() {
  const { status, error, checkStatus, setup, unlock, lock } = useVaultStore();

  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState<AccountWithCode[]>([]);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [secret, setSecret] = useState("");
  const [accountsError, setAccountsError] = useState<string | null>(null);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (status !== "unlocked") {
      setAccounts([]);
      return;
    }

    void (async () => {
      try {
        const list = await getAccounts();
        setAccounts(list);
        setAccountsError(null);
      } catch (e) {
        setAccountsError(String(e));
      }
    })();
  }, [status]);

  async function onSetup() {
    await setup(password);
    setPassword("");
  }

  async function onUnlock() {
    await unlock(password);
    setPassword("");
  }

  async function onAddAccount() {
    try {
      const account = await addAccount({
        name,
        issuer: issuer || undefined,
        secret,
      });
      setAccounts((prev) => [...prev, account]);
      setName("");
      setIssuer("");
      setSecret("");
      setAccountsError(null);
    } catch (e) {
      setAccountsError(String(e));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 bg-background px-4 py-8 text-foreground">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simple 2FA Next</h1>
          <p className="text-sm text-muted-foreground">M2 minimal flow</p>
        </div>
        <span className="rounded border px-2 py-1 text-xs">{status}</span>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {status === "loading" && <p>Loading vault status...</p>}

      {status === "uninitialized" && (
        <section className="rounded border p-4">
          <h2 className="mb-2 text-lg font-semibold">Set master password</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border bg-transparent px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
            />
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => void onSetup()}
            >
              Setup Vault
            </button>
          </div>
        </section>
      )}

      {status === "locked" && (
        <section className="rounded border p-4">
          <h2 className="mb-2 text-lg font-semibold">Unlock vault</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border bg-transparent px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
            />
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => void onUnlock()}
            >
              Unlock
            </button>
          </div>
        </section>
      )}

      {status === "unlocked" && (
        <>
          <section className="rounded border p-4">
            <h2 className="mb-2 text-lg font-semibold">Add account</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="rounded border bg-transparent px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Account name"
              />
              <input
                className="rounded border bg-transparent px-3 py-2"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Issuer (optional)"
              />
              <input
                className="rounded border bg-transparent px-3 py-2"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Base32 secret"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() => void onAddAccount()}
              >
                Add
              </button>
              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() => void lock()}
              >
                Lock Vault
              </button>
            </div>
          </section>

          <section className="rounded border p-4">
            <h2 className="mb-2 text-lg font-semibold">Accounts</h2>
            {accountsError && <p className="mb-2 text-sm text-red-500">{accountsError}</p>}
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet</p>
            ) : (
              <ul className="space-y-2">
                {accounts.map((acc) => (
                  <li key={acc.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.issuer ?? "Unknown issuer"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xl tracking-widest">{acc.code}</p>
                      <p className="text-xs text-muted-foreground">TTL: {acc.ttl}s</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default App;
