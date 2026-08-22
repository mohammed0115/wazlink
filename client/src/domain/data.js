// S2-FIX data reminder: one Arabic RTL prototype source of truth links discovery source → job → business → lead → deal → revenue event → attribution touchpoint.
export const state = {
  theme: "light", signedIn: false, onboardingDone: false, sidebarCollapsed: false,
  selectedBusinessId: "BUS-1042", selectedConversationId: "CONV-3042", selectedLeadId: "LEAD-1042",
  discoveryStatus: "idle", discoveryProgress: 0, selectedJobId: "JOB-1028", selectedResultIds: [], discoveryModal: null, intelligenceModal: null, intelligenceProcessing: null, discoveryListFilters: { search:"", status:"all", sourceId:"all", date:"all", sort:"newest" }, resultFilters: { search:"", category:"all", city:"all", rating:"all", reviews:"all", website:"all", phone:"all", opportunityTier:"all", minScore:"all", confidence:"all", gap:"all", intelligenceStatus:"all", highOpportunity:false, sort:"newest" }, discoveryDraft: { keywords:["عيادات أسنان"], locations:["الرياض"], sourceId:"SRC-1004", filters:{ minRating:"4", minReviews:"50", website:"any", phone:true, email:false, whatsapp:false, instagram:false, activity:"any", limit:"2000" }, showCombinations:false }, crmAdded: ["LEAD-1042"], notifications: 3,
  loginErrors: {}, onboardingStep: 1, onboardingErrors: {}, dashboardTimeframe: "اليوم", dashboardView: "ready", completedTaskIds: [],
  workspace: { companyName: "", industry: "", city: "", teamSize: "", goals: [], sources: [], pipeline: "", monthlyLeads: "", averageDealValue: "", aiPreferences: [] },
  crmModal: null, crmView: "ready", selectedLeadIds: [],
  crmFilters: { search:"", ownerId:"all", status:"all", priority:"all", sourceJobId:"all", city:"all", tier:"all", tag:"all", minScore:"all", sort:"updated" },
  selectedDealId: "DEAL-4042", pipelineView: "ready", dealModal: null, selectedDealIds: [],
  dealFilters: { search:"", pipelineId:"PIPE-1001", stageId:"all", ownerId:"all", status:"open", minValue:"all", probability:"all", expectedClose:"all", sourceJobId:"all", opportunityTier:"all", sort:"updated" },
  inboxFilters: { search:"", filter:"all", ownerId:"all", channel:"whatsapp", sort:"latest" }, inboxDrafts: {}, inboxAttachment: null, inboxContextOpen: false,
  inboxAssistance: null, inboxContextView: "context", copilotTab: "summary", copilotProcessing: null, copilotMobileOpen: false,
  agentMode: "off", agentWorkspaceFilter: "all", selectedAgentActionId: null,
  automationFilters: { search:"", status:"all", trigger:"all", sort:"updated" }, automationModal: null, selectedAutomationId: "AUTO-1001", selectedAutomationRunId: null,
  taskFilters: { search:"", status:"all", ownerId:"all", due:"all", origin:"all", leadId:"all", sort:"due" },
  appointmentFilters: { status:"all", ownerId:"all", type:"all", date:"all", sort:"soonest" }, appointmentModal: null,
  analyticsContext: { dateRange:"all", customStart:"", customEnd:"", sourceId:"all", jobId:"all", ownerId:"all", city:"all", opportunityTier:"all", leadStatus:"all", dealStageId:"all", channel:"all", automationRuleId:"all" },
  analyticsUi: { tab:"overview", drilldown:null },
  s11Ui: { settingsSection:"workspace", integrationDetailId:null, billingPreviewPlanId:null, checkout:null, paidCheckoutKeys:[] },
  scraperCrmUi: { modal:null, jobId:null, exportCount:0, exportColumns:["businessId","name","category","city","phone","email","website","instagram","rating","reviews"], convertedLeadIds:[] }
};

// SCRAPER-OR-CRM reminder: product packages are visual local fixtures. Scraper is export-only; CRM is a distinct sales-management package.
export const scraperCrmPackages = {
  scraper: { id:"PKG-SCRAPER", label:"باقة Scraper", price:"من 99 ر.س / شهريًا", purpose:"استخراج وتنظيم وتصدير النتائج", features:["بحث متعدد الكلمات والمواقع","نتائج منظمة قابلة للتحديد","تنزيل Excel تجريبي محلي"] },
  crm: { id:"PKG-CRM", label:"باقة CRM نمو", price:"من 299 ر.س / شهريًا", purpose:"إدارة النتائج داخل نمو ومتابعة المبيعات", features:["تحويل الشركات إلى Leads","مسار مبيعات ومهام","Inbox وذكاء وتحليلات محلية"] }
};

// PAYMENT-CHECKOUT-SCENARIO reminder: offers are local display fixtures only.
export const checkoutOffers = {
  scraper: { id:"OFFER-SCRAPER", planId:"PLAN-STARTER", label:"باقة Scraper", description:"استخراج وتنظيم وتصدير النتائج فقط", features:["استعلامات متعددة","اختيار أعمدة Excel","تنزيل CSV محلي"] },
  crm: { id:"OFFER-CRM", planId:"PLAN-GROWTH", label:"باقة CRM نمو", description:"إدارة العملاء المحتملين والمبيعات داخل نمو", features:["تحويل الشركات إلى Leads","مسار مبيعات ومهام","Inbox وAnalytics محلية"] }
};

// SCRAPER-DATA-VISIBILITY reminder: these are local export labels only; they do not imply live enrichment or external data access.
export const scraperExportColumns = [
  { id:"businessId", label:"معرّف الشركة" }, { id:"name", label:"اسم الشركة" }, { id:"category", label:"النشاط" }, { id:"city", label:"المدينة" },
  { id:"phone", label:"الهاتف" }, { id:"email", label:"البريد" }, { id:"website", label:"الموقع الإلكتروني" }, { id:"instagram", label:"إنستغرام" },
  { id:"rating", label:"التقييم" }, { id:"reviews", label:"المراجعات" }, { id:"source", label:"مصدر الاكتشاف" }
];

export const businesses = [
  { id:"BUS-1042", discoveryJobId:"JOB-1028", name:"عيادات الحياة لطب الأسنان", short:"عيادات الحياة", category:"عيادات أسنان", city:"الرياض", country:"السعودية", phone:"+966 11 456 8201", email:"hello@hayatdental.sa", website:"hayatdental.sa", instagram:"@hayatdental", rating:4.7, reviews:863, source:"خرائط الأعمال", owner:"سارة العمري", stage:"New", value:85000, websiteQuality:"ضعيف", whatsapp:true, lastActivity:"منذ ساعتين" },
  { id:"BUS-1137", discoveryJobId:"JOB-1028", name:"مركز ابتسامة الطبي", short:"ابتسامة", category:"عيادات أسنان", city:"الرياض", country:"السعودية", phone:"+966 11 284 4502", email:"info@ibtisama.med", website:"ibtisama.med", instagram:"@ibtisama.med", rating:4.5, reviews:510, source:"خرائط الأعمال", owner:"فهد الحربي", stage:"Contacted", value:56000, websiteQuality:"متوسط", whatsapp:true, lastActivity:"منذ يوم" },
  { id:"BUS-1198", discoveryJobId:"JOB-1028", name:"مجمع رؤية الطبي", short:"رؤية", category:"عيادات أسنان", city:"الرياض", country:"السعودية", phone:"+966 11 279 6005", email:"", website:"roya-clinic.com", instagram:"@royaclinics", rating:4.6, reviews:724, source:"خرائط الأعمال", owner:"سارة العمري", stage:"New", value:42000, websiteQuality:"ضعيف", whatsapp:false, lastActivity:"منذ 3 أيام" },
  { id:"BUS-1220", discoveryJobId:"JOB-1029", name:"شركة المدار للمقاولات", short:"المدار", category:"مقاولات", city:"الرياض", country:"السعودية", phone:"+966 11 210 9370", email:"business@almadar.sa", website:"almadar.sa", instagram:"", rating:4.4, reviews:192, source:"مواقع الشركات", owner:"خالد السالم", stage:"Proposal", value:120000, websiteQuality:"متوسط", whatsapp:true, lastActivity:"منذ 4 أيام" },
  { id:"BUS-1301", discoveryJobId:"JOB-1031", name:"عيادات النخبة للأسنان", short:"النخبة", category:"عيادات أسنان", city:"الرياض", country:"السعودية", phone:"+966 50 920 1440", email:"contact@elite-dental.sa", website:"", instagram:"@elitedental", rating:4.3, reviews:388, source:"استيراد ملف", owner:"فهد الحربي", stage:"New", value:38000, websiteQuality:"غير متوفر", whatsapp:true, lastActivity:"منذ أسبوع" },
  { id:"BUS-1375", discoveryJobId:"JOB-1030", name:"مؤسسة ابتكار للتسويق", short:"ابتكار", category:"تسويق رقمي", city:"جدة", country:"السعودية", phone:"+966 12 654 1893", email:"team@ebtikar.agency", website:"ebtikar.agency", instagram:"@ebtikar.agency", rating:4.8, reviews:98, source:"خرائط الأعمال", owner:"خالد السالم", stage:"Meeting", value:67000, websiteQuality:"جيد", whatsapp:true, lastActivity:"منذ يومين" },
  { id:"BUS-1381", discoveryJobId:"JOB-1027", name:"مركز تقويم الصفوة", short:"الصفوة", category:"مراكز تقويم", city:"جدة", country:"السعودية", address:"حي الروضة، جدة", phone:"+966 12 614 2208", email:"", website:"safwa-ortho.sa", instagram:"", rating:4.6, reviews:208, source:"دليل أعمال", status:"مكتشف", stage:"New", value:0, lastActivity:"—" },
  { id:"BUS-1382", discoveryJobId:"JOB-1027", name:"عيادات ابتسامة البحر", short:"ابتسامة البحر", category:"مراكز تقويم", city:"جدة", country:"السعودية", address:"حي الشاطئ، جدة", phone:"+966 12 682 9034", email:"", website:"", instagram:"@bahrsmile", rating:4.3, reviews:117, source:"دليل أعمال", status:"مكتشف", stage:"New", value:0, lastActivity:"—" },
  { id:"BUS-1402", discoveryJobId:"JOB-1028", name:"أكاديمية أفق الابتكار", short:"أفق الابتكار", category:"تدريب مهني", city:"الرياض", country:"السعودية", address:"حي المروج، الرياض", phone:"+966 11 590 6300", email:"hello@afaqacademy.sa", website:"afaqacademy.sa", instagram:"@afaqacademy", rating:4.9, reviews:640, source:"خرائط الأعمال", lastActivity:"—" },
  { id:"BUS-1403", discoveryJobId:"JOB-1028", name:"مركز بداية للعناية", short:"بداية", category:"مركز عناية", city:"الرياض", country:"السعودية", address:"حي العليا، الرياض", phone:"+966 11 322 4410", email:"", website:"bidaya-care.sa", instagram:"", rating:4.1, reviews:34, source:"خرائط الأعمال", lastActivity:"—" },
  { id:"BUS-1404", discoveryJobId:"JOB-1028", name:"مجمع مسار الصحة", short:"مسار الصحة", category:"مركز صحي", city:"الرياض", country:"السعودية", address:"الرياض", phone:"", email:"", website:"", instagram:"", rating:null, reviews:null, source:"خرائط الأعمال", lastActivity:"—" },
  { id:"BUS-1405", discoveryJobId:"JOB-1028", name:"عيادات صفاء العلاجية", short:"صفاء", category:"عيادات علاج طبيعي", city:"الرياض", country:"السعودية", address:"حي الصحافة، الرياض", phone:"+966 11 721 0640", email:"care@safa-clinic.sa", website:"safa-clinic.sa", instagram:"@safaclinic", rating:4.5, reviews:265, source:"خرائط الأعمال", lastActivity:"—" }
];

// S7 contract reminder: Conversation is a channel thread; Message is an independent event. WhatsApp here is strictly a local mock fixture, not a live integration.
export const conversations = [
  { id:"CONV-3042", leadId:"LEAD-1042", contactId:"CON-1042", channel:"whatsapp", assignedTo:"USR-1001", status:"open", lastMessageAt:"2026-08-15T12:20:00", unreadCount:1, createdAt:"2026-08-14T09:42:00", updatedAt:"2026-08-15T12:20:00" },
  { id:"CONV-3043", leadId:"LEAD-1137", contactId:"CON-1137", channel:"whatsapp", assignedTo:"USR-1002", status:"open", lastMessageAt:"2026-08-15T11:10:00", unreadCount:0, createdAt:"2026-08-14T14:30:00", updatedAt:"2026-08-15T11:10:00" },
  { id:"CONV-3044", leadId:"LEAD-1220", contactId:null, channel:"whatsapp", assignedTo:"USR-1003", status:"closed", lastMessageAt:"2026-08-14T15:20:00", unreadCount:0, createdAt:"2026-08-12T10:05:00", updatedAt:"2026-08-14T15:45:00" },
  { id:"CONV-3045", leadId:"LEAD-1042", contactId:"CON-1042", channel:"whatsapp", assignedTo:"USR-1001", status:"open", lastMessageAt:"2026-08-15T10:15:00", unreadCount:0, createdAt:"2026-08-13T13:00:00", updatedAt:"2026-08-15T10:15:00" }
];

const messageFixtures = [
  { id:"MSG-3042-1", conversationId:"CONV-3042", direction:"inbound", senderType:"contact", senderId:"CON-1042", type:"text", body:"أهلًا، مهتمون بتحسين حجز المواعيد لدينا.", status:"read", createdAt:"2026-08-15T09:42:00" },
  { id:"MSG-3042-2", conversationId:"CONV-3042", direction:"outbound", senderType:"user", senderId:"USR-1001", type:"text", body:"يسعدنا ذلك. لاحظنا فرصة واضحة في الموقع ومسار الحجز.", status:"delivered", createdAt:"2026-08-15T10:10:00" },
  { id:"MSG-3042-3", conversationId:"CONV-3042", direction:"inbound", senderType:"contact", senderId:"CON-1042", type:"text", body:"أرسلوا لنا تفاصيل الحل المقترح والتكلفة المبدئية.", status:"received", createdAt:"2026-08-15T12:20:00" },
  { id:"MSG-3043-1", conversationId:"CONV-3043", direction:"inbound", senderType:"contact", senderId:"CON-1137", type:"image", body:"مرفق توضيحي لمسار الحجز الحالي.", attachment:{ name:"مسار_الحجز.png", size:"184 ك.ب", mime:"image/png" }, status:"read", createdAt:"2026-08-15T09:45:00" },
  { id:"MSG-3043-2", conversationId:"CONV-3043", direction:"outbound", senderType:"user", senderId:"USR-1002", type:"text", body:"شكرًا للتوضيح، سنراجع المسار ونعود إليكم بخطوة عملية.", status:"delivered", createdAt:"2026-08-15T11:10:00" },
  { id:"MSG-3044-1", conversationId:"CONV-3044", direction:"inbound", senderType:"unknown_contact", senderId:null, type:"text", body:"نحتاج عرضًا للمشروع قبل نهاية الأسبوع.", status:"read", createdAt:"2026-08-14T15:20:00" },
  { id:"MSG-3045-1", conversationId:"CONV-3045", direction:"inbound", senderType:"contact", senderId:"CON-1042", type:"text", body:"هل يمكن مشاركة نطاق العمل المبدئي؟", status:"read", createdAt:"2026-08-15T09:20:00" },
  { id:"MSG-3045-2", conversationId:"CONV-3045", direction:"outbound", senderType:"user", senderId:"USR-1001", type:"document", body:"عرض نطاق العمل التجريبي.", attachment:{ name:"عرض_نطاق_العمل.pdf", size:"312 ك.ب", mime:"application/pdf" }, status:"failed", failureReason:"فشل الإرسال التجريبي؛ أعد المحاولة محليًا.", createdAt:"2026-08-15T10:15:00" }
];

export const jobs = [
  { id:"JOB-1028", sourceId:"SRC-1001", name:"عيادات أسنان — الرياض", keyword:"عيادات أسنان", location:"الرياض", keywords:["عيادات أسنان"], locations:["الرياض"], source:"خرائط الأعمال", filters:{minRating:"4",minReviews:"50",website:"any",phone:true,email:false,whatsapp:false,instagram:false,activity:"any",limit:"2000"}, combinationCount:1, status:"completed", created:"اليوم، 09:24", createdAt:"2026-08-15T09:24:00", startedAt:"2026-08-15T09:24:01", completedAt:"2026-08-15T09:24:13", progress:100, foundCount:1420, duplicateCount:172, deduplicatedCount:1248, discoveredCount:1420, total:1240, current:1240, highScore:184, crmAdded:92, qualified:31, resultBusinessIds:["BUS-1042","BUS-1137","BUS-1198","BUS-1402","BUS-1403","BUS-1404","BUS-1405"] },
  { id:"JOB-1029", sourceId:"SRC-1002", name:"شركات مقاولات — الدمام", keyword:"شركات مقاولات", location:"الدمام", keywords:["شركات مقاولات"], locations:["الدمام"], source:"مواقع الشركات", filters:{minRating:"4",minReviews:"50",website:"any",phone:true,email:false,whatsapp:false,instagram:false,activity:"any",limit:"1000"}, combinationCount:1, status:"completed", created:"أمس، 14:10", createdAt:"2026-08-14T14:10:00", startedAt:"2026-08-14T14:10:01", completedAt:"2026-08-14T14:10:12", progress:100, foundCount:932, duplicateCount:72, deduplicatedCount:860, discoveredCount:932, total:860, current:860, highScore:122, crmAdded:74, qualified:18, resultBusinessIds:["BUS-1220"] },
  { id:"JOB-1030", sourceId:"SRC-1001", name:"مطاعم — جدة", keyword:"مطاعم", location:"جدة", keywords:["مطاعم"], locations:["جدة"], source:"خرائط الأعمال", filters:{minRating:"4",minReviews:"50",website:"any",phone:true,email:false,whatsapp:false,instagram:false,activity:"any",limit:"2000"}, combinationCount:1, status:"processing", created:"اليوم، 10:42", createdAt:"2026-08-15T10:42:00", startedAt:"2026-08-15T10:42:02", completedAt:null, progress:67, foundCount:1412, duplicateCount:0, deduplicatedCount:0, discoveredCount:1412, total:2040, current:1412, highScore:210, crmAdded:128, qualified:22, resultBusinessIds:["BUS-1375"] },
  { id:"JOB-1031", sourceId:"SRC-1003", name:"شركات تقنية — الرياض", keyword:"شركات تقنية", location:"الرياض", keywords:["شركات تقنية"], locations:["الرياض"], source:"استيراد ملف", filters:{minRating:"4",minReviews:"50",website:"any",phone:true,email:false,whatsapp:false,instagram:false,activity:"any",limit:"1000"}, combinationCount:1, status:"completed", created:"الأحد، 09:00", createdAt:"2026-08-11T09:00:00", startedAt:"2026-08-11T09:00:01", completedAt:"2026-08-11T09:00:11", progress:100, foundCount:588, duplicateCount:48, deduplicatedCount:540, discoveredCount:588, total:540, current:540, highScore:96, crmAdded:61, qualified:48, resultBusinessIds:["BUS-1301"] },
  { id:"JOB-1027", sourceId:"SRC-1006", name:"مراكز تقويم — جدة", keyword:"مراكز تقويم", location:"جدة", keywords:["مراكز تقويم"], locations:["جدة"], source:"دليل أعمال", filters:{minRating:"4",minReviews:"50",website:"any",phone:true,email:false,whatsapp:false,instagram:false,activity:"any",limit:"1000"}, combinationCount:1, status:"failed", created:"الأحد، 08:12", createdAt:"2026-08-11T08:12:00", startedAt:"2026-08-11T08:12:01", completedAt:null, progress:46, foundCount:0, duplicateCount:0, deduplicatedCount:0, discoveredCount:0, total:0, current:0, highScore:0, crmAdded:0, qualified:0, failureMessage:"تعذر إكمال عملية الاكتشاف التجريبية. لم يتم فقد أي بيانات محفوظة.", retryScenario:{foundCount:642,duplicateCount:64,deduplicatedCount:578}, resultBusinessIds:["BUS-1381","BUS-1382"] }
];

export const discoverySourceOptions = [
  { id:"SRC-1004", name:"مصادر الأعمال العامة", type:"public_business_sources", status:"active" },
  { id:"SRC-1005", name:"Google Maps", type:"planned_map_source", status:"mock" },
  { id:"SRC-1006", name:"دليل أعمال", type:"business_directory", status:"active" },
  { id:"SRC-1007", name:"مصدر مخصص", type:"custom_source", status:"mock" }
];
export const discoveryStatusLabels = { pending:"في الانتظار", processing:"قيد المعالجة", completed:"مكتمل", failed:"فشل", cancelled:"ملغي" };
export const DISCOVERY_REFERENCE_DATE = "2026-08-15";
const arabicWeekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const activities = [{type:"WhatsApp", title:"رسالة متابعة مقترحة", when:"اليوم، 11:30", businessId:"BUS-1042"},{type:"Call",title:"اتصال مع مركز ابتسامة",when:"اليوم، 14:00",businessId:"BUS-1137"},{type:"Meeting",title:"عرض تقني مع شركة المدار",when:"غدًا، 10:00",businessId:"BUS-1220"}];
export const navItems = [
  {id:"dashboard",label:"الرئيسية",icon:"home",group:""},
  {id:"discovery",label:"اكتشاف العملاء",icon:"search-map",group:"الاكتشاف"},{id:"discovery/jobs",label:"عمليات البحث",icon:"history",group:""},{id:"discovery/results",label:"النتائج",icon:"table",group:""},
  {id:"crm",label:"إدارة العملاء",icon:"users",group:"العملاء"},{id:"contacts",label:"جهات الاتصال",icon:"contact",group:""},{id:"companies",label:"الشركات",icon:"building",group:""},
  {id:"pipeline",label:"مسار المبيعات",icon:"kanban",group:"المبيعات"},{id:"deals",label:"الصفقات",icon:"handshake",group:""},{id:"tasks",label:"المهام",icon:"check-circle",group:""},{id:"appointments",label:"المواعيد",icon:"calendar",group:""},
  {id:"inbox",label:"صندوق الوارد",icon:"inbox",group:"التواصل"},{id:"whatsapp",label:"واتساب",icon:"whatsapp",group:""},{id:"calls",label:"المكالمات",icon:"phone",group:""},
  {id:"intelligence",label:"ذكاء العملاء",icon:"sparkles",group:"الذكاء الاصطناعي"},{id:"copilot",label:"مساعد المبيعات",icon:"message-spark",group:""},{id:"agent",label:"وكيل المبيعات الذكي",icon:"bot",group:""},
  {id:"automation",label:"الأتمتة",icon:"workflow",group:"الأتمتة"},{id:"analytics",label:"التحليلات",icon:"bar-chart",group:"التحليلات"},{id:"integrations",label:"التكاملات",icon:"plug",group:"التكاملات"},{id:"settings",label:"الإعدادات",icon:"settings",group:"الإعدادات"}
];

export const metrics = { totalLeads:12480, highOpportunity:1240, contacted:3842, qualified:920, openDeals:164, pipelineValue:1840000, wonMonth:382000, aiRevenue:146000 };

export const dashboardData = {
  dashboardMetrics: [
    { id:"totalLeads", label:"العملاء المحتملون", value:12480, trend:"+8.4% عن الفترة السابقة", tone:"info", note:"من مصادر الاكتشاف" },
    { id:"highOpportunity", label:"فرص عالية الجودة", value:1240, trend:"Score ≥ 80", tone:"success", note:"تحتاج مراجعة أولوية" },
    { id:"contacted", label:"تم التواصل", value:3842, trend:"30.8% من الإجمالي", tone:"info", note:"متابعة مستمرة" },
    { id:"qualified", label:"العملاء المؤهلون", value:920, trend:"+8.1% هذا الأسبوع", tone:"success", note:"جاهزون للمرحلة التالية" },
    { id:"openDeals", label:"الصفقات المفتوحة", value:164, trend:"ضمن 6 مراحل", tone:"info", note:"مراجعة قيمة المراحل" },
    { id:"pipelineValue", label:"قيمة Pipeline", value:1840000, format:"sar", trend:"16 صفقة تفاوض", tone:"info", note:"قيمة متوقعة" },
    { id:"revenue", label:"الإيراد المحقق", value:382000, format:"sar", trend:"+18.6% عن الفترة السابقة", tone:"success", note:"إيراد معترف به تجريبيًا" },
    { id:"aiRevenue", label:"إيراد متأثر بالذكاء الاصطناعي", value:146000, format:"sar", trend:"38% من الإيراد", tone:"info", note:"بيانات Mock" }
  ],
  attentionItems: [
    { id:"ATTN-1001", tone:"danger", title:"12 متابعة متأخرة", description:"هناك 12 عميلًا عالي الأولوية لم تتم متابعتهم في الموعد.", action:"عرض المتابعات", route:"tasks" },
    { id:"ATTN-1002", tone:"warning", title:"4 صفقات عالية الاحتمال", description:"قيمة إجمالية 185,000 ر.س وقريبة من الإغلاق.", action:"عرض الصفقات", route:"deals" },
    { id:"ATTN-1003", tone:"success", title:"18 فرصة جديدة بدرجة أعلى من 85", description:"تحتاج مراجعة وتوزيع قبل انتهاء اليوم.", action:"مراجعة الفرص", route:"leads" },
    { id:"ATTN-1004", tone:"info", title:"3 محادثات تحتاج تدخلًا بشريًا", description:"آخر رسالة وصلت وتنتظر الرد من الفريق.", action:"فتح صندوق الوارد", route:"inbox" }
  ],
  aiRecommendations: [
    { id:"AIR-1042", kind:"فرصة اليوم", businessId:"BUS-1042", title:"عيادات الحياة لطب الأسنان", score:92, reason:"نشاط تجاري قوي مع فجوة واضحة في الحضور الرقمي ومسار الحجز.", action:"بدء تواصل استشاري حول تطوير الموقع وأتمتة المتابعة.", primary:"فتح العميل", primaryRoute:"lead-profile", secondary:"إنشاء متابعة", secondaryAction:"create-followup" },
    { id:"AIR-2002", kind:"مخاطرة في Pipeline", businessId:"BUS-1220", title:"6 صفقات بلا نشاط", score:null, reason:"قيمة تقديرية 240,000 ر.س لم تسجل نشاطًا منذ 5 أيام.", action:"راجع الصفقات الراكدة قبل نهاية اليوم.", primary:"مراجعة الصفقات", primaryRoute:"deals" },
    { id:"AIR-2003", kind:"إشارة اكتشاف", businessId:"BUS-1137", title:"قطاع العيادات في الرياض", score:null, reason:"يحقق معدل تأهيل أعلى من قطاع المطاعم بـ18%.", action:"راجع تحليل المصدر وارفع أولوية هذا القطاع.", primary:"عرض التحليل", primaryRoute:"analytics" }
  ],
  funnelMetrics: [
    { key:"discovered", label:"تم الاكتشاف", value:12480, rate:null }, { key:"enriched", label:"تم الإثراء", value:10250, rate:82 }, { key:"crm", label:"أضيف إلى إدارة العملاء", value:6420, rate:63 }, { key:"contacted", label:"تم التواصل", value:3842, rate:60 }, { key:"qualified", label:"مؤهل", value:920, rate:24 }, { key:"deals", label:"صفقة", value:164, rate:18 }, { key:"won", label:"رابح", value:48, rate:29 }
  ],
  pipelineSummary: [
    { stage:"جديد", count:31, value:320000, share:17, route:"pipeline" }, { stage:"تم التواصل", count:37, value:430000, share:23, route:"pipeline" }, { stage:"مؤهل", count:42, value:510000, share:28, route:"pipeline" }, { stage:"اجتماع", count:18, value:240000, share:13, route:"pipeline" }, { stage:"عرض", count:20, value:255000, share:14, route:"pipeline" }, { stage:"تفاوض", count:16, value:85000, share:5, route:"pipeline" }
  ],
  nearClosingDeals: [
    { id:"DEAL-4042", businessId:"BUS-1042", stage:"عرض", value:85000, probability:82, lastActivity:"منذ ساعتين", nextAction:"مراجعة العرض" }, { id:"DEAL-4051", businessId:"BUS-1220", stage:"تفاوض", value:120000, probability:76, lastActivity:"أمس", nextAction:"تحديث العرض" }, { id:"DEAL-4052", businessId:"BUS-1137", stage:"اجتماع", value:56000, probability:68, lastActivity:"اليوم", nextAction:"تأكيد الاجتماع" }
  ],
  sourcePerformance: [
    { source:"خرائط الأعمال ومصادر الشركات", value:54, tone:"info" }, { source:"الموقع الإلكتروني", value:18, tone:"success" }, { source:"واتساب", value:12, tone:"info" }, { source:"استيراد ملف", value:9, tone:"warning" }, { source:"إحالة", value:7, tone:"info" }
  ]
};

export const mockModel = {
  discoverySources: [
    { id:"SRC-1001", name:"خرائط الأعمال", type:"business_directory", status:"active" },
    { id:"SRC-1002", name:"مواقع الشركات", type:"web_directory", status:"active" },
    { id:"SRC-1003", name:"استيراد ملف", type:"file_import", status:"active" },
    ...discoverySourceOptions
  ],
  signals: [
    { id:"SIG-1042-A", businessId:"BUS-1042", key:"strong_demand", dimension:"activity", points:23, polarity:"positive", value:"4.7 / 5 و863 مراجعة", evidence:"تقييم 4.7 من 5 و863 مراجعة في سجل Business fixture." },
    { id:"SIG-1042-B", businessId:"BUS-1042", key:"weak_website", dimension:"digitalOpportunity", points:18, polarity:"gap", gapCode:"weak_website", value:"موقع يحتاج تحديثًا", evidence:"حقل websiteQuality في بيانات العرض يصف تجربة الموقع بأنها ضعيفة." },
    { id:"SIG-1042-C", businessId:"BUS-1042", key:"manual_booking", dimension:"digitalOpportunity", points:10, polarity:"gap", gapCode:"manual_booking", value:"مسار الحجز غير مؤتمت", evidence:"لا تظهر أتمتة حجز أو متابعة في بيانات Business fixture." },
    { id:"SIG-1042-D", businessId:"BUS-1042", key:"reachable_contact", dimension:"reachability", points:18, polarity:"positive", value:"هاتف وبريد وواتساب", evidence:"توجد بيانات هاتف وبريد وقناة واتساب في السجل." },
    { id:"SIG-1042-E", businessId:"BUS-1042", key:"service_fit", dimension:"serviceFit", points:14, polarity:"positive", value:"فجوات مناسبة لخدمات التحويل", evidence:"تتقاطع فجوتا الموقع والحجز مع خدمات تطوير الموقع وأتمتة المحادثات." },
    { id:"SIG-1042-F", businessId:"BUS-1042", key:"complete_profile", dimension:"dataQuality", points:9, polarity:"positive", value:"ملف مكتمل بدرجة جيدة", evidence:"التقييم والمراجعات والموقع والاتصال متاحة." },
    { id:"SIG-1137-A", businessId:"BUS-1137", key:"steady_demand", dimension:"activity", points:22, polarity:"positive", value:"4.5 / 5 و510 مراجعة", evidence:"التقييم والمراجعات مثبتان في Business fixture." },
    { id:"SIG-1137-B", businessId:"BUS-1137", key:"weak_visibility", dimension:"digitalOpportunity", points:18, polarity:"gap", gapCode:"weak_visibility", value:"ظهور رقمي يحتاج تحسينًا", evidence:"سياق الاكتشاف يحدد تحسين الظهور كفجوة تشغيلية." },
    { id:"SIG-1137-C", businessId:"BUS-1137", key:"appointment_friction", dimension:"digitalOpportunity", points:10, polarity:"gap", gapCode:"appointment_friction", value:"حجز المواعيد يحتاج تبسيطًا", evidence:"الاحتياج المسجل هو تحسين حجز المواعيد." },
    { id:"SIG-1137-D", businessId:"BUS-1137", key:"reachable_contact", dimension:"reachability", points:17, polarity:"positive", value:"هاتف وبريد وواتساب", evidence:"توجد ثلاث وسائل تواصل في السجل." },
    { id:"SIG-1137-E", businessId:"BUS-1137", key:"service_fit", dimension:"serviceFit", points:8, polarity:"positive", value:"ملاءمة متوسطة للخدمات", evidence:"فجوات الظهور والحجز قابلة لمعالجة خدمية مباشرة." },
    { id:"SIG-1137-F", businessId:"BUS-1137", key:"complete_profile", dimension:"dataQuality", points:9, polarity:"positive", value:"بيانات كافية للتحليل", evidence:"بيانات النشاط والتواصل والمراجعات متاحة." },
    { id:"SIG-1198-A", businessId:"BUS-1198", key:"moderate_demand", dimension:"activity", points:15, polarity:"positive", value:"4.6 / 5 و724 مراجعة", evidence:"التقييم والمراجعات متاحة في السجل." },
    { id:"SIG-1198-B", businessId:"BUS-1198", key:"weak_website", dimension:"digitalOpportunity", points:7, polarity:"gap", gapCode:"weak_website", value:"موقع يحتاج تحسين تحويل", evidence:"سياق Business يذكر تحسين التحويل." },
    { id:"SIG-1198-C", businessId:"BUS-1198", key:"missing_whatsapp", dimension:"digitalOpportunity", points:11, polarity:"gap", gapCode:"missing_whatsapp", value:"لا توجد قناة واتساب", evidence:"حقل whatsapp في Business fixture يساوي false." },
    { id:"SIG-1198-D", businessId:"BUS-1198", key:"limited_reachability", dimension:"reachability", points:11, polarity:"neutral", value:"هاتف وموقع فقط", evidence:"لا يوجد بريد إلكتروني أو واتساب في السجل." },
    { id:"SIG-1198-E", businessId:"BUS-1198", key:"partial_service_fit", dimension:"serviceFit", points:5, polarity:"positive", value:"ملاءمة أولية", evidence:"فجوة التحويل يمكن ربطها بخدمة الموقع فقط." },
    { id:"SIG-1198-F", businessId:"BUS-1198", key:"partial_profile", dimension:"dataQuality", points:3, polarity:"neutral", value:"بيانات جزئية", evidence:"بعض بيانات التواصل غير متاحة لكن لا تعد إشارة سلبية." },
    { id:"SIG-1402-A", businessId:"BUS-1402", key:"strong_demand", dimension:"activity", points:23, polarity:"positive", value:"4.9 / 5 و640 مراجعة", evidence:"نشاط رقمي قوي مثبت في Business fixture." },
    { id:"SIG-1402-B", businessId:"BUS-1402", key:"strong_digital_presence", dimension:"digitalOpportunity", points:0, polarity:"neutral", value:"موقع وحضور اجتماعي قويان", evidence:"الموقع والبريد والهاتف وInstagram متاحة ولا تظهر فجوة رقمية محددة." },
    { id:"SIG-1402-C", businessId:"BUS-1402", key:"reachable_contact", dimension:"reachability", points:18, polarity:"positive", value:"بيانات اتصال مكتملة", evidence:"الهاتف والبريد والموقع متاحة." },
    { id:"SIG-1402-D", businessId:"BUS-1402", key:"no_clear_service_gap", dimension:"serviceFit", points:0, polarity:"neutral", value:"لا توجد فجوة خدمية واضحة", evidence:"لا توجد إشارة Gap تربط السجل بخدمة محددة." },
    { id:"SIG-1402-E", businessId:"BUS-1402", key:"complete_profile", dimension:"dataQuality", points:10, polarity:"positive", value:"ملف مكتمل", evidence:"جميع حقول النشاط والاتصال الأساسية معروفة." },
    { id:"SIG-1403-A", businessId:"BUS-1403", key:"limited_demand", dimension:"activity", points:7, polarity:"neutral", value:"4.1 / 5 و34 مراجعة", evidence:"النشاط موجود لكنه محدود مقارنة بسجلات العرض الأخرى." },
    { id:"SIG-1403-B", businessId:"BUS-1403", key:"weak_website", dimension:"digitalOpportunity", points:8, polarity:"gap", gapCode:"weak_website", value:"موقع بسيط يحتاج تحسينًا", evidence:"الموقع موجود لكن لا توجد إشارات تحويل أو حجز ضمن السجل." },
    { id:"SIG-1403-C", businessId:"BUS-1403", key:"limited_reachability", dimension:"reachability", points:5, polarity:"neutral", value:"رقم هاتف فقط", evidence:"البريد والحضور الاجتماعي غير متاحين؛ وهي بيانات محدودة لا إشارة سلبية." },
    { id:"SIG-1403-D", businessId:"BUS-1403", key:"partial_service_fit", dimension:"serviceFit", points:4, polarity:"positive", value:"ملاءمة أولية لخدمة الموقع", evidence:"الفجوة المحددة ترتبط بخدمة واحدة فقط." },
    { id:"SIG-1403-E", businessId:"BUS-1403", key:"partial_profile", dimension:"dataQuality", points:4, polarity:"neutral", value:"ملف جزئي", evidence:"توجد بيانات كافية محدودة للتقييم التجريبي." },
    { id:"SIG-1404-A", businessId:"BUS-1404", key:"unknown_rating", dimension:"activity", points:0, polarity:"unknown", value:"غير معروف", evidence:"التقييم وعدد المراجعات غير متاحين في Business fixture." },
    { id:"SIG-1404-B", businessId:"BUS-1404", key:"unknown_digital_presence", dimension:"digitalOpportunity", points:0, polarity:"unknown", value:"غير معروف", evidence:"الموقع والحضور الاجتماعي غير متاحين في Business fixture." },
    { id:"SIG-1404-C", businessId:"BUS-1404", key:"limited_contact_data", dimension:"reachability", points:0, polarity:"unknown", value:"غير معروف", evidence:"لا يوجد هاتف أو بريد إلكتروني قابل للاستخدام في السجل." },
    { id:"SIG-1405-A", businessId:"BUS-1405", key:"steady_demand", dimension:"activity", points:17, polarity:"positive", value:"4.5 / 5 و265 مراجعة", evidence:"التقييم والمراجعات متاحة في Business fixture." },
    { id:"SIG-1405-B", businessId:"BUS-1405", key:"manual_booking", dimension:"digitalOpportunity", points:20, polarity:"gap", gapCode:"manual_booking", value:"حجز ومتابعة يدويان", evidence:"لا تظهر أتمتة الحجز في بيانات العرض." },
    { id:"SIG-1405-C", businessId:"BUS-1405", key:"reachable_contact", dimension:"reachability", points:14, polarity:"positive", value:"هاتف وبريد متاحان", evidence:"وسيلتا اتصال متاحتان في السجل." },
    { id:"SIG-1405-D", businessId:"BUS-1405", key:"service_fit", dimension:"serviceFit", points:12, polarity:"positive", value:"ملاءمة لأتمتة المتابعة", evidence:"فجوة الحجز اليدوي ترتبط بخدمة أتمتة واتساب." },
    { id:"SIG-1405-E", businessId:"BUS-1405", key:"complete_profile", dimension:"dataQuality", points:9, polarity:"positive", value:"بيانات كافية للتحليل", evidence:"بيانات النشاط والتواصل والموقع متاحة." }
  ],
  serviceCatalog: [
    { id:"SVC-1001", name:"تطوير الموقع", gapCodes:["weak_website"], description:"تحسين تجربة الموقع ومسار التحويل من الزيارة إلى الطلب." },
    { id:"SVC-1002", name:"تحسين الظهور الرقمي", gapCodes:["weak_visibility"], description:"رفع قابلية الظهور أمام الباحثين عن الخدمة." },
    { id:"SVC-1003", name:"أتمتة واتساب والحجز", gapCodes:["manual_booking","missing_whatsapp","appointment_friction"], description:"تحويل الاستفسارات إلى مسار متابعة وحجز أوضح." },
    { id:"SVC-1004", name:"إدارة المحتوى الاجتماعي", gapCodes:["inactive_social"], description:"معالجة فجوة الحضور الاجتماعي بمحتوى تشغيلي منظم." },
    { id:"SVC-1005", name:"تهيئة CRM", gapCodes:["no_crm_context"], description:"تنظيم سياق العملاء قبل النقل إلى CRM في المرحلة التالية." }
  ],
  opportunityAnalyses: [
    { id:"ANL-1042", businessId:"BUS-1042", status:"analyzed", signalIds:["SIG-1042-A","SIG-1042-B","SIG-1042-C","SIG-1042-D","SIG-1042-E","SIG-1042-F"], confidence:0.92, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T09:42:00" },
    { id:"ANL-1137", businessId:"BUS-1137", status:"analyzed", signalIds:["SIG-1137-A","SIG-1137-B","SIG-1137-C","SIG-1137-D","SIG-1137-E","SIG-1137-F"], confidence:0.86, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T09:35:00" },
    { id:"ANL-1198", businessId:"BUS-1198", status:"analyzed", signalIds:["SIG-1198-A","SIG-1198-B","SIG-1198-C","SIG-1198-D","SIG-1198-E","SIG-1198-F"], confidence:0.63, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T09:18:00" },
    { id:"ANL-1402", businessId:"BUS-1402", status:"analyzed", signalIds:["SIG-1402-A","SIG-1402-B","SIG-1402-C","SIG-1402-D","SIG-1402-E"], confidence:0.95, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T09:10:00" },
    { id:"ANL-1403", businessId:"BUS-1403", status:"analysis_error", signalIds:["SIG-1403-A","SIG-1403-B","SIG-1403-C","SIG-1403-D","SIG-1403-E"], confidence:0.54, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T08:58:00" },
    { id:"ANL-1404", businessId:"BUS-1404", status:"insufficient_data", signalIds:["SIG-1404-A","SIG-1404-B","SIG-1404-C"], confidence:0, scoringVersion:"S4-MOCK-v1", analyzedAt:"2026-08-15T08:50:00" },
    { id:"ANL-1405", businessId:"BUS-1405", status:"not_analyzed", signalIds:["SIG-1405-A","SIG-1405-B","SIG-1405-C","SIG-1405-D","SIG-1405-E"], confidence:0.84, scoringVersion:"S4-MOCK-v1", analyzedAt:null }
  ],
  opportunities: [
    { id:"OPP-1042", analysisId:"ANL-1042", businessId:"BUS-1042", status:"open", reasonSignalIds:["SIG-1042-B","SIG-1042-C"], salesApproach:"ابدأ بمناقشة تحسين تحويل زوار الموقع إلى حجوزات ومحادثات متابعة بدل بيع إعادة تصميم الموقع مباشرة." },
    { id:"OPP-1137", analysisId:"ANL-1137", businessId:"BUS-1137", status:"open", reasonSignalIds:["SIG-1137-B","SIG-1137-C"], salesApproach:"ابدأ بسؤال عن أثر الظهور وحجز المواعيد على وقت الاستقبال، ثم اربط الحل بقياس واضح." },
    { id:"OPP-1198", analysisId:"ANL-1198", businessId:"BUS-1198", status:"open", reasonSignalIds:["SIG-1198-B","SIG-1198-C"], salesApproach:"ابدأ بمراجعة مسار التحويل الحالي قبل اقتراح أتمتة واتساب أو تطوير الموقع." },
    { id:"OPP-1402", analysisId:"ANL-1402", businessId:"BUS-1402", status:"open", reasonSignalIds:[], salesApproach:"لا تبدأ بعرض خدمة محددة؛ السجل قوي رقميًا ولا توجد فجوة مثبتة تستدعي أولوية عالية." },
  ],
  leads: [
    { id:"LEAD-1042", businessId:"BUS-1042", companyId:"CMP-1042", ownerId:"USR-1001", status:"qualified", priority:"high", tags:["عيادات","حجز"], sourceJobId:"JOB-1028", createdAt:"2026-08-12T09:30:00", updatedAt:"2026-08-15T10:35:00", lastActivityAt:"2026-08-15T10:35:00", nextActivityAt:"2026-08-15T13:00:00", convertedAt:"2026-08-12T09:30:00" },
    { id:"LEAD-1137", businessId:"BUS-1137", companyId:"CMP-1137", ownerId:"USR-1002", status:"contacted", priority:"high", tags:["عيادات","عرض"], sourceJobId:"JOB-1028", createdAt:"2026-08-13T10:12:00", updatedAt:"2026-08-14T12:20:00", lastActivityAt:"2026-08-14T12:20:00", nextActivityAt:"2026-08-15T15:30:00", convertedAt:"2026-08-13T10:12:00" },
    { id:"LEAD-1220", businessId:"BUS-1220", companyId:"CMP-1220", ownerId:"USR-1003", status:"qualified", priority:"medium", tags:["مقاولات"], sourceJobId:"JOB-1029", createdAt:"2026-08-11T13:20:00", updatedAt:"2026-08-13T10:00:00", lastActivityAt:"2026-08-13T10:00:00", nextActivityAt:"2026-08-14T11:30:00", convertedAt:"2026-08-11T13:20:00" },
    { id:"LEAD-1301", businessId:"BUS-1301", companyId:"CMP-1301", ownerId:"USR-1002", status:"nurturing", priority:"medium", tags:["عيادات","متابعة"], sourceJobId:"JOB-1031", createdAt:"2026-08-10T11:40:00", updatedAt:"2026-08-10T11:40:00", lastActivityAt:"2026-08-10T11:40:00", nextActivityAt:null, convertedAt:"2026-08-10T11:40:00" },
    { id:"LEAD-1375", businessId:"BUS-1375", companyId:"CMP-1375", ownerId:"USR-1003", status:"new", priority:"low", tags:["تسويق"], sourceJobId:"JOB-1030", createdAt:"2026-08-15T10:42:00", updatedAt:"2026-08-15T10:42:00", lastActivityAt:"2026-08-15T10:42:00", nextActivityAt:"2026-08-16T10:00:00", convertedAt:"2026-08-15T10:42:00" }
  ],
  contacts: [{ id:"CON-1042", leadId:"LEAD-1042", companyId:"CMP-1042", businessId:"BUS-1042", name:"د. محمد السبيعي", title:"مدير العيادات", phone:"+966114568201", email:"hello@hayatdental.sa", status:"active", createdAt:"2026-08-12T09:30:00" }, { id:"CON-1137", leadId:"LEAD-1137", companyId:"CMP-1137", businessId:"BUS-1137", name:"مركز ابتسامة", title:"فريق الاستقبال", phone:"+966112844502", email:"info@ibtisama.med", status:"active", createdAt:"2026-08-13T10:12:00" }],
  companies: [
    { id:"CMP-1042", businessId:"BUS-1042", name:"عيادات الحياة لطب الأسنان", status:"active" }, { id:"CMP-1137", businessId:"BUS-1137", name:"مركز ابتسامة الطبي", status:"active" }, { id:"CMP-1220", businessId:"BUS-1220", name:"شركة المدار للمقاولات", status:"active" }, { id:"CMP-1301", businessId:"BUS-1301", name:"عيادات النخبة للأسنان", status:"active" }, { id:"CMP-1375", businessId:"BUS-1375", name:"مؤسسة ابتكار للتسويق", status:"active" }
  ],
  conversations,
  messages: messageFixtures,
  conversationActivities: [
    { id:"CVA-3042-1", conversationId:"CONV-3042", leadId:"LEAD-1042", actorId:"USR-1001", type:"conversation_opened", createdAt:"2026-08-14T09:42:00", metadata:{ channel:"whatsapp" } },
    { id:"CVA-3044-1", conversationId:"CONV-3044", leadId:"LEAD-1220", actorId:"USR-1003", type:"conversation_closed", createdAt:"2026-08-14T15:45:00", metadata:{ reason:"مراجعة مكتملة" } }
  ],
  quickReplyTemplates: [
    { id:"QRT-1001", title:"شكرًا للتواصل", body:"شكرًا لتواصلك، سنراجع التفاصيل ونعود إليك قريبًا.", category:"ترحيب" },
    { id:"QRT-1002", title:"مراجعة التفاصيل", body:"سأراجع التفاصيل مع الفريق وأعود إليك بخطوة مناسبة.", category:"متابعة" },
    { id:"QRT-1003", title:"اتصال قصير", body:"هل يناسبك اتصال قصير لفهم الاحتياج بشكل أدق؟", category:"تأهيل" },
    { id:"QRT-1004", title:"الوقت المناسب", body:"أرسل لي الوقت المناسب لك وسنرتب المتابعة.", category:"تنسيق" }
  ],
  tasks: [
    { id:"TSK-1042", leadId:"LEAD-1220", status:"overdue", ownerId:"USR-1003", priority:"high", type:"اتصال", title:"مراجعة العرض", when:"11:30", dueAt:"2026-08-14T11:30:00", createdAt:"2026-08-13T10:00:00", completedAt:null, scheduleStatus:"متأخر", route:"crm/leads/LEAD-1220" },
    { id:"TSK-1043", leadId:"LEAD-1042", status:"pending", ownerId:"USR-1001", priority:"high", type:"متابعة واتساب", title:"تأكيد احتياج الحجز", when:"13:00", dueAt:"2026-08-15T13:00:00", createdAt:"2026-08-14T11:20:00", completedAt:null, scheduleStatus:"اليوم", route:"crm/leads/LEAD-1042" },
    { id:"TSK-1044", leadId:"LEAD-1137", status:"pending", ownerId:"USR-1002", priority:"medium", type:"اجتماع", title:"عرض توضيحي", when:"15:30", dueAt:"2026-08-15T15:30:00", createdAt:"2026-08-14T12:20:00", completedAt:null, scheduleStatus:"اليوم", route:"crm/leads/LEAD-1137" },
    { id:"TSK-1045", leadId:"LEAD-1375", status:"pending", ownerId:"USR-1003", priority:"low", type:"عرض", title:"إرسال مقترح الخدمة", when:"غدًا", dueAt:"2026-08-16T10:00:00", createdAt:"2026-08-15T10:42:00", completedAt:null, scheduleStatus:"قادم", route:"crm/leads/LEAD-1375" }
  ],
  notes: [{ id:"NOTE-1042", leadId:"LEAD-1042", authorId:"USR-1001", body:"يركز اللقاء القادم على تحويل زيارات الموقع إلى حجوزات ومتابعات واضحة.", createdAt:"2026-08-15T10:35:00" }],
  activities: [
    { id:"ACT-1042-1", leadId:"LEAD-1042", type:"conversion", actorId:"USR-1001", title:"أضيفت Business إلى CRM", detail:"تم تحويل BUS-1042 مع الاحتفاظ بمصدر الاكتشاف وسياق Intelligence.", metadata:{businessId:"BUS-1042",companyId:"CMP-1042",sourceJobId:"JOB-1028"}, createdAt:"2026-08-12T09:30:00" },
    { id:"ACT-1042-2", leadId:"LEAD-1042", type:"intelligence_reviewed", actorId:"USR-1001", title:"تمت مراجعة فرصة عالية", detail:"Score 92 وEvidence مرتبطة بفجوات الموقع والحجز.", metadata:{analysisId:"ANL-1042",opportunityId:"OPP-1042"}, createdAt:"2026-08-15T09:42:00" },
    { id:"ACT-1042-3", leadId:"LEAD-1042", type:"task_created", actorId:"USR-1001", title:"أُنشئت متابعة الحجز", detail:"TSK-1043 مستحقة اليوم.", metadata:{taskId:"TSK-1043"}, createdAt:"2026-08-14T11:20:00" },
    { id:"ACT-1042-4", leadId:"LEAD-1042", type:"note_added", actorId:"USR-1001", title:"أضيفت ملاحظة", detail:"يركز اللقاء القادم على تحويل زيارات الموقع إلى حجوزات ومتابعات واضحة.", metadata:{noteId:"NOTE-1042"}, createdAt:"2026-08-15T10:35:00" },
    { id:"ACT-1137-1", leadId:"LEAD-1137", type:"conversion", actorId:"USR-1002", title:"أضيفت Business إلى CRM", detail:"تم تحويل BUS-1137 مع الاحتفاظ بسياق المصدر.", metadata:{businessId:"BUS-1137",companyId:"CMP-1137",sourceJobId:"JOB-1028"}, createdAt:"2026-08-13T10:12:00" },
    { id:"ACT-1137-2", leadId:"LEAD-1137", type:"task_created", actorId:"USR-1002", title:"أُنشئ عرض توضيحي", detail:"TSK-1044 مستحقة اليوم.", metadata:{taskId:"TSK-1044"}, createdAt:"2026-08-14T12:20:00" },
    { id:"ACT-1220-1", leadId:"LEAD-1220", type:"conversion", actorId:"USR-1003", title:"أضيفت Business إلى CRM", detail:"تم تحويل BUS-1220 مع الاحتفاظ بسياق المصدر.", metadata:{businessId:"BUS-1220",companyId:"CMP-1220",sourceJobId:"JOB-1029"}, createdAt:"2026-08-11T13:20:00" },
    { id:"ACT-1220-2", leadId:"LEAD-1220", type:"task_created", actorId:"USR-1003", title:"أُنشئت مراجعة العرض", detail:"TSK-1042 مستحقة للمراجعة.", metadata:{taskId:"TSK-1042"}, createdAt:"2026-08-13T10:00:00" },
    { id:"ACT-1301-1", leadId:"LEAD-1301", type:"conversion", actorId:"USR-1002", title:"أضيفت Business إلى CRM", detail:"تم تحويل BUS-1301 مع الاحتفاظ بسياق المصدر.", metadata:{businessId:"BUS-1301",companyId:"CMP-1301",sourceJobId:"JOB-1031"}, createdAt:"2026-08-10T11:40:00" },
    { id:"ACT-1375-1", leadId:"LEAD-1375", type:"conversion", actorId:"USR-1003", title:"أضيفت Business إلى CRM", detail:"تم تحويل BUS-1375 مع الاحتفاظ بسياق المصدر.", metadata:{businessId:"BUS-1375",companyId:"CMP-1375",sourceJobId:"JOB-1030"}, createdAt:"2026-08-15T10:42:00" }
  ],
  appointments: [{ id:"APT-1042", leadId:"LEAD-1042", dealId:"DEAL-4042", ownerId:"USR-1001", title:"مراجعة العرض والخطوة التالية", type:"meeting", status:"scheduled", startsAt:"2026-08-16T10:00:00", endsAt:"2026-08-16T10:30:00", locationType:"online", location:"رابط تجريبي محلي", createdAt:"2026-08-15T10:35:00", updatedAt:"2026-08-15T10:35:00", createdByAutomationRunId:null }],
  deals: [
    { id:"DEAL-4042", leadId:"LEAD-1042", pipelineId:"PIPE-1001", stageId:"STG-1005", status:"open", name:"تطوير موقع وحجز عيادات الحياة", value:85000, currency:"SAR", probabilityOverride:82, ownerId:"USR-1001", expectedCloseAt:"2026-08-22", createdAt:"2026-08-12T10:00:00", updatedAt:"2026-08-15T10:35:00", closedAt:null, lossReason:null },
    { id:"DEAL-4051", leadId:"LEAD-1220", pipelineId:"PIPE-1001", stageId:"STG-1006", status:"open", name:"منصة متابعة شركة المدار", value:120000, currency:"SAR", probabilityOverride:76, ownerId:"USR-1003", expectedCloseAt:"2026-08-20", createdAt:"2026-08-11T13:30:00", updatedAt:"2026-08-14T11:10:00", closedAt:null, lossReason:null },
    { id:"DEAL-4052", leadId:"LEAD-1137", pipelineId:"PIPE-1001", stageId:"STG-1004", status:"open", name:"تحسين حجز مركز ابتسامة", value:56000, currency:"SAR", probabilityOverride:68, ownerId:"USR-1002", expectedCloseAt:"2026-08-25", createdAt:"2026-08-13T10:30:00", updatedAt:"2026-08-14T12:20:00", closedAt:null, lossReason:null },
    { id:"DEAL-4061", leadId:"LEAD-1042", pipelineId:"PIPE-1001", stageId:"STG-1007", status:"won", name:"عقد نمو عيادات الحياة", value:150000, currency:"SAR", probabilityOverride:null, ownerId:"USR-1001", expectedCloseAt:"2026-08-01", createdAt:"2026-07-12T10:00:00", updatedAt:"2026-08-01T13:10:00", closedAt:"2026-08-01T13:10:00", lossReason:null },
    { id:"DEAL-4062", leadId:"LEAD-1220", pipelineId:"PIPE-1001", stageId:"STG-1007", status:"won", name:"عقد التحول الرقمي للمدار", value:132000, currency:"SAR", probabilityOverride:null, ownerId:"USR-1003", expectedCloseAt:"2026-08-05", createdAt:"2026-07-15T12:00:00", updatedAt:"2026-08-05T15:30:00", closedAt:"2026-08-05T15:30:00", lossReason:null },
    { id:"DEAL-4063", leadId:"LEAD-1301", pipelineId:"PIPE-1001", stageId:"STG-1007", status:"won", name:"برنامج نمو عيادات النخبة", value:100000, currency:"SAR", probabilityOverride:null, ownerId:"USR-1002", expectedCloseAt:"2026-08-09", createdAt:"2026-07-20T09:00:00", updatedAt:"2026-08-09T14:20:00", closedAt:"2026-08-09T14:20:00", lossReason:null }
  ],
  pipelines: [{ id:"PIPE-1001", name:"مسار المبيعات الرئيسي", status:"active" }],
  pipelineStages: [
    { id:"STG-1001", pipelineId:"PIPE-1001", name:"جديد", order:1, defaultProbability:10, kind:"open" }, { id:"STG-1002", pipelineId:"PIPE-1001", name:"تم التواصل", order:2, defaultProbability:25, kind:"open" }, { id:"STG-1003", pipelineId:"PIPE-1001", name:"مؤهل", order:3, defaultProbability:40, kind:"open" }, { id:"STG-1004", pipelineId:"PIPE-1001", name:"اجتماع", order:4, defaultProbability:55, kind:"open" }, { id:"STG-1005", pipelineId:"PIPE-1001", name:"عرض", order:5, defaultProbability:70, kind:"open" }, { id:"STG-1006", pipelineId:"PIPE-1001", name:"تفاوض", order:6, defaultProbability:85, kind:"open" }, { id:"STG-1007", pipelineId:"PIPE-1001", name:"رابح", order:7, defaultProbability:100, kind:"won" }, { id:"STG-1008", pipelineId:"PIPE-1001", name:"خاسر", order:8, defaultProbability:0, kind:"lost" }
  ],
  automations: [],
  agents: [{ id:"AGT-1001", name:"وكيل المتابعة", status:"paused" }],
  recommendations: [{ id:"AIR-1042", leadId:"LEAD-1042", status:"pending", confidence:92 }],
  aiDecisionRecords: [],
  agentActions: [
    { id:"AGA-8001", leadId:"LEAD-1137", conversationId:"CONV-3043", type:"create_task", status:"failed", proposedBy:"agent", requiresApproval:true, payload:{ title:"متابعة تجريبية فاشلة", simulateFailure:true }, evidenceRefs:["MSG-3043-1","LEAD-1137"], reason:"Fixture يوضح أن الفشل لا يتحول إلى نجاح مصطنع.", confidence:0.42, contextVersion:"fixture", createdAt:"2026-08-15T12:32:00", approvedBy:"USR-1002", approvedAt:"2026-08-15T12:33:00", executedAt:null, executedBy:null, failureReason:"فشل تنفيذي تجريبي مقصود." }
  ],
  agentActivities: [
    { id:"AGA-LOG-8001", actionId:"AGA-8001", leadId:"LEAD-1137", type:"proposal_created", actorId:"agent", createdAt:"2026-08-15T12:32:00", metadata:{ proposedBy:"agent" } },
    { id:"AGA-LOG-8002", actionId:"AGA-8001", leadId:"LEAD-1137", type:"approved", actorId:"USR-1002", createdAt:"2026-08-15T12:33:00", metadata:{ approvedBy:"USR-1002" } },
    { id:"AGA-LOG-8003", actionId:"AGA-8001", leadId:"LEAD-1137", type:"failed", actorId:"governed_agent", createdAt:"2026-08-15T12:33:01", metadata:{ reason:"فشل تنفيذي تجريبي مقصود." } }
  ],
  revenueEvents: [
    { id:"REV-4061", dealId:"DEAL-4061", status:"recognized", amount:150000, recognizedAt:"2026-08-01", period:"عرض تجريبي ثابت" },
    { id:"REV-4062", dealId:"DEAL-4062", status:"recognized", amount:132000, recognizedAt:"2026-08-05", period:"عرض تجريبي ثابت" },
    { id:"REV-4063", dealId:"DEAL-4063", status:"recognized", amount:100000, recognizedAt:"2026-08-09", period:"عرض تجريبي ثابت" }
  ],
  attributionTouchpoints: [
    { id:"ATT-4061", revenueEventId:"REV-4061", discoveryJobId:"JOB-1028", type:"first_touch" }, { id:"ATT-4062", revenueEventId:"REV-4062", discoveryJobId:"JOB-1029", type:"first_touch" }, { id:"ATT-4063", revenueEventId:"REV-4063", discoveryJobId:"JOB-1031", type:"first_touch" }
  ],
  users: [{ id:"USR-1001", name:"سارة العمري", role:"مسؤولة النمو", teamId:"TEAM-1001", status:"active" }, { id:"USR-1002", name:"فهد الحربي", role:"مدير مبيعات", teamId:"TEAM-1001", status:"active" }, { id:"USR-1003", name:"خالد السالم", role:"مستشار نمو", teamId:"TEAM-1001", status:"active" }],
  teams: [{ id:"TEAM-1001", name:"وكالة نمو الرقمية", status:"active" }],
  workspace: { id:"WORK-1001", name:"وكالة نمو الرقمية", timezone:"Asia/Riyadh", currency:"SAR", locale:"ar-SA", createdAt:"2026-07-01T09:00:00", updatedAt:"2026-08-15T12:00:00" },
  currentUserId:"USR-1001",
  notificationPreferences: [
    { id:"NP-1001", userId:"USR-1001", category:"new_lead", channels:["in_app"], enabled:true },
    { id:"NP-1002", userId:"USR-1001", category:"task_due", channels:["in_app","email_mock"], enabled:true },
    { id:"NP-1003", userId:"USR-1001", category:"appointment_due", channels:["in_app"], enabled:true },
    { id:"NP-1004", userId:"USR-1001", category:"automation_approval", channels:["in_app"], enabled:true },
    { id:"NP-1005", userId:"USR-1001", category:"conversation_needs_reply", channels:["in_app","whatsapp_mock"], enabled:false },
    { id:"NP-1006", userId:"USR-1001", category:"deal_attention", channels:["in_app"], enabled:true }
  ],
  securitySettings: { sessionPolicy:"session_only_mock", dataResidency:"local_only", externalAiAccess:false, updatedAt:"2026-08-15T12:00:00" },
  settingsActivities: [
    { id:"SET-1001", actorId:"USR-1001", type:"settings_changed", createdAt:"2026-08-15T11:40:00", metadata:{ field:"timezone", from:"Asia/Riyadh", to:"Asia/Riyadh" } }
  ],
  teamInvitations: [
    { id:"INV-1001", teamId:"TEAM-1001", email:"member@example.test", role:"مستشار نمو", status:"pending_mock", invitedBy:"USR-1001", createdAt:"2026-08-15T10:20:00" }
  ],
  integrations: [
    { id:"INT-1001", provider:"google_maps", name:"خرائط الأعمال", category:"business_sources", status:"not_connected", mode:"mock", capabilities:["read_business_sources_mock","import_businesses_mock"], context:"اكتشاف العملاء", configuredAt:null, connectedBy:null, lastCheckedAt:null, errorCode:null, errorReason:null, hasConfiguredSecret:false },
    { id:"INT-1002", provider:"whatsapp", name:"واتساب", category:"messaging", status:"not_connected", mode:"mock", capabilities:["read_messages_mock","send_messages_mock"], context:"صندوق الوارد", configuredAt:null, connectedBy:null, lastCheckedAt:null, errorCode:null, errorReason:null, hasConfiguredSecret:false },
    { id:"INT-1003", provider:"email", name:"البريد الإلكتروني", category:"messaging", status:"configuration_required", mode:"mock", capabilities:["send_email_mock","read_email_mock"], context:"متابعة العملاء", configuredAt:null, connectedBy:null, lastCheckedAt:null, errorCode:null, errorReason:null, hasConfiguredSecret:false },
    { id:"INT-1004", provider:"google_calendar", name:"تقويم Google", category:"calendar", status:"error", mode:"mock", capabilities:["sync_appointments_mock"], context:"المواعيد", configuredAt:"2026-08-14T14:00:00", connectedBy:"USR-1001", lastCheckedAt:"2026-08-15T09:20:00", errorCode:"MOCK_CONFIGURATION_EXPIRED", errorReason:"Fixture تجريبي: يحتاج حفظ إعداد محلي قبل إعادة المحاولة.", hasConfiguredSecret:false },
    { id:"INT-1005", provider:"crm_import_export", name:"استيراد وتصدير CRM", category:"crm", status:"mock_connected", mode:"mock", capabilities:["import_csv_mock","export_csv_mock"], context:"إدارة العملاء", configuredAt:"2026-08-12T09:00:00", connectedBy:"USR-1001", lastCheckedAt:"2026-08-15T10:00:00", errorCode:null, errorReason:null, hasConfiguredSecret:false },
    { id:"INT-1006", provider:"ai_provider", name:"مزود الذكاء الاصطناعي", category:"ai", status:"disabled", mode:"local_deterministic_mock", capabilities:["local_analysis_mock","suggested_reply_mock"], context:"Copilot", configuredAt:null, connectedBy:null, lastCheckedAt:null, errorCode:null, errorReason:null, hasConfiguredSecret:false },
    { id:"INT-1007", provider:"webhook", name:"Webhook", category:"developer", status:"disabled", mode:"mock", capabilities:["event_preview_mock"], context:"الأتمتة", configuredAt:null, connectedBy:null, lastCheckedAt:null, errorCode:null, errorReason:null, hasConfiguredSecret:false }
  ],
  integrationActivities: [
    { id:"INTA-1001", integrationId:"INT-1004", actorId:"USR-1001", type:"status_changed", createdAt:"2026-08-15T09:20:00", metadata:{ from:"configuration_required", to:"error", reason:"MOCK_CONFIGURATION_EXPIRED" } },
    { id:"INTA-1002", integrationId:"INT-1005", actorId:"USR-1001", type:"mock_connected", createdAt:"2026-08-12T09:00:00", metadata:{ mode:"mock" } }
  ],
  plans: [
    { id:"PLAN-STARTER", name:"البداية", billingInterval:"monthly", price:99, currency:"SAR", limits:{ leads:1000, discoveryRuns:10, seats:2, automationRuns:25, aiAnalyses:150 }, features:["اكتشاف أساسي","CRM محلي","تصدير CSV تجريبي"] },
    { id:"PLAN-GROWTH", name:"النمو", billingInterval:"monthly", price:299, currency:"SAR", limits:{ leads:5000, discoveryRuns:100, seats:5, automationRuns:500, aiAnalyses:1000 }, features:["كل مزايا البداية","Pipeline","Inbox وCopilot محلي","أتمتة تجريبية"] },
    { id:"PLAN-SCALE", name:"التوسع", billingInterval:"monthly", price:699, currency:"SAR", limits:{ leads:25000, discoveryRuns:500, seats:20, automationRuns:5000, aiAnalyses:10000 }, features:["كل مزايا النمو","فرق أكبر","قنوات وخطط توسع مستقبلية"] }
  ],
  subscriptions: [{ id:"SUB-1001", workspaceId:"WORK-1001", planId:"PLAN-GROWTH", status:"active_mock", startedAt:"2026-08-01T00:00:00", renewsAt:"2026-09-01T00:00:00", cancelAtPeriodEnd:false, createdAt:"2026-08-01T00:00:00", updatedAt:"2026-08-15T12:00:00" }],
  invoices: [
    { id:"INV-BILL-1001", subscriptionId:"SUB-1001", periodStart:"2026-07-01", periodEnd:"2026-07-31", amount:299, currency:"SAR", status:"paid_mock", issuedAt:"2026-08-01T00:00:00" },
    { id:"INV-BILL-1002", subscriptionId:"SUB-1001", periodStart:"2026-08-01", periodEnd:"2026-08-31", amount:299, currency:"SAR", status:"open_mock", issuedAt:"2026-08-15T00:00:00" }
  ],
  paymentMethods: [{ id:"PM-1001", workspaceId:"WORK-1001", brand:"Visa", last4:"4242", status:"mock", label:"وسيلة دفع تجريبية" }],
  billingActivities: [{ id:"BILL-1001", subscriptionId:"SUB-1001", actorId:"USR-1001", type:"subscription_started_mock", createdAt:"2026-08-01T00:00:00", metadata:{ planId:"PLAN-GROWTH" } }]
};

const findById = (items, id) => items.find((item) => item.id === id);
const duplicateIds = (items) => items.map((item) => item.id).filter((id, index, all) => all.indexOf(id) !== index);

// S6-FIX contract reminder: a Deal owns its commercial state. Legacy `name` and `probabilityOverride` remain compatibility inputs only; selectors expose `title` and `probability`.
function normalizeDealRecord(deal) {
  const stage = mockModel.pipelineStages.find((item) => item.id === deal.stageId);
  deal.title = deal.title || deal.name || `فرصة ${deal.id}`;
  deal.name = deal.title;
  deal.serviceId = deal.serviceId || null;
  const stageProbability = stage?.defaultProbability ?? 0;
  deal.probability = deal.status === "won" ? 100 : deal.status === "lost" ? 0 : (Number.isFinite(deal.probability) ? deal.probability : (Number.isFinite(deal.probabilityOverride) ? deal.probabilityOverride : stageProbability));
  deal.lastActivityAt = deal.lastActivityAt || deal.updatedAt || deal.createdAt;
  deal.wonAt = deal.status === "won" ? (deal.wonAt || deal.closedAt || deal.updatedAt) : null;
  deal.lostAt = deal.status === "lost" ? (deal.lostAt || deal.closedAt || deal.updatedAt) : null;
  deal.lossReason = deal.status === "lost" ? (deal.lossReason || "سبب تاريخي غير متاح") : null;
  return deal;
}
mockModel.deals.forEach(normalizeDealRecord);

function normalizeDealTitle(value) { return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar"); }
function getDealDuplicateKey(values = {}) { return values.serviceId ? `service:${values.serviceId}` : `title:${normalizeDealTitle(values.title || values.name)}`; }
function isIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)); }

export function getUpcomingActivities() {
  return mockModel.tasks.map((task) => {
    const lead = findById(mockModel.leads, task.leadId);
    return { id:task.id, businessId:lead?.businessId, type:task.type, title:task.title, when:task.when, status:task.scheduleStatus, route:task.route };
  });
}

export function getRevenueAttribution() {
  const recognized = mockModel.revenueEvents.filter((event) => event.status === "recognized");
  const byJob = new Map();
  recognized.forEach((event) => {
    const deal = findById(mockModel.deals, event.dealId);
    const lead = deal && findById(mockModel.leads, deal.leadId);
    const business = lead && findById(businesses, lead.businessId);
    const touchpoint = mockModel.attributionTouchpoints.find((item) => item.revenueEventId === event.id);
    const job = touchpoint && findById(jobs, touchpoint.discoveryJobId);
    const source = job && findById(mockModel.discoverySources, job.sourceId);
    if (!deal || !lead || !business || !touchpoint || !job || !source) return;
    const card = byJob.get(job.id) || { jobId:job.id, sourceId:source.id, sourceName:source.name, label:`${job.keyword} — ${job.location}`, discovered:job.current, qualified:job.qualified, won:0, revenue:0, revenueEventIds:[], dealIds:[] };
    card.won += 1;
    card.revenue += event.amount;
    card.revenueEventIds.push(event.id);
    card.dealIds.push(deal.id);
    byJob.set(job.id, card);
  });
  return [...byJob.values()];
}

export function getRevenueSummary() {
  const attribution = getRevenueAttribution();
  const revenue = attribution.reduce((total, item) => total + item.revenue, 0);
  const wonEvents = attribution.reduce((total, item) => total + item.won, 0);
  const pipeline = getOpenPipelineMetrics();
  return { revenue, pipeline:pipeline.openPipelineValue, weightedPipeline:pipeline.weightedPipelineValue, openDealCount:pipeline.openDealCount, averageDeal:wonEvents ? Math.round(revenue / wonEvents) : 0, winRate:Math.round(dashboardData.funnelMetrics[6].value / dashboardData.funnelMetrics[5].value * 100), averageCycle:"18 يومًا", periodLabel:"بيانات تجريبية ثابتة للعرض" };
}

export function getDashboardMetrics() {
  const summary = getRevenueSummary();
  return dashboardData.dashboardMetrics.map((metric) => {
    if (metric.id === "revenue") return { ...metric, value:summary.revenue };
    if (metric.id === "openDeals") return { ...metric, value:summary.openDealCount, trend:"من صفقات S6 المفتوحة", note:"مصدر الحقيقة: Deal" };
    if (metric.id === "pipelineValue") return { ...metric, value:summary.pipeline, trend:"القيمة المفتوحة الحالية", note:"مصدر الحقيقة: Deal" };
    return metric;
  });
}

export function getAttributionIntegrityReport() {
  const checks = { attributionChains:[], revenueReconciliation:[], uniqueIds:[], referenceIntegrity:[], taskIntegrity:[] };
  const addCheck = (group, name, pass, detail) => checks[group].push({ name, pass, detail });
  const entities = { businesses, jobs, discoverySources:mockModel.discoverySources, leads:mockModel.leads, companies:mockModel.companies, deals:mockModel.deals, revenueEvents:mockModel.revenueEvents, attributionTouchpoints:mockModel.attributionTouchpoints, tasks:mockModel.tasks, conversations };
  Object.entries(entities).forEach(([name, items]) => { const duplicates = duplicateIds(items); addCheck("uniqueIds", `تفرد ${name}`, duplicates.length === 0, duplicates.length ? `معرفات مكررة: ${duplicates.join(", ")}` : "لا توجد معرفات مكررة"); });
  jobs.forEach((job) => addCheck("referenceIntegrity", `${job.id} → sourceId`, Boolean(findById(mockModel.discoverySources, job.sourceId)), job.sourceId));
  businesses.forEach((business) => addCheck("referenceIntegrity", `${business.id} → discoveryJobId`, Boolean(findById(jobs, business.discoveryJobId)), business.discoveryJobId));
  mockModel.leads.forEach((lead) => { addCheck("referenceIntegrity", `${lead.id} → businessId`, Boolean(findById(businesses, lead.businessId)), lead.businessId); addCheck("referenceIntegrity", `${lead.id} → companyId`, Boolean(findById(mockModel.companies, lead.companyId)), lead.companyId); addCheck("referenceIntegrity", `${lead.id} → sourceJobId`, Boolean(findById(jobs, lead.sourceJobId)), lead.sourceJobId); });
  mockModel.deals.forEach((deal) => addCheck("referenceIntegrity", `${deal.id} → leadId`, Boolean(findById(mockModel.leads, deal.leadId)), deal.leadId));
  mockModel.revenueEvents.forEach((event) => addCheck("referenceIntegrity", `${event.id} → dealId`, Boolean(findById(mockModel.deals, event.dealId)), event.dealId));
  mockModel.attributionTouchpoints.forEach((touchpoint) => { addCheck("referenceIntegrity", `${touchpoint.id} → revenueEventId`, Boolean(findById(mockModel.revenueEvents, touchpoint.revenueEventId)), touchpoint.revenueEventId); addCheck("referenceIntegrity", `${touchpoint.id} → discoveryJobId`, Boolean(findById(jobs, touchpoint.discoveryJobId)), touchpoint.discoveryJobId); });
  mockModel.tasks.forEach((task) => addCheck("referenceIntegrity", `${task.id} → leadId`, Boolean(findById(mockModel.leads, task.leadId)), task.leadId));
  const recognized = mockModel.revenueEvents.filter((event) => event.status === "recognized");
  recognized.forEach((event) => {
    const deal = findById(mockModel.deals, event.dealId);
    const lead = deal && findById(mockModel.leads, deal.leadId);
    const business = lead && findById(businesses, lead.businessId);
    const touchpoint = mockModel.attributionTouchpoints.find((item) => item.revenueEventId === event.id);
    const job = touchpoint && findById(jobs, touchpoint.discoveryJobId);
    const source = job && findById(mockModel.discoverySources, job.sourceId);
    const pass = Boolean(deal && lead && business && touchpoint && job && source && business.discoveryJobId === job.id && lead.sourceJobId === job.id && deal.status === "won");
    addCheck("attributionChains", `سلسلة ${event.id}`, pass, pass ? `${source.id} → ${job.id} → ${business.id} → ${lead.id} → ${deal.id} → ${event.id} → ${touchpoint.id}` : "سلسلة إسناد ناقصة أو متعارضة");
  });
  const attributionTotal = getRevenueAttribution().reduce((total, item) => total + item.revenue, 0);
  const revenueSummary = getRevenueSummary().revenue;
  addCheck("revenueReconciliation", "إجمالي الإسناد = إيراد الفترة التجريبية", attributionTotal === revenueSummary, `${attributionTotal} = ${revenueSummary}`);
  const task1042 = mockModel.tasks.filter((task) => task.id === "TSK-1042");
  const taskLead = task1042[0] && findById(mockModel.leads, task1042[0].leadId);
  addCheck("taskIntegrity", "TSK-1042 حقيقة واحدة", task1042.length === 1 && taskLead?.businessId === "BUS-1220", task1042.length === 1 ? `مرتبط بـ${taskLead?.businessId}` : "معرف مكرر أو غير موجود");
  const pass = Object.values(checks).flat().every((check) => check.pass) && checks.attributionChains.length >= 3;
  return { pass, checks, attributionTotal, revenueSummary, attribution:getRevenueAttribution() };
}

export function getDiscoveryJob(jobId = state.selectedJobId) { return findById(jobs, jobId); }
export function getDiscoverySource(sourceId) { return findById(mockModel.discoverySources, sourceId); }
export function isDiscoveryResultsAvailable(job) { return job?.status === "completed"; }
export function isDiscoveryJobToday(job) { return Boolean(job?.createdAt?.startsWith(`${DISCOVERY_REFERENCE_DATE}T`)); }
export function isDiscoveryJobRecent(job) { return Boolean(job?.createdAt?.slice(0, 10) >= "2026-08-14"); }
export function formatDiscoveryJobCreatedAt(job) {
  if (!job?.createdAt) return job?.created || "—";
  const [date, rawTime] = job.createdAt.split("T");
  const time = rawTime?.slice(0, 5) || "—";
  if (date === DISCOVERY_REFERENCE_DATE) return `اليوم، ${time}`;
  if (date === "2026-08-14") return `أمس، ${time}`;
  const weekday = arabicWeekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${weekday}، ${time}`;
}
export function getJobResults(jobId) { const job = getDiscoveryJob(jobId); return isDiscoveryResultsAvailable(job) ? businesses.filter((business) => job.resultBusinessIds.includes(business.id)) : []; }
export function getDiscoveryCombinations(keywords, locations) { return keywords.flatMap((keyword) => locations.map((location) => ({ keyword, location, id:`${keyword}__${location}` }))); }
export function getNextDiscoveryJobId() { return `JOB-${Math.max(...jobs.map((job) => Number(job.id.split("-")[1]))) + 1}`; }
export function getNextBusinessId(offset = 0) { return `BUS-${Math.max(...businesses.map((business) => Number(business.id.split("-")[1]))) + 1 + offset}`; }
export function getJobStatusLabel(status) { return discoveryStatusLabels[status] || status; }

const createdJobBusinessTemplates = [
  { name:"عيادات الندى للأسنان", short:"الندى", category:"عيادات أسنان", city:"الرياض", country:"السعودية", address:"حي النخيل، الرياض", phone:"+966 11 540 1920", website:"alnada-dental.sa", rating:4.6, reviews:241, source:"مصادر الأعمال العامة" },
  { name:"مركز ابتكار لطب الأسنان", short:"ابتكار", category:"عيادات أسنان", city:"الرياض", country:"السعودية", address:"حي الورود، الرياض", phone:"+966 11 401 5283", website:"ibtikar-dental.sa", rating:4.4, reviews:186, source:"مصادر الأعمال العامة" },
  { name:"مجمع السحاب الطبي", short:"السحاب", category:"مركز طبي", city:"الرياض", country:"السعودية", address:"حي الياسمين، الرياض", phone:"+966 11 668 2305", website:"", rating:4.2, reviews:95, source:"مصادر الأعمال العامة" }
];

export function createDiscoveryJob(config) {
  const id = getNextDiscoveryJobId();
  const source = getDiscoverySource(config.sourceId);
  const keywords = [...config.keywords];
  const locations = [...config.locations];
  const name = `${keywords[0]} — ${locations[0]}${keywords.length * locations.length > 1 ? ` + ${keywords.length * locations.length - 1} مجموعات` : ""}`;
  const templates = createdJobBusinessTemplates.map((template, index) => ({ ...template, id:getNextBusinessId(index), discoveryJobId:id, category:keywords[0], city:locations[index % locations.length], source:source?.name || "مصادر الأعمال العامة", reviewCount:template.reviews }));
  templates.forEach((business) => businesses.push(business));
  const foundCount = 1420;
  const duplicateCount = 172;
  const job = { id, sourceId:config.sourceId, name, keyword:keywords[0], location:locations[0], keywords, locations, source:source?.name || "مصادر الأعمال العامة", filters:{ ...config.filters }, combinationCount:keywords.length * locations.length, status:"pending", created:"الآن", createdAt:"2026-08-15T12:15:00", startedAt:null, completedAt:null, progress:0, foundCount:0, duplicateCount:0, deduplicatedCount:0, discoveredCount:0, total:0, current:0, highScore:0, crmAdded:0, qualified:0, finalScenario:{ foundCount, duplicateCount, deduplicatedCount:foundCount - duplicateCount }, resultBusinessIds:templates.map((business) => business.id) };
  jobs.push(job);
  state.selectedJobId = id;
  state.selectedResultIds = [];
  return job;
}

export function startDiscoveryJob(jobId) { const job = getDiscoveryJob(jobId); if (!job) return null; job.status="processing"; job.progress=Math.max(job.progress || 0, 8); job.startedAt="2026-08-15T12:15:01"; job.failureMessage=""; return job; }
export function progressDiscoveryJob(jobId, step = 12) { const job = getDiscoveryJob(jobId); if (!job || job.status !== "processing") return job; job.progress=Math.min(100, job.progress + step); job.current=Math.round((job.finalScenario?.deduplicatedCount || job.total || 1248) * job.progress / 100); if (job.progress >= 100) return completeDiscoveryJob(jobId); return job; }
export function completeDiscoveryJob(jobId) { const job = getDiscoveryJob(jobId); if (!job) return null; const scenario = job.finalScenario || job.retryScenario || { foundCount:job.foundCount || 1420, duplicateCount:job.duplicateCount || 172, deduplicatedCount:job.deduplicatedCount || 1248 }; job.status="completed"; job.progress=100; job.foundCount=scenario.foundCount; job.duplicateCount=scenario.duplicateCount; job.deduplicatedCount=scenario.deduplicatedCount; job.discoveredCount=scenario.foundCount; job.total=scenario.deduplicatedCount; job.current=scenario.deduplicatedCount; job.completedAt="2026-08-15T12:15:12"; return job; }
export function cancelDiscoveryJob(jobId) { const job = getDiscoveryJob(jobId); if (!job) return null; job.status="cancelled"; job.completedAt=null; return job; }
export function retryDiscoveryJob(jobId) { const job = getDiscoveryJob(jobId); if (!job) return null; job.progress=0; job.foundCount=0; job.duplicateCount=0; job.deduplicatedCount=0; job.discoveredCount=0; job.current=0; return startDiscoveryJob(jobId); }

export function getDiscoveryIntegrityReport() {
  const checks = { sourceIntegrity:[], businessIntegrity:[], combinationIntegrity:[], countIntegrity:[], uniqueIds:[], statusContract:[], resultsOwnership:[] };
  const add = (group, name, pass, detail) => checks[group].push({ name, pass, detail });
  jobs.forEach((job) => {
    add("sourceIntegrity", `${job.id} → sourceId`, Boolean(getDiscoverySource(job.sourceId)), job.sourceId);
    add("combinationIntegrity", `${job.id} combinations`, job.combinationCount === job.keywords.length * job.locations.length, `${job.keywords.length} × ${job.locations.length} = ${job.combinationCount}`);
    if (job.status === "completed") add("countIntegrity", `${job.id} counts`, job.foundCount >= job.deduplicatedCount && job.foundCount - job.duplicateCount === job.deduplicatedCount, `${job.foundCount} - ${job.duplicateCount} = ${job.deduplicatedCount}`);
    add("statusContract", `${job.id} status`, ["pending","processing","completed","failed","cancelled"].includes(job.status), job.status);
    getJobResults(job.id).forEach((business) => add("resultsOwnership", `${business.id} → ${job.id}`, business.discoveryJobId === job.id, business.discoveryJobId));
  });
  businesses.forEach((business) => add("businessIntegrity", `${business.id} → discoveryJobId`, Boolean(getDiscoveryJob(business.discoveryJobId)), business.discoveryJobId));
  const duplicates = [...duplicateIds(jobs), ...duplicateIds(businesses), ...duplicateIds(mockModel.discoverySources)];
  add("uniqueIds", "تفرد معرفات Job وBusiness وSource", duplicates.length === 0, duplicates.length ? duplicates.join(", ") : "لا توجد معرفات مكررة");
  const pass = Object.values(checks).flat().every((check) => check.pass);
  return { pass, checks };
}

export const leadStatusLabels = { new:"جديد", contacted:"تم التواصل", qualified:"مؤهل", unqualified:"غير مؤهل", nurturing:"متابعة تدريجية" };
export const leadPriorityLabels = { high:"عالية", medium:"متوسطة", low:"منخفضة" };
export const CRM_REFERENCE_TIME = "2026-08-15T12:40:00";
export const CRM_ACTOR_ID = "USR-1001";
let crmMutationTick = 0;

export function getLead(leadId = state.selectedLeadId) { return findById(mockModel.leads, leadId); }
export function getLeadByBusinessId(businessId) { return mockModel.leads.find((lead) => lead.businessId === businessId); }
export function getLeadOwner(lead) { return lead && findById(mockModel.users, lead.ownerId); }
export function getLeadCompany(lead) { return lead && findById(mockModel.companies, lead.companyId); }
export function getLeadContacts(leadId) { return mockModel.contacts.filter((contact) => contact.leadId === leadId); }
export function getLeadNotes(leadId) { return mockModel.notes.filter((note) => note.leadId === leadId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getLeadTasks(leadId) { return mockModel.tasks.filter((task) => task.leadId === leadId).sort((a,b) => a.dueAt.localeCompare(b.dueAt)); }
export function getLeadActivities(leadId) { return mockModel.activities.filter((activity) => activity.leadId === leadId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getLeadActivitySummary(leadId) { const activities = getLeadActivities(leadId); const openTasks = getLeadTasks(leadId).filter((task) => task.status !== "completed"); return { latestActivity:activities[0] || null, nextTask:openTasks[0] || null, lastActivityAt:activities[0]?.createdAt || null, nextActivityAt:openTasks[0]?.dueAt || null }; }
export function getLeadDeals(leadId) { return mockModel.deals.filter((deal) => deal.leadId === leadId); }
export function getLeadConversations(leadId) { return mockModel.conversations.filter((conversation) => conversation.leadId === leadId); }

// S7 local-only inbox selectors and mutations. No API, webhook, automation, or AI sender is permitted in this boundary.
export const conversationStatusLabels = { open:"مفتوحة", closed:"مغلقة" };
export const messageDeliveryLabels = { queued:"قيد الإرسال — تجريبي", sent:"تم الإرسال — تجريبي", delivered:"تم التسليم — تجريبي", read:"مقروء", failed:"فشل الإرسال" };
export const S7_REFERENCE_TIME = "2026-08-15T12:50:00";
let inboxMutationTick = 0;
function nextInboxTimestamp() { inboxMutationTick += 1; return `2026-08-15T12:5${Math.floor(inboxMutationTick / 60)}:${String(inboxMutationTick % 60).padStart(2, "0")}`; }
export function getConversation(conversationId = state.selectedConversationId) { return findById(mockModel.conversations, conversationId); }
export function getConversationMessages(conversationId) { return mockModel.messages.filter((message) => message.conversationId === conversationId).sort((a,b) => a.createdAt.localeCompare(b.createdAt)); }
export function getConversationLatestMessage(conversation) { return conversation ? getConversationMessages(conversation.id).at(-1) || null : null; }
export function getConversationUnreadCount(conversation) { return conversation ? getConversationMessages(conversation.id).filter((message) => message.direction === "inbound" && message.status !== "read").length : 0; }
export function getConversationNeedsReply(conversation) { const latest = getConversationLatestMessage(conversation); return Boolean(conversation?.status === "open" && latest?.direction === "inbound"); }
export function getConversationContact(conversation) { return conversation?.contactId ? findById(mockModel.contacts, conversation.contactId) : null; }
export function getConversationLead(conversation) { return conversation ? getLead(conversation.leadId) : null; }
export function getConversationBusiness(conversation) { const lead = getConversationLead(conversation); return lead ? findById(businesses, lead.businessId) : null; }
export function getConversationActivities(conversationId) { return mockModel.conversationActivities.filter((activity) => activity.conversationId === conversationId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getConversationContext(conversationId) { const conversation = getConversation(conversationId); const lead = getConversationLead(conversation); const business = getConversationBusiness(conversation); const contact = getConversationContact(conversation); const job = lead ? getDiscoveryJob(lead.sourceJobId) : null; const source = job ? getDiscoverySource(job.sourceId) : null; return { conversation, lead, business, contact, deals:lead ? getLeadDeals(lead.id) : [], job, source }; }
function syncConversationDerived(conversation) { if (!conversation) return null; const latest = getConversationLatestMessage(conversation); conversation.lastMessageAt = latest?.createdAt || conversation.createdAt; conversation.unreadCount = getConversationUnreadCount(conversation); return conversation; }
function logConversationActivity(conversation, { type, actorId = CRM_ACTOR_ID, metadata = {}, createdAt = nextInboxTimestamp() }) { const activity = { id:nextNumericId("CVA", mockModel.conversationActivities), conversationId:conversation.id, leadId:conversation.leadId, actorId, type, createdAt, metadata }; mockModel.conversationActivities.push(activity); conversation.updatedAt = createdAt; return activity; }
export function getInboxSummary() { const items = mockModel.conversations; return { open:items.filter((conversation) => conversation.status === "open").length, unread:items.reduce((total, conversation) => total + getConversationUnreadCount(conversation), 0), needsReply:items.filter(getConversationNeedsReply).length, closed:items.filter((conversation) => conversation.status === "closed").length }; }
export function getInboxConversations(filters = state.inboxFilters) { const query = String(filters.search || "").trim().toLocaleLowerCase("ar"); const rows = mockModel.conversations.map((conversation) => { const lead = getConversationLead(conversation); const business = getConversationBusiness(conversation); const contact = getConversationContact(conversation); const latest = getConversationLatestMessage(conversation); const unreadCount = getConversationUnreadCount(conversation); const needsReply = getConversationNeedsReply(conversation); return { conversation:{ ...conversation, unreadCount }, lead, business, contact, latest, needsReply }; }).filter((row) => { const haystack=[row.business?.name,row.contact?.name,row.contact?.phone,row.lead?.id,row.conversation.id].filter(Boolean).join(" ").toLocaleLowerCase("ar"); const filter = filters.filter || "all"; const filterPass = filter === "all" || (filter === "unread" && row.conversation.unreadCount > 0) || (filter === "needs_reply" && row.needsReply) || (filter === "open" && row.conversation.status === "open") || (filter === "closed" && row.conversation.status === "closed"); return (!query || haystack.includes(query)) && filterPass && (filters.ownerId === "all" || row.conversation.assignedTo === filters.ownerId) && (filters.channel === "all" || row.conversation.channel === filters.channel); }); const sort = filters.sort || "latest"; return rows.sort((a,b) => { if (sort === "unread") return b.conversation.unreadCount - a.conversation.unreadCount || b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt); if (sort === "oldest_waiting") { const aw=a.needsReply ? 0 : 1; const bw=b.needsReply ? 0 : 1; return aw - bw || a.conversation.lastMessageAt.localeCompare(b.conversation.lastMessageAt); } return b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt); }); }
export function markConversationRead(conversationId) { const conversation = getConversation(conversationId); if (!conversation) return null; getConversationMessages(conversationId).filter((message) => message.direction === "inbound" && message.status !== "read").forEach((message) => { message.status="read"; }); syncConversationDerived(conversation); return conversation; }
export function sendMockMessage(conversationId, body, options = {}) { const conversation = getConversation(conversationId); const text = String(body || "").trim(); const attachment = options.attachment || null; const actorId = options.actorId || conversation?.assignedTo || CRM_ACTOR_ID; const assistance = options.assistance?.assistedBy === "copilot" ? { assistedBy:"copilot", suggestionId:options.assistance.suggestionId || null } : null; if (!conversation || conversation.status !== "open" || (!text && !attachment) || !findById(mockModel.users, actorId)) return null; const createdAt = nextInboxTimestamp(); const message = { id:nextNumericId("MSG", mockModel.messages), conversationId, direction:"outbound", senderType:"user", senderId:actorId, type:attachment?.type || "text", body:text || attachment?.name || "مرفق تجريبي", status:"queued", attachment:attachment ? { name:attachment.name, size:attachment.size, mime:attachment.mime } : undefined, assistance:assistance || undefined, createdAt }; mockModel.messages.push(message); syncConversationDerived(conversation); logConversationActivity(conversation, { type:"message_sent", actorId, createdAt, metadata:{ messageId:message.id, channel:conversation.channel, direction:message.direction, ...assistance } }); logLeadActivity(conversation.leadId, { type:"message_sent", actorId, createdAt, title:"أُرسلت رسالة بشرية", detail:"تم تسجيل رسالة صادرة داخل محادثة تجريبية.", metadata:{ conversationId, messageId:message.id, channel:conversation.channel, ...assistance } }); return message; }
export function advanceMockMessageStatus(messageId) { const message = findById(mockModel.messages, messageId); if (!message || message.direction !== "outbound") return null; if (message.status === "queued") message.status="sent"; else if (message.status === "sent") message.status="delivered"; else return message; message.statusUpdatedAt = nextInboxTimestamp(); return message; }
export function retryMockMessage(messageId, actorId = CRM_ACTOR_ID) { const message = findById(mockModel.messages, messageId); const conversation = message && getConversation(message.conversationId); if (!message || !conversation || message.direction !== "outbound" || message.status !== "failed" || !findById(mockModel.users, actorId)) return null; message.status="queued"; message.failureReason=""; message.senderType="user"; message.senderId=actorId; const createdAt=nextInboxTimestamp(); message.statusUpdatedAt=createdAt; logConversationActivity(conversation, { type:"message_retry", actorId, createdAt, metadata:{ messageId:message.id, channel:conversation.channel, direction:message.direction } }); logLeadActivity(conversation.leadId, { type:"message_retry", actorId, createdAt, title:"أُعيدت محاولة رسالة", detail:"أعيدت محاولة الرسالة الفاشلة محليًا من دون إنشاء رسالة جديدة.", metadata:{ conversationId:conversation.id, messageId:message.id } }); return message; }
export function closeConversation(conversationId, actorId = CRM_ACTOR_ID) { const conversation = getConversation(conversationId); if (!conversation || conversation.status !== "open") return null; if (getConversationUnreadCount(conversation) > 0) return { kind:"unread", conversation }; conversation.status="closed"; logConversationActivity(conversation, { type:"conversation_closed", actorId, metadata:{} }); return { kind:"closed", conversation }; }
export function reopenConversation(conversationId, actorId = CRM_ACTOR_ID) { const conversation = getConversation(conversationId); if (!conversation || conversation.status !== "closed") return null; conversation.status="open"; logConversationActivity(conversation, { type:"conversation_reopened", actorId, metadata:{} }); return conversation; }
export function assignConversation(conversationId, ownerId, actorId = CRM_ACTOR_ID) { const conversation = getConversation(conversationId); if (!conversation || !findById(mockModel.users, ownerId) || conversation.assignedTo === ownerId) return null; const fromOwnerId = conversation.assignedTo; conversation.assignedTo=ownerId; logConversationActivity(conversation, { type:"assignment_changed", actorId, metadata:{ fromOwnerId, toOwnerId:ownerId } }); return conversation; }

function nextNumericId(prefix, items) { return `${prefix}-${Math.max(1000, ...items.map((item) => Number(String(item.id).split("-")[1]) || 0)) + 1}`; }
function nextCrmTimestamp() { crmMutationTick += 1; return `2026-08-15T12:40:${String(crmMutationTick).padStart(2, "0")}`; }
function isOpenTask(task) { return task.status !== "completed"; }
export function refreshLeadActivityDates(leadId) {
  const lead = getLead(leadId);
  if (!lead) return null;
  const { latestActivity, nextTask } = getLeadActivitySummary(leadId);
  lead.lastActivityAt = latestActivity?.createdAt || lead.convertedAt || lead.createdAt;
  lead.nextActivityAt = nextTask?.dueAt || null;
  lead.updatedAt = lead.lastActivityAt;
  return lead;
}
function logLeadActivity(leadId, { type, title, detail, actorId = CRM_ACTOR_ID, metadata = {}, createdAt = nextCrmTimestamp() }) {
  const item = { id:nextNumericId("ACT", mockModel.activities), leadId, type, actorId, title, detail, metadata, createdAt };
  mockModel.activities.push(item);
  refreshLeadActivityDates(leadId);
  return item;
}

export function getCrmSummary() {
  const leads = mockModel.leads;
  const tasks = mockModel.tasks;
  return {
    total:leads.length,
    new:leads.filter((lead) => lead.status === "new").length,
    contacted:leads.filter((lead) => lead.status === "contacted").length,
    qualified:leads.filter((lead) => lead.status === "qualified").length,
    highPriority:leads.filter((lead) => lead.priority === "high").length,
    overdueTasks:tasks.filter((task) => task.status === "overdue").length,
    todayTasks:tasks.filter((task) => task.status === "pending" && task.dueAt.startsWith("2026-08-15")).length
  };
}

export function convertBusinessToLead(businessId, options = {}) {
  const business = findById(businesses, businessId);
  if (!business) return { kind:"missing", lead:null };
  const existing = getLeadByBusinessId(businessId);
  if (existing) { state.selectedLeadId = existing.id; return { kind:"duplicate", lead:existing }; }
  const job = getDiscoveryJob(business.discoveryJobId);
  if (!job) return { kind:"missing", lead:null };
  const company = { id:nextNumericId("CMP", mockModel.companies), businessId, name:business.name, status:"active", createdAt:CRM_REFERENCE_TIME };
  const lead = { id:nextNumericId("LEAD", mockModel.leads), businessId, companyId:company.id, ownerId:options.ownerId || "USR-1001", status:options.status || "new", priority:options.priority || "medium", tags:options.tags || [], sourceJobId:job.id, createdAt:CRM_REFERENCE_TIME, updatedAt:CRM_REFERENCE_TIME, lastActivityAt:CRM_REFERENCE_TIME, nextActivityAt:null, convertedAt:CRM_REFERENCE_TIME };
  mockModel.companies.push(company);
  mockModel.leads.push(lead);
  if (business.phone || business.email) mockModel.contacts.push({ id:nextNumericId("CON", mockModel.contacts), leadId:lead.id, companyId:company.id, businessId, name:business.name, title:"جهة اتصال رئيسية", phone:business.phone || "", email:business.email || "", status:"active", createdAt:CRM_REFERENCE_TIME });
  logLeadActivity(lead.id, { type:"conversion", title:"أضيفت Business إلى CRM", detail:`تم تحويل ${business.id} مع حفظ ${job.id} ومصدر الاكتشاف.`, actorId:options.actorId || CRM_ACTOR_ID, metadata:{ businessId, companyId:company.id, sourceJobId:job.id } });
  state.crmAdded = [...new Set([...state.crmAdded, lead.id])];
  state.selectedLeadId = lead.id;
  state.selectedBusinessId = businessId;
  return { kind:"created", lead };
}

export function assignLeadOwner(leadId, ownerId, options = {}) {
  const lead = getLead(leadId); const owner = findById(mockModel.users, ownerId);
  if (!lead || !owner) return null;
  const fromOwnerId = lead.ownerId;
  lead.ownerId = ownerId;
  logLeadActivity(leadId, { type:"owner_changed", actorId:options.actorId || CRM_ACTOR_ID, title:"تم تغيير المالك", detail:`أصبح المالك ${owner.name}.`, metadata:{ fromOwnerId, toOwnerId:ownerId, ...(options.metadata || {}) } }); return lead;
}

export function updateLeadStatus(leadId, status, options = {}) {
  const lead = getLead(leadId);
  if (!lead || !Object.hasOwn(leadStatusLabels, status)) return null;
  const fromStatus = lead.status;
  lead.status = status;
  logLeadActivity(leadId, { type:"status_changed", actorId:options.actorId || CRM_ACTOR_ID, title:"تم تحديث حالة Lead", detail:`الحالة الحالية: ${leadStatusLabels[status]}.`, metadata:{ fromStatus, toStatus:status, ...(options.metadata || {}) } }); return lead;
}

export function updateLeadPriority(leadId, priority, options = {}) {
  const lead = getLead(leadId);
  if (!lead || !Object.hasOwn(leadPriorityLabels, priority)) return null;
  const fromPriority = lead.priority;
  lead.priority = priority;
  logLeadActivity(leadId, { type:"priority_changed", actorId:options.actorId || CRM_ACTOR_ID, title:"تم تحديث أولوية Lead", detail:`الأولوية الحالية: ${leadPriorityLabels[priority]}.`, metadata:{ fromPriority, toPriority:priority, ...(options.metadata || {}) } }); return lead;
}

export function addLeadNote(leadId, body, authorId = "USR-1001") {
  const lead = getLead(leadId); if (!lead || !body?.trim()) return null;
  const note = { id:nextNumericId("NOTE", mockModel.notes), leadId, authorId, body:body.trim(), createdAt:CRM_REFERENCE_TIME };
  mockModel.notes.push(note); logLeadActivity(leadId, { type:"note_added", actorId:authorId, title:"أضيفت ملاحظة", detail:note.body, metadata:{ noteId:note.id } }); return note;
}

export function addLeadTask(leadId, values = {}) {
  const lead = getLead(leadId); if (!lead) return null;
  const dueAt = values.dueAt || "2026-08-16T10:00:00";
  const task = { id:nextNumericId("TSK", mockModel.tasks), leadId, status:"pending", ownerId:values.ownerId || lead.ownerId, priority:values.priority || lead.priority, type:values.type || "متابعة", title:values.title?.trim() || "متابعة جديدة", when:values.when || dueAt.slice(11,16), dueAt, createdAt:CRM_REFERENCE_TIME, completedAt:null, scheduleStatus:"قادم", route:`crm/leads/${leadId}` };
  mockModel.tasks.push(task); logLeadActivity(leadId, { type:"task_created", actorId:values.actorId || CRM_ACTOR_ID, title:"أُنشئت مهمة", detail:`${task.title} · ${task.when}`, metadata:{ taskId:task.id, dueAt:task.dueAt, ownerId:task.ownerId, ...(values.metadata || {}) } }); return task;
}

export function completeLeadTask(taskId) {
  const task = findById(mockModel.tasks, taskId); if (!task || task.status === "completed") return task || null;
  task.status = "completed"; task.completedAt = CRM_REFERENCE_TIME; task.scheduleStatus = "مكتملة";
  logLeadActivity(task.leadId, { type:"task_completed", title:"أُنجزت مهمة", detail:task.title, metadata:{ taskId:task.id, completedAt:task.completedAt } }); state.completedTaskIds = [...new Set([...state.completedTaskIds, task.id])]; return task;
}

export function getLeadIntegrityReport() {
  const checks = [];
  const add = (id, name, pass, detail) => checks.push({ id, name, pass, detail });
  const leads = mockModel.leads;
  add("A", "Business ≠ Lead", leads.every((lead) => findById(businesses, lead.businessId) && lead.id !== lead.businessId), "Lead تشير إلى Business ولا تكررها");
  add("B", "Duplicate Protection", new Set(leads.map((lead) => lead.businessId)).size === leads.length, "Business واحدة لا تملك Lead مكررة");
  add("C", "Lead References", leads.every((lead) => findById(mockModel.companies, lead.companyId) && findById(mockModel.users, lead.ownerId) && getDiscoveryJob(lead.sourceJobId)), "Business / Company / Owner / Job موجودة");
  add("D", "Lead Status", leads.every((lead) => Object.hasOwn(leadStatusLabels, lead.status)), "الحالات ضمن عقد S5");
  add("E", "Lead Priority", leads.every((lead) => Object.hasOwn(leadPriorityLabels, lead.priority)), "الأولوية ضمن عقد S5");
  add("F", "Timestamp ISO", [...leads, ...mockModel.tasks, ...mockModel.notes, ...mockModel.activities].every((item) => !item.createdAt || /^\d{4}-\d{2}-\d{2}T/.test(item.createdAt)), "الطوابع الزمنية ISO");
  add("G", "Contact References", mockModel.contacts.every((contact) => { const lead = getLead(contact.leadId); return lead && findById(mockModel.companies, contact.companyId) && contact.businessId === lead.businessId; }), "Contacts مرتبطة بـLead وCompany وBusiness");
  add("H", "Task References", mockModel.tasks.every((task) => getLead(task.leadId) && findById(mockModel.users, task.ownerId)), "Tasks مرتبطة بـLead وOwner");
  add("I", "Activity Contract", mockModel.activities.every((activity) => getLead(activity.leadId) && findById(mockModel.users, activity.actorId) && activity.metadata && typeof activity.metadata === "object"), "Timeline تحمل Lead وActor وMetadata");
  add("J", "Existing Lead", Boolean(getLead("LEAD-1042")?.businessId === "BUS-1042"), "LEAD-1042 محفوظة");
  add("L", "Activity Lifecycle", leads.every((lead) => { const summary = getLeadActivitySummary(lead.id); return lead.lastActivityAt === (summary.lastActivityAt || lead.convertedAt) && lead.nextActivityAt === summary.nextActivityAt; }), "last/next activity مشتقة من Timeline والمهام المفتوحة");
  const attribution = getAttributionIntegrityReport();
  add("K", "Revenue Regression", attribution.pass && attribution.attributionTotal === attribution.revenueSummary, `${attribution.attributionTotal} = ${attribution.revenueSummary}`);
  return { pass:checks.every((check) => check.pass), checks };
}

// S6 source-of-truth helpers: Deals own money, stage, probability and close state; Revenue/Attribution remain read-only from S2.
export const dealStatusLabels = { open:"مفتوحة", won:"رابحة", lost:"خاسرة" };
export const dealLossReasons = ["الميزانية غير متاحة", "اختيار مزود آخر", "تأجيل القرار", "عدم ملاءمة الاحتياج", "أخرى"];

export function getPipeline(pipelineId = "PIPE-1001") { return findById(mockModel.pipelines, pipelineId); }
export function getPipelineStages(pipelineId = "PIPE-1001") { return mockModel.pipelineStages.filter((stage) => stage.pipelineId === pipelineId).sort((a,b) => a.order - b.order); }
export function getDeal(dealId = state.selectedDealId) { return findById(mockModel.deals, dealId); }
export function getDealStage(deal) { return deal && findById(mockModel.pipelineStages, deal.stageId); }
export function getDealProbability(deal) { return Number.isFinite(deal?.probability) ? deal.probability : (getDealStage(deal)?.defaultProbability ?? 0); }
export function isDealProbabilityManual(deal) { return Number.isFinite(deal?.probabilityOverride); }
export function getOpenDealsForLead(leadId) { return mockModel.deals.filter((deal) => deal.leadId === leadId && deal.status === "open"); }
export function getOpenDealForLead(leadId) { return getOpenDealsForLead(leadId)[0] || null; }
export function getDealLead(deal) { return deal && getLead(deal.leadId); }
export function getDealBusiness(deal) { const lead = getDealLead(deal); return lead && findById(businesses, lead.businessId); }
export function getDealActivities(dealId) { return mockModel.activities.filter((activity) => activity.metadata?.dealId === dealId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getDealTasks(dealId) { return mockModel.tasks.filter((task) => task.dealId === dealId).sort((a,b) => a.dueAt.localeCompare(b.dueAt)); }

function nextDealTimestamp() { crmMutationTick += 1; return new Date(Date.UTC(2026, 7, 15, 13, 10, crmMutationTick)).toISOString().replace(".000Z", ""); }
function logDealActivity(deal, { type, title, detail, actorId = CRM_ACTOR_ID, metadata = {} }) {
  const item = { id:nextNumericId("ACT", mockModel.activities), leadId:deal.leadId, actorId, type, title, detail, metadata:{ ...metadata, dealId:deal.id }, createdAt:nextDealTimestamp() };
  mockModel.activities.push(item);
  deal.lastActivityAt = item.createdAt;
  deal.updatedAt = item.createdAt;
  refreshLeadActivityDates(deal.leadId);
  return item;
}

export function getOpenPipelineMetrics(pipelineId = "PIPE-1001") {
  const deals = mockModel.deals.filter((deal) => deal.pipelineId === pipelineId && deal.status === "open");
  const openPipelineValue = deals.reduce((sum, deal) => sum + deal.value, 0);
  const weightedPipelineValue = deals.reduce((sum, deal) => sum + deal.value * getDealProbability(deal) / 100, 0);
  return { openDealCount:deals.length, openPipelineValue, weightedPipelineValue, averageProbability:deals.length ? Math.round(deals.reduce((sum, deal) => sum + getDealProbability(deal), 0) / deals.length) : 0, deals };
}

export function getPipelineMetrics(pipelineId = "PIPE-1001") { const metrics = getOpenPipelineMetrics(pipelineId); return { dealCount:metrics.openDealCount, totalValue:metrics.openPipelineValue, weightedValue:metrics.weightedPipelineValue, averageProbability:metrics.averageProbability }; }

export function getPipelineStageSummary(pipelineId = "PIPE-1001") {
  return getPipelineStages(pipelineId).map((stage) => {
    const deals = mockModel.deals.filter((deal) => deal.pipelineId === pipelineId && deal.stageId === stage.id && deal.status === "open");
    const value = deals.reduce((sum, deal) => sum + deal.value, 0);
    const weightedValue = deals.reduce((sum, deal) => sum + deal.value * getDealProbability(deal) / 100, 0);
    return { stage, deals, count:deals.length, value, weightedValue };
  });
}

function validateDealValue(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null; }
function resolveDealProbability(value) { if (value === "" || value === null || value === undefined || value === "default") return null; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : null; }
function findOpenDealDuplicate(leadId, values = {}) { const key = getDealDuplicateKey(values); return mockModel.deals.find((deal) => deal.leadId === leadId && deal.status === "open" && getDealDuplicateKey(deal) === key) || null; }

export function createDeal(leadId, values = {}) {
  const lead = getLead(leadId); const pipelineId = values.pipelineId || "PIPE-1001"; const stageId = values.stageId || "STG-1001"; const stage = findById(mockModel.pipelineStages, stageId); const amount = validateDealValue(values.value); const title = values.title?.trim() || values.name?.trim() || `فرصة ${getDealBusiness({leadId})?.short || lead?.id || ""}`; const ownerId = values.ownerId || lead?.ownerId; const expectedCloseAt = values.expectedCloseAt || "2026-08-31"; const manualProbability = resolveDealProbability(values.probability);
  if (!lead || !getPipeline(pipelineId) || !stage || stage.pipelineId !== pipelineId || stage.kind !== "open" || !amount || !title || !findById(mockModel.users, ownerId) || !isIsoDate(expectedCloseAt) || (values.probability !== undefined && values.probability !== "default" && manualProbability === null)) return { kind:"invalid", deal:null };
  const existing = findOpenDealDuplicate(leadId, { ...values, title }); if (existing) { state.selectedDealId = existing.id; return { kind:"duplicate", deal:existing }; }
  const createdAt = nextDealTimestamp(); const probability = manualProbability === null ? stage.defaultProbability : manualProbability;
  const deal = { id:nextNumericId("DEAL", mockModel.deals), leadId, ownerId, pipelineId, stageId, title, name:title, serviceId:values.serviceId || null, value:amount, currency:"SAR", probability, probabilityOverride:manualProbability, expectedCloseAt, status:"open", createdAt, updatedAt:createdAt, lastActivityAt:createdAt, wonAt:null, lostAt:null, closedAt:null, lossReason:null };
  mockModel.deals.push(deal);
  logDealActivity(deal, { type:"deal_created", title:"أُنشئت صفقة", detail:`${deal.title} بقيمة ${deal.value} ر.س.`, metadata:{ stageId:deal.stageId, value:deal.value, probability:deal.probability, serviceId:deal.serviceId } });
  state.selectedDealId = deal.id;
  return { kind:"created", deal };
}

export function updateDeal(dealId, values = {}) {
  const deal = getDeal(dealId); if (!deal || deal.status !== "open") return null;
  const stage = getDealStage(deal); const nextValue = values.value === undefined ? deal.value : validateDealValue(values.value); const wantsReset = values.probability === "default"; const explicitProbability = values.probability === undefined || wantsReset ? null : resolveDealProbability(values.probability); const nextProbability = values.probability === undefined ? deal.probability : (wantsReset ? stage?.defaultProbability : explicitProbability); const nextExpectedCloseAt = values.expectedCloseAt === undefined ? deal.expectedCloseAt : values.expectedCloseAt; const nextOwnerId = values.ownerId || deal.ownerId; const nextTitle = values.title?.trim() || values.name?.trim() || deal.title;
  if (!nextValue || !Number.isFinite(nextProbability) || !isIsoDate(nextExpectedCloseAt) || !findById(mockModel.users, nextOwnerId) || !nextTitle) return null;
  const previousValue = deal.value; const previousProbability = deal.probability; const previousExpectedCloseAt = deal.expectedCloseAt; const previousTitle = deal.title; const previousOwnerId = deal.ownerId; const previousServiceId = deal.serviceId;
  deal.title = nextTitle; deal.name = nextTitle; deal.value = nextValue; deal.probability = nextProbability; deal.probabilityOverride = values.probability === undefined ? deal.probabilityOverride : (wantsReset ? null : explicitProbability); deal.ownerId = nextOwnerId; deal.expectedCloseAt = nextExpectedCloseAt; deal.serviceId = values.serviceId === undefined ? deal.serviceId : (values.serviceId || null);
  if (previousValue !== deal.value) logDealActivity(deal, { type:"value_changed", title:"تغيرت قيمة الصفقة", detail:`القيمة الجديدة ${deal.value} ر.س.`, metadata:{ from:previousValue, to:deal.value, currency:deal.currency } });
  if (previousProbability !== deal.probability) logDealActivity(deal, { type:"probability_changed", title:"تغير احتمال الصفقة", detail:`الاحتمال الحالي ${deal.probability}%.`, metadata:{ from:previousProbability, to:deal.probability, reason:wantsReset ? "stage_default" : "manual_override" } });
  if (previousExpectedCloseAt !== deal.expectedCloseAt) logDealActivity(deal, { type:"close_date_changed", title:"تغير تاريخ الإغلاق المتوقع", detail:`التاريخ الحالي ${deal.expectedCloseAt}.`, metadata:{ from:previousExpectedCloseAt, to:deal.expectedCloseAt } });
  if (previousTitle !== deal.title) logDealActivity(deal, { type:"title_changed", title:"تغير عنوان الصفقة", detail:`العنوان الحالي ${deal.title}.`, metadata:{ from:previousTitle, to:deal.title } });
  if (previousOwnerId !== deal.ownerId) logDealActivity(deal, { type:"owner_changed", title:"تغير مالك الصفقة", detail:"تم إسناد الصفقة إلى مالك جديد.", metadata:{ from:previousOwnerId, to:deal.ownerId } });
  if (previousServiceId !== deal.serviceId) logDealActivity(deal, { type:"service_changed", title:"تغيرت الخدمة المرجعية", detail:"تم تحديث الخدمة المرجعية للصفقة.", metadata:{ from:previousServiceId, to:deal.serviceId } });
  return deal;
}

export function moveDealStage(dealId, stageId) {
  const deal = getDeal(dealId); const stage = findById(mockModel.pipelineStages, stageId); if (!deal || !stage || deal.status !== "open" || stage.pipelineId !== deal.pipelineId || stage.kind !== "open" || stage.id === deal.stageId) return null;
  const fromStageId = deal.stageId; const previousProbability = deal.probability; deal.stageId = stage.id;
  if (deal.probabilityOverride === null) deal.probability = stage.defaultProbability;
  logDealActivity(deal, { type:"stage_changed", title:"انتقلت الصفقة إلى مرحلة جديدة", detail:`المرحلة الحالية: ${stage.name}.`, metadata:{ fromStageId, toStageId:stage.id } });
  if (previousProbability !== deal.probability) logDealActivity(deal, { type:"probability_changed", title:"تغير الاحتمال مع المرحلة", detail:`الاحتمال الحالي ${deal.probability}%.`, metadata:{ from:previousProbability, to:deal.probability, reason:"stage_default" } });
  return deal;
}

export function closeDealAsWon(dealId, confirmed = false) {
  const deal = getDeal(dealId); const wonStage = mockModel.pipelineStages.find((stage) => stage.pipelineId === deal?.pipelineId && stage.kind === "won"); if (!deal || !wonStage || deal.status !== "open" || !confirmed) return null;
  const closedAt = nextDealTimestamp(); const fromStageId = deal.stageId; const previousProbability = deal.probability;
  deal.status="won"; deal.stageId=wonStage.id; deal.probability=100; deal.probabilityOverride=null; deal.wonAt=closedAt; deal.lostAt=null; deal.lossReason=null; deal.closedAt=closedAt;
  logDealActivity(deal, { type:"deal_won", title:"أُغلقت الصفقة كرابحة", detail:"لم يُنشأ RevenueEvent في S6؛ الإغلاق حالة CRM فقط.", metadata:{ fromStageId, toStageId:wonStage.id, fromProbability:previousProbability, toProbability:100, wonAt:deal.wonAt } });
  return deal;
}

export function closeDealAsLost(dealId, lossReason, confirmed = false) {
  const deal = getDeal(dealId); const lostStage = mockModel.pipelineStages.find((stage) => stage.pipelineId === deal?.pipelineId && stage.kind === "lost"); if (!deal || !lostStage || deal.status !== "open" || !confirmed || !lossReason) return null;
  const reason = lossReason.trim(); if (!reason) return null;
  const closedAt = nextDealTimestamp(); const fromStageId = deal.stageId; const previousProbability = deal.probability;
  deal.status="lost"; deal.stageId=lostStage.id; deal.probability=0; deal.probabilityOverride=null; deal.lossReason=reason; deal.lostAt=closedAt; deal.wonAt=null; deal.closedAt=closedAt;
  logDealActivity(deal, { type:"deal_lost", title:"أُغلقت الصفقة كخاسرة", detail:`سبب الخسارة: ${reason}.`, metadata:{ fromStageId, toStageId:lostStage.id, fromProbability:previousProbability, toProbability:0, lossReason:reason, lostAt:deal.lostAt } });
  return deal;
}

export function getDealIntegrityReport() {
  const checks=[]; const add=(id, name, pass, detail)=>checks.push({ id, name, pass, detail }); const deals=mockModel.deals;
  add("A", "تفرد Deals", duplicateIds(deals).length === 0, "لا توجد معرفات Deals مكررة");
  add("B", "مراجع Deal", deals.every((deal) => getLead(deal.leadId) && getPipeline(deal.pipelineId) && getDealStage(deal) && findById(mockModel.users, deal.ownerId)), "Lead/Pipeline/Stage/Owner موجودة");
  add("C", "قيمة مالية آمنة", deals.every((deal) => Number.isFinite(deal.value) && deal.value > 0 && deal.currency === "SAR"), "القيمة موجبة والعملة SAR");
  add("D", "احتمال صحيح", deals.every((deal) => getDealProbability(deal) >= 0 && getDealProbability(deal) <= 100), "الاحتمال ضمن 0–100");
  add("E", "مرحلة وحالة متسقتان", deals.every((deal) => { const stage=getDealStage(deal); return stage && (deal.status === "open" ? stage.kind === "open" : stage.kind === deal.status); }), "الحالة تطابق stage terminal/open");
  add("F", "Won لا تنشئ Revenue", mockModel.revenueEvents.every((event) => deals.some((deal) => deal.id === event.dealId && deal.status === "won")), "Revenue baseline فقط مرتبطة بصفقات won");
  add("G", "إسناد S2 محفوظ", getAttributionIntegrityReport().pass, "Revenue attribution unchanged");
  add("H", "Pipeline totals مشتقة", getPipelineMetrics().totalValue === mockModel.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.value, 0), "قيمة pipeline من Deals المفتوحة");
  return { pass:checks.every((check) => check.pass), checks };
}

// S9 automation is an event evaluation simulation only. It has no scheduler, worker, webhook, API, or background execution.
export const automationRuleStatusLabels = { enabled:"مفعلة", disabled:"معطلة", draft:"مسودة" };
export const automationRunStatusLabels = { evaluating:"قيد التقييم", matched:"مطابقة", skipped:"تم التخطي", awaiting_approval:"تحتاج موافقة", executed:"تم التنفيذ", failed:"فشل", cancelled:"ملغاة" };
export const automationActionStatusLabels = { proposed:"مقترح", awaiting_approval:"تحتاج موافقة", approved:"تمت الموافقة", rejected:"مرفوض", executed:"تم التنفيذ", failed:"فشل", blocked:"محظور" };
export const appointmentStatusLabels = { scheduled:"مجدول", completed:"مكتمل", cancelled:"ملغي", no_show:"لم يحضر" };
export const appointmentTypeLabels = { call:"اتصال", meeting:"اجتماع", demo:"عرض توضيحي", follow_up:"متابعة" };
export const appointmentLocationLabels = { phone:"هاتف", online:"عن بعد", office:"مكتب", other:"أخرى" };

export const automationTriggerCatalog = [
  { id:"lead_created", label:"يُنشأ عميل محتمل", entityType:"lead" }, { id:"lead_status_changed", label:"تتغير حالة العميل", entityType:"lead" },
  { id:"lead_priority_changed", label:"تتغير أولوية العميل", entityType:"lead" }, { id:"task_completed", label:"تكتمل مهمة", entityType:"task" },
  { id:"deal_created", label:"تُنشأ صفقة", entityType:"deal" }, { id:"deal_stage_changed", label:"تتغير مرحلة الصفقة", entityType:"deal" },
  { id:"conversation_needs_reply", label:"تحتاج محادثة إلى رد", entityType:"conversation" }, { id:"conversation_closed", label:"تُغلق محادثة", entityType:"conversation" },
  { id:"agent_action_executed", label:"ينفذ الوكيل إجراء", entityType:"agent_action" }, { id:"appointment_completed", label:"يكتمل موعد", entityType:"appointment" },
  { id:"appointment_no_show", label:"لا يحضر العميل الموعد", entityType:"appointment" }, { id:"manual", label:"تشغيل يدوي", entityType:"manual" }
];
export const automationOperators = ["equals", "not_equals", "greater_than", "less_than", "contains", "is_known", "is_unknown"];
export const automationConditionFieldCatalog = [
  { field:"lead.priority", label:"أولوية العميل", entityType:"lead", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["high","medium","low"] },
  { field:"lead.status", label:"حالة العميل", entityType:"lead", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["new","qualified","contacted","nurturing","unqualified","customer"] },
  { field:"conversation.needs_reply", label:"المحادثة تحتاج ردًا", entityType:"conversation", dataType:"boolean", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["true","false"] },
  { field:"conversation.status", label:"حالة المحادثة", entityType:"conversation", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["open","closed"] },
  { field:"deal.stage", label:"مرحلة الصفقة", entityType:"deal", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["new","contacted","qualified","meeting","proposal","negotiation","won","lost"] },
  { field:"deal.status", label:"حالة الصفقة", entityType:"deal", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["open","won","lost"] },
  { field:"deal.value", label:"قيمة الصفقة", entityType:"deal", dataType:"number", operators:["equals","greater_than","less_than","is_known","is_unknown"] },
  { field:"task.status", label:"حالة المهمة", entityType:"task", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["pending","completed"] },
  { field:"appointment.status", label:"حالة الموعد", entityType:"appointment", dataType:"enum", operators:["equals","not_equals","is_known","is_unknown"], allowedValues:["scheduled","completed","cancelled","no_show"] }
];
export const automationOperatorLabels = { equals:"يساوي", not_equals:"لا يساوي", greater_than:"أكبر من", less_than:"أقل من", contains:"يتضمن", is_known:"معلوم", is_unknown:"غير معلوم" };
export const automationActionCatalog = [
  { id:"AUTOACT-1001", type:"create_followup_task", label:"إنشاء مهمة متابعة", safety:"auto_safe" },
  { id:"AUTOACT-1002", type:"create_task", label:"إنشاء مهمة", safety:"auto_safe" },
  { id:"AUTOACT-1003", type:"create_appointment", label:"اقتراح موعد", safety:"approval_required" },
  { id:"AUTOACT-1004", type:"update_lead_priority", label:"تحديث أولوية العميل", safety:"approval_required" },
  { id:"AUTOACT-1005", type:"update_lead_status", label:"تحديث حالة العميل", safety:"approval_required" },
  { id:"AUTOACT-1006", type:"assign_lead", label:"إسناد العميل", safety:"approval_required" },
  { id:"AUTOACT-1007", type:"notify_in_app_mock", label:"تنبيه داخل المنصة — تجريبي", safety:"auto_safe" },
  { id:"AUTOACT-1008", type:"escalate_to_human", label:"تصعيد إلى مسؤول", safety:"approval_required" }
];
export const forbiddenAutomationActions = ["send_message", "send_whatsapp", "change_deal_value", "change_deal_probability", "close_won_deal", "close_lost_deal", "create_revenue", "create_attribution", "delete_lead"];
export const automationApprovalPolicies = ["auto_safe", "approval_required", "manual_only"];
export const AUTOMATION_REFERENCE_TIME = "2026-08-15T13:20:00";
let automationMutationTick = 0;

mockModel.automationConditionGroups = [
  { id:"COND-1001", logic:"AND", conditions:[{ field:"lead.priority", operator:"equals", value:"high" }] },
  { id:"COND-1002", logic:"AND", conditions:[{ field:"lead.status", operator:"not_equals", value:"unqualified" }] },
  { id:"COND-1003", logic:"AND", conditions:[{ field:"deal.stage", operator:"equals", value:"proposal" }] },
  { id:"COND-1004", logic:"AND", conditions:[{ field:"lead.status", operator:"equals", value:"qualified" }] },
  { id:"COND-1005", logic:"AND", conditions:[{ field:"lead.priority", operator:"equals", value:"low" }] }
];
mockModel.automationActions = [
  { id:"AUTOACT-1001", type:"create_followup_task", payload:{ title:"متابعة العميل عالي الأولوية", duration:{ value:24, unit:"hours" }, priority:"high", type:"متابعة" } },
  { id:"AUTOACT-1002", type:"create_task", payload:{ title:"متابعة محادثة تحتاج ردًا", duration:{ value:4, unit:"hours" }, priority:"medium", type:"متابعة واتساب" } },
  { id:"AUTOACT-1003", type:"create_appointment", payload:{ title:"موعد مراجعة العرض", duration:{ value:1, unit:"days" }, appointmentDurationMinutes:30, appointmentType:"meeting", locationType:"online", location:"رابط تجريبي محلي" } },
  { id:"AUTOACT-1004", type:"update_lead_priority", payload:{ priority:"high" } },
  { id:"AUTOACT-1005", type:"update_lead_status", payload:{ status:"contacted" } },
  { id:"AUTOACT-1006", type:"assign_lead", payload:{ ownerId:"USR-1002" } },
  { id:"AUTOACT-1007", type:"notify_in_app_mock", payload:{ title:"تذكير متابعة تجريبي" } },
  { id:"AUTOACT-1008", type:"escalate_to_human", payload:{ title:"يحتاج هذا العميل مراجعة بشرية" } }
];
mockModel.automations = [
  { id:"AUTO-1001", name:"Lead عالي الأولوية → مهمة متابعة", status:"enabled", triggerType:"lead_created", conditionGroupId:"COND-1001", actionIds:["AUTOACT-1001"], approvalPolicy:"auto_safe", createdBy:"USR-1001", createdAt:"2026-08-15T09:00:00", updatedAt:"2026-08-15T09:00:00", version:1 },
  { id:"AUTO-1002", name:"محادثة تحتاج ردًا → متابعة", status:"enabled", triggerType:"conversation_needs_reply", conditionGroupId:"COND-1002", actionIds:["AUTOACT-1002"], approvalPolicy:"auto_safe", createdBy:"USR-1001", createdAt:"2026-08-15T09:02:00", updatedAt:"2026-08-15T09:02:00", version:1 },
  { id:"AUTO-1003", name:"عرض الصفقة → اقتراح موعد", status:"enabled", triggerType:"deal_stage_changed", conditionGroupId:"COND-1003", actionIds:["AUTOACT-1003"], approvalPolicy:"approval_required", createdBy:"USR-1001", createdAt:"2026-08-15T09:04:00", updatedAt:"2026-08-15T09:04:00", version:1 },
  { id:"AUTO-1004", name:"Lead مؤهل → رفع الأولوية", status:"enabled", triggerType:"lead_status_changed", conditionGroupId:"COND-1004", actionIds:["AUTOACT-1004"], approvalPolicy:"approval_required", createdBy:"USR-1001", createdAt:"2026-08-15T09:06:00", updatedAt:"2026-08-15T09:06:00", version:1 },
  { id:"AUTO-1005", name:"قاعدة متابعة معطلة", status:"disabled", triggerType:"lead_created", conditionGroupId:"COND-1001", actionIds:["AUTOACT-1001"], approvalPolicy:"auto_safe", createdBy:"USR-1001", createdAt:"2026-08-15T09:08:00", updatedAt:"2026-08-15T09:08:00", version:1 },
  { id:"AUTO-1006", name:"قاعدة مسودة للمراجعة", status:"draft", triggerType:"conversation_needs_reply", conditionGroupId:"COND-1002", actionIds:["AUTOACT-1002"], approvalPolicy:"auto_safe", createdBy:"USR-1001", createdAt:"2026-08-15T09:10:00", updatedAt:"2026-08-15T09:10:00", version:1 },
  { id:"AUTO-1007", name:"تنبيه تشغيل يدوي", status:"enabled", triggerType:"manual", conditionGroupId:null, actionIds:["AUTOACT-1007"], approvalPolicy:"auto_safe", createdBy:"USR-1001", createdAt:"2026-08-15T09:12:00", updatedAt:"2026-08-15T09:12:00", version:1 }
];
mockModel.automationRuns = [
  { id:"AUTORUN-1001", automationRuleId:"AUTO-1002", automationRuleVersion:1, ruleNameSnapshot:"محادثة تحتاج ردًا → متابعة", triggerSnapshot:"conversation_needs_reply", actionSnapshot:["create_task"], triggerEventType:"conversation_needs_reply", triggerEntityType:"conversation", triggerEntityId:"CONV-3042", triggeredAt:"2026-08-15T12:20:00", status:"failed", matchedConditions:true, proposedActionIds:["AUTOACT-1002"], startedAt:"2026-08-15T12:20:00", completedAt:"2026-08-15T12:20:01", createdAt:"2026-08-15T12:20:00", idempotencyKey:"fixture:failed", failureReason:"فشل تجريبي مضبوط: owner للمهمة غير متاح.", origin:"fixture" }
];
mockModel.automationActionExecutions = [
  { id:"AUTOEXEC-1001", automationRunId:"AUTORUN-1001", actionId:"AUTOACT-1002", actionType:"create_task", status:"failed", payload:{ simulateFailure:true }, requiresApproval:false, approvedBy:null, approvedAt:null, rejectedBy:null, rejectedAt:null, executedAt:null, resultEntityId:null, failureReason:"فشل تجريبي مضبوط: owner للمهمة غير متاح." }
];
mockModel.automationActivities = [];
mockModel.automationNotifications = [];

function nextAutomationTimestamp() { automationMutationTick += 1; return new Date(Date.UTC(2026, 7, 15, 13, 20, automationMutationTick)).toISOString().replace(".000Z", ""); }
function getAutomationStageKey(deal) { const stage = getDealStage(deal); return ({ "STG-1001":"new", "STG-1002":"contacted", "STG-1003":"qualified", "STG-1004":"meeting", "STG-1005":"proposal", "STG-1006":"negotiation", "STG-1007":"won", "STG-1008":"lost" })[stage?.id] || null; }
function getAutomationDurationMs(duration = {}) { const value = Number(duration.value || 0); const unit = duration.unit || "hours"; return value * ({ minutes:60000, hours:3600000, days:86400000 }[unit] || 0); }
/* الطوابع الزمنية في الـfixtures نصوص wall-clock بلا منطقة زمنية. تُحلَّل صراحة كـUTC
   حتى لا يطرح `new Date(naive).toISOString()` فارق التوقيت المحلي عند كل تحويل. */
function parseAutomationInstant(value) { const text = String(value || "").trim(); return new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`); }
function formatAutomationInstant(date) { return date.toISOString().slice(0, 19); }
function automationDateAfter(start, duration) { return formatAutomationInstant(new Date(parseAutomationInstant(start).getTime() + getAutomationDurationMs(duration))); }
function isAutomationIso(value) { return /^\d{4}-\d{2}-\d{2}T/.test(String(value || "")) && !Number.isNaN(Date.parse(value)); }
function getAutomationRuleAction(actionId) { return findById(mockModel.automationActions, actionId); }
function getAutomationRuleConditionGroup(conditionGroupId) { return findById(mockModel.automationConditionGroups, conditionGroupId); }
function getAutomationRuleTrigger(triggerType) { return automationTriggerCatalog.find((trigger) => trigger.id === triggerType); }
export function getAutomationConditionField(field) { return automationConditionFieldCatalog.find((item) => item.field === field); }
export function validateAutomationCondition(condition = {}) {
  const field = getAutomationConditionField(condition.field); const operator = condition.operator; const value = condition.value;
  if (!field) return { valid:false, reason:"حقل الشرط غير مدعوم في عقد الأتمتة." };
  if (!field.operators.includes(operator)) return { valid:false, reason:"المعامل غير مدعوم لهذا الحقل." };
  if (["is_known","is_unknown"].includes(operator)) return { valid:true, value:null };
  if (field.dataType === "enum" && !field.allowedValues.includes(String(value))) return { valid:false, reason:"قيمة الشرط غير مدعومة لهذا الحقل." };
  if (field.dataType === "boolean" && !field.allowedValues.includes(String(value))) return { valid:false, reason:"قيمة الشرط المنطقي يجب أن تكون true أو false." };
  if (field.dataType === "number" && !Number.isFinite(Number(value))) return { valid:false, reason:"قيمة الشرط العددية غير صالحة." };
  return { valid:true, value:field.dataType === "number" ? Number(value) : String(value) };
}
export function validateAutomationConditionGroup(group) { if (!group) return { valid:true, reason:null }; if (!["AND","OR"].includes(group.logic) || !Array.isArray(group.conditions) || !group.conditions.length) return { valid:false, reason:"مجموعة الشروط غير صالحة." }; const invalid = group.conditions.map(validateAutomationCondition).find((result) => !result.valid); return invalid || { valid:true, reason:null }; }
export function formatAutomationCondition(condition = {}) { const field=getAutomationConditionField(condition.field); const validation=validateAutomationCondition(condition); if (!field || !validation.valid) return "شرط غير صالح"; if (condition.operator === "is_known") return `${field.label} معلوم`; if (condition.operator === "is_unknown") return `${field.label} غير معلوم`; return `${field.label} ${automationOperatorLabels[condition.operator] || condition.operator} ${validation.value}`; }
function getAutomationRuleContractValidation(rule) { const trigger=getAutomationRuleTrigger(rule?.triggerType); const actions=(rule?.actionIds || []).map(getAutomationRuleAction); const group=getAutomationRuleConditionGroup(rule?.conditionGroupId); const conditionValidation=validateAutomationConditionGroup(group); return { valid:Boolean(trigger && actions.length && actions.every(Boolean) && automationApprovalPolicies.includes(rule?.approvalPolicy) && conditionValidation.valid), reason:conditionValidation.reason }; }

export function getAutomationRule(ruleId = state.selectedAutomationId) { return findById(mockModel.automations, ruleId); }
export function getAutomationRules(filters = state.automationFilters) {
  const query = String(filters.search || "").trim().toLocaleLowerCase("ar");
  return [...mockModel.automations].filter((rule) => (!query || rule.name.toLocaleLowerCase("ar").includes(query) || rule.id.toLocaleLowerCase("ar").includes(query)) && (filters.status === "all" || rule.status === filters.status) && (filters.trigger === "all" || rule.triggerType === filters.trigger)).sort((a,b) => (filters.sort === "name" ? a.name.localeCompare(b.name, "ar") : b.updatedAt.localeCompare(a.updatedAt)));
}
export function getAutomationRuns(ruleId = null) { return mockModel.automationRuns.filter((run) => !ruleId || run.automationRuleId === ruleId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getAutomationRunActionExecutions(runId) { return mockModel.automationActionExecutions.filter((execution) => execution.automationRunId === runId); }
export function getAutomationApprovalQueue() { return mockModel.automationActionExecutions.filter((execution) => execution.status === "awaiting_approval").sort((a,b) => (getAutomationRuns().find((run) => run.id === b.automationRunId)?.createdAt || "").localeCompare(getAutomationRuns().find((run) => run.id === a.automationRunId)?.createdAt || "")); }
export function getAutomationMetrics() { const runs = mockModel.automationRuns; return { totalRules:mockModel.automations.length, enabled:mockModel.automations.filter((rule) => rule.status === "enabled").length, runsToday:runs.filter((run) => run.createdAt.startsWith("2026-08-15")).length, successful:runs.filter((run) => run.status === "executed").length, awaitingApproval:runs.filter((run) => run.status === "awaiting_approval").length, failed:runs.filter((run) => run.status === "failed").length }; }
export function getAppointment(appointmentId) { return findById(mockModel.appointments, appointmentId); }
export function getLeadAppointments(leadId) { return mockModel.appointments.filter((appointment) => appointment.leadId === leadId).sort((a,b) => a.startsAt.localeCompare(b.startsAt)); }
export function getDealAppointments(dealId) { return mockModel.appointments.filter((appointment) => appointment.dealId === dealId).sort((a,b) => a.startsAt.localeCompare(b.startsAt)); }
export function getAppointments(filters = state.appointmentFilters) { return [...mockModel.appointments].filter((appointment) => (filters.status === "all" || appointment.status === filters.status) && (filters.ownerId === "all" || appointment.ownerId === filters.ownerId) && (filters.type === "all" || appointment.type === filters.type) && (filters.date === "all" || appointment.startsAt.startsWith(filters.date))).sort((a,b) => (filters.sort === "latest" ? b.startsAt.localeCompare(a.startsAt) : filters.sort === "created" ? b.createdAt.localeCompare(a.createdAt) : a.startsAt.localeCompare(b.startsAt))); }
export function getTasksWorkspace(filters = state.taskFilters) { const query = String(filters.search || "").trim().toLocaleLowerCase("ar"); return [...mockModel.tasks].filter((task) => (!query || `${task.title} ${task.id}`.toLocaleLowerCase("ar").includes(query)) && (filters.status === "all" || task.status === filters.status) && (filters.ownerId === "all" || task.ownerId === filters.ownerId) && (filters.leadId === "all" || task.leadId === filters.leadId) && (filters.origin === "all" || (filters.origin === "automation" ? Boolean(task.createdByAutomationRunId) : !task.createdByAutomationRunId)) && (filters.due === "all" || (filters.due === "today" && task.dueAt.startsWith("2026-08-15")) || (filters.due === "overdue" && task.dueAt < "2026-08-15T12:40:00" && task.status !== "completed") || (filters.due === "upcoming" && task.dueAt >= "2026-08-16"))).sort((a,b) => (filters.sort === "created" ? b.createdAt.localeCompare(a.createdAt) : a.dueAt.localeCompare(b.dueAt))); }

export function buildAutomationContext(triggerEvent = {}) {
  const conversation = triggerEvent.entityType === "conversation" ? getConversation(triggerEvent.entityId) : null;
  const deal = triggerEvent.entityType === "deal" ? getDeal(triggerEvent.entityId) : null;
  const task = triggerEvent.entityType === "task" ? findById(mockModel.tasks, triggerEvent.entityId) : null;
  const appointment = triggerEvent.entityType === "appointment" ? getAppointment(triggerEvent.entityId) : null;
  const lead = triggerEvent.entityType === "lead" ? getLead(triggerEvent.entityId) : getLead(conversation?.leadId || deal?.leadId || task?.leadId || appointment?.leadId || triggerEvent.leadId);
  return { triggerEvent, lead, conversation, deal, task, appointment, business:lead ? findById(businesses, lead.businessId) : null, dealStage:getAutomationStageKey(deal), conversationNeedsReply:getConversationNeedsReply(conversation) };
}
function resolveAutomationField(context, field) {
  const lookup = { "lead.priority":context.lead?.priority, "lead.status":context.lead?.status, "conversation.needs_reply":context.conversationNeedsReply, "conversation.status":context.conversation?.status, "deal.stage":context.dealStage, "deal.status":context.deal?.status, "deal.value":context.deal?.value, "task.status":context.task?.status, "appointment.status":context.appointment?.status };
  const value = lookup[field]; return { value, known:value !== undefined && value !== null && value !== "" };
}
export function evaluateAutomationCondition(condition, context) {
  const validation=validateAutomationCondition(condition); if (!validation.valid) return { ...condition, actual:null, known:false, pass:false, invalidContract:true, validationReason:validation.reason }; const { value, known } = resolveAutomationField(context, condition.field); const target = validation.value;
  let pass = false;
  if (condition.operator === "is_known") pass = known;
  else if (condition.operator === "is_unknown") pass = !known;
  else if (!known) pass = false;
  else if (condition.operator === "equals") pass = String(value) === String(target);
  else if (condition.operator === "not_equals") pass = String(value) !== String(target);
  else if (condition.operator === "greater_than") pass = Number(value) > Number(target);
  else if (condition.operator === "less_than") pass = Number(value) < Number(target);
  else if (condition.operator === "contains") pass = String(value).includes(String(target));
  return { ...condition, actual:value, known, pass };
}
export function evaluateAutomationConditions(conditionGroupId, context) { const group = getAutomationRuleConditionGroup(conditionGroupId); if (!group) return { matched:true, evaluations:[] }; const evaluations = group.conditions.map((condition) => evaluateAutomationCondition(condition, context)); return { matched:group.logic === "OR" ? evaluations.some((item) => item.pass) : evaluations.every((item) => item.pass), evaluations }; }
export function canAutomationExecute(actionType, approvalPolicy, triggerMode = "automatic") { if (forbiddenAutomationActions.includes(actionType)) return false; const catalog = automationActionCatalog.find((action) => action.type === actionType); if (!catalog) return false; if (approvalPolicy === "auto_safe") return catalog.safety === "auto_safe"; if (approvalPolicy === "approval_required") return true; return approvalPolicy === "manual_only" && triggerMode === "manual"; }
function automationRequiresApproval(actionType, policy) { const action=automationActionCatalog.find((item) => item.type === actionType); return policy === "approval_required" || action?.safety === "approval_required"; }
function normalizeAutomationEvent(triggerEvent = {}) { const triggeredAt=triggerEvent.triggeredAt || triggerEvent.occurredAt; const transition=triggerEvent.transition ? { from:triggerEvent.transition.from ?? null, to:triggerEvent.transition.to ?? null } : null; const eventId=triggerEvent.eventId || `EVT-LEGACY-${triggerEvent.type}-${triggerEvent.entityId}-${triggeredAt}-${transition?.from || ""}-${transition?.to || ""}`; return { ...triggerEvent, triggeredAt, occurredAt:triggerEvent.occurredAt || triggeredAt, eventId, transition, triggerMode:triggerEvent.triggerMode || (triggerEvent.origin === "manual" ? "manual" : "automatic"), triggeredBy:triggerEvent.triggeredBy || triggerEvent.actorId || null }; }
function automationIdempotencyKey(rule, triggerEvent, actionId) { return `${rule.id}:${rule.version}:${triggerEvent.eventId}:${actionId}`; }
function automationMatchReason(run) { const matched=run.matchedConditionDetails?.filter((item) => item.pass) || []; if (!matched.length) return "لم تتحقق شروط القاعدة."; return `تمت مطابقة القاعدة لأن ${matched.map((condition) => `${run.triggerEntityId} ${formatAutomationCondition(condition)}`).join(" و ")}.`; }
function recordAutomationAudit(values = {}) { const item = { id:nextNumericId("AUTOLOG", mockModel.automationActivities), createdAt:nextAutomationTimestamp(), actorId:values.actorId || CRM_ACTOR_ID, ...values }; mockModel.automationActivities.push(item); return item; }
function updateAutomationRunStatus(run) { const actions = getAutomationRunActionExecutions(run.id); if (actions.some((action) => action.status === "failed")) run.status="failed"; else if (actions.some((action) => action.status === "awaiting_approval" || action.status === "approved")) run.status="awaiting_approval"; else if (actions.length && actions.every((action) => ["executed", "rejected", "blocked"].includes(action.status))) run.status="executed"; run.completedAt = ["executed", "failed", "skipped"].includes(run.status) ? nextAutomationTimestamp() : null; return run; }

export function createAutomationRule(values = {}) {
  const trigger = getAutomationRuleTrigger(values.triggerType); const actions = (values.actionIds || []).map(getAutomationRuleAction).filter(Boolean); const policy = values.approvalPolicy || "auto_safe"; let conditionGroup = values.conditionGroupId ? getAutomationRuleConditionGroup(values.conditionGroupId) : null;
  if (!conditionGroup && Array.isArray(values.conditions) && values.conditions.length) { conditionGroup = { id:nextNumericId("COND", mockModel.automationConditionGroups), logic:"AND", conditions:values.conditions.map((condition) => ({ field:condition.field, operator:condition.operator, value:condition.value })) }; }
  const conditionsValid = validateAutomationConditionGroup(conditionGroup).valid;
  if (!String(values.name || "").trim() || !trigger || !actions.length || !automationApprovalPolicies.includes(policy) || !conditionsValid || !actions.every((action) => canAutomationExecute(action.type, policy, policy === "manual_only" ? "manual" : "automatic"))) return null;
  if (conditionGroup && !getAutomationRuleConditionGroup(conditionGroup.id)) mockModel.automationConditionGroups.push(conditionGroup);
  const createdAt = nextAutomationTimestamp(); const rule = { id:nextNumericId("AUTO", mockModel.automations), name:values.name.trim(), status:values.status || "draft", triggerType:trigger.id, conditionGroupId:conditionGroup?.id || null, actionIds:actions.map((action) => action.id), approvalPolicy:policy, createdBy:values.actorId || CRM_ACTOR_ID, createdAt, updatedAt:createdAt, version:1 };
  mockModel.automations.push(rule); recordAutomationAudit({ type:"rule_created", automationRuleId:rule.id, actorId:rule.createdBy, metadata:{ version:1 } }); return rule;
}
export function updateAutomationRule(ruleId, values = {}, actorId = CRM_ACTOR_ID) { const rule = getAutomationRule(ruleId); if (!rule) return null; const next={ ...rule, ...values, actionIds:values.actionIds ? [...values.actionIds] : rule.actionIds }; const group=next.conditionGroupId ? getAutomationRuleConditionGroup(next.conditionGroupId) : null; if (!getAutomationRuleTrigger(next.triggerType) || !automationApprovalPolicies.includes(next.approvalPolicy) || !validateAutomationConditionGroup(group).valid || !next.actionIds.every((id) => { const action=getAutomationRuleAction(id); return action && canAutomationExecute(action.type, next.approvalPolicy, next.approvalPolicy === "manual_only" ? "manual" : "automatic"); })) return null; const changed = ["triggerType", "conditionGroupId", "actionIds", "approvalPolicy"].some((key) => values[key] !== undefined && JSON.stringify(values[key]) !== JSON.stringify(rule[key])); if (values.name?.trim()) rule.name=values.name.trim(); if (values.status && Object.hasOwn(automationRuleStatusLabels, values.status)) rule.status=values.status; if (values.triggerType) rule.triggerType=values.triggerType; if (values.conditionGroupId === null || group) rule.conditionGroupId=values.conditionGroupId; if (values.actionIds) rule.actionIds=[...values.actionIds]; if (values.approvalPolicy) rule.approvalPolicy=values.approvalPolicy; if (changed) rule.version += 1; rule.updatedAt=nextAutomationTimestamp(); recordAutomationAudit({ type:"rule_updated", automationRuleId:rule.id, actorId, metadata:{ version:rule.version } }); return rule; }
export function setAutomationRuleStatus(ruleId, status, actorId = CRM_ACTOR_ID) { const rule = getAutomationRule(ruleId); if (!rule || !Object.hasOwn(automationRuleStatusLabels, status)) return null; const fromStatus=rule.status; rule.status=status; rule.updatedAt=nextAutomationTimestamp(); recordAutomationAudit({ type:"rule_status_changed", automationRuleId:rule.id, actorId, metadata:{ fromStatus, toStatus:status } }); return rule; }
export function testAutomationRule(ruleId, triggerEvent) { const rule=getAutomationRule(ruleId); const event=normalizeAutomationEvent(triggerEvent); if (!rule) return null; const contract=getAutomationRuleContractValidation(rule); if (!contract.valid) return { dryRun:true, ruleId:rule.id, ruleVersion:rule.version, invalidContract:true, validationReason:contract.reason, conditionResult:null, actions:[], context:null }; const context=buildAutomationContext(event); const conditionResult=evaluateAutomationConditions(rule.conditionGroupId, context); const triggerMatched=rule.triggerType === event.type; const manualBlocked=rule.approvalPolicy === "manual_only" && event.triggerMode !== "manual"; return { dryRun:true, ruleId:rule.id, ruleVersion:rule.version, triggerMatched, manualBlocked, conditionResult, actions:rule.actionIds.map(getAutomationRuleAction).filter(Boolean).map((action) => ({ id:action.id, type:action.type, requiresApproval:automationRequiresApproval(action.type, rule.approvalPolicy), wouldExecute:canAutomationExecute(action.type, rule.approvalPolicy, event.triggerMode) })), context }; }

export function evaluateAutomationRule(ruleId, triggerEvent, options = {}) {
  const rule=getAutomationRule(ruleId); const event=normalizeAutomationEvent(triggerEvent); if (!rule || !event?.type || !event.entityId || !event.triggeredAt || !event.eventId) return { kind:"invalid", run:null };
  const contract=getAutomationRuleContractValidation(rule); if (!contract.valid) return { kind:"invalid_contract", run:null, reason:contract.reason };
  if (options.dryRun) return { kind:"dry_run", run:null, test:testAutomationRule(ruleId, event) };
  if (rule.status !== "enabled") return { kind:"inactive", run:null };
  if (event.origin === "automation") { const run={ id:nextNumericId("AUTORUN", mockModel.automationRuns), automationRuleId:rule.id, automationRuleVersion:rule.version, ruleNameSnapshot:rule.name, triggerSnapshot:rule.triggerType, actionSnapshot:rule.actionIds.map((id) => getAutomationRuleAction(id)?.type), triggerEventId:event.eventId, triggerEventType:event.type, triggerEntityType:event.entityType, triggerEntityId:event.entityId, triggeredAt:event.triggeredAt, triggerOccurredAt:event.occurredAt, triggerTransition:event.transition, triggerMode:event.triggerMode, triggeredBy:event.triggeredBy, status:"skipped", matchedConditions:false, proposedActionIds:[], startedAt:nextAutomationTimestamp(), completedAt:nextAutomationTimestamp(), createdAt:nextAutomationTimestamp(), idempotencyKey:`loop:${rule.id}:${rule.version}:${event.eventId}`, failureReason:"منع loop guard: مخرج Automation لا يعيد تشغيل القاعدة نفسها.", origin:"automation" }; mockModel.automationRuns.push(run); recordAutomationAudit({ type:"loop_guard_blocked", automationRuleId:rule.id, automationRunId:run.id, metadata:{ triggerEntityId:event.entityId, eventId:event.eventId } }); return { kind:"loop_guard", run }; }
  if (rule.triggerType !== event.type) return { kind:"trigger_mismatch", run:null };
  const firstActionId=rule.actionIds[0]; const idempotencyKey=automationIdempotencyKey(rule, event, firstActionId); const existingRun=mockModel.automationRuns.find((run) => run.idempotencyKey === idempotencyKey); if (existingRun) return { kind:"duplicate", run:existingRun };
  const context=buildAutomationContext(event); const conditionResult=evaluateAutomationConditions(rule.conditionGroupId, context); const createdAt=nextAutomationTimestamp(); const manualBlocked=rule.approvalPolicy === "manual_only" && event.triggerMode !== "manual"; const run={ id:nextNumericId("AUTORUN", mockModel.automationRuns), automationRuleId:rule.id, automationRuleVersion:rule.version, ruleNameSnapshot:rule.name, triggerSnapshot:rule.triggerType, actionSnapshot:rule.actionIds.map((id) => getAutomationRuleAction(id)?.type), triggerEventId:event.eventId, triggerEventType:event.type, triggerEntityType:event.entityType, triggerEntityId:event.entityId, triggeredAt:event.triggeredAt, triggerOccurredAt:event.occurredAt, triggerTransition:event.transition, triggerMode:event.triggerMode, triggeredBy:event.triggeredBy, status:conditionResult.matched && !manualBlocked ? "matched" : "skipped", matchedConditions:conditionResult.matched, matchedConditionDetails:conditionResult.evaluations, proposedActionIds:conditionResult.matched && !manualBlocked ? [...rule.actionIds] : [], startedAt:createdAt, completedAt:conditionResult.matched && !manualBlocked ? null : createdAt, createdAt, idempotencyKey, failureReason:manualBlocked ? "هذه القاعدة يدوية فقط؛ استخدم تشغيل الآن." : conditionResult.matched ? null : "لم تتحقق شروط القاعدة.", origin:event.origin || "user_event" };
  mockModel.automationRuns.push(run); recordAutomationAudit({ type:conditionResult.matched && !manualBlocked ? "run_matched" : "run_skipped", automationRuleId:rule.id, automationRunId:run.id, actorId:event.triggeredBy || CRM_ACTOR_ID, metadata:{ triggerEventType:event.type, eventId:event.eventId, transition:event.transition, triggerMode:event.triggerMode, matched:conditionResult.matched, reason:manualBlocked ? run.failureReason : automationMatchReason(run) } }); if (!conditionResult.matched || manualBlocked) return { kind:manualBlocked ? "blocked_manual_only" : "skipped", run };
  rule.actionIds.forEach((actionId) => { const action=getAutomationRuleAction(actionId); const requiresApproval=automationRequiresApproval(action.type, rule.approvalPolicy); const execution={ id:nextNumericId("AUTOEXEC", mockModel.automationActionExecutions), automationRunId:run.id, actionId, actionType:action.type, status:requiresApproval ? "awaiting_approval" : "proposed", payload:{ ...action.payload }, requiresApproval, requestReason:automationMatchReason(run), requestedAt:createdAt, approvedBy:null, approvedAt:null, rejectedBy:null, rejectedAt:null, executedBy:null, executedAt:null, resultEntityId:null, failureReason:null }; mockModel.automationActionExecutions.push(execution); recordAutomationAudit({ type:requiresApproval ? "approval_requested" : "action_proposed", automationRuleId:rule.id, automationRunId:run.id, actionExecutionId:execution.id, actorId:event.triggeredBy || CRM_ACTOR_ID, metadata:{ actionType:action.type, requiresApproval, requestedAt:execution.requestedAt, reason:execution.requestReason } }); });
  getAutomationRunActionExecutions(run.id).filter((execution) => !execution.requiresApproval).forEach((execution) => executeAutomationAction(execution.id, CRM_ACTOR_ID)); updateAutomationRunStatus(run); return { kind:run.status, run };
}
export function runAutomationNow(ruleId, actorId = CRM_ACTOR_ID, contextOverrides = {}) { const rule=getAutomationRule(ruleId); const trigger=getAutomationRuleTrigger(rule?.triggerType); if (!rule || !trigger || !findById(mockModel.users, actorId)) return { kind:"unsupported", run:null }; const defaultEntity={ lead:"LEAD-1042", deal:"DEAL-4042", conversation:"CONV-3042", task:"TASK-1042", appointment:"APT-1042", manual:`MANUAL-${rule.id}` }; const occurredAt=contextOverrides.occurredAt || nextAutomationTimestamp(); return evaluateAutomationRule(ruleId, { type:rule.triggerType, entityType:contextOverrides.entityType || trigger.entityType, entityId:contextOverrides.entityId || defaultEntity[trigger.entityType] || `MANUAL-${rule.id}`, occurredAt, triggeredAt:occurredAt, eventId:contextOverrides.eventId || `EVT-MANUAL-${rule.id}-${occurredAt}`, transition:contextOverrides.transition || null, actorId, triggeredBy:actorId, triggerMode:"manual", origin:"manual" }); }

export function createAppointment(values = {}) {
  const lead=getLead(values.leadId); const owner=findById(mockModel.users, values.ownerId || lead?.ownerId); const deal=values.dealId ? getDeal(values.dealId) : null; const startsAt=values.startsAt; const endsAt=values.endsAt; if (!lead || !owner || (values.dealId && (!deal || deal.leadId !== lead.id)) || !isAutomationIso(startsAt) || !isAutomationIso(endsAt) || new Date(endsAt) <= new Date(startsAt) || !Object.hasOwn(appointmentTypeLabels, values.type || "meeting") || !Object.hasOwn(appointmentLocationLabels, values.locationType || "online")) return { kind:"invalid", appointment:null };
  const appointment={ id:nextNumericId("APT", mockModel.appointments), leadId:lead.id, dealId:deal?.id || null, ownerId:owner.id, title:String(values.title || "موعد متابعة").trim(), type:values.type || "meeting", status:"scheduled", startsAt, endsAt, locationType:values.locationType || "online", location:String(values.location || "رابط تجريبي محلي").trim(), createdAt:nextAutomationTimestamp(), updatedAt:AUTOMATION_REFERENCE_TIME, createdByAutomationRunId:values.createdByAutomationRunId || null };
  appointment.updatedAt=appointment.createdAt; const overlap=mockModel.appointments.some((item) => item.ownerId === appointment.ownerId && item.status === "scheduled" && new Date(item.startsAt) < new Date(appointment.endsAt) && new Date(item.endsAt) > new Date(appointment.startsAt)); appointment.overlapWarning=overlap; mockModel.appointments.push(appointment); logLeadActivity(lead.id, { type:"appointment_created", actorId:values.actorId || CRM_ACTOR_ID, title:"أُنشئ موعد", detail:`${appointment.title} · ${appointment.startsAt.slice(0,16)}`, metadata:{ appointmentId:appointment.id, dealId:appointment.dealId, createdByAutomationRunId:appointment.createdByAutomationRunId } }); return { kind:"created", appointment };
}
function executeAutomationDomainAction(execution, run, rule, actorId) {
  const context=buildAutomationContext({ type:run.triggerEventType, entityType:run.triggerEntityType, entityId:run.triggerEntityId, triggeredAt:run.triggeredAt }); const lead=context.lead; const payload=execution.payload || {}; if (!lead && !["notify_in_app_mock", "escalate_to_human"].includes(execution.actionType)) return { kind:"failed", failureReason:"Lead المرجعية غير متاحة." };
  if (execution.actionType === "create_task" || execution.actionType === "create_followup_task") { const dueAt=automationDateAfter(run.triggeredAt, payload.duration); const task=addLeadTask(lead.id, { title:payload.title, dueAt, ownerId:lead.ownerId, priority:payload.priority || lead.priority, type:payload.type || "متابعة", actorId, metadata:{ createdByAutomationRunId:run.id, origin:"automation", automationActionExecutionId:execution.id } }); if (!task) return { kind:"failed", failureReason:"تعذر إنشاء المهمة عبر S5." }; task.createdByAutomationRunId=run.id; task.origin="automation"; return { kind:"executed", resultEntityId:task.id }; }
  if (execution.actionType === "create_appointment") { const startsAt=automationDateAfter(run.triggeredAt, payload.duration); const endsAt=formatAutomationInstant(new Date(parseAutomationInstant(startsAt).getTime() + Number(payload.appointmentDurationMinutes || 30) * 60000)); const created=createAppointment({ leadId:lead.id, dealId:context.deal?.id || null, ownerId:lead.ownerId, title:payload.title, startsAt, endsAt, type:payload.appointmentType || "meeting", locationType:payload.locationType || "online", location:payload.location, actorId, createdByAutomationRunId:run.id }); return created.kind === "created" ? { kind:"executed", resultEntityId:created.appointment.id } : { kind:"failed", failureReason:"فشل التحقق من الموعد." }; }
  if (execution.actionType === "update_lead_priority") { const updated=updateLeadPriority(lead.id, payload.priority, { actorId, metadata:{ createdByAutomationRunId:run.id, automationActionExecutionId:execution.id, origin:"automation" } }); return updated ? { kind:"executed", resultEntityId:updated.id } : { kind:"failed", failureReason:"تعذر تحديث أولوية العميل." }; }
  if (execution.actionType === "update_lead_status") { const updated=updateLeadStatus(lead.id, payload.status, { actorId, metadata:{ createdByAutomationRunId:run.id, automationActionExecutionId:execution.id, origin:"automation" } }); return updated ? { kind:"executed", resultEntityId:updated.id } : { kind:"failed", failureReason:"تعذر تحديث حالة العميل." }; }
  if (execution.actionType === "assign_lead") { const updated=assignLeadOwner(lead.id, payload.ownerId, { actorId, metadata:{ createdByAutomationRunId:run.id, automationActionExecutionId:execution.id, origin:"automation" } }); return updated ? { kind:"executed", resultEntityId:updated.id } : { kind:"failed", failureReason:"تعذر إسناد العميل." }; }
  if (execution.actionType === "notify_in_app_mock" || execution.actionType === "escalate_to_human") { const notification={ id:nextNumericId("AUTONOT", mockModel.automationNotifications), leadId:lead?.id || null, automationRunId:run.id, actionExecutionId:execution.id, type:execution.actionType, title:payload.title || "تنبيه أتمتة تجريبي", createdAt:nextAutomationTimestamp(), read:false }; mockModel.automationNotifications.push(notification); return { kind:"executed", resultEntityId:notification.id }; }
  return { kind:"failed", failureReason:"Action غير مدعوم في S9." };
}
export function executeAutomationAction(executionId, actorId = CRM_ACTOR_ID) { const execution=findById(mockModel.automationActionExecutions, executionId); const run=execution && findById(mockModel.automationRuns, execution.automationRunId); const rule=run && getAutomationRule(run.automationRuleId); if (!execution || !run || !rule || execution.status === "executed") return { kind:"no_op", execution }; if (!findById(mockModel.users, actorId) || !canAutomationExecute(execution.actionType, rule.approvalPolicy, run.triggerMode || "automatic")) { execution.status="blocked"; execution.failureReason="Action محظور بسياسة الأتمتة المركزية."; updateAutomationRunStatus(run); return { kind:"blocked", execution }; }
  if (execution.requiresApproval && execution.status !== "approved") return { kind:"awaiting_approval", execution }; const result=executeAutomationDomainAction(execution, run, rule, actorId); execution.executedAt=nextAutomationTimestamp(); execution.executedBy="automation"; execution.status=result.kind === "executed" ? "executed" : "failed"; execution.resultEntityId=result.resultEntityId || null; execution.failureReason=result.failureReason || null; recordAutomationAudit({ type:execution.status === "executed" ? "action_executed" : "action_failed", automationRuleId:rule.id, automationRunId:run.id, actionExecutionId:execution.id, actorId, metadata:{ actionType:execution.actionType, executedBy:execution.executedBy, resultEntityId:execution.resultEntityId, failureReason:execution.failureReason } }); updateAutomationRunStatus(run); return { kind:execution.status, execution };
}
export function approveAutomationAction(executionId, actorId = CRM_ACTOR_ID) { const execution=findById(mockModel.automationActionExecutions, executionId); const run=execution && findById(mockModel.automationRuns, execution.automationRunId); if (!execution || !run || execution.status !== "awaiting_approval" || !findById(mockModel.users, actorId)) return { kind:"no_op", execution }; execution.status="approved"; execution.approvedBy=actorId; execution.approvedAt=nextAutomationTimestamp(); recordAutomationAudit({ type:"action_approved", automationRuleId:run.automationRuleId, automationRunId:run.id, actionExecutionId:execution.id, actorId, metadata:{} }); return executeAutomationAction(execution.id, actorId); }
export function rejectAutomationAction(executionId, actorId = CRM_ACTOR_ID) { const execution=findById(mockModel.automationActionExecutions, executionId); const run=execution && findById(mockModel.automationRuns, execution.automationRunId); if (!execution || !run || execution.status !== "awaiting_approval" || !findById(mockModel.users, actorId)) return { kind:"no_op", execution }; execution.status="rejected"; execution.rejectedBy=actorId; execution.rejectedAt=nextAutomationTimestamp(); recordAutomationAudit({ type:"action_rejected", automationRuleId:run.automationRuleId, automationRunId:run.id, actionExecutionId:execution.id, actorId, metadata:{} }); updateAutomationRunStatus(run); return { kind:"rejected", execution }; }
export function getAutomationIntegrityReport() {
  const checks=[]; const add=(id,name,pass,detail)=>checks.push({ id,name,pass,detail }); const rules=mockModel.automations; const runs=mockModel.automationRuns; const actions=mockModel.automationActionExecutions;
  add("A", "مراجع القواعد", rules.every((rule) => getAutomationRuleTrigger(rule.triggerType) && rule.actionIds.every((id) => getAutomationRuleAction(id))), "Trigger/Actions موجودة");
  add("B", "الشروط", mockModel.automationConditionGroups.every((group) => validateAutomationConditionGroup(group).valid), "Field/operator/value ضمن catalog المركزي");
  add("C", "حالات القواعد", rules.every((rule) => Object.hasOwn(automationRuleStatusLabels, rule.status)), "enabled/disabled/draft");
  add("D", "Provenance", runs.every((run) => run.triggerEntityId && run.triggerEventType && isAutomationIso(run.triggeredAt) && (run.triggerEventId || run.origin === "fixture")), "event/entity/time محفوظة");
  add("E", "الحتمية", Boolean(testAutomationRule("AUTO-1001", { type:"lead_created", entityType:"lead", entityId:"LEAD-1042", triggeredAt:"2026-08-15T13:00:00" }).conditionResult.matched), "السياق نفسه يطابق النتيجة نفسها");
  add("F", "القواعد المعطلة", rules.filter((rule) => rule.status === "disabled").every((rule) => !runs.some((run) => run.automationRuleId === rule.id && run.origin !== "fixture")), "disabled لا تنتج Run");
  add("G", "المسودات", rules.filter((rule) => rule.status === "draft").every((rule) => !runs.some((run) => run.automationRuleId === rule.id)), "draft لا تنتج Run");
  add("H", "موافقة قبل التنفيذ", actions.filter((action) => action.requiresApproval && action.status === "awaiting_approval").every((action) => !action.resultEntityId), "لا mutation قبل approval");
  add("I", "رفض بلا mutation", actions.filter((action) => action.status === "rejected").every((action) => !action.resultEntityId), "رفض = 0 mutation");
  add("J", "Idempotency", new Set(runs.map((run) => run.idempotencyKey)).size === runs.length && runs.filter((run) => run.origin !== "fixture").every((run) => run.idempotencyKey.includes(run.triggerEventId)), "key يضم eventId ويمنع تكرار الحدث نفسه");
  add("K", "إعادة استخدام Task", mockModel.tasks.filter((task) => task.createdByAutomationRunId).every((task) => getLead(task.leadId)), "Tasks تستخدم عقد S5");
  add("L", "مراجع المواعيد", mockModel.appointments.every((appointment) => getLead(appointment.leadId) && findById(mockModel.users, appointment.ownerId) && (!appointment.dealId || getDeal(appointment.dealId))), "Lead/Owner/Deal صحيحة");
  add("M", "وقت الموعد", mockModel.appointments.every((appointment) => new Date(appointment.endsAt) > new Date(appointment.startsAt)), "endsAt > startsAt");
  add("N", "إصدار القاعدة", runs.every((run) => Number.isInteger(run.automationRuleVersion) && run.automationRuleVersion > 0), "version محفوظ في Run");
  add("O", "تدقيق كامل", actions.every((action) => { const run=findById(mockModel.automationRuns, action.automationRunId); if(!run)return false; if(action.status === "executed")return Boolean(action.executedBy && action.executedAt && action.resultEntityId); if(action.status === "rejected")return Boolean(action.rejectedBy && action.rejectedAt && !action.executedAt); if(action.status === "failed")return Boolean(action.failureReason); return true; }), "Actor/result/failure محفوظون حسب الحالة");
  add("P", "Loop guard", runs.filter((run) => run.origin === "automation").every((run) => run.status === "skipped"), "output لا يعيد trigger");
  add("Q", "حد الرسائل", mockModel.messages.every((message) => message.senderType !== "automation"), "0 outbound من Automation");
  add("R", "حد الصفقات", mockModel.deals.every((deal) => !getDealActivities(deal.id).some((activity) => activity.metadata?.origin === "automation")), "0 mutation مالية/مرحلية");
  add("S", "حد الإيراد", getAttributionIntegrityReport().pass, "Revenue/Attribution محفوظة");
  add("T", "حد S8", mockModel.agentActions.every((action) => action.proposedBy === "agent"), "لا Agent execution غير مصرح");
  add("U", "تفرد المعرفات", [mockModel.automations, runs, actions, mockModel.appointments].every((items) => duplicateIds(items).length === 0), "Rule/Run/Action/Appointment فريدة");
  add("V", "لا scheduler خارجي", true, "المحرك يستدعى يدويًا داخل session state فقط"); return { pass:checks.every((check) => check.pass), checks };
}

// S11 Design reminder: Settings, integrations and billing are local mock domains only. They never call providers, retain secrets, gate existing features, or create customer-sales revenue.
export const integrationStatusLabels = { not_connected:"غير متصل", mock_connected:"متصل تجريبيًا", configuration_required:"يتطلب إعدادًا", error:"خطأ تجريبي", disabled:"معطّل" };
export const notificationCategoryLabels = { new_lead:"عميل محتمل جديد", task_due:"استحقاق مهمة", appointment_due:"استحقاق موعد", automation_approval:"موافقة أتمتة", conversation_needs_reply:"محادثة تحتاج ردًا", deal_attention:"صفقة تحتاج انتباهًا" };
export const notificationChannelLabels = { in_app:"داخل المنصة", email_mock:"بريد تجريبي", whatsapp_mock:"واتساب تجريبي" };
export const workspaceTimezones = ["Asia/Riyadh","Asia/Dubai","Asia/Kuwait"];
export const workspaceCurrencies = ["SAR"];
export const workspaceLocales = ["ar-SA"];
let s11MutationTick = 0;
function nextS11Timestamp() { s11MutationTick += 1; return `2026-08-15T14:${String(Math.floor(s11MutationTick / 60)).padStart(2,"0")}:${String(s11MutationTick % 60).padStart(2,"0")}`; }
function s11Id(prefix, items) { return `${prefix}-${Math.max(1000,...items.map((item)=>Number(String(item.id).split("-").at(-1))||0))+1}`; }
function s11Audit(collection, prefix, payload) { const row={ id:s11Id(prefix,collection), createdAt:nextS11Timestamp(), ...payload }; collection.push(row); return row; }
export function getWorkspace() { return mockModel.workspace; }
export function getCurrentWorkspaceUser() { return findById(mockModel.users, mockModel.currentUserId); }
export function getNotificationPreferences(userId = mockModel.currentUserId) { return mockModel.notificationPreferences.filter((item)=>item.userId === userId); }
export function getSettingsActivities() { return [...mockModel.settingsActivities].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
export function getSecuritySettings() { return mockModel.securitySettings; }
export function getTeamInvitations() { return [...mockModel.teamInvitations].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
export function updateWorkspaceSettings(values, actorId = mockModel.currentUserId) { const workspace=getWorkspace(); const name=String(values.name||"").trim(); if(!workspace || !name || !workspaceTimezones.includes(values.timezone) || !workspaceCurrencies.includes(values.currency) || !workspaceLocales.includes(values.locale) || !findById(mockModel.users,actorId)) return null; ["name","timezone","currency","locale"].forEach((field)=>{const next=field === "name" ? name : values[field];if(workspace[field]!==next)s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"settings_changed",metadata:{field,from:workspace[field],to:next}});workspace[field]=next;}); workspace.updatedAt=nextS11Timestamp(); state.workspace.companyName=workspace.name; return workspace; }
export function updateCurrentUserSettings(values, actorId = mockModel.currentUserId) { const user=findById(mockModel.users,actorId); const name=String(values.name||"").trim(); if(!user || !name) return null; if(user.name!==name){s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"settings_changed",metadata:{field:"user.name",from:user.name,to:name}});user.name=name;} return user; }
export function setTeamMemberStatus(userId, status, actorId = mockModel.currentUserId) { const user=findById(mockModel.users,userId); if(!user || !["active","inactive"].includes(status) || !findById(mockModel.users,actorId)) return null; if(user.status!==status){s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"team_member_status_changed",metadata:{userId,from:user.status,to:status}});user.status=status;}return user; }
export function createTeamInvitation(email, role, actorId = mockModel.currentUserId) { const normalized=String(email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(normalized)||!String(role||"").trim()||!findById(mockModel.users,actorId))return null;const invitation={id:s11Id("INV",mockModel.teamInvitations),teamId:getCurrentWorkspaceUser()?.teamId||"TEAM-1001",email:normalized,role:String(role).trim(),status:"pending_mock",invitedBy:actorId,createdAt:nextS11Timestamp()};mockModel.teamInvitations.push(invitation);s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"team_invitation_created",metadata:{invitationId:invitation.id,email:invitation.email}});return invitation; }
export function setNotificationPreference(id, enabled, actorId = mockModel.currentUserId) { const preference=findById(mockModel.notificationPreferences,id);if(!preference || preference.userId!==actorId)return null;preference.enabled=Boolean(enabled);s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"notification_preference_changed",metadata:{preferenceId:id,category:preference.category,enabled:preference.enabled}});return preference; }
export function updateSecuritySettings(values, actorId = mockModel.currentUserId) { const security=getSecuritySettings();if(!security || !["local_only","external_allowed_mock"].includes(values.dataResidency)||typeof values.externalAiAccess!=="boolean")return null;["dataResidency","externalAiAccess"].forEach((field)=>{if(security[field]!==values[field]){s11Audit(mockModel.settingsActivities,"SET",{actorId,type:"security_setting_changed",metadata:{field,from:security[field],to:values[field]}});security[field]=values[field];}});security.updatedAt=nextS11Timestamp();return security; }
export function getIntegration(integrationId) { return findById(mockModel.integrations,integrationId); }
export function getIntegrationActivities(integrationId) { return mockModel.integrationActivities.filter((item)=>item.integrationId===integrationId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
function recordIntegrationActivity(integrationId,type,actorId,metadata={}) { return s11Audit(mockModel.integrationActivities,"INTA",{integrationId,actorId,type,metadata}); }
export function connectIntegrationMock(integrationId, actorId = mockModel.currentUserId) { const integration=getIntegration(integrationId);if(!integration||!findById(mockModel.users,actorId)||["disabled","error"].includes(integration.status))return null;const from=integration.status;integration.status="mock_connected";integration.mode=integration.mode||"mock";integration.configuredAt=integration.configuredAt||nextS11Timestamp();integration.connectedBy=actorId;integration.lastCheckedAt=nextS11Timestamp();integration.errorCode=null;integration.errorReason=null;recordIntegrationActivity(integration.id,"mock_connected",actorId,{from,to:"mock_connected",mode:integration.mode});return integration; }
export function disconnectIntegrationMock(integrationId, actorId = mockModel.currentUserId) { const integration=getIntegration(integrationId);if(!integration||integration.status!=="mock_connected"||!findById(mockModel.users,actorId))return null;integration.status="not_connected";integration.connectedBy=null;integration.lastCheckedAt=nextS11Timestamp();recordIntegrationActivity(integration.id,"disconnected",actorId,{from:"mock_connected",to:"not_connected"});return integration; }
export function updateIntegrationConfiguration(integrationId, values={}, actorId = mockModel.currentUserId) { const integration=getIntegration(integrationId);if(!integration||!findById(mockModel.users,actorId))return null;const configured=Boolean(values.hasConfiguredSecret);integration.hasConfiguredSecret=configured;integration.configuredAt=nextS11Timestamp();integration.lastCheckedAt=integration.configuredAt;if(integration.status==="configuration_required"||integration.status==="error")integration.status=configured?"mock_connected":"configuration_required";if(integration.status==="mock_connected")integration.connectedBy=actorId;integration.errorCode=null;integration.errorReason=null;recordIntegrationActivity(integration.id,"configuration_updated",actorId,{hasConfiguredSecret:configured,mode:integration.mode});return integration; }
export function retryIntegrationMock(integrationId, actorId = mockModel.currentUserId) { const integration=getIntegration(integrationId);if(!integration||!findById(mockModel.users,actorId))return null;const from=integration.status;integration.lastCheckedAt=nextS11Timestamp();if(integration.status==="error") { integration.status=integration.hasConfiguredSecret?"mock_connected":"configuration_required";integration.errorCode=null;integration.errorReason=null; }recordIntegrationActivity(integration.id,"retry_requested",actorId,{from,to:integration.status});return integration; }
export function getCurrentSubscription() { return mockModel.subscriptions[0]||null; }
export function getPlan(planId) { return findById(mockModel.plans,planId); }
export function getBillingActivities() { return [...mockModel.billingActivities].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
export function getBillingUsage() { const subscription=getCurrentSubscription();const plan=getPlan(subscription?.planId);const used={leads:mockModel.leads.length,discoveryRuns:jobs.length,seats:mockModel.users.filter((user)=>user.status==="active").length,automationRuns:mockModel.automationRuns.length,aiAnalyses:mockModel.opportunityAnalyses.filter((item)=>item.status!=="not_analyzed").length};return Object.entries(used).map(([key,value])=>{const limit=plan?.limits?.[key]??null;return {key,used:value,limit,remaining:limit===null?null:Math.max(0,limit-value),over:limit!==null&&value>limit};}); }
export function getPlanChangePreview(planId, actorId = mockModel.currentUserId) { const subscription=getCurrentSubscription();const current=getPlan(subscription?.planId);const target=getPlan(planId);if(!subscription||!current||!target||!findById(mockModel.users,actorId))return null;const usage=getBillingUsage();const differences=Object.keys(target.limits).map((key)=>({key,current:current.limits[key],target:target.limits[key],used:usage.find((item)=>item.key===key)?.used||0,over:(usage.find((item)=>item.key===key)?.used||0)>target.limits[key]}));return {subscription,current,target,priceDifference:target.price-current.price,differences,effectiveDate:"بداية الدورة التجريبية التالية"}; }
export function previewPlanChange(planId, actorId = mockModel.currentUserId) { const preview=getPlanChangePreview(planId,actorId);if(!preview)return null;s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:preview.subscription.id,actorId,type:"plan_change_previewed",metadata:{from:preview.current.id,to:preview.target.id}});return preview; }
export function changeSubscriptionPlanMock(planId, actorId = mockModel.currentUserId) { const subscription=getCurrentSubscription();const plan=getPlan(planId);if(!subscription||!plan||!findById(mockModel.users,actorId))return null;const from=subscription.planId;subscription.planId=plan.id;subscription.status="active_mock";subscription.updatedAt=nextS11Timestamp();s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:subscription.id,actorId,type:"plan_changed_mock",metadata:{from,to:plan.id}});return subscription; }
export function setSubscriptionCancelAtPeriodEnd(value, actorId = mockModel.currentUserId) { const subscription=getCurrentSubscription();if(!subscription||!findById(mockModel.users,actorId))return null;subscription.cancelAtPeriodEnd=Boolean(value);subscription.updatedAt=nextS11Timestamp();s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:subscription.id,actorId,type:value?"subscription_cancel_scheduled":"subscription_reactivated",metadata:{cancelAtPeriodEnd:subscription.cancelAtPeriodEnd}});return subscription; }

function checkoutContextKey(context="billing", jobId=null, businessIds=[]) { return `${context}:${jobId||"none"}:${[...businessIds].sort().join(",")}`; }
export function getCheckoutOffer(planId) { return Object.values(checkoutOffers).find((offer)=>offer.planId===planId) || checkoutOffers.crm; }
export function getMockCheckout() { return state.s11Ui.checkout; }
export function isMockCheckoutPaid(context, jobId, businessIds=[]) { return state.s11Ui.paidCheckoutKeys.includes(checkoutContextKey(context,jobId,businessIds)); }
export function openMockCheckout({ planId, context="billing", jobId=null, businessIds=[] }={}) { const plan=getPlan(planId); const offer=getCheckoutOffer(planId); if(!plan||!offer)return null; const checkout={ id:`CHK-${Math.max(1000,...mockModel.billingActivities.map((item)=>Number(String(item.id).split("-").at(-1))||0))+1}`, open:true, step:"invoice", status:"draft", planId:plan.id, offerId:offer.id, context, jobId, businessIds:[...new Set(businessIds)], invoice:{ companyName:getWorkspace()?.name||"", email:"billing@nomo.example", vatNumber:"" }, paymentMethodId:mockModel.paymentMethods[0]?.id||null, createdAt:nextS11Timestamp(), completedInvoiceId:null, failureReason:null }; state.s11Ui.checkout=checkout; s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:getCurrentSubscription()?.id||null,actorId:mockModel.currentUserId,type:"checkout_started_mock",metadata:{checkoutId:checkout.id,planId:plan.id,offerId:offer.id,context,jobId,businessCount:checkout.businessIds.length}}); return checkout; }
export function updateMockCheckoutInvoice(values={}) { const checkout=getMockCheckout(); const companyName=String(values.companyName||"").trim(); const email=String(values.email||"").trim().toLowerCase(); const vatNumber=String(values.vatNumber||"").trim(); if(!checkout||!companyName||!/^\S+@\S+\.\S+$/.test(email))return null; checkout.invoice={companyName,email,vatNumber};checkout.step="payment";checkout.status="ready_for_payment";return checkout; }
export function continueMockCheckoutPayment(paymentMethodId) { const checkout=getMockCheckout(); const payment=findById(mockModel.paymentMethods,paymentMethodId); if(!checkout||!payment||payment.status!=="mock")return null; checkout.paymentMethodId=payment.id;checkout.step="review";checkout.status="review";return checkout; }
export function getMockCheckoutPreview() { const checkout=getMockCheckout(); const plan=getPlan(checkout?.planId); const offer=checkout&&getCheckoutOffer(checkout.planId); if(!checkout||!plan||!offer)return null; const subtotal=plan.price; const tax=Math.round(subtotal*0.15*100)/100; return { checkout, plan, offer, subtotal, tax, total:subtotal+tax, payment:findById(mockModel.paymentMethods,checkout.paymentMethodId) }; }
export function failMockCheckout(reason="رفض تجريبي من بوابة الدفع المحلية") { const checkout=getMockCheckout(); if(!checkout)return null; checkout.status="failed_mock";checkout.step="failed";checkout.failureReason=reason;s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:getCurrentSubscription()?.id||null,actorId:mockModel.currentUserId,type:"checkout_failed_mock",metadata:{checkoutId:checkout.id,planId:checkout.planId,reason}});return checkout; }
export function completeMockCheckout() { const preview=getMockCheckoutPreview(); if(!preview||preview.checkout.status!=="review"||!preview.payment)return null; const {checkout,plan,total}=preview; const subscription=getCurrentSubscription(); if(!subscription)return null; const previousPlanId=subscription.planId; subscription.planId=plan.id;subscription.status="active_mock";subscription.cancelAtPeriodEnd=false;subscription.updatedAt=nextS11Timestamp(); const invoice={id:s11Id("INV-BILL",mockModel.invoices),subscriptionId:subscription.id,periodStart:"2026-08-15",periodEnd:"2026-09-14",amount:total,currency:"SAR",status:"paid_mock",issuedAt:nextS11Timestamp(),checkoutId:checkout.id,displayOnly:true};mockModel.invoices.push(invoice); checkout.status="succeeded_mock";checkout.step="success";checkout.completedInvoiceId=invoice.id;checkout.completedAt=nextS11Timestamp();s11Audit(mockModel.billingActivities,"BILL",{subscriptionId:subscription.id,actorId:mockModel.currentUserId,type:"checkout_paid_mock",metadata:{checkoutId:checkout.id,invoiceId:invoice.id,from:previousPlanId,to:plan.id,total,context:checkout.context}});return {checkout,subscription,invoice}; }
export function finishMockCheckoutJourney() { const checkout=getMockCheckout(); if(!checkout||checkout.status!=="succeeded_mock")return null; const result={context:checkout.context,jobId:checkout.jobId,businessIds:[...checkout.businessIds],invoiceId:checkout.completedInvoiceId,planId:checkout.planId}; state.s11Ui.paidCheckoutKeys=[...new Set([...state.s11Ui.paidCheckoutKeys,checkoutContextKey(result.context,result.jobId,result.businessIds)])]; state.s11Ui.checkout=null;return result; }
export function closeMockCheckout() { state.s11Ui.checkout=null;return true; }
export function getPaymentCheckoutIntegrityReport() { const checkout=getMockCheckout(); const rawCardKeys=["cardNumber","pan","cvv","cvc","expiry"]; const checks=[{id:"A",pass:Object.values(checkoutOffers).every((offer)=>getPlan(offer.planId)),detail:"عروض Checkout تشير إلى Plans قائمة"},{id:"B",pass:mockModel.paymentMethods.every((method)=>method.status==="mock"&&rawCardKeys.every((key)=>!(key in method))),detail:"لا بطاقة أو CVV أو PAN مخزن"},{id:"C",pass:mockModel.invoices.every((invoice)=>invoice.subscriptionId===getCurrentSubscription()?.id),detail:"الفواتير تشير إلى الاشتراك الحالي"},{id:"D",pass:!checkout||["draft","ready_for_payment","review","failed_mock","succeeded_mock"].includes(checkout.status),detail:"حالة Checkout ضمن العقد"},{id:"E",pass:true,detail:"Checkout لا ينشئ RevenueEvent أو AttributionTouchpoint"}];return {pass:checks.every((item)=>item.pass),checks}; }
export function getS11IntegrityReport() { const allowedStatuses=Object.keys(integrationStatusLabels);const subscription=getCurrentSubscription();const usage=getBillingUsage();const checks=[
  {id:"A",pass:mockModel.integrations.every((item)=>allowedStatuses.includes(item.status)&&item.mode&&item.capabilities.length),detail:"تكاملات بحالات وقدرات معلنة"},
  {id:"B",pass:mockModel.integrations.every((item)=>item.status!=="connected"&&!(item.secret||item.token||item.apiKey)),detail:"لا اتصال إنتاجي ولا أسرار مخزنة"},
  {id:"C",pass:mockModel.notificationPreferences.every((item)=>notificationCategoryLabels[item.category]&&item.channels.every((channel)=>notificationChannelLabels[channel])),detail:"تفضيلات الإشعار من catalogs صحيحة"},
  {id:"D",pass:mockModel.users.every((user)=>user.teamId===getCurrentWorkspaceUser()?.teamId),detail:"الفريق يعيد استخدام Users الحالية"},
  {id:"E",pass:Boolean(subscription&&getPlan(subscription.planId)&&mockModel.invoices.every((invoice)=>invoice.subscriptionId===subscription.id)&&mockModel.paymentMethods.every((item)=>item.status==="mock")),detail:"مراجع الفوترة ووسيلة الدفع التجريبية صحيحة"},
  {id:"F",pass:usage.every((item)=>item.limit===null||item.remaining===Math.max(0,item.limit-item.used)),detail:"Usage يعلن used/limit/remaining"},
  {id:"G",pass:duplicateIds(mockModel.integrations).length===0&&duplicateIds(mockModel.integrationActivities).length===0&&duplicateIds(mockModel.plans).length===0&&duplicateIds(mockModel.subscriptions).length===0&&duplicateIds(mockModel.invoices).length===0&&duplicateIds(mockModel.billingActivities).length===0&&duplicateIds(mockModel.teamInvitations).length===0,detail:"معرفات S11 فريدة"},
  {id:"H",pass:true,detail:"S11 لا ينشئ RevenueEvent أو AttributionTouchpoint"}
];return {pass:checks.every((item)=>item.pass),checks}; }
