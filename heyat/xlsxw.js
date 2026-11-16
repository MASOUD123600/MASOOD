/* Tiny styled .xlsx writer (no dependencies).
   sheet = {name, rtl, cols:[width...], rows:[{h, cells:[{v, f, s}|null...]}], merges:['A1:B2'], freeze:'A5'}
   style s = {b, sz, font, color, fill, border, h, v, wrap, fmt}  (colors as 'RRGGBB') */
(function(g){
'use strict';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
const colName=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
function Styles(){
  const fonts=['<font><sz val="11"/><name val="Calibri"/></font>'],fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'],
        borders=['<border><left/><right/><top/><bottom/><diagonal/></border>'],numFmts=[],xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const idx=(arr,x)=>{let i=arr.indexOf(x);if(i<0){arr.push(x);i=arr.length-1}return i};
  const cache=new Map();
  this.id=s=>{
    if(!s)return 0;const key=JSON.stringify(s);if(cache.has(key))return cache.get(key);
    const font=idx(fonts,`<font>${s.b?'<b/>':''}<sz val="${s.sz||11}"/>${s.color?`<color rgb="FF${s.color}"/>`:''}<name val="${esc(s.font||'B Nazanin')}"/><family val="2"/></font>`);
    const fill=s.fill?idx(fills,`<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`):0;
    const bd=s.border?idx(borders,`<border>${['left','right','top','bottom'].map(k=>`<${k} style="${s.border==='thick'?'medium':'thin'}"><color rgb="FF${s.bcolor||'808080'}"/></${k}>`).join('')}<diagonal/></border>`):0;
    let fmt=0;if(s.fmt==='@')fmt=49;else if(s.fmt==='0')fmt=1;else if(s.fmt==='#,##0')fmt=3;else if(s.fmt){let i=numFmts.indexOf(s.fmt);if(i<0){numFmts.push(s.fmt);i=numFmts.length-1}fmt=164+i}
    const al=(s.h||s.v||s.wrap)?`<alignment${s.h?` horizontal="${s.h}"`:''} vertical="${s.v||'center'}"${s.wrap?' wrapText="1"':''} readingOrder="2"/>`:'';
    const xf=`<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${bd}" xfId="0"${fmt?' applyNumberFormat="1"':''} applyFont="1"${fill?' applyFill="1"':''}${bd?' applyBorder="1"':''}${al?' applyAlignment="1">'+al+'</xf>':'/>'}`;
    const i=idx(xfs,xf);cache.set(key,i);return i;
  };
  this.xml=()=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length?`<numFmts count="${numFmts.length}">${numFmts.map((f,i)=>`<numFmt numFmtId="${164+i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>`:''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
function sheetXml(sh,st){
  const rows=sh.rows.map((r,ri)=>{if(!r)return '';
    const cells=(r.cells||[]).map((c,ci)=>{if(!c)return '';const ref=colName(ci)+(ri+1),s=st.id(c.s);const sa=s?` s="${s}"`:'';
      if(c.f!=null)return `<c r="${ref}"${sa}><f>${esc(c.f)}</f>${c.v!=null&&c.v!==''?`<v>${esc(c.v)}</v>`:''}</c>`;
      if(c.v==null||c.v==='')return s?`<c r="${ref}"${sa}/>`:'';
      if(typeof c.v==='number')return `<c r="${ref}"${sa}><v>${c.v}</v></c>`;
      return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`}).join('');
    return `<row r="${ri+1}"${r.h?` ht="${r.h}" customHeight="1"`:''}>${cells}</row>`}).join('');
  let pane='';
  if(sh.freeze){const m=sh.freeze.match(/^([A-Z]+)(\d+)$/);const col=m[1].charCodeAt(0)-65,row=+m[2]-1;
    pane=`<pane${col?` xSplit="${col}"`:''}${row?` ySplit="${row}"`:''} topLeftCell="${sh.freeze}" activePane="${row&&col?'bottomRight':row?'bottomLeft':'topRight'}" state="frozen"/>`}
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"${sh.rtl!==false?' rightToLeft="1"':''}${sh.zoom?` zoomScale="${sh.zoom}"`:''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>${sh.cols?`<cols>${sh.cols.map((w,i)=>w?`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`:'').join('')}</cols>`:''}<sheetData>${rows}</sheetData>${sh.merges&&sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${sh.landscape?'landscape':'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
/* --- zip (store only) --- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zip(files){
  const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const [name,content] of files){
    const nb=enc.encode(name),data=typeof content==='string'?enc.encode(content):content,crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nb.length,true);
    parts.push(new Uint8Array(h.buffer),nb,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
    c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+data.length;
  }
  const csz=central.reduce((s,a)=>s+a.length,0);
  const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csz,true);e.setUint32(16,off,true);
  const all=[...parts,...central,new Uint8Array(e.buffer)],out=new Uint8Array(all.reduce((s,a)=>s+a.length,0));let p=0;for(const a of all){out.set(a,p);p+=a.length}
  return out;
}
function build(sheets){
  const st=new Styles();const used=new Set();
  sheets.forEach((s,i)=>{let n=String(s.name||('Sheet'+(i+1))).replace(/[\\\/?*\[\]:]/g,'-').slice(0,31);let k=n,j=2;while(used.has(k))k=n.slice(0,28)+' '+(j++);used.add(k);s.name=k});
  const sx=sheets.map(s=>sheetXml(s,st));
  const files=[
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ...sx.map((x,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',x]),
    ['xl/styles.xml',st.xml()],
  ];
  return zip(files);
}
g.XLSXW={build,colName};
})(typeof window!=='undefined'?window:globalThis);
