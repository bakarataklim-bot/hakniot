import webpush from 'web-push';

const FIREBASE_BASE='https://hakniot-default-rtdb.firebaseio.com/sharedLists';
const API_KEY=process.env.FIREBASE_WEB_API_KEY;
const VAPID_PUBLIC_KEY=process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY=process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT=process.env.VAPID_SUBJECT||'mailto:bakarataklim@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

async function getAnonToken(){
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(API_KEY),{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({returnSecureToken:true})
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.idToken)throw new Error('AUTH '+r.status+' '+String(j?.error?.message||''));
  return j.idToken;
}

function titleFor(kind){
  if(kind==='test')return 'דואגים ביחד';
  if(kind==='shopping')return 'עדכון בקניות';
  if(kind==='message')return 'הודעה חדשה';
  if(kind==='task')return 'משימה חדשה';
  return 'דואגים ביחד';
}

export default async function handler(req,res){
  if(req.method!=='POST'){res.status(405).json({ok:false,error:'method_not_allowed'});return}
  try{
    const body=req.body||{};
    const code=String(body.code||'');
    if(!/^\d{6}$/.test(code)){res.status(400).json({ok:false,error:'bad_code'});return}
    const tok=await getAnonToken();
    const url=FIREBASE_BASE+'/'+encodeURIComponent(code)+'/pushSubscriptions.json?auth='+encodeURIComponent(tok);
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('DB '+r.status+' '+(await r.text()));
    const all=await r.json()||{};
    const payload=JSON.stringify({
      title:titleFor(body.kind),
      body:body.text||body.message||body.title||'יש עדכון חדש באפליקציה',
      url:'/',
      kind:body.kind||'general'
    });
    const entries=Object.entries(all).filter(([id])=>id!==String(body.senderId||''));
    let sent=0,failed=0;
    for(const [id,rec] of entries){
      if(body.targetId && id!==String(body.targetId))continue;
      const sub=rec?.subscription;
      if(!sub?.endpoint)continue;
      try{
        await webpush.sendNotification(sub,payload,{TTL:60});
        sent++;
      }catch(e){
        failed++;
        if(e?.statusCode===404||e?.statusCode===410){
          fetch(FIREBASE_BASE+'/'+encodeURIComponent(code)+'/pushSubscriptions/'+encodeURIComponent(id)+'.json?auth='+encodeURIComponent(tok),{method:'DELETE'}).catch(()=>{});
        }
      }
    }
    res.status(200).json({ok:true,sent,failed});
  }catch(e){
    console.error('notify',e);
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}