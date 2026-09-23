import { createRouter, createWebHistory } from "vue-router";

import { restoreSession } from "../services/api";

const router = createRouter({
  history: createWebHistory(),

  routes: [
    /* ========================================================
       LOGIN
       ======================================================== */

    {
      path: "/login",

      component: () => import("../views/LoginView.vue"),
    },

    /* ========================================================
       MAIN APPLICATION
       ======================================================== */

    {
      path: "/",

      component: () => import("../components/AppLayout.vue"),

      meta: {
        requiresAuth: true,
      },

      children: [
        /* ====================================================
           DEFAULT ROUTE
           ==================================================== */

        {
          path: "",

          redirect: "/dashboard",
        },

        /* ====================================================
           DASHBOARD
           ==================================================== */

        {
          path: "dashboard",

          component: () => import("../views/DashboardView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           PATIENTS
           ==================================================== */

        {
          path: "patients",

          component: () => import("../views/PatientsView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        {
          path: "patients/:id",

          component: () => import("../views/PatientDetailView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           OPD
           ==================================================== */

        {
          path: "opd",

          component: () => import("../views/OPDView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           CLINICS
           ==================================================== */

        {
          path: "clinics",

          component: () => import("../views/ClinicsView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           WARDS
           ==================================================== */

        {
          path: "wards",

          component: () => import("../views/WardsView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           BHT
           ==================================================== */

        {
          path: "bht",

          component: () => import("../views/BHTView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           LABORATORY
           ==================================================== */

        {
          path: "lab",

          component: () => import("../views/LabView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           RADIOLOGY / IMAGING
           ==================================================== */

        {
          path: "radiology",

          component: () => import("../views/RadiologyView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        {
          path: "pharmacy",

          component: () => import("../views/PharmacyView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           SURGERY
           ==================================================== */

        {
          path: "surgery",

          component: () => import("../views/SurgeryView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           EMERGENCY
           ==================================================== */

        {
          path: "emergency",

          component: () => import("../views/EmergencyView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           ECIS
           ==================================================== */

        {
          path: "ecis",

          component: () => import("../views/ECISView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           MEDICAL RECORDS
           ==================================================== */

        {
          path: "medical",

          component: () => import("../views/MedicalView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           REPORTS
           ==================================================== */

        {
          path: "reports",

          component: () => import("../views/ReportsView.vue"),

          meta: {
            requiresAuth: true,
          },
        },

        /* ====================================================
           SETTINGS
           ==================================================== */

        {
          path: "settings",

          component: () => import("../views/SettingsView.vue"),

          meta: {
            requiresAuth: true,
          },
        },
      ],
    },
  ],
});

/* ============================================================
   AUTHENTICATION GUARD
   ============================================================ */

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some(
    (record) => record.meta.requiresAuth === true,
  );

  /*
   * Protected route:
   * restore the existing session or refresh
   * the access token when possible.
   */
  if (requiresAuth) {
    const authenticated = await restoreSession();

    if (!authenticated) {
      return {
        path: "/login",

        query: {
          redirect: to.fullPath,
        },
      };
    }
  }

  /*
   * Prevent an already authenticated user
   * from returning to the login screen.
   */
  if (to.path === "/login" && localStorage.getItem("ecis-token")) {
    return "/dashboard";
  }

  return true;
});

/* ============================================================
   DEFAULT EXPORT
   ============================================================ */

export default router;
