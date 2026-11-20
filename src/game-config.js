export function normalizeConfig(value){const n=Number(value?.gameTimeSeconds);return{gameTimeSeconds:Number.isInteger(n)&&n>=5&&n<=3600?n:30};}
export async function loadConfig(){try{return normalizeConfig(window.glowPlayers?await window.glowPlayers.config():await(await fetch('./game-config.json',{cache:'no-store'})).json());}catch{return normalizeConfig();}}
