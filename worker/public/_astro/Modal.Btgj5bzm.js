import { d as createAstro, c as createComponent, m as maybeRenderHead, f as addAttribute, g as renderSlot, b as renderTemplate, e as defineScriptVars } from "./astro/server.DiNYdjbW.js";
import "piccolore";
import "html-escaper";
import "clsx";
/* empty css                        */
const $$Astro$2 = createAstro("https://localhost:4321");
const $$Button = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Button;
  const {
    variant = "primary",
    size = "md",
    disabled = false,
    type = "button",
    class: className = "",
    id,
    title,
    onclick,
    style
  } = Astro2.props;
  const baseClasses = "btn";
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost"
  };
  const sizeClasses = {
    xs: "btn-xs",
    sm: "btn-sm",
    md: "",
    lg: "",
    icon: "btn-icon"
  };
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(" ");
  return renderTemplate`${maybeRenderHead()}<button${addAttribute(classes, "class")}${addAttribute(type, "type")}${addAttribute(disabled, "disabled")}${addAttribute(id, "id")}${addAttribute(title, "title")}${addAttribute(onclick, "onclick")}${addAttribute(style, "style")} data-astro-cid-6ygtcg62> ${renderSlot($$result, $$slots["default"])} </button> `;
}, "/Users/dylanburkey/dev/claude-prompt-helper/astro-frontend/src/components/ui/Button.astro", void 0);
const $$Astro$1 = createAstro("https://localhost:4321");
const $$Form = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Form;
  const { class: className = "" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<div${addAttribute(`input-group ${className}`, "class")} data-astro-cid-2lkv3ujd> ${renderSlot($$result, $$slots["default"])} </div> `;
}, "/Users/dylanburkey/dev/claude-prompt-helper/astro-frontend/src/components/ui/Form.astro", void 0);
var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://localhost:4321");
const $$Modal = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Modal;
  const { id, title, class: className = "" } = Astro2.props;
  return renderTemplate(_a || (_a = __template(["", "<div", "", ' data-astro-cid-hrybwmjy> <div class="modal" data-astro-cid-hrybwmjy> <h2 data-astro-cid-hrybwmjy>', "</h2> ", " </div> </div>  <script>(function(){", "\n  // Close modal on outside click\n  document.addEventListener('DOMContentLoaded', () => {\n    const modal = document.getElementById(id);\n    if (modal) {\n      modal.addEventListener('click', (e) => {\n        if (e.target.classList.contains('modal-overlay')) {\n          modal.classList.remove('open');\n        }\n      });\n    }\n  });\n})();<\/script>"])), maybeRenderHead(), addAttribute(id, "id"), addAttribute(`modal-overlay ${className}`, "class"), title, renderSlot($$result, $$slots["default"]), defineScriptVars({ id }));
}, "/Users/dylanburkey/dev/claude-prompt-helper/astro-frontend/src/components/ui/Modal.astro", void 0);
export {
  $$Button as $,
  $$Form as a,
  $$Modal as b
};
