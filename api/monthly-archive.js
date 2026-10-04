const FIREBASE='https://hakniot-default-rtdb.firebaseio.com/sharedLists/241361';
const RULE='v4-base6000-overtime44-53-weekend440';
const OT1=44,OT2=53,MEDICAL=140.86;
function prevMonth(){const d=new Date();const y=d.getUTCFullYear(),m=d.getUTCMonth();const x=new Date(Date.UTC(y,m-1,1));return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')}
async function getJson(path){const r=await fetch(FIREBASE+'/'+path+'.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('GET '+path+' '+r.status);return r.json()}
async function putJson(path,data){const r=await fetch(FIREBASE+'/'+path+'.json',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw new Error('PUT '+path+' '+r.status)}
function round2(n){return Math.round((Number(n||0)+Number.EPSILON)*100)/100}
function mins(rec){if(Number.isFinite(Number(rec?.outsideMinutes)))return Math.max(0,Number(rec.outsideMinutes));const seg=Array.isArray(rec?.segments)?rec.segments:Object.values(rec?.segments||{});return seg.reduce((sum,s)=>{const a=String(s?.start||'').split(':').map(Number),b=String(s?.end||'').split(':').map(Number);if(a.length<2||b.length<2)return sum;let st=a[0]*60+a[1],en=b[0]*60+b[1];if(en<st)en+=1440;return sum+Math.max(0,en-st)},0)}
function calc(rec){const outside=Math.max(0,Math.round(mins(rec))),ot=Math.max(0,outside-480),m1=Math.min(120,ot),m2=Math.max(0,ot-120),amount=round2(OT1*m1/60+OT2*m2/60);return {outsideMinutes:outside,overtimeMinutes:ot,payrollAdjustmentAmount:amount,overtimeAmount:amount}}
function recMonth(x){return String(x?.month||x?.details?.month||x?.date||x?.paymentDate||'').slice(0,7)}
export default async function handler(req,res){
  try{
    const month=prevMonth();
    const existing=await getJson('monthlyArchive/'+month);
    if(existing){res.status(200).json({ok:true,month,existing:true});return}
    const [allHours,payrollState,signatures]=await Promise.all([getJson('workHours').catch(()=>({})),getJson('nargizaPayrollV2').catch(()=>({})),getJson('salarySignatures').catch(()=>({}))]);
    const hours={};for(const [k,v] of Object.entries(allHours||{})){const d=String(v?.date||k);if(d.startsWith(month))hours[k]=v}
    let overtimeMinutes=0,overtimeAmount=0;for(const rec of Object.values(hours)){if(rec?.status==='approved'){const c=calc(rec);overtimeMinutes+=c.overtimeMinutes;overtimeAmount+=c.payrollAdjustmentAmount}}
    overtimeMinutes=Math.round(overtimeMinutes);overtimeAmount=round2(overtimeAmount);
    const payroll=payrollState?.months?.[month]||null;
    let monthlySummary=payroll?{...payroll,overtimeMinutes,overtimeAmount,overtimeRuleVersion:RULE}:{month,status:'hours_only',overtimeMinutes,overtimeAmount,overtimeRuleVersion:RULE,total:null};
    if(payroll)monthlySummary.total=round2(Number(monthlySummary.base||0)+Number(monthlySummary.weekendsAmount||0)+Number(monthlySummary.holidaysAmount||0)+Number(monthlySummary.otherPlus||0)+overtimeAmount-Number(monthlySummary.medicalDeduction??MEDICAL)-Number(monthlySummary.economyDeduction||0)-Number(monthlySummary.deductions||0));
    const payments=(payrollState?.payments||[]).filter(p=>recMonth(p)===month);
    const approvals={};for(const [k,v] of Object.entries(signatures||{})){if(recMonth(v)===month)approvals[k]=v}
    const snap={month,employee:{nameHe:"נרגיזה נג'מייבה",nameRu:'Наргиза Наджмиева',nameLatin:'NARGIZA NAJMIEVA',passport:'FB2092675'},archivedAt:Date.now(),archivedBy:'system',archiveSource:'vercel-cron',archiveVersion:1,appVersion:'206.0-monthly-archive',workRuleVersion:RULE,immutableSnapshot:true,hours,payroll,payments,approvals,monthlySummary};
    await putJson('monthlyArchive/'+month,snap);
    res.status(200).json({ok:true,month,existing:false,hours:Object.keys(hours).length,payments:payments.length,approvals:Object.keys(approvals).length,total:monthlySummary.total});
  }catch(e){console.error(e);res.status(500).json({ok:false,error:String(e?.message||e)})}
}