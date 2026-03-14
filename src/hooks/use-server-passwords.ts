import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const SERVER_PASSWORDS_STORAGE_KEY = "qltracker-server-passwords";

type ServerPasswordsState = Record<string, string>;

function parseServerPasswords(rawValue: string): ServerPasswordsState {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function serializeServerPasswords(state: ServerPasswordsState) {
  return JSON.stringify(state);
}

export function useServerPasswords() {
  const [rawValue, setRawValue] = useLocalStorage(
    SERVER_PASSWORDS_STORAGE_KEY,
    serializeServerPasswords({}),
  );

  const state = useMemo(() => parseServerPasswords(rawValue), [rawValue]);

  function getPassword(addr: string) {
    return state[addr] ?? "";
  }

  function savePassword(addr: string, password: string) {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      return;
    }

    setRawValue(
      serializeServerPasswords({
        ...state,
        [addr]: trimmedPassword,
      }),
    );
  }

  return {
    getPassword,
    savePassword,
  };
}
