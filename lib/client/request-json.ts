export function requestJson<T>(url: string, init?: RequestInit) {
  return fetch(url, {
    credentials: init?.credentials ?? "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  }).then(async (response) => {
    const payload = (await response.json()) as T & { message?: string }
    if (!response.ok) {
      throw new Error(payload.message ?? "Request failed.")
    }

    return payload
  })
}
