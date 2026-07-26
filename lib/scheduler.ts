type Interval={user_id:string;day_of_week:number;start_time:string;end_time:string;kind:string};
type Member={user_id:string;preferred_day:number|null;preferred_start:string|null};
const mins=(t:string)=>{const[h,m]=t.split(":").map(Number);return h*60+m};
const clock=(n:number)=>{const h=Math.floor(n/60),m=n%60,period=h>=12?"PM":"AM",hour=h%12||12;return `${hour}:${String(m).padStart(2,"0")} ${period}`};
export function findBestTimes(members:Member[],intervals:Interval[],duration=120){
 const candidates:{day:number;start:number;end:number;users:string[];score:number}[]=[];
 for(let day=0;day<7;day++)for(let start=0;start+duration<=1440;start+=30){const end=start+duration,users=members.filter(member=>{const own=intervals.filter(x=>x.user_id===member.user_id&&x.day_of_week===day);const available=own.filter(x=>x.kind==="available").some(x=>mins(x.start_time)<=start&&mins(x.end_time)>=end);const working=own.filter(x=>x.kind==="work").some(x=>mins(x.start_time)<end&&mins(x.end_time)>start);return available&&!working}).map(x=>x.user_id);if(users.length){const preference=members.reduce((score,m)=>score+(m.preferred_day===day?2:0)+(m.preferred_start&&Math.abs(mins(m.preferred_start)-start)<=60?1:0),0);candidates.push({day,start,end,users,score:users.length*100+preference})}}
 return candidates.sort((a,b)=>b.score-a.score||a.day-b.day||a.start-b.start).slice(0,3).map(x=>({...x,label:`${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][x.day]} at ${clock(x.start)}`,perfect:x.users.length===members.length}))
}
