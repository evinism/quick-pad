import io from "socket.io-client";
import {
  throttle,
  debounce,
  noteUrlToNoteID,
  enableTabsOnTextArea,
} from "./util.js";

type Message =
  | {
      type: "replace";
      content: string;
    }
  | {
      type: "viewerCount";
      content: number;
    };

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
      .catch(() => {})
      .then((response) => response && response.json())
      .then(renderAndPersist);
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
    .catch(() => {})
    .then((response) => response && response.json())
    .then(renderRecentNotes);
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
  sidebarShown: false,
  viewerCount: 0,
};

function setState(newState: Partial<ClientState>) {
  state = Object.assign({}, state, newState);
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
  /* saving logic */
  let save;
  let throttledSave: any;
  let debouncedSave: any;

  function attachSocketToApp(socket: any) {
    socket.on("connect", () => {
      socket.send({
        type: "register",
        id: noteId,
      });
    });

    socket.on("message", (message: Message) => {
      switch (message.type) {
        case "replace":
          // TODO: move area.value to state tree.
          area!.value = message.content;
          break;
        case "viewerCount":
          setState({
            viewerCount: message.content,
          });
          break;
        default:
          console.warn(`Unknown message type ${(message as any).type}`);
      }
    });

    save = function () {
      socket.send({
        type: "update",
        id: noteId,
        content: area!.value,
      });
    };

    throttledSave = throttle(save, 200);
    debouncedSave = debounce(save, 500);
  }

  // configure socket
  const HOST = location.origin.replace(/^http/, "ws");
  const ws = io(HOST);
  attachSocketToApp(ws);

  // Event listeners
  area!.addEventListener(
    "input",
    function () {
      throttledSave();
      debouncedSave();
    },
    false
  );
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
