(() => {
  'use strict';
  const names=['white','pink','yellow','blue','purple','red','black','green'];
  const radii=[20,25,31,38,46,55,65,77];
  const images=names.map(n=>{const im=new Image(); im.src=`assets/${n}.png`; return im});
  const el=id=>document.getElementById(id);
  const canvas=el('canvas'), ctx=canvas.getContext('2d'), area=el('game');
  const scoreEl=el('score'),bestEl=el('best'),nextImg=el('nextImg'),overlay=el('overlay');
  const W=400, PREVIEW_Y=84, DANGER_Y=160; let H=590, balls=[], score=0, best=0, current=0,next=0,aim=200,last=0,acc=0,dropLock=0,over=false,highTime=0,shake=0;
  let greenCount=0,diceCount=0,scoreHistory=[],recordToBeat=0,recordAwardedThisRun=false,runRecorded=true,collectionOpen=false,toastTimer=0;
  let hammerCount=0,hammerMode=false,videoOpen=false,videoFurthest=0;
  const particles=[];
  try{best=Number(localStorage.getItem('cortis-merge-best'))||0}catch{} bestEl.textContent=best;
  try{greenCount=Math.max(0,Number(localStorage.getItem('cortis-merge-greens'))||0);diceCount=Math.max(0,Number(localStorage.getItem('cortis-merge-dice'))||0);const saved=JSON.parse(localStorage.getItem('cortis-merge-scores')||'[]');if(Array.isArray(saved))scoreHistory=saved.slice(0,10)}catch{}
  try{hammerCount=Math.max(0,Math.floor(Number(localStorage.getItem('cortis-merge-hammers'))||0))}catch{}
  const save=(key,value)=>{try{localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value))}catch{}};
  el('chain').innerHTML=names.map((n,i)=>`<div class="chain-item" title="第 ${i+1} 级"><img src="assets/${n}.png" alt="${n} Ball"><b>${i+1}</b></div>`).join('');
  // White through red can drop; black and green remain merge-only rewards.
  const dropWeights=[34,25,18,11,8,4];
  const rnd=()=>{let roll=Math.random()*100;for(let i=0;i<dropWeights.length;i++){roll-=dropWeights[i];if(roll<0)return i}return 0};
  const soundButton=el('soundToggle');
  let soundOn=true,audioContext=null,audioBuffer=null,lastSoundAt=0;
  try{soundOn=localStorage.getItem('cortis-merge-sound')!=='off'}catch{}
  function showSoundState(){soundButton.textContent=soundOn?'音效：开':'音效：关';soundButton.setAttribute('aria-pressed',String(soundOn))}
  showSoundState();
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(AudioContextClass){
    audioContext=new AudioContextClass();
    fetch('assets/collision.mp3?v=2').then(response=>{if(!response.ok)throw Error('audio unavailable');return response.arrayBuffer()}).then(data=>audioContext.decodeAudioData(data)).then(decoded=>{audioBuffer=decoded}).catch(()=>{});
  }
  function unlockSound(){if(soundOn&&audioContext?.state==='suspended')audioContext.resume().catch(()=>{})}
  function playCollision(speed,firstLanding=false){
    if(!soundOn||!audioContext||!audioBuffer||audioContext.state!=='running')return;
    if(!firstLanding&&speed<7)return;
    const now=performance.now();if(!firstLanding&&now-lastSoundAt<650)return;lastSoundAt=now;
    const source=audioContext.createBufferSource(),gain=audioContext.createGain();source.buffer=audioBuffer;
    gain.gain.value=firstLanding?.19:Math.min(.23,.10+speed*.008);source.connect(gain).connect(audioContext.destination);source.start();
  }
  function firstContact(a,b){
    if(a.landingSoundPending||b?.landingSoundPending){
      a.landingSoundPending=false;a.hasLanded=true;if(b){b.landingSoundPending=false;b.hasLanded=true}
      playCollision(0,true);
      return true;
    }
    return false;
  }
  function size(){const rect=area.getBoundingClientRect();H=W*rect.height/rect.width;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);aim=Math.max(radii[current]+4,Math.min(W-radii[current]-4,aim))}
  new ResizeObserver(size).observe(area);size();
  function recordRun(){if(runRecorded||score<=0)return;runRecorded=true;scoreHistory.unshift({score,date:new Date().toISOString()});scoreHistory=scoreHistory.slice(0,10);save('cortis-merge-scores',scoreHistory)}
  function showToast(){const toast=el('recordToast');toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,4200)}
  function hammerStatus(message){el('hammerStatus').textContent=message}
  function updateHammer(){el('useHammer').textContent=`🔨 使用锤子 ×${hammerCount}`;el('useHammer').disabled=hammerCount===0||over;el('useHammer').setAttribute('aria-pressed',String(hammerMode));area.classList.toggle('hammer-mode',hammerMode);el('hammerCount').textContent=hammerCount}
  const unlockVideo=el('unlockVideo');
  function closeVideo(){unlockVideo.pause();unlockVideo.currentTime=0;videoOpen=false;el('videoGate').hidden=true;el('playUnlockVideo').hidden=true;updateHammer();el('watchHammer').focus()}
  function playVideo(){const pending=unlockVideo.play();if(pending?.catch)pending.catch(()=>{el('playUnlockVideo').hidden=false;el('videoStatus').textContent='点击播放，观看完整视频后领取锤子。'})}
  function openVideo(){if(videoOpen||collectionOpen)return;hammerMode=false;updateHammer();videoOpen=true;videoFurthest=0;unlockVideo.pause();unlockVideo.currentTime=0;unlockVideo.playbackRate=1;el('videoProgress').value=0;el('videoStatus').textContent='观看完整视频后自动领取一把锤子，请勿快进。';el('videoGate').hidden=false;el('playUnlockVideo').hidden=true;el('closeVideo').focus();playVideo()}
  el('watchHammer').addEventListener('click',openVideo);
  el('closeVideo').addEventListener('click',()=>{closeVideo();hammerStatus('已退出视频，本次没有领取锤子。')});
  el('playUnlockVideo').addEventListener('click',playVideo);
  el('muteUnlockVideo').addEventListener('click',()=>{unlockVideo.muted=!unlockVideo.muted;el('muteUnlockVideo').textContent=unlockVideo.muted?'开启视频声音':'关闭视频声音'});
  unlockVideo.addEventListener('seeking',()=>{if(videoOpen&&unlockVideo.currentTime>videoFurthest+.3)unlockVideo.currentTime=videoFurthest});
  unlockVideo.addEventListener('ratechange',()=>{if(unlockVideo.playbackRate!==1)unlockVideo.playbackRate=1});
  unlockVideo.addEventListener('timeupdate',()=>{if(!videoOpen||unlockVideo.seeking)return;if(unlockVideo.currentTime<=videoFurthest+1)videoFurthest=Math.max(videoFurthest,unlockVideo.currentTime);el('videoProgress').value=unlockVideo.duration?Math.min(100,videoFurthest/unlockVideo.duration*100):0});
  unlockVideo.addEventListener('ended',()=>{if(!videoOpen)return;if(!Number.isFinite(unlockVideo.duration)||videoFurthest<unlockVideo.duration-1.25){unlockVideo.currentTime=videoFurthest;el('videoStatus').textContent='还没有看完，请继续播放。';el('playUnlockVideo').hidden=false;return}hammerCount++;save('cortis-merge-hammers',String(hammerCount));closeVideo();hammerStatus('领取成功！点击“使用锤子”，再点选一个可消除的球。')});
  unlockVideo.addEventListener('error',()=>{if(videoOpen){el('videoStatus').textContent='视频加载失败，请检查网络后重试。';el('playUnlockVideo').hidden=false}});
  el('useHammer').addEventListener('click',()=>{if(!hammerCount||over||videoOpen)return;hammerMode=!hammerMode;updateHammer();hammerStatus(hammerMode?'点选场上的白、粉、黄、蓝、紫或红球，消耗一把锤子。':'已取消选择，锤子仍在背包里。');if(hammerMode)area.focus()});
  function useHammerAt(e){const rect=area.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*H;const ball=[...balls].reverse().find(b=>b.level<=5&&!b.dead&&Math.hypot(b.x-x,b.y-y)<=b.r*1.08);if(!ball){hammerStatus('请点选白、粉、黄、蓝、紫或红球；黑球和绿球无法消除。');return}ball.dead=true;balls=balls.filter(b=>!b.dead);hammerCount--;save('cortis-merge-hammers',String(hammerCount));hammerMode=false;updateHammer();hammerStatus('消除成功！');const flash=document.createElement('span');flash.className='hammer-flash';flash.textContent='✦';flash.style.left=`${x/W*100}%`;flash.style.top=`${y/H*100}%`;area.append(flash);setTimeout(()=>flash.remove(),650)}
  function renderCollection(){
    el('greenCount').textContent=greenCount;el('diceCount').textContent=diceCount;el('collectionBest').textContent=best.toLocaleString();
    for(const [id,count,src,label] of [['greenWall',greenCount,'assets/green.png','绿球'],['diceWall',diceCount,'assets/cortis-dice-cartoon.png','骰子']]){
      const total=Math.max(24,Math.ceil((count+6)/6)*6);
      el(id).innerHTML=Array.from({length:total},(_,i)=>`<div class="collection-slot ${i<count?'filled':'empty'}" title="${i<count?'已收集':'尚未收集'}${label} #${i+1}"><img src="${src}" alt=""><span>${String(i+1).padStart(2,'0')}</span></div>`).join('');
    }
    el('scoreHistory').innerHTML=scoreHistory.length?scoreHistory.map((entry,i)=>`<li><span>第 ${i+1} 局 · ${new Date(entry.date).toLocaleDateString('zh-CN')}</span><strong>${Number(entry.score).toLocaleString()} 分</strong></li>`).join(''):'<li class="history-empty">打完一局后，成绩会留在这里。</li>';
  }
  function start(){recordRun();balls=[];particles.length=0;score=0;scoreEl.textContent='0';recordToBeat=best;recordAwardedThisRun=false;runRecorded=false;current=rnd();next=rnd();nextImg.src=images[next].src;aim=200;dropLock=0;highTime=0;over=false;overlay.hidden=true;shake=0;hammerMode=false;updateHammer();el('recordToast').hidden=true}
  function drop(){if(over||collectionOpen||videoOpen||hammerMode||dropLock>0)return;const r=radii[current];balls.push({x:Math.max(r+3,Math.min(W-r-3,aim)),y:PREVIEW_Y,vx:0,vy:0,r,level:current,age:0,impact:0,wobble:0,angle:0,spin:0,landingSoundPending:true,hasLanded:false,dead:false});current=next;next=rnd();nextImg.src=images[next].src;dropLock=.38}
  function burst(x,y,level,amount){for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=1+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,color:['#f48bbd','#b8a0e9','#91dec9','#ffc868'][i%4]})}const rect=area.getBoundingClientRect();const label=document.createElement('div');label.className='burst';label.textContent=`+${amount}`;label.style.left=`${x/W*100}%`;label.style.top=`${y/H*100}%`;area.append(label);setTimeout(()=>label.remove(),850);shake=Math.min(7,shake+2.5)}
  function merge(a,b){a.dead=b.dead=true;const level=a.level, newLevel=level+1;const x=(a.x+b.x)/2,y=(a.y+b.y)/2;const earned=2**(level+1)*10;score+=earned;scoreEl.textContent=score.toLocaleString();if(score>best){best=score;bestEl.textContent=best.toLocaleString();save('cortis-merge-best',String(best))}if(!recordAwardedThisRun&&score>recordToBeat){recordAwardedThisRun=true;diceCount++;save('cortis-merge-dice',String(diceCount));showToast()}burst(x,y,level,earned);const r=radii[newLevel];balls.push({x:Math.max(r+1,Math.min(W-r-1,x)),y:y-3,vx:(a.vx+b.vx)*.45,vy:Math.min(a.vy,b.vy)-3.4,r,level:newLevel,age:0,impact:.65,wobble:0,angle:(a.angle+b.angle)/2,spin:(a.spin+b.spin)/2,hasLanded:a.hasLanded||b.hasLanded,dead:false});if(newLevel===names.length-1){greenCount++;save('cortis-merge-greens',String(greenCount))}}
  function step(){if(over||collectionOpen||videoOpen)return;dropLock=Math.max(0,dropLock-1/60);for(const b of balls){
      b.age+=1/60;b.vy=Math.min(b.vy+.32,14);b.vx*=.999;b.x+=b.vx;b.y+=b.vy;b.impact*=.89;b.wobble+=.17;
      if(b.x<b.r){const speed=b.vx;b.x=b.r;b.vx=Math.abs(speed)*.64;b.spin+=b.vy/b.r*.055;b.impact=Math.max(b.impact,Math.min(.5,Math.abs(speed)*.09))}
      if(b.x>W-b.r){const speed=b.vx;b.x=W-b.r;b.vx=-Math.abs(speed)*.64;b.spin-=b.vy/b.r*.055;b.impact=Math.max(b.impact,Math.min(.5,Math.abs(speed)*.09))}
      const onFloor=b.y>=H-b.r;
      if(onFloor){const speed=b.vy;firstContact(b);b.y=H-b.r;b.vy=speed>1.05?-speed*.56:0;b.vx*=.992;
        if(speed>1.05){b.impact=Math.max(b.impact,Math.min(.65,speed*.082));b.spin+=b.vx/b.r*.15}}
      // Roll only while visibly moving; stop the residual spin once the ball settles.
      b.angle+=b.spin+(onFloor&&Math.abs(b.vx)>.35?b.vx/b.r*.55:0);
      b.spin*=onFloor?.88:.965;if(Math.abs(b.spin)<.003)b.spin=0;
      if(onFloor&&Math.abs(b.vx)<.08)b.vx=0;
      b.spin=Math.max(-.12,Math.min(.12,b.spin));
    }
    // Several gentle position passes let piles compress and spring apart without tunneling.
    for(let pass=0;pass<3;pass++)for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];if(a.dead||b.dead)continue;let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=a.r+b.r;if(dist>=min)continue;
      const firstImpact=firstContact(a,b);
      if(a.level===b.level && a.level<names.length-1 && a.age>.16 && b.age>.16){if(pass===0&&!firstImpact)playCollision(Math.hypot(b.vx-a.vx,b.vy-a.vy));merge(a,b);continue}
      if(dist<.001){dx=.01;dy=-.01;dist=Math.hypot(dx,dy)}const nx=dx/dist,ny=dy/dist,overlap=min-dist;
      const ma=a.r*a.r,mb=b.r*b.r,wa=mb/(ma+mb),wb=ma/(ma+mb);
      a.x-=nx*overlap*.57*wa;b.x+=nx*overlap*.57*wb;a.y-=ny*overlap*.57*wa;b.y+=ny*overlap*.57*wb;
      if(pass===0){const rvx=b.vx-a.vx,rvy=b.vy-a.vy,vn=rvx*nx+rvy*ny;
        if(vn<0){if(!firstImpact)playCollision(-vn);const impulse=-(1.53)*vn/(1/ma+1/mb);a.vx-=impulse*nx/ma;a.vy-=impulse*ny/ma;b.vx+=impulse*nx/mb;b.vy+=impulse*ny/mb;
          // Small tangential transfer produces the slippery, rolling pile.
          const tangent=rvx*(-ny)+rvy*nx,slip=tangent*.017;a.vx+=-ny*slip*wa;a.vy+=nx*slip*wa;b.vx-=-ny*slip*wb;b.vy-=nx*slip*wb;
          if(Math.abs(tangent)>1.2&&Math.abs(vn)>.8){a.spin+=tangent/a.r*.018;b.spin+=tangent/b.r*.018}
          const bump=Math.min(.6,Math.abs(vn)*.085);a.impact=Math.max(a.impact,bump);b.impact=Math.max(b.impact,bump)}}
    }
    balls=balls.filter(b=>!b.dead);for(const b of balls){b.x=Math.max(b.r,Math.min(W-b.r,b.x));b.y=Math.max(b.r*1.3+6,Math.min(H-b.r,b.y))}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.11;p.life-=.027;if(p.life<=0)particles.splice(i,1)}
    shake*=.84;
    // A newly dropped ball is ignored until it joins the pile.
    if(balls.some(b=>b.hasLanded&&b.age>.35&&b.y-b.r<DANGER_Y-2))highTime+=1/60;else highTime=0;
    if(highTime>.3){over=true;hammerMode=false;updateHammer();recordRun();el('result').textContent=`球堆越过虚线，本局获得 ${score.toLocaleString()} 分。`;overlay.hidden=false}
  }
  function drawBall(b,alpha=1){const img=images[b.level];ctx.save();ctx.translate(b.x,b.y);const squeeze=Math.max(-.35,Math.min(.65,b.impact));const swing=Math.sin(b.wobble)*Math.abs(squeeze)*.12;ctx.rotate((b.angle||0)+swing);ctx.scale(1+squeeze*.42,1-squeeze*.33);ctx.globalAlpha=alpha;ctx.shadowColor='#55416744';ctx.shadowBlur=9;ctx.shadowOffsetY=5;if(img.complete&&img.naturalWidth)ctx.drawImage(img,-b.r*1.03,-b.r*1.03,b.r*2.06,b.r*2.06);else{ctx.fillStyle=['#fdfdfb','#ffc8dd','#ffdf88','#9bceff','#8d5a99','#f8677b','#484249','#9fe5ce'][b.level];ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill()}ctx.restore()}
  function render(){ctx.clearRect(0,0,W,H);ctx.save();ctx.translate((Math.random()-.5)*shake,0);
    // Dashed danger line and a soft landing tray.
    ctx.setLineDash([5,8]);ctx.strokeStyle='#e8b5d0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(12,DANGER_Y);ctx.lineTo(W-12,DANGER_Y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#ddd2ee';ctx.beginPath();ctx.roundRect(0,H-10,W,13,6);ctx.fill();
    // Paint higher balls first so the lower layer remains visible at contact points.
    for(const b of [...balls].sort((a,b)=>a.y-b.y))drawBall(b);
    if(!over&&!hammerMode&&dropLock<=0){const r=radii[current];ctx.strokeStyle='#d8b9dca6';ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(aim,PREVIEW_Y+r*1.1);ctx.lineTo(aim,Math.min(H-20,235));ctx.stroke();ctx.setLineDash([]);drawBall({x:aim,y:PREVIEW_Y,level:current,r,impact:0,wobble:0},.91)}
    if(hammerMode){ctx.setLineDash([5,5]);ctx.lineWidth=2;ctx.strokeStyle='#e366a3';for(const b of balls)if(b.level<=5){ctx.beginPath();ctx.arc(b.x,b.y,b.r+5,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([])}
    for(const p of particles){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.3,3*p.life),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.restore()}
  function frame(t){let dt=Math.min(.05,(t-last)/1000||0);last=t;acc+=dt;while(acc>=1/60){step();acc-=1/60}render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function move(e){const r=area.getBoundingClientRect();aim=Math.max(radii[current]+3,Math.min(W-radii[current]-3,(e.clientX-r.left)/r.width*W))}
  area.addEventListener('pointerdown',e=>{if(e.target.closest('button')||over||videoOpen)return;unlockSound();area.setPointerCapture(e.pointerId);if(!hammerMode)move(e)});
  area.addEventListener('pointermove',e=>{if(!over&&!hammerMode&&!videoOpen)move(e)});
  area.addEventListener('pointerup',e=>{if(over||videoOpen)return;if(hammerMode){useHammerAt(e);return}move(e);drop()});
  area.addEventListener('keydown',e=>{if(hammerMode||videoOpen)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();aim=Math.max(radii[current]+3,Math.min(W-radii[current]-3,aim+(e.key==='ArrowLeft'?-18:18)))}if(e.key===' '||e.key==='Enter'){e.preventDefault();unlockSound();drop()}});
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;try{localStorage.setItem('cortis-merge-sound',soundOn?'on':'off')}catch{}showSoundState();unlockSound()});
  el('openCollection').addEventListener('click',()=>{renderCollection();collectionOpen=true;document.body.classList.add('show-collection');el('collectionView').hidden=false;el('openCollection').setAttribute('aria-current','page');el('closeCollection').removeAttribute('aria-current');el('openCollection').focus()});
  function closeCollection(){el('collectionView').hidden=true;collectionOpen=false;document.body.classList.remove('show-collection');el('openCollection').removeAttribute('aria-current');el('closeCollection').setAttribute('aria-current','page');el('closeCollection').focus()}
  el('closeCollection').addEventListener('click',closeCollection);
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(videoOpen){closeVideo();hammerStatus('已退出视频，本次没有领取锤子。')}else if(collectionOpen)closeCollection();else if(hammerMode){hammerMode=false;updateHammer();hammerStatus('已取消选择，锤子仍在背包里。')}});
  el('restart').addEventListener('click',start);el('again').addEventListener('click',start);start();
  if(document.modelContext?.registerTool){
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}};
    register({name:'drop_ball',title:'投放 Ball',description:'在指定的水平位置投放当前 Ball，和游戏画面中的投放操作相同。',inputSchema:{type:'object',properties:{x:{type:'number',minimum:0,maximum:400,description:'游戏区域内的水平位置，0 到 400'}},required:['x'],additionalProperties:false},annotations:{readOnlyHint:false},execute:({x})=>{if(!Number.isFinite(x)||x<0||x>400)throw Error('x 必须在 0 到 400 之间');if(over||dropLock>0)throw Error('当前无法投放');aim=Math.max(radii[current]+3,Math.min(W-radii[current]-3,x));drop();return {dropped:true,score,ballCount:balls.length}}});
    register({name:'restart_game',title:'重新开始游戏',description:'清空本局 Ball 和分数，开始新一局。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{start();return {restarted:true,score}}});
  }
})();
