// A fresh state per session; maps and readiness objects must never be shared.
export function createMultiplayerState() {
return {
  peer:null, conns:new Map(), connected:false, soloMode:true,
  myId:0, isHost:true, syncT:0, hostSyncT:0, nextId:1, roomCode:null,
  hostDifficulty:'hard', // difficulty chosen by the host, shown to the lobby + applied on start
  names:{},
  userIds:{}, // playerId -> supabase auth user id (or null for guests)
  pingT:0, lastHostSeen:0, intentionalDisconnect:false,
  revivePingT:0,
  buffReady:{}, buffPlayers:null, buffStartQueued:false,
  exitReady:{}, exitPlayers:null, exitStartQueued:false, exitMode:'',
  gunReady:{}, gunPlayers:null, gunStartQueued:false,
  meleeReady:{}, meleePlayers:null, meleeStartQueued:false,
  rematchReady:{}, rematchPlayers:null, rematchStartQueued:false,
  contribStats:{},
  remotePlayers:{},
};
}
export const MP_PLAYER_SYNC_DT = 1 / 30; // 30Hz, small player packet
export const MP_HOST_SYNC_DT = 1 / 20;   // 20Hz heavier enemy snapshot, smoothed on clients
export const MP_PING_DT = 1.0;
export const MP_TIMEOUT = 8.0;
export const MP_REMOTE_SMOOTH = 18;
export const MP_ENEMY_SMOOTH = 14;


