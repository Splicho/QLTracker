import { useEffect, useState } from "react"

const LOCAL_STORAGE_SYNC_EVENT = "qltracker-local-storage-sync"

export function useLocalStorage(key: string, initialValue: string) {
  const [value, setValue] = useState(() =>
    typeof window === "undefined"
      ? initialValue
      : (window.localStorage.getItem(key) ?? initialValue)
  )

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(key, value)
    window.dispatchEvent(
      new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
        detail: { key, value },
      })
    )
  }, [key, value])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== key) {
        return
      }

      setValue(event.newValue ?? initialValue)
    }

    function handleLocalSync(event: Event) {
      const customEvent = event as CustomEvent<{ key: string; value: string }>
      if (customEvent.detail?.key !== key) {
        return
      }

      setValue(customEvent.detail.value ?? initialValue)
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleLocalSync)
    }
  }, [initialValue, key])

  return [value, setValue] as const
}
