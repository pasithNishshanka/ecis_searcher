const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 30000;


/* ============================================================
   TYPES
   ============================================================ */

interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  code?: string;
}

interface RefreshResponse {
  success?: boolean;

  data?: {
    token?: string;
    user?: unknown;
  };
}


/* ============================================================
   AUTH STATE
   ============================================================ */

let refreshPromise:
  | Promise<string | null>
  | null = null;

let redirectingToLogin = false;


/* ============================================================
   TOKEN HELPERS
   ============================================================ */

function getAccessToken(): string | null {
  return localStorage.getItem(
    "ecis-token",
  );
}


function getRefreshToken(): string | null {
  return localStorage.getItem(
    "ecis-refresh-token",
  );
}


function saveAccessToken(
  token: string,
  user?: unknown,
): void {
  localStorage.setItem(
    "ecis-token",
    token,
  );

  if (user) {
    localStorage.setItem(
      "ecis-user",
      JSON.stringify(user),
    );
  }
}


function clearAuthentication(): void {
  localStorage.removeItem(
    "ecis-token",
  );

  localStorage.removeItem(
    "ecis-refresh-token",
  );

  localStorage.removeItem(
    "ecis-user",
  );
}


/* ============================================================
   LOGIN REDIRECT
   ============================================================ */

function redirectToLogin(): void {
  if (
    redirectingToLogin ||
    window.location.pathname === "/login"
  ) {
    return;
  }

  redirectingToLogin = true;

  const currentPath =
    window.location.pathname +
    window.location.search;

  window.location.href =
    `/login?redirect=${encodeURIComponent(
      currentPath,
    )}`;
}


/* ============================================================
   REFRESH ACCESS TOKEN
   ============================================================ */

export async function refreshAccessToken(): Promise<
  string | null
> {
  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/auth/refresh`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            refreshToken,
          }),
        },
      );

    let data:
      | RefreshResponse
      | null = null;

    try {
      data =
        (await response.json()) as RefreshResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      clearAuthentication();

      return null;
    }

    const newToken =
      data?.data?.token;

    if (!newToken) {
      clearAuthentication();

      return null;
    }

    saveAccessToken(
      newToken,
      data?.data?.user,
    );

    return newToken;
  } catch {
    return null;
  }
}


/* ============================================================
   SINGLE REFRESH REQUEST
   ============================================================ */

async function getNewAccessToken(): Promise<
  string | null
> {
  if (!refreshPromise) {
    refreshPromise =
      refreshAccessToken();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  return refreshPromise;
}


/* ============================================================
   RESTORE SESSION
   ============================================================ */

export async function restoreSession(): Promise<boolean> {
  const accessToken =
    getAccessToken();

  if (accessToken) {
    return true;
  }

  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  const token =
    await getNewAccessToken();

  return Boolean(token);
}


/* ============================================================
   GENERIC REQUEST
   ============================================================ */

async function request(
  endpoint: string,
  options: RequestInit,
  token: string | null,
): Promise<{
  response: Response;
  data: unknown;
}> {
  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  const headers =
    new Headers(
      options.headers,
    );

  if (
    !headers.has(
      "Content-Type",
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          ...options,
          headers,
          signal:
            controller.signal,
        },
      );

    let data:
      | unknown
      | null = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    return {
      response,
      data,
    };
  } finally {
    window.clearTimeout(
      timeout,
    );
  }
}


/* ============================================================
   MAIN API REQUEST
   ============================================================ */

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  let token =
    getAccessToken();

  let result =
    await request(
      endpoint,
      options,
      token,
    );

  if (
    result.response.status === 401 &&
    token
  ) {
    const errorData =
      result.data as
        | ApiErrorResponse
        | null;

    const shouldRefresh =
      !errorData?.code ||
      errorData.code ===
        "TOKEN_EXPIRED" ||
      errorData.code ===
        "TOKEN_INVALID";

    if (shouldRefresh) {
      const newToken =
        await getNewAccessToken();

      if (newToken) {
        token =
          newToken;

        result =
          await request(
            endpoint,
            options,
            token,
          );
      }
    }
  }

  if (!result.response.ok) {
    const errorData =
      result.data as
        | ApiErrorResponse
        | null;

    if (
      result.response.status === 401
    ) {
      clearAuthentication();

      redirectToLogin();
    }

    throw new Error(
      errorData?.message ||
        `Request failed with status ${result.response.status}.`,
    );
  }

  return result.data as T;
}


/* ============================================================
   GET
   ============================================================ */

export function apiGet<T>(
  endpoint: string,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "GET",
    },
  );
}


/* ============================================================
   POST
   ============================================================ */

export function apiPost<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(
        body,
      ),
    },
  );
}


/* ============================================================
   PUT
   ============================================================ */

export function apiPut<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "PUT",
      body: JSON.stringify(
        body,
      ),
    },
  );
}


/* ============================================================
   DELETE
   ============================================================ */

export function apiDelete<T>(
  endpoint: string,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "DELETE",
    },
  );
}


/* ============================================================
   LOGOUT
   ============================================================ */

export async function logout(): Promise<void> {
  const refreshToken =
    getRefreshToken();

  try {
    if (refreshToken) {
      await fetch(
        `${API_BASE_URL}/auth/logout`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            refreshToken,
          }),
        },
      );
    }
  } catch {
    /*
     * Ignore backend logout errors.
     * Local authentication is still cleared.
     */
  } finally {
    clearAuthentication();
  }
}


/* ============================================================
   CLEAR AUTH
   ============================================================ */

export function clearAuth(): void {
  clearAuthentication();
}