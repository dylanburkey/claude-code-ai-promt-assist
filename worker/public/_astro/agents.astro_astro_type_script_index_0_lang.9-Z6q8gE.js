import{a as g}from"./api.BoRAYT-2.js";let i=[],a=null,y=!1;document.addEventListener("DOMContentLoaded",async()=>{await E(),b()});async function E(){try{i=await g.agents.list(),h(),i.length>0&&!a&&p(i[0].id)}catch(e){console.error("Failed to load agents:",e),d("Failed to load agents","error")}}function h(){const e=document.getElementById("agent-list");if(e){if(i.length===0){e.innerHTML=`
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h3>No agents yet</h3>
          <p>Create your first AI agent to get started</p>
          <button class="btn-primary" onclick="startNewAgent()">Create Agent</button>
        </div>
      `;return}e.innerHTML=i.map(t=>`
      <div class="item-card ${t.id===a?"active":""}" onclick="selectAgent('${t.id}')">
        <div class="item-card-header">
          <span class="item-name">${v(t.name)}</span>
        </div>
        <span class="item-preview">${v(t.role)}</span>
      </div>
    `).join("")}}function m(e){const t=document.getElementById("agent-editor-content"),n=document.getElementById("agent-form");if(!t||!n)return;if(!e){t.style.display="flex",n.style.display="none";return}t.style.display="none",n.style.display="flex";const c=document.getElementById("agent-id"),s=document.getElementById("agent-name"),o=document.getElementById("agent-role"),r=document.getElementById("agent-style");c&&(c.value=e.id||""),s&&(s.value=e.name||""),o&&(o.value=e.role||""),r&&(r.value=e.style||"");const l=document.getElementById("duplicate-agent-btn"),u=document.getElementById("delete-agent-btn");l&&u&&(e.id?(l.style.display="flex",u.style.display="flex"):(l.style.display="none",u.style.display="none"))}function I(e){const t=document.getElementById("agent-preview-content");if(!t)return;if(!e){t.innerHTML=`
        <div class="empty-preview">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <h3>Agent Preview</h3>
          <p>Select an agent to see how it will appear in prompts</p>
        </div>
      `;return}t.innerHTML=`
      <div class="agent-preview">
        <div class="preview-section">
          <div class="preview-label">ROLE</div>
          <div class="preview-value">${v(e.role)}</div>
        </div>
        ${e.style?`
          <div class="preview-section">
            <div class="preview-label">STYLE</div>
            <div class="preview-value">${v(e.style)}</div>
          </div>
        `:""}
      </div>
    `;const n=document.getElementById("test-agent-btn");n&&(n.style.display="flex")}function p(e){a=e;const t=i.find(n=>n.id===e);h(),m(t),I(t),y=!1}function w(){a=null,y=!0,m({name:"",role:"",style:""}),I();const t=document.getElementById("agent-name");t&&t.focus()}async function B(){const e=document.getElementById("agent-id"),t=document.getElementById("agent-name"),n=document.getElementById("agent-role"),c=document.getElementById("agent-style");if(!t||!n)return;const s=t.value.trim(),o=n.value.trim(),r=c.value.trim();if(!s||!o){d("Name and role are required","error");return}try{const l={name:s,role:o,style:r},u=e&&e.value;let f;u?(f=await g.agents.update(e.value,l),d("Agent updated!")):(f=await g.agents.create(l),d("Agent created!")),await E(),p(f.id),y=!1}catch(l){console.error("Failed to save agent:",l),d("Failed to save agent","error")}}async function A(){if(!a)return;const e=i.find(t=>t.id===a);if(e&&confirm(`Delete agent "${e.name}"? This cannot be undone.`))try{await g.agents.delete(a),d("Agent deleted"),await E(),i.length>0?p(i[0].id):(a=null,m(),I())}catch(t){console.error("Failed to delete agent:",t),d("Failed to delete agent","error")}}function L(){if(y=!1,a){const e=i.find(t=>t.id===a);m(e)}else m()}function v(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function d(e,t="success"){const n=document.getElementById("toast");n&&(n.textContent=e,n.className=`toast ${t} show`,setTimeout(()=>n.classList.remove("show"),3e3))}function b(){document.getElementById("new-agent-btn")?.addEventListener("click",w),document.getElementById("empty-new-agent-btn")?.addEventListener("click",w),document.getElementById("save-agent-btn")?.addEventListener("click",B),document.getElementById("cancel-agent-btn")?.addEventListener("click",L),document.getElementById("delete-agent-btn")?.addEventListener("click",A),document.getElementById("agent-search")?.addEventListener("input",e=>{const n=e.target.value.toLowerCase();document.querySelectorAll(".item-card").forEach(s=>{const o=s.querySelector(".item-name")?.textContent?.toLowerCase()||"",r=s.querySelector(".item-preview")?.textContent?.toLowerCase()||"";o.includes(n)||r.includes(n)?s.style.display="block":s.style.display="none"})})}window.selectAgent=p;window.startNewAgent=w;
