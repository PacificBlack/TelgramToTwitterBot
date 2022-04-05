const { Telegraf } = require("telegraf");
const Downloader = require("nodejs-file-downloader");

const bot = new Telegraf("5155497007:AAEKgvKmmby-xDfurAGsezr97V50V0hUWnA");

bot.on("video", async (content) => {
  if (content.message.video.file_size < 22062035) {
    await content.telegram
      .getFileLink(content.message.video.file_id)
      .then(async (value) => {
        const downloader = new Downloader({
          url: value.href,
          directory: "./videos",
        });
        try {
          await downloader.download();
          content.reply("Enviado a Twitter");
        } catch (error) {
          console.log(error);
        }
        console.log();
      });
  } else {
    content.reply("El archivo es muy grande");
  }
});

bot.launch();
