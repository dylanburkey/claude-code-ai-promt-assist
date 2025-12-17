import{a as r}from"./api.CmHKHOM5.js";let s=[],d=[],l=null,a=null;document.addEventListener("DOMContentLoaded",async()=>{await v(),await f(),j(),window.innerWidth<769&&u("builder")});async function v(){try{s=await r.requirements.list(),g(),m()}catch(e){console.error("Failed to load requirements:",e),i("Failed to load requirements","error")}}async function f(){try{d=(await r.projects.list()).projects||[],h()}catch(e){console.error("Failed to load projects:",e),i("Failed to load projects","error")}}function u(e){if(window.innerWidth>=769)return;document.querySelectorAll(".panel").forEach(o=>o.classList.remove("active-view")),document.querySelectorAll(".mobile-tab").forEach(o=>o.classList.remove("active"));const t=document.getElementById(`view-${e}`);t&&t.classList.add("active-view");const n=document.querySelector(`[data-view="${e}"]`);n&&n.classList.add("active")}function y(e){l=e;const t=s.find(n=>n.id===e);t&&(document.dispatchEvent(new CustomEvent("requirement-selected",{detail:{requirement:t}})),r.requirements.trackUsage(e).catch(()=>{})),m()}function m(){const e=document.getElementById("requirement-list");if(e){if(s.length===0){e.innerHTML='<div class="empty-state">No requirements yet. Create one!</div>';return}e.innerHTML=s.map(t=>`
      <div class="item-card ${t.id===l?"active":""}" onclick="selectRequirement('${t.id}')">
        <div class="item-card-header">
          <span class="item-name">${c(t.name)}</span>
          <button class="btn-ghost btn-xs" onclick="event.stopPropagation(); editRequirement('${t.id}')" title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        <span class="item-preview">${c(t.requirements_content)}</span>
      </div>
    `).join("")}}function g(){const e=document.getElementById("requirements-count");e&&(e.textContent=s.length.toString())}function h(){const e=document.getElementById("current-project-select");e&&(e.innerHTML='<option value="">No Project Selected</option>',d.forEach(t=>{const n=document.createElement("option");n.value=t.id,n.textContent=t.name,e.appendChild(n)}))}function E(){const e=document.getElementById("output-display");if(!e)return;const t=e.textContent;if(!t||t.includes("Generated prompt will appear here")){i("No prompt to copy","error");return}navigator.clipboard.writeText(t).then(()=>i("Copied!")).catch(()=>i("Failed to copy","error"))}async function w(e){const t=document.getElementById("project-context-display");if(t){if(!e){t.innerHTML='<div class="empty-state">Select a project to see context</div>';return}try{const n=d.find(o=>o.id===e);if(!n){t.innerHTML='<div class="empty-state">Project not found</div>';return}t.innerHTML=`
        <div class="project-context-card">
          <div class="context-header">
            <span class="context-name">${c(n.name)}</span>
            <span class="context-status status-${n.status||"active"}">${n.status||"active"}</span>
          </div>
          ${n.description?`<p class="context-description">${c(n.description)}</p>`:""}
          ${n.ai_context_summary?`
            <div class="ai-context">
              <span class="ai-context-label">AI Context:</span>
              <p>${c(n.ai_context_summary)}</p>
            </div>
          `:""}
          <div class="context-actions">
            <a href="/projects/${n.slug||n.id}" class="btn-link">View Project</a>
          </div>
        </div>
      `;try{const o=await r.projects.resources(e);L(o.filter(p=>p.resource_type==="agent"))}catch(o){console.warn("Could not load project resources:",o)}}catch(n){console.error("Failed to load project context:",n),t.innerHTML='<div class="empty-state">Failed to load project context</div>'}}}function L(e){const t=document.getElementById("project-agent-list"),n=document.getElementById("project-agents-count");if(t){if(n&&(n.textContent=e.length.toString()),e.length===0){t.innerHTML='<div class="empty-state">No agents assigned to project</div>';return}t.innerHTML=e.map(o=>`
      <div class="item-card" onclick="selectAgent('${o.resource_id}')">
        <div class="item-card-header">
          <span class="item-name">${c(o.name||"Agent")}</span>
        </div>
      </div>
    `).join("")}}function j(){document.querySelectorAll(".mobile-tab").forEach(e=>{e.addEventListener("click",()=>{const t=e.getAttribute("data-view");t&&u(t)})}),document.querySelectorAll(".collapsible-header").forEach(e=>{e.addEventListener("click",()=>{const t=e.closest(".collapsible-section");t&&t.classList.toggle("collapsed")})}),document.getElementById("copy-btn")?.addEventListener("click",E),document.getElementById("current-project-select")?.addEventListener("change",async e=>{a=e.target.value,await w(a),document.dispatchEvent(new CustomEvent("project-changed",{detail:{projectId:a}}))}),document.getElementById("close-sidebar")?.addEventListener("click",()=>{const e=document.getElementById("sidebar-panel");e&&e.classList.remove("mobile-open")}),document.addEventListener("prompt-generated",e=>{const t=document.getElementById("output-display");t&&(t.textContent=e.detail.prompt,t.classList.remove("output-placeholder"))})}function c(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function i(e,t="success"){const n=document.getElementById("toast");n&&(n.textContent=e,n.className=`toast ${t} show`,setTimeout(()=>n.classList.remove("show"),3e3))}window.selectRequirement=y;window.editRequirement=e=>console.log("Edit requirement:",e);
