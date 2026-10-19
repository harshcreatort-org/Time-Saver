const CONFIG = {
  apiKey: "",              // Optional: YouTube Data API v3 key
  channelHandle: "",       // Example: @YourChannel
  initialVideoId: "L_L_LrvJhE4"
};

const $ = (id) => document.getElementById(id);

let videos = [];
let currentView = "all";
let currentQuery = "";

const player = $("player");
const grid = $("videoGrid");
const status = $("status");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function playVideo(video) {
  player.src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1`;

  $("playingTitle").textContent = video.title;
  $("playingDescription").textContent =
    video.description || "Playing via the official YouTube player.";

  $("openOriginal").href =
    `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;

  $("playerSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderVideos() {
  let filtered = videos.filter(video => {
    const text = `${video.title} ${video.description}`.toLowerCase();
    return text.includes(currentQuery.toLowerCase());
  });

  if (currentView === "latest") {
    filtered.sort((a, b) => b.date.localeCompare(a.date));
  } else if (currentView === "popular") {
    filtered.sort((a, b) => b.views - a.views);
  }

  $("resultCount").textContent =
    `${filtered.length} video${filtered.length === 1 ? "" : "s"}`;

  grid.innerHTML = "";

  if (!filtered.length) {
    status.textContent = videos.length
      ? "No videos match your search."
      : "No channel videos loaded yet.";
    return;
  }

  status.textContent = "";

  filtered.forEach(video => {
    const card = document.createElement("article");
    card.className = "video-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Play ${video.title}`);

    card.innerHTML = `
      <img class="thumbnail"
        src="${escapeHTML(video.thumbnail)}"
        alt=""
        loading="lazy">
      <div class="card-title">${escapeHTML(video.title)}</div>
      <div class="card-meta">
        ${video.views ? video.views.toLocaleString() + " views · " : ""}
        ${escapeHTML(video.date || "YouTube video")}
      </div>
    `;

    card.addEventListener("click", () => playVideo(video));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playVideo(video);
      }
    });

    grid.appendChild(card);
  });
}

function addInitialVideo() {
  videos = [{
    id: CONFIG.initialVideoId,
    title: "Watch the featured video",
    description: "Your selected YouTube video.",
    thumbnail:
      `https://i.ytimg.com/vi/${CONFIG.initialVideoId}/hqdefault.jpg`,
    date: "Featured",
    views: 0
  }];

  renderVideos();
}

async function youtubeAPI(endpoint, params = {}) {
  const url = new URL(
    `https://www.googleapis.com/youtube/v3/${endpoint}`
  );

  Object.entries({ ...params, key: CONFIG.apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "YouTube API request failed.");
  }

  return data;
}

async function loadChannelVideos() {
  if (!CONFIG.apiKey || !CONFIG.channelHandle) {
    $("channelInfo").textContent =
      "Add your channel handle and API key in script.js to load all uploads.";
    status.textContent =
      "Showing the featured video. Configure your channel to load its uploads.";
    return;
  }

  status.textContent = "Loading channel videos...";

  try {
    const channelData = await youtubeAPI("channels", {
      part: "snippet,contentDetails",
      forHandle: CONFIG.channelHandle
    });

    const channel = channelData.items?.[0];

    if (!channel) {
      throw new Error("Channel not found. Check the channel handle.");
    }

    $("channelInfo").textContent = channel.snippet.title;

    const uploadsPlaylist =
      channel.contentDetails.relatedPlaylists.uploads;

    let pageToken = "";
    let allVideos = [];

    // Load channel uploads in batches of up to 50.
    // Stop after 200 videos to keep this starter lightweight.
    while (allVideos.length < 200) {
      const params = {
        part: "snippet,contentDetails",
        playlistId: uploadsPlaylist,
        maxResults: 50
      };

      if (pageToken) params.pageToken = pageToken;

      const data = await youtubeAPI("playlistItems", params);

      allVideos.push(...data.items);
      pageToken = data.nextPageToken || "";

      if (!pageToken) break;
    }

    videos = allVideos.map(item => {
      const snippet = item.snippet;
      const id = item.contentDetails?.videoId;

      return {
        id,
        title: snippet.title || "Untitled video",
        description: snippet.description || "",
        thumbnail:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        date: snippet.publishedAt || "",
        views: 0
      };
    }).filter(video => video.id);

    $("sectionTitle").textContent = channel.snippet.title;
    $("playingTitle").textContent = "Choose a video to watch";
    $("playingDescription").textContent =
      "Select any video from this channel below.";

    renderVideos();
  } catch (error) {
    status.textContent = `Could not load channel: ${error.message}`;
  }
}

$("searchForm").addEventListener("submit", event => {
  event.preventDefault();
  currentQuery = $("searchInput").value.trim();
  renderVideos();
});

$("searchInput").addEventListener("input", event => {
  currentQuery = event.target.value.trim();
  renderVideos();
});

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;

    document.querySelectorAll("[data-view]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $("sectionTitle").textContent = {
      all: "All videos",
      latest: "Latest videos",
      popular: "Popular videos"
    }[currentView];

    renderVideos();
  });
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("collapsed");
  document.body.classList.toggle("sidebar-collapsed");
});

$("homeBtn").addEventListener("click", event => {
  event.preventDefault();
  currentView = "all";
  currentQuery = "";
  $("searchInput").value = "";
  renderVideos();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("showAllBtn").addEventListener("click", () => {
  currentView = "all";
  currentQuery = "";
  $("searchInput").value = "";
  renderVideos();
});

addInitialVideo();
loadChannelVideos();
