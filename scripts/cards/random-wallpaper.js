<!-- @inject-template-id: random-wallpaper -->
<div class="rw-card" id="rwCard">
<style>
  .rw-card{position:relative;font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);border-radius:12px;overflow:hidden;box-sizing:border-box;}
  .rw-card *,.rw-card *::before,.rw-card *::after{box-sizing:border-box;}
  .rw-img{display:block;width:100%;height:420px;object-fit:cover;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .rw-btn{position:absolute;right:10px;bottom:44px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;font-size:12px;color:#fff;background:rgba(0,0,0,.55);opacity:0;transition:opacity .15s,background .15s;}
  .rw-card:hover .rw-btn{opacity:1;}
  .rw-btn:hover{background:rgba(0,0,0,.72);}
  .rw-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;color:var(--orca-text-secondary,#57606a);}
  .rw-dot{width:6px;height:6px;border-radius:50%;background:var(--orca-accent,#4078c0);flex:none;}
</style>
<img class="rw-img" id="rwImg" alt="随机美图">
<button class="rw-btn" id="rwBtn" title="换一张"><span>⟳</span> 换一张</button>
<div class="rw-foot"><i class="rw-dot"></i>Lorem Picsum 随机美图 · 悬停右下角换一张</div>
</div>
<script>
var img = document.getElementById('rwImg');
var btn = document.getElementById('rwBtn');

function newSeed() {
  return Math.random().toString(36).slice(2, 10);
}
function refresh() {
  img.src = 'https://picsum.photos/seed/' + newSeed() + '/1200/675';
}
btn.addEventListener('click', refresh);
refresh();
</script>
