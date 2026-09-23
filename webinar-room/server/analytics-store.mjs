const MAX_EVENTS=10000;
function cleanUrl(value){try{const url=new URL(value);return url.protocol==='https:'?url.origin:null;}catch{return null;}}
export function createAnalyticsStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_API_KEY,secret=process.env.ANALYTICS_API_SECRET,fetchFn=fetch}={}){
  const origin=cleanUrl(url),configured=!!(origin&&key&&secret);
  const headers=()=>({'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'x-analytics-secret':secret});
  async function request(path,options={}){if(!configured)throw new Error('ANALYTICS_NOT_CONFIGURED');const response=await fetchFn(`${origin}/rest/v1/${path}`,{...options,headers:{...headers(),...(options.headers||{})}});if(!response.ok)throw new Error(`SUPABASE_${response.status}`);const text=await response.text();return text?JSON.parse(text):null;}
  return {
    configured,
    insert(event){return request('webinar_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(event)});},
    list(){return request(`webinar_events?select=*&order=occurred_at.asc&limit=${MAX_EVENTS}`,{method:'GET'});}
  };
}

export function summarizeAnalytics(events=[]){
  const people=new Map(),slides=[...events].filter(event=>event.event_type==='slide_change').sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)));
  const slideAt=time=>{let value=null;for(const event of slides){if(event.occurred_at>time)break;value=event.slide_number;}return value;};
  for(const event of events){if(event.actor_role!=='viewer'||!event.telegram_id)continue;const person=people.get(event.telegram_id)||{telegramId:event.telegram_id,name:event.user_name||'Без імені',username:event.username||'',openedAt:null,lastSeenAt:null,watchSeconds:0,lastSlide:null,recordings:new Set(),questions:0,ctaClicks:0};person.name=event.user_name||person.name;person.username=event.username||person.username;if(!person.openedAt||event.occurred_at<person.openedAt)person.openedAt=event.occurred_at;if(!person.lastSeenAt||event.occurred_at>person.lastSeenAt){person.lastSeenAt=event.occurred_at;person.lastSlide=event.slide_number||slideAt(event.occurred_at)||person.lastSlide;}person.watchSeconds=Math.max(person.watchSeconds,Number(event.watch_seconds)||0);if(event.recording_id)person.recordings.add(event.recording_id);if(event.event_type==='question')person.questions++;if(event.event_type==='cta_click')person.ctaClicks++;people.set(event.telegram_id,person);}
  const viewers=[...people.values()].map(person=>({...person,recordings:[...person.recordings]})).sort((a,b)=>String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  return {configured:true,totalViewers:viewers.length,totalWatchSeconds:viewers.reduce((sum,item)=>sum+item.watchSeconds,0),recordingViewers:viewers.filter(item=>item.recordings.length).length,totalQuestions:viewers.reduce((sum,item)=>sum+item.questions,0),totalCtaClicks:viewers.reduce((sum,item)=>sum+item.ctaClicks,0),viewers};
}

function csvCell(value){const text=String(value??'');return /[",\n\r]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
export function analyticsCsv(summary){const rows=[['Telegram ID','Ім’я','Username','Відкрив','Остання активність','Час перегляду, сек','Останній слайд','Переглянуто записів','Запитань','Натискань CTA'],...summary.viewers.map(item=>[item.telegramId,item.name,item.username,item.openedAt,item.lastSeenAt,item.watchSeconds,item.lastSlide||'',item.recordings.length,item.questions,item.ctaClicks])];return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
