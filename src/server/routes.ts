import { v4 } from "uuid";
import { renderFile } from "eta";
import express, { Express } from "express";
import passport from "passport";
import { prisma, getRecentNotesForUser } from "./db";
import { ensureDoc, getDocContent } from "./sharedb";
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
      env: JSON.stringify({
        interactionStyle,
        noteId,
        email: (user as any)?.email,
      }),
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

  // new will redirect to the new note
  app.get("/new/", async function (request, response) {
    // TODO: make this retry infinitely until a new id is found.
    const newId = v4().split("-")[0];
    console.log(`Creating note ${newId}`);

    // Create In Postgres
    await prisma.notes.create({
      data: {
        id: newId,
        lastuse: new Date(),
        content: "",
        ownerId: (request.user as any)?.id,
      },
    });

    // Ensure ShareDB doc exists for the new note
    await ensureDoc(newId, '');
    response.redirect(`/note/${newId}/`);
  });

  app.get("/note/:id/", async function (request, response) {
    const id = request.params.id;
    const content = await getDocContent(id)
    if (typeof content === "string") {
      response.send(
        await renderClient(request)({
          content: content,
          title: "quick-pad: note",
          noteId: id,
          interactionStyle: "editable",
        }));
      return;
    }
    const dbContent = (await prisma.notes.findUnique({ where: { id } }))?.content;
    if (typeof dbContent === "string") {
      await ensureDoc(id, dbContent);
      response.send(
        await renderClient(request)({
          content: dbContent,
          title: "quick-pad: note",
          noteId: id,
          interactionStyle: "editable",
        })
      );
      return;
    }
    response.status(404).send(
      await renderClient(request)({
        content: noteNotFoundText,
        title: "quick-pad: note not found",
      })
    );
  });

  app.post("/note/:id/", async function (request, response) {
    await prisma.notes.update({
                where: { id: request.params.id },
                data: { content: request.body.content || "", lastuse: new Date() },
              });
    response.status(200).json({ success: true });
  });

  /* Paths for recent notes */
  app.post("/statusCheck", async function (request, response) {
    const ids = request.body.ids;

    // Validate ids - must be an array of strings, max length 1000
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

    // Do a lookup
    const statuses = [];
    for (const id of ids) {
      // If the doc is in memory, read live content from ShareDB
      const content = await getDocContent(id);
      if (content !== null) {
        const title = content.split("\n")[0].slice(0, 50);
        statuses.push({ id, abbreviation: title });
        continue;
      }
      // Else try fetching from Postgres as fallback
      const dbNote = await prisma.notes.findUnique({ where: { id } });
      if (dbNote) {
        const title = dbNote.content.split("\n")[0].slice(0, 50);
        statuses.push({ id, abbreviation: title });
      }
    }

    response.status(200).json(statuses);
  });

  app.get("/recents", async function (request, response) {
    if (!request.user) {
      response.status(400).json({ success: false });
      return;
    }

    // Fetch user from DB
    const userId = (request.user as any).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      response.status(400).json({ success: false });
      return;
    }

    const recents = await getRecentNotesForUser(userId);
    const recentsModified = recents
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .map(r => ({ id: r.id, abbreviation: r.title }));
    response
      .status(200)
      .json(recentsModified.filter(({ id }) => id !== request.query.reject));
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
