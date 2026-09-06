const API_BASE_URL = "http://localhost:5000/api";
const REQUEST_TIMEOUT_MS = 30000;

interface ApiErrorResponse {
  success?: boolean;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("ecis-token");
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorData = data as ApiErrorResponse | null;

      if (response.status === 401 && token) {
        localStorage.removeItem("ecis-token");
        localStorage.removeItem("ecis-user");
        window.location.href = "/login";
      }

      throw new Error(
        errorData?.message ||
          `Request failed with status ${response.status}.`,
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The request timed out. Please check that the backend and PostgreSQL database are running.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

export function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "DELETE" });
}

export function clearAuth() {
  localStorage.removeItem("ecis-token");
  localStorage.removeItem("ecis-user");
}
