<!-- @inject-template-id: random-wallpaper -->
<div class="rw-card" id="rwCard">
<style>
  .rw-card{position:relative;font-family:var(--orca-font,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif);border-radius:12px;overflow:hidden;box-sizing:border-box;}
  .rw-card *,.rw-card *::before,.rw-card *::after{box-sizing:border-box;}
  .rw-img{display:block;width:100%;height:420px;object-fit:cover;background:linear-gradient(135deg,#f2f4f7,#e4e7ec);}
  .rw-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;color:var(--orca-text-secondary,#57606a);}
  .rw-dot{width:6px;height:6px;border-radius:50%;background:var(--orca-accent,#4078c0);flex:none;}
</style>
<img class="rw-img" id="rwImg" alt="随机美图">
<div class="rw-foot"><i class="rw-dot"></i>Lorem Picsum 随机美图 · 刷新换一张</div>
</div>
<script>
var img = document.getElementById('rwImg');
// 每次脚本运行（挂载 / 组件刷新重跑）取新随机 seed，必出新图
img.src = 'https://picsum.photos/seed/' + Math.random().toString(36).slice(2, 10) + '/1200/675';
</script>
