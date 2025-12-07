import { prisma } from "./db";

function initCron() {
  setInterval(() => {
    console.log("Deleting old notes...");
    return prisma.$queryRaw`
      DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');
    `;
  }, 1000 * 60 * 60 * 24); // 1 day
}

export default initCron;
