const MAX_BYTES=80*1024*1024,MAX_PAGES=200;
export function validateSlideFiles(input){
  const files=Array.from(input);
  if(!files.length)throw new Error('Оберіть PDF або зображення слайдів.');
  if(files.some(file=>/\.(pptx?|key)$/i.test(file.name)))throw new Error('Збережіть PowerPoint або Keynote як PDF та завантажте сюди. Для анімацій скористайтеся показом вікна презентації.');
  if(files.reduce((sum,file)=>sum+file.size,0)>MAX_BYTES)throw new Error('Загальний розмір має бути до 80 МБ. Зменште розмір файлів і спробуйте знову.');
  if(files.some(file=>file.size===0))throw new Error('Один із файлів порожній. Оберіть інший файл.');
  if(files.length===1&&/\.pdf$/i.test(files[0].name))return {type:'pdf',files};
  if(files.length>MAX_PAGES)throw new Error('За один раз можна додати до 200 слайдів.');
  if(!files.every(file=>/\.(png|jpe?g|webp)$/i.test(file.name)))throw new Error('Оберіть один PDF або набір JPG, PNG чи WebP. PDF не можна змішувати із зображеннями.');
  return {type:'images',files:files.sort((a,b)=>a.name.localeCompare(b.name,'uk',{numeric:true}))};
}
export function normalizeWebsite(input){
  const value=String(input).trim();
  if(!value)throw new Error('Вставте посилання на сайт.');
  const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(value)?value:`https://${value}`);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Використайте звичайне http або https посилання без пароля в адресі.');
  return url.href;
}
export async function loadSlideDeck(input){
  const {type,files}=validateSlideFiles(input);
  if(type==='pdf'){
    const pdfjs=await import('./vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
    const task=pdfjs.getDocument({data:new Uint8Array(await files[0].arrayBuffer()),isEvalSupported:false,
      cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
      standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,
      wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,
      iccUrl:new URL('./vendor/pdfjs/iccs/',import.meta.url).href});
    let pdf;
    try{pdf=await task.promise;}catch(error){await task.destroy();throw new Error(error.name==='PasswordException'?'Цей PDF захищений паролем. Додайте копію без пароля.':'Не вдалося прочитати PDF. Перевірте файл або експортуйте презентацію заново.');}
    if(pdf.numPages>MAX_PAGES){await task.destroy();throw new Error('У PDF більше 200 сторінок. Розділіть презентацію на менші файли.');}
    return {name:files[0].name,count:pdf.numPages,type,
      async render(index){
        const page=await pdf.getPage(index+1),base=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(1920/base.width,1080/base.height)});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        try{await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return canvas;}
        finally{page.cleanup();}
      },dispose:()=>task.destroy()};
  }
  return {name:files.length===1?files[0].name:`Зображення: ${files.length}`,count:files.length,type,
    async render(index){
      const url=URL.createObjectURL(files[index]);
      try{
        const image=new Image();image.src=url;await image.decode();
        const scale=Math.min(1920/image.naturalWidth,1080/image.naturalHeight,1);
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;
      }catch{throw new Error(`Не вдалося відкрити зображення «${files[index].name}».`);}finally{URL.revokeObjectURL(url);}
    },dispose:async()=>{}};
}
