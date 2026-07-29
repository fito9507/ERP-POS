var str1='5× Silicona Neutra (Transparente) @ $1,60, 1× T. CUA 40 x 2,0 x 5800mm @ $23,00';
var str2='240x Silicona Neutra (Blanca)';
var str3='10x Silicona Neutra (Blanca), 10x Disco de Corte 230x3mm';
var str4='144x Silicona Neutra (Blanca)';
var rx=/(\d+)[x×]\s+([\s\S]+?)(?:\s+@\s+\$([\d,.-]+))?(?=(?:,\s*\d+[x×]|$))/g;

[str1,str2,str3,str4].forEach(s=>{
  console.log('---',s);
  var m;
  while((m=rx.exec(s))!==null) {
    console.log('QTY:',m[1],'| PROD:',m[2],'| PRICE:',m[3]);
  }
});
