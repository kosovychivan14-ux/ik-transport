const PEOPLE=[
  {name:'Олена Коваль',country:'Німеччина',countryCode:'de'},
  {name:'Андрій Мельник',country:'Польща',countryCode:'pl'},
  {name:'Марія Шевченко',country:'Чехія',countryCode:'cz'},
  {name:'Тарас Бондар',country:'Італія',countryCode:'it'},
  {name:'Ірина Ткачук',country:'Іспанія',countryCode:'es'},
  {name:'Віталій Мороз',country:'Португалія',countryCode:'pt'},
  {name:'Наталія Левченко',country:'Канада',countryCode:'ca'},
  {name:'Роман Кравчук',country:'США',countryCode:'us'},
  {name:'Юлія Савчук',country:'Велика Британія',countryCode:'gb'},
  {name:'Богдан Олійник',country:'Нідерланди',countryCode:'nl'},
];

export function createAudienceActivity({onChange,random=Math.random,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let count=52,index=0,timer=0,running=false,feed=[];
  const emit=()=>onChange?.({count,participants:[...feed]});
  function step(){
    const center=count<60?1:count>67?-1:random()<.52?1:-1;
    const delta=center*(random()<.18?2:1);count=Math.max(50,Math.min(80,count+delta));
    const person=PEOPLE[index++%PEOPLE.length];
    feed=[{...person,joined:center>0},...feed.filter(item=>item.name!==person.name)].slice(0,10);emit();schedule();
  }
  function schedule(){if(running)timer=setTimer(step,18000+Math.floor(random()*14000));}
  return {start(){if(running)return;running=true;feed=PEOPLE.map(person=>({...person,joined:true}));emit();schedule();},stop(){running=false;clearTimer(timer);timer=0;},get running(){return running;}};
}
