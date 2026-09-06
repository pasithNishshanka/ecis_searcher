<template>
  <div class="grid min-h-screen place-items-center bg-slate-100 p-5">
    <div class="card w-full max-w-md p-7">
      <div
        class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-700 text-xl text-white"
      >
        ✚
      </div>

      <h1 class="mt-5 text-center text-2xl font-black">ECIS Hospital System</h1>

      <p class="mt-1 text-center text-sm text-slate-500">
        Authorized clinical staff portal
      </p>

      <form @submit.prevent="login" class="mt-7 space-y-4">
        <div>
          <label class="label">Staff ID</label>
          <input
            v-model="staff"
            class="field"
            required
            autocomplete="username"
          />
        </div>

        <div>
          <label class="label">Password</label>
          <input
            v-model="password"
            type="password"
            class="field"
            required
            autocomplete="current-password"
          />
        </div>

        <p
          v-if="error"
          class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {{ error }}
        </p>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign in" }}
        </button>
      </form>

      <p class="mt-5 text-center text-xs text-slate-400">
        Authorized hospital staff only
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const staff = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const API_BASE_URL = "http://localhost:5000/api";

async function login() {
  error.value = "";
  loading.value = true;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: staff.value.trim(),
        password: password.value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Invalid staff ID or password.");
    }

    localStorage.setItem("ecis-token", data.token);
    localStorage.setItem("ecis-user", JSON.stringify(data.user));

    router.push("/dashboard");
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to sign in. Please try again.";
  } finally {
    loading.value = false;
  }
}
</script>
