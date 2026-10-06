const FIREBASE_BASE='https://hakniot-default-rtdb.firebaseio.com/sharedLists';
const API_KEY=process.env.FIREBASE_WEB_API_KEY;

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

export default async function handler(req,res){
  if(req.method!=='POST'){res.status(405).json({ok:false,error:'method_not_allowed'});return}
  try{
    const {subscription,clientId,code,appVersion,role,lang}=req.body||{};
    if(!subscription||!clientId||!/^\d{6}$/.test(String(code||''))){
      res.status(400).json({ok:false,error:'bad_request'});return
    }
    const tok=await getAnonToken();
    const url=FIREBASE_BASE+'/'+encodeURIComponent(code)+'/pushSubscriptions/'+encodeURIComponent(clientId)+'.json?auth='+encodeURIComponent(tok);
    const r=await fetch(url,{
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({subscription,updatedAt:Date.now(),appVersion:appVersion||'',role:role||'family',lang:lang||'he'})
    });
    if(!r.ok)throw new Error('DB '+r.status+' '+(await r.text()));
    res.status(200).json({ok:true});
  }catch(e){
    console.error('push-subscribe',e);
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
}