<template>
  <div
    class="min-h-screen"
  >
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col"
    >
      <div
        class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5"
      >
        <div
          class="grid size-10 place-items-center rounded-xl bg-teal-700 text-white"
        >
          ✚
        </div>

        <div>
          <p
            class="font-black text-slate-900"
          >
            ECIS
          </p>

          <p
            class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Hospital EHR
          </p>
        </div>
      </div>


      <div
        class="flex min-h-0 flex-1 flex-col"
      >
        <nav
          class="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 pb-4"
        >
          <RouterLink
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            active-class="nav-active"
          >
            <component
              :is="item.icon"
              :size="17"
              :stroke-width="2"
            />

            <span>
              {{
                item.label
              }}
            </span>
          </RouterLink>
        </nav>

        <div
          class="shrink-0 border-t border-slate-100 bg-white p-4"
        >
        </div>
      </div>
    </aside>


    <div
      class="lg:pl-64"
    >
      <header
        class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6"
      >
        <div>
          <p
            class="text-sm font-bold text-slate-800"
          >
            Central Hospital Information System
          </p>

          <p
            class="text-[11px] text-slate-400"
          >
            Clinical data workspace
          </p>
        </div>

        <div
          class="flex items-center gap-3"
        >
          <span
            class="hidden rounded-full px-3 py-1.5 text-xs font-bold sm:inline"
            :class="systemStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700'
              : systemStatus === 'offline'
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-100 text-slate-600'"
          >
            ● {{ systemStatus === 'online' ? 'System online' : systemStatus === 'offline' ? 'System unavailable' : 'Checking system' }}
          </span>

          <div class="avatar">
            ST
          </div>
        </div>
      </header>

      <main
        class="p-4 sm:p-6"
      >
        <RouterView />
      </main>
    </div>


    <div
      class="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-2 lg:hidden"
    >
      <nav
        v-if="mobileMenuOpen"
        class="absolute bottom-full left-0 right-0 max-h-[60vh] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-white p-3 shadow-lg"
        aria-label="All modules"
      >
        <div class="grid grid-cols-2 gap-1">
          <RouterLink
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-2 rounded-lg p-3 text-sm font-semibold text-slate-700"
            active-class="bg-teal-50 text-teal-700"
            @click="mobileMenuOpen = false"
          >
            <component :is="item.icon" :size="17" />
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>

      <div
        class="grid grid-cols-5 gap-1"
      >
        <RouterLink
          v-for="item in mobileNav"
          :key="item.path"
          :to="item.path"
          class="rounded-lg p-2 text-center text-[10px] font-bold text-slate-500"
          active-class="text-teal-700"
        >
          <component
            :is="item.icon"
            :size="16"
            class="mx-auto mb-0.5"
          />

          {{
            item.label
          }}
        </RouterLink>

        <button
          type="button"
          class="rounded-lg p-2 text-center text-[10px] font-bold text-slate-500"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <Menu :size="16" class="mx-auto mb-0.5" />
          More
        </button>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { API_BASE_URL } from "../services/api";
import {
  BedDouble,
  ClipboardList,
  ClipboardPlus,
  FileBarChart2,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Pill,
  ScanLine,
  Scissors,
  Search,
  Settings,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-vue-next";


const nav = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },

  {
    path: "/patients",
    label: "Patients",
    icon: Users,
  },

  {
    path: "/opd",
    label: "OPD",
    icon: Stethoscope,
  },

  {
    path: "/clinics",
    label: "Clinics",
    icon: Stethoscope,
  },

  {
    path: "/dental",
    label: "Dental Clinic",
    icon: ClipboardPlus,
  },

  {
    path: "/wards",
    label: "Wards & Beds",
    icon: BedDouble,
  },

  {
    path: "/bht",
    label: "BHT / Inpatient Care",
    icon: ClipboardPlus,
  },

  {
    path: "/lab",
    label: "Laboratory",
    icon: FlaskConical,
  },

  {
    path: "/radiology",
    label: "Radiology / Imaging",
    icon: ScanLine,
  },

  {
    path: "/pharmacy",
    label: "Pharmacy",
    icon: Pill,
  },

  {
    path: "/surgery",
    label: "Surgery & Procedures",
    icon: Scissors,
  },

  {
    path: "/emergency",
    label: "Emergency",
    icon: ShieldAlert,
  },

  {
    path: "/ecis",
    label: "ECIS Search",
    icon: Search,
  },

  {
    path: "/medical",
    label: "Medical Summary",
    icon: HeartPulse,
  },

  {
    path: "/reports",
    label: "Reports",
    icon: FileBarChart2,
  },

  {
    path: "/settings",
    label: "Settings",
    icon: Settings,
  },
];


const mobileMenuOpen = ref(false);

const systemStatus = ref<"checking" | "online" | "offline">("checking");
let healthTimer: ReturnType<typeof setInterval> | undefined;

async function checkSystemHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = response.ok ? await response.json() : null;
    systemStatus.value = response.ok && body?.success === true ? "online" : "offline";
  } catch {
    systemStatus.value = "offline";
  }
}

onMounted(() => {
  void checkSystemHealth();
  healthTimer = setInterval(() => void checkSystemHealth(), 30000);
});

onUnmounted(() => {
  if (healthTimer) clearInterval(healthTimer);
});

const mobileNav = nav.filter((item) =>
  ["/dashboard", "/patients", "/opd", "/pharmacy"].includes(item.path),
);
</script>


<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 0.7rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #64748b;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.nav-item:hover {
  background: #f0fdfa;
  color: #0f766e;
}

.nav-active {
  background: #ccfbf1;
  color: #115e59;
}
</style>
