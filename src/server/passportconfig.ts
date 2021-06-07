import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./store";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "bogus",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "bogus",
      callbackURL: "/auth/google/callback",
    },
    async function (_, __, profile, done) {
      let user =
        (await prisma.user.findUnique({
          where: {
            google_id: profile.id,
          },
        })) || undefined;
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: profile.emails![0].value,
            google_id: profile.id,
          },
        });
      }

      return done(null, user);
    }
  )
);

passport.serializeUser(function (user: any, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id: any, done) {
  const user = await prisma.user.findUnique({ where: { id } });
  done(null, user);
});
