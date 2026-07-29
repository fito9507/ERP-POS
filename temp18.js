
document.addEventListener("click",function(e){
  var sb=document.getElementById("sidebar"),ham=document.getElementById("ham");
  if(sb&&sb.classList.contains("mob-open")&&!sb.contains(e.target)&&e.target!==ham)
    sb.classList.remove("mob-open");
});
