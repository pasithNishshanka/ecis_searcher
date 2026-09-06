const API_BASE_URL = "http://localhost:5000/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("ecis-token");

  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401) {
    localStorage.removeItem("ecis-token");
    localStorage.removeItem("ecis-user");

    window.location.href = "/login";

    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : "Request failed.";

    throw new Error(message);
  }

  return data as T;
}

export function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "GET",
  });
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
  return apiRequest<T>(endpoint, {
    method: "DELETE",
  });
}
