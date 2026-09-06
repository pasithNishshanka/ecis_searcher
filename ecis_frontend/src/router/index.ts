import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/",
      component: () => import("../components/AppLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        { path: "", redirect: "/dashboard" },
        {
          path: "dashboard",
          component: () => import("../views/DashboardView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "patients",
          component: () => import("../views/PatientsView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "patients/:id",
          component: () => import("../views/PatientDetailView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "opd",
          component: () => import("../views/OPDView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "clinics",
          component: () => import("../views/ClinicsView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "wards",
          component: () => import("../views/WardsView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "surgery",
          component: () => import("../views/SurgeryView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "emergency",
          component: () => import("../views/EmergencyView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "ecis",
          component: () => import("../views/ECISView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "medical",
          component: () => import("../views/MedicalView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "reports",
          component: () => import("../views/ReportsView.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "settings",
          component: () => import("../views/SettingsView.vue"),
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem("ecis-token");
  const requiresAuth = to.matched.some(
    (record) => record.meta.requiresAuth === true,
  );

  if (requiresAuth && !token) {
    return {
      path: "/login",
      query: { redirect: to.fullPath },
    };
  }

  if (to.path === "/login" && token) {
    return "/dashboard";
  }

  return true;
});

export default router;
