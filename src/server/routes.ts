import { renderFile } from "eta";
import { Express } from "express";
import { create, persist, recall, checkStatus } from "./store.js";

interface RenderClientConfig {
  interactionStyle?: "readOnly" | "createOnEdit" | "editable";
  content?: string;
  noteId?: string;
  title?: string;
}

const renderClient = (config: RenderClientConfig) => {
  const {
    interactionStyle = "readOnly",
    content,
    noteId,
    title = "quick-pad",
  } = config;
  return renderFile("./main.eta", {
    content,
    title,
    env: JSON.stringify({ interactionStyle, noteId }),
    interactionStyle:
      interactionStyle !== "readOnly" ? "autofocus" : "readonly",
  });
};

const homeScreenText = `
quick-pad:
dead-simple collaborative notepad
---

Click (+) or edit this page to create a note.
Send the link to share.

Notes expire after 365 days of disuse.
`;

const noteNotFoundText = `
404: Note not found
---

The note at this address either has not been created or has been deleted.
Click (+) to create a new note.
`;

const pageNotFoundText = `
404: page not found
---

Oops! Nothing exists here.
`;

// TODO: use promises a little better than I'm doing right now
function configureRoutes(app: Express) {
  // root is read-only info page
  app.get("/", async function (_, response) {
    response.send(
      await renderClient({
        content: homeScreenText,
        interactionStyle: "createOnEdit",
      })
    );
  });

  // new will redirect to the properly
  app.get("/new/", async function (_, response) {
    const newId = await create();
    response.redirect(`/note/${newId}/`);
  });

  app.get("/note/:id/", async function (request, response) {
    const id = request.params.id;
    const content = await recall(id);
    if (typeof content === "string") {
      response.send(
        await renderClient({
          content: content,
          title: "quick-pad: note",
          noteId: id,
          interactionStyle: "editable",
        })
      );
    } else {
      response.status(404).send(
        await renderClient({
          content: noteNotFoundText,
          title: "quick-pad: note not found",
        })
      );
    }
  });

  app.post("/note/:id/", async function (request, response) {
    await persist(request.params.id, request.body.content || "");
    response.status(200).json({ success: true });
  });

  app.post("/statusCheck", async function (request, response) {
    const ids = request.body.ids;
    if (!Array.isArray(ids)) {
      response.status(400).json({ success: false });
      return;
    }
    if (ids.length > 1000) {
      response.status(400).json({
        success: false,
        video: "https://www.youtube.com/watch?v=Q5N_GPkSS6c",
      });
      return;
    }
    if (ids.length === 0) {
      response.status(200).json([]);
      return;
    }
    const statuses = await checkStatus(ids);
    response.status(200).json(statuses);
  });

  app.get("*", async function (_, response) {
    response.status(404).send(
      await renderClient({
        content: pageNotFoundText,
        title: "quick-pad: page not found",
      })
    );
  });
}

export default configureRoutes;
