function cleanUrl(value){try{const url=new URL(value);return url.protocol==='https:'?url.origin:null;}catch{return null;}}
export function createPremiereStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_API_KEY,secret=process.env.ANALYTICS_API_SECRET,fetchFn=fetch}={}){
  const origin=cleanUrl(url),configured=!!(origin&&key&&secret);
  const headers=()=>({'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'x-analytics-secret':secret});
  async function request(path,options={}){if(!configured)throw new Error('PREMIERE_STORE_NOT_CONFIGURED');const response=await fetchFn(`${origin}/rest/v1/${path}`,{...options,headers:{...headers(),...(options.headers||{})}});if(!response.ok)throw new Error(`SUPABASE_${response.status}`);const text=await response.text();return text?JSON.parse(text):null;}
  return {
    configured,
    async ingest(event){
      const log=await request(`premiere_webhook_events?on_conflict=event_key`,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({event_key:event.eventKey,event_type:event.eventType,telegram_id:event.telegramId,payload:event.raw})});
      if(!log?.length)return {duplicate:true};
      const contact={telegram_id:event.telegramId,sendpulse_contact_id:event.contactId,user_name:event.name,username:event.username,funnel_started_at:event.funnelStartedAt,funnel_stage:event.stage,funnel_status:event.status,eligible:event.eligible,webinar_at:event.webinarAt,unsubscribed:event.unsubscribed,updated_at:new Date().toISOString()};
      if(event.eventType==='reminder_sent')contact.reminder_sent_at=event.occurredAt;
      if(event.eventType==='room_link_sent')contact.room_link_sent_at=event.occurredAt;
      await request(`premiere_contacts?on_conflict=telegram_id`,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(contact)});
      return {duplicate:false};
    },
    async getContact(telegramId){const rows=await request(`premiere_contacts?telegram_id=eq.${encodeURIComponent(telegramId)}&select=*&limit=1`);return rows?.[0]||null;},
    listContacts(){return request('premiere_contacts?select=*&order=updated_at.desc&limit=1000');},
    markOpened(telegramId){return request(`premiere_contacts?telegram_id=eq.${encodeURIComponent(telegramId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({room_opened_at:new Date().toISOString(),updated_at:new Date().toISOString()})});}
  };
}

export function normalizeFunnelEvent(body={}){
  const eventType=String(body.event_type||body.eventType||'funnel_completed');
  const telegramId=String(body.telegram_id||body.telegramId||'');
  const contactId=String(body.contact_id||body.contactId||'');
  const occurredAt=new Date(body.occurred_at||body.occurredAt||body.completed_at||body.completedAt||Date.now());
  const suppliedWebinarAt=new Date(body.webinar_at||body.webinarAt||'');
  const hasSuppliedWebinarAt=Number.isFinite(suppliedWebinarAt.getTime());
  const completed=eventType==='funnel_completed'||eventType==='reminder_sent'||eventType==='room_link_sent';
  if(!Number.isFinite(occurredAt.getTime()))throw new Error('INVALID_EVENT_TIME');
  const webinarAt=hasSuppliedWebinarAt?suppliedWebinarAt:new Date(occurredAt.getTime()+48*60*60*1000);
  const eventKey=String(body.event_key||body.eventKey||`${eventType}:${contactId||telegramId}:${completed?webinarAt.toISOString():occurredAt.toISOString()}`);
  if(!['funnel_started','funnel_progress','funnel_completed','unsubscribed','reminder_sent','room_link_sent'].includes(eventType)||!/^[1-9]\d{3,19}$/.test(telegramId)||!eventKey||eventKey.length>180)throw new Error('INVALID_FUNNEL_EVENT');
  if(completed&&!Number.isFinite(webinarAt.getTime()))throw new Error('INVALID_WEBINAR_TIME');
  return {eventType,eventKey,telegramId,contactId:contactId.slice(0,120),name:String(body.name||'').slice(0,100),username:String(body.username||'').slice(0,64),funnelStartedAt:body.funnel_started_at||body.funnelStartedAt||null,stage:String(body.stage||eventType).slice(0,80),status:eventType==='unsubscribed'?'unsubscribed':completed?'completed':'active',eligible:completed&&eventType!=='unsubscribed',webinarAt:completed?webinarAt.toISOString():hasSuppliedWebinarAt?suppliedWebinarAt.toISOString():null,occurredAt:occurredAt.toISOString(),unsubscribed:eventType==='unsubscribed',raw:body};
}
