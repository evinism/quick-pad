import { renderFile } from "eta";
import express, { Express } from "express";
import passport from "passport";
import { create, persist, recall, checkStatus } from "./store";
import {
  homeScreenText,
  pageNotFoundText,
  noteNotFoundText,
  failedLoginText,
} from "./copy";

interface RenderClientConfig {
  interactionStyle?: "readOnly" | "createOnEdit" | "editable";
  content?: string;
  noteId?: string;
  title?: string;
}

const renderClient =
  (request: express.Request) => (config: RenderClientConfig) => {
    const {
      interactionStyle = "readOnly",
      content,
      noteId,
      title = "quick-pad",
    } = config;
    const user = request.user;
    return renderFile("./main.eta", {
      content,
      title,
      env: JSON.stringify({ interactionStyle, noteId }),
      user,
      interactionStyle:
        interactionStyle !== "readOnly" ? "autofocus" : "readonly",
    });
  };

// TODO: use promises a little better than I'm doing right now
function configureRoutes(app: Express) {
  // root is read-only info page
  app.get("/", async function (request, response) {
    response.send(
      await renderClient(request)({
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
        await renderClient(request)({
          content: content,
          title: "quick-pad: note",
          noteId: id,
          interactionStyle: "editable",
        })
      );
    } else {
      response.status(404).send(
        await renderClient(request)({
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

  // --- Auth related endpoints ---
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/failedlogin" }),
    function (_, res) {
      res.redirect("/");
    }
  );

  app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
  });

  app.get("/failedlogin", async function (request, response) {
    response.send(
      await renderClient(request)({
        content: failedLoginText,
        interactionStyle: "readOnly",
      })
    );
  });

  // --- Finally, 404 ---

  app.get("*", async function (request, response) {
    response.status(404).send(
      await renderClient(request)({
        content: pageNotFoundText,
        title: "quick-pad: page not found",
      })
    );
  });
}

export default configureRoutes;
