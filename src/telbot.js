const { Telegraf } = require("telegraf");
const { TwitterApi, TwitterApiV2Settings } = require("twitter-api-v2");
const { IntervalTaskRunner, Interval } = require("interval-task-runner");
const fs = require("fs");
const path = require("path");

TwitterApiV2Settings.deprecationWarnings = false;

const twitterClient = new TwitterApi({
  appKey: "abLQxkV2s2nHc2O7YyyLTr5MZ",
  appSecret: "IfAXy2KJ9JYxPHaq24r6WIk9CV4Lk6rRJEAqGKY9pnspDinWON",
  accessToken: "1093245624168927232-kbhUd2FkIRFNc13X6wwMF2q3VAYjHr",
  accessSecret: "a5UIUjFBFpcLR1PmTlgZ9dDlBxMYnTTkcMrB11mvEfXgK",
});
const twitter = twitterClient.readWrite;
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
          fileName: content.message.video.file_unique_id + ".mp4",
          cloneFiles: false,
        });
        try {
          await downloader.download();
          //Buscar y comprobar si el archivo existe, si es asi responde con que ya está, sino lo envia
          tweetVideo(downloader.config.fileName);
          content.reply("Enviado a Twitter");
        } catch (error) {
          console.log(error);
        }
      });
  } else {
    content.reply("El archivo es muy grande");
  }
});

async function tweetVideo(params) {
  try {
    const mediaIdVideo = await twitter.v1.uploadMedia("./videos/" + params, {
      type: "longmp4",
    });
    const video = await twitter.v1.mediaInfo(mediaIdVideo);

    await twitter
      .post(`https://api.twitter.com/2/tweets`, {
        media: { media_ids: [video.media_id_string] },
        text: `Los invito a que visiten este perfil en PornHub para mas contenido😍😍😈😈🤤🤤:
        
        https://es.pornhub.com/model/lechita-hot`,
      })
      .then((result) => {
        console.log("Enviado con exito el tweet");
      })
      .catch((err) => {
        console.log("Erro al enviar el tweet");
      });
  } catch (error) {
    console.log(error);
  }
}

const borrado = function () {
  fs.readdir("./videos", (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join("./videos", file), (err) => {
        if (err) throw err;
      });
    }
  });
};
const interval = Interval.fromMs(360000); // Milisegundos.
const runner = new IntervalTaskRunner(borrado, interval).start();

bot.launch();
