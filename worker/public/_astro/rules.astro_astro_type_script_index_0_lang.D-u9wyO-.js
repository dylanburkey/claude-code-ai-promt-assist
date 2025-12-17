import{a as y}from"./api.CmHKHOM5.js";let i=[],o=null,f=!1;document.addEventListener("DOMContentLoaded",async()=>{await E(),S()});async function E(){try{i=await y.rules.list(),B(),i.length>0&&!o&&v(i[0].id)}catch(e){console.error("Failed to load rule sets:",e),r("Failed to load rule sets","error")}}function B(){const e=document.getElementById("rule-set-list");if(e){if(i.length===0){e.innerHTML=`
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3>No rule sets yet</h3>
          <p>Create your first rule set to guide AI behavior</p>
          <button class="btn-primary" onclick="startNewRuleSet()">Create Rule Set</button>
        </div>
      `;return}e.innerHTML=i.map(t=>`
      <div class="item-card ${t.id===o?"active":""} ${t.ai_enhanced?"ai-enhanced":""}" onclick="selectRuleSet('${t.id}')">
        <div class="item-card-header">
          <span class="item-name">${h(t.name)}</span>
        </div>
        ${t.description?`<span class="item-preview">${h(t.description)}</span>`:""}
      </div>
    `).join("")}}function p(e){const t=document.getElementById("rule-editor-content"),n=document.getElementById("rule-form");if(!t||!n)return;if(!e){t.style.display="flex",n.style.display="none";return}t.style.display="none",n.style.display="flex";const l=document.getElementById("rule-set-id"),s=document.getElementById("rule-set-name"),c=document.getElementById("rule-set-description"),a=document.getElementById("rule-set-content");l&&(l.value=e.id||""),s&&(s.value=e.name||""),c&&(c.value=e.description||""),a&&(a.value=e.rule_content||"");const d=document.getElementById("ai-enhance-btn"),m=document.getElementById("duplicate-rule-set-btn"),u=document.getElementById("delete-rule-set-btn");d&&m&&u&&(e.id?(d.style.display="flex",m.style.display="flex",u.style.display="flex"):(d.style.display="none",m.style.display="none",u.style.display="none"))}function I(e){const t=document.getElementById("rule-preview-content");if(!t)return;if(!e){t.innerHTML=`
        <div class="empty-preview">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <h3>Rule Preview</h3>
          <p>Select a rule set to see how it will appear in prompts</p>
        </div>
      `;return}t.innerHTML=`
      <div class="rule-preview">
        <div class="preview-section">
          <div class="preview-label">RULES</div>
          <div class="preview-value">${h(e.rule_content)}</div>
        </div>
      </div>
    `;const n=document.getElementById("test-rules-btn");n&&(n.style.display="flex")}function v(e){o=e;const t=i.find(n=>n.id===e);B(),p(t),I(t),f=!1}function g(){o=null,f=!0,p({name:"",description:"",rule_content:""}),I();const t=document.getElementById("rule-set-name");t&&t.focus()}async function L(){const e=document.getElementById("rule-set-id"),t=document.getElementById("rule-set-name"),n=document.getElementById("rule-set-description"),l=document.getElementById("rule-set-content");if(!t||!l)return;const s=t.value.trim(),c=n?.value.trim()||"",a=l.value.trim();if(!s||!a){r("Name and rules content are required","error");return}try{const d={name:s,description:c,rule_content:a},m=e&&e.value;let u;m?(u=await y.rules.update(e.value,d),r("Rule set updated!")):(u=await y.rules.create(d),r("Rule set created!")),await E(),v(u.id),f=!1}catch(d){console.error("Failed to save rule set:",d),r("Failed to save rule set","error")}}async function x(){if(!o)return;const e=i.find(t=>t.id===o);if(e&&confirm(`Delete rule set "${e.name}"? This cannot be undone.`))try{await y.rules.delete(o),r("Rule set deleted"),await E(),i.length>0?v(i[0].id):(o=null,p(),I())}catch(t){console.error("Failed to delete rule set:",t),r("Failed to delete rule set","error")}}function R(){if(f=!1,o){const e=i.find(t=>t.id===o);p(e)}else p()}async function b(){if(!o)return;const t=document.getElementById("enhancement-context")?.value.trim()||"",n=[];document.getElementById("goal-clarity")?.checked&&n.push("clarity"),document.getElementById("goal-completeness")?.checked&&n.push("completeness"),document.getElementById("goal-examples")?.checked&&n.push("examples"),document.getElementById("goal-structure")?.checked&&n.push("structure");try{k();const l=await y.ai.enhanceRules(o,{context:t,goals:n}),s=document.getElementById("rule-set-content");s&&(s.value=l.enhanced_content),w(),r("Rules enhanced successfully!");const c=document.getElementById("ai-enhance-modal");c&&(c.style.display="none")}catch(l){console.error("Failed to enhance rules:",l),w(),r("Failed to enhance rules","error")}}function k(){const e=document.getElementById("rule-form");if(!e)return;e.insertAdjacentHTML("afterbegin",`
      <div class="enhancement-progress" id="enhancement-progress">
        <h4>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          AI Enhancement in Progress
        </h4>
        <p>Analyzing and improving your rules...</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `);let n=0;const l=setInterval(()=>{n+=Math.random()*15,n>90&&(n=90);const s=document.querySelector(".progress-fill");s&&(s.style.width=`${n}%`),n>=90&&clearInterval(l)},500)}function w(){const e=document.getElementById("enhancement-progress");e&&e.remove()}function h(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function r(e,t="success"){const n=document.getElementById("toast");n&&(n.textContent=e,n.className=`toast ${t} show`,setTimeout(()=>n.classList.remove("show"),3e3))}function S(){document.getElementById("new-rule-set-btn")?.addEventListener("click",g),document.getElementById("empty-new-rule-set-btn")?.addEventListener("click",g),document.getElementById("save-rule-set-btn")?.addEventListener("click",L),document.getElementById("cancel-rule-set-btn")?.addEventListener("click",R),document.getElementById("delete-rule-set-btn")?.addEventListener("click",x),document.getElementById("ai-enhance-btn")?.addEventListener("click",()=>{const e=document.getElementById("ai-enhance-modal");e&&(e.style.display="flex")}),document.getElementById("btn-start-enhance")?.addEventListener("click",b),document.getElementById("btn-cancel-enhance")?.addEventListener("click",()=>{const e=document.getElementById("ai-enhance-modal");e&&(e.style.display="none")}),document.getElementById("rule-set-search")?.addEventListener("input",e=>{const n=e.target.value.toLowerCase();document.querySelectorAll(".item-card").forEach(s=>{const c=s.querySelector(".item-name")?.textContent?.toLowerCase()||"",a=s.querySelector(".item-preview")?.textContent?.toLowerCase()||"";c.includes(n)||a.includes(n)?s.style.display="block":s.style.display="none"})})}window.selectRuleSet=v;window.startNewRuleSet=g;
