(this["webpackJsonpvagarish-web"]=this["webpackJsonpvagarish-web"]||[]).push([[0],{86:function(e,n,t){"use strict";t.r(n);var c,s=t(69),r=t(117),i=t(118),j=t(115),a=t(29),h=t.n(a),d=t(9),b=t(4),l=function(){return Object(b.jsx)("div",{children:Object(b.jsx)("a",{href:"https://github.com/greenlucid/vagarish",children:"GitHub repo. Report your issues and suggestions here."})})},u=function(e){return Object(b.jsxs)("div",{children:[e.children,Object(b.jsx)(l,{})]})},o=t(119),x=t(110),O=t(53),g=function(){var e=Object(d.f)();return Object(b.jsx)(O.b,{initialValues:{substring:""},onSubmit:function(n){return function(n){var t="?substring=".concat(n);e.push({pathname:"/search",search:t})}(n.substring)},children:function(e){var n=e.handleChange,t=e.values;return Object(b.jsxs)(O.a,{children:[Object(b.jsx)(o.a,{name:"substring",value:t.substring,onChange:n}),Object(b.jsx)(x.a,{type:"submit",children:"Search \ud83d\udd0e"})]})}})},p=function(){return Object(b.jsxs)("div",{children:[Object(b.jsx)("h1",{children:"Vagarish"}),Object(b.jsx)("h2",{children:"Kleros Search Engine"}),Object(b.jsx)(g,{}),Object(b.jsx)("p",{children:"Case and space sensitive. Graphic design is my passion."}),Object(b.jsx)("p",{children:"Current issues I see with this:"}),Object(b.jsxs)("ul",{children:[Object(b.jsx)("li",{children:"pdfs are sometimes not parsed properly, or throw errors and are simply ignored"}),Object(b.jsx)("li",{children:"this page is ugly. cannot fix that yet."})]})]})},v=function(){return Object(b.jsx)(u,{children:Object(b.jsx)(p,{})})},f=t(111),m=t(122),C=function(e){var n=e.matchedEvidence,t=e.index;return n.fileTextContent?Object(b.jsxs)("div",{children:[Object(b.jsx)("h3",{children:"Evidence #".concat(t+1)}),Object(b.jsx)("p",{children:Object(b.jsx)("b",{children:"Content"})}),Object(b.jsx)("p",{children:n.textContent}),Object(b.jsx)("p",{children:Object(b.jsx)("b",{children:" ### File Content"})}),Object(b.jsx)("p",{children:n.fileTextContent})]}):Object(b.jsxs)("div",{children:[Object(b.jsx)("h3",{children:"Evidence #".concat(t+1)}),Object(b.jsx)("p",{children:Object(b.jsx)("b",{children:"Content"})}),Object(b.jsx)("p",{children:n.textContent})]})},w=function(e){var n=e.searchResult;return Object(b.jsxs)("div",{style:{border:"1px solid black"},children:[Object(b.jsx)("a",{href:"https://court.kleros.io/cases/".concat(n.klerosLiquidId),children:Object(b.jsx)("h2",{children:"id: ".concat(n.klerosLiquidId)})}),Object(b.jsx)("div",{children:n.matchedEvidence.map((function(e,n){return Object(b.jsx)(C,{matchedEvidence:e,index:n},e.id)}))})]})},y=t(120),k=t(65),E=t(116),I=Object(E.a)(c||(c=Object(k.a)(["\n  query Search($substring: String!) {\n    search(options: { substring: $substring }) {\n      id\n      klerosLiquidId\n      arbitrable\n      matchedEvidence {\n        id\n        textContent\n        hasFile\n        fileTextContent\n        createdIn\n      }\n    }\n  }\n"]))),R=function(e){var n=Object(y.a)(I,{variables:{substring:e}});if(n.called&&!n.loading)return n.data&&n.data.search?n.data.search:null};var S=function(e){var n=e.searchResults;return 0===n.length?Object(b.jsx)("div",{children:"No results!"}):Object(b.jsx)(f.a,{children:n.map((function(e){return Object(b.jsx)(m.a,{children:Object(b.jsx)(w,{searchResult:e})},e.id)}))})},q=function(e){var n=e.substring,t=R(n);return void 0===t?null:null===t?Object(b.jsx)("div",{children:"There was an issue"}):Object(b.jsx)(S,{searchResults:t})},L=function(e){var n=e.substring;return n?Object(b.jsx)(q,{substring:n}):null},T=function(){var e=new URLSearchParams(Object(d.g)().search);return Object(b.jsxs)(b.Fragment,{children:[Object(b.jsx)(g,{}),Object(b.jsx)(L,{substring:e.get("substring")})]})},F=function(){return Object(b.jsx)(u,{children:Object(b.jsx)(T,{})})},G=function(){return Object(b.jsxs)(d.c,{children:[Object(b.jsx)(d.a,{exact:!0,path:"/",children:Object(b.jsx)(v,{})}),Object(b.jsx)(d.a,{path:"/search",children:Object(b.jsx)(F,{})})]})},J=t(40),V=Object(s.a)({uri:"https://vagarish.forer.es/graphql"}),$=new r.a({link:V,cache:new i.a});h.a.render(Object(b.jsx)(j.a,{client:$,children:Object(b.jsx)(J.a,{children:Object(b.jsx)(G,{})})}),document.getElementById("root"))}},[[86,1,2]]]);
//# sourceMappingURL=main.4df420a3.chunk.js.map