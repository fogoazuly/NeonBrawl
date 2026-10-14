// Capture a PixoPlays invite ?join=CODE into sessionStorage BEFORE anything
// else can strip the URL or trigger a reload. PixoCloudSave's first-sync
// reload was wiping the join param on fresh sessions, killing accepted
// invites. With this stash, the join code survives one reload and the
// game's auto-join logic reads it back. Runs inline pre-bootstrap.
(function(){
  try{
    const raw = new URLSearchParams(location.search).get('join');
    if(raw){
      const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(code.length>=4){
        sessionStorage.setItem('_nbInviteCode', code);
        sessionStorage.setItem('_nbInviteAt', String(Date.now()));
      }
    }
  }catch(_){}
})();
