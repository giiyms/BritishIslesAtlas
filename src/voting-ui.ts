/**
 * On-map voting chrome (style roast 2026-10-05 fix 2): a top-centre glass pill
 * legend with seat counts, and a one-line toast when the voting view pauses
 * context layers. DOM only; no pick logic here.
 */

export interface VotingLegend {
  setCounts: (counts: Record<string, number>) => void;
  setVisible: (visible: boolean) => void;
}

export function mountVotingLegend(
  host: HTMLElement,
  options: { reformColor: string; restoreColor: string; onRestore: () => void },
): VotingLegend {
  const root = document.createElement("div");
  root.className = "vote-legend";
  root.hidden = true;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Endorsement legend");
  root.innerHTML =
    `<span class="vote-legend-item"><span class="vote-swatch" style="background:${options.reformColor};opacity:0.6"></span>` +
    `Reform <span class="vote-count" data-count="reform">–</span></span>` +
    `<span class="vote-legend-sep" aria-hidden="true">·</span>` +
    `<button type="button" class="vote-legend-item vote-legend-restore" title="Fly to the Restore seat">` +
    `<span class="vote-swatch" style="background:${options.restoreColor}"></span>` +
    `Restore <span class="vote-count" data-count="restore">–</span></button>`;
  root.querySelector("button")?.addEventListener("click", () => options.onRestore());
  host.append(root);
  return {
    setCounts(counts) {
      for (const el of root.querySelectorAll<HTMLElement>("[data-count]")) {
        const n = counts[el.dataset.count ?? ""];
        el.textContent = typeof n === "number" ? String(n) : "–";
      }
    },
    setVisible(visible) {
      root.hidden = !visible;
      document.body.classList.toggle("voting-view", visible);
    },
  };
}

let toastTimer = 0;

export function showVotingToast(text: string, actionLabel: string, onAction: () => void): void {
  let toast = document.querySelector<HTMLElement>(".vote-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "vote-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.append(toast);
  }
  toast.innerHTML = "";
  const label = document.createElement("span");
  label.textContent = `${text} · `;
  const action = document.createElement("button");
  action.type = "button";
  action.textContent = actionLabel;
  action.addEventListener("click", () => {
    hideVotingToast();
    onAction();
  });
  toast.append(label, action);
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideVotingToast, 9000);
}

export function hideVotingToast(): void {
  window.clearTimeout(toastTimer);
  const toast = document.querySelector<HTMLElement>(".vote-toast");
  if (toast) toast.hidden = true;
}
