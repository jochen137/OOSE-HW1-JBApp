import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabaseUrl = 'https://svefvkyanlfmqvecxpcn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZWZ2a3lhbmxmbXF2ZWN4cGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4ODc2MzAsImV4cCI6MjA3MzQ2MzYzMH0.-2J3eAVpx5SIGmHbYL4QyRnRwCha4V0cuMKFI7LBpgw'
const supabase = createClient(supabaseUrl, supabaseKey)

//DOM
const $ = (s, r=document) => r.querySelector(s);
const jobList   = $("#jobList");
const form      = $("#jobForm");
const inTitle   = $("#title");
const inCompany = $("#company");
const inLocation= $("#location");
const inPay     = $("#pay");
const inDesc    = $("#desc");
const search    = $("#search");
const username  = $("#username");
const btnSignIn = $("#btnSignIn");

let currentUser = "";
let jobs = [];

//Supabase
async function loadJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("posted_at", { ascending: false });

  if (error) {
    console.error("Load error:", error);
    alert("Could not load jobs.");
    return;
  }

  jobs = (data || []).map(row => ({
    _id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    pay: row.pay,
    desc: row.desc,
    postedAt: new Date(row.posted_at),
  }));

  render();
}

async function addJob(job) {
  const row = {
    title: job.title,
    company: job.company,
    location: job.location || null,
    pay: job.pay ?? null,
    desc: job.desc || null,
    posted_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("jobs").insert(row);
  if (error) throw error;
}

async function deleteJob(id) {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

//UI Events
btnSignIn.addEventListener("click", () => {
  if (currentUser) {
    currentUser = "";
    btnSignIn.textContent = "Sign in";
    username.value = "";
  } else {
    const name = (username.value || "").trim();
    if (!name) return alert("Enter a username to sign in.");
    currentUser = name;
    btnSignIn.textContent = "Sign out";
  }
  render();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title   = inTitle.value.trim();
  const company = inCompany.value.trim();
  if (!title || !company) return alert("Job Title and Company are required.");

  const job = {
    title,
    company,
    location: inLocation.value.trim(),
    pay: inPay.value ? Number(inPay.value) : null,
    desc: inDesc.value.trim(),
  };

  try {
    await addJob(job);
    form.reset();
    await loadJobs();
  } catch (err) {
    console.error("Add error:", err);
    alert("Could not add job.");
  }
});

search.addEventListener("input", render);

//Render
function render() {
  const terms = (search.value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const results = jobs.filter(j => {
    if (!terms.length) return true;
    const hay = `${j.title} ${j.company} ${j.location || ""} ${j.desc || ""}`.toLowerCase();
    return terms.every(t => hay.includes(t));
  });

  jobList.innerHTML = "";
  if (!results.length) {
    jobList.innerHTML = `<div class="job"><div>No jobs yet. Add one above.</div></div>`;
    return;
  }

  for (const j of results) {
    const li = document.createElement("div");
    li.className = "job";

    const main = document.createElement("div");
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = `${j.title} — ${j.company}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    const bits = [];
    if (j.location) bits.push(j.location);
    if (j.pay != null) bits.push(j.pay < 500 ? `$${j.pay}/hr` : `$${j.pay.toLocaleString()}`);
    bits.push(j.postedAt.toLocaleDateString());
    meta.textContent = bits.join(" • ");

    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = j.desc || "";

    main.append(title, meta, desc);

    const actions = document.createElement("div");
    actions.className = "actions";

    const applyBtn = document.createElement("button");
    applyBtn.textContent = currentUser ? "Apply" : "Sign in to apply";
    if (!currentUser) {
      applyBtn.classList.add("secondary");
      applyBtn.addEventListener("click", () => alert("Please sign in (top right) to apply."));
    } else {
      applyBtn.addEventListener("click", () =>
        alert(`Applied to “${j.title}” at ${j.company} as ${currentUser}`)
      );
    }

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this job?")) return;
      try {
        await deleteJob(j._id);
        await loadJobs();
      } catch (err) {
        console.error("Delete error:", err);
        alert("Could not delete job.");
      }
    });

    actions.append(applyBtn, delBtn);
    li.append(main, actions);
    jobList.appendChild(li);
  }
}

//Realtime
supabase
  .channel("jobs-realtime")
  .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, loadJobs)
  .subscribe();

//Start
loadJobs();