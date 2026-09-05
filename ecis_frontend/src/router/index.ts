import {createRouter,createWebHistory} from 'vue-router'
const router=createRouter({
  history:createWebHistory(),
  routes:[
    {path:'/login',component:()=>import('../views/LoginView.vue')},
    {path:'/',component:()=>import('../components/AppLayout.vue'),children:[
      {path:'',redirect:'/dashboard'},
      {path:'dashboard',component:()=>import('../views/DashboardView.vue')},
      {path:'patients',component:()=>import('../views/PatientsView.vue')},
      {path:'patients/:id',component:()=>import('../views/PatientDetailView.vue')},
      {path:'opd',component:()=>import('../views/OPDView.vue')},
      {path:'clinics',component:()=>import('../views/ClinicsView.vue')},
      {path:'wards',component:()=>import('../views/WardsView.vue')},
      {path:'surgery',component:()=>import('../views/SurgeryView.vue')},
      {path:'emergency',component:()=>import('../views/EmergencyView.vue')},
      {path:'ecis',component:()=>import('../views/ECISView.vue')},
      {path:'medical',component:()=>import('../views/MedicalView.vue')},
      {path:'reports',component:()=>import('../views/ReportsView.vue')},
      {path:'settings',component:()=>import('../views/SettingsView.vue')}
    ]}
  ]
})
router.beforeEach((to)=>{if(to.path!=='/login'&&!localStorage.getItem('ecis-auth'))return '/login'})
export default router
