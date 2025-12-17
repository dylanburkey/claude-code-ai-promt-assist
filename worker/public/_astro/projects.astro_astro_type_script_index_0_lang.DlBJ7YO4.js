import{a as u}from"./api.Dv2Hb9xf.js";let s=[],r=null,y=!1,I=[],B=[];document.addEventListener("DOMContentLoaded",async()=>{await Promise.all([g(),b()]),k()});async function g(){try{s=(await u.projects.list()).projects||[],h(),s.length>0&&!r&&v(s[0].id)}catch(e){console.error("Failed to load projects:",e),a("Failed to load projects","error")}}async function b(){try{I=await u.agents.list(),B=await u.requirements.list()}catch(e){console.error("Failed to load resources:",e)}}function h(){const e=document.getElementById("project-list");if(e){if(s.length===0){e.innerHTML=`
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>No projects yet</h3>
          <p>Create your first project to organize your work</p>
          <button class="btn-primary" onclick="startNewProject()">Create Project</button>
        </div>
      `;return}e.innerHTML=s.map(t=>`
      <div class="item-card ${t.id===r?"active":""}" onclick="selectProject('${t.id}')">
        <div class="item-card-header">
          <span class="item-name">${w(t.name)}</span>
        </div>
        ${t.description?`<span class="item-preview">${w(t.description)}</span>`:""}
        <div class="item-meta">
          <span>Created: ${t.created_at?new Date(t.created_at).toLocaleDateString():"Unknown"}</span>
        </div>
      </div>
    `).join("")}}function p(e){const t=document.getElementById("project-editor-content"),n=document.getElementById("project-form");if(!t||!n)return;if(!e){t.style.display="flex",n.style.display="none";return}t.style.display="none",n.style.display="flex";const c=document.getElementById("project-id"),o=document.getElementById("project-name"),l=document.getElementById("project-description"),d=document.getElementById("project-context");c&&(c.value=e.id||""),o&&(o.value=e.name||""),l&&(l.value=e.description||""),d&&(d.value=e.context||"");const i=document.getElementById("export-project-btn"),m=document.getElementById("delete-project-btn");i&&m&&(e.id?(i.style.display="flex",m.style.display="flex"):(i.style.display="none",m.style.display="none"))}function E(e){const t=document.getElementById("project-resources-content");if(!t)return;if(!e){t.innerHTML=`
        <div class="empty-resources">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>No Resources</h3>
          <p>Select a project to see its resources</p>
        </div>
      `;return}t.innerHTML=`
      <div class="resource-summary">
        <h4>Resource Summary</h4>
        <div class="resource-stats">
          <div class="resource-stat">
            <div class="resource-stat-value">0</div>
            <div class="resource-stat-label">Agents</div>
          </div>
          <div class="resource-stat">
            <div class="resource-stat-value">0</div>
            <div class="resource-stat-label">Templates</div>
          </div>
          <div class="resource-stat">
            <div class="resource-stat-value">0</div>
            <div class="resource-stat-label">Requirements</div>
          </div>
        </div>
      </div>
    `;const n=document.getElementById("manage-resources-btn");n&&(n.style.display="flex")}function v(e){r=e;const t=s.find(n=>n.id===e);h(),p(t),E(t),y=!1}function j(){r=null,y=!0,p({name:"",description:"",context:""}),E();const t=document.getElementById("project-name");t&&t.focus()}async function x(){const e=document.getElementById("project-id"),t=document.getElementById("project-name"),n=document.getElementById("project-description"),c=document.getElementById("project-context");if(!t)return;const o=t.value.trim(),l=n?.value.trim()||"",d=c?.value.trim()||"";if(!o){a("Project name is required","error");return}try{const i={name:o,description:l,context:d},m=e&&e.value;let f;m?(f=await u.projects.update(e.value,i),a("Project updated!")):(f=await u.projects.create(i),a("Project created!")),await g(),v(f.id),y=!1}catch(i){console.error("Failed to save project:",i),a("Failed to save project","error")}}async function L(){if(!r)return;const e=s.find(t=>t.id===r);if(e&&confirm(`Delete project "${e.name}"? This cannot be undone.`))try{await u.projects.delete(r),a("Project deleted"),await g(),s.length>0?v(s[0].id):(r=null,p(),E())}catch(t){console.error("Failed to delete project:",t),a("Failed to delete project","error")}}function P(){if(y=!1,r){const e=s.find(t=>t.id===r);p(e)}else p()}function w(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function a(e,t="success"){const n=document.getElementById("toast");n&&(n.textContent=e,n.className=`toast ${t} show`,setTimeout(()=>n.classList.remove("show"),3e3))}function k(){document.getElementById("new-project-btn")?.addEventListener("click",j),document.getElementById("empty-new-project-btn")?.addEventListener("click",j),document.getElementById("save-project-btn")?.addEventListener("click",x),document.getElementById("cancel-project-btn")?.addEventListener("click",P),document.getElementById("delete-project-btn")?.addEventListener("click",L),document.getElementById("project-search")?.addEventListener("input",e=>{const n=e.target.value.toLowerCase();document.querySelectorAll(".item-card").forEach(o=>{const l=o.querySelector(".item-name")?.textContent?.toLowerCase()||"",d=o.querySelector(".item-preview")?.textContent?.toLowerCase()||"";l.includes(n)||d.includes(n)?o.style.display="block":o.style.display="none"})}),document.querySelectorAll(".resource-tab").forEach(e=>{e.addEventListener("click",()=>{const t=e.getAttribute("data-tab");if(!t)return;document.querySelectorAll(".resource-tab").forEach(c=>c.classList.remove("active")),e.classList.add("active"),document.querySelectorAll(".resource-tab-content").forEach(c=>{c.style.display="none"});const n=document.getElementById(`${t}-tab`);n&&(n.style.display="grid")})})}window.selectProject=v;window.startNewProject=j;
