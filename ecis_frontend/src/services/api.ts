const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 30000;

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

/*
 * Only ONE refresh request can run at a time.
 *
 * If several API requests need a refresh at the same time,
 * they all wait for this same promise.
 */
let refreshPromise:
  | Promise<string | null>
  | null = null;

let redirectingToLogin = false;


/* ============================================================
   AUTH STORAGE
   ============================================================ */

function getAccessToken():
  string | null {
  const token =
    localStorage.getItem(
      "ecis-token",
    );

  if (
    !token ||
    !token.trim()
  ) {
    return null;
  }

  return token.trim();
}

function getRefreshToken():
  string | null {
  const token =
    localStorage.getItem(
      "ecis-refresh-token",
    );

  if (
    !token ||
    !token.trim()
  ) {
    return null;
  }

  return token.trim();
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
    window.location.pathname ===
      "/login"
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

async function refreshAccessToken():
  Promise<string | null> {
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

    if (
      !newToken ||
      !newToken.trim()
    ) {
      clearAuthentication();

      return null;
    }

    saveAccessToken(
      newToken.trim(),
      data?.data?.user,
    );

    return newToken.trim();
  } catch {
    /*
     * Network failure while refreshing should not
     * immediately destroy the existing refresh token.
     *
     * This allows a later request to retry refresh.
     */
    return null;
  }
}


/* ============================================================
   SINGLE REFRESH QUEUE
   ============================================================ */

async function getNewAccessToken():
  Promise<string | null> {
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
   RAW REQUEST
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
      () =>
        controller.abort(),
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
  /*
   * Get the existing short-lived access token.
   */
  let token =
    getAccessToken();

  /*
   * IMPORTANT FIX:
   *
   * If the access token is missing but a refresh token
   * still exists, refresh BEFORE sending the protected
   * request.
   *
   * This prevents:
   *
   *     AUTH_REQUIRED
   *
   * when the browser still has a valid refresh session.
   */
  if (
    !token &&
    getRefreshToken()
  ) {
    token =
      await getNewAccessToken();
  }

  /*
   * First request.
   */
  let result =
    await request(
      endpoint,
      options,
      token,
    );

  /*
   * Access token expired or invalid.
   *
   * Try refresh BEFORE logging the user out.
   */
  if (
    result.response.status ===
      401
  ) {
    const errorData =
      result.data as
        | ApiErrorResponse
        | null;

    const shouldRefresh =
      errorData?.code ===
        "TOKEN_EXPIRED" ||
      errorData?.code ===
        "TOKEN_INVALID" ||
      errorData?.code ===
        "AUTH_REQUIRED";

    /*
     * Try refresh when:
     *
     * 1. token existed but became invalid/expired
     * 2. token was missing but refresh session exists
     */
    if (
      shouldRefresh &&
      getRefreshToken()
    ) {
      const newToken =
        await getNewAccessToken();

      if (newToken) {
        token =
          newToken;

        /*
         * Retry exactly the same request
         * with the fresh access token.
         */
        result =
          await request(
            endpoint,
            options,
            token,
          );
      }
    }
  }

  /*
   * Final failure handling.
   */
  if (
    !result.response.ok
  ) {
    const errorData =
      result.data as
        | ApiErrorResponse
        | null;

    if (
      result.response.status ===
      401
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
   HTTP HELPERS
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

export function apiPost<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "POST",

      body:
        JSON.stringify(
          body,
        ),
    },
  );
}

export function apiPut<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: "PUT",

      body:
        JSON.stringify(
          body,
        ),
    },
  );
}

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

          body:
            JSON.stringify({
              refreshToken,
            }),
        },
      );
    }
  } finally {
    clearAuthentication();
  }
}