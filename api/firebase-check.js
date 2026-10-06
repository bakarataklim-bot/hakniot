const DB='https://hakniot-default-rtdb.firebaseio.com/sharedLists/241361';
const API_KEY=process.env.FIREBASE_WEB_API_KEY;
export default async function handler(req,res){
  const out={};
  try{
    const ar=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(API_KEY),{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})
    });
    const aj=await ar.json().catch(()=>({}));
    out.auth={ok:ar.ok,status:ar.status,error:aj?.error?.message||null};
    if(ar.ok&&aj.idToken){
      const tok=aj.idToken;
      for(const [name,path] of [['shared','shoppingCategories'],['payroll','nargizaPayrollV2'],['hours','workHours']]){
        const r=await fetch(DB+'/'+path+'.json?shallow=true&auth='+encodeURIComponent(tok),{cache:'no-store'});
        out[name]={ok:r.ok,status:r.status,body:r.ok?null:(await r.text()).slice(0,180)};
      }
    }
    res.status(200).json(out);
  }catch(e){res.status(500).json({error:String(e?.message||e),...out})}
}