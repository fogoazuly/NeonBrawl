// Transport only: message interpretation and room lifecycle stay with the game.
export function createTransport(mp, { getPeerConfig }) {
function broadcastMP(msg, excludeId=-1){
  const s=typeof msg==='string'?msg:JSON.stringify(msg);
  for(const [id,conn] of mp.conns){
    if(id!==excludeId&&conn.open){ try{ conn.send(s); }catch(e){} }   // a throw on one stale connection must not skip delivery to the rest
  }
}

function sendToHost(msg){
  const s=typeof msg==='string'?msg:JSON.stringify(msg);
  const conn=mp.conns.get(0);
  if(conn&&conn.open) conn.send(s);
}


return { broadcastMP, sendToHost, getPeerConfig };
}
