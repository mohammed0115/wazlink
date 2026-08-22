import {
  continueMockCheckoutPayment,
  closeMockCheckout,
  completeMockCheckout,
  failMockCheckout,
  finishMockCheckoutJourney,
  getMockCheckout,
  getPaymentCheckoutIntegrityReport,
  mockModel,
  openMockCheckout,
  state,
  updateMockCheckoutInvoice,
} from "../client/src/domain/data.js";
import fs from "node:fs";

const failures=[];
const check=(id,pass,detail)=>{if(!pass)failures.push({id,detail});console.log(`${pass?"PASS":"FAIL"} ${id} — ${detail}`);};
const before={revenue:JSON.stringify(mockModel.revenueEvents),touchpoints:JSON.stringify(mockModel.attributionTouchpoints),leads:mockModel.leads.length,deals:mockModel.deals.length};

const opened=openMockCheckout({planId:"PLAN-STARTER",context:"scraper_export",jobId:"JOB-1028",businessIds:["BUS-1042"]});
check("A",opened?.step==="invoice"&&opened?.status==="draft","يبدأ Checkout من بيانات الفاتورة فقط");
check("B",updateMockCheckoutInvoice({companyName:"وكالة اختبار",email:"billing@example.test",vatNumber:"123"})?.step==="payment","التحقق المحلي ينقل إلى وسيلة الدفع");
check("C",continueMockCheckoutPayment("PM-1001")?.step==="review","وسيلة الدفع المقنّعة فقط تنقل إلى المراجعة");
check("D",getMockCheckout()?.status==="review","تأكيد المراجعة يحضّر دفعًا تجريبيًا فقط");
const completed=completeMockCheckout();
check("E",completed?.checkout.status==="succeeded_mock"&&completed?.invoice.status==="paid_mock","ينشئ النجاح Invoice محلية وإيصالًا تجريبيًا");
const finished=finishMockCheckoutJourney();
check("F",finished?.context==="scraper_export"&&state.s11Ui.checkout===null,"تنهي الرحلة وتعيد السياق إلى مسار Scraper");
check("G",JSON.stringify(mockModel.revenueEvents)===before.revenue&&JSON.stringify(mockModel.attributionTouchpoints)===before.touchpoints,"لا يغيّر Checkout RevenueEvent أو AttributionTouchpoint");
check("H",mockModel.leads.length===before.leads&&mockModel.deals.length===before.deals,"مسار Scraper Checkout لا ينشئ Leads أو Deals");
openMockCheckout({planId:"PLAN-SCALE",context:"billing"});
updateMockCheckoutInvoice({companyName:"وكالة اختبار",email:"billing@example.test"});
continueMockCheckoutPayment("PM-1001");
check("I",failMockCheckout("فشل تجريبي")?.status==="failed_mock","مسار الفشل التجريبي يعلن الحالة ولا ينشئ فاتورة");
check("J",closeMockCheckout()&&state.s11Ui.checkout===null,"يمكن إغلاق الفشل والعودة إلى الفوترة بأمان");
const integrity=getPaymentCheckoutIntegrityReport();
check("K",integrity.pass,"عقد Checkout يمنع بيانات البطاقة الخام ويحافظ على الحالات المعلنة");
const paymentSource=fs.readFileSync(new URL("../.ui-sources/settings.txt",import.meta.url),"utf8");
const landingSource=fs.readFileSync(new URL("../.ui-sources/landing.txt",import.meta.url),"utf8");
const referenceSource=fs.readFileSync(new URL("../.ui-sources/landing.txt",import.meta.url),"utf8");
check("L",paymentSource.includes("محاكاة محلية")&&paymentSource.includes("لا تدخل أي رقم بطاقة أو CVV"),"واجهة Checkout تفصح عن كونها محاكاة محلية");
check("M",landingSource.includes("لا تقرر الباقة الآن")&&landingSource.includes("الخطوة ١ من ٤"),"Landing تبدأ بالاستخراج قبل قرار الباقة");
check("N",referenceSource.includes("١ استخراج · ٢ نتائج · ٣ اختيار · ٤ تفعيل"),"Discovery تعرض مسارًا موجهًا خطوة بخطوة");

if(failures.length){console.error(`\n${failures.length} failure(s)`);process.exit(1);}console.log("\n14/14 PAYMENT-CHECKOUT checks passed.");
