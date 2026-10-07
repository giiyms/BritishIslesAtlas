/** One-line status toast with an optional action (layer cap, voting notes). */
let timer = 0;

export function showToast(text: string, action?: { label: string; run: () => void }): void {
  let toast = document.querySelector<HTMLElement>(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }
  toast.replaceChildren();
  const label = document.createElement("span");
  label.textContent = text;
  toast.append(label);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      hideToast();
      action.run();
    });
    toast.append(" · ", button);
  }
  toast.hidden = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(hideToast, 6000);
}

export function hideToast(): void {
  window.clearTimeout(timer);
  const toast = document.querySelector<HTMLElement>(".toast");
  if (toast) toast.hidden = true;
}
