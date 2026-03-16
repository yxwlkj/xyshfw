// Minimal frontend helper for core chat features (Phase 1)
let socket = null;
function initSocket(){
  if (socket) return;
  try {
    socket = io.connect('http://localhost:3000');
    socket.on('connect', ()=> console.log('socket connected'));
    socket.on('recv_msg', (d)=> console.log('private msg', d));
    socket.on('recv_group_msg', (d)=> console.log('group msg', d));
  } catch(e){ console.error('socket init failed', e); }
}

function loginToSocket(uid){ initSocket(); socket && socket.emit('login', uid); }

async function login(){
  const u=document.getElementById('u').value; const p=document.getElementById('p').value;
  const r=await fetch('http://localhost:3000/api/user/login', {method:'POST',headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p})});
  const d=await r.json(); if(d.code===200){ localStorage.setItem('token', d.data.token); localStorage.setItem('user', JSON.stringify(d.data.user)); alert('ok'); } else alert('fail');
}

async function sendPrivate(){ const toUid=document.getElementById('toUid').value; const text=document.getElementById('text').value; const token=localStorage.getItem('token'); await fetch('http://localhost:3000/api/message/send', {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:JSON.stringify({chatType:'private', targetId:toUid, content:text, type:'text'})}); }
