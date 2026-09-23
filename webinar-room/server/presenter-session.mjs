import {SignJWT,jwtVerify} from 'jose';
const cookieName='__Host-ik-presenter';
export function createPresenterSessions({secret,ownerId='511274530',now=()=>Date.now()}={}){
  const key=()=>{if(typeof secret!=='string'||secret.length<32)throw new Error('NOT_CONFIGURED');return new TextEncoder().encode(secret);};
  const verify=(token,issuer,audience)=>jwtVerify(token,key(),{algorithms:['HS256'],issuer,audience,currentDate:new Date(now())});
  return {
    async create(ticket){
      const {payload}=await verify(ticket,'ik-webinar-access','ik-presenter');
      if(payload.sub!==ownerId||payload.scope!=='presenter')throw new Error('DENIED');
      const issued=Math.floor(now()/1000);
      const token=await new SignJWT({scope:'presenter'}).setProtectedHeader({alg:'HS256'}).setIssuer('ik-studio-session').setAudience('ik-private-studio').setSubject(ownerId).setIssuedAt(issued).setExpirationTime(issued+28800).sign(key());
      return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800`;
    },
    async read(request){try{
      const entry=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
      if(!entry)return null;
      const {payload}=await verify(entry.slice(cookieName.length+1),'ik-studio-session','ik-private-studio');
      return payload.sub===ownerId&&payload.scope==='presenter'?{id:ownerId,name:'Іван Косович'}:null;
    }catch{return null;}}
  };
}
