import"./api.BoRAYT-2.js";let n=[],a=null,b=!1,E="all";document.addEventListener("DOMContentLoaded",async()=>{await C(),D()});async function C(){try{n=[{id:"1",name:"Auto Documentation",description:"Automatically generate documentation when code is saved",category:"automation",trigger:"file_save",action:"generate_prompt",enabled:!0,created_at:new Date().toISOString()},{id:"2",name:"Project Setup",description:"Initialize project structure when a new project is created",category:"workflow",trigger:"project_create",action:"run_command",enabled:!1,created_at:new Date().toISOString()}],h(),n.length>0&&!a&&x(n[0].id)}catch(t){console.error("Failed to load hooks:",t),r("Failed to load hooks","error")}}function h(){const t=document.getElementById("hook-list");if(!t)return;const e=E==="all"?n:n.filter(o=>o.category===E);if(e.length===0){t.innerHTML=`
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
          <h3>No hooks yet</h3>
          <p>Create automation hooks to streamline your workflow</p>
          <button class="btn-primary" onclick="startNewHook()">Create Hook</button>
        </div>
      `;return}t.innerHTML=e.map(o=>`
      <div class="item-card ${o.id===a?"active":""} ${o.enabled?"":"disabled"}" onclick="selectHook('${o.id}')">
        <div class="item-card-header">
          <span class="item-name">${B(o.name)}</span>
          <span class="item-status ${o.enabled?"enabled":"disabled"}">${o.enabled?"Enabled":"Disabled"}</span>
        </div>
        ${o.description?`<div class="item-preview">${B(o.description)}</div>`:""}
        <div class="item-meta">
          <span class="hook-category-badge">${o.category}</span>
          <span>Trigger: ${o.trigger.replace("_"," ")}</span>
          <span>Action: ${o.action.replace("_"," ")}</span>
        </div>
      </div>
    `).join("")}function p(t){const e=document.getElementById("hook-editor-content"),o=document.getElementById("hook-form");if(!e||!o)return;if(!t){e.style.display="flex",o.style.display="none";return}e.style.display="none",o.style.display="flex";const l=document.getElementById("hook-id"),i=document.getElementById("hook-name"),s=document.getElementById("hook-description"),d=document.getElementById("hook-category"),g=document.getElementById("hook-trigger"),v=document.getElementById("hook-action"),f=document.getElementById("hook-enabled");l&&(l.value=t.id||""),i&&(i.value=t.name||""),s&&(s.value=t.description||""),d&&(d.value=t.category||""),g&&(g.value=t.trigger||""),v&&(v.value=t.action||""),f&&(f.checked=t.enabled||!1);const m=document.getElementById("test-hook-btn"),u=document.getElementById("duplicate-hook-btn"),y=document.getElementById("delete-hook-btn");m&&u&&y&&(t.id?(m.style.display="flex",u.style.display="flex",y.style.display="flex"):(m.style.display="none",u.style.display="none",y.style.display="none")),L(t.trigger),S(t.action)}function H(t){const e=document.getElementById("hook-logs-content");if(!e)return;if(!t){e.innerHTML=`
        <div class="empty-logs">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>No Execution Logs</h3>
          <p>Select a hook to see its execution history</p>
        </div>
      `;return}const o=[{id:"1",timestamp:new Date(Date.now()-36e5).toISOString(),status:"success",message:`Hook executed successfully
Generated documentation for 3 files`},{id:"2",timestamp:new Date(Date.now()-72e5).toISOString(),status:"error",message:`Hook execution failed
Error: Unable to access file system`}];e.innerHTML=`
      <div class="log-entries">
        ${o.map(i=>`
          <div class="log-entry ${i.status}">
            <div class="log-header">
              <span class="log-status">${i.status.toUpperCase()}</span>
              <span class="log-timestamp">${new Date(i.timestamp).toLocaleString()}</span>
            </div>
            <div class="log-message">${B(i.message)}</div>
          </div>
        `).join("")}
      </div>
    `;const l=document.getElementById("clear-logs-btn");l&&(l.style.display="flex")}function L(t){const e=document.getElementById("trigger-config");if(!e)return;let o="";switch(t){case"schedule":o=`
          <div class="config-section">
            <label for="schedule-cron">Cron Expression</label>
            <input type="text" id="schedule-cron" placeholder="0 0 * * *" />
          </div>
          <div class="config-section">
            <label for="schedule-timezone">Timezone</label>
            <select id="schedule-timezone">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
        `;break;case"file_save":o=`
          <div class="config-section">
            <label for="file-pattern">File Pattern</label>
            <input type="text" id="file-pattern" placeholder="*.js,*.ts" />
          </div>
          <div class="config-section">
            <label for="file-exclude">Exclude Pattern</label>
            <input type="text" id="file-exclude" placeholder="node_modules/**" />
          </div>
        `;break}o?(e.innerHTML=o,e.style.display="block"):e.style.display="none"}function S(t){const e=document.getElementById("action-config");if(!e)return;let o="";switch(t){case"generate_prompt":o=`
          <div class="config-section">
            <label for="prompt-template">Prompt Template</label>
            <textarea id="prompt-template" rows="4" placeholder="Enter the prompt template..."></textarea>
          </div>
          <div class="config-section">
            <label for="prompt-agent">Agent</label>
            <select id="prompt-agent">
              <option value="">Select an agent</option>
            </select>
          </div>
        `;break;case"run_command":o=`
          <div class="config-section">
            <label for="command-script">Command</label>
            <input type="text" id="command-script" placeholder="npm run build" />
          </div>
          <div class="config-section">
            <label for="command-working-dir">Working Directory</label>
            <input type="text" id="command-working-dir" placeholder="./" />
          </div>
        `;break;case"send_webhook":o=`
          <div class="config-section">
            <label for="webhook-url">Webhook URL</label>
            <input type="url" id="webhook-url" placeholder="https://example.com/webhook" />
          </div>
          <div class="config-section">
            <label for="webhook-method">HTTP Method</label>
            <select id="webhook-method">
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        `;break}o?(e.innerHTML=o,e.style.display="block"):e.style.display="none"}function x(t){a=t;const e=n.find(o=>o.id===t);h(),p(e),H(e),b=!1}function I(){a=null,b=!0,p({name:"",description:"",category:"workflow",trigger:"manual",action:"generate_prompt",enabled:!0}),H();const e=document.getElementById("hook-name");e&&e.focus()}async function $(){const t=document.getElementById("hook-id"),e=document.getElementById("hook-name"),o=document.getElementById("hook-description"),l=document.getElementById("hook-category"),i=document.getElementById("hook-trigger"),s=document.getElementById("hook-action"),d=document.getElementById("hook-enabled");if(!e||!l||!i||!s)return;const g=e.value.trim(),v=o?.value.trim()||"",f=l.value,m=i.value,u=s.value,y=d?.checked||!1;if(!g||!f||!m||!u){r("Please fill in all required fields","error");return}try{const k={name:g,description:v,category:f,trigger:m,action:u,enabled:y};if(t&&t.value){const c=n.findIndex(w=>w.id===t.value);c!==-1&&(n[c]={...n[c],...k}),r("Hook updated!")}else{const c={id:Date.now().toString(),...k,created_at:new Date().toISOString()};n.push(c),a=c.id,r("Hook created!")}if(h(),a){const c=n.find(w=>w.id===a);p(c)}b=!1}catch(k){console.error("Failed to save hook:",k),r("Failed to save hook","error")}}async function _(){if(!a)return;const t=n.find(e=>e.id===a);if(t&&confirm(`Delete hook "${t.name}"? This cannot be undone.`))try{n=n.filter(e=>e.id!==a),r("Hook deleted"),h(),n.length>0?x(n[0].id):(a=null,p(),H())}catch(e){console.error("Failed to delete hook:",e),r("Failed to delete hook","error")}}function A(){if(b=!1,a){const t=n.find(e=>e.id===a);p(t)}else p()}function T(t){E=t,document.querySelectorAll(".category-tab").forEach(e=>{e.classList.remove("active"),e.getAttribute("data-category")===t&&e.classList.add("active")}),h()}function B(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}function r(t,e="success"){const o=document.getElementById("toast");o&&(o.textContent=t,o.className=`toast ${e} show`,setTimeout(()=>o.classList.remove("show"),3e3))}function D(){document.getElementById("new-hook-btn")?.addEventListener("click",I),document.getElementById("empty-new-hook-btn")?.addEventListener("click",I),document.getElementById("save-hook-btn")?.addEventListener("click",$),document.getElementById("cancel-hook-btn")?.addEventListener("click",A),document.getElementById("delete-hook-btn")?.addEventListener("click",_),document.querySelectorAll(".category-tab").forEach(t=>{t.addEventListener("click",()=>{const e=t.getAttribute("data-category");e&&T(e)})}),document.getElementById("hook-trigger")?.addEventListener("change",t=>{const e=t.target;L(e.value)}),document.getElementById("hook-action")?.addEventListener("change",t=>{const e=t.target;S(e.value)}),document.getElementById("hook-search")?.addEventListener("input",t=>{const o=t.target.value.toLowerCase();document.querySelectorAll(".item-card").forEach(i=>{const s=i.querySelector(".item-name")?.textContent?.toLowerCase()||"",d=i.querySelector(".item-preview")?.textContent?.toLowerCase()||"";s.includes(o)||d.includes(o)?i.style.display="block":i.style.display="none"})})}window.selectHook=x;window.startNewHook=I;window.switchCategory=T;
