const sessionId=crypto.randomUUID();
window.addEventListener('studio:slide-change',event=>fetch('/api/analytics/events',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({eventType:'slide_change',sessionId,slideNumber:event.detail?.slideNumber})}).catch(()=>{}));
