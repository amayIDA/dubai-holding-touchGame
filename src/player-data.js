export function normalName(value){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().replace(/\s+/g,' ').slice(0,40);}
export function rankPlayers(rows){return [...rows].sort((a,b)=>b.score-a.score||a.playedAt.localeCompare(b.playedAt)||a.id.localeCompare(b.id));}
export function toCSV(rows){const cell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';return 'Name,Score,Played at,Round ID,Leaderboard session\r\n'+rows.map(row=>[row.name,row.score,row.playedAt,row.id,row.sessionId||'legacy'].map(cell).join(',')).join('\r\n')+'\r\n';}

export function leaderboardView(rows,id,elapsed=0){const ranked=rankPlayers(rows),index=ranked.findIndex(row=>row.id===id),spotlight=index>=10&&elapsed<5000?{...ranked[index],rank:index+1}:null;return{top:ranked.slice(0,spotlight?9:10),spotlight};}
