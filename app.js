// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
const API_URL = "http://127.0.0.1:8000/predict"; // change to your deployed FastAPI URL

// in-memory ledger for this session (swap for a real backend call later)
const predictionHistory = [];

// ---------------------------------------------------------------------
// View routing (nav tabs)
// ---------------------------------------------------------------------
function showView(name) {
  // Guard the dashboard: if nobody's logged in, send them to Login/Register
  // instead of showing stale placeholder data.
  if (name === "dashboard") {
    if (!currentUser) {
      showView("auth");
      return;
    }
    refreshDashboard();
  }

  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add("active");

  document.querySelectorAll("#navTabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

document.getElementById("navTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (btn) showView(btn.dataset.view);
});

// ---------------------------------------------------------------------
// Login / Register toggle
// ---------------------------------------------------------------------
function setAuth(mode) {
  document.querySelectorAll(".auth-toggle button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.auth === mode);
  });
  document.getElementById("login-form").style.display = mode === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = mode === "register" ? "block" : "none";
}

// ---------------------------------------------------------------------
// Auth — kept entirely in memory, no localStorage, no backend/database.
// Accounts only last for this page session; a refresh clears them.
//
// NOTE: passwords are stored in plain text in a JS array. That's fine
// for a class project/demo, but never do this for real user data — a
// real deployment needs a backend that hashes passwords (bcrypt/argon2).
// ---------------------------------------------------------------------
const users = [];
let currentUser = null;

function showAuthError(formName, message) {
  const el = document.getElementById(`${formName}-error`);
  el.textContent = message;
  el.style.display = message ? "block" : "none";
}

function registerUser() {
  showAuthError("register", "");

  const name = val("register-name").trim();
  const email = val("register-email").trim().toLowerCase();
  const branch = val("register-branch");
  const password = val("register-password");

  if (!name || !email || !password) {
    showAuthError("register", "Please fill in your name, email and password.");
    return;
  }

  if (users.some((u) => u.email === email)) {
    showAuthError("register", "You've already registered this session — try logging in instead.");
    return;
  }

  users.push({ name, email, branch, password });
  currentUser = { name, email, branch, password };

  clearAuthFields("register");
  enterDashboard();
}

function loginUser() {
  showAuthError("login", "");

  const email = val("login-email").trim().toLowerCase();
  const password = val("login-password");

  const match = users.find((u) => u.email === email && u.password === password);

  if (!match) {
    showAuthError("login", "No account matches that email and password. Register first — accounts only last this session.");
    return;
  }

  currentUser = match;
  clearAuthFields("login");
  enterDashboard();
}

function logoutUser() {
  currentUser = null;
  document.getElementById("logout-btn").style.display = "none";
  showView("home");
}

function clearAuthFields(formName) {
  document.querySelectorAll(`#${formName}-form input`).forEach((input) => (input.value = ""));
}

function enterDashboard() {
  document.getElementById("logout-btn").style.display = currentUser ? "inline-block" : "none";
  refreshDashboard();
  showView("dashboard");
}

function refreshDashboard() {
  if (!currentUser) return;
  document.getElementById("dash-name").textContent = currentUser.name;
  document.getElementById("dash-email").textContent = currentUser.email;
  document.getElementById("dash-branch").textContent = currentUser.branch;
  document.getElementById("dash-avatar").textContent = currentUser.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------
// Predict form -> FastAPI -> Result view
// ---------------------------------------------------------------------
function val(id) {
  return document.getElementById(id).value;
}

function num(id) {
  return Number(document.getElementById(id).value);
}

function buildPayload() {
  return {
    Age: num("in-age"),
    Gender: val("in-gender"),
    Degree: val("in-degree"),
    Branch: val("in-branch"),
    CGPA: num("in-cgpa"),
    "10th_Percentage": num("in-10th"),
    "12th_Percentage": num("in-12th"),
    Attendance_Percentage: num("in-attendance"),
    Active_Backlogs: num("in-backlogs"),
    Programming_Score: num("in-prog"),
    Aptitude_Score: num("in-apt"),
    Communication_Score: num("in-comm"),
    Technical_Interview_Score: num("in-tech"),
    Mock_Interview_Score: num("in-mock"),
    Internships: num("in-intern"),
    Projects: num("in-proj"),
    Hackathons: num("in-hack"),
    Certifications: num("in-cert"),
    Problem_Solving: num("in-prob"),
    English_Fluency: num("in-eng"),
  };
}

async function runPrediction() {
  const btn = document.getElementById("predict-submit-btn");
  const errBox = document.getElementById("predict-error");
  errBox.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Evaluating…";

  try {
    const payload = buildPayload();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `API error ${res.status}`);
    }

    const data = await res.json(); // { placed, prediction, probability_placed, probability_not_placed }
    renderResult(payload, data);
    showView("result");
  } catch (err) {
    errBox.textContent = `Couldn't get a prediction: ${err.message}. Is the FastAPI server running at ${API_URL}?`;
    errBox.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit for evaluation →";
  }
}

function renderResult(payload, data) {
  const confidencePct = Math.round((data.placed ? data.probability_placed : data.probability_not_placed) * 100);
  const placed = data.placed;

  document.getElementById("result-name").textContent = `${payload.Branch} candidate, Age ${payload.Age}`;
  document.getElementById("result-timestamp").textContent = `Evaluated ${new Date().toLocaleString()}`;

  const stamp = document.getElementById("stamp-el");
  stamp.textContent = placed ? "Likely Placed" : "Likely Not Placed";
  stamp.className = `stamp ${placed ? "placed" : "notplaced"}`;

  const verdict = document.getElementById("gauge-verdict");
  verdict.textContent = placed ? "Placed" : "Not Placed";
  verdict.className = `gauge-num verdict ${placed ? "placed" : "notplaced"}`;

  document.getElementById("gauge-confidence").textContent = `${confidencePct}% confidence`;

  // Breakdown bars, scaled from the 1-10 inputs and CGPA
  const academicsPct = Math.round(((payload.CGPA / 10) * 0.5 + (payload["10th_Percentage"] / 100) * 0.25 + (payload["12th_Percentage"] / 100) * 0.25) * 100);
  setBar("bar-academics", academicsPct);
  setBar("bar-programming", payload.Programming_Score * 10);
  setBar("bar-aptitude", payload.Aptitude_Score * 10);
  setBar("bar-communication", payload.Communication_Score * 10);
  const experiencePct = Math.min(100, (payload.Internships * 20 + payload.Projects * 10 + payload.Hackathons * 10 + payload.Certifications * 10));
  setBar("bar-experience", experiencePct);

  // Remarks: flag the weakest signals
  const remarks = [];
  if (payload.Aptitude_Score <= 6) remarks.push("Aptitude score trails the rest of your profile — a weekly mock test would close this fastest.");
  if (payload.Communication_Score <= 6) remarks.push("Communication score is on the lower side — consider a few mock interviews or a soft-skills workshop.");
  if (payload.Internships === 0) remarks.push("You have no internships logged — even a short one strengthens your placement odds meaningfully.");
  if (payload.Hackathons === 0) remarks.push("Sign up for a coding contest or hackathon this month; recruiters weight this more than certifications.");
  if (payload.Active_Backlogs > 0) remarks.push(`Clearing your ${payload.Active_Backlogs} active backlog(s) would materially improve your prediction.`);
  if (remarks.length === 0) remarks.push("Your profile is well-rounded — keep your interview prep sharp and you're in strong shape.");

  const list = document.getElementById("remarks-list");
  list.innerHTML = "";
  remarks.slice(0, 3).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  });

  addToHistory(payload, data, confidencePct);
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function addToHistory(payload, data, confidencePct) {
  const topSuggestion = document.getElementById("remarks-list").firstChild
    ? document.getElementById("remarks-list").firstChild.textContent
    : "—";

  const entry = {
    date: new Date().toLocaleDateString(),
    confidence: `${confidencePct}%`,
    placed: data.placed,
    cgpa: payload.CGPA,
    suggestion: topSuggestion.length > 40 ? topSuggestion.slice(0, 40) + "…" : topSuggestion,
  };
  predictionHistory.unshift(entry);

  const tbody = document.getElementById("history-body");
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${entry.date}</td>
    <td>${entry.confidence}</td>
    <td><span class="status-pill ${entry.placed ? "placed" : "notplaced"}">${entry.placed ? "Placed" : "Not Placed"}</span></td>
    <td>${entry.cgpa}</td>
    <td>${entry.suggestion}</td>
  `;
  tbody.prepend(row);
}
// ---------------------------------------------------------------------
// Landing page enhancements: scroll reveal, animated counters, FAQ
// ---------------------------------------------------------------------
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Scroll reveal ----
  function initScrollReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach((el) => observer.observe(el));
  }

  // ---- Animated counters (Placement Insights) ----
  function animateCounter(el) {
    const target = Number(el.dataset.target || "0");
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(target * eased);
      el.textContent = `${value.toLocaleString()}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    }

    if (prefersReducedMotion) {
      el.textContent = `${target.toLocaleString()}${suffix}`;
      return;
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const counters = document.querySelectorAll(".counter");
    if (!counters.length) return;

    if (!("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  // ---- FAQ accordion ----
  function initFaqAccordion() {
    const list = document.getElementById("faq-list");
    if (!list) return;

    list.addEventListener("click", (e) => {
      const btn = e.target.closest(".faq-q");
      if (!btn) return;
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("open");

      // close any other open item for a clean single-open accordion
      list.querySelectorAll(".faq-item.open").forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove("open");
          openItem.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        }
      });

      item.classList.toggle("open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initScrollReveal();
    initCounters();
    initFaqAccordion();
  });
})();