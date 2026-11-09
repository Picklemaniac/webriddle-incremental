export const defaultReservedHeight = 120;

export const scrollbarStyle = [
    "::-webkit-scrollbar { width: 16px; height: 16px; }",
    "::-webkit-scrollbar-track { background: repeating-conic-gradient(#c0c0c0 0% 25%, #fff 0% 50%) 0 0 / 2px 2px; }",
    "::-webkit-scrollbar-thumb { background: #c0c0c0; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }",
    "::-webkit-scrollbar-button:vertical:start:decrement, ::-webkit-scrollbar-button:vertical:end:increment, ::-webkit-scrollbar-button:horizontal:start:decrement, ::-webkit-scrollbar-button:horizontal:end:increment { display: block; width: 16px; height: 16px; background-color: #c0c0c0; background-repeat: no-repeat; background-position: center; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }",
    "::-webkit-scrollbar-button:vertical:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z'/></svg>\"); }",
    "::-webkit-scrollbar-button:vertical:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z'/></svg>\"); }",
    "::-webkit-scrollbar-button:horizontal:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M3 0h1v7H3V6H2V5H1V4H0V3h1V2h1V1h1z'/></svg>\"); }",
    "::-webkit-scrollbar-button:horizontal:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z'/></svg>\"); }",
    "::-webkit-scrollbar-button:active { box-shadow: inset 1px 1px #808080; }",
    "::-webkit-scrollbar-corner { background: #c0c0c0; }",
].join('');

export const pictureWidth = 440;
export const pictureHeight = 294;

export const pictureStyle = '.picture{position:relative;display:block;border:2px solid #f2f2f2;box-shadow:0 0 0 1px #000,0 0 8px 1px rgba(255,255,255,.55),0 0 26px 6px rgba(255,255,255,.14)}' +
    '.picture img{display:block;width:100%;height:auto;image-rendering:pixelated}' +
    '.number{position:absolute;left:10px;top:7px;font:bold 28px/1 Verdana,Tahoma,sans-serif;color:#fff;text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 -2px 0 #000,0 2px 0 #000,-2px 0 0 #000,2px 0 0 #000,0 0 12px rgba(255,255,255,.8)}';

export const levelStyle = '*{box-sizing:border-box}html,body{height:100%}' +
    'body{margin:0;padding:12px 16px;background:#000;color:#ddd;font:18px "Times New Roman",Times,serif;text-align:center;display:flex;flex-direction:column;justify-content:safe center}' +
    `.picture{width:max(240px,min(${pictureWidth + 4}px,100%,calc((100vh - var(--reserved,${defaultReservedHeight}px)) * 1.5)));margin:0 auto}${pictureStyle}` +
    '.swatches{display:flex;justify-content:center;gap:8px;margin-top:16px}.swatches span{width:26px;height:26px;border:1px solid #555}p{margin:16px 0 0;white-space:nowrap}p+p{margin-top:6px}.hidden{color:#000}a{color:#fff}::selection{background:#3459b1;color:#fff}' +
    '.drawing img{display:block;max-width:100%;height:auto;margin:0 auto;image-rendering:pixelated}.drawing img.squashed{height:3px}audio{display:block;width:300px;height:32px;margin:0 auto;color-scheme:dark}' +
    '.picture .over{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;background:#000;opacity:0}.picture:hover .over{opacity:1}' +
    '.far{position:absolute;left:0;right:0;top:300vh;padding-bottom:16px}.grid{margin:16px 0 0;font:13px/1.05 "Courier New",monospace;color:#bbb}.spot{position:absolute;display:block}';

export const imageStyle = `*{box-sizing:border-box}body{margin:8px;background:#000}img{display:block;width:${pictureWidth}px;image-rendering:pixelated}.picture{width:${pictureWidth + 4}px}${pictureStyle}`;

export const textFileStyle = 'body{margin:8px;background:#000;color:#ddd}pre{margin:0;font:13px "Courier New",monospace}';

export const gifStyle = 'body{margin:8px;background:#000}img{display:block;max-width:100%;height:auto;image-rendering:pixelated}';

export const noteStyle = 'body{margin:24px;background:#000;color:#ddd;font:18px "Times New Roman",Times,serif;text-align:center}p{word-break:break-all}';

export const soundStyle = 'html,body{height:100%}body{margin:0;background:#000;display:flex;align-items:center;justify-content:center}audio{width:300px;color-scheme:dark}';

export const captchaStyle = 'body{margin:16px 20px;background:#fff;color:#000;font:16px "Times New Roman",Times,serif}h1{margin:0 0 12px;font-size:28px}p{margin:10px 0}.captcha{display:block;max-width:100%;height:auto;border:1px solid #808080}.error{color:#c00000}input{font:15px "Courier New",monospace}button{font:13px Tahoma,Arial,sans-serif}.link{padding:0;border:0;background:none;color:#0000ee;text-decoration:underline;cursor:pointer;font:16px "Times New Roman",Times,serif}hr{border:0;border-top:1px solid #808080;margin:18px 0 8px}address{font-style:italic;font-size:14px}';

export const errorStyle = 'body{background:#111;color:#ccc;margin:36px;font:13px Verdana,sans-serif;line-height:1.8}h2{font-size:20px}hr{border:0;border-top:1px solid #444}';
