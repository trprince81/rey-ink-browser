(function(){'use strict';
/* Prevent the visual dashboard observer from reacting to its own link-table decoration. */
const NativeMO=window.MutationObserver;
if(!NativeMO||window.__RI_MO_STABLE)return;
window.__RI_MO_STABLE=true;
window.MutationObserver=class extends NativeMO{
  constructor(cb){super(records=>{const filtered=records.filter(r=>{const t=r.target?.nodeType===1?r.target:null;return !(t&&t.closest?.('#linksTable'))});if(filtered.length)cb(filtered,this)})}
};
})();
