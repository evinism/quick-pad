import {
  throttle,
  debounce,
  noteUrlToNoteID,
  enableTabsOnTextArea,
} from "./util.js";
import ShareDBClient from "sharedb/lib/client";
import StringBinding from "sharedb-string-binding";
import ReconnectingWebSocket from "reconnecting-websocket";

declare const Environment: any;
const { interactionStyle, noteId: pageLoadNoteId, email } = Environment;

const area = document.querySelector("textarea");

enableTabsOnTextArea(area!);

function renderRecentNotes(
  recentNotes: { id: string; abbreviation: string }[]
) {
  const listHtml = recentNotes
    .map(
      ({ id, abbreviation }) =>
        `<li><a href="/note/${id}/">${abbreviation || "[no title]"}</a></li>`
    )
    .reduce((a, b) => a + b, "");
  document.getElementById("note-list")!.innerHTML = listHtml;
}

// Wait to show the log in/out link until recent notes are loaded
// This is to avoid a flash of the link when the page loads, which isn't super pretty
const showLogInOutLink = () => {
  document
    .getElementsByClassName("log-in-out-link")[0]!
    .classList.remove("hidden");
};

/* recent notes through localStorage */
function initRecentNotesLocal() {
  const recentNotes = JSON.parse(localStorage.getItem("notes") || "[]").filter(
    (record: string) => pageLoadNoteId !== record
  );

  const displayedRecentNotes = recentNotes.filter(
    (record: string) => pageLoadNoteId !== record
  );
  if (displayedRecentNotes.length > 0) {
    // do a quick status update on all
    const fetchParams = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: displayedRecentNotes }),
    };
    fetch("/statusCheck", fetchParams)
      .catch(showLogInOutLink)
      .then((response) => response && response.json())
      .then(renderAndPersist)
      .then(showLogInOutLink);
  } else {
    renderAndPersist([]);
  }

  function renderAndPersist(statuses: any[]) {
    statuses = statuses.sort(
      (a, b) => recentNotes.indexOf(a.id) - recentNotes.indexOf(b.id)
    );

    renderRecentNotes(statuses);
    // and persist the notes that remain.
    const remainingIds = statuses.map((status) => status.id);
    if (pageLoadNoteId) {
      remainingIds.unshift(pageLoadNoteId);
    }
    localStorage.setItem("notes", JSON.stringify(remainingIds));
  }
}

function initRecentNotesServer() {
  const fetchParams = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  const qs = pageLoadNoteId ? `?reject=${pageLoadNoteId}` : "";
  fetch(`/recents${qs}`, fetchParams)
    .catch(showLogInOutLink)
    .then((response) => response && response.json())
    .then(renderRecentNotes)
    .then(showLogInOutLink);
}

if (email) {
  initRecentNotesServer();
} else {
  initRecentNotesLocal();
}

/* Stupid state management soln: */
interface ClientState {
  sidebarShown: boolean;
  viewerCount: number;
}

let state: ClientState = {
  sidebarShown: !!localStorage.getItem("sidebarShown"),
  viewerCount: 0,
};

function setState(newState: Partial<ClientState>) {
  state = Object.assign({}, state, newState);
  // Not general, but totally fine for such a small app.
  if (state.sidebarShown) {
    localStorage.setItem("sidebarShown", "1");
  } else {
    localStorage.removeItem("sidebarShown");
  }
  render(state);
}

// state => [proper view for state]
function render(stateToRender: ClientState) {
  // sidebar stuff
  const listElem = document.getElementById("note-list-wrapper");
  const togglerElem = document.getElementById("note-list-wrapper");
  if (stateToRender.sidebarShown) {
    listElem!.classList.remove("hidden");
    togglerElem!.classList.add("active");
  } else {
    listElem!.classList.add("hidden");
    togglerElem!.classList.remove("active");
  }

  // view counter stuff
  const viewerElem = document.getElementById("viewer-count-indicator");
  if (stateToRender.viewerCount > 1) {
    viewerElem!.classList.remove("hidden");
  } else {
    viewerElem!.classList.add("hidden");
  }
  const viewNumberElem = document.getElementById("viewer-count-number");
  viewNumberElem!.innerHTML = stateToRender.viewerCount + " viewing";
}

// Initial state
setState(state);

document.getElementById("list-toggler")!.addEventListener(
  "click",
  function toggleSidebar() {
    setState({ sidebarShown: !state.sidebarShown });
  },
  false
);

// Nonstatic page junk
function hookIntoNoteChanges(noteId: string) {
  console.log('[ShareDB Client] hookIntoNoteChanges called for', noteId);

  // Open WebSocket connection to ShareDB server
  let HOST = location.origin.replace(/^http/, "ws");
  const params = new URLSearchParams();
  params.set('noteId', noteId);
  if (email) {
    params.set('email', email);
  }
  HOST += `?${params.toString()}`;
  console.log('[ShareDB Client] Connecting to', HOST);

  const socket = new ReconnectingWebSocket(HOST, [], {
    // ShareDB handles dropped messages, and buffering them while the socket
    // is closed has undefined behavior
    maxEnqueuedMessages: 0
  });

  socket.addEventListener('open', () => {
    console.log('[ShareDB Client] WebSocket connected');
  });

  socket.addEventListener('close', (e: any) => {
    console.log('[ShareDB Client] WebSocket closed, code:', e.code, 'reason:', e.reason);
  });

  socket.addEventListener('error', (e: any) => {
    console.error('[ShareDB Client] WebSocket error:', e);
  });

  // Create ShareDB connection
  const connection = new ShareDBClient.Connection(socket as any);
  console.log('[ShareDB Client] ShareDB connection created');

  // Subscribe to the document
  const doc = connection.get('documents', noteId);
  console.log('[ShareDB Client] Subscribing to doc...');

  doc.subscribe(function(err: Error) {
    if (err) {
      console.error('[ShareDB Client] Subscription error:', err);
      return;
    }

    console.log('[ShareDB Client] Subscribed! doc.type:', doc.type, 'doc.data:', doc.data);

    if (doc.type === null) {
      console.error('[ShareDB Client] ERROR: doc.type is null - document does not exist in ShareDB!');
      return;
    }

    // Document should already exist (created when page was served)
    console.log('[ShareDB Client] Setting up StringBinding...');
    const binding = new StringBinding(area!, doc, ['content']);
    binding.setup();
    console.log('[ShareDB Client] StringBinding setup complete');

    // Presence-based viewer count (using channel presence, not doc presence,
    // because json0 doesn't support presence transforms)
    const presence = connection.getPresence(noteId);
    presence.subscribe(function(err?: Error) {
      if (err) {
        console.error('[ShareDB Client] Presence subscription error:', err);
        return;
      }

      const localPresence = presence.create();
      localPresence.submit(email ? { email } : {});

      const updateViewerCount = () => {
        const count = Object.keys(presence.remotePresences).length + 1;
        setState({ viewerCount: count });
      };

      updateViewerCount();
      presence.on('receive', updateViewerCount);
    });
  });
}



if (interactionStyle === "editable") {
  hookIntoNoteChanges(pageLoadNoteId);
} else if (interactionStyle === "createOnEdit") {
  const enableEdit = function () {
    fetch("new").then((response) => {
      const newNoteId = noteUrlToNoteID(response.url);
      // on creation, append this note to start of local notes
      // TODO: this is not DRY at all
      const lsString = localStorage.getItem("notes") || "[]";
      const noteIds = JSON.parse(lsString);
      noteIds.unshift(newNoteId);
      if (!email) {
        // When logged in, we handle recents differently.
        localStorage.setItem("notes", JSON.stringify(noteIds));
      }
      history.replaceState(
        { newNoteId },
        "quick-pad: note",
        "/note/" + newNoteId
      );
      hookIntoNoteChanges(newNoteId);
    });
    area!.removeEventListener("input", enableEdit);
  };
  area!.addEventListener("input", enableEdit);
}

// catch-all in case of unexpected error somewhere
setTimeout(showLogInOutLink, 1000);
