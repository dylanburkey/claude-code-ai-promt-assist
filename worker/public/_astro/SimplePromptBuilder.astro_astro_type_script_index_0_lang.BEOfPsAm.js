import{a as E}from"./api.BoRAYT-2.js";let c=null,l=null,p=null;document.addEventListener("DOMContentLoaded",()=>{y(),v()});function y(){document.getElementById("generate-prompt-btn")?.addEventListener("click",I),document.getElementById("clear-form-btn")?.addEventListener("click",q),document.getElementById("clear-requirement-btn")?.addEventListener("click",h),document.addEventListener("agent-selected",e=>{c=e.detail.agent,g()}),document.addEventListener("requirement-selected",e=>{l=e.detail.requirement;const t=document.getElementById("output-requirements"),n=document.getElementById("clear-requirement-btn");t&&l&&(t.value=l.requirements_content,n&&(n.style.display="block"))}),document.addEventListener("project-changed",e=>{p=e.detail.project}),["task","context","format","output-requirements"].forEach(e=>{const t=document.getElementById(e);t&&t.addEventListener("input",f)})}function v(){try{const e=localStorage.getItem("prompt-builder-state");if(e){const t=JSON.parse(e);["task","context","format","output-requirements"].forEach(n=>{const o=document.getElementById(n);o&&t[n]&&(o.value=t[n])})}}catch(e){console.warn("Failed to load form state:",e)}}function f(){try{const e={};["task","context","format","output-requirements"].forEach(t=>{const n=document.getElementById(t);n&&(e[t]=n.value)}),localStorage.setItem("prompt-builder-state",JSON.stringify(e))}catch(e){console.warn("Failed to save form state:",e)}}function g(){const e=document.getElementById("generate-prompt-btn"),t=document.getElementById("task");if(e&&t){const n=t.value.trim().length>0,o=c!==null;e.disabled=!n||!o,o?n?e.title="Generate semantic prompt":e.title="Please enter a task description":e.title="Please select an agent first"}}async function I(){const e=document.getElementById("task"),t=document.getElementById("context"),n=document.getElementById("format"),o=document.getElementById("output-requirements");if(!e||!c)return;const a=e.value.trim(),r=t?.value.trim()||"",u=n?.value.trim()||"",m=o?.value.trim()||"";if(!a){i("Please enter a task description","error");return}try{let s;p?.id?s=(await E.prompts.generate(p.id,{agentId:c.id,task:a,context:r,format:u,outputRequirements:m})).prompt:s=B(c,a,r,u,m);const d=document.getElementById("output-display");d&&(d.textContent=s,d.classList.remove("output-placeholder")),document.dispatchEvent(new CustomEvent("prompt-generated",{detail:{prompt:s,agent:c,task:a,context:r,format:u,outputReqs:m}})),i("Prompt generated successfully!"),window.innerWidth<769&&k("output")}catch(s){console.error("Failed to generate prompt:",s),i("Failed to generate prompt","error")}}function B(e,t,n,o,a){let r=`${e.role}

`;return e.style&&(r+=`<agent_style>
${e.style}
</agent_style>

`),n&&(r+=`<context>
${n}
</context>

`),r+=`<task_instruction>
${t}
</task_instruction>

`,o&&(r+=`<output_format>
${o}
</output_format>

`),a&&(r+=`<output_requirements>
${a}
</output_requirements>`),r.trim()}function q(){["task","context","format","output-requirements"].forEach(t=>{const n=document.getElementById(t);n&&(n.value="")}),localStorage.removeItem("prompt-builder-state");const e=document.getElementById("clear-requirement-btn");e&&(e.style.display="none"),i("Form cleared")}function h(){const e=document.getElementById("output-requirements"),t=document.getElementById("clear-requirement-btn");e&&(e.value=""),t&&(t.style.display="none"),l=null,f()}function k(e){if(window.innerWidth>=769)return;document.querySelectorAll(".panel").forEach(o=>o.classList.remove("active-view")),document.querySelectorAll(".mobile-tab").forEach(o=>o.classList.remove("active"));const t=document.getElementById(`view-${e}`);t&&t.classList.add("active-view");const n=document.querySelector(`[data-view="${e}"]`);n&&n.classList.add("active")}function i(e,t="success"){const n=document.getElementById("toast");n&&(n.textContent=e,n.className=`toast ${t} show`,setTimeout(()=>n.classList.remove("show"),3e3))}document.getElementById("task")?.addEventListener("input",g);
